const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  console.log('\n======================================================');
  console.log('  MySQL Database Connection Verification');
  console.log('======================================================');
  console.log(`Target Host:     ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
  console.log(`Target User:     ${process.env.DB_USER || 'root'}`);
  console.log(`Target Database: ${process.env.DB_NAME || 'inventory_db'}`);

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_db',
    });

    // 1. Get Server Version and Session details
    const [[meta]] = await conn.query('SELECT VERSION() AS version, DATABASE() as db, USER() as user, NOW() as server_time');
    console.log('\n[OK] Connection Established!');
    console.log(`MySQL Version:   ${meta.version}`);
    console.log(`Database Name:   ${meta.db}`);
    console.log(`Logged in as:    ${meta.user}`);
    console.log(`MySQL Time:      ${meta.server_time}`);

    // 2. Read live data from products table
    const [rows] = await conn.query('SELECT id, name, category, price, quantity FROM products ORDER BY id ASC');
    console.log(`\nFound ${rows.length} product(s) stored inside MySQL table "products":`);
    console.table(rows);

    await conn.end();
    console.log('======================================================');
    console.log('  Status: VERIFIED (App is 100% connected to MySQL)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[ERROR] Connection failed:');
    console.error(err.message);
    console.log('======================================================\n');
  }
}

check();
