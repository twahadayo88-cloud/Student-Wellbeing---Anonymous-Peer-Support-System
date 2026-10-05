/**
 * Complaint & Escalation Service — Module 8
 * ==========================================
 * Implements the two-level workflow:
 *   Level 1 (Faculty) → assigned_to faculty, sees only their complaints
 *   Level 2 (Admin/Super Admin) → sees escalated complaints only
 *
 * Constraints:
 *  - Student-to-student complaints only.
 *  - No SOS, no counselor alerts, no emergency routing of any kind.
 *  - Abuse-detection runs at submission to raise priority — it never auto-escalates.
 *  - Audit trail is append-only and readable only by Admin/Super Admin.
 *  - Identity-reveal requires Higher Authority + justification + secondary approval.
 */
const { pool, query } = require('../../config/db.config');
const AppError = require('../../utils/AppError');

const COMPLAINT_CATEGORIES = [
  'harassment',
  'abusive_language',
  'academic_dispute',
  'privacy_violation',
  'spam_or_scam',
  'other',
];

// ─── Submit ───────────────────────────────────────────────────────────────────

/**
 * Create a new complaint.
 * @param {number} reporterId  - authenticated student's user_id
 * @param {number} reportedId  - the peer being reported
 * @param {string} category    - one of COMPLAINT_CATEGORIES
 * @param {string} reason      - free-text description
 * @param {boolean} isFlagged  - set to true if abuse-detection flagged the text
 * @returns {number} insertId
 */
async function createComplaint(reporterId, reportedId, category, reason, evidenceRef, isFlagged) {
  const priority = isFlagged ? 'high' : 'normal';
  return _withTransaction(async connection => {
    const [facultyRows] = await connection.query(
      "SELECT id FROM users WHERE role = 'faculty' ORDER BY id FOR UPDATE"
    );
    if (!facultyRows.length) {
      throw new AppError('No faculty reviewer is available to receive this complaint.', 503);
    }

    const facultyIds = facultyRows.map(row => row.id);
    const placeholders = facultyIds.map(() => '?').join(', ');
    const [loads] = await connection.query(
      `SELECT assigned_to, COUNT(*) AS active_count
       FROM reports
       WHERE level = 1 AND status IN ('open', 'under_review')
         AND assigned_to IN (${placeholders})
       GROUP BY assigned_to`,
      facultyIds
    );
    const activeCounts = new Map(loads.map(row => [row.assigned_to, Number(row.active_count)]));
    const assignedFacultyId = facultyIds.sort((left, right) =>
      (activeCounts.get(left) || 0) - (activeCounts.get(right) || 0) || left - right
    )[0];

    const [result] = await connection.query(
      `INSERT INTO reports
         (reporter_id, reported_id, category, reason, evidence_ref, is_flagged,
          priority, status, level, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'under_review', 1, ?)`,
      [reporterId, reportedId, category, reason, evidenceRef, isFlagged ? 1 : 0, priority, assignedFacultyId]
    );

    await _appendAudit(result.insertId, reporterId, 'COMPLAINT_SUBMITTED', {
      category,
      priority,
      is_flagged: isFlagged,
    }, connection);
    await _appendAudit(result.insertId, assignedFacultyId, 'COMPLAINT_ASSIGNED', {
      faculty_id: assignedFacultyId,
      assignment: 'least_active_reviewer',
    }, connection);

    return result.insertId;
  });
}

// ─── Read (role-scoped) ───────────────────────────────────────────────────────

/**
 * Faculty sees only complaints assigned to them at Level 1.
 */
async function getComplaintsForFaculty(facultyId) {
  const [rows] = await query(
    `SELECT r.id, r.category, r.reason, r.evidence_ref, r.status, r.priority, r.is_flagged,
            r.created_at, r.faculty_note,
            p_reporter.anonymous_id AS reporter_anonymous_id,
            p_reported.anonymous_id AS reported_anonymous_id
     FROM reports r
     JOIN profiles p_reporter ON r.reporter_id = p_reporter.user_id
     LEFT JOIN profiles p_reported ON r.reported_id = p_reported.user_id
     WHERE r.assigned_to = ? AND r.level = 1
       AND r.status IN ('under_review', 'open')
     ORDER BY r.is_flagged DESC, r.created_at DESC`,
    [facultyId]
  );
  return rows;
}

/**
 * The reporter sees only their own submissions and no reported-user identity.
 */
async function getMyComplaints(reporterId) {
  const [rows] = await query(
    `SELECT id, category, reason, status, priority, is_flagged, created_at, resolved_at
     FROM reports WHERE reporter_id = ? ORDER BY created_at DESC`,
    [reporterId]
  );
  return rows;
}

/**
 * Admin/Super Admin sees only escalated (Level-2) complaints.
 */
async function getEscalatedComplaints() {
  const [rows] = await query(
        `SELECT r.id, r.category, r.reason, r.evidence_ref, r.status, r.priority, r.is_flagged,
          r.faculty_note, r.created_at, r.level,
            p_reporter.anonymous_id AS reporter_anonymous_id,
            p_reported.anonymous_id AS reported_anonymous_id,
            u_faculty.id AS escalated_by_faculty_id
     FROM reports r
     JOIN profiles p_reporter ON r.reporter_id = p_reporter.user_id
         LEFT JOIN profiles p_reported ON r.reported_id = p_reported.user_id
     LEFT JOIN users u_faculty ON r.assigned_to = u_faculty.id
         WHERE r.level = 2 AND r.status = 'escalated'
     ORDER BY r.is_flagged DESC, r.created_at DESC`
  );
  return rows;
}

async function getPendingIdentityReveals() {
  const [rows] = await query(
    `SELECT er.id AS record_id, er.content_ref AS complaint_id, er.reason AS justification,
            er.actioned_by, er.created_at
     FROM escalation_records er
     JOIN reports r ON r.id = CAST(er.content_ref AS UNSIGNED)
     WHERE er.level = 'identity_reveal'
       AND er.secondary_approval_by IS NULL
       AND r.level = 2 AND r.status = 'escalated'
     ORDER BY er.created_at ASC`
  );
  return rows;
}

/**
 * Admin/Super Admin full audit trail for a single complaint.
 */
async function getComplaintAuditTrail(complaintId) {
  const [rows] = await query(
    `SELECT id, action, actor_id, details, created_at
     FROM complaint_history
     WHERE complaint_id = ?
     ORDER BY created_at ASC`,
    [complaintId]
  );
  return rows;
}

// ─── Workflow transitions ─────────────────────────────────────────────────────

/** Faculty resolves, rejects, or escalates only their assigned Level-1 case. */
async function reviewLevelOneComplaint(complaintId, facultyId, action, note = '') {
  if (!['resolve', 'reject', 'escalate'].includes(action)) {
    throw AppError.badRequest('Action must be resolve, reject, or escalate.');
  }
  const reviewNote = typeof note === 'string' ? note.trim() : '';
  if (action !== 'resolve' && reviewNote.length < 10) {
    throw AppError.badRequest('A note of at least 10 characters is required for rejection or escalation.');
  }

  return _withTransaction(async connection => {
    const complaint = await _getComplaintOrThrow(complaintId, connection, true);
    if (complaint.level !== 1 || complaint.assigned_to !== facultyId ||
        !['open', 'under_review'].includes(complaint.status)) {
      throw AppError.forbidden('Only the assigned faculty member may review this Level-1 complaint.');
    }

    const status = action === 'escalate' ? 'escalated' : action === 'reject' ? 'rejected' : 'resolved';
    const level = action === 'escalate' ? 2 : 1;
    await connection.query(
      `UPDATE reports
       SET status = ?, level = ?, faculty_note = ?, resolved_at = ?
       WHERE id = ? AND assigned_to = ? AND level = 1`,
      [status, level, reviewNote || null, action === 'escalate' ? null : new Date(), complaintId, facultyId]
    );
    const auditAction = {
      resolve: 'COMPLAINT_RESOLVED',
      reject: 'COMPLAINT_REJECTED',
      escalate: 'COMPLAINT_ESCALATED',
    }[action];
    await _appendAudit(complaintId, facultyId, auditAction, {
      from_level: 1,
      to_level: level,
      note: reviewNote || null,
    }, connection);
  });
}

/**
 * Admin/Super Admin resolves or dismisses a Level-2 complaint.
 */
async function resolveComplaint(complaintId, adminId, resolution) {
  if (!resolution || !['resolve', 'reject'].includes(resolution.action)) {
    throw AppError.badRequest("action must be 'resolve' or 'reject'.");
  }
  const resolutionNote = typeof resolution.note === 'string' ? resolution.note.trim() : '';
  if (resolutionNote.length < 10) {
    throw AppError.badRequest('A resolution note of at least 10 characters is required.');
  }

  return _withTransaction(async connection => {
    const complaint = await _getComplaintOrThrow(complaintId, connection, true);
    if (complaint.level !== 2 || complaint.status !== 'escalated') {
      throw AppError.badRequest('Only escalated complaints can be resolved here.');
    }

    const status = resolution.action === 'reject' ? 'rejected' : 'resolved';
    await connection.query(
      `UPDATE reports SET status = ?, faculty_note = ?, resolved_at = NOW() WHERE id = ?`,
      [status, resolutionNote, complaintId]
    );
    await _appendAudit(
      complaintId,
      adminId,
      resolution.action === 'reject' ? 'COMPLAINT_REJECTED' : 'COMPLAINT_RESOLVED',
      {
      from_level: 2,
      note: resolutionNote,
      },
      connection
    );
  });
}

// ─── Identity Reveal ─────────────────────────────────────────────────────────

/**
 * Step 1: Admin/Super Admin initiates an identity-reveal request.
 * Requires justification. Creates a pending escalation_record awaiting secondary approval.
 */
async function requestIdentityReveal(complaintId, requesterId, justification) {
  const reason = typeof justification === 'string' ? justification.trim() : '';
  if (reason.length < 20) {
    throw AppError.badRequest('Justification of at least 20 characters is required.');
  }
  return _withTransaction(async connection => {
    const complaint = await _getComplaintOrThrow(complaintId, connection, true);
    if (complaint.level !== 2 || complaint.status !== 'escalated' || !complaint.reported_id) {
      throw AppError.badRequest('Identity reveal is available only for escalated complaints against a student.');
    }

    const [existing] = await connection.query(
      `SELECT id FROM escalation_records
       WHERE level = 'identity_reveal' AND content_ref = ? AND secondary_approval_by IS NULL`,
      [String(complaintId)]
    );
    if (existing.length) {
      throw AppError.conflict('A reveal request is already awaiting secondary approval.');
    }

    const [result] = await connection.query(
      `INSERT INTO escalation_records
         (user_id, anonymous_id, level, reason, content_ref, actioned_by)
       VALUES (?, NULL, 'identity_reveal', ?, ?, ?)`,
      [complaint.reported_id, reason, String(complaintId), requesterId]
    );
    await _appendAudit(complaintId, requesterId, 'IDENTITY_REVEAL_REQUESTED', {
      escalation_record_id: result.insertId,
      justification: reason,
    }, connection);

    return { escalation_record_id: result.insertId };
  });
}

/**
 * Step 2: A second Higher Authority (different admin) approves the reveal.
 * Returns the real user ID of the reported student.
 */
async function approveIdentityReveal(escalationRecordId, approverId) {
  return _withTransaction(async connection => {
    const [rows] = await connection.query(
      `SELECT er.*, r.reported_id, r.reporter_id
       FROM escalation_records er
       JOIN reports r ON r.id = CAST(er.content_ref AS UNSIGNED)
       WHERE er.id = ? AND er.level = 'identity_reveal'
         AND er.secondary_approval_by IS NULL AND r.level = 2 AND r.status = 'escalated'
       FOR UPDATE`,
      [escalationRecordId]
    );
    if (!rows.length) {
      throw AppError.notFound('Reveal request not found, no longer eligible, or already approved.');
    }
    if (rows[0].actioned_by === approverId) {
      throw AppError.forbidden('Secondary approval must come from a different administrator.');
    }

    await connection.query(
      `UPDATE escalation_records SET secondary_approval_by = ? WHERE id = ?`,
      [approverId, escalationRecordId]
    );

    const reportedId = rows[0].reported_id;
    const [user] = await connection.query(
      'SELECT id, email FROM users WHERE id = ?',
      [reportedId]
    );
    await _appendAudit(
      Number(rows[0].content_ref),
      approverId,
      'IDENTITY_REVEAL_APPROVED',
      { revealed_user_id: reportedId },
      connection
    );

    return user.length ? { user_id: user[0].id, email: user[0].email } : null;
  });
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function _getComplaintOrThrow(complaintId, executor = query, lock = false) {
  const [rows] = await executor(
    `SELECT * FROM reports WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [complaintId]
  );
  if (!rows.length) throw AppError.notFound('Complaint not found.');
  return rows[0];
}

/**
 * Append-only record in complaint_history. No update/delete path exists.
 */
async function _appendAudit(complaintId, actorId, action, details, connection) {
  await connection.query(
    `INSERT INTO complaint_history (complaint_id, actor_id, action, details)
     VALUES (?, ?, ?, ?)`,
    [complaintId, actorId, action, JSON.stringify(details)]
  );
}

async function _withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  COMPLAINT_CATEGORIES,
  createComplaint,
  getMyComplaints,
  getComplaintsForFaculty,
  getEscalatedComplaints,
  getPendingIdentityReveals,
  getComplaintAuditTrail,
  reviewLevelOneComplaint,
  resolveComplaint,
  requestIdentityReveal,
  approveIdentityReveal,
};
