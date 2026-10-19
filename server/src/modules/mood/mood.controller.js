const moodService = require('./mood.service');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

exports.submitCheckIn = asyncHandler(async (req, res) => {
  const { mood_score, note } = req.body;
  const userId = req.user.user_id;

  const score = Number(mood_score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw AppError.badRequest('mood_score must be an integer from 1 to 5');
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw AppError.badRequest('note must be text');
  }
  if (typeof note === 'string' && note.length > 500) {
    throw AppError.badRequest('note must be 500 characters or fewer');
  }

  const result = await moodService.submitCheckIn(userId, score, note);

  return res.status(201).json({
    success: true,
    message: result.alreadyCheckedIn
      ? 'You have already submitted a check-in today.'
      : 'Mood check-in submitted successfully',
    data: { id: result.id, alreadyCheckedIn: result.alreadyCheckedIn }
  });
});

exports.getHistory = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const requestedDays = Number(req.query.days);
  const days = Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= 365
    ? requestedDays
    : 30;
  const history = await moodService.getHistory(userId, days);

  return res.status(200).json({
    success: true,
    data: history
  });
});

exports.getTrendSummary = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const summary = await moodService.getTrendSummary(userId);

  return res.status(200).json({
    success: true,
    data: summary
  });
});

exports.getReminderStatus = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const status = await moodService.getReminderStatus(userId);

  return res.status(200).json({
    success: true,
    data: status
  });
});

exports.getRecommendationContext = asyncHandler(async (req, res) => {
  const context = await moodService.getRecommendationContext(req.user.user_id);
  return res.status(200).json({ success: true, data: context });
});

exports.getAggregatedTrends = asyncHandler(async (req, res) => {
  // Double-check: restrictTo middleware already enforces this, but belt-and-braces.
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw AppError.forbidden('Aggregated mood trends are restricted to Admin and Super Admin only.');
  }

  const trends = await moodService.getAggregatedTrendsByDepartment();

  return res.status(200).json({
    success: true,
    data: trends
  });
});
