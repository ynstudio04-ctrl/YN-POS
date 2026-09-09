
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/*
 * Supabase expects the PROJECT URL:
 *
 * https://xxxxx.supabase.co
 *
 * Not:
 * https://xxxxx.supabase.co/rest/v1/
 *
 * This normalization also protects the app if Render has
 * the old /rest/v1/ value saved in its environment variables.
 */
const url = rawUrl
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/i, '');

export const supabaseConfigured = Boolean(url && key);

export const supabase =
  supabaseConfigured
    ? createClient(url!, key!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

