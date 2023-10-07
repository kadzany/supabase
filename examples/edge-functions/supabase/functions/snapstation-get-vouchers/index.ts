// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Snapstation validate voucher")

const pool = new Pool(
  {
    tls: { enabled: false },
    database: 'postgres',
    hostname: 'db.zwwzsqqgqphiatfqnpjw.supabase.co',
    user: 'postgres',
    port: 5432,
    password: 'HRVMOiptSYFT5n9c',
  },
  1
)
async function getVoucher(code, connection) {
  const resVoucher = await connection.queryObject(
    `SELECT * 
      FROM public.ss_vouchers
      WHERE voucher_code = $1
      AND is_active = TRUE 
      AND NOW() BETWEEN start_date AND end_date
      LIMIT 1`,
    [
      code
    ]
  )

  if (resVoucher.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid voucher code"),
      { status: 404 },
    )
  }

  console.error('voucher_id', resVoucher.rows[0].voucher_id)

  let voucher_used = 0
  const resVoucherCheck = await connection.queryObject(
    `SELECT CAST(COUNT(*) AS INT) AS voucher_used
      FROM public.ss_transactions
      WHERE voucher_id = $1
      AND CAST(transaction_date AT TIME ZONE 'MYT' AS DATE) = CAST(NOW() AT TIME ZONE 'MYT' AS DATE)
      GROUP BY CAST(transaction_date AS DATE)`,
    [
      resVoucher.rows[0].voucher_id
    ]
  )

  if (resVoucherCheck.rows.length > 0){
    voucher_used = resVoucherCheck.rows[0].voucher_used
  }

  console.error('voucher_used', resVoucherCheck.rows[0])
  console.error('max_used', resVoucher.rows[0].max_used)

  if ( voucher_used >= resVoucher.rows[0].max_used) {
    return new Response(
      JSON.stringify("Voucher usage limit reached!"),
      { status: 404 },
    )
  }

  return new Response(
    JSON.stringify(resVoucher.rows[0]),
    { status: 200 },
  )
}

serve(async (req) => {
  const connection = await pool.connect()

  try {
    // Auth checking
    const auth = req.headers.get('Authorization')
    if (auth == null || (auth.split(':')[0] !== 'username' && auth.split(':')[1] !== 'password')) {
      return new Response(
        JSON.stringify("Failed auth"),
        {
          headers: { "Content-Type": "application/json" },
          status: 403
        },
      )
    }

    // Getting id in path
    const taskPattern = new URLPattern({ pathname: '/snapstation-get-vouchers/:id' })
    const matchingPath = taskPattern.exec(req.url)
    const id = matchingPath ? matchingPath.pathname.groups.id : null

    // Getting data json
    let data = null
    if (req.method === 'POST' || req.method === 'PUT') {
      data = await req.json()
    }

    console.error(req.method, id)

    switch (req.method) {
      default:
        return getVoucher(id, connection)
    }
  }
  finally {
    connection.release()
  }
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
