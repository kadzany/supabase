// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Snapstation Flip webhook invoked!")

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

serve(async (req) => {

  const connection = await pool.connect()

  try {
    const payload = await req.text()
    var decodedPayload = new URLSearchParams(payload)
    const data = JSON.parse(decodedPayload.get("data"))

    // Force to show to logger
    // console.error(`${data.id}, ${data.bill_link_id}, ${data.amount}, ${data.status}`)

    // Save to the database
    const { rows } = await connection.queryObject(
      `INSERT INTO 
        flip_webhook_calls 
        ( 
          link_id, 
          bill_payment_id, 
          bill_payment_status,
          created_at
        ) 
        VALUES 
        (
          $1, 
          $2, 
          $3, 
          NOW()
        ) 
      RETURNING *`,
      [
        data.id,
        data.bill_link_id,
        data.status
      ])

    // Update transaction based on the bill payment id
    const resTransaction = await connection.queryObject(
      `SELECT * 
          FROM public.ss_transactions
          WHERE flip_bill_payment_id = $1
          LIMIT 1`,
      [
        data.id
      ]
    )

    if (resTransaction.rows.length > 0) {
      const resTrxUpdate = await connection.queryObject(
        `UPDATE 
            public.ss_transactions 
            SET
              flip_payment_status = $1,
              flip_webhook_call_id = $2,
              is_payment_successful = $3
            WHERE transaction_id = $4`,
        [
          data.status,
          rows[0].id,
          data.status == "SUCCESSFUL" ? true : false,
          resTransaction.rows[0].transaction_id
        ]
      )
    }

    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } },
    )
  }
  finally {
    connection.release()
  }
})