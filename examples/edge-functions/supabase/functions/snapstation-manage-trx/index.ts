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
/**
 * Called by the photobox unity application
 * @param id 
 * @param connection 
 * @returns 
 */
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

/**
 * Called by the photobox unity application
 * @param data 
 * @param connection 
 * @returns 
 */
async function initTransaction(data, connection) {
  console.error("init transaction", data)
  // Check and get device id
  const resDevice = await connection.queryObject(
    `SELECT * 
      FROM public.ss_devices
      WHERE device_id = $1
      AND is_active = TRUE 
      LIMIT 1`,
    [
      data.device_id
    ]
  )

  if (resDevice.rows.length == 0) {
    return new Response(
      JSON.stringify("Invalid device id"),
      { status: 404 },
    )
  }

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
        package_id,
        email,
        instagram,
        is_allow_upload, 
        product_name,
        amount,
        quantity,
        total_amount
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
        $8,
        $9
      ) 
    RETURNING *`,
    [
      data.device_id,
      package_id,
      data.email,
      data.instagram,
      data.is_allow_upload,
      data.product_name,
      data.amount??0,
      data.quantity??0,
      data.total_amount??0
    ]
  )

  if (resTrxInsert.rows.length > 0) {
    resTrxInsert.rows[0].package_code = data.package_code
  }

  return new Response(
    JSON.stringify(resTrxInsert.rows),
    {
      headers: { "Content-Type": "application/json" }
    },
  )
}

/**
 * Called by the console-api-flip
 * @param data 
 * @param connection 
 * @returns 
 */
async function updateTransaction(data, connection) {

  // Check existing transaction
  const resExisting = await connection.queryObject(
    `SELECT * 
      FROM public.ss_transactions
      WHERE transaction_id = $1
      LIMIT 1`,
    [
      data.transaction_id
    ]
  )

  if (resExisting.rows.length == 0) {
    return new Response(
      JSON.stringify(`Transaction with id ${data.transaction_id} does not existed!`),
      { status: 404 },
    )
  }

  // Do the calculation of total
  if (data.quantity <= 0) data.quantity = 1
  let total_amount = data.amount * data.quantity

  // Do the calculation of voucher (discount)
  let voucher_id = null
  let voucher_amount = 0
  if (data.voucher_code && data.voucher_code != '') {
    const resVoucher = await connection.queryObject(
      `SELECT * 
        FROM public.ss_vouchers
        WHERE voucher_code = $1
        AND is_active = TRUE 
        AND NOW() BETWEEN start_date AND end_date
        LIMIT 1`,
      [
        data.voucher_code
      ]
    )

    if (resVoucher.rows.length == 0) {
      return new Response(
        JSON.stringify("Invalid voucher code"),
        { status: 404 },
      )
    }

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

    if (voucher_used >= resVoucher.rows[0].max_used) {
      return new Response(
        JSON.stringify("Voucher usage limit reached!"),
        { status: 404 },
      )
    }

    voucher_id = resVoucher.rows[0].voucher_id
    voucher_amount = resVoucher.rows[0].amount
    total_amount = total_amount - voucher_amount
  }

  // Save to the database
  if (data.type == "CALCULATE") {
    const resCalculate = await connection.queryObject(
      `UPDATE 
        public.ss_transactions 
        SET 
          amount = $1,
          quantity = $2,
          voucher_id = $3,
          voucher_amount = $4,
          total_amount = $5
        WHERE transaction_id = $6
        RETURNING transaction_id, total_amount`,
      [
        data.amount,
        data.quantity,
        voucher_id,
        voucher_amount,
        total_amount,
        data.transaction_id
      ]
    )

    return new Response(
      JSON.stringify(resCalculate.rows[0]),
      {
        headers: { "Content-Type": "application/json" }
      },
    )
  }
  else if (data.type == "FLIP_UPDATE") {
    const resTrxUpdate = await connection.queryObject(
      `UPDATE 
        public.ss_transactions 
        SET 
          flip_bill_payment_id = $1,
          flip_link_url = $2,
          flip_qr_data = $3,
          flip_payment_status = $4,
          attachment_local_folder = $5
        WHERE transaction_id = $6`,
      [
        data.flip_bill_payment_id,
        data.flip_link_url,
        data.flip_qr_data,
        data.flip_payment_status,
        data.attachment_local_folder,
        data.transaction_id
      ]
    )

    return new Response(
      JSON.stringify(resTrxUpdate.rows),
      {
        headers: { "Content-Type": "application/json" }
      },
    )
  }

  return new Response(
    JSON.stringify("Invalid Transaction Type"),
    {
      headers: { "Content-Type": "application/json" },
      status: 500
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
    const taskPattern = new URLPattern({ pathname: '/snapstation-manage-trx/:id' })
    const matchingPath = taskPattern.exec(req.url)
    const id = matchingPath ? matchingPath.pathname.groups.id : null

    // Getting data json
    let data = null
    if (req.method === 'POST' || req.method === 'PUT') {
      data = await req.json()
      console.error(req.method, data)
    }

    if (req.method === 'GET') {
      console.error(req.method, id)
    }

    switch (req.method) {
      case "POST":
        return initTransaction(data, connection)
      case "PUT":
        return updateTransaction(data, connection)
      default:
        return getTransaction(id, connection)
    }
  }
  finally {
    connection.release()
  }
})