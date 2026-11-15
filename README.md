# 📦 StockMaster - Inventory & Sales Management System

A full-stack, comprehensive Inventory & Sales Management System built with a **Node.js (Express)** backend, **MySQL** database, and a clean **HTML5, CSS3, and Vanilla JavaScript** frontend.

---

## 🌟 Complete Feature Breakdown

### 1. 🔐 Login & Authentication System
* User sign-in with password hashing.
* Pre-seeded administrator account:
  * **Username**: `admin`
  * **Password**: `admin123`
* Persistent session tracking and secure sign-out.

### 2. 🏷️ Product Management
* Complete product lifecycle: **Add new product**, **View all products**, **Edit product**, **Delete product**.
* Real-time search across Product ID, Product Name, Category, and Description.
* Filter by Category and Stock Status (*All*, *Low Stock*, *Out of Stock*).
* **Comprehensive Product Fields**:
  * `Product ID / Code` (e.g., `PRD-1001`)
  * `Product Name`
  * `Category`
  * `Description`
  * `Purchase Price (₹)` (Cost per unit)
  * `Sales Price (₹)` (Selling price)
  * `Available Quantity` (Units in warehouse)
  * `Minimum Stock Level` (Threshold for low stock warnings)

### 3. 🛒 Sales Management
* **Create a New Sale**:
  * Interactive Product Selector displaying real-time available stock and unit price.
  * Enter quantity sold with instant validation (prevents selling more than on-hand stock).
  * **Automatic Total Calculation**: Calculates `Quantity × Sales Price` live on screen.
  * Customer Name, Payment Method (*Cash*, *UPI / QR*, *Card*, *Net Banking*), and optional notes.
* **Automatic Stock Reduction**: Reduces warehouse inventory atomically inside a MySQL transaction.
* **Invoice Generation**: Generates official formatted receipts (`INV-YYYYMMDD-XXXX`) with a dedicated **Print Receipt** dialog.
* Sales history table logging all completed transactions.

### 4. 📑 Comprehensive Reports & Analytics
* **Date-Wise Filtering**: Filter any report from `Start Date` to `End Date`.
* **Print Report Button**: One-click professional print formatting (`@media print` stylesheet) that cleans UI toolbars and prints a clean report page.
* **6 Dedicated Reports**:
  1. **Product Report**: Complete catalog summary with margins and cost vs. sales price.
  2. **Available Stock Report**: Total units stocked, total cost valuation, total retail valuation, and potential gross profit.
  3. **Low Stock Report**: Immediate reorder items with deficit units and estimated reorder cost.
  4. **Daily Sales Report**: Day-by-day revenue, cost, profit, and order counts.
  5. **Monthly Sales Report**: Month-by-month financial performance breakdown.
  6. **Purchase & Stock Movement Report**: Complete audit trail of initial stock, sales deductions, and adjustments.

---

## 🚀 Quick Start Guide

### Step 1: Ensure MySQL is Running
Make sure your MySQL server is running (port **3306**).

### Step 2: Configure Environment (Already Done)
Settings are located in **[.env](file:///d:/download/inventory-management-system/.env)**:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=ved@2006potd
DB_NAME=inventory_db
```

### Step 3: Run the Application
In your terminal, navigate to the folder and run:
```bash
cd d:\download\inventory-management-system
npm start
```

### Step 4: Access in Your Browser
Open your browser and visit:
👉 **[http://localhost:3000](http://localhost:3000)**

* **Default Login**:
  * Username: `admin`
  * Password: `admin123`
