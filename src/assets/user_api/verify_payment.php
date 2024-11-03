<?php
// CORS and Headers
header("Access-Control-Allow-Origin: http://localhost:8100");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database Connection Class
class Database {
    private $host = "localhost";
    private $db_name = "best";
    private $username = "root";
    private $password = "";
    public $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            // Set a reasonable timeout for transactions
            $this->conn->exec("SET SESSION innodb_lock_wait_timeout=50");
            // Set transaction isolation level to prevent dirty reads
            $this->conn->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
        } catch(PDOException $exception) {
            throw new Exception("Connection error: " . $exception->getMessage());
        }

        return $this->conn;
    }
}

// Logging function with more detail
function logMessage($message, $context = []) {
    $logEntry = date('[Y-m-d H:i:s] ') . $message;
    if (!empty($context)) {
        $logEntry .= ' Context: ' . json_encode($context);
    }
    file_put_contents('debug.log', $logEntry . PHP_EOL, FILE_APPEND);
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array("success" => false, "message" => "Method not allowed"));
    exit();
}

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (!isset($data->order_id)) {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "Missing required order_id parameter"));
    exit();
}

try {
    // Initialize Database Connection
    $database = new Database();
    $db = $database->getConnection();
    
    // Use a single PDO connection for both tables to maintain transaction consistency
    $order_id = $data->order_id;
    
    // First, check if the order exists and get its status with row locking
    $order_query = "SELECT total_amount, user_id, status FROM orders WHERE order_id = :order_id FOR UPDATE";
    
    // Set a retry count for deadlock situations
    $maxRetries = 3;
    $retryCount = 0;
    $success = false;
    
    while (!$success && $retryCount < $maxRetries) {
        try {
            $db->beginTransaction();
            
            // Get order details with lock
            $stmt = $db->prepare($order_query);
            $stmt->bindParam(":order_id", $order_id);
            $stmt->execute();
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$order) {
                throw new Exception("Order not found");
            }
            
            // Check if order is already processed
            if ($order['status'] === 'processing' || $order['status'] === 'completed') {
                throw new Exception("Order has already been processed");
            }
            
            // Update order status
            $update_query = "UPDATE orders SET 
                            status = :status,
                            updated_at = NOW()
                         WHERE order_id = :order_id";
            
            $stmt = $db->prepare($update_query);
            $status = "checked-out";
            $stmt->bindParam(":status", $status);
            $stmt->bindParam(":order_id", $order_id);
            
            if (!$stmt->execute()) {
                throw new Exception("Failed to update order status");
            }
            
            // Insert into sales table using the same PDO connection
            $sales_sql = "INSERT INTO sales (
                order_id, 
                cashier_id, 
                total_amount, 
                payment_method, 
                amount_paid
            ) VALUES (
                :order_id,
                :cashier_id,
                :total_amount,
                :payment_method,
                :amount_paid
            )";
            
            $stmt_sales = $db->prepare($sales_sql);
            
            $payment_method = "online";
            $amount_paid = $order['total_amount'];
            
            $stmt_sales->bindParam(":order_id", $order_id);
            $stmt_sales->bindParam(":cashier_id", $order['user_id']);
            $stmt_sales->bindParam(":total_amount", $order['total_amount']);
            $stmt_sales->bindParam(":payment_method", $payment_method);
            $stmt_sales->bindParam(":amount_paid", $amount_paid);
            
            if (!$stmt_sales->execute()) {
                throw new Exception("Failed to insert sales record");
            }
            
            $sale_id = $db->lastInsertId();
            
            // If we get here, commit the transaction
            $db->commit();
            $success = true;
            
            // Return success response
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "Order processed successfully",
                "data" => array(
                    "order_id" => $order_id,
                    "sale_id" => $sale_id,
                    "amount" => $amount_paid,
                    "status" => $status
                )
            ));
            
        } catch (PDOException $e) {
            $db->rollBack();
            
            // Log the error with context
            logMessage("Transaction failed", [
                "retry_count" => $retryCount,
                "error" => $e->getMessage(),
                "order_id" => $order_id
            ]);
            
            // Only retry on deadlock or lock timeout
            if (stripos($e->getMessage(), 'deadlock') !== false || 
                stripos($e->getMessage(), 'lock timeout') !== false) {
                $retryCount++;
                // Add a small delay before retrying
                usleep(rand(10000, 50000)); // 10-50ms random delay
                continue;
            }
            
            // For other database errors, throw immediately
            throw $e;
        }
    }
    
    // If we've exhausted our retries, throw an exception
    if (!$success) {
        throw new Exception("Maximum retry attempts exceeded for processing order");
    }
    
} catch (Exception $e) {
    logMessage("Error processing order", [
        "error" => $e->getMessage(),
        "order_id" => $order_id ?? null
    ]);
    
    http_response_code(500);
    echo json_encode(array(
        "success" => false,
        "message" => "Error processing order: " . $e->getMessage()
    ));
}
?>