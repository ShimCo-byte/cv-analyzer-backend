/**
 * Authentication Service with Supabase
 * Handles user authentication using Supabase Auth
 * Falls back to in-memory storage if Supabase is not configured
 */

import { supabase, isSupabaseEnabled } from '../config/supabase.js';

// In-memory fallback storage
class InMemoryUserStore {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
  }

  createUser(email, password, profile) {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }
    const user = {
      id: `user_${Date.now()}`,
      email,
      password,
      profile,
      created_at: new Date().toISOString()
    };
    this.users.set(email, user);
    return user;
  }

  verifyPassword(email, password) {
    const user = this.users.get(email);
    return user && user.password === password;
  }

  getUser(email) {
    return this.users.get(email);
  }

  createSession(userId) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.sessions.set(sessionId, userId);
    return sessionId;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  updateProfile(email, profile) {
    const user = this.users.get(email);
    if (user) {
      user.profile = profile;
      user.updated_at = new Date().toISOString();
    }
    return user;
  }
}

const memoryStore = new InMemoryUserStore();

/**
 * Sign up new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} profile - User profile data (optional)
 * @returns {Promise<Object>} - User data and session
 */
export async function signUp(email, password, profile = {}) {
  try {
    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Validate password
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Use Supabase if configured, otherwise use in-memory store
    if (isSupabaseEnabled()) {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            profile: profile
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user && profile) {
        await storeUserProfile(data.user.id, email, profile);
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          profile: profile,
          createdAt: data.user.created_at
        },
        session: data.session,
        sessionId: data.session?.access_token,
        message: 'User created successfully. Please check your email to verify your account.'
      };
    } else {
      // Fallback to in-memory storage
      const user = memoryStore.createUser(email, password, profile);
      const sessionId = memoryStore.createSession(user.id);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          profile: profile,
          createdAt: user.created_at
        },
        sessionId,
        message: 'User created successfully (using in-memory storage)'
      };
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Sign in existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User data and session
 */
export async function signIn(email, password) {
  try {
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    // Get user profile
    const profile = await getUserProfile(data.user.id);

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: profile || data.user.user_metadata?.profile,
        createdAt: data.user.created_at
      },
      session: data.session,
      sessionId: data.session.access_token,
      message: 'Signed in successfully'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Sign out user
 * @param {string} sessionId - Session token (access_token)
 * @returns {Promise<Object>} - Success message
 */
export async function signOut(sessionId) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      message: 'Signed out successfully'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get current user from session token
 * @param {string} sessionId - Session token (access_token)
 * @returns {Promise<Object|null>} - User data or null
 */
export async function getCurrentUser(sessionId) {
  try {
    // Get user from session token
    const { data: { user }, error } = await supabase.auth.getUser(sessionId);

    if (error || !user) {
      return null;
    }

    // Get user profile
    const profile = await getUserProfile(user.id);

    return {
      id: user.id,
      email: user.email,
      profile: profile || user.user_metadata?.profile,
      createdAt: user.created_at
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Update user profile
 * @param {string} sessionId - Session token (access_token)
 * @param {Object} profile - Updated profile data
 * @returns {Promise<Object>} - Updated user data
 */
export async function updateUserProfile(sessionId, profile) {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(sessionId);

    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // Update user metadata
    const { data, error } = await supabase.auth.updateUser({
      data: {
        profile: profile
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    // Update profile in profiles table
    await storeUserProfile(user.id, user.email, profile);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        profile: profile,
        updatedAt: new Date().toISOString()
      },
      message: 'Profile updated successfully'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Store user profile in profiles table
 * This is optional - stores additional profile data beyond user metadata
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {Object} profile - Profile data
 */
async function storeUserProfile(userId, email, profile) {
  try {
    // Check if profiles table exists and upsert profile
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        profile_data: profile,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error && !error.message.includes('relation "public.profiles" does not exist')) {
      console.error('Error storing profile:', error);
    }
  } catch (error) {
    // Silently fail if profiles table doesn't exist
    // User metadata will still work
    console.log('Note: profiles table not created yet. Using user metadata only.');
  }
}

/**
 * Get user profile from profiles table
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Profile data or null
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_data')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }

    return data?.profile_data;
  } catch (error) {
    return null;
  }
}

/**
 * Verify session token
 * @param {string} sessionId - Session token (access_token)
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
export async function verifySession(sessionId) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(sessionId);
    return !error && !!user;
  } catch (error) {
    return false;
  }
}
