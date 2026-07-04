// list-admins.js
// Prints out all admin emails (and roles) from the Supabase "admins" table.
//
// Usage:
//   node list-admins.js
//
// Requires env vars (same ones already in your .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (needed to bypass RLS and read the admins table)

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data, error } = await supabase
    .from('admins')
    .select('email, role')

  if (error) {
    console.error('Error fetching admins:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log('No admins found.')
    return
  }

  console.log('Admin accounts:')
  data.forEach((admin, i) => {
    console.log(`${i + 1}. ${admin.email} (${admin.role})`)
  })
}

main()
