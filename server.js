const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDatabase, getPool, isDbOnline } = require('./database/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to ensure database pool is available
function checkDb(req, res, next) {
  const pool = getPool();
  if (!pool || !isDbOnline()) {
    return res.status(503).json({
      success: false,
      message: 'MySQL is not running. Please start MySQL in XAMPP (Port 3306) and refresh.',
    });
  }
  req.pool = pool;
  next();
}

// -------------------------------------------------------------
// Database Status
// -------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    online: isDbOnline(),
    database: process.env.DB_NAME || 'inventory_db',
  });
});

// -------------------------------------------------------------
// Get All Products + Dashboard Summary Stats
// -------------------------------------------------------------
app.get('/api/products', checkDb, async (req, res) => {
  try {
    const [products] = await req.pool.query('SELECT * FROM products ORDER BY id DESC');

    // Calculate Dashboard Details
    const totalProducts = products.length;
    let totalQuantity = 0;
    let totalValue = 0;

    products.forEach((p) => {
      const qty = Number(p.quantity) || 0;
      const price = Number(p.price) || 0;
      totalQuantity += qty;
      totalValue += qty * price;
    });

    res.json({
      success: true,
      stats: {
        totalProducts,
        totalQuantity,
        totalValue,
      },
      products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Add New Product
// -------------------------------------------------------------
app.post('/api/products', checkDb, async (req, res) => {
  try {
    const { name, category, price, quantity } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Product Name and Category are required.' });
    }

    const pPrice = parseFloat(price) || 0;
    const pQty = parseInt(quantity, 10) || 0;

    const [result] = await req.pool.query(
      'INSERT INTO products (name, category, price, quantity) VALUES (?, ?, ?, ?)',
      [name.trim(), category.trim(), pPrice, pQty]
    );

    res.status(201).json({
      success: true,
      message: 'Product added successfully!',
      productId: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Edit / Update Product
// -------------------------------------------------------------
app.put('/api/products/:id', checkDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, quantity } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Product Name and Category are required.' });
    }

    const pPrice = parseFloat(price) || 0;
    const pQty = parseInt(quantity, 10) || 0;

    await req.pool.query(
      'UPDATE products SET name = ?, category = ?, price = ?, quantity = ? WHERE id = ?',
      [name.trim(), category.trim(), pPrice, pQty, id]
    );

    res.json({ success: true, message: 'Product updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Change Product Quantity (+1, -1, or set value)
// -------------------------------------------------------------
app.patch('/api/products/:id/quantity', checkDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { change, newQuantity } = req.body;

    const [rows] = await req.pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    let updatedQty = rows[0].quantity;

    if (newQuantity !== undefined) {
      updatedQty = Math.max(0, parseInt(newQuantity, 10) || 0);
    } else if (change !== undefined) {
      updatedQty = Math.max(0, updatedQty + parseInt(change, 10));
    }

    await req.pool.query('UPDATE products SET quantity = ? WHERE id = ?', [updatedQty, id]);

    res.json({
      success: true,
      message: 'Quantity updated!',
      quantity: updatedQty,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Remove / Delete Product
// -------------------------------------------------------------
app.delete('/api/products/:id', checkDb, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await req.pool.query('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, message: 'Product removed from inventory!' });
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
    console.log(`  Simple Inventory Management System`);
    console.log(`  Open in browser: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

start();
