/**
 * PeerBridge — Profile Routes
 * ============================
 * All routes require authentication (protect middleware).
 *
 * Endpoints:
 *   GET    /api/profile/me       → Fetch authenticated user's profile
 *   PUT    /api/profile/update   → Update profile fields
 *   PATCH  /api/profile/consent  → Toggle mood tracking consent
 *   DELETE /api/profile/delete   → Schedule GDPR account deletion
 */

const { Router } = require('express');
const { getProfile, getPublicProfile, updateProfile, updateConsent, deleteAccount, completeOnboarding, cancelDeletion } = require('./profile.controller');
const { protect } = require('../../middleware/auth.middleware');

const router = Router();

// All profile routes require authentication
router.use(protect);

router.get('/me', getProfile);
router.get('/:anonymous_id', getPublicProfile);
router.put('/update', updateProfile);
router.post('/complete-onboarding', completeOnboarding);
router.patch('/consent', updateConsent);
router.delete('/delete', deleteAccount);
router.put('/cancel-deletion', cancelDeletion);

module.exports = router;
