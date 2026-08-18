// ============================================================
// lib/supabase-admin.ts — Supabase admin client (SERVER ONLY)
// ============================================================
// Uses the service-role key which bypasses all Row Level Security.
//
// SECURITY RULES:
//   ✗ NEVER import this file in client components
//   ✗ NEVER prefix SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_
//   ✓ Only import in Route Handlers and lib/auth/db.ts
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
}
if (!serviceRoleKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Get it from: Supabase Dashboard → Settings → API → service_role'
  )
}

/**
 * Supabase admin client with service-role key.
 * Bypasses RLS — use only in trusted server-side code.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
