-- ========================================================
-- Inventory Management System - Complete Database Schema
-- Database: inventory_db
-- ========================================================

CREATE DATABASE IF NOT EXISTS `inventory_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `inventory_db`;

-- --------------------------------------------------------
-- Table: users (Login System)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'Admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: products (Product Management)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `purchase_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `sales_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `available_quantity` INT NOT NULL DEFAULT 0,
  `minimum_stock_level` INT NOT NULL DEFAULT 5,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_product_code` (`product_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sales (Sales Management)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(50) NOT NULL UNIQUE,
  `customer_name` VARCHAR(100) DEFAULT 'Walk-in Customer',
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) DEFAULT 'Cash',
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: sale_items (Line items of sales)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_code` VARCHAR(50) NOT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `quantity` INT NOT NULL,
  `purchase_price` DECIMAL(10, 2) NOT NULL,
  `sales_price` DECIMAL(10, 2) NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: stock_movements (Audit / Movement Report)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `product_code` VARCHAR(50) NOT NULL,
  `product_name` VARCHAR(150) NOT NULL,
  `type` ENUM('PURCHASE', 'SALE', 'ADJUSTMENT') NOT NULL,
  `quantity` INT NOT NULL,
  `previous_stock` INT NOT NULL,
  `new_stock` INT NOT NULL,
  `reference_no` VARCHAR(100) NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_movement_created` (`created_at`),
  CONSTRAINT `fk_stock_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Seed Data
-- --------------------------------------------------------
-- Default User: admin / admin123 (SHA-256: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822808293786377)
INSERT INTO `users` (`username`, `password`, `full_name`, `role`) VALUES
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822808293786377', 'System Administrator', 'Admin')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Starter Products
INSERT INTO `products` (`product_code`, `name`, `category`, `description`, `purchase_price`, `sales_price`, `available_quantity`, `minimum_stock_level`) VALUES
('PRD-1001', 'Wireless Optical Mouse', 'Electronics', '2.4GHz wireless ergonomic mouse with nano receiver', 350.00, 599.00, 35, 10),
('PRD-1002', 'Mechanical Gaming Keyboard', 'Electronics', 'RGB backlit blue switches mechanical keyboard', 1200.00, 1999.00, 15, 5),
('PRD-1003', 'Ergonomic Desk Chair', 'Furniture', 'Breathable mesh high back chair with lumbar support', 3200.00, 4999.00, 8, 3),
('PRD-1004', 'USB-C Fast Charging Cable', 'Accessories', 'Braided 2m fast charging and sync cable', 120.00, 249.00, 60, 15),
('PRD-1005', 'Hardcover Notebook A5', 'Stationery', '192 ruled ivory pages 80 GSM', 60.00, 120.00, 45, 20),
('PRD-1006', 'Parle-G Gold Biscuits Pack', 'Food', 'Glucose biscuits family economy pack', 3.50, 5.00, 100, 25)
ON DUPLICATE KEY UPDATE `product_code`=`product_code`;
