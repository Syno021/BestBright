// stockmovement.page.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { LoadingController } from '@ionic/angular';

interface TrackingData {
  movement_id: number;
  product_id: number;
  product_name: string;
  category: string;
  quantity_moved: number;
  movement_type: string;
  current_stock: number;
  movement_date: string;
  created_at: string;
  notes: string;
}

interface ProductMovement {
  product_name: string;
  category: string;
  total_quantity: number;
  daily_average: number;
  current_stock: number;
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

interface DailyMovement {
  date: string;
  total_quantity: number;
  movements: {
    product_name: string;
    quantity: number;
  }[];
}

interface StockAnalysis {
  movement_category: 'fast' | 'moderate' | 'slow' | 'unknown';
  consumption_rate: number;
  days_to_depletion: number | null;
  initial_stock: number;
  total_outward: number;
}

@Component({
  selector: 'app-stockmovement',
  templateUrl: './stockmovement.page.html',
  styleUrls: ['./stockmovement.page.scss'],
})
export class StockmovementPage implements OnInit {
  trackingData: TrackingData[] = [];
  filteredTrackingData: TrackingData[] = [];
  productMovements: ProductMovement[] = [];
  products: Product[] = [];
  filteredProducts: Product[] = [];
  error: string = '';
  isLoading: boolean = false;
  productsError: string = '';
  selectedDateFilter: string = 'all';
  customDate: string = '';
  filterPeriodDays: number = 0;
  dailyMovements: DailyMovement[] = [];
  stockAnalyses: { [key: number]: StockAnalysis } = {};

  constructor(
    private http: HttpClient,
    private loadingCtrl: LoadingController
  ) { }

  async ngOnInit() {
    await this.loadTrackingData();
    await this.loadProducts();
    await this.loadStockAnalyses();
  }

  async loadStockAnalyses() {
    try {
      const response = await this.http.get<{ [key: number]: StockAnalysis }>(
        'http://localhost/user_api/update_stock.php?action=getStockAnalysis'
      ).toPromise();
      
      if (response) {
        this.stockAnalyses = response;
      }
    } catch (error) {
      console.error('Error loading stock analyses:', error);
    }
  }

  getMovementCategoryLabel(category: 'fast' | 'moderate' | 'slow' | 'unknown' | undefined): string {
    switch (category) {
      case 'fast': return 'Fast Moving';
      case 'moderate': return 'Moderate';
      case 'slow': return 'Slow Moving';
      default: return 'Unknown';
    }
  }

  getMovementCategoryColor(category: 'fast' | 'moderate' | 'slow' | 'unknown' | undefined): string {
    switch (category) {
      case 'fast': return 'danger';
      case 'moderate': return 'warning';
      case 'slow': return 'success';
      default: return 'medium';
    }
  }

  getStockStatusClass(quantity: number): string {
    if (quantity < 75) return 'danger';
    if (quantity < 150) return 'warning';
    return 'success';
  }

  getMovementStatusClass(dailyAverage: number): string {
    if (dailyAverage >= 10) return 'danger';
    if (dailyAverage >= 5) return 'warning';
    return 'success';
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
          this.applyDateFilter();
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

  applyDateFilter() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date | null = null;

    switch (this.selectedDateFilter) {
      case 'today':
        startDate = today;
        this.filterPeriodDays = 1;
        break;
      
      case '7days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        this.filterPeriodDays = 7;
        break;
      
      case 'month':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        this.filterPeriodDays = 30;
        break;
      
      case 'custom':
        if (this.customDate) {
          startDate = new Date(this.customDate);
          this.filterPeriodDays = 1;
        }
        break;
      
      default:
        this.filterPeriodDays = this.calculateTotalDays();
        break;
    }

    // Filter data based on date range
    this.filteredTrackingData = this.trackingData.filter(item => {
      if (!startDate) return true;
      const itemDate = new Date(item.created_at);
      return itemDate >= startDate && itemDate <= now;
    });

    this.analyzeProductMovements();
    this.analyzeDailyMovements();
  }

  analyzeDailyMovements() {
    const movementsByDay = new Map<string, DailyMovement>();

    this.filteredTrackingData.forEach(item => {
      const date = new Date(item.movement_date).toISOString().split('T')[0];
      
      if (!movementsByDay.has(date)) {
        movementsByDay.set(date, {
          date,
          total_quantity: 0,
          movements: []
        });
      }

      const dailyData = movementsByDay.get(date)!;
      dailyData.total_quantity += Number(item.quantity_moved) || 0;
      dailyData.movements.push({
        product_name: item.product_name,
        quantity: Number(item.quantity_moved) || 0
      });
    });

    this.dailyMovements = Array.from(movementsByDay.values())
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  calculateTotalDays(): number {
    if (this.trackingData.length === 0) return 1;
    
    const dates = this.trackingData.map(item => new Date(item.created_at));
    const oldestDate = new Date(Math.min(...dates.map(date => date.getTime())));
    const newestDate = new Date(Math.max(...dates.map(date => date.getTime())));
    
    return Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  }

  analyzeProductMovements() {
    const movementsByProduct = new Map<string, ProductMovement>();

    this.filteredTrackingData.forEach(item => {
      const existing = movementsByProduct.get(item.product_name);
      const quantityMoved = Number(item.quantity_moved) || 0;
      
      if (existing) {
        existing.total_quantity += quantityMoved;
      } else {
        movementsByProduct.set(item.product_name, {
          product_name: item.product_name,
          category: item.category,
          total_quantity: quantityMoved,
          daily_average: 0,
          current_stock: Number(item.current_stock) || 0
        });
      }
    });

    this.productMovements = Array.from(movementsByProduct.values())
      .map(movement => ({
        ...movement,
        daily_average: +(movement.total_quantity / (this.filterPeriodDays || 1)).toFixed(2)
      }))
      .sort((a, b) => b.daily_average - a.daily_average);
  }

  getTotalMovedQuantity(): number {
    return this.filteredTrackingData.reduce((sum, item) => sum + (Number(item.quantity_moved) || 0), 0);
  }

  onDateFilterChange() {
    this.applyDateFilter();
  }


  getDailyAverage(): number {
    if (this.filterPeriodDays === 0) return 0;
    return this.getTotalMovedQuantity() / this.filterPeriodDays;
  }

  getDateRangeLabel(): string {
    if (this.dailyMovements.length === 0) return 'No data';
    
    const startDate = new Date(this.dailyMovements[this.dailyMovements.length - 1].date);
    const endDate = new Date(this.dailyMovements[0].date);
    
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }

  getFilterPeriodLabel(): string {
    switch (this.selectedDateFilter) {
      case 'today': return 'Today';
      case '7days': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'custom': return this.customDate ? new Date(this.customDate).toLocaleDateString() : 'Custom Date';
      default: return 'All Time';
    }
  }
}