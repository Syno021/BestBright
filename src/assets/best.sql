-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 18, 2024 at 12:46 PM
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
-- Table structure for table `cart`
--

CREATE TABLE `cart` (
  `cart_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cart`
--

INSERT INTO `cart` (`cart_id`, `user_id`, `product_id`, `quantity`, `added_at`) VALUES
(8, 2, 2, 15, '2024-09-28 12:17:30'),
(9, 2, 3, 11, '2024-09-28 12:17:48'),
(42, 13, 4, 1, '2024-10-17 19:05:34'),
(43, 13, 2, 1, '2024-10-17 19:45:31');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`category_id`, `name`, `created_at`, `updated_at`) VALUES
(2, 'Liquids', '2024-10-01 15:00:38', '2024-10-01 15:00:38'),
(3, 'Powders', '2024-10-01 15:03:02', '2024-10-01 15:03:02'),
(4, 'Cleaning detergents', '2024-10-01 15:03:12', '2024-10-01 15:03:12');

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

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `order_item_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `price_per_unit` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`order_item_id`, `order_id`, `product_id`, `quantity`, `price_per_unit`) VALUES
(204, 72, 4, 10, 100.00),
(205, 73, 4, 3, 100.00),
(206, 74, 4, 5, 100.00),
(207, 75, 4, 5, 100.00),
(208, 76, 2, 1, 89.99),
(209, 76, 3, 1, 120.00),
(210, 76, 7, 1, 7.00),
(211, 77, 2, 1, 89.99),
(212, 77, 3, 1, 120.00),
(213, 77, 7, 1, 7.00),
(214, 78, 2, 7, 89.99),
(215, 78, 3, 3, 120.00),
(216, 78, 4, 1, 100.00);

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `stock_quantity` int(11) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `barcode` varchar(50) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `total_ratings` int(11) DEFAULT 0,
  `average_rating` decimal(3,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`product_id`, `name`, `description`, `price`, `stock_quantity`, `category`, `barcode`, `image_url`, `total_ratings`, `average_rating`, `created_at`, `updated_at`) VALUES
(2, 'domestos(800ml)', 'for washing dishing and more', 89.99, 106, 'liquids', '111222', 'https://firebasestorage.googleapis.com/v0/b/new-99e13.appspot.com/o/product_images%2F1727256247725_iekudi.jpg?alt=media&token=9ce7d9be-5ea7-4710-a188-590f0924b931', 0, 0.00, '2024-09-25 09:24:16', '2024-10-18 10:10:39'),
(3, 'cleaner(250ml)', 'welele', 120.00, 88, 'liquids', '332211', 'https://firebasestorage.googleapis.com/v0/b/new-99e13.appspot.com/o/product_images%2F1727359876733_y1lzzh.jpg?alt=media&token=c50f1c47-b6a4-4f44-b275-aac9f32eedf7', 0, 0.00, '2024-09-26 14:11:24', '2024-10-18 10:10:39'),
(4, 'washing Powder(500ml)', 'kudshcvuisdhv', 100.00, 65, 'Powders', '112200', 'https://firebasestorage.googleapis.com/v0/b/new-99e13.appspot.com/o/product_images%2F1727795092260_1dnxqo.jpg?alt=media&token=931bd902-e6b4-4fe4-b832-982e32e3ced7', 0, 0.00, '2024-10-01 15:04:59', '2024-10-17 14:50:38'),
(7, 'meme(201ml)', 'aaaaaa', 7.00, 14, 'Liquids', '54655', 'https://firebasestorage.googleapis.com/v0/b/new-99e13.appspot.com/o/product_images%2F1728321953348_51002f.jpg?alt=media&token=dd8cc46e-1a44-4d4a-84d0-5024fed9ac08', 0, 0.00, '2024-10-07 17:26:00', '2024-10-18 10:10:39');

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

CREATE TABLE `promotions` (
  `promotion_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `discount_percentage` decimal(5,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `promotions`
--

INSERT INTO `promotions` (`promotion_id`, `name`, `description`, `discount_percentage`, `start_date`, `end_date`) VALUES
(1, '20', '', 22.00, '2024-10-17', '2024-10-17'),
(2, '30off', '', 30.00, '2024-10-16', '2024-10-19'),
(3, '45off', '', 45.00, '2024-10-17', '2024-10-19');

-- --------------------------------------------------------

--
-- Table structure for table `promotion_products`
--

CREATE TABLE `promotion_products` (
  `promotion_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `promotion_products`
--

INSERT INTO `promotion_products` (`promotion_id`, `product_id`) VALUES
(2, 2),
(2, 3),
(3, 4);

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `sale_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `cashier_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','card','online') NOT NULL,
  `sale_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `amount_paid` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`sale_id`, `order_id`, `cashier_id`, `total_amount`, `payment_method`, `sale_date`, `amount_paid`) VALUES
(14, 53, 7, 249.54, 'cash', '2024-10-10 21:28:16', 500.00),
(15, 54, 7, 529.00, 'cash', '2024-10-12 11:08:30', 600.00),
(16, 55, 7, 459.98, 'cash', '2024-10-12 11:16:50', 620.00),
(17, 56, 7, 517.44, 'cash', '2024-10-12 11:18:06', 550.00),
(18, 57, 7, 625.59, 'cash', '2024-10-12 11:20:44', 650.00),
(19, 58, 7, 460.00, 'cash', '2024-10-12 11:21:17', 500.00),
(20, 59, 7, 364.54, 'cash', '2024-10-12 11:21:49', 400.00),
(21, 61, 7, 115.00, 'card', '2024-10-12 11:39:27', 115.00),
(22, 69, 7, 232.30, 'card', '2024-10-14 05:30:22', 232.30),
(23, 72, 7, 1150.00, 'card', '2024-10-17 14:31:46', 1150.00),
(24, 73, 7, 345.00, 'card', '2024-10-17 14:47:02', 345.00),
(25, 74, 7, 575.00, 'card', '2024-10-17 14:47:40', 575.00),
(26, 75, 7, 575.00, 'card', '2024-10-17 14:50:38', 575.00);

-- --------------------------------------------------------

--
-- Table structure for table `track_product_quantity`
--

CREATE TABLE `track_product_quantity` (
  `id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity_out` int(11) NOT NULL DEFAULT 0,
  `last_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `track_product_quantity`
--

INSERT INTO `track_product_quantity` (`id`, `product_id`, `quantity_out`, `last_updated`) VALUES
(1, 4, 8, '2024-10-17 14:50:38');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `role` enum('customer','admin','cashier') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `created_at`, `updated_at`) VALUES
(2, 'Zimama', 'nkulu@gmail.com', '$2y$10$F0GPZlsE4KKBAFpjn6QuwuChABCOBz6DArVJv2PRaWwNGKBaM4P3q', 'Simon', 'Ntuli', 'customer', '2024-09-12 18:10:06', '2024-09-12 18:10:06'),
(7, 'Mlilo', 'lilonkemfithi@gmail.com', '$2y$10$tav5pZO4FyePWHVRPuWqpeXmH269Ei.8V0NaO69bWSBO8UT4y.XRe', 'lilonko', 'mfithi', 'customer', '2024-09-25 07:39:22', '2024-10-14 06:20:06'),
(13, 'admin9483', 'nkomon917@gmail.com', '$2y$10$w3GpTwrV9fkelNY9jAv1/.XOu2wnQNzcKygzbVxem62GPJJSPonv2', 'Nkululeko', 'Nkomo', 'admin', '2024-10-06 11:10:15', '2024-10-06 11:10:15'),
(14, 'cashier2629', 'patience@gmail.com', '$2y$10$cFlbj6wCfikhWsvRZgOuleqUBxM4Wp8jBLml0SwKhKZvnr4I2ZA8q', 'Marasha', 'Moabi', 'cashier', '2024-10-07 10:28:48', '2024-10-07 10:28:48'),
(24, 'cashier5233', 'nkulutwntywon@gmail.com', '$2y$10$U9HfXDbZ1hyx4vWtFDSKAugjfFqj9LviCLdQE2Q6HNlhGWjXwnJ/.', 'wwww', 'zzzz', 'cashier', '2024-10-18 08:13:19', '2024-10-18 08:13:19'),
(25, 'gwala10', 'khilanijabu7@gmail.com', '$2y$10$cz85IDqdGCX112EPVRAaPe7N.PYH2agwKP.upAUyMVxSJQOvCAUkO', 'jabu', 'gwala', 'customer', '2024-10-18 08:53:19', '2024-10-18 08:53:19');

-- --------------------------------------------------------

--
-- Table structure for table `user_addresses`
--

CREATE TABLE `user_addresses` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `address_line1` varchar(255) NOT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) NOT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_addresses`
--

INSERT INTO `user_addresses` (`id`, `user_id`, `address_line1`, `address_line2`, `city`, `province`, `postal_code`, `country`, `created_at`) VALUES
(7, 7, 'dgdssds', 'LKLJ', 'pietermaritzburg', 'KZN', '3201', 'South Africa', '2024-10-13 13:31:19');

-- --------------------------------------------------------

--
-- Table structure for table `user_ratings`
--

CREATE TABLE `user_ratings` (
  `rating_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` between 1 and 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cart`
--
ALTER TABLE `cart`
  ADD PRIMARY KEY (`cart_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`order_item_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`);

--
-- Indexes for table `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`promotion_id`);

--
-- Indexes for table `promotion_products`
--
ALTER TABLE `promotion_products`
  ADD PRIMARY KEY (`promotion_id`,`product_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`sale_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `cashier_id` (`cashier_id`);

--
-- Indexes for table `track_product_quantity`
--
ALTER TABLE `track_product_quantity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_addresses`
--
ALTER TABLE `user_addresses`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user_ratings`
--
ALTER TABLE `user_ratings`
  ADD PRIMARY KEY (`rating_id`),
  ADD UNIQUE KEY `user_id` (`user_id`,`product_id`),
  ADD KEY `product_id` (`product_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `cart`
--
ALTER TABLE `cart`
  MODIFY `cart_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `order_item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=217;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `product_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `promotions`
--
ALTER TABLE `promotions`
  MODIFY `promotion_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `sale_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `track_product_quantity`
--
ALTER TABLE `track_product_quantity`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `user_addresses`
--
ALTER TABLE `user_addresses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `user_ratings`
--
ALTER TABLE `user_ratings`
  MODIFY `rating_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `cart`
--
ALTER TABLE `cart`
  ADD CONSTRAINT `cart_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `cart_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `promotion_products`
--
ALTER TABLE `promotion_products`
  ADD CONSTRAINT `promotion_products_ibfk_1` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`promotion_id`),
  ADD CONSTRAINT `promotion_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  ADD CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `track_product_quantity`
--
ALTER TABLE `track_product_quantity`
  ADD CONSTRAINT `track_product_quantity_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `user_ratings`
--
ALTER TABLE `user_ratings`
  ADD CONSTRAINT `user_ratings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `user_ratings_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
