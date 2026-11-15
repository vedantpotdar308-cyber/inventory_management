const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDatabase, getPool, isDbOnline, hashPassword } = require('./database/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB Check Middleware
function checkDb(req, res, next) {
  const pool = getPool();
  if (!pool || !isDbOnline()) {
    return res.status(503).json({
      success: false,
      message: 'MySQL database is not connected. Please ensure MySQL is running on port 3306.',
    });
  }
  req.pool = pool;
  next();
}

// -------------------------------------------------------------
// Health / Status
// -------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    online: isDbOnline(),
    database: process.env.DB_NAME || 'inventory_db',
  });
});

// -------------------------------------------------------------
// Authentication (Login System)
// -------------------------------------------------------------
app.post('/api/auth/login', checkDb, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const hashedPassword = hashPassword(password);
    const [users] = await req.pool.query(
      'SELECT id, username, full_name, role FROM users WHERE username = ? AND password = ?',
      [username.trim(), hashedPassword]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    res.json({
      success: true,
      message: 'Login successful!',
      user: users[0],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Dashboard Overview Stats
// -------------------------------------------------------------
app.get('/api/dashboard', checkDb, async (req, res) => {
  try {
    // 1. Products & Stock Summary
    const [prodStats] = await req.pool.query(`
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(available_quantity), 0) AS total_stock,
        COALESCE(SUM(available_quantity * purchase_price), 0) AS total_cost_value,
        COALESCE(SUM(available_quantity * sales_price), 0) AS total_sales_value,
        COUNT(CASE WHEN available_quantity <= minimum_stock_level THEN 1 END) AS low_stock_count,
        COUNT(CASE WHEN available_quantity = 0 THEN 1 END) AS out_of_stock_count
      FROM products
    `);

    // 2. Today's Sales
    const [todaySales] = await req.pool.query(`
      SELECT 
        COUNT(*) AS today_orders,
        COALESCE(SUM(total_amount), 0) AS today_revenue
      FROM sales
      WHERE DATE(created_at) = CURDATE()
    `);

    // 3. Recent 5 Sales
    const [recentSales] = await req.pool.query(`
      SELECT id, invoice_no, customer_name, total_amount, payment_method, created_at
      FROM sales
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // 4. Low Stock Attention Items
    const [lowStockItems] = await req.pool.query(`
      SELECT id, product_code, name, category, available_quantity, minimum_stock_level
      FROM products
      WHERE available_quantity <= minimum_stock_level
      ORDER BY available_quantity ASC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        summary: prodStats[0],
        today: todaySales[0],
        recentSales,
        lowStockItems,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Product Management
// -------------------------------------------------------------

// List all categories
app.get('/api/categories', checkDb, async (req, res) => {
  try {
    const [rows] = await req.pool.query('SELECT DISTINCT category FROM products WHERE category != "" ORDER BY category ASC');
    res.json({ success: true, data: rows.map(r => r.category) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// View all products with search & category filter
app.get('/api/products', checkDb, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      query += ' AND (name LIKE ? OR product_code LIKE ? OR category LIKE ? OR description LIKE ?)';
      params.push(s, s, s, s);
    }

    if (category && category !== 'ALL') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (status === 'low') {
      query += ' AND available_quantity <= minimum_stock_level AND available_quantity > 0';
    } else if (status === 'out') {
      query += ' AND available_quantity = 0';
    }

    query += ' ORDER BY id DESC';
    const [products] = await req.pool.query(query, params);

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single product
app.get('/api/products/:id', checkDb, async (req, res) => {
  try {
    const [rows] = await req.pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new product
app.post('/api/products', checkDb, async (req, res) => {
  try {
    const {
      product_code,
      name,
      category,
      description,
      purchase_price,
      sales_price,
      available_quantity,
      minimum_stock_level,
    } = req.body;

    if (!name || !category || !product_code) {
      return res.status(400).json({ success: false, message: 'Product Code, Name, and Category are required.' });
    }

    const code = product_code.trim().toUpperCase();
    const cost = parseFloat(purchase_price) || 0;
    const price = parseFloat(sales_price) || 0;
    const qty = parseInt(available_quantity, 10) || 0;
    const minStock = parseInt(minimum_stock_level, 10) || 5;

    // Check unique code
    const [existing] = await req.pool.query('SELECT id FROM products WHERE product_code = ?', [code]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `Product ID "${code}" already exists.` });
    }

    const [result] = await req.pool.query(
      `INSERT INTO products (product_code, name, category, description, purchase_price, sales_price, available_quantity, minimum_stock_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, name.trim(), category.trim(), description ? description.trim() : null, cost, price, qty, minStock]
    );

    const newId = result.insertId;

    // Log initial stock movement if quantity > 0
    if (qty > 0) {
      await req.pool.query(
        `INSERT INTO stock_movements (product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reference_no, notes)
         VALUES (?, ?, ?, 'PURCHASE', ?, 0, ?, 'INITIAL-STOCK', 'Initial inventory setup')`,
        [newId, code, name.trim(), qty, qty]
      );
    }

    res.status(201).json({ success: true, message: 'Product added successfully!', id: newId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Edit product
app.put('/api/products/:id', checkDb, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      product_code,
      name,
      category,
      description,
      purchase_price,
      sales_price,
      available_quantity,
      minimum_stock_level,
    } = req.body;

    if (!name || !category || !product_code) {
      return res.status(400).json({ success: false, message: 'Product Code, Name, and Category are required.' });
    }

    const code = product_code.trim().toUpperCase();

    // Check duplicate code on other products
    const [existing] = await req.pool.query('SELECT id FROM products WHERE product_code = ? AND id != ?', [code, id]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `Product ID "${code}" is already in use.` });
    }

    const [prevRows] = await req.pool.query('SELECT available_quantity, name FROM products WHERE id = ?', [id]);
    if (prevRows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    const prevQty = prevRows[0].available_quantity;
    const newQty = parseInt(available_quantity, 10) || 0;
    const cost = parseFloat(purchase_price) || 0;
    const price = parseFloat(sales_price) || 0;
    const minStock = parseInt(minimum_stock_level, 10) || 5;

    await req.pool.query(
      `UPDATE products 
       SET product_code = ?, name = ?, category = ?, description = ?, purchase_price = ?, sales_price = ?, available_quantity = ?, minimum_stock_level = ?
       WHERE id = ?`,
      [code, name.trim(), category.trim(), description ? description.trim() : null, cost, price, newQty, minStock, id]
    );

    // If quantity was adjusted manually, log stock movement adjustment
    if (newQty !== prevQty) {
      const diff = newQty - prevQty;
      await req.pool.query(
        `INSERT INTO stock_movements (product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reference_no, notes)
         VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, 'MANUAL-EDIT', 'Manual product stock edit')`,
        [id, code, name.trim(), Math.abs(diff), prevQty, newQty]
      );
    }

    res.json({ success: true, message: 'Product updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete product
app.delete('/api/products/:id', checkDb, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await req.pool.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, message: 'Product deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Sales Management (Create Sale, Reduce Stock, Track)
// -------------------------------------------------------------
app.post('/api/sales', checkDb, async (req, res) => {
  const connection = await req.pool.getConnection();
  try {
    const { customer_name, payment_method, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product item is required.' });
    }

    await connection.beginTransaction();

    let totalAmount = 0;
    let totalCost = 0;
    const processedItems = [];

    // Verify stock and calculate totals with row-level locks
    for (const item of items) {
      const productId = parseInt(item.product_id, 10);
      const qtyToSell = parseInt(item.quantity, 10);

      if (!productId || qtyToSell <= 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Invalid product or quantity specified.' });
      }

      const [rows] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]);
      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: `Product ID #${productId} not found.` });
      }

      const product = rows[0];
      if (product.available_quantity < qtyToSell) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}"! Available: ${product.available_quantity}, requested: ${qtyToSell}.`,
        });
      }

      const itemSalesPrice = parseFloat(product.sales_price);
      const itemPurchasePrice = parseFloat(product.purchase_price);
      const subtotal = itemSalesPrice * qtyToSell;

      totalAmount += subtotal;
      totalCost += itemPurchasePrice * qtyToSell;

      processedItems.push({
        product,
        qtyToSell,
        subtotal,
        itemSalesPrice,
        itemPurchasePrice,
      });
    }

    // Generate Invoice Number: INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNo = `INV-${dateStr}-${randomSuffix}`;

    // 1. Insert into sales
    const [saleResult] = await connection.query(
      `INSERT INTO sales (invoice_no, customer_name, total_amount, total_cost, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoiceNo, customer_name ? customer_name.trim() : 'Walk-in Customer', totalAmount, totalCost, payment_method || 'Cash', notes ? notes.trim() : null]
    );

    const saleId = saleResult.insertId;

    // 2. Reduce stock, record line items, and audit movements
    for (const entry of processedItems) {
      const p = entry.product;
      const newStock = p.available_quantity - entry.qtyToSell;

      // Deduct available quantity
      await connection.query('UPDATE products SET available_quantity = ? WHERE id = ?', [newStock, p.id]);

      // Insert sale item
      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, product_code, product_name, quantity, purchase_price, sales_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, p.id, p.product_code, p.name, entry.qtyToSell, entry.itemPurchasePrice, entry.itemSalesPrice, entry.subtotal]
      );

      // Record stock movement
      await connection.query(
        `INSERT INTO stock_movements (product_id, product_code, product_name, type, quantity, previous_stock, new_stock, reference_no, notes)
         VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, ?)`,
        [p.id, p.product_code, p.name, entry.qtyToSell, p.available_quantity, newStock, invoiceNo, `Sale to ${customer_name || 'Customer'}`]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully!',
      sale_id: saleId,
      invoice_no: invoiceNo,
      total_amount: totalAmount,
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// View all sales
app.get('/api/sales', checkDb, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];

    if (start_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    const [sales] = await req.pool.query(query, params);

    res.json({ success: true, data: sales });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single sale details with items
app.get('/api/sales/:id', checkDb, async (req, res) => {
  try {
    const [sales] = await req.pool.query('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (sales.length === 0) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const [items] = await req.pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);

    res.json({ success: true, data: { ...sales[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Comprehensive Reports API
// -------------------------------------------------------------

// 1. Product Report
app.get('/api/reports/products', checkDb, async (req, res) => {
  try {
    const [products] = await req.pool.query(`
      SELECT 
        product_code, name, category, purchase_price, sales_price, 
        (sales_price - purchase_price) AS margin,
        available_quantity, minimum_stock_level,
        (available_quantity * purchase_price) AS cost_valuation,
        (available_quantity * sales_price) AS sales_valuation
      FROM products
      ORDER BY category ASC, name ASC
    `);

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Available Stock Report
app.get('/api/reports/stock', checkDb, async (req, res) => {
  try {
    const [rows] = await req.pool.query(`
      SELECT 
        product_code, name, category, available_quantity, minimum_stock_level, purchase_price, sales_price,
        (available_quantity * purchase_price) AS cost_valuation,
        (available_quantity * sales_price) AS sales_valuation,
        CASE 
          WHEN available_quantity = 0 THEN 'Out of Stock'
          WHEN available_quantity <= minimum_stock_level THEN 'Low Stock'
          ELSE 'Healthy'
        END AS stock_status
      FROM products
      ORDER BY available_quantity ASC
    `);

    const [summary] = await req.pool.query(`
      SELECT 
        COUNT(*) AS total_items,
        SUM(available_quantity) AS total_units,
        SUM(available_quantity * purchase_price) AS total_cost_valuation,
        SUM(available_quantity * sales_price) AS total_sales_valuation
      FROM products
    `);

    res.json({ success: true, summary: summary[0], data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Low Stock Report
app.get('/api/reports/low-stock', checkDb, async (req, res) => {
  try {
    const [rows] = await req.pool.query(`
      SELECT 
        product_code, name, category, available_quantity, minimum_stock_level,
        (minimum_stock_level - available_quantity) AS deficit,
        purchase_price, (minimum_stock_level * purchase_price) AS estimated_reorder_cost
      FROM products
      WHERE available_quantity <= minimum_stock_level
      ORDER BY available_quantity ASC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Daily Sales Report (with date filtering)
app.get('/api/reports/daily-sales', checkDb, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT 
        DATE(created_at) AS sale_date,
        COUNT(*) AS orders_count,
        SUM(total_amount) AS revenue,
        SUM(total_cost) AS cost,
        SUM(total_amount - total_cost) AS profit
      FROM sales
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY DATE(created_at) ORDER BY sale_date DESC';

    const [rows] = await req.pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Monthly Sales Report
app.get('/api/reports/monthly-sales', checkDb, async (req, res) => {
  try {
    const [rows] = await req.pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS sale_month,
        COUNT(*) AS orders_count,
        SUM(total_amount) AS revenue,
        SUM(total_cost) AS cost,
        SUM(total_amount - total_cost) AS profit
      FROM sales
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY sale_month DESC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Purchase & Stock Movement Report (with date filtering)
app.get('/api/reports/movements', checkDb, async (req, res) => {
  try {
    const { start_date, end_date, type } = req.query;
    let query = `
      SELECT id, product_code, product_name, type, quantity, previous_stock, new_stock, reference_no, notes, created_at
      FROM stock_movements
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }
    if (type && type !== 'ALL') {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT 200';
    const [rows] = await req.pool.query(query, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Root fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  Inventory Management System (Full Suite)`);
    console.log(`  Running live at: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

start();
