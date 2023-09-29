// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Snapstation get merchant invoked!")

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
  try {
    const connection = await pool.connect()
    try {
      const data = await req.json()
      // Get from the database
      const result = await connection.queryObject(
        `SELECT * 
        FROM public.ss_merchants 
        WHERE merchant_name = $1
        AND is_active = TRUE`,
        [data.merchant_name])

      return new Response(
        JSON.stringify(result.rows),
        { headers: { "Content-Type": "application/json" } },
      )
    }
    finally {
      connection.release()
    }
  }
  catch (err) {
    console.error(err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
