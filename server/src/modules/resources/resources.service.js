const { query } = require('../../config/db.config');
const AppError = require('../../utils/AppError');
const contentSafety = require('../../services/contentSafety.service');

async function scanMetadata(title, description) {
  return contentSafety.analyzeContent(`${title}\n${description}`);
}

async function createResource(userId, input, file) {
  const safety = await scanMetadata(input.title, input.description);
  const status = safety.isFlagged ? 'flagged' : 'pending';
  const [result] = await query(
    `INSERT INTO resources
       (uploader_id, title, description, subject, semester, category, external_url,
        file_path, original_file_name, mime_type, file_size, status, is_flagged, moderation_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.title,
      input.description,
      input.subject || null,
      input.semester || null,
      input.category,
      input.externalUrl || null,
      file?.path || null,
      file?.originalname || null,
      file?.mimetype || null,
      file?.size || null,
      status,
      safety.isFlagged ? 1 : 0,
      safety.isFlagged ? `${safety.severity}: ${safety.matchedTerms.join(', ')}` : null,
    ]
  );
  return { id: result.insertId, status, flagged: safety.isFlagged };
}

async function listApprovedResources(filters = {}, userId, options = {}) {
  const conditions = ["r.status = 'approved'"];
  const params = [userId];
  if (filters.subject) {
    conditions.push('r.subject = ?');
    params.push(filters.subject);
  }
  if (filters.semester) {
    conditions.push('r.semester = ?');
    params.push(filters.semester);
  }
  if (filters.category) {
    conditions.push('r.category = ?');
    params.push(filters.category);
  }
  if (filters.search) {
    conditions.push('(r.title LIKE ? OR r.description LIKE ? OR r.subject LIKE ?)');
    const search = `%${filters.search}%`;
    params.push(search, search, search);
  }
  if (filters.bookmarkedBy) {
    conditions.push('EXISTS (SELECT 1 FROM resource_bookmarks rb_filter WHERE rb_filter.resource_id = r.id AND rb_filter.user_id = ?)');
    params.push(filters.bookmarkedBy);
  }
  const moodScore = Number.isFinite(options.moodScore) ? options.moodScore : 3;

  const [rows] = await query(
    `SELECT r.id, r.title, r.description, r.subject, r.semester, r.category,
            r.external_url, r.original_file_name, r.uploader_id, r.created_at,
            p.anonymous_id AS uploader_anonymous_id,
            COALESCE((SELECT AVG(rv.rating) FROM resource_reviews rv WHERE rv.resource_id = r.id), 0) AS average_rating,
            (SELECT COUNT(*) FROM resource_reviews rv WHERE rv.resource_id = r.id) AS review_count,
            (SELECT COUNT(*) FROM resource_bookmarks rb WHERE rb.resource_id = r.id) AS bookmark_count,
            EXISTS(SELECT 1 FROM resource_bookmarks mine WHERE mine.resource_id = r.id AND mine.user_id = ?) AS is_bookmarked,
            CASE WHEN ? <= 2 AND LOWER(r.category) IN ('wellbeing', 'wellness') THEN 1 ELSE 0 END AS mood_match
     FROM resources r
     LEFT JOIN profiles p ON p.user_id = r.uploader_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${options.recommendations ? 'mood_match DESC,' : ''}
              (bookmark_count + review_count * 0.25) DESC, average_rating DESC, r.created_at DESC
     LIMIT 100`,
    [userId, moodScore, ...params.slice(1)]
  );
  return rows.map(row => ({ ...row, average_rating: Number(row.average_rating) }));
}

async function getRecommendations(userId) {
  const [moods] = await query(
    'SELECT mood_score FROM mood_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return listApprovedResources({}, userId, {
    recommendations: true,
    moodScore: moods.length ? Number(moods[0].mood_score) : 3,
  });
}

async function getMyResources(userId) {
  const [rows] = await query(
    `SELECT id, title, description, subject, semester, category, external_url,
            original_file_name, status, is_flagged, moderation_reason, created_at
     FROM resources WHERE uploader_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function getFacultyQueue() {
  const [rows] = await query(
    `SELECT r.id, r.title, r.description, r.subject, r.semester, r.category,
            r.external_url, r.original_file_name, r.uploader_id, r.status,
            r.is_flagged, r.moderation_reason, r.created_at,
            p.anonymous_id AS uploader_anonymous_id
     FROM resources r
     LEFT JOIN profiles p ON p.user_id = r.uploader_id
     WHERE r.status IN ('pending', 'flagged')
     ORDER BY r.is_flagged DESC, r.created_at ASC`
  );
  return rows;
}

async function reviewResource(resourceId, facultyId, status, note) {
  if (!['approved', 'rejected'].includes(status)) {
    throw AppError.badRequest('Review status must be approved or rejected.');
  }
  const reviewNote = typeof note === 'string' ? note.trim() : '';
  if (reviewNote.length > 1000) {
    throw AppError.badRequest('Review note must be 1000 characters or fewer.');
  }
  if (status === 'rejected' && reviewNote.length < 5) {
    throw AppError.badRequest('A rejection reason of at least 5 characters is required.');
  }
  const [result] = await query(
    `UPDATE resources
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ?
     WHERE id = ? AND status IN ('pending', 'flagged')`,
    [status, facultyId, reviewNote || null, resourceId]
  );
  if (!result.affectedRows) throw AppError.notFound('Pending resource not found.');
}

async function addReview(resourceId, userId, rating, review) {
  const [resource] = await query("SELECT id FROM resources WHERE id = ? AND status = 'approved'", [resourceId]);
  if (!resource.length) throw AppError.notFound('Approved resource not found.');

  await query(
    `INSERT INTO resource_reviews (resource_id, user_id, rating, review)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), updated_at = NOW()`,
    [resourceId, userId, rating, review || null]
  );
  await query(
    `UPDATE resources r
     SET status = 'flagged', is_flagged = 1,
         moderation_reason = 'Low average rating; returned to faculty review queue'
     WHERE r.id = ?
       AND (SELECT COUNT(*) FROM resource_reviews rr WHERE rr.resource_id = r.id) >= 3
       AND (SELECT AVG(rr.rating) FROM resource_reviews rr WHERE rr.resource_id = r.id) < 2.5`,
    [resourceId]
  );
}

async function getReviews(resourceId) {
  const [rows] = await query(
    `SELECT rr.id, rr.rating, rr.review, rr.created_at, p.anonymous_id AS reviewer_anonymous_id
     FROM resource_reviews rr
     LEFT JOIN profiles p ON p.user_id = rr.user_id
     WHERE rr.resource_id = ? ORDER BY rr.created_at DESC`,
    [resourceId]
  );
  return rows;
}

async function getBookmarks(userId) {
  return listApprovedResources({ bookmarkedBy: userId }, userId);
}

async function addBookmark(resourceId, userId) {
  const [result] = await query(
    `INSERT IGNORE INTO resource_bookmarks (resource_id, user_id)
     SELECT id, ? FROM resources WHERE id = ? AND status = 'approved'`,
    [userId, resourceId]
  );
  if (!result.affectedRows) {
    const [rows] = await query('SELECT id FROM resources WHERE id = ? AND status = \'approved\'', [resourceId]);
    if (!rows.length) throw AppError.notFound('Approved resource not found.');
  }
}

async function removeBookmark(resourceId, userId) {
  await query('DELETE FROM resource_bookmarks WHERE resource_id = ? AND user_id = ?', [resourceId, userId]);
}

async function getDownload(resourceId, userId, role) {
  const [rows] = await query('SELECT * FROM resources WHERE id = ?', [resourceId]);
  if (!rows.length) throw AppError.notFound('Resource not found.');
  const resource = rows[0];
  const canReview = role === 'faculty' || role === 'admin' || role === 'super_admin';
  if (resource.status !== 'approved' && resource.uploader_id !== userId && !canReview) {
    throw AppError.forbidden('This resource is not available.');
  }
  if (!resource.file_path) throw AppError.notFound('This resource is an external link.');
  return resource;
}

module.exports = {
  createResource,
  listApprovedResources,
  getRecommendations,
  getMyResources,
  getFacultyQueue,
  reviewResource,
  addReview,
  getReviews,
  getBookmarks,
  addBookmark,
  removeBookmark,
  getDownload,
};