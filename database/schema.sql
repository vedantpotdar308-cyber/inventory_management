-- ========================================================
-- Inventory Management System - Database Schema
-- Database: inventory_db
-- ========================================================

CREATE DATABASE IF NOT EXISTS `inventory_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inventory_db`;

-- --------------------------------------------------------
-- Table: products
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sku` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `quantity` INT NOT NULL DEFAULT 0,
  `min_stock` INT NOT NULL DEFAULT 5,
  `description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: transactions (Stock In / Stock Out log)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `type` ENUM('IN', 'OUT') NOT NULL,
  `quantity` INT NOT NULL,
  `previous_quantity` INT NOT NULL,
  `new_quantity` INT NOT NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_created_at` (`created_at`),
  CONSTRAINT `fk_transactions_product` FOREIGN KEY (`product_id`) 
    REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Sample Starter Data
-- --------------------------------------------------------
INSERT INTO `products` (`sku`, `name`, `category`, `price`, `quantity`, `min_stock`, `description`) VALUES
('SKU-1001', 'Logitech Wireless Mouse', 'Electronics', 799.00, 35, 10, 'Ergonomic 2.4GHz wireless optical mouse'),
('SKU-1002', 'Mechanical Gaming Keyboard', 'Electronics', 2499.00, 18, 5, 'RGB backlit tactile mechanical switches'),
('SKU-1003', 'Dell 24-inch IPS Monitor', 'Electronics', 11499.00, 7, 5, 'Full HD 1080p 75Hz display monitor'),
('SKU-1004', 'USB-C Fast Charging Cable', 'Accessories', 299.00, 80, 20, 'Braided nylon 2-meter fast charging cable'),
('SKU-1005', 'Laptop Stand Aluminum', 'Accessories', 1299.00, 4, 10, 'Adjustable height ergonomic cooling stand'),
('SKU-1006', 'Executive Ergonomic Chair', 'Furniture', 8999.00, 12, 3, 'High-back mesh chair with lumbar support'),
('SKU-1007', 'Hardcover Ruled Notebook A5', 'Stationery', 149.00, 120, 25, '192 pages 80 GSM acid-free ivory paper'),
('SKU-1008', 'Gel Pen 0.5mm (Pack of 10)', 'Stationery', 199.00, 2, 15, 'Smooth quick-drying waterproof black ink')
ON DUPLICATE KEY UPDATE `sku`=`sku`;

-- Initial Stock Transactions for Sample Data
INSERT INTO `transactions` (`product_id`, `type`, `quantity`, `previous_quantity`, `new_quantity`, `notes`) VALUES
(1, 'IN', 35, 0, 35, 'Initial opening stock intake'),
(2, 'IN', 25, 0, 25, 'Initial opening stock intake'),
(2, 'OUT', 7, 25, 18, 'Order #ORD-101 fulfillment'),
(3, 'IN', 10, 0, 10, 'Initial supplier batch'),
(3, 'OUT', 3, 10, 7, 'Store sales customer dispatch'),
(4, 'IN', 100, 0, 100, 'Bulk purchase delivery'),
(4, 'OUT', 20, 100, 80, 'Wholesale dispatch to branch'),
(5, 'IN', 10, 0, 10, 'Initial batch receipt'),
(5, 'OUT', 6, 10, 4, 'Direct sales order'),
(6, 'IN', 12, 0, 12, 'Supplier delivery'),
(7, 'IN', 150, 0, 150, 'Warehouse restock'),
(7, 'OUT', 30, 150, 120, 'Corporate order dispatch'),
(8, 'IN', 50, 0, 50, 'Initial inventory'),
(8, 'OUT', 48, 50, 2, 'School supplies sale');
