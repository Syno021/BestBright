<?php
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

elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getProductMovement') {
    // Get the current date and 30 days ago
    $currentDate = date('Y-m-d');
    $thirtyDaysAgo = date('Y-m-d', strtotime('-30 days'));

    // Query to get product movement data
    $sql = "SELECT p.product_id, p.name, p.category, p.stock_quantity,
                   tpq.quantity_out,
                   DATE(tpq.created_at) as sale_date
            FROM products p
            LEFT JOIN track_product_quantity tpq ON p.product_id = tpq.product_id
            WHERE tpq.created_at BETWEEN '$thirtyDaysAgo' AND '$currentDate'
            ORDER BY p.product_id, tpq.created_at";

    $result = $conn->query($sql);

    $productMovement = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $productId = $row['product_id'];
            if (!isset($productMovement[$productId])) {
                $productMovement[$productId] = [
                    'product_id' => $productId,
                    'name' => $row['name'],
                    'category' => $row['category'],
                    'stock_quantity' => $row['stock_quantity'],
                    'total_quantity_out' => 0,
                    'daily_movement' => [],
                    'weekly_movement' => array_fill(0, 4, 0),
                    'monthly_movement' => 0
                ];
            }
            
            $productMovement[$productId]['total_quantity_out'] += $row['quantity_out'];
            $productMovement[$productId]['daily_movement'][$row['sale_date']] = ($productMovement[$productId]['daily_movement'][$row['sale_date']] ?? 0) + $row['quantity_out'];
            
            $weekNumber = floor((strtotime($currentDate) - strtotime($row['sale_date'])) / (7 * 24 * 60 * 60));
            if ($weekNumber < 4) {
                $productMovement[$productId]['weekly_movement'][$weekNumber] += $row['quantity_out'];
            }
        }

        // Calculate monthly movement (total for 30 days)
        foreach ($productMovement as &$product) {
            $product['monthly_movement'] = $product['total_quantity_out'];
        }
    }

    // Sort products by total_quantity_out to determine fast and slow moving
    usort($productMovement, function($a, $b) {
        return $b['total_quantity_out'] - $a['total_quantity_out'];
    });

    // Separate into fast and slow moving (top and bottom 10)
    $fastMoving = array_slice($productMovement, 0, 10);
    $slowMoving = array_slice($productMovement, -10);

    sendJsonResponse([
        'fastMoving' => $fastMoving,
        'slowMoving' => $slowMoving
    ]);
}
$conn->close();
?>