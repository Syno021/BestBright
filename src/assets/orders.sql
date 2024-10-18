-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 18, 2024 at 12:29 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `best`
--

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `order_type` varchar(100) DEFAULT NULL,
  `status` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`order_id`, `user_id`, `total_amount`, `order_type`, `status`, `created_at`, `updated_at`) VALUES
(53, 7, 249.54, 'walk-in', 'order-processed', '2024-10-10 21:28:16', '2024-10-12 11:03:29'),
(54, 7, 529.00, 'walk-in', 'checked-out', '2024-10-12 11:08:30', '2024-10-12 11:08:30'),
(55, 7, 459.98, 'walk-in', 'checked-out', '2024-10-12 11:16:50', '2024-10-12 11:16:50'),
(56, 7, 517.44, 'walk-in', 'checked-out', '2024-10-12 11:18:05', '2024-10-12 11:18:05'),
(57, 7, 625.59, 'walk-in', 'checked-out', '2024-10-12 11:20:44', '2024-10-12 11:20:44'),
(58, 7, 460.00, 'walk-in', 'checked-out', '2024-10-12 11:21:17', '2024-10-12 11:21:17'),
(59, 7, 364.54, 'walk-in', 'checked-out', '2024-10-12 11:21:48', '2024-10-12 11:21:48'),
(60, 7, 1092.44, 'delivery', 'pending', '2024-10-12 11:24:07', '2024-10-12 11:25:19'),
(61, 7, 115.00, 'walk-in', 'checked-out', '2024-10-12 11:39:27', '2024-10-12 11:39:27'),
(62, 7, 1092.44, 'delivery', 'pending', '2024-10-12 12:32:05', '2024-10-12 12:32:05'),
(63, 7, 972.75, 'delivery', 'pending', '2024-10-12 15:05:21', '2024-10-12 15:05:21'),
(64, 7, 135.30, 'delivery', 'pending', '2024-10-13 10:47:02', '2024-10-13 10:47:02'),
(65, 7, 135.30, 'delivery', 'pending', '2024-10-13 10:53:58', '2024-10-13 10:53:58'),
(66, 7, 135.30, 'delivery', 'pending', '2024-10-13 10:59:07', '2024-10-13 10:59:07'),
(67, 7, 135.30, 'delivery', 'pending', '2024-10-13 10:59:51', '2024-10-13 10:59:51'),
(68, 7, 135.30, 'delivery', 'pending', '2024-10-13 11:11:51', '2024-10-13 11:11:51'),
(69, 7, 232.30, 'walk-in', 'checked-out', '2024-10-14 05:30:22', '2024-10-14 05:30:22'),
(70, 7, 99.44, 'delivery', 'pending', '2024-10-14 07:48:25', '2024-10-14 07:48:25'),
(71, 7, 242.68, 'delivery', 'pending', '2024-10-14 07:49:39', '2024-10-14 07:49:39'),
(72, 7, 1150.00, 'walk-in', 'shipped', '2024-10-17 14:31:45', '2024-10-18 08:05:23'),
(73, 7, 345.00, 'walk-in', 'checked-out', '2024-10-17 14:47:02', '2024-10-17 14:47:02'),
(74, 7, 575.00, 'walk-in', 'checked-out', '2024-10-17 14:47:40', '2024-10-17 14:47:40'),
(75, 7, 575.00, 'walk-in', 'checked-out', '2024-10-17 14:50:38', '2024-10-17 14:50:38'),
(76, 13, 240.09, 'delivery', 'delivered', '2024-10-17 19:00:53', '2024-10-18 08:37:25'),
(77, 25, 240.09, 'delivery', 'order-processed', '2024-10-18 08:55:20', '2024-10-18 10:10:39'),
(78, 25, 1202.12, 'delivery', 'shipped', '2024-10-18 08:58:53', '2024-10-18 09:25:43');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
