<?php
// Simple Inventory Management - PHP MySQL Backend (XAMPP compatible)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    exit(0);
}

// MySQL Configuration
$db_host = 'localhost';
$db_user = 'root';
$db_pass = 'ved@2006potd'; // Default user password detected
$db_name = 'inventory_db';

// Connect with password or empty fallback
$conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    // Try without password if password failed
    $conn = @new mysqli($db_host, $db_user, '', $db_name);
}

if ($conn->connect_error) {
    // Try creating database
    $server = @new mysqli($db_host, $db_user, $db_pass);
    if (!$server->connect_error) {
        $server->query("CREATE DATABASE IF NOT EXISTS `{$db_name}`");
        $server->close();
        $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name);
    }
}

if ($conn->connect_error) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'online' => false,
        'message' => 'Cannot connect to MySQL. Ensure MySQL is running in XAMPP.',
    ]);
    exit;
}

// Ensure table exists
$conn->query("
  CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `quantity` INT NOT NULL DEFAULT 0
  )
");

// Seed sample data if empty
$check = $conn->query("SELECT COUNT(*) AS c FROM `products`");
$row = $check->fetch_assoc();
if ($row['c'] == 0) {
    $conn->query("
      INSERT INTO `products` (`name`, `category`, `price`, `quantity`) VALUES
      ('Wireless Mouse', 'Electronics', 599.00, 25),
      ('Mechanical Keyboard', 'Electronics', 1999.00, 15),
      ('Office Desk Chair', 'Furniture', 4999.00, 8),
      ('USB-C Cable', 'Accessories', 249.00, 50),
      ('A5 Notebook', 'Stationery', 120.00, 40)
    ");
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

// Read JSON input body if present
$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ($action === 'status') {
    echo json_encode(['online' => true, 'database' => $db_name]);
    exit;
}

// -------------------------------------------------------------
// GET: Fetch products & dashboard stats
// -------------------------------------------------------------
if ($method === 'GET') {
    $result = $conn->query("SELECT * FROM `products` ORDER BY id DESC");
    $products = [];
    $totalQty = 0;
    $totalVal = 0;

    while ($p = $result->fetch_assoc()) {
        $p['id'] = intval($p['id']);
        $p['price'] = floatval($p['price']);
        $p['quantity'] = intval($p['quantity']);
        $products[] = $p;

        $totalQty += $p['quantity'];
        $totalVal += ($p['quantity'] * $p['price']);
    }

    echo json_encode([
        'success' => true,
        'stats' => [
            'totalProducts' => count($products),
            'totalQuantity' => $totalQty,
            'totalValue' => $totalVal,
        ],
        'products' => $products,
    ]);
    exit;
}

// -------------------------------------------------------------
// POST: Add new product
// -------------------------------------------------------------
if ($method === 'POST' && $action !== 'quantity' && $action !== 'edit' && $action !== 'delete') {
    $name = trim($body['name'] ?? '');
    $category = trim($body['category'] ?? '');
    $price = floatval($body['price'] ?? 0);
    $quantity = intval($body['quantity'] ?? 0);

    if (empty($name) || empty($category)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Name and Category are required']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO `products` (`name`, `category`, `price`, `quantity`) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssdi", $name, $category, $price, $quantity);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Product added successfully!']);
    exit;
}

// -------------------------------------------------------------
// PUT / POST (edit): Edit product
// -------------------------------------------------------------
if ($method === 'PUT' || ($method === 'POST' && $action === 'edit')) {
    $name = trim($body['name'] ?? '');
    $category = trim($body['category'] ?? '');
    $price = floatval($body['price'] ?? 0);
    $quantity = intval($body['quantity'] ?? 0);

    if (empty($name) || empty($category) || $id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid product details']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE `products` SET `name` = ?, `category` = ?, `price` = ?, `quantity` = ? WHERE `id` = ?");
    $stmt->bind_param("ssdii", $name, $category, $price, $quantity, $id);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Product updated successfully!']);
    exit;
}

// -------------------------------------------------------------
// PATCH / POST (quantity): Change stock quantity
// -------------------------------------------------------------
if ($method === 'PATCH' || ($method === 'POST' && $action === 'quantity')) {
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid product id']);
        exit;
    }

    $change = intval($body['change'] ?? 0);
    $stmt = $conn->prepare("UPDATE `products` SET `quantity` = GREATEST(0, `quantity` + ?) WHERE `id` = ?");
    $stmt->bind_param("ii", $change, $id);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Quantity updated!']);
    exit;
}

// -------------------------------------------------------------
// DELETE / POST (delete): Remove product
// -------------------------------------------------------------
if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid product id']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM `products` WHERE `id` = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();

    echo json_encode(['success' => true, 'message' => 'Product removed from inventory!']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
