const academicService = require('./academic.service');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { query } = require('../../config/db.config');

/**
 * Academic Route Handlers
 */

const createRequest = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { subject, urgency, title, description } = req.body;
  if (!subject || !title || !description || !['low', 'medium', 'high', 'critical'].includes(urgency)) {
    throw new AppError('Subject, title, description, and a valid urgency are required', 400);
  }
  const result = await academicService.createHelpRequest(userId, req.body);
  
  res.status(201).json({
    success: true,
    data: result
  });
});

const getRequests = asyncHandler(async (req, res) => {
  const { subject } = req.query;
  const requests = await academicService.getOpenRequests(subject);
  
  res.status(200).json({
    success: true,
    data: requests
  });
});

const getMyRequests = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const [rows] = await query('SELECT * FROM academic_requests WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  
  res.status(200).json({
    success: true,
    data: rows
  });
});

const getRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [rows] = await query('SELECT * FROM academic_requests WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Request not found', 404);
  
  res.status(200).json({
    success: true,
    data: rows[0]
  });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, rating } = req.body;
  
  if (status === 'resolved') {
    await academicService.resolveRequest(id, rating, req.user.user_id);
  } else {
    await academicService.updateRequestStatus(id, req.user.user_id, status);
  }
  
  res.status(200).json({
    success: true,
    message: `Status updated to ${status}`
  });
});

const closeRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await academicService.closeRequest(id, req.user.user_id);
  
  res.status(200).json({
    success: true,
    message: 'Request closed'
  });
});

const registerHelper = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { subjects } = req.body;
  if (!Array.isArray(subjects) || subjects.length === 0 || subjects.length > 10) {
    throw new AppError('Subjects must be a non-empty array of at most 10 items', 400);
  }
  await academicService.registerAsHelper(userId, subjects);
  
  res.status(200).json({
    success: true,
    message: 'Registered as helper'
  });
});

const getHelpers = asyncHandler(async (req, res) => {
  const { subject } = req.query;
  const userId = req.user.user_id;
  const helpers = req.query.my === 'true'
    ? await academicService.getHelperListing(userId)
    : await academicService.getAvailableHelpers(subject, userId);
  
  res.status(200).json({
    success: true,
    data: helpers
  });
});

const updateAvailability = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { availability } = req.body;
  if (!['available', 'busy', 'offline'].includes(availability)) {
    throw new AppError('Invalid availability', 400);
  }
  await query('UPDATE helper_listings SET availability = ? WHERE user_id = ?', [availability, userId]);
  
  res.status(200).json({
    success: true,
    message: 'Availability updated'
  });
});

const submitAppeal = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason || reason.trim().length < 5) throw new AppError('Appeal reason is required', 400);
  await academicService.submitAppeal(id, userId, reason);
  
  res.status(200).json({
    success: true,
    message: 'Appeal submitted'
  });
});

const getTrends = asyncHandler(async (req, res) => {
  if (req.user.role !== 'faculty') throw new AppError('Only faculty can view trends', 403);
  
  // Get department from profile
  const [profile] = await query('SELECT department FROM profiles WHERE user_id = ?', [req.user.user_id]);
  if (!profile[0]?.department) throw new AppError('Department not found in profile', 400);
  
  const trends = await academicService.getFacultyTrends(profile[0].department);
  
  res.status(200).json({
    success: true,
    data: trends
  });
});

const getAdminQueue = asyncHandler(async (req, res) => {
  const [rows] = await query("SELECT * FROM academic_requests WHERE ai_moderation_status = 'hold'");
  res.status(200).json({ success: true, data: rows });
});

const adminApprove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query("UPDATE academic_requests SET ai_moderation_status = 'clean' WHERE id = ?", [id]);
  res.status(200).json({ success: true, message: 'Request approved' });
});

const adminReject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query("UPDATE academic_requests SET ai_moderation_status = 'rejected' WHERE id = ?", [id]);
  res.status(200).json({ success: true, message: 'Request rejected' });
});

module.exports = {
  createRequest,
  getRequests,
  getMyRequests,
  getRequestById,
  updateStatus,
  closeRequest,
  registerHelper,
  getHelpers,
  updateAvailability,
  submitAppeal,
  getTrends,
  getAdminQueue,
  adminApprove,
  adminReject
};
