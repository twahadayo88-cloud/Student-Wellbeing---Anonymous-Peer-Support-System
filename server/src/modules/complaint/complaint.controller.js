const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { AUDIT_ACTIONS } = require('../../utils/constants');
const complaintService = require('./complaint.service');
const communicationService = require('../communication/communication.service');
const contentSafety = require('../../services/contentSafety.service');

/**
 * POST /api/complaints
 * Student submits a complaint against another student.
 */
const submitComplaint = asyncHandler(async (req, res) => {
  const reporterId = req.user.user_id;
  const anonymousId = typeof req.body.anonymous_id === 'string' ? req.body.anonymous_id.trim() : '';
  const category = req.body.category;
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const evidenceRef = typeof req.body.evidence_ref === 'string' ? req.body.evidence_ref.trim() : '';

  if (!category || !reason || (!anonymousId && !evidenceRef)) {
    throw AppError.badRequest('Category, description, and either a peer ID or evidence reference are required.');
  }
  if (!complaintService.COMPLAINT_CATEGORIES.includes(category)) {
    throw AppError.badRequest(
      `Invalid category. Must be one of: ${complaintService.COMPLAINT_CATEGORIES.join(', ')}.`
    );
  }
  if (reason.length < 10 || reason.length > 1000) {
    throw AppError.badRequest('Reason must be at least 10 characters.');
  }
  if (evidenceRef.length > 255) {
    throw AppError.badRequest('Evidence reference must be 255 characters or fewer.');
  }

  let reportedId = null;
  if (anonymousId) {
    reportedId = await communicationService.getUserIdByAnonymousId(anonymousId);
    if (!reportedId || await communicationService.getUserRoleById(reportedId) !== 'student') {
      throw AppError.notFound('Reported student not found.');
    }
    if (reportedId === reporterId) throw AppError.badRequest('You cannot report yourself.');
  }

  // Abuse-detection on complaint text — raises priority only, never auto-escalates
  const safetyResult = await contentSafety.analyzeContent(reason);
  const isFlagged = safetyResult.isFlagged;

  const complaintId = await complaintService.createComplaint(
    reporterId, reportedId, category, reason, evidenceRef || null, isFlagged
  );

  logger.audit(AUDIT_ACTIONS.MESSAGE_FLAGGED, {
    action: 'COMPLAINT_SUBMITTED',
    reporter: req.user.anonymous_id,
    category,
    is_flagged: isFlagged,
  });

  return res.status(201).json({
    success: true,
    message: 'Complaint submitted. It will be reviewed by the appropriate team.',
    data: { complaint_id: complaintId, is_flagged: isFlagged },
  });
});

/**
 * GET /api/complaints/my
 * Student sees complaints they filed (status updates only — no peer identity exposed).
 */
const getMyComplaints = asyncHandler(async (req, res) => {
  const rows = await complaintService.getMyComplaints(req.user.user_id);
  return res.status(200).json({ success: true, data: rows });
});

/**
 * GET /api/complaints/faculty/mine
 * Faculty sees complaints assigned to them.
 */
const getFacultyMine = asyncHandler(async (req, res) => {
  const rows = await complaintService.getComplaintsForFaculty(req.user.user_id);
  return res.status(200).json({ success: true, data: rows });
});

/** Faculty acts only on their own Level-1 assignment. */
const reviewLevelOne = asyncHandler(async (req, res) => {
  const { action, note } = req.body;
  await complaintService.reviewLevelOneComplaint(
    Number(req.params.id), req.user.user_id, action, note
  );
  const pastTense = { resolve: 'resolved', reject: 'rejected', escalate: 'escalated' }[action];
  return res.status(200).json({ success: true, message: `Complaint ${pastTense}.` });
});

/**
 * GET /api/complaints/admin/escalated
 * Admin/Super Admin sees all Level-2 (escalated) complaints.
 */
const getEscalated = asyncHandler(async (req, res) => {
  const rows = await complaintService.getEscalatedComplaints();
  return res.status(200).json({ success: true, data: rows });
});

/**
 * POST /api/complaints/:id/resolve
 * Admin/Super Admin resolves or dismisses a Level-2 complaint.
 */
const resolveComplaint = asyncHandler(async (req, res) => {
  const { action, note } = req.body;
  if (!['resolve', 'reject'].includes(action)) {
    throw AppError.badRequest("action must be 'resolve' or 'reject'.");
  }
  await complaintService.resolveComplaint(
    Number(req.params.id), req.user.user_id, { action, note }
  );
  const pastTense = action === 'reject' ? 'rejected' : 'resolved';
  return res.status(200).json({ success: true, message: `Complaint ${pastTense}.` });
});

/**
 * GET /api/complaints/:id/audit
 * Admin/Super Admin only — full append-only audit trail for a complaint.
 */
const getAuditTrail = asyncHandler(async (req, res) => {
  const rows = await complaintService.getComplaintAuditTrail(Number(req.params.id));
  return res.status(200).json({ success: true, data: rows });
});

const getPendingReveals = asyncHandler(async (req, res) => {
  const rows = await complaintService.getPendingIdentityReveals();
  return res.status(200).json({ success: true, data: rows });
});

/**
 * POST /api/complaints/:id/reveal-request
 * Admin/Super Admin initiates identity-reveal. Requires justification.
 */
const requestReveal = asyncHandler(async (req, res) => {
  const { justification } = req.body;
  const result = await complaintService.requestIdentityReveal(
    Number(req.params.id), req.user.user_id, justification
  );
  return res.status(201).json({
    success: true,
    message: 'Identity reveal request created. Awaiting secondary approval.',
    data: result,
  });
});

/**
 * POST /api/complaints/reveal-approve/:recordId
 * A second Admin/Super Admin approves the reveal. Returns real identity.
 */
const approveReveal = asyncHandler(async (req, res) => {
  const identity = await complaintService.approveIdentityReveal(
    Number(req.params.recordId), req.user.user_id
  );
  return res.status(200).json({
    success: true,
    message: 'Identity reveal approved.',
    data: identity,
  });
});

module.exports = {
  submitComplaint,
  getMyComplaints,
  getFacultyMine,
  reviewLevelOne,
  getEscalated,
  resolveComplaint,
  getAuditTrail,
  getPendingReveals,
  requestReveal,
  approveReveal,
};
