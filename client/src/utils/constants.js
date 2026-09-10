/**
 * PeerBridge — Frontend Constants
 * =================================
 * Mirrors backend constants for consistency.
 */

export const ROLES = Object.freeze({
  STUDENT: 'student',
  FACULTY: 'faculty',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

export const ROUTES = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  CHAT: '/chat',
  ADMIN: '/admin',
});

export const APP_NAME = 'PeerBridge';
export const APP_DESCRIPTION = 'Anonymous Student Peer Support';
