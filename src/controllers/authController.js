/**
 * Authentication Controller
 */

import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  updateUserProfile
} from '../services/authService.js';

/**
 * POST /api/auth/signup
 * Create new user account
 */
export async function signUpHandler(req, res) {
  try {
    const { email, password, profile } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await signUp(email, password, profile);

    res.json({
      success: true,
      data: {
        user: result.user,
        sessionId: result.sessionId
      },
      message: result.message
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Signup failed'
    });
  }
}

/**
 * POST /api/auth/signin
 * Sign in existing user
 */
export async function signInHandler(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await signIn(email, password);

    res.json({
      success: true,
      data: {
        user: result.user,
        sessionId: result.sessionId
      },
      message: result.message
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid credentials'
    });
  }
}

/**
 * POST /api/auth/signout
 * Sign out current user
 */
export async function signOutHandler(req, res) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const result = signOut(sessionId);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({
      success: false,
      error: 'Signout failed'
    });
  }
}

/**
 * GET /api/auth/me
 * Get current user info
 */
export async function getCurrentUserHandler(req, res) {
  try {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const user = getCurrentUser(sessionId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info'
    });
  }
}

/**
 * PUT /api/auth/profile
 * Update user profile
 */
export async function updateProfileHandler(req, res) {
  try {
    const sessionId = req.headers['x-session-id'];
    const { profile } = req.body;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (!profile) {
      return res.status(400).json({
        success: false,
        error: 'Profile data is required'
      });
    }

    const result = updateUserProfile(sessionId, profile);

    res.json({
      success: true,
      data: result.user,
      message: result.message
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile'
    });
  }
}
