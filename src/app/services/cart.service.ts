import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CartItem {
  product_id: number;
  name: string;
  price: number;
  originalPrice?: number;  // Added for original price
  discountedPrice?: number;  // Added for discounted price
  quantity: number;
  image_url: string;
  hasPromotion?: boolean;
  promotionName?: string;
  discountPercentage?: number;
}

export interface newItems {
  cart_id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string;
}


@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = 'http://localhost/user_api/cart.php';
  private cartItems: CartItem[] = [];
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  private readonly LOCAL_CART_KEY = 'localCart';

  constructor(private http: HttpClient) {
    //this.loadCartFromServer();
    this.initializeCart();
  }

  private getUserId(): string | null {
    return sessionStorage.getItem('userId');
  }

  private initializeCart() {
    const userId = this.getUserId();
    if (userId) {
      this.loadCartFromServer();
    } else {
      this.loadCartFromLocal();
    }
  }

  private loadCartFromLocal() {
    const savedCart = localStorage.getItem(this.LOCAL_CART_KEY);
    if (savedCart) {
      this.cartItems = JSON.parse(savedCart);
      this.cartItemsSubject.next(this.cartItems);
    }
  }

  private loadCartFromServer() {
    const userId = this.getUserId();
    if (!userId) return;

    const params = new HttpParams().set('user_id', userId);

    this.http.get<any>(this.apiUrl, { params }).pipe(
      map(response => {
        if (response && response.data && Array.isArray(response.data)) {
          return response.data.map((item: any) => ({
            product_id: parseInt(item.product_id, 10),
            name: item.name || 'Unknown Product',
            price: parseFloat(item.price || '0'),
            originalPrice: parseFloat(item.original_price || item.price || '0'),
            discountedPrice: parseFloat(item.discounted_price || item.price || '0'),
            quantity: parseInt(item.quantity, 10),
            image_url: item.image_url || '',
            hasPromotion: item.has_promotion === '1',
            promotionName: item.promotion_name || '',
            discountPercentage: parseFloat(item.discount_percentage || '0')
          }));
        }
        return [];
      }),
      catchError(this.handleError)
    ).subscribe({
      next: (items: CartItem[]) => {
        this.cartItems = items;
        this.cartItemsSubject.next(this.cartItems);
      },
      error: (error) => {
        console.error('Error loading cart from server:', error);
      }
    });
  }

  private loadCartFromStorage() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      this.cartItems = JSON.parse(savedCart);
      this.cartItemsSubject.next(this.cartItems);
    }
  }

  addToCart(product: CartItem): Observable<any> {
    const userId = this.getUserId();
  
    const cartItem: CartItem = {
      ...product,
      originalPrice: product.price,
      discountedPrice: product.discountedPrice || product.price,
      hasPromotion: product.hasPromotion || false,
      promotionName: product.promotionName || '',
      discountPercentage: product.discountPercentage || 0,
      price: product.discountedPrice || product.price
    };
  
    if (userId) {
      const payload = {
        user_id: userId,
        product_id: cartItem.product_id,
        quantity: 1,
        original_price: cartItem.originalPrice,
        discounted_price: cartItem.discountedPrice,
        has_promotion: cartItem.hasPromotion ? 1 : 0,
        promotion_name: cartItem.promotionName,
        discount_percentage: cartItem.discountPercentage
      };
  
      return this.http.post(this.apiUrl, payload).pipe(
        tap(() => {
          const existingItem = this.cartItems.find(item => item.product_id === cartItem.product_id);
          if (existingItem) {
            existingItem.quantity += 1;
            // Update promotion details for existing item
            existingItem.hasPromotion = cartItem.hasPromotion;
            existingItem.promotionName = cartItem.promotionName;
            existingItem.discountedPrice = cartItem.discountedPrice;
            existingItem.originalPrice = cartItem.originalPrice;
            existingItem.discountPercentage = cartItem.discountPercentage;
          } else {
            this.cartItems.push({ ...cartItem, quantity: 1 });
          }
          this.cartItemsSubject.next(this.cartItems);
        }),
        catchError(this.handleError)
      );
    } else {
      const existingItem = this.cartItems.find(item => item.product_id === cartItem.product_id);
      if (existingItem) {
        existingItem.quantity += 1;
        // Update promotion details for existing item
        existingItem.hasPromotion = cartItem.hasPromotion;
        existingItem.promotionName = cartItem.promotionName;
        existingItem.discountedPrice = cartItem.discountedPrice;
        existingItem.originalPrice = cartItem.originalPrice;
        existingItem.discountPercentage = cartItem.discountPercentage;
      } else {
        this.cartItems.push({ ...cartItem, quantity: 1 });
      }
      this.updateLocalCart();
      return of({ success: true });
    }
  }

  removeFromCart(productId: number): Observable<any> {
    const userId = this.getUserId();

    if (userId) {
      const params = new HttpParams()
        .set('user_id', userId)
        .set('product_id', productId.toString());

      return this.http.delete(this.apiUrl, { params }).pipe(
        tap(() => {
          this.cartItems = this.cartItems.filter(item => item.product_id !== productId);
          this.cartItemsSubject.next(this.cartItems);
        }),
        catchError(this.handleError)
      );
    } else {
      this.cartItems = this.cartItems.filter(item => item.product_id !== productId);
      this.updateLocalCart();
      return of({ success: true });
    }
  }

  updateQuantity(productId: number, quantity: number): Observable<any> {
    const userId = this.getUserId();

    if (userId) {
      const payload = {
        user_id: userId,
        product_id: productId,
        quantity: quantity
      };

      return this.http.put(this.apiUrl, payload).pipe(
        tap(() => {
          const item = this.cartItems.find(item => item.product_id === productId);
          if (item) {
            item.quantity = quantity;
          }
          this.cartItemsSubject.next(this.cartItems);
        }),
        catchError(this.handleError)
      );
    } else {
      const item = this.cartItems.find(item => item.product_id === productId);
      if (item) {
        item.quantity = quantity;
      }
      this.updateLocalCart();
      return of({ success: true });
    }
  }

  getCart(): Observable<CartItem[]> {
    const userId = this.getUserId();
    
    if (userId) {
      const params = new HttpParams().set('user_id', userId);
      
      return this.http.get<any>(this.apiUrl, { params }).pipe(
        map(response => {
          if (response && response.data && Array.isArray(response.data)) {
            return response.data.map((item: any) => ({
              product_id: parseInt(item.product_id, 10),
              name: item.name || 'Unknown Product',
              price: parseFloat(item.price || '0'),
              originalPrice: parseFloat(item.original_price || item.price || '0'),
              discountedPrice: parseFloat(item.discounted_price || item.price || '0'),
              quantity: parseInt(item.quantity, 10),
              image_url: item.image_url || '',
              hasPromotion: item.has_promotion === '1' || item.has_promotion === true,
              promotionName: item.promotion_name || '',
              discountPercentage: parseFloat(item.discount_percentage || '0')
            }));
          }
          return [];
        }),
        catchError(this.handleError)
      );
    } else {
      return of(this.cartItems);
    }
  }
  
  syncLocalCartToServer(userId: string): Observable<any> {
    if (this.cartItems.length === 0) {
      return of({ success: true });
    }

    // Create observables for each local item to be added to server
    const syncRequests = this.cartItems.map(item => {
      const payload = {
        user_id: userId,
        product_id: item.product_id,
        quantity: item.quantity
      };
      return this.http.post(this.apiUrl, payload);
    });

    // Execute all requests and then reload the cart
    return of(syncRequests).pipe(
      mergeMap(requests => Promise.all(requests)),
      tap(() => {
        localStorage.removeItem(this.LOCAL_CART_KEY);
        this.loadCartFromServer();
      }),
      catchError(this.handleError)
    );
  }

  getTotal(): number {
    return this.cartItems.reduce((total, item) => {
      const priceToUse = item.discountedPrice || item.price;
      return total + (priceToUse * item.quantity);
    }, 0);
  }

  getOriginalTotal(): number {
    return this.cartItems.reduce((total, item) => {
      const originalPrice = item.originalPrice || item.price;
      return total + (originalPrice * item.quantity);
    }, 0);
  }

  getTotalSavings(): number {
    return this.getOriginalTotal() - this.getTotal();
  }

  getTax(): number {
    return this.getTotal() * 0.175; // Assuming 17.5% tax rate
  }

  clearCart(): Observable<any> {
    const userId = this.getUserId();

    if (userId) {
      const params = new HttpParams()
        .set('user_id', userId)
        .set('clear_all', 'true');

      return this.http.delete(this.apiUrl, { params }).pipe(
        tap(() => {
          this.cartItems = [];
          this.cartItemsSubject.next(this.cartItems);
        }),
        catchError(this.handleError)
      );
    } else {
      this.cartItems = [];
      this.updateLocalCart();
      return of({ success: true });
    }
  }

  private updateLocalCart() {
    this.cartItemsSubject.next(this.cartItems);
    localStorage.setItem(this.LOCAL_CART_KEY, JSON.stringify(this.cartItems));
  }

  clearAllItems(): Observable<any> {
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('User not logged in'));
    }

    const params = new HttpParams()
      .set('user_id', userId)
      .set('clear_all', 'true');  // Add a parameter to indicate clearing all items

    return this.http.delete(this.apiUrl, { params }).pipe(
      tap(() => {
        this.cartItemsSubject.next([]);
      }),
      catchError(this.handleError)
    );
  }

  private updateCart() {
    this.cartItemsSubject.next(this.cartItems);
    localStorage.removeItem('cart'); // Remove cart from local storage
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && typeof error.error === 'object') {
        console.error('Full error response:', error.error);
        if (error.error.error) {
          errorMessage += `\nDetails: ${error.error.error}`;
        }
      }
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}