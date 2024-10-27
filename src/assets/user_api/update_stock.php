<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Log errors to a file
ini_set('log_errors', 1);
ini_set('error_log', '/path/to/error.log'); 

header("Access-Control-Allow-Origin: http://localhost:8100");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

function logMessage($message) {
    file_put_contents('debug.log', date('[Y-m-d H:i:s] ') . $message . PHP_EOL, FILE_APPEND);
}

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}

$servername = "localhost";
$username = "root";
$password = "";
$dbname = "best";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    logMessage("Connection failed: " . $conn->connect_error);
    sendJsonResponse(["error" => "Database connection failed"], 500);
}

// Get the raw POST data
$rawData = file_get_contents("php://input");
$data = json_decode($rawData);

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    if (!empty($data->product_id) && isset($data->quantity)) {
        $product_id = $conn->real_escape_string($data->product_id);
        $new_quantity = $conn->real_escape_string($data->quantity);

        // Start transaction
        $conn->begin_transaction();

        try {
            // Get the current stock quantity
            $query = "SELECT stock_quantity FROM products WHERE product_id = ?";
            $stmt = $conn->prepare($query);
            $stmt->bind_param("i", $product_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $current_quantity = $row['stock_quantity'];
            $stmt->close();

            // Calculate the quantity that was sold
            $quantity_sold = $current_quantity - $new_quantity;

            // Update the stock in the products table
            $update_query = "UPDATE products SET stock_quantity = ? WHERE product_id = ?";
            $stmt = $conn->prepare($update_query);
            $stmt->bind_param("ii", $new_quantity, $product_id);
            $stmt->execute();
            $stmt->close();

            // Check if the product_id exists in track_product_quantity
            $check_query = "SELECT quantity_out FROM track_product_quantity WHERE product_id = ?";
            $stmt = $conn->prepare($check_query);
            $stmt->bind_param("i", $product_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                // Product exists, update the quantity
                $row = $result->fetch_assoc();
                $new_quantity_out = $row['quantity_out'] + $quantity_sold;
                $update_track_query = "UPDATE track_product_quantity SET quantity_out = ? WHERE product_id = ?";
                $stmt = $conn->prepare($update_track_query);
                $stmt->bind_param("ii", $new_quantity_out, $product_id);
            } else {
                // Product doesn't exist, insert new record
                $update_track_query = "INSERT INTO track_product_quantity (product_id, quantity_out) VALUES (?, ?)";
                $stmt = $conn->prepare($update_track_query);
                $stmt->bind_param("ii", $product_id, $quantity_sold);
            }
            
            $stmt->execute();
            $stmt->close();

            // Commit the transaction
            $conn->commit();

            sendJsonResponse(["message" => "Stock updated and tracked successfully"]);
        } catch (Exception $e) {
            // An error occurred, rollback the transaction
            $conn->rollback();
            logMessage("Transaction failed: " . $e->getMessage());
            sendJsonResponse(["error" => "Unable to update and track stock"], 500);
        }
    } else {
        sendJsonResponse(["error" => "Invalid data provided"], 400);
    }
} else {
    sendJsonResponse(["error" => "Invalid request method"], 405);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getProductMovement') {
    try {
        // Query to get data from track_product_quantity table
        $sql = "SELECT tpq.*, p.name, p.category, p.stock_quantity 
                FROM track_product_quantity tpq
                JOIN products p ON tpq.product_id = p.product_id
                ORDER BY tpq.quantity_out DESC";
        
        $result = $conn->query($sql);

        if ($result === false) {
            throw new Exception("Query failed: " . $conn->error);
        }

        $productMovement = [];
        while ($row = $result->fetch_assoc()) {
            $productMovement[] = [
                'product_id' => $row['product_id'],
                'name' => $row['name'],
                'category' => $row['category'],
                'stock_quantity' => $row['stock_quantity'],
                'quantity_out' => $row['quantity_out'],
                'created_at' => $row['created_at']
            ];
        }

        // Send the response as JSON
        header('Content-Type: application/json');
        echo json_encode($productMovement);
        error_log("Sent response: " . json_encode($productMovement));
    } catch (Exception $e) {
        error_log("Error in getProductMovement: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Internal server error: ' . $e->getMessage()]);
    }
    exit;
}

$conn->close();
?>