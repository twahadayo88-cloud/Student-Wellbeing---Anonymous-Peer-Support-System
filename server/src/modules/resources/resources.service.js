const { query } = require('../../config/db.config');
const AppError = require('../../utils/AppError');
const contentSafety = require('../../services/contentSafety.service');
const moodService = require('../mood/mood.service');

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
            (
              CASE
                WHEN ? <= 2 AND LOWER(r.category) IN ('wellbeing', 'wellness') THEN 35
                WHEN ? >= 4 AND LOWER(r.category) IN ('practice', 'lecture notes', 'reference') THEN 10
                ELSE 0
              END
              + CASE
                  WHEN r.subject IS NOT NULL AND student_profile.subjects IS NOT NULL
                       AND JSON_CONTAINS(student_profile.subjects, JSON_QUOTE(r.subject)) THEN 30
                  ELSE 0
                END
              + CASE
                  WHEN r.semester IS NOT NULL AND r.semester = student_profile.semester THEN 20
                  ELSE 0
                END
              + CASE WHEN EXISTS (
                  SELECT 1 FROM resource_reviews personal_review
                  WHERE personal_review.resource_id = r.id
                    AND personal_review.user_id = ? AND personal_review.rating >= 4
                ) THEN 15 ELSE 0 END
            ) AS recommendation_score
     FROM resources r
     LEFT JOIN profiles p ON p.user_id = r.uploader_id
     LEFT JOIN profiles student_profile ON student_profile.user_id = ?
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${options.recommendations ? 'recommendation_score DESC,' : ''}
              (bookmark_count + review_count * 0.25) DESC, average_rating DESC, r.created_at DESC
     LIMIT 100`,
    [userId, moodScore, moodScore, userId, userId, ...params.slice(1)]
  );
  return rows.map(row => ({
    ...row,
    average_rating: Number(row.average_rating),
  }));
}

async function getRecommendations(userId) {
  const moodContext = await moodService.getRecommendationContext(userId);
  const moodScore = moodContext.mood_score || 3;
  return listApprovedResources({}, userId, {
    recommendations: true,
    moodScore,
  });
}

async function getMyResources(userId) {
  const [rows] = await query(
    `SELECT id, title, description, subject, semester, category, external_url,
            original_file_name, status, is_flagged, moderation_reason,
            relevance_score, quality_score, review_note, created_at
     FROM resources WHERE uploader_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function getFacultyQueue() {
  const [rows] = await query(
    `SELECT r.id, r.title, r.description, r.subject, r.semester, r.category,
            r.external_url, r.original_file_name, r.uploader_id, r.status,
            r.is_flagged, r.moderation_reason, r.relevance_score, r.quality_score,
            r.created_at,
            p.anonymous_id AS uploader_anonymous_id
     FROM resources r
     LEFT JOIN profiles p ON p.user_id = r.uploader_id
     WHERE r.status IN ('pending', 'flagged')
     ORDER BY r.is_flagged DESC, r.created_at ASC`
  );
  return rows;
}

async function reviewResource(resourceId, facultyId, status, note, relevanceScore, qualityScore) {
  if (!['approved', 'rejected'].includes(status)) {
    throw AppError.badRequest('Review status must be approved or rejected.');
  }
  if (![relevanceScore, qualityScore].every(score => Number.isInteger(score) && score >= 1 && score <= 5)) {
    throw AppError.badRequest('Relevance and quality scores must each be integers from 1 to 5.');
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
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ?,
         relevance_score = ?, quality_score = ?,
         is_flagged = IF(? = 'approved', 0, is_flagged),
         moderation_reason = IF(? = 'approved', NULL, moderation_reason)
     WHERE id = ? AND status IN ('pending', 'flagged')`,
    [status, facultyId, reviewNote || null, relevanceScore, qualityScore, status, status, resourceId]
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
         moderation_reason = 'Average rating below 1.5; returned to faculty review queue',
         reviewed_by = NULL, reviewed_at = NULL, review_note = NULL,
         relevance_score = NULL, quality_score = NULL
     WHERE r.id = ?
       AND (SELECT AVG(rr.rating) FROM resource_reviews rr WHERE rr.resource_id = r.id) < 1.5`,
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