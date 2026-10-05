const { query } = require('../../config/db.config');
const { getIO } = require('../../config/socket.config');
const contentSafety = require('../../services/contentSafety.service');
const AppError = require('../../utils/AppError');

const NOTICE_CATEGORIES = ['study_groups', 'lost_found', 'events', 'announcements'];
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;
const PAYMENT_PATTERN = /\b(send money|pay me|payment request|bank details|account number|easypaisa|jazzcash|cash app|venmo|paypal)\b/i;

function assertSafeText(text) {
  if (PHONE_PATTERN.test(text) || PAYMENT_PATTERN.test(text)) {
    throw AppError.badRequest('Phone numbers and payment requests are not allowed in notice posts.');
  }
}

async function addModerationItem(postId, userId, body, severity, reason) {
  const [[profile]] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
  await query(
    `INSERT INTO moderation_queue
       (content_type, content_id, content_text, user_id, anonymous_id, ai_severity, ai_reason)
     VALUES ('notice_post', ?, ?, ?, ?, ?, ?)`,
    [postId, body, userId, profile?.anonymous_id || null, severity.toUpperCase(), reason]
  );
}

async function notifyDepartment(department, post) {
  if (!department) return;
  const message = `Official announcement: ${post.title}`;
  await query(
    `INSERT INTO notifications (user_id, type, message)
     SELECT u.id, 'OFFICIAL_ANNOUNCEMENT', ?
     FROM users u JOIN profiles p ON p.user_id = u.id
     WHERE u.role = 'student' AND p.department = ? AND u.id <> ?`,
    [message, department, post.user_id]
  );
  const io = getIO();
  if (io) {
    io.to(`dept_${department.toLowerCase()}`).emit('notice:new', {
      id: post.id,
      title: post.title,
      category: post.category,
      is_official: true,
      created_at: post.created_at,
    });
  }
}

async function createPost(user, input) {
  if (!NOTICE_CATEGORIES.includes(input.category)) {
    throw AppError.badRequest(`Category must be one of: ${NOTICE_CATEGORIES.join(', ')}.`);
  }
  const isOfficial = user.role !== 'student' && input.category === 'announcements';
  if (input.category === 'announcements' && !isOfficial) {
    throw AppError.forbidden('Only Faculty or Higher Authority can publish official announcements.');
  }
  const [[authorProfile]] = await query('SELECT department FROM profiles WHERE user_id = ?', [user.user_id]);
  if (isOfficial && !authorProfile?.department) {
    throw AppError.badRequest('Set a department on your profile before publishing an official announcement.');
  }
  assertSafeText(`${input.title}\n${input.body}`);

  const safety = await contentSafety.analyzeContent(`${input.title}\n${input.body}`);
  const status = safety.severity === 'high' ? 'rejected' : safety.severity === 'medium' ? 'held' : 'published';
  const [result] = await query(
    `INSERT INTO notice_posts
       (user_id, department, category, title, body, location_name, latitude, longitude, is_official,
        status, is_flagged, severity, appeal_available, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [
      user.user_id, authorProfile?.department || null, input.category, input.title, input.body, input.locationName || null,
      input.latitude, input.longitude, isOfficial ? 1 : 0, status, safety.isFlagged ? 1 : 0,
      safety.severity.toUpperCase(), status === 'rejected' ? 1 : 0, input.expiryDays,
    ]
  );

  const post = {
    id: result.insertId,
    user_id: user.user_id,
    department: authorProfile?.department || null,
    title: input.title,
    category: input.category,
    created_at: new Date(),
  };
  if (status !== 'published') {
    await addModerationItem(post.id, user.user_id, `${input.title}\n${input.body}`, safety.severity, safety.matchedTerms.join(', '));
  } else if (isOfficial) {
    await notifyDepartment(authorProfile.department, post);
  }
  return { id: post.id, status, is_official: isOfficial, appeal_available: status === 'rejected' };
}

async function listPosts(user, filters = {}) {
  const params = [];
  const conditions = ["p.status = 'published'", 'p.expires_at > NOW()'];
  if (user.role === 'student') {
    const [[profile]] = await query('SELECT department FROM profiles WHERE user_id = ?', [user.user_id]);
    conditions.push('(p.is_official = 0 OR p.department = ?)');
    params.push(profile?.department || '');
  }
  if (filters.category) {
    conditions.push('p.category = ?');
    params.push(filters.category);
  }
  if (filters.search) {
    conditions.push('(p.title LIKE ? OR p.body LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const hasNearby = Number.isFinite(filters.latitude) && Number.isFinite(filters.longitude);
  const distance = hasNearby
    ? '(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(p.latitude)) * COS(RADIANS(p.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(p.latitude)))))'
    : 'NULL';
  const selectParams = hasNearby ? [filters.latitude, filters.longitude, filters.latitude] : [];
  if (hasNearby) {
    conditions.push(`${distance} <= ?`);
    params.push(filters.latitude, filters.longitude, filters.latitude, filters.radiusKm || 10);
  }

  const [rows] = await query(
        `SELECT p.id, p.user_id, p.department, p.category, p.title, p.body, p.location_name,
          ROUND(p.latitude, 2) AS latitude, ROUND(p.longitude, 2) AS longitude,
          p.is_official, p.is_flagged, p.severity, p.reports_count,
            p.views_count, p.expires_at, p.created_at,
            u.role AS author_role, pr.anonymous_id AS author_anonymous_id,
            ${distance} AS distance_km,
            (SELECT COUNT(*) FROM notice_reactions r WHERE r.post_id = p.id) AS reaction_count,
            (SELECT COUNT(*) FROM notice_saves s WHERE s.post_id = p.id) AS save_count,
            EXISTS(SELECT 1 FROM notice_reactions mine WHERE mine.post_id = p.id AND mine.user_id = ? AND mine.reaction = 'like') AS liked_by_me,
            EXISTS(SELECT 1 FROM notice_saves mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS saved_by_me
     FROM notice_posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN profiles pr ON pr.user_id = p.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${hasNearby ? 'distance_km ASC,' : ''} p.trending_score DESC, p.created_at DESC
     LIMIT 100`,
    [...selectParams, user.user_id, user.user_id, ...params]
  );

  if (rows.length) {
    const postIds = rows.map(row => row.id);
    const placeholders = postIds.map(() => '?').join(', ');
    await query(`UPDATE notice_posts SET views_count = views_count + 1 WHERE id IN (${placeholders})`, postIds);
  }
  return rows;
}

async function getMyPosts(userId) {
  const [rows] = await query(
    `SELECT id, category, title, body, status, is_official, is_flagged, severity,
            appeal_available, reports_count, expires_at, created_at
     FROM notice_posts WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function reportPost(postId, reporterId, reason) {
  const [posts] = await query("SELECT user_id FROM notice_posts WHERE id = ? AND status = 'published'", [postId]);
  if (!posts.length) throw AppError.notFound('Published post not found.');
  if (posts[0].user_id === reporterId) throw AppError.badRequest('You cannot report your own post.');
  const [result] = await query(
    'INSERT IGNORE INTO notice_post_reports (post_id, reporter_id, reason) VALUES (?, ?, ?)',
    [postId, reporterId, reason]
  );
  if (!result.affectedRows) throw AppError.conflict('You have already reported this post.');
  const [countRows] = await query('SELECT COUNT(*) AS report_count FROM notice_post_reports WHERE post_id = ?', [postId]);
  const reportCount = Number(countRows[0].report_count);
  await query('UPDATE notice_posts SET reports_count = ? WHERE id = ?', [reportCount, postId]);
  if (reportCount >= 3) {
    const [postRows] = await query("UPDATE notice_posts SET status = 'held' WHERE id = ? AND status = 'published'", [postId]);
    if (postRows.affectedRows) {
      const [[post]] = await query('SELECT user_id, title, body, severity FROM notice_posts WHERE id = ?', [postId]);
      await addModerationItem(postId, post.user_id, `${post.title}\n${post.body}`, post.severity || 'medium', 'Automatically held after three reports');
    }
  }
  return { reportCount, held: reportCount >= 3 };
}

async function setReaction(postId, userId, reaction) {
  if (!['like', 'interested'].includes(reaction)) throw AppError.badRequest('Unsupported reaction.');
  const [post] = await query("SELECT id FROM notice_posts WHERE id = ? AND status = 'published'", [postId]);
  if (!post.length) throw AppError.notFound('Published post not found.');
  await query(
    `INSERT INTO notice_reactions (post_id, user_id, reaction)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)`,
    [postId, userId, reaction]
  );
}

async function savePost(postId, userId, save) {
  const [post] = await query("SELECT id FROM notice_posts WHERE id = ? AND status = 'published'", [postId]);
  if (!post.length) throw AppError.notFound('Published post not found.');
  if (save) {
    await query('INSERT IGNORE INTO notice_saves (post_id, user_id) VALUES (?, ?)', [postId, userId]);
    return;
  }
  await query('DELETE FROM notice_saves WHERE post_id = ? AND user_id = ?', [postId, userId]);
}

async function extendPost(postId, userId) {
  const [result] = await query(
    `UPDATE notice_posts
     SET expires_at = DATE_ADD(GREATEST(expires_at, NOW()), INTERVAL 30 DAY),
         extension_count = extension_count + 1, expiry_notified_at = NULL
    WHERE id = ? AND user_id = ? AND status = 'published' AND extension_count < 1`,
    [postId, userId]
  );
  if (!result.affectedRows) throw AppError.badRequest('Post cannot be extended.');
}

async function appealPost(postId, userId, reason) {
  const [post] = await query("SELECT id FROM notice_posts WHERE id = ? AND user_id = ? AND status = 'rejected' AND appeal_available = 1", [postId, userId]);
  if (!post.length) throw AppError.notFound('Appeal is not available for this post.');
  await query('INSERT INTO notice_appeals (post_id, user_id, reason) VALUES (?, ?, ?)', [postId, userId, reason]);
  await query("UPDATE notice_posts SET status = 'held' WHERE id = ?", [postId]);
  const [[item]] = await query('SELECT user_id, title, body, severity FROM notice_posts WHERE id = ?', [postId]);
  const [pendingItems] = await query(
    "SELECT id FROM moderation_queue WHERE content_type = 'notice_post' AND content_id = ? AND status = 'pending' LIMIT 1",
    [postId]
  );
  if (pendingItems.length) {
    await query('UPDATE moderation_queue SET ai_reason = ? WHERE id = ?', [`Appeal: ${reason}`, pendingItems[0].id]);
  } else {
    await addModerationItem(postId, item.user_id, `${item.title}\n${item.body}`, item.severity || 'high', `Appeal: ${reason}`);
  }
}

async function getFacultyQueue() {
  const [rows] = await query(
    `SELECT p.id, p.user_id, p.category, p.title, p.body, p.status, p.severity,
            p.is_official, p.reports_count, p.created_at, q.ai_reason,
            a.reason AS appeal_reason, pr.anonymous_id AS author_anonymous_id
     FROM notice_posts p
     LEFT JOIN moderation_queue q ON q.content_type = 'notice_post' AND q.content_id = p.id AND q.status = 'pending'
     LEFT JOIN notice_appeals a ON a.post_id = p.id AND a.status = 'pending'
     LEFT JOIN profiles pr ON pr.user_id = p.user_id
    WHERE p.status = 'held' OR a.id IS NOT NULL
     ORDER BY p.is_flagged DESC, p.created_at ASC`
  );
  return rows;
}

async function reviewPost(postId, facultyId, decision, note) {
  if (!['publish', 'reject'].includes(decision)) throw AppError.badRequest('Decision must be publish or reject.');
  const [[post]] = await query('SELECT * FROM notice_posts WHERE id = ? AND status IN (\'held\', \'rejected\')', [postId]);
  if (!post) throw AppError.notFound('Post is not awaiting review.');
  const status = decision === 'publish' ? 'published' : 'rejected';
  await query(
    'UPDATE notice_posts SET status = ?, appeal_available = 0, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
    [status, note || null, facultyId, postId]
  );
  await query(
    `UPDATE moderation_queue SET status = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE content_type = 'notice_post' AND content_id = ? AND status = 'pending'`,
    [decision === 'publish' ? 'approved' : 'rejected', facultyId, postId]
  );
  await query("UPDATE notice_appeals SET status = 'reviewed' WHERE post_id = ? AND status = 'pending'", [postId]);
  if (status === 'published' && post.is_official) {
    const [[profile]] = await query('SELECT department FROM profiles WHERE user_id = ?', [post.user_id]);
    await notifyDepartment(profile?.department, post);
  }
}

async function expireAndRemind() {
  await query("UPDATE notice_posts SET status = 'expired' WHERE status = 'published' AND expires_at <= NOW()");
  const [due] = await query(
    `SELECT p.id, p.user_id, p.title, pr.anonymous_id
     FROM notice_posts p JOIN profiles pr ON pr.user_id = p.user_id
     WHERE status = 'published' AND expiry_notified_at IS NULL
       AND p.expires_at > NOW() AND p.expires_at <= DATE_ADD(NOW(), INTERVAL 1 DAY)`
  );
  for (const post of due) {
    await query('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [post.user_id, 'NOTICE_EXPIRING', `Your post "${post.title}" expires within 24 hours. You can extend it once.`]);
    const io = getIO();
    if (io) io.to(post.anonymous_id).emit('notice:expiring', { post_id: post.id, title: post.title });
    await query('UPDATE notice_posts SET expiry_notified_at = NOW() WHERE id = ?', [post.id]);
  }
}

async function recalculateTrending() {
  await query(
    `UPDATE notice_posts p
     SET p.trending_score =
       (p.views_count * 0.1) +
       ((SELECT COUNT(*) FROM notice_reactions r WHERE r.post_id = p.id) * 2) +
       ((SELECT COUNT(*) FROM notice_saves s WHERE s.post_id = p.id) * 1.5)
     WHERE p.status = 'published'`
  );
}

module.exports = {
  NOTICE_CATEGORIES,
  createPost,
  listPosts,
  getMyPosts,
  reportPost,
  setReaction,
  savePost,
  extendPost,
  appealPost,
  getFacultyQueue,
  reviewPost,
  expireAndRemind,
  recalculateTrending,
};