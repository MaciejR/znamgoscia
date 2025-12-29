import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// Klient dla frontendu (przeglądarka)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Klient z Secret Key (tylko dla server-side/API routes)
export function getServiceSupabase() {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not set')
  }
  return createClient(supabaseUrl, secretKey)
}

// Alias dla kompatybilności wstecznej
export const supabaseAdmin = getServiceSupabase
