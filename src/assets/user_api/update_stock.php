<?php
//update_stock.php
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

function analyzeStockMovement($conn, $product_id) {
    // Get the last 30 days of movement data
    $sql = "SELECT 
        p.stock_quantity as current_stock,
        p.name as product_name,
        COALESCE(SUM(CASE 
            WHEN tpm.movement_type = 'OUT' 
            AND tpm.movement_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
            THEN tpm.quantity_moved 
            ELSE 0 
        END), 0) as total_outward,
        COALESCE(
            (SELECT stock_quantity + COALESCE(SUM(CASE 
                WHEN movement_type = 'OUT' THEN quantity_moved
                ELSE -quantity_moved 
            END), 0)
            FROM track_product_movements 
            WHERE product_id = p.product_id 
            AND movement_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
            GROUP BY product_id), p.stock_quantity
        ) as initial_stock
    FROM products p
    LEFT JOIN track_product_movements tpm ON p.product_id = tpm.product_id
    WHERE p.product_id = ?
    GROUP BY p.product_id";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $data = $result->fetch_assoc();

    if (!$data) {
        return [
            'movement_category' => 'unknown',
            'consumption_rate' => 0,
            'days_to_depletion' => null
        ];
    }

    $initial_stock = $data['initial_stock'];
    $current_stock = $data['current_stock'];
    $total_outward = $data['total_outward'];

    // Calculate consumption rate as percentage of initial stock consumed
    $consumption_rate = $initial_stock > 0 ? ($total_outward / $initial_stock) * 100 : 0;

    // Determine movement category
    $movement_category = '';
    if ($current_stock == 0 || $consumption_rate >= 75) {
        $movement_category = 'fast';
    } elseif ($consumption_rate >= 40) {
        $movement_category = 'moderate';
    } else {
        $movement_category = 'slow';
    }

    // Calculate estimated days until depletion based on daily consumption rate
    $daily_consumption = $total_outward / 30;
    $days_to_depletion = $daily_consumption > 0 ? ceil($current_stock / $daily_consumption) : null;

    return [
        'movement_category' => $movement_category,
        'consumption_rate' => round($consumption_rate, 2),
        'days_to_depletion' => $days_to_depletion,
        'initial_stock' => $initial_stock,
        'total_outward' => $total_outward
    ];
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
                            // Get all movement history
                            $sql = "SELECT 
                                tpm.movement_id,
                                tpm.product_id,
                                p.name as product_name,
                                p.category,
                                p.stock_quantity as current_stock,
                                tpm.quantity_moved,
                                tpm.movement_type,
                                tpm.movement_date,
                                tpm.created_at,
                                tpm.notes
                            FROM track_product_movements tpm
                            LEFT JOIN products p ON tpm.product_id = p.product_id
                            ORDER BY tpm.movement_date DESC, tpm.created_at DESC";
                            
                            $result = $conn->query($sql);
                            
                            if ($result === false) {
                                throw new Exception("Query failed: " . $conn->error);
                            }
                            
                            $movementHistory = [];
                            while ($row = $result->fetch_assoc()) {
                                $movementHistory[] = [
                                    'movement_id' => (int)$row['movement_id'],
                                    'product_id' => (int)$row['product_id'],
                                    'product_name' => $row['product_name'] ?? 'Unknown',
                                    'category' => $row['category'] ?? 'Uncategorized',
                                    'quantity_moved' => (int)$row['quantity_moved'],
                                    'movement_type' => $row['movement_type'],
                                    'current_stock' => (int)$row['current_stock'],
                                    'movement_date' => $row['movement_date'],
                                    'created_at' => $row['created_at'],
                                    'notes' => $row['notes']
                                ];
                            }
                            
                            sendJsonResponse($movementHistory);
                        } catch (Exception $e) {
                            logMessage("Error in getTrackProductQuantity: " . $e->getMessage());
                            sendJsonResponse([
                                "error" => "Failed to fetch movement history",
                                "debug_message" => $e->getMessage()
                            ], 500);
                        }
                        break;

                    case 'getStockAnalysis':
                        try {
                            $product_id = isset($_GET['product_id']) ? (int)$_GET['product_id'] : null;
                            
                            if ($product_id) {
                                $analysis = analyzeStockMovement($conn, $product_id);
                                sendJsonResponse($analysis);
                            } else {
                                // Get analysis for all products
                                $sql = "SELECT product_id FROM products";
                                $result = $conn->query($sql);
                                $analyses = [];
                                
                                while ($row = $result->fetch_assoc()) {
                                    $product_id = $row['product_id'];
                                    $analyses[$product_id] = analyzeStockMovement($conn, $product_id);
                                }
                                
                                sendJsonResponse($analyses);
                            }
                        } catch (Exception $e) {
                            logMessage("Error in getStockAnalysis: " . $e->getMessage());
                            sendJsonResponse([
                                "error" => "Failed to analyze stock movement",
                                "debug_message" => $e->getMessage()
                            ], 500);
                        }
                        break;
                        
                    default:
                        sendJsonResponse(["error" => "Invalid action specified"], 400);
                        break;
                }
            }
            break;
    
        case 'PUT':
            try {
                $rawData = file_get_contents("php://input");
                $data = json_decode($rawData);
    
                if (!empty($data->product_id) && isset($data->quantity)) {
                    $product_id = $conn->real_escape_string($data->product_id);
                    $new_quantity = $conn->real_escape_string($data->quantity);
                    $notes = $conn->real_escape_string($data->notes ?? '');
    
                    $conn->begin_transaction();
    
                    try {
                        // Get current stock quantity
                        $stmt = $conn->prepare("SELECT stock_quantity FROM products WHERE product_id = ?");
                        $stmt->bind_param("i", $product_id);
                        $stmt->execute();
                        $result = $stmt->get_result();
                        
                        if ($result->num_rows === 0) {
                            throw new Exception("Product not found");
                        }
                        
                        $row = $result->fetch_assoc();
                        $current_quantity = $row['stock_quantity'];
                        $stmt->close();
    
                        // Calculate quantity moved and movement type
                        $quantity_moved = abs($current_quantity - $new_quantity);
                        $movement_type = $current_quantity > $new_quantity ? 'OUT' : 'IN';
    
                        // Update products table
                        $stmt = $conn->prepare("UPDATE products SET stock_quantity = ? WHERE product_id = ?");
                        $stmt->bind_param("ii", $new_quantity, $product_id);
                        
                        if (!$stmt->execute()) {
                            throw new Exception("Failed to update product stock");
                        }
                        $stmt->close();
    
                        // Insert movement record
                        $stmt = $conn->prepare("INSERT INTO track_product_movements 
                            (product_id, quantity_moved, movement_type, movement_date, notes) 
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)");
                        $stmt->bind_param("iiss", $product_id, $quantity_moved, $movement_type, $notes);
                        
                        if (!$stmt->execute()) {
                            throw new Exception("Failed to record movement");
                        }
                        
                        $conn->commit();
    
                        sendJsonResponse([
                            "message" => "Stock movement recorded successfully",
                            "details" => [
                                "product_id" => $product_id,
                                "previous_quantity" => $current_quantity,
                                "new_quantity" => $new_quantity,
                                "quantity_moved" => $quantity_moved,
                                "movement_type" => $movement_type
                            ]
                        ]);
                    } catch (Exception $e) {
                        $conn->rollback();
                        throw $e;
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