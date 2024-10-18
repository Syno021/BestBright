<?php
// CORS headers
header("Access-Control-Allow-Origin: http://localhost:8100");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
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
    die("Connection failed: " . $conn->connect_error);
}

// Get the posted data
$postdata = file_get_contents("php://input");
$request = json_decode($postdata);

if(isset($request->email) && isset($request->username) && isset($request->newPassword)) {
    $email = mysqli_real_escape_string($conn, trim($request->email));
    $username = mysqli_real_escape_string($conn, trim($request->username));
    $newPassword = password_hash(trim($request->newPassword), PASSWORD_DEFAULT);

    // First, verify the user
    $verify_sql = "SELECT * FROM users WHERE email='$email' AND username='$username'";
    $verify_result = $conn->query($verify_sql);

    if ($verify_result->num_rows > 0) {
        // User verified, proceed with password update
        $update_sql = "UPDATE users SET password_hash='$newPassword' WHERE email='$email' AND username='$username'";
        
        if ($conn->query($update_sql) === TRUE) {
            $response = ['status' => 1, 'message' => 'Password updated successfully.'];
        } else {
            $response = ['status' => 0, 'message' => 'Error updating password: ' . $conn->error];
        }
    } else {
        $response = ['status' => 0, 'message' => 'User not found.'];
    }
} else {
    $response = ['status' => 0, 'message' => 'Invalid input data.'];
}

echo json_encode($response);

$conn->close();
?>