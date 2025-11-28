/**
 * Supabase Configuration
 * Initialize Supabase client for authentication
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env before accessing process.env
dotenv.config();

// Supabase configuration (trim to remove any accidental whitespace/newlines)
const supabaseUrl = (process.env.SUPABASE_URL || 'https://placeholder.supabase.co').trim();
const supabaseKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder').trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

// Check if Supabase is configured
const isSupabaseConfigured =
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_ANON_KEY &&
  !process.env.SUPABASE_URL.includes('placeholder');

// Create Supabase client only if configured
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

// Create Supabase Admin client (for auto-confirming users)
export const supabaseAdmin = isSupabaseConfigured && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Check if Supabase is enabled
export const isSupabaseEnabled = () => {
  return supabase !== null;
};

// Test connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log('⚠️  Supabase connection test failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}
