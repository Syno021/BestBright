import { Component, OnInit, ViewChild } from '@angular/core';
import { IonModal } from '@ionic/angular';
import { MenuController, NavController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { PromotionService } from '../services/promotion.service'; 
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

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

@Component({
  selector: 'app-promotions',
  templateUrl: './promotions.page.html',
  styleUrls: ['./promotions.page.scss'],
})
export class PromotionsPage implements OnInit {
  @ViewChild('promotionProductsModal') promotionProductsModal?: IonModal;

  promotions: Promotion[] = [];

  isScrolled = false;

  products: Product[] = [];
  promotedProducts: Product[] = [];
  userId: string | null = null;
  selectedPromotionProducts: Product[] = [];

  constructor(private menu: MenuController,
    private router: Router,
    private http: HttpClient,
    private cartService: CartService,
    private navCtrl: NavController,
    private toastController: ToastController,
    private promotionService: PromotionService,) { }

  ngOnInit() {
    this.fetchPromotions();
    this.loadProducts();
    this.getUserId();
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

  isPromotionValid(endDate: string): boolean {
    const now = new Date();
    const promotionEndDate = new Date(endDate);
    return now <= promotionEndDate;
  }

  getDaysRemaining(endDate: string): number {
    const now = new Date();
    const promotionEndDate = new Date(endDate);
    const diffTime = promotionEndDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 3600 * 24));
  }

  getProductNames(promotion: Promotion): string {
    return promotion.product_names.join(', ');
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
        this.products = data.map(product => ({ ...product, quantity: product.quantity || 1 }));
        this.applyPromotions();
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
    this.products = this.products.map(product => {
      const promotion = this.promotions.find(p => p.product_ids.includes(product.product_id));
      if (promotion) {
        const discountAmount = product.price * (promotion.discount_percentage / 100);
        product.discountedPrice = this.roundToTwo(product.price - discountAmount);
        product.hasPromotion = true;
        product.promotionName = promotion.name;
      }
      return product;
    });
  }

  async openPromotionProductsModal(promotion: Promotion) {
    this.selectedPromotionProducts = this.products
      .filter(product => promotion.product_ids.includes(product.product_id))
      .map(product => ({
        ...product,
        quantity: product.quantity || 1  // Ensure quantity is set, default to 1 if not present
      }));
  
      await this.promotionProductsModal?.present();
  }

  dismissModal() {
    this.promotionProductsModal?.dismiss();
  }

  roundToTwo(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
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
}