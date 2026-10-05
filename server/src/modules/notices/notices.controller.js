const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const noticesService = require('./notices.service');

function postId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw AppError.badRequest('Invalid post ID.');
  return id;
}

const createPost = asyncHandler(async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const category = req.body.category;
  const locationName = typeof req.body.location_name === 'string' ? req.body.location_name.trim() : '';
  if (title.length < 3 || title.length > 120) throw AppError.badRequest('Title must be 3 to 120 characters.');
  if (body.length < 10 || body.length > 2000) throw AppError.badRequest('Post text must be 10 to 2000 characters.');
  if (locationName.length > 100) throw AppError.badRequest('Location must be 100 characters or fewer.');

  const hasLatitude = req.body.latitude !== undefined && req.body.latitude !== '';
  const hasLongitude = req.body.longitude !== undefined && req.body.longitude !== '';
  if (hasLatitude !== hasLongitude) throw AppError.badRequest('Both latitude and longitude are required for nearby posts.');
  const latitude = hasLatitude ? Number(req.body.latitude) : null;
  const longitude = hasLongitude ? Number(req.body.longitude) : null;
  if (hasLatitude && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw AppError.badRequest('Location coordinates are invalid.');
  }

  const expiryDays = req.body.expiry_days === undefined ? 30 : Number(req.body.expiry_days);
  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 90) {
    throw AppError.badRequest('Expiry must be between 1 and 90 days.');
  }
  const result = await noticesService.createPost(req.user, {
    title, body, category, locationName, latitude, longitude, expiryDays,
  });
  return res.status(201).json({ success: true, data: result });
});

const listPosts = asyncHandler(async (req, res) => {
  const filters = {
    category: typeof req.query.category === 'string' ? req.query.category : '',
    search: typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '',
    latitude: req.query.latitude === undefined ? null : Number(req.query.latitude),
    longitude: req.query.longitude === undefined ? null : Number(req.query.longitude),
    radiusKm: req.query.radius_km === undefined ? 10 : Number(req.query.radius_km),
  };
  if ((filters.latitude !== null || filters.longitude !== null) &&
      (!Number.isFinite(filters.latitude) || !Number.isFinite(filters.longitude) ||
       filters.latitude < -90 || filters.latitude > 90 || filters.longitude < -180 || filters.longitude > 180 ||
       !Number.isFinite(filters.radiusKm) || filters.radiusKm < 1 || filters.radiusKm > 100)) {
    throw AppError.badRequest('Nearby search coordinates or radius are invalid.');
  }
  const data = await noticesService.listPosts(req.user, filters);
  return res.status(200).json({ success: true, data });
});

const getMyPosts = asyncHandler(async (req, res) => {
  const data = await noticesService.getMyPosts(req.user.user_id);
  return res.status(200).json({ success: true, data });
});

const reportPost = asyncHandler(async (req, res) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 500) throw AppError.badRequest('Report reason must be 5 to 500 characters.');
  const data = await noticesService.reportPost(postId(req.params.id), req.user.user_id, reason);
  return res.status(201).json({ success: true, data });
});

const setReaction = asyncHandler(async (req, res) => {
  await noticesService.setReaction(postId(req.params.id), req.user.user_id, req.body.reaction);
  return res.status(200).json({ success: true });
});

const savePost = asyncHandler(async (req, res) => {
  await noticesService.savePost(postId(req.params.id), req.user.user_id, req.body.saved !== false);
  return res.status(200).json({ success: true });
});

const extendPost = asyncHandler(async (req, res) => {
  await noticesService.extendPost(postId(req.params.id), req.user.user_id);
  return res.status(200).json({ success: true, message: 'Post expiry extended.' });
});

const appealPost = asyncHandler(async (req, res) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 1000) throw AppError.badRequest('Appeal reason must be 10 to 1000 characters.');
  await noticesService.appealPost(postId(req.params.id), req.user.user_id, reason);
  return res.status(201).json({ success: true, message: 'Appeal submitted for review.' });
});

const getFacultyQueue = asyncHandler(async (_req, res) => {
  const data = await noticesService.getFacultyQueue();
  return res.status(200).json({ success: true, data });
});

const reviewPost = asyncHandler(async (req, res) => {
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (note.length > 1000) throw AppError.badRequest('Review note must be 1000 characters or fewer.');
  await noticesService.reviewPost(postId(req.params.id), req.user.user_id, req.body.decision, note);
  const pastTense = req.body.decision === 'publish' ? 'published' : 'rejected';
  return res.status(200).json({ success: true, message: `Post ${pastTense}.` });
});

module.exports = {
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
};