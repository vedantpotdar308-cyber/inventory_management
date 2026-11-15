# 📦 Inventory Management System

A full-stack Inventory Management application built with a **MySQL** backend, **Node.js (Express)** REST API, and a clean, responsive **HTML, CSS, and Vanilla JavaScript** frontend.

---

## 🌟 Key Features

1. **Dashboard Overview**
   - KPI metrics: Total unique products, total stock quantity, total inventory asset valuation (in ₹ INR), low stock count, out-of-stock count.
   - Low stock attention list with direct restock button.
   - Recent movements feed (real-time stream of arrivals and dispatches).

2. **Product Catalog Management (CRUD)**
   - **Add Products**: SKU code, name, category, unit price, initial quantity, minimum stock alert threshold, description.
   - **Edit Products**: Update product details and thresholds.
   - **Delete Products**: Secure deletion with confirmation modal and cascade audit handling.

3. **Stock In / Stock Out Transactions**
   - **Stock IN (Restocking / Arrival)**: Adds stock units, updates previous and new balance, logs timestamp and notes/PO number.
   - **Stock OUT (Sales / Dispatch)**: Deducts stock units with atomic database transaction verification (prevents negative inventory).
   - Complete transaction audit trail log.

4. **Search, Filter & Export**
   - Live instant search across SKU, product name, and description.
   - Dynamic category filter dropdown.
   - Stock status filter (All, Normal, Low Stock, Out of Stock).
   - **CSV Export**: One-click download of full product inventory and transaction audit logs.

5. **Modern Native UI & Accessibility**
   - Built with native HTML5 `<dialog>` elements and modern `light-dismiss` (click outside or press `Esc` to close).
   - Responsive layout designed for desktop and mobile devices.
   - Toast notification feedback system for every action.

---

## 🚀 Quick Start Guide

### Step 1: Start MySQL in XAMPP
1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL** (and Apache if you wish).
3. Ensure MySQL is running on port **3306** (the default).

> **Note**: The application automatically connects, creates the `inventory_db` database, creates all necessary tables (`products` and `transactions`), and seeds initial sample products if empty!

### Step 2: Configure Environment (Optional)
The project is already pre-configured for standard local MySQL / XAMPP in `.env`:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=inventory_db
```
If your MySQL has a password, enter it in `.env`.

### Step 3: Run the Application
Open PowerShell or your terminal in this directory:
```bash
cd d:\download\inventory-management-system
npm start
```

### Step 4: Open in Your Browser
Open your browser and visit:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📁 Project Structure

```text
inventory-management-system/
├── .env                  # MySQL connection settings
├── .env.example          # Environment sample template
├── package.json          # Dependencies & scripts
├── server.js             # Express REST API & static file server
├── database/
│   ├── db.js             # MySQL connection pool & automatic table migration
│   └── schema.sql        # Standalone SQL schema and sample seed records
├── public/               # Frontend (HTML, CSS, JavaScript)
│   ├── index.html        # Single-page UI with Dashboard, Catalog & History
│   ├── css/
│   │   └── style.css     # Modern styling, responsive cards, dialogs, badges
│   └── js/
│       └── app.js        # Controller: CRUD, Stock In/Out, Search & CSV Exports
└── README.md             # Documentation & Setup instructions
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Database connection status |
| `GET` | `/api/dashboard/stats` | Summary counts, valuation & recent movements |
| `GET` | `/api/products` | Filterable products catalog (`search`, `category`, `status`) |
| `POST` | `/api/products` | Create a new product |
| `PUT` | `/api/products/:id` | Update product details |
| `DELETE` | `/api/products/:id` | Delete product |
| `POST` | `/api/transactions` | Perform Stock IN or Stock OUT movement |
| `GET` | `/api/transactions` | Transaction history audit log |
| `GET` | `/api/categories` | Distinct categories list |
| `GET` | `/api/export/products` | Download CSV of products |
| `GET` | `/api/export/transactions`| Download CSV of transactions |
