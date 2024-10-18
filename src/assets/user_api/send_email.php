<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
session_start();

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Log function
function logError($message) {
    error_log(date('[Y-m-d H:i:s] ') . $message . PHP_EOL, 3, 'email_errors.log');
}

$subject = $_POST['subject'] ?? '';
$email = $_POST['recipient'] ?? '';
$body = $_POST['body'] ?? '';

if (empty($subject) || empty($email) || empty($body)) {
    logError("Missing required fields");
    echo json_encode(["error" => "Missing required fields"]);
    exit;
}

// Include required PHPMailer files
require 'PHPMailer.php';
require 'SMTP.php';
require 'Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true); // Enable exceptions

try {
    $mail->isSMTP();
    $mail->Host = "smtp.gmail.com";
    $mail->SMTPAuth = true;
    $mail->SMTPSecure = "tls";
    $mail->Port = "587";
    $mail->Username = "nkomon917@gmail.com"; 
    $mail->Password = "rzklsncmscoblhqv"; 
    $mail->setFrom('nkomon917@gmail.com');
    $mail->addAddress($email);
    $mail->Subject = $subject;
    $mail->isHTML(true);
    $mail->Body = "<p>$body</p>";

    // Check if a file was uploaded
    if (isset($_FILES['pdf']['tmp_name']) && !empty($_FILES['pdf']['tmp_name'])) {
        $fileContent = file_get_contents($_FILES['pdf']['tmp_name']);
        $fileName = $_FILES['pdf']['name'];
        $mail->addStringAttachment($fileContent, $fileName, 'base64', 'application/pdf');
    } else {
        logError("No PDF file received or file is empty.");
    }

    // Send the email
    if ($mail->send()) {
        $response = ["message" => "Email sent successfully!!!"];
        logError("Email sent successfully to: " . $email);
    } else {
        throw new Exception($mail->ErrorInfo);
    }
} catch (Exception $e) {
    logError("Mailer Error: " . $e->getMessage());
    $response = ["error" => "Mailer Error: " . $e->getMessage()];
}

header('Content-Type: application/json');
echo json_encode($response);