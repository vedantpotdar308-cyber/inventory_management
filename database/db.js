const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const crypto = require('crypto');

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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function initDatabase() {
  try {
    // 1. Ensure Database exists
    const serverConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });
    await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await serverConn.end();

    // 2. Initialize pool
    pool = mysql.createPool(config);
    const test = await pool.getConnection();
    isConnected = true;
    test.release();

    // 3. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`full_name\` VARCHAR(100) NOT NULL,
        \`role\` VARCHAR(50) DEFAULT 'Admin',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure default admin exists
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (existingUsers.length === 0) {
      const defaultHash = hashPassword('admin123');
      await pool.query(
        'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
        ['admin', defaultHash, 'System Administrator', 'Admin']
      );
      console.log('[MySQL] Default admin user created (Username: admin | Password: admin123)');
    }

    // 4. Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`product_code\` VARCHAR(50) NOT NULL UNIQUE,
        \`name\` VARCHAR(150) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`description\` TEXT NULL,
        \`purchase_price\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`sales_price\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`available_quantity\` INT NOT NULL DEFAULT 0,
        \`minimum_stock_level\` INT NOT NULL DEFAULT 5,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_category\` (\`category\`),
        INDEX \`idx_product_code\` (\`product_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if previous simple schema needs column upgrades
    const [cols] = await pool.query("SHOW COLUMNS FROM `products`");
    const colNames = cols.map(c => c.Field);
    
    if (!colNames.includes('product_code')) {
      await pool.query("ALTER TABLE `products` ADD COLUMN `product_code` VARCHAR(50) NOT NULL DEFAULT '' AFTER `id`");
      await pool.query("UPDATE `products` SET `product_code` = CONCAT('PRD-', LPAD(id, 4, '0')) WHERE `product_code` = ''");
      await pool.query("ALTER TABLE `products` ADD UNIQUE INDEX `idx_prod_code` (`product_code`)");
    }
    if (!colNames.includes('description')) {
      await pool.query("ALTER TABLE `products` ADD COLUMN `description` TEXT NULL");
    }
    if (!colNames.includes('purchase_price')) {
      await pool.query("ALTER TABLE `products` ADD COLUMN `purchase_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
      if (colNames.includes('price')) {
        await pool.query("UPDATE `products` SET `purchase_price` = ROUND(price * 0.7, 2)");
      }
    }
    if (!colNames.includes('sales_price')) {
      await pool.query("ALTER TABLE `products` ADD COLUMN `sales_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
      if (colNames.includes('price')) {
        await pool.query("UPDATE `products` SET `sales_price` = price");
      }
    }
    if (!colNames.includes('available_quantity')) {
      await pool.query("ALTER TABLE `products` ADD COLUMN `available_quantity` INT NOT NULL DEFAULT 0");
      if (colNames.includes('quantity')) {
        await pool.query("UPDATE `products` SET `available_quantity` = quantity");
      }
    }
    if (!colNames.includes('minimum_stock_level')) {
      await pool.query("ALTER TABLE `products` ADD COLUMN `minimum_stock_level` INT NOT NULL DEFAULT 5");
    }

    // 5. Create sales table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`sales\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`invoice_no\` VARCHAR(50) NOT NULL UNIQUE,
        \`customer_name\` VARCHAR(100) DEFAULT 'Walk-in Customer',
        \`total_amount\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`total_cost\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`payment_method\` VARCHAR(50) DEFAULT 'Cash',
        \`notes\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Create sale_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`sale_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`sale_id\` INT NOT NULL,
        \`product_id\` INT NOT NULL,
        \`product_code\` VARCHAR(50) NOT NULL,
        \`product_name\` VARCHAR(150) NOT NULL,
        \`quantity\` INT NOT NULL,
        \`purchase_price\` DECIMAL(10, 2) NOT NULL,
        \`sales_price\` DECIMAL(10, 2) NOT NULL,
        \`subtotal\` DECIMAL(10, 2) NOT NULL,
        CONSTRAINT \`fk_sale_items_sale\` FOREIGN KEY (\`sale_id\`) REFERENCES \`sales\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Create stock_movements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`stock_movements\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`product_id\` INT NOT NULL,
        \`product_code\` VARCHAR(50) NOT NULL,
        \`product_name\` VARCHAR(150) NOT NULL,
        \`type\` ENUM('PURCHASE', 'SALE', 'ADJUSTMENT') NOT NULL,
        \`quantity\` INT NOT NULL,
        \`previous_stock\` INT NOT NULL,
        \`new_stock\` INT NOT NULL,
        \`reference_no\` VARCHAR(100) NULL,
        \`notes\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_movement_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if products exist; if 0, seed starter products
    const [countRow] = await pool.query('SELECT COUNT(*) AS count FROM products');
    if (countRow[0].count === 0) {
      await pool.query(`
        INSERT INTO \`products\` (\`product_code\`, \`name\`, \`category\`, \`description\`, \`purchase_price\`, \`sales_price\`, \`available_quantity\`, \`minimum_stock_level\`) VALUES
        ('PRD-1001', 'Wireless Optical Mouse', 'Electronics', '2.4GHz wireless ergonomic mouse with nano receiver', 350.00, 599.00, 35, 10),
        ('PRD-1002', 'Mechanical Gaming Keyboard', 'Electronics', 'RGB backlit blue switches mechanical keyboard', 1200.00, 1999.00, 15, 5),
        ('PRD-1003', 'Ergonomic Desk Chair', 'Furniture', 'Breathable mesh high back chair with lumbar support', 3200.00, 4999.00, 8, 3),
        ('PRD-1004', 'USB-C Fast Charging Cable', 'Accessories', 'Braided 2m fast charging and sync cable', 120.00, 249.00, 60, 15),
        ('PRD-1005', 'Hardcover Notebook A5', 'Stationery', '192 ruled ivory pages 80 GSM', 60.00, 120.00, 45, 20),
        ('PRD-1006', 'Parle-G Gold Biscuits Pack', 'Food', 'Glucose biscuits family economy pack', 3.50, 5.00, 100, 25);
      `);
      console.log('[MySQL] Seeded starter products into inventory_db.');
    }

    console.log(`[MySQL] Connected successfully to "${config.database}" on port ${config.port}`);
    return true;
  } catch (err) {
    isConnected = false;
    console.error('[MySQL Warning] Could not connect to MySQL server.');
    console.error(`Error details: ${err.message}`);
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
  hashPassword,
};
