// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Snapstation initialize vaoucher!")

// Create a database pool with one connection.
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

async function getVoucher(id, code, connection) {
  let voucher_id = null
  let voucher_amount = 0
  const resVoucher = await connection.queryObject(
    `SELECT * 
        FROM public.ss_vouchers
        WHERE voucher_code = $1
        AND is_active = TRUE 
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

  const resVoucherCheck = await connection.queryObject(
    `SELECT COUNT(1) AS voucher_used
        FROM public.ss_transactions
        WHERE voucher_id = $1`,
    [resVoucher.rows[0].voucher_id]
  )

  if (resVoucherCheck.rows[0].voucher_used >= resVoucher.rows[0].max_used) {
    return new Response(
      JSON.stringify("Voucher usage limit reached!"),
      { status: 404 },
    )
  }

  voucher_id = resVoucher.rows[0].voucher_id
  voucher_amount = resVoucher.rows[0].amount

  const resCalculate = await connection.queryObject(
    `UPDATE 
      public.ss_transactions 
      SET        
        voucher_id = $1
        voucher_amount = $2,
        total_amount = 0
      WHERE transaction_id = $3
      RETURNING transaction_id, total_amount`,
    [
      voucher_id,
      voucher_amount,
      id
    ]
  )

  if(resCalculate.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid voucher code (2)"),
      { status: 404 },
    )
  }

  return new Response(
    JSON.stringify({
      voucher_code: code,
      voucher_id: voucher_id,
      voucher_amount: voucher_amount,
      transaction_id: id
    }),
    {
      headers: { "Content-Type": "application/json" }
    },
  )
}

async function getTransaction(id, connection) {
  const resTrxGet = await connection.queryObject(
    `SELECT * 
      FROM public.ss_transactions
      WHERE transaction_id = $1
      LIMIT 1`,
    [id]
  )

  if (resTrxGet.rows.length <= 0) {
    return new Response(
      JSON.stringify(`No such transaction`),
      {
        headers: { "Content-Type": "application/json" },
        status: 404
      },
    )
  }

  return new Response(
    JSON.stringify(resTrxGet.rows),
    {
      headers: { "Content-Type": "application/json" }
    },
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
    const taskPattern = new URLPattern({ pathname: '/snapstation-manage-trx-voucher/:id/:code' })
    const matchingPath = taskPattern.exec(req.url)
    const id = matchingPath ? matchingPath.pathname.groups.id : null

    // Getting data json
    let data = null
    if (req.method === 'POST' || req.method === 'PUT') {
      data = await req.json()
    }

    console.error(req.method, id)

    switch (req.method) {
      case "POST":
        return generateVouchers(data, connection)
      default:
        return getVoucher(id, code, connection)
    }
  }
  finally {
    connection.release()
  }
})

// Function to generate a random uppercase letter
const getRandomLetter => () {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomIndex = Math.floor(Math.random() * alphabet.length);
  return alphabet[randomIndex];
}

// Function to generate a random 5-digit number
function getRandomNumber() {
  return Math.floor(10000 + Math.random() * 90000);
}

// Function to generate a random voucher code
function generateVoucherCode() {
  const letters = `${getRandomLetter()}${getRandomLetter()}`;
  const digits = getRandomNumber().toString();
  return `${letters}${digits}`;
}
// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
