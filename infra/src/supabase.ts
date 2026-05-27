import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  // Warn at module load time so the error is obvious during dev
  console.warn('[Slary] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — DB sync disabled')
}

export const supabase = url && key ? createClient(url, key) : null

export type { User, Session } from '@supabase/supabase-js'
