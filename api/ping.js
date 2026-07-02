// Vercel serverless function — called daily by Vercel Cron to keep Supabase active.
// Supabase pauses free projects after 7 days of no API activity.
// This makes a real authenticated DB request every day so that never happens.
export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Missing Supabase credentials' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })

    return res.status(200).json({
      ok: true,
      supabase_status: response.status,
      pinged_at: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
