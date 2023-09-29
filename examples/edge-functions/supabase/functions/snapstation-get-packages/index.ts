// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Snapstation get packages invoked!")

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
      // Get from the database
      const result = await connection.queryObject
        `SELECT 
          pkg.package_id,
          pkg.package_name,
          pkg.package_description,
          COALESCE(evt.price, pkg.price) AS price,
          COALESCE(evt.price_pre_discounted, pkg.price_pre_discounted) AS price_pre_discounted,
          pkg.is_photo_cut,
          pkg.is_active,
          pkg.package_code,
          pkg.updated_date,
          evt.event_id, 
          evt.event_name
        FROM public.ss_packages AS pkg
        LEFT JOIN public.ss_events AS evt 
          ON pkg.package_id = evt.package_id 
          AND evt.is_active = TRUE
          AND NOW() BETWEEN evt.start_date AND evt.end_date
        WHERE pkg.is_active = TRUE
        `

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
