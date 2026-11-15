const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;
let isConnected = false;

// Initialize connection and tables
async function initDatabase() {
  try {
    // First, connect to MySQL server without selecting a database
    // in order to create the database if it doesn't already exist
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    await tempConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` 
       DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await tempConnection.end();

    // Now initialize the pool with the target database
    pool = mysql.createPool(dbConfig);
    const testConn = await pool.getConnection();
    isConnected = true;
    testConn.release();
    console.log(`[Database] Connected to MySQL (${dbConfig.database}) on ${dbConfig.host}:${dbConfig.port}`);

    // Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`sku\` VARCHAR(50) NOT NULL UNIQUE,
        \`name\` VARCHAR(150) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`price\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`quantity\` INT NOT NULL DEFAULT 0,
        \`min_stock\` INT NOT NULL DEFAULT 5,
        \`description\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_category\` (\`category\`),
        INDEX \`idx_sku\` (\`sku\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`transactions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`product_id\` INT NOT NULL,
        \`type\` ENUM('IN', 'OUT') NOT NULL,
        \`quantity\` INT NOT NULL,
        \`previous_quantity\` INT NOT NULL,
        \`new_quantity\` INT NOT NULL,
        \`notes\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_product_id\` (\`product_id\`),
        INDEX \`idx_created_at\` (\`created_at\`),
        CONSTRAINT \`fk_transactions_product\` FOREIGN KEY (\`product_id\`) 
          REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if products exist; if 0, seed sample data
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM `products`');
    if (rows[0].count === 0) {
      console.log('[Database] Seeding initial inventory sample data...');
      await pool.query(`
        INSERT INTO \`products\` (\`sku\`, \`name\`, \`category\`, \`price\`, \`quantity\`, \`min_stock\`, \`description\`) VALUES
        ('SKU-1001', 'Logitech Wireless Mouse', 'Electronics', 799.00, 35, 10, 'Ergonomic 2.4GHz wireless optical mouse'),
        ('SKU-1002', 'Mechanical Gaming Keyboard', 'Electronics', 2499.00, 18, 5, 'RGB backlit tactile mechanical switches'),
        ('SKU-1003', 'Dell 24-inch IPS Monitor', 'Electronics', 11499.00, 7, 5, 'Full HD 1080p 75Hz display monitor'),
        ('SKU-1004', 'USB-C Fast Charging Cable', 'Accessories', 299.00, 80, 20, 'Braided nylon 2-meter fast charging cable'),
        ('SKU-1005', 'Laptop Stand Aluminum', 'Accessories', 1299.00, 4, 10, 'Adjustable height ergonomic cooling stand'),
        ('SKU-1006', 'Executive Ergonomic Chair', 'Furniture', 8999.00, 12, 3, 'High-back mesh chair with lumbar support'),
        ('SKU-1007', 'Hardcover Ruled Notebook A5', 'Stationery', 149.00, 120, 25, '192 pages 80 GSM acid-free ivory paper'),
        ('SKU-1008', 'Gel Pen 0.5mm (Pack of 10)', 'Stationery', 199.00, 2, 15, 'Smooth quick-drying waterproof black ink')
      `);

      // Add initial stock transactions
      await pool.query(`
        INSERT INTO \`transactions\` (\`product_id\`, \`type\`, \`quantity\`, \`previous_quantity\`, \`new_quantity\`, \`notes\`) VALUES
        (1, 'IN', 35, 0, 35, 'Initial opening stock intake'),
        (2, 'IN', 25, 0, 25, 'Initial opening stock intake'),
        (2, 'OUT', 7, 25, 18, 'Order fulfillment'),
        (3, 'IN', 10, 0, 10, 'Supplier shipment batch'),
        (3, 'OUT', 3, 10, 7, 'Retail store sales'),
        (4, 'IN', 100, 0, 100, 'Bulk purchase delivery'),
        (4, 'OUT', 20, 100, 80, 'Dispatched to branch B'),
        (5, 'IN', 10, 0, 10, 'Initial batch receipt'),
        (5, 'OUT', 6, 10, 4, 'Direct customer sale'),
        (6, 'IN', 12, 0, 12, 'Warehouse delivery'),
        (7, 'IN', 150, 0, 150, 'Warehouse restock'),
        (7, 'OUT', 30, 150, 120, 'Corporate order dispatch'),
        (8, 'IN', 50, 0, 50, 'Initial inventory receipt'),
        (8, 'OUT', 48, 50, 2, 'School stationery supply');
      `);
      console.log('[Database] Sample inventory seeded successfully!');
    }

    return true;
  } catch (error) {
    isConnected = false;
    console.error('[Database Connection Warning]: Could not connect to MySQL.');
    console.error(`Reason: ${error.message}`);
    console.error('Note: Make sure your MySQL service is running (e.g. Start MySQL in XAMPP Control Panel).');
    return false;
  }
}

function getPool() {
  return pool;
}

function getStatus() {
  return {
    connected: isConnected,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
  };
}

module.exports = {
  initDatabase,
  getPool,
  getStatus,
  dbConfig,
};
