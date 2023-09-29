// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Hello from Functions!")

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
    // Grab a connection from the pool

    const payload = await req.text()
    var decodedPayload = new URLSearchParams(payload)
    const data = JSON.parse(decodedPayload.get("data"))

    // Check payload values
    //const { id, bill_link_id, bill_link, bill_title, sender_name, sender_email, sender_bank, amount, status, created_at } = data

    // Do something with the extracted properties
    //console.log(`Received data for bill ${id}: ${amount} ${sender_bank} ${bill_link_id} ${status}`)

    // Force to show to logger
    console.error(`${data.id}, ${data.bill_link_id}, ${data.amount}, ${data.status}`)

    // Save to the database
    const { rows } = await connection.queryObject(
      `INSERT INTO 
        flip_webhook_calls 
          ( link_id, 
            bill_payment_id, 
            bill_payment_status,
            created_at) 
        VALUES ($1, $2, $3, NOW()) 
        RETURNING *`,
      [data.id, data.bill_link_id, data.status]
    )

    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } },
    )
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
