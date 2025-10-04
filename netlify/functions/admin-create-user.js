
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export async function handler(event, context){
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const auth = event.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Missing Bearer token' }) }

    // Identify caller
    const { data: { user: caller }, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !caller) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) }

    // Check admin via profiles (service key bypasses RLS)
    const { data: prof, error: profErr } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', caller.id).maybeSingle()
    if (profErr) return { statusCode: 500, body: JSON.stringify({ error: profErr.message }) }
    if (!prof || !prof.is_admin) return { statusCode: 403, body: JSON.stringify({ error: 'Not an admin' }) }

    const body = JSON.parse(event.body || '{}')
    const { email, password, name, is_admin=false } = body
    if (!email || !password) return { statusCode: 400, body: JSON.stringify({ error: 'email and password required' }) }

    // Create auth user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name }
    })
    if (cErr) return { statusCode: 400, body: JSON.stringify({ error: cErr.message }) }

    const newId = created.user.id

    // Create profile
    const { error: iErr } = await supabaseAdmin.from('profiles').insert({ id: newId, email, name, is_admin })
    if (iErr) return { statusCode: 400, body: JSON.stringify({ error: iErr.message }) }

    return { statusCode: 200, body: JSON.stringify({ ok: true, user_id: newId }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
