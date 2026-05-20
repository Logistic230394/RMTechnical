/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Expose variables with fallbacks
const rawUrl = 
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : '') || 
  (import.meta as any).env?.VITE_SUPABASE_URL || 
  '';

const rawKey = 
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : '') || 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  '';

const sanitize = (val: string) => {
  if (!val) return '';
  const sanitized = val.trim().replace(/['"]/g, '');
  if (
    sanitized.includes('your-supabase-project') || 
    sanitized.includes('your-supabase-anon-key') ||
    sanitized === 'your-supabase-project.supabase.co'
  ) {
    return '';
  }
  return sanitized;
};

export const SUPABASE_URL = sanitize(rawUrl);
export const SUPABASE_ANON_KEY = sanitize(rawKey);

export function getSupabaseClient() {
  // Let user supply configuration in UI if env vars are missing
  const url = (SUPABASE_URL || localStorage.getItem('eis_direct_supabase_url') || '').trim();
  const key = (SUPABASE_ANON_KEY || localStorage.getItem('eis_direct_supabase_anon_key') || '').trim();
  
  if (!url || !key) {
    return null;
  }

  // Validate the URL format to safeguard createClient
  if (!/^https?:\/\//i.test(url)) {
    console.warn('Invalid Supabase URL omitted:', url);
    return null;
  }
  
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  } catch (error) {
    console.error('Supabase initialization error:', error);
    return null;
  }
}
