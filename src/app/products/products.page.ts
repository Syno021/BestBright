import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ToastController, IonSearchbar } from '@ionic/angular';
import { CartService } from '../services/cart.service';
import { PromotionService } from '../services/promotion.service'; 
import { NavController } from '@ionic/angular';

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

  constructor(
    private http: HttpClient,
    private cartService: CartService,
    private navCtrl: NavController,
    private toastController: ToastController,
    private promotionService: PromotionService,
  ) {}

  ngOnInit() {
    this.loadProducts();
    this.getUserId();
    this.loadPromotions();
  }

  getUserId() {
    this.userId = sessionStorage.getItem('userId');
    if (!this.userId) {
      console.warn('User is not logged in');
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

  roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  extractCategories() {
    this.categories = ['All', ...new Set(this.products.map(product => product.category))];
  }

  rateProduct(product: Product, rating: number) {
    const updatedProduct = { ...product };
    const newTotalRatings = updatedProduct.total_ratings + 1;
    const newAverage_rating = ((updatedProduct.average_rating * updatedProduct.total_ratings) + rating) / newTotalRatings;

    this.http.post(`http://localhost/user_api/rate_product.php`, {
      product_id: product.product_id,
      rating: rating
    }).subscribe({
      next: (response) => {
        updatedProduct.total_ratings = newTotalRatings;
        updatedProduct.average_rating = newAverage_rating;
        this.products = this.products.map(p => p.product_id === updatedProduct.product_id ? updatedProduct : p);
        this.applyFilters();
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error rating product:', error);
      }
    });
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
    const searchTerm = this.searchbar?.value?.toLowerCase() || '';

    this.filteredProducts = this.products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm);
      const matchesCategory = this.selectedCategory === 'All' || product.category === this.selectedCategory;
      const hasStock = product.stock_quantity > 0;

      return matchesSearch || (hasStock && matchesCategory);
    });

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

  async addToCart(product: Product) {
    if (!this.userId) {
      const toast = await this.toastController.create({
        message: 'Please log in to add items to your cart',
        duration: 2000,
        position: 'bottom',
        color: 'warning'
      });
      toast.present();
      return;
    }

    if (!product.quantity || product.quantity < 1) {
      product.quantity = 1;
    }
  
    this.cartService.addToCart(product);
    
    const payload = {
      user_id: this.userId,
      product_id: product.product_id,
      quantity: product.quantity
    };
  
    console.log('Sending request to add to cart:', payload);
  
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
  
    try {
      const response: any = await this.http.post('http://localhost/user_api/cart.php', payload, { headers, observe: 'response' }).toPromise();
      
      console.log('Full response:', response);
      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      console.log('Product added to cart successfully');
  
      const toast = await this.toastController.create({
        message: `${product.quantity} ${product.name}(s) added to cart`,
        duration: 2000,
        position: 'bottom',
      });
      toast.present();
  
      product.quantity = 1;
    } catch (error: any) {
      console.error('Error adding product to cart:', error);
      if (error.error instanceof ErrorEvent) {
        console.error('An error occurred:', error.error.message);
      } else {
        console.error(`Backend returned code ${error.status}, body was:`, error.error);
      }
      
      const errorToast = await this.toastController.create({
        message: 'Error adding product to cart. Please try again.',
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      errorToast.present();
    }
  }

  navigateToCart() {
    this.navCtrl.navigateForward('/cart');
  }
}