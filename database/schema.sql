-- ========================================================
-- Simple Inventory Management - MySQL Database Schema
-- Database: inventory_db
-- ========================================================

CREATE DATABASE IF NOT EXISTS `inventory_db`;
USE `inventory_db`;

-- Single simple products table
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `quantity` INT NOT NULL DEFAULT 0
);

-- Starter sample products
INSERT INTO `products` (`name`, `category`, `price`, `quantity`) VALUES
('Wireless Mouse', 'Electronics', 599.00, 25),
('Mechanical Keyboard', 'Electronics', 1999.00, 15),
('Office Desk Chair', 'Furniture', 4999.00, 8),
('USB-C Cable', 'Accessories', 249.00, 50),
('A5 Notebook', 'Stationery', 120.00, 40)
ON DUPLICATE KEY UPDATE `id`=`id`;
