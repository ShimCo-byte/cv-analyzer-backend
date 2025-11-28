/**
 * Authentication Service with Supabase
 * Handles user authentication using Supabase Auth
 * Falls back to in-memory storage if Supabase is not configured
 *
 * To use Supabase:
 * 1. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env
 * 2. Run supabase-setup.sql in your Supabase project
 * 3. Server will automatically use Supabase when configured
 */

import { supabase, supabaseAdmin, isSupabaseEnabled } from '../config/supabase.js';

// In-memory fallback storage for when Supabase is not configured
class InMemoryUserStore {
  constructor() {
    this.users = new Map(); // email -> user
    this.sessions = new Map(); // sessionId -> userId
    this.usersById = new Map(); // userId -> user
  }

  createUser(email, password, profile) {
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      email,
      password, // In production, hash this!
      profile,
      created_at: new Date().toISOString()
    };
    this.users.set(email, user);
    this.usersById.set(user.id, user);
    return user;
  }

  verifyPassword(email, password) {
    const user = this.users.get(email);
    return user && user.password === password;
  }

  getUser(email) {
    return this.users.get(email);
  }

  getUserById(userId) {
    return this.usersById.get(userId);
  }

  createSession(userId) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.sessions.set(sessionId, userId);
    return sessionId;
  }

  getSession(sessionId) {
    const userId = this.sessions.get(sessionId);
    return userId ? this.usersById.get(userId) : null;
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  updateProfile(userId, profile) {
    const user = this.usersById.get(userId);
    if (user) {
      user.profile = profile;
      user.updated_at = new Date().toISOString();
      this.users.set(user.email, user);
    }
    return user;
  }
}

const memoryStore = new InMemoryUserStore();

/**
 * Sign up new user
 */
export async function signUp(email, password, profile = {}) {
  try {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (isSupabaseEnabled()) {
      // Use admin client to create user with confirmed email (no verification needed)
      if (supabaseAdmin) {
        const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { profile }
        });

        if (adminError) throw new Error(adminError.message);

        // Now sign in the user to get a session
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw new Error(signInError.message);

        if (adminData.user && profile) {
          await storeUserProfile(adminData.user.id, email, profile);
        }

        return {
          success: true,
          user: {
            id: adminData.user.id,
            email: adminData.user.email,
            profile,
            createdAt: adminData.user.created_at
          },
          session: signInData.session,
          sessionId: signInData.session?.access_token,
          message: 'User created successfully.'
        };
      }

      // Fallback to regular signup if no admin client
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { profile } }
      });

      if (error) throw new Error(error.message);

      if (data.user && profile) {
        await storeUserProfile(data.user.id, email, profile);
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          profile,
          createdAt: data.user.created_at
        },
        session: data.session,
        sessionId: data.session?.access_token,
        message: 'User created successfully. Please check your email to verify your account.'
      };
    } else {
      const user = memoryStore.createUser(email, password, profile);
      const sessionId = memoryStore.createSession(user.id);

      console.log('⚠️  Using in-memory storage (Supabase not configured)');

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          profile,
          createdAt: user.created_at
        },
        sessionId,
        message: 'User created successfully'
      };
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Sign in existing user
 */
export async function signIn(email, password) {
  try {
    if (isSupabaseEnabled()) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw new Error(error.message);

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
    } else {
      if (!memoryStore.verifyPassword(email, password)) {
        throw new Error('Invalid email or password');
      }

      const user = memoryStore.getUser(email);
      const sessionId = memoryStore.createSession(user.id);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          profile: user.profile,
          createdAt: user.created_at
        },
        sessionId,
        message: 'Signed in successfully'
      };
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Sign out user
 */
export async function signOut(sessionId) {
  try {
    if (isSupabaseEnabled()) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    } else {
      memoryStore.deleteSession(sessionId);
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
 */
export async function getCurrentUser(sessionId) {
  try {
    if (isSupabaseEnabled()) {
      const { data: { user }, error } = await supabase.auth.getUser(sessionId);

      if (error || !user) return null;

      const profile = await getUserProfile(user.id);

      return {
        id: user.id,
        email: user.email,
        profile: profile || user.user_metadata?.profile,
        createdAt: user.created_at
      };
    } else {
      const user = memoryStore.getSession(sessionId);

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        profile: user.profile,
        createdAt: user.created_at
      };
    }
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(sessionId, profile) {
  try {
    if (isSupabaseEnabled()) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(sessionId);

      if (userError || !user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.auth.updateUser({
        data: { profile }
      });

      if (error) throw new Error(error.message);

      await storeUserProfile(user.id, user.email, profile);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          profile,
          updatedAt: new Date().toISOString()
        },
        message: 'Profile updated successfully'
      };
    } else {
      const user = memoryStore.getSession(sessionId);

      if (!user) {
        throw new Error('Not authenticated');
      }

      const updatedUser = memoryStore.updateProfile(user.id, profile);

      return {
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          profile: updatedUser.profile,
          updatedAt: updatedUser.updated_at
        },
        message: 'Profile updated successfully'
      };
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Store user profile in Supabase profiles table
 */
async function storeUserProfile(userId, email, profile) {
  if (!isSupabaseEnabled()) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
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
  }
}

/**
 * Get user profile from Supabase profiles table
 */
async function getUserProfile(userId) {
  if (!isSupabaseEnabled()) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_data')
      .eq('id', userId)
      .single();

    if (error) return null;

    return data?.profile_data;
  } catch (error) {
    return null;
  }
}

/**
 * Verify session token
 */
export async function verifySession(sessionId) {
  try {
    if (isSupabaseEnabled()) {
      const { data: { user }, error } = await supabase.auth.getUser(sessionId);
      return !error && !!user;
    } else {
      const user = memoryStore.getSession(sessionId);
      return !!user;
    }
  } catch (error) {
    return false;
  }
}

// Log authentication mode on startup
if (isSupabaseEnabled()) {
  console.log('🔐 Using Supabase Authentication');
} else {
  console.log('⚠️  Using in-memory authentication (Supabase not configured)');
  console.log('   To use Supabase: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}
