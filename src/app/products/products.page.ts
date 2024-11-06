import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ToastController, IonSearchbar } from '@ionic/angular';
import { CartService } from '../services/cart.service';
import { PromotionService } from '../services/promotion.service'; 
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';

interface Product {
  product_id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  total_ratings: number;
  average_rating: number;
  isSale?: boolean;
  category: string;
  image_url: string;
  quantity: number;
  stock_quantity: number;
  hasPromotion?: boolean;
  promotionName?: string;
  discountedPrice?: number;
}

interface Promotion {
  promotion_id: number;
  name: string;
  description: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  product_ids: number[];
  product_names: string[];
}

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
})
export class ProductsPage implements OnInit {
  @ViewChild(IonSearchbar) searchbar!: IonSearchbar;

  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = ['All'];
  selectedCategory: string = 'All';
  sortOption: string = 'name';
  userId: string | null = null;
  promotions: Promotion[] = [];

  searchQuery: string = '';
  constructor(
    private http: HttpClient,
    private cartService: CartService,
    private navCtrl: NavController,
    private toastController: ToastController,
    private promotionService: PromotionService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadProducts();
    this.getUserId();
    this.loadPromotions();
  }

  async addToCart(product: Product) {
    if (!product.quantity || product.quantity < 1) {
      product.quantity = 1;
    }
  
    // Create cart item from product with proper price tracking
    const cartItem = {
      product_id: product.product_id,
      name: product.name,
      price: product.price, // Keep the original price as is
      originalPrice: product.price,
      discountedPrice: product.hasPromotion ? product.discountedPrice : product.price,
      quantity: product.quantity,
      image_url: product.image_url,
      hasPromotion: product.hasPromotion,
      promotionName: product.promotionName,
      discountPercentage: product.hasPromotion ? 
        ((product.price - (product.discountedPrice || 0)) / product.price) * 100 : 0
    };
  
    console.log('Adding to cart:', cartItem); // Debug log
  
    try {
      await this.cartService.addToCart(cartItem).toPromise();
  
      const toast = await this.toastController.create({
        message: `${product.quantity} ${product.name}(s) added to cart${
          product.hasPromotion ? ' with ' + product.promotionName + ' discount!' : ''
        }`,
        duration: 2000,
        position: 'bottom',
        color: product.hasPromotion ? 'success' : 'primary'
      });
      toast.present();
  
      product.quantity = 1;
    } catch (error) {
      console.error('Error adding product to cart:', error);
      
      const errorToast = await this.toastController.create({
        message: 'Error adding product to cart. Please try again.',
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      errorToast.present();
    }
  }

  loadProducts() {
    this.http.get<Product[]>('http://localhost/user_api/products.php').subscribe({
      next: (data: Product[]) => {
        this.products = data.map(product => ({ ...product, quantity: 1 }));
        this.filteredProducts = this.products;
        this.applyFilters();
        this.extractCategories();
        this.applyPromotions();
        console.log('Products loaded:', this.products);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error loading products:', error);
      }
    });
  }

  loadPromotions() {
    this.promotionService.getPromotions().subscribe({
      next: (promotions: Promotion[]) => {
        this.promotions = promotions;
        this.applyPromotions();
      },
      error: (error) => {
        console.error('Error loading promotions:', error);
      }
    });
  }

  fetchPromotions() {
    this.http.get<Promotion[]>('http://localhost/user_api/promotions.php')
      .subscribe(
        (response) => {
          this.promotions = response;
        },
        (error) => {
          console.error('Error fetching promotions:', error);
        }
      );
  }

  applyPromotions() {
    this.products.forEach(product => {
      const promotion = this.promotions.find(p => p.product_ids.includes(product.product_id));
      if (promotion) {
        const discountAmount = product.price * (promotion.discount_percentage / 100);
        product.discountedPrice = this.roundToTwo(product.price - discountAmount);
        product.hasPromotion = true;
        product.promotionName = promotion.name;
      } else {
        product.discountedPrice = product.price;
        product.hasPromotion = false;
        product.promotionName = undefined;
      }
    });
    this.applyFilters();
  }

  searchProducts() {
    this.applyFilters();
  }

  filterByCategory(category: string) {
    this.selectedCategory = category;
    this.applyFilters();
  }

  sortProducts(option: string) {
    this.sortOption = option;
    this.applyFilters();
  }

  applyFilters() {
    const searchTerm = this.searchQuery.toLowerCase();
    const selectedCategoryLower = this.selectedCategory.toLowerCase();
  
    this.filteredProducts = this.products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm);
      const matchesCategory = 
        this.selectedCategory === 'All' || 
        product.category.toLowerCase() === selectedCategoryLower;
      const hasStock = product.stock_quantity > 0;
  
      return matchesSearch && matchesCategory && hasStock;
    });
  
    // Sorting logic remains the same
    switch (this.sortOption) {
      case 'name':
        this.filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price_low_high':
        this.filteredProducts.sort((a, b) => (a.discountedPrice || a.price) - (b.discountedPrice || b.price));
        break;
      case 'price_high_low':
        this.filteredProducts.sort((a, b) => (b.discountedPrice || b.price) - (a.discountedPrice || a.price));
        break;
      case 'rating':
        this.filteredProducts.sort((a, b) => b.average_rating - a.average_rating);
        break;
    }
  }

  getUserId() {
    this.userId = sessionStorage.getItem('userId');
    if (!this.userId) {
      console.warn('User is not logged in');
    }
  }

  viewAccount() {
    this.router.navigate(['/account']);
    console.log('Navigating to account page');
    // Add navigation logic here
  }

  

  roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  extractCategories() {
    // Create a map to store normalized categories
    const categoryMap = new Map<string, string>();
    
    // Get all categories and normalize them
    this.products.forEach(product => {
      const normalizedCategory = product.category.toLowerCase().trim();
      // If this normalized category isn't in our map, add it
      // We store the first occurrence's original case as the display version
      if (!categoryMap.has(normalizedCategory)) {
        categoryMap.set(normalizedCategory, product.category);
      }
    });
  
    // Convert map values to array and add 'All' at the beginning
    this.categories = ['All', ...Array.from(categoryMap.values())];
  }

  increaseQuantity(product: Product) {
    if (product.quantity) {
      product.quantity++;
    } else {
      product.quantity = 1;
    }
  }

  decreaseQuantity(product: Product) {
    if (product.quantity && product.quantity > 1) {
      product.quantity--;
    } else {
      product.quantity = 1;
    }
  }

  

  navigateToCart() {
    this.navCtrl.navigateForward('/cart');
  }

  // Optional: Add a method to check if a product is in cart
  async isInCart(productId: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.cartService.getCart().subscribe(items => {
        resolve(items.some(item => item.product_id === productId));
      });
    });
  }

}