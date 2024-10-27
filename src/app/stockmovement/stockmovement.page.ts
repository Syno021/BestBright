// stockmovement.page.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { LoadingController } from '@ionic/angular';

interface TrackingData {
  tracking_id: number;
  product_id: number;
  product_name: string;
  category: string;
  quantity_out: number;
  current_stock: number;
  created_at: string;
  updated_at: string;
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
  selector: 'app-stockmovement',
  templateUrl: './stockmovement.page.html',
  styleUrls: ['./stockmovement.page.scss'],
})
export class StockmovementPage implements OnInit {
  trackingData: TrackingData[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  error: string = '';
  isLoading: boolean = false;
  productsError: string = '';

  constructor(
    private http: HttpClient,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.loadTrackingData();
    this.loadProducts(); // Add this to load products on init
  }

  async loadTrackingData() {
    const loading = await this.loadingCtrl.create({
      message: 'Loading stock movements...'
    });
    await loading.present();

    this.http.get<TrackingData[]>('http://localhost/user_api/update_stock.php?action=getTrackProductQuantity')
      .subscribe({
        next: (data) => {
          this.trackingData = data;
          loading.dismiss();
        },
        error: (error) => {
          this.error = 'Failed to load stock movement data';
          console.error('Error:', error);
          loading.dismiss();
        }
      });
  }

  async loadProducts() {
    this.isLoading = true;
    
    try {
      const data = await this.http.get<Product[]>('http://localhost/user_api/products.php').toPromise();
      if (data) {
        this.products = data.map(product => ({
          ...product,
          quantity: 1
        }));
        this.filteredProducts = [...this.products];
      }
    } catch (error) {
      console.error('Error loading products:', error);
      this.productsError = 'Failed to load products';
    } finally {
      this.isLoading = false;
    }
  }

  getStockStatusClass(quantity: number): string {
    if (quantity < 75) return 'stock-low';
    if (quantity < 150) return 'stock-medium';
    return 'stock-high';
  }
}