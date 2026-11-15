const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_db',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool = null;
let isConnected = false;

async function initDatabase() {
  try {
    // 1. Connect without database to ensure database exists
    const serverConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });
    await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\`;`);
    await serverConn.end();

    // 2. Initialize connection pool to inventory_db
    pool = mysql.createPool(config);
    const test = await pool.getConnection();
    isConnected = true;
    test.release();

    // 3. Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(150) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`price\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`quantity\` INT NOT NULL DEFAULT 0
      );
    `);

    // 4. Seed sample items if table is empty
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM `products`');
    if (rows[0].count === 0) {
      await pool.query(`
        INSERT INTO \`products\` (\`name\`, \`category\`, \`price\`, \`quantity\`) VALUES
        ('Wireless Mouse', 'Electronics', 599.00, 25),
        ('Mechanical Keyboard', 'Electronics', 1999.00, 15),
        ('Office Desk Chair', 'Furniture', 4999.00, 8),
        ('USB-C Cable', 'Accessories', 249.00, 50),
        ('A5 Notebook', 'Stationery', 120.00, 40);
      `);
      console.log('[MySQL] Sample products seeded into inventory_db.');
    }

    console.log(`[MySQL] Connected successfully to "${config.database}" on port ${config.port}`);
    return true;
  } catch (err) {
    isConnected = false;
    console.error('[MySQL Warning] Could not connect to MySQL server.');
    console.error(`Error details: ${err.message}`);
    console.error('Make sure MySQL is started in XAMPP on port 3306.');
    return false;
  }
}

function getPool() {
  return pool;
}

function isDbOnline() {
  return isConnected;
}

module.exports = {
  initDatabase,
  getPool,
  isDbOnline,
};
