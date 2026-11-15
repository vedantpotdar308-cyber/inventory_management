# 📦 Simple Inventory Management System

A simple inventory management project with:
- **Frontend**: Plain HTML, CSS, and JavaScript.
- **Backend**: MySQL database with Node.js (Express) server.

---

## 🌟 What This Project Does

1. **Dashboard Details**:
   - **Total Products**: How many different products are in stock.
   - **Total Stock Quantity**: Sum of all units across all products.
   - **Total Stock Value**: Total valuation (`Price × Quantity` for all products).

2. **Core Features**:
   - **Adding Products**: Add a product with Name, Category, Unit Price, and Quantity.
   - **Editing Products**: Update any product's details and stock.
   - **Removing Products**: Delete a product with confirmation.
   - **Changing Quantity**: Quick `+` and `−` buttons directly in each row to change stock on the fly.
   - **Quick Search**: Filter products by name or category instantly.

---

## 🚀 How to Run

### Step 1: Start MySQL in XAMPP
1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL** (port 3306).

> The project automatically creates the `inventory_db` database and `products` table on start, and inserts starter products if empty!

### Step 2: Start the Project
Open terminal / command prompt in this directory:
```bash
cd d:\download\inventory-management-system
npm start
```

### Step 3: Open in Browser
Visit: **[http://localhost:3000](http://localhost:3000)**

---

## 📁 File Structure

```text
inventory-management-system/
├── server.js             # Simple backend server (connects to MySQL & serves frontend)
├── database/
│   ├── db.js             # MySQL connection & table initialization
│   └── schema.sql        # MySQL database schema & sample data
├── public/               # Frontend
│   ├── index.html        # Clean HTML (Dashboard + Products Table + Modals)
│   ├── css/
│   │   └── style.css     # Simple, clean, minimal styling
│   └── js/
│       └── app.js        # JavaScript (fetch API, CRUD, quantity change)
├── .env                  # MySQL configuration (default XAMPP root, no password)
└── package.json          # Dependencies (express, mysql2, dotenv, cors)
```
