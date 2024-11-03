import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, mergeMap, switchMap, tap } from 'rxjs/operators';
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
  private readonly SYNCED_ITEMS_KEY = 'syncedCartItems';
  private initialized = false;

  constructor(private http: HttpClient) {
    //this.loadCartFromServer();
    this.initializeCart();
  }

  private getUserId(): string | null {
    return sessionStorage.getItem('userId');
  }

  private initializeCart() {
    const userId = this.getUserId();
    
    // Load persisted items first
    this.loadPersistedItems();
    
    if (userId && !this.initialized) {
      this.initialized = true;
      this.loadCartFromServer().subscribe({
        next: (serverItems) => {
          const localItems = this.getLocalCart();
          const syncedItems = this.getSyncedItems();
          const allLocalItems = this.mergeCartItems(localItems, syncedItems);
          const mergedCart = this.mergeCartItems(allLocalItems, serverItems);
          
          // Only update if there are items to merge
          if (mergedCart.length > 0) {
            this.cartItems = mergedCart;
            this.cartItemsSubject.next(this.cartItems);
            this.persistItems();
            
            // Sync to server if needed
            if (localItems.length > 0) {
              this.syncLocalCartToServer(userId).subscribe({
                next: () => {
                  console.log('Cart synced successfully');
                  this.updateSyncedItems(this.cartItems);
                  this.persistItems();
                },
                error: (error) => console.error('Error syncing cart:', error)
              });
            }
          }
        },
        error: (error) => console.error('Error loading cart from server:', error)
      });
    }
  }

  private persistItems() {
    localStorage.setItem(this.LOCAL_CART_KEY, JSON.stringify(this.cartItems));
    localStorage.setItem(this.SYNCED_ITEMS_KEY, JSON.stringify(this.cartItems));
  }

  // New method to load persisted items
  private loadPersistedItems() {
    const persistedItems = localStorage.getItem(this.LOCAL_CART_KEY);
    if (persistedItems) {
      this.cartItems = JSON.parse(persistedItems);
      this.cartItemsSubject.next(this.cartItems);
    }
  }

  private loadSyncedItems() {
    const syncedItems = this.getSyncedItems();
    if (syncedItems.length > 0) {
      this.cartItems = this.mergeCartItems(this.cartItems, syncedItems);
      this.cartItemsSubject.next(this.cartItems);
    }
  }

  private getSyncedItems(): CartItem[] {
    const syncedItems = localStorage.getItem(this.SYNCED_ITEMS_KEY);
    return syncedItems ? JSON.parse(syncedItems) : [];
  }

  private updateSyncedItems(items: CartItem[]) {
    localStorage.setItem(this.SYNCED_ITEMS_KEY, JSON.stringify(items));
  }

  private loadCartFromLocal() {
    const savedCart = localStorage.getItem(this.LOCAL_CART_KEY);
    if (savedCart) {
      this.cartItems = JSON.parse(savedCart);
      this.cartItemsSubject.next(this.cartItems);
    }
  }

  private loadCartFromServer(): Observable<CartItem[]> {
    const userId = this.getUserId();
    if (!userId) return of([]);

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
            hasPromotion: item.has_promotion === '1',
            promotionName: item.promotion_name || '',
            discountPercentage: parseFloat(item.discount_percentage || '0')
          }));
        }
        return [];
      }),
      catchError(this.handleError)
    );
  }

  private mergeCartItems(localItems: CartItem[], serverItems: CartItem[]): CartItem[] {
    const mergedCart: { [key: number]: CartItem } = {};
    
    // First, add all server items to the merged cart
    serverItems.forEach(item => {
      mergedCart[item.product_id] = { ...item };
    });
    
    // Then merge local items, keeping higher quantities and local promotion data if not in server
    localItems.forEach(localItem => {
      if (mergedCart[localItem.product_id]) {
        const serverItem = mergedCart[localItem.product_id];
        mergedCart[localItem.product_id] = {
          ...serverItem,
          quantity: Math.max(serverItem.quantity, localItem.quantity),
          hasPromotion: serverItem.hasPromotion || localItem.hasPromotion,
          promotionName: serverItem.promotionName || localItem.promotionName,
          discountedPrice: serverItem.discountedPrice || localItem.discountedPrice,
          originalPrice: serverItem.originalPrice || localItem.originalPrice,
          discountPercentage: serverItem.discountPercentage || localItem.discountPercentage
        };
      } else {
        mergedCart[localItem.product_id] = { ...localItem };
      }
    });
    
    return Object.values(mergedCart);
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
      discountPercentage: product.discountPercentage || 0
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
            existingItem.hasPromotion = cartItem.hasPromotion;
            existingItem.promotionName = cartItem.promotionName;
            existingItem.discountedPrice = cartItem.discountedPrice;
            existingItem.originalPrice = cartItem.originalPrice;
            existingItem.discountPercentage = cartItem.discountPercentage;
          } else {
            this.cartItems.push({ ...cartItem, quantity: 1 });
          }
          this.cartItemsSubject.next(this.cartItems);
          this.persistItems();
        }),
        catchError(this.handleError)
      );
    } else {
      const existingItem = this.cartItems.find(item => item.product_id === cartItem.product_id);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.hasPromotion = cartItem.hasPromotion;
        existingItem.promotionName = cartItem.promotionName;
        existingItem.discountedPrice = cartItem.discountedPrice;
        existingItem.originalPrice = cartItem.originalPrice;
        existingItem.discountPercentage = cartItem.discountPercentage;
      } else {
        this.cartItems.push({ ...cartItem, quantity: 1 });
      }
      this.persistItems();
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
          this.persistItems();
        }),
        catchError(this.handleError)
      );
    } else {
      const item = this.cartItems.find(item => item.product_id === productId);
      if (item) {
        item.quantity = quantity;
      }
      this.persistItems();
      return of({ success: true });
    }
  }

  getCart(): Observable<CartItem[]> {
    const userId = this.getUserId();
    
    if (!userId) {
      const localItems = this.getLocalCart();
      const syncedItems = this.getSyncedItems();
      const mergedItems = this.mergeCartItems(localItems, syncedItems);
      return of(mergedItems);
    }

    return this.http.get<any>(this.apiUrl, { params: new HttpParams().set('user_id', userId) }).pipe(
      map(response => {
        if (response?.data && Array.isArray(response.data)) {
          const serverItems = response.data.map(this.mapServerItem);
          const localItems = this.getLocalCart();
          const syncedItems = this.getSyncedItems();
          const allLocalItems = this.mergeCartItems(localItems, syncedItems);
          const mergedItems = this.mergeCartItems(allLocalItems, serverItems);
          
          // Update internal state
          this.cartItems = mergedItems;
          this.cartItemsSubject.next(mergedItems);
          
          // If there are local items, sync to server
          if (localItems.length > 0) {
            this.syncLocalCartToServer(userId).subscribe({
              next: () => {
                this.updateSyncedItems(mergedItems);
                localStorage.removeItem(this.LOCAL_CART_KEY); // Clear local cart after successful sync
              }
            });
          }
          
          return mergedItems;
        }
        return this.mergeCartItems(this.getLocalCart(), this.getSyncedItems());
      }),
      catchError(error => {
        console.error('Error fetching server cart:', error);
        return of(this.mergeCartItems(this.getLocalCart(), this.getSyncedItems()));
      })
    );
  }

  private mapServerItem(item: any): CartItem {
    return {
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
    };
  }

  private getLocalCart(): CartItem[] {
    const savedCart = localStorage.getItem(this.LOCAL_CART_KEY);
    return savedCart ? JSON.parse(savedCart) : [];
  }
  
  syncLocalCartToServer(userId: string): Observable<any> {
    if (this.cartItems.length === 0) {
      return of({ success: true });
    }

    // Create observables for each cart item to be synced
    const syncRequests = this.cartItems.map(item => {
      const payload = {
        user_id: userId,
        product_id: item.product_id,
        quantity: item.quantity,
        original_price: item.originalPrice,
        discounted_price: item.discountedPrice,
        has_promotion: item.hasPromotion ? 1 : 0,
        promotion_name: item.promotionName,
        discount_percentage: item.discountPercentage
      };
      return this.http.post(this.apiUrl, payload);
    });

    // Execute all requests in parallel
    return of(syncRequests).pipe(
      mergeMap(requests => Promise.all(requests)),
      tap(() => {
        localStorage.removeItem(this.LOCAL_CART_KEY);
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

    // Create a function to clear local state
    const clearLocalState = () => {
      this.cartItems = [];
      this.cartItemsSubject.next([]);
      localStorage.removeItem(this.SYNCED_ITEMS_KEY);
      localStorage.removeItem(this.LOCAL_CART_KEY);
    };

    if (userId) {
      const params = new HttpParams()
        .set('user_id', userId)
        .set('clear_all', 'true');

      return this.http.delete(this.apiUrl, { params }).pipe(
        tap(() => clearLocalState()),
        finalize(() => clearLocalState()), // Ensure local state is cleared even if request fails
        catchError(error => {
          console.error('Error clearing cart:', error);
          // Still clear local state even if server request fails
          clearLocalState();
          return throwError(() => error);
        })
      );
    } else {
      clearLocalState();
      return of({ success: true });
    }
  }

  private updateLocalCart() {
    localStorage.setItem(this.LOCAL_CART_KEY, JSON.stringify(this.cartItems));
    this.cartItemsSubject.next(this.cartItems);
  }

  clearAllItems(): Observable<any> {
    const userId = this.getUserId();
    if (!userId) {
      // Clear local storage and state even if user is not logged in
      this.cartItems = [];
      this.cartItemsSubject.next([]);
      localStorage.removeItem(this.SYNCED_ITEMS_KEY);
      localStorage.removeItem(this.LOCAL_CART_KEY);
      return of({ success: true });
    }

    const params = new HttpParams()
      .set('user_id', userId)
      .set('clear_all', 'true');

    return this.http.delete(this.apiUrl, { params }).pipe(
      tap(() => {
        // Clear both local storage and state
        this.cartItems = [];
        this.cartItemsSubject.next([]);
        localStorage.removeItem(this.SYNCED_ITEMS_KEY);
        localStorage.removeItem(this.LOCAL_CART_KEY);
      }),
      finalize(() => {
        // Ensure local state is cleared even if request fails
        this.cartItems = [];
        this.cartItemsSubject.next([]);
        localStorage.removeItem(this.SYNCED_ITEMS_KEY);
        localStorage.removeItem(this.LOCAL_CART_KEY);
      }),
      catchError(error => {
        console.error('Error clearing all items:', error);
        // Still clear local state even if server request fails
        this.cartItems = [];
        this.cartItemsSubject.next([]);
        localStorage.removeItem(this.SYNCED_ITEMS_KEY);
        localStorage.removeItem(this.LOCAL_CART_KEY);
        return throwError(() => error);
      })
    );
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
          this.persistItems();
        }),
        catchError(this.handleError)
      );
    } else {
      this.cartItems = this.cartItems.filter(item => item.product_id !== productId);
      this.persistItems();
      return of({ success: true });
    }
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