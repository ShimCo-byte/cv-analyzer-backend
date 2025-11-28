/**
 * Authentication Routes
 */

import express from 'express';
import {
  signUpHandler,
  signInHandler,
  signOutHandler,
  getCurrentUserHandler,
  updateProfileHandler
} from '../controllers/authController.js';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Create new user account
 */
router.post('/signup', signUpHandler);

/**
 * POST /api/auth/signin
 * Sign in existing user
 */
router.post('/signin', signInHandler);

/**
 * POST /api/auth/signout
 * Sign out current user
 */
router.post('/signout', signOutHandler);

/**
 * GET /api/auth/me
 * Get current user info (requires X-Session-ID header)
 */
router.get('/me', getCurrentUserHandler);

/**
 * PUT /api/auth/profile
 * Update user profile (requires X-Session-ID header)
 */
router.put('/profile', updateProfileHandler);

export default router;
