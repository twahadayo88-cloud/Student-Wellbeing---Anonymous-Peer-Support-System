/* Scratch: end-to-end verification of Module 3 (Resource & Study Library).
 * Covers: schema, upload flow (validation + abuse scan), faculty queue,
 * approve/reject, search/filter, rating/review, low-rating auto-flag,
 * bookmarks, download permission. Disposable users/resources cleaned up.
 */
const { query, pool } = require('../src/config/db.config');
const resourcesService = require('../src/modules/resources/resources.service');

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : fail++;
};

async function makeUser(role, dept) {
  const email = `restest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`;
  const [ins] = await query(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
    [email, 'x', role]
  );
  const userId = ins.insertId;
  await query('INSERT INTO profiles (user_id, anonymous_id, department) VALUES (?, ?, ?)',
    [userId, `RT${Date.now()}${Math.floor(Math.random() * 1000)}`, dept || 'CS']);
  return userId;
}

async function cleanup(userId) {
  await query('DELETE FROM resource_bookmarks WHERE user_id = ?', [userId]);
  await query('DELETE FROM resource_reviews WHERE user_id = ?', [userId]);
  await query('DELETE FROM resources WHERE uploader_id = ?', [userId]);
  await query('DELETE FROM profiles WHERE user_id = ?', [userId]);
  await query('DELETE FROM users WHERE id = ?', [userId]);
}

async function main() {
  const student = await makeUser('student');
  const faculty = await makeUser('faculty');

  // ── 1. Schema check
  const [resCols] = await query('SHOW COLUMNS FROM resources');
  const resNames = resCols.map(c => c.Field);
  ['title', 'description', 'subject', 'semester', 'category', 'external_url', 'file_path',
    'status', 'is_flagged', 'moderation_reason', 'reviewed_by', 'review_note'].forEach(col =>
      check(`resources.${col} exists`, resNames.includes(col)));

  // ── 2. Upload flow (link-only resource; abuse scan on title/description)
  const created = await resourcesService.createResource(student, {
    title: 'Discrete Math Notes', description: 'Full semester lecture notes with proofs and exercises.',
    category: 'Lecture Notes', subject: 'Discrete Mathematics', semester: '3',
  }, null);
  check('upload creates resource (pending)', created.id > 0 && created.status === 'pending', `id=${created.id}`);

  // ── 3. Abuse scan flags offensive title → goes to flagged, not pending
  const flagged = await resourcesService.createResource(student, {
    title: 'Total garbage resource', description: 'This is a shitty dump of useless notes for fuckups.',
    category: 'Other', subject: 'X', semester: '1',
  }, null);
  check('abusive upload goes to flagged status (not pending)', flagged.status === 'flagged', flagged.moderation_reason || '');

  // ── 4. Faculty queue contains both
  let queue = await resourcesService.getFacultyQueue();
  const inQueue = queue.find(r => r.id === created.id);
  check('faculty queue shows pending resource with uploader anonymous_id',
    Boolean(inQueue) && inQueue.uploader_anonymous_id !== undefined, inQueue?.uploader_anonymous_id || 'missing');

  // ── 5. Review validation: reject requires reason ≥5 chars
  let rejected = false;
  try { await resourcesService.reviewResource(created.id, faculty, 'rejected', 'bad'); } catch { rejected = true; }
  check('reject with short reason rejected', rejected);

  // ── 6. Approve
  await resourcesService.reviewResource(created.id, faculty, 'approved', 'Good quality notes');
  const [afterApprove] = await query('SELECT status, reviewed_by, reviewed_at, review_note FROM resources WHERE id = ?', [created.id]);
  check('faculty approve sets approved + reviewer + note',
    afterApprove[0].status === 'approved' && Number(afterApprove[0].reviewed_by) === Number(faculty) && Boolean(afterApprove[0].review_note));

  // ── 7. Search & filter
  const bySubject = await resourcesService.listApprovedResources({ subject: 'Discrete Mathematics' }, student);
  check('filter by subject finds approved resource', bySubject.some(r => r.id === created.id));
  const byCategory = await resourcesService.listApprovedResources({ category: 'Lecture Notes' }, student);
  check('filter by category finds approved resource', byCategory.some(r => r.id === created.id));
  const bySearch = await resourcesService.listApprovedResources({ search: 'Discrete' }, student);
  check('text search finds approved resource', bySearch.some(r => r.id === created.id));

  // ── 8. Rating & review + low-rating auto-flag (≥3 distinct reviewers, avg < 2.5)
  // NOTE: unique key (resource_id, user_id) means one reviewer = one review, so the
  // threshold must be tested with 3 different students (by design — no self-flood).
  const reviewerA = student;
  const reviewerB = await makeUser('student');
  const reviewerC = await makeUser('student');
  await resourcesService.addReview(created.id, reviewerA, 1, 'Poor notes');
  await resourcesService.addReview(created.id, reviewerB, 1, 'Very bad');
  const [res2] = await query('SELECT status FROM resources WHERE id = ?', [created.id]);
  check('two bad reviews do NOT auto-flag (below threshold count)', res2[0].status === 'approved');
  await resourcesService.addReview(created.id, reviewerC, 1, 'Terrible');
  const [res3] = await query('SELECT status, moderation_reason FROM resources WHERE id = ?', [created.id]);
  check('3 reviews avg<2.5 auto-returns resource to review queue (flagged, not deleted)',
    res3[0].status === 'flagged' && /review queue/i.test(res3[0].moderation_reason || ''), res3[0].moderation_reason || '');

  // ── 9. Faculty re-review after auto-flag
  await resourcesService.reviewResource(created.id, faculty, 'approved', 'Re-reviewed, acceptable');
  const [res4] = await query('SELECT status FROM resources WHERE id = ?', [created.id]);
  check('flagged resource can be re-approved by faculty', res4[0].status === 'approved');

  // ── 10. Bookmarks
  await resourcesService.addBookmark(created.id, student);
  const marks = await resourcesService.getBookmarks(student);
  check('bookmark added and listed', marks.some(r => r.id === created.id && r.is_bookmarked == 1));
  await resourcesService.removeBookmark(created.id, student);
  const marksAfter = await resourcesService.getBookmarks(student);
  check('bookmark removed', !marksAfter.some(r => r.id === created.id));

  // ── 11. Download permission guard (file-less resource → not-found)
  let denied = false;
  try { await resourcesService.getDownload(created.id, student, 'student'); } catch (e) { denied = /link|available/i.test(e.message); }
  check('download guard works (link-only resource rejected)', denied);

  // ── 12. Rating 1-5 validation
  let badRating = false;
  try { await resourcesService.addReview(created.id, student, 9, 'x'); } catch { badRating = true; }
  check('rating outside 1-5 rejected', badRating);

  await cleanup(student);
  await cleanup(reviewerB);
  await cleanup(reviewerC);
  await cleanup(faculty);
  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error('Verification failed:', err.message); process.exit(1); });
