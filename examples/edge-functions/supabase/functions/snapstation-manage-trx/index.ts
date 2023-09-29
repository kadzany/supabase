// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Pool, Client } from 'postgres'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log("Snapstation initialize transaction!")

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

async function initTransaction(data, connection) {
  // Check and get device id
  const resDevice = await connection.queryObject(
    `SELECT * 
      FROM public.ss_devices
      WHERE device_name = $1
      AND is_active = TRUE 
      LIMIT 1`,
    [data.device_name]
  )

  if (resDevice.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid device name"),
      { status: 404 },
    )
  }

  const device_id = resDevice.rows[0].device_id;

  // Check and get package id
  const resPackage = await connection.queryObject(
    `SELECT * 
      FROM public.ss_packages
      WHERE package_code = $1
      AND is_active = TRUE 
      LIMIT 1`,
    [data.package_code]
  )

  if (resPackage.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid package code"),
      { status: 404 },
    )
  }

  const package_id = resPackage.rows[0].package_id

  // Save to the database
  const resTrxInsert = await connection.queryObject(
    `INSERT INTO 
      public.ss_transactions 
      (     
        transaction_date,
        device_id,
        package_id
      ) 
      VALUES 
      (
        NOW(),
        $1, 
        $2
      ) 
    RETURNING *`,
    [
      device_id,
      package_id
    ]
  )

  return new Response(
    JSON.stringify(resTrxInsert.rows),
    {
      headers: { "Content-Type": "application/json" }
    },
  )
}

async function updateTransaction(data, connection) {
  // Check and get device id
  const resDevice = await connection.queryObject(
    `SELECT * 
      FROM public.ss_devices
      WHERE device_name = $1
      AND is_active = TRUE 
      LIMIT 1`,
    [data.device_name]
  )

  if (resDevice.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid device name"),
      { status: 404 },
    )
  }

  const device_id = resDevice.rows[0].device_id;

  // Check and get package id
  const resPackage = await connection.queryObject(
    `SELECT * 
      FROM public.ss_packages
      WHERE package_code = $1
      AND is_active = TRUE 
      LIMIT 1`,
    [data.package_code]
  )

  if (resPackage.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid package code"),
      { status: 404 },
    )
  }

  const package_id = resPackage.rows[0].package_id

  // Do the calculation of total
  if (data.quantity <= 0) data.quantity = 1
  let total_amount = data.amount * data.quantity

  // Do the calculation of voucher (discount)
  let voucher_id = null
  if (data.voucher_code != '') {
    const resVoucher = await connection.queryObject(
      `SELECT * 
        FROM public.ss_vouchers
        WHERE voucher_code = $1
        AND is_active = TRUE 
        LIMIT 1`,
      [data.voucher_code]
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
  }

  // Save to the database
  const resTrxInsert = await connection.queryObject(
    `INSERT INTO 
      public.ss_transactions 
      (     
        transaction_date,
        device_id,
        package_id,
        amount,
        total_amount,
        email,
        instagram,
        is_allow_upload,
        is_payment_successful,
        flip_bill_payment_id,
        flip_link_url,
        flip_webhook_call_id,
        flip_qr_data,
        product_name,
        quantity,
        voucher_id
      ) 
      VALUES 
      (
        NOW(),
        $1, 
        $2, 
        $3, 
        $4,
        $5,
        $6,
        $7,
        FALSE,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      ) 
    RETURNING *`,
    [
      device_id,
      package_id,
      data.amount,
      total_amount,
      data.email,
      data.instagram,
      data.is_allow_upload,
      data.flip_bill_payment_id,
      data.flip_link_url,
      data.flip_webhook_call_id,
      data.flip_qr_data,
      data.product_name,
      data.quantity,
      voucher_id
    ]
  )

  return new Response(
    JSON.stringify(resTrxInsert.rows),
    {
      headers: { "Content-Type": "application/json" }
    },
  )
}

async function updateTransaction(data, connection){
  // Check existing transaction
  const resExisting = await connection.queryObject(
    `SELECT * 
      FROM public.ss_transactions
      WHERE transaction_id = $1
      LIMIT 1`,
    [data.transaction_id]
  )

  if (resDuplicate.rows.length == 0) {
    return new Response(
      JSON.stringify(`Transaction with id ${data.transaction_id} does not existed!`),
      { status: 400 },
    )
  }
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
    const taskPattern = new URLPattern({ pathname: '/snapstation-manage-trx/:id' })
    const matchingPath = taskPattern.exec(req.url)
    const id = matchingPath ? matchingPath.pathname.groups.id : null

    // Getting data json
    let data = null
    if (req.method === 'POST' || req.method === 'PUT') {
      data = await req.json()
    }

    console.log(req.method, id)

    switch (req.method) {
      case "POST":
        return insertTransaction(data, connection)
      default:
        return getTransaction(id, connection)
    }
  }
  finally {
    connection.release()
  }
})