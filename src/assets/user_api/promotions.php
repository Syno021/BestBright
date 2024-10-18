<?php
// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 0);

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

try {
    $servername = "localhost";
    $username = "root";
    $password = "";
    $dbname = "best";

    // Create connection with error handling
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Check connection
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    $requestMethod = $_SERVER['REQUEST_METHOD'];

    switch($requestMethod) {
        case 'GET':
            // Get all promotions
            $sql = "SELECT p.*, GROUP_CONCAT(pp.product_id) as product_ids, 
                    GROUP_CONCAT(pr.name) as product_names 
                    FROM promotions p 
                    LEFT JOIN promotion_products pp ON p.promotion_id = pp.promotion_id
                    LEFT JOIN products pr ON pp.product_id = pr.product_id
                    GROUP BY p.promotion_id";
            $result = $conn->query($sql);
            
            if (!$result) {
                throw new Exception("Error executing query: " . $conn->error);
            }
            
            $promotions = [];
            while($row = $result->fetch_assoc()) {
                $row['product_ids'] = $row['product_ids'] ? explode(',', $row['product_ids']) : [];
                $row['product_names'] = $row['product_names'] ? explode(',', $row['product_names']) : [];
                $promotions[] = $row;
            }
            echo json_encode($promotions);
            break;

        case 'POST':
            $postdata = file_get_contents("php://input");
    if (!$postdata) {
        throw new Exception("No data received");
    }

    $request = json_decode($postdata);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON data received");
    }

    // Validate required fields
    if (!isset($request->product_ids) || !isset($request->name) || 
        !isset($request->discount_percentage) || !isset($request->start_date) || 
        !isset($request->end_date)) {
        throw new Exception("Missing required fields");
    }

    $name = mysqli_real_escape_string($conn, trim($request->name));
    $description = isset($request->description) ? 
                  mysqli_real_escape_string($conn, trim($request->description)) : '';
    $discount_percentage = (float)$request->discount_percentage;
    $start_date = mysqli_real_escape_string($conn, $request->start_date);
    $end_date = mysqli_real_escape_string($conn, $request->end_date);

    $conn->begin_transaction();

    try {
        // Insert promotion
        $sql = "INSERT INTO promotions (name, description, discount_percentage, start_date, end_date) 
                VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error);
        }

        $stmt->bind_param("ssdss", $name, $description, $discount_percentage, $start_date, $end_date);
        
        if (!$stmt->execute()) {
            throw new Exception("Execute failed: " . $stmt->error);
        }

        $promotion_id = $conn->insert_id;

        $stmt->close();

        // Insert product associations
        $sql = "INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error);
        }

        foreach ($request->product_ids as $product_id) {
            $stmt->bind_param("ii", $promotion_id, $product_id);
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
        }

        $stmt->close();

        $conn->commit();

        echo json_encode([
            'status' => 'success',
            'message' => 'Promotion added successfully',
            'id' => $promotion_id
        ]);
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
    
    break;


        case 'PUT':
            if (!isset($_GET['id'])) {
                throw new Exception("No promotion ID provided");
            }

            $postdata = file_get_contents("php://input");
            if (!$postdata) {
                throw new Exception("No data received");
            }

            $request = json_decode($postdata);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception("Invalid JSON data received");
            }

            $id = (int)$_GET['id'];
            $name = mysqli_real_escape_string($conn, trim($request->name));
            $description = isset($request->description) ? 
                          mysqli_real_escape_string($conn, trim($request->description)) : '';
            $discount_percentage = (float)$request->discount_percentage;
            $start_date = mysqli_real_escape_string($conn, $request->start_date);
            $end_date = mysqli_real_escape_string($conn, $request->end_date);

            $conn->begin_transaction();

            $sql = "UPDATE promotions SET 
                    name = ?, 
                    description = ?, 
                    discount_percentage = ?, 
                    start_date = ?, 
                    end_date = ? 
                    WHERE promotion_id = ?";
            
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }

            $stmt->bind_param("ssdssi", $name, $description, $discount_percentage, $start_date, $end_date, $id);
            
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }

            $stmt->close();

            // Delete existing product associations
            $sql = "DELETE FROM promotion_products WHERE promotion_id = ?";
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }
            $stmt->bind_param("i", $id);
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
            $stmt->close();

            // Insert new product associations
            $sql = "INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)";
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }

            foreach ($request->product_ids as $product_id) {
                $stmt->bind_param("ii", $id, $product_id);
                if (!$stmt->execute()) {
                    throw new Exception("Execute failed: " . $stmt->error);
                }
            }

            $stmt->close();

            $conn->commit();

            echo json_encode([
                'status' => 'success',
                'message' => 'Promotion updated successfully'
            ]);
            
            break;

        case 'DELETE':
            if (!isset($_GET['id'])) {
                throw new Exception("No promotion ID provided");
            }

            $id = (int)$_GET['id'];

            $conn->begin_transaction();

            // Delete product associations
            $sql = "DELETE FROM promotion_products WHERE promotion_id = ?";
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }
            $stmt->bind_param("i", $id);
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
            $stmt->close();

            // Delete promotion
            $sql = "DELETE FROM promotions WHERE promotion_id = ?";
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }
            $stmt->bind_param("i", $id);
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
            $stmt->close();

            $conn->commit();

            echo json_encode([
                'status' => 'success',
                'message' => 'Promotion deleted successfully'
            ]);
            
            break;

        default:
            throw new Exception("Unsupported request method");
    }

} catch (Exception $e) {
    // Return error as JSON
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>