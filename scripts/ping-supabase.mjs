// Keeps the Supabase project active by making a real authenticated DB
// request. Supabase pauses free projects after 7 days of no API activity.
// Shared by api/ping.js (Vercel serverless function) and this file's own
// CLI entry point (run directly as a Render Cron Job command, since Render
// has no per-request functions runtime — a scheduled script avoids needing
// an always-on web service just to keep Supabase awake).
export async function pingSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  })

  return {
    ok: true,
    supabase_status: response.status,
    pinged_at: new Date().toISOString(),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await pingSupabase()
    console.log(JSON.stringify(result))
    process.exit(result.supabase_status < 400 ? 0 : 1)
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }))
    process.exit(1)
  }
}
