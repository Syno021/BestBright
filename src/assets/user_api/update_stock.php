<?php
// Prevent any unwanted output
ob_start();

// Enable error display for debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

// Clear any output buffers
ob_clean();

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

function logMessage($message) {
    error_log(date('[Y-m-d H:i:s] ') . $message . PHP_EOL, 3, 'debug.log');
}

function sendJsonResponse($data, $statusCode = 200) {
    // Clear any previous output
    if (ob_get_length()) ob_clean();
    
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_NUMERIC_CHECK);
    exit();
}

$servername = "localhost";
$username = "root";
$password = "";
$dbname = "best";

// Create connection with error handling
try {
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Check connection
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    // Handle different HTTP methods
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            if (isset($_GET['action'])) {
                switch ($_GET['action']) {
                    case 'getTrackProductQuantity':
                        try {
                            // First, verify if the table exists
                            $tableCheck = $conn->query("SHOW TABLES LIKE 'track_product_quantity'");
                            if ($tableCheck->num_rows == 0) {
                                throw new Exception("Table 'track_product_quantity' does not exist");
                            }

                            // Get the table structure for debugging
                            $columns = $conn->query("SHOW COLUMNS FROM track_product_quantity");
                            $columnNames = [];
                            while ($col = $columns->fetch_assoc()) {
                                $columnNames[] = $col['Field'];
                            }
                            logMessage("Table columns: " . json_encode($columnNames));

                            // Modified query with error checking
                            $sql = "SELECT 
                                tpq.*,
                                p.name as product_name,
                                p.category,
                                p.stock_quantity as current_stock
                            FROM track_product_quantity tpq
                            LEFT JOIN products p ON tpq.product_id = p.product_id
                            ORDER BY tpq.created_at DESC";

                            logMessage("Executing query: " . $sql);
                            
                            $result = $conn->query($sql);
                            
                            if ($result === false) {
                                throw new Exception("Query failed: " . $conn->error);
                            }
                            
                            $trackingData = [];
                            while ($row = $result->fetch_assoc()) {
                                // Check if 'id' column exists, if not use alternate primary key
                                $tracking_id = isset($row['id']) ? $row['id'] : 
                                             (isset($row['tracking_id']) ? $row['tracking_id'] : null);
                                
                                $trackingData[] = [
                                    'tracking_id' => $tracking_id ? (int)$tracking_id : null,
                                    'product_id' => (int)$row['product_id'],
                                    'product_name' => $row['product_name'] ?? 'Unknown',
                                    'category' => $row['category'] ?? 'Uncategorized',
                                    'quantity_out' => (int)($row['quantity_out'] ?? 0),
                                    'current_stock' => (int)($row['current_stock'] ?? 0),
                                    'created_at' => $row['created_at'] ?? null,
                                    'updated_at' => $row['updated_at'] ?? null
                                ];
                            }
                            
                            sendJsonResponse($trackingData);
                        } catch (Exception $e) {
                            logMessage("Error in getTrackProductQuantity: " . $e->getMessage());
                            logMessage("SQL Error: " . $conn->error);
                            sendJsonResponse([
                                "error" => "Failed to fetch tracking data",
                                "debug_message" => $e->getMessage()
                            ], 500);
                        }
                        break;
                        
                    default:
                        sendJsonResponse(["error" => "Invalid action specified"], 400);
                        break;
                }
            } else {
                sendJsonResponse(["error" => "No action specified"], 400);
            }
            break;

        case 'PUT':
            try {
                $rawData = file_get_contents("php://input");
                $data = json_decode($rawData);

                if (!empty($data->product_id) && isset($data->quantity)) {
                    $product_id = $conn->real_escape_string($data->product_id);
                    $new_quantity = $conn->real_escape_string($data->quantity);

                    // Log the incoming data
                    logMessage("Updating stock - Product ID: $product_id, New Quantity: $new_quantity");

                    // Start transaction
                    $conn->begin_transaction();

                    try {
                        // Get the current stock quantity
                        $query = "SELECT stock_quantity FROM products WHERE product_id = ?";
                        $stmt = $conn->prepare($query);
                        $stmt->bind_param("i", $product_id);
                        $stmt->execute();
                        $result = $stmt->get_result();
                        
                        if ($result->num_rows === 0) {
                            throw new Exception("Product not found");
                        }
                        
                        $row = $result->fetch_assoc();
                        $current_quantity = $row['stock_quantity'];
                        $stmt->close();

                        // Calculate the quantity that was moved
                        $quantity_moved = $current_quantity - $new_quantity;
                        
                        if ($quantity_moved < 0) {
                            logMessage("Warning: Stock increase detected");
                        }

                        // Update the stock in the products table
                        $update_query = "UPDATE products SET stock_quantity = ? WHERE product_id = ?";
                        $stmt = $conn->prepare($update_query);
                        $stmt->bind_param("ii", $new_quantity, $product_id);
                        
                        if (!$stmt->execute()) {
                            throw new Exception("Failed to update product stock: " . $stmt->error);
                        }
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
                            $new_quantity_out = $row['quantity_out'] + $quantity_moved;
                            $update_track_query = "UPDATE track_product_quantity 
                                                 SET quantity_out = ?, 
                                                     updated_at = CURRENT_TIMESTAMP 
                                                 WHERE product_id = ?";
                            $stmt = $conn->prepare($update_track_query);
                            $stmt->bind_param("ii", $new_quantity_out, $product_id);
                        } else {
                            // Product doesn't exist, insert new record
                            $update_track_query = "INSERT INTO track_product_quantity 
                                                 (product_id, quantity_out) 
                                                 VALUES (?, ?)";
                            $stmt = $conn->prepare($update_track_query);
                            $stmt->bind_param("ii", $product_id, $quantity_moved);
                        }
                        
                        if (!$stmt->execute()) {
                            throw new Exception("Failed to update tracking: " . $stmt->error);
                        }
                        $stmt->close();

                        // Commit the transaction
                        $conn->commit();

                        sendJsonResponse([
                            "message" => "Stock updated and tracked successfully",
                            "details" => [
                                "product_id" => $product_id,
                                "previous_quantity" => $current_quantity,
                                "new_quantity" => $new_quantity,
                                "quantity_moved" => $quantity_moved
                            ]
                        ]);
                    } catch (Exception $e) {
                        // An error occurred, rollback the transaction
                        $conn->rollback();
                        logMessage("Transaction failed: " . $e->getMessage());
                        sendJsonResponse([
                            "error" => "Unable to update and track stock",
                            "debug_message" => $e->getMessage()
                        ], 500);
                    }
                } else {
                    sendJsonResponse([
                        "error" => "Invalid data provided",
                        "required_fields" => ["product_id", "quantity"]
                    ], 400);
                }
            } catch (Exception $e) {
                logMessage("Error processing PUT request: " . $e->getMessage());
                sendJsonResponse([
                    "error" => "Failed to process request",
                    "debug_message" => $e->getMessage()
                ], 500);
            }
            break;

        default:
            sendJsonResponse(["error" => "Method not allowed"], 405);
            break;
    }
} catch (Exception $e) {
    logMessage("Critical error: " . $e->getMessage());
    sendJsonResponse([
        "error" => "Server error occurred",
        "debug_message" => $e->getMessage()
    ], 500);
}

if ($conn) {
    $conn->close();
}
?>