const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDatabase, getPool, getStatus } = require('./database/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check database connection
function requireDb(req, res, next) {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: 'Database is not connected. Please ensure MySQL is running (e.g. in XAMPP) and refresh.',
      status: getStatus(),
    });
  }
  req.pool = pool;
  next();
}

// -----------------------------------------------------------------------------
// Health & Status
// -----------------------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    server: 'Inventory Management API',
    database: getStatus(),
  });
});

// -----------------------------------------------------------------------------
// Dashboard Analytics & Metrics
// -----------------------------------------------------------------------------
app.get('/api/dashboard/stats', requireDb, async (req, res) => {
  try {
    const [counts] = await req.pool.query(`
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(quantity), 0) AS total_items,
        COALESCE(SUM(quantity * price), 0) AS total_valuation,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN quantity > 0 AND quantity <= min_stock THEN 1 END) AS low_stock
      FROM products
    `);

    const [recentTx] = await req.pool.query(`
      SELECT t.*, p.name AS product_name, p.sku AS product_sku
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        summary: counts[0],
        recentTransactions: recentTx,
      },
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Products API
// -----------------------------------------------------------------------------

// Get distinct categories
app.get('/api/categories', requireDb, async (req, res) => {
  try {
    const [rows] = await req.pool.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" ORDER BY category ASC'
    );
    res.json({ success: true, data: rows.map(r => r.category) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List all products with search, category & stock status filters
app.get('/api/products', requireDb, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (category && category !== 'ALL') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (status === 'low') {
      query += ' AND quantity > 0 AND quantity <= min_stock';
    } else if (status === 'out') {
      query += ' AND quantity = 0';
    } else if (status === 'in') {
      query += ' AND quantity > min_stock';
    }

    query += ' ORDER BY id DESC';

    const [products] = await req.pool.query(query, params);
    res.json({ success: true, data: products });
  } catch (err) {
    console.error('Error getting products:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single product
app.get('/api/products/:id', requireDb, async (req, res) => {
  try {
    const [products] = await req.pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const [transactions] = await req.pool.query(
      'SELECT * FROM transactions WHERE product_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.params.id]
    );

    res.json({ success: true, data: { ...products[0], recentTransactions: transactions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new product
app.post('/api/products', requireDb, async (req, res) => {
  try {
    const { sku, name, category, price, quantity, min_stock, description } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ success: false, message: 'SKU, Product Name, and Category are required.' });
    }

    const itemPrice = parseFloat(price) || 0;
    const itemQty = parseInt(quantity, 10) || 0;
    const itemMinStock = parseInt(min_stock, 10) || 5;

    // Check SKU duplicate
    const [existing] = await req.pool.query('SELECT id FROM products WHERE sku = ?', [sku.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `SKU "${sku.trim()}" already exists. Please use a unique SKU.` });
    }

    const [result] = await req.pool.query(
      `INSERT INTO products (sku, name, category, price, quantity, min_stock, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku.trim().toUpperCase(), name.trim(), category.trim(), itemPrice, itemQty, itemMinStock, description ? description.trim() : null]
    );

    const newProductId = result.insertId;

    // If initial quantity is greater than 0, log an initial stock-in transaction
    if (itemQty > 0) {
      await req.pool.query(
        `INSERT INTO transactions (product_id, type, quantity, previous_quantity, new_quantity, notes) 
         VALUES (?, 'IN', ?, 0, ?, 'Initial opening stock intake')`,
        [newProductId, itemQty, itemQty]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      productId: newProductId,
    });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update product
app.put('/api/products/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, name, category, price, min_stock, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Name and Category are required.' });
    }

    // Check SKU collision with other products
    if (sku) {
      const [existing] = await req.pool.query('SELECT id FROM products WHERE sku = ? AND id != ?', [sku.trim(), id]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: `SKU "${sku.trim()}" is already assigned to another product.` });
      }
    }

    const itemPrice = parseFloat(price) || 0;
    const itemMinStock = parseInt(min_stock, 10) || 5;

    await req.pool.query(
      `UPDATE products 
       SET sku = COALESCE(?, sku),
           name = ?, 
           category = ?, 
           price = ?, 
           min_stock = ?, 
           description = ?
       WHERE id = ?`,
      [sku ? sku.trim().toUpperCase() : null, name.trim(), category.trim(), itemPrice, itemMinStock, description ? description.trim() : null, id]
    );

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete product
app.delete('/api/products/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await req.pool.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// Stock Transactions API (Stock In / Stock Out)
// -----------------------------------------------------------------------------

app.post('/api/transactions', requireDb, async (req, res) => {
  const connection = await req.pool.getConnection();
  try {
    const { product_id, type, quantity, notes } = req.body;

    if (!product_id || !type || !quantity) {
      return res.status(400).json({ success: false, message: 'Product ID, Transaction Type, and Quantity are required.' });
    }

    const txType = type.toUpperCase();
    if (txType !== 'IN' && txType !== 'OUT') {
      return res.status(400).json({ success: false, message: "Transaction type must be 'IN' or 'OUT'." });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer.' });
    }

    await connection.beginTransaction();

    // Lock product row for update to ensure atomic stock safety
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = rows[0];
    const prevQty = product.quantity;
    let newQty = prevQty;

    if (txType === 'IN') {
      newQty = prevQty + qty;
    } else {
      if (prevQty < qty) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock! Current stock is ${prevQty}, cannot stock out ${qty}.`,
        });
      }
      newQty = prevQty - qty;
    }

    // Update product quantity
    await connection.query('UPDATE products SET quantity = ? WHERE id = ?', [newQty, product_id]);

    // Insert transaction audit record
    const [txResult] = await connection.query(
      `INSERT INTO transactions (product_id, type, quantity, previous_quantity, new_quantity, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product_id, txType, qty, prevQty, newQty, notes ? notes.trim() : null]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Stock ${txType === 'IN' ? 'added' : 'deducted'} successfully`,
      data: {
        transactionId: txResult.insertId,
        product_id,
        product_name: product.name,
        type: txType,
        quantity: qty,
        previous_quantity: prevQty,
        new_quantity: newQty,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('Transaction error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

// List transaction history
app.get('/api/transactions', requireDb, async (req, res) => {
  try {
    const { product_id, type, limit } = req.query;
    let query = `
      SELECT t.*, p.name AS product_name, p.sku AS product_sku, p.category AS product_category
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      query += ' AND t.product_id = ?';
      params.push(product_id);
    }

    if (type && (type === 'IN' || type === 'OUT')) {
      query += ' AND t.type = ?';
      params.push(type);
    }

    query += ' ORDER BY t.created_at DESC';

    const maxLimit = parseInt(limit, 10) || 50;
    query += ` LIMIT ${maxLimit}`;

    const [rows] = await req.pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// CSV Export Endpoints
// -----------------------------------------------------------------------------

app.get('/api/export/products', requireDb, async (req, res) => {
  try {
    const [products] = await req.pool.query('SELECT * FROM products ORDER BY id ASC');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_products.csv"');

    const headers = ['ID', 'SKU', 'Name', 'Category', 'Price (INR)', 'Quantity', 'Min Stock', 'Total Value', 'Created At'];
    let csv = headers.join(',') + '\n';

    products.forEach((p) => {
      const row = [
        p.id,
        `"${p.sku.replace(/"/g, '""')}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category.replace(/"/g, '""')}"`,
        p.price,
        p.quantity,
        p.min_stock,
        (p.price * p.quantity).toFixed(2),
        `"${new Date(p.created_at).toISOString()}"`,
      ];
      csv += row.join(',') + '\n';
    });

    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/export/transactions', requireDb, async (req, res) => {
  try {
    const [txs] = await req.pool.query(`
      SELECT t.*, p.name AS product_name, p.sku AS product_sku
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      ORDER BY t.created_at DESC
    `);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_transactions.csv"');

    const headers = ['Tx ID', 'Date & Time', 'Product SKU', 'Product Name', 'Type', 'Quantity', 'Prev Stock', 'New Stock', 'Notes'];
    let csv = headers.join(',') + '\n';

    txs.forEach((t) => {
      const row = [
        t.id,
        `"${new Date(t.created_at).toLocaleString()}"`,
        `"${t.product_sku.replace(/"/g, '""')}"`,
        `"${t.product_name.replace(/"/g, '""')}"`,
        t.type,
        t.quantity,
        t.previous_quantity,
        t.new_quantity,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ];
      csv += row.join(',') + '\n';
    });

    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback to index.html for SPA root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------
async function startServer() {
  console.log('[App] Initializing database...');
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  Inventory Management System is running!`);
    console.log(`  Access the Web Application: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

startServer();
