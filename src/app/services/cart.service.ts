import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

export interface CartItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = 'http://localhost/user_api/cart.php';
  private cartItems: CartItem[] = [];
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  
  constructor(private http: HttpClient) {
    this.initializeCart();
  }

  private initializeCart() {
    const userId = this.getUserId();
    if (userId) {
      this.loadCartFromServer();
    } else {
      this.loadCartFromStorage();
    }
  }

  private getUserId(): string | null {
    return sessionStorage.getItem('userId');
  }

  private loadCartFromStorage() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      this.cartItems = JSON.parse(savedCart);
      this.cartItemsSubject.next(this.cartItems);
    }
  }

  private saveCartToStorage() {
    localStorage.setItem('cart', JSON.stringify(this.cartItems));
    this.cartItemsSubject.next(this.cartItems);
  }

  syncLocalCartWithServer(userId: string): Observable<any> {
    const localCart = localStorage.getItem('cart');
    if (!localCart) {
      return of(null);
    }

    const localCartItems: CartItem[] = JSON.parse(localCart);
    if (localCartItems.length === 0) {
      return of(null);
    }

    // Create an array of observables for each cart item
    const syncRequests = localCartItems.map(item => {
      const payload = {
        user_id: userId,
        product_id: item.product_id,
        quantity: item.quantity
      };
      return this.http.post(this.apiUrl, payload).pipe(
        catchError(error => {
          console.error(`Error syncing item ${item.product_id}:`, error);
          return of(null);
        })
      );
    });

    // Instead of clearing localStorage immediately, wait until after server sync
    return new Observable(subscriber => {
      Promise.all(syncRequests.map(req => req.toPromise()))
        .then(() => {
          // Keep the local cart until we verify server sync
          this.loadCartFromServer().subscribe({
            next: (serverCart) => {
              if (serverCart && serverCart.length > 0) {
                // Only remove local cart after successful server load
                localStorage.removeItem('cart');
              }
              subscriber.next(true);
              subscriber.complete();
            },
            error: (error) => {
              subscriber.error(error);
            }
          });
        })
        .catch(error => {
          subscriber.error(error);
        });
    });
  }

  // Add this new method to load cart and return as Observable
  private loadCartFromServer(): Observable<CartItem[]> {
    const userId = this.getUserId();
    if (!userId) return of([]);

    const params = new HttpParams().set('user_id', userId);
    return this.http.get(this.apiUrl, { params }).pipe(
      map((response: any) => {
        if (response && response.data && Array.isArray(response.data)) {
          return response.data.map((item: any) => ({
            product_id: parseInt(item.product_id, 10),
            name: item.name || 'Unknown Product',
            price: parseFloat(item.price || '0'),
            quantity: parseInt(item.quantity, 10),
            image_url: item.image_url || ''
          }));
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading cart from server:', error);
        return of([]);
      })
    );
  }

  addToCart(product: CartItem): Observable<any> {
    const userId = this.getUserId();
    
    // If user is not logged in, save to local storage
    if (!userId) {
      const existingItem = this.cartItems.find(item => item.product_id === product.product_id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        this.cartItems.push({ ...product, quantity: 1 });
      }
      this.saveCartToStorage();
      return of({ success: true });
    }

    // If user is logged in, save to server
    const payload = {
      user_id: userId,
      product_id: product.product_id,
      quantity: 1
    };

    return this.http.post(this.apiUrl, payload).pipe(
      tap(() => {
        const existingItem = this.cartItems.find(item => item.product_id === product.product_id);
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          this.cartItems.push({ ...product, quantity: 1 });
        }
        this.cartItemsSubject.next(this.cartItems);
      }),
      catchError(this.handleError)
    );
  }

  removeFromCart(productId: number): Observable<any> {
    const userId = this.getUserId();
    
    // If user is not logged in, remove from local storage
    if (!userId) {
      this.cartItems = this.cartItems.filter(item => item.product_id !== productId);
      this.saveCartToStorage();
      return of({ success: true });
    }

    // If user is logged in, remove from server
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
  }

  updateQuantity(productId: number, quantity: number): Observable<any> {
    const userId = this.getUserId();
    
    // If user is not logged in, update in local storage
    if (!userId) {
      const item = this.cartItems.find(item => item.product_id === productId);
      if (item) {
        item.quantity = quantity;
        this.saveCartToStorage();
      }
      return of({ success: true });
    }

    // If user is logged in, update on server
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
  }

  getCart(): Observable<CartItem[]> {
    return this.cartItemsSubject.asObservable();
  }

  getTotal(): number {
    return this.cartItems.reduce((total, item) => {
      const price = item.price || 0;
      return total + (price * item.quantity);
    }, 0);
  }

  getTax(): number {
    return this.getTotal() * 0.175;
  }

  clearCart(): Observable<any> {
    const userId = this.getUserId();
    
    // If user is not logged in, clear local storage
    if (!userId) {
      this.cartItems = [];
      localStorage.removeItem('cart');
      this.cartItemsSubject.next([]);
      return of({ success: true });
    }

    // If user is logged in, clear from server
    return this.http.delete(this.apiUrl).pipe(
      tap(() => {
        this.cartItems = [];
        this.cartItemsSubject.next([]);
      }),
      catchError(this.handleError)
    );
  }

  // Add this to the CartService
clearAllItems(): Observable<any> {
  const userId = this.getUserId();
  
  // If user is not logged in, clear local storage
  if (!userId) {
    this.cartItems = [];
    localStorage.removeItem('cart');
    this.cartItemsSubject.next([]);
    return of({ success: true });
  }

  // If user is logged in, clear from server
  const params = new HttpParams()
    .set('user_id', userId)
    .set('clear_all', 'true');

  return this.http.delete(this.apiUrl, { params }).pipe(
    tap(() => {
      this.cartItems = [];
      this.cartItemsSubject.next([]);
    }),
    catchError(this.handleError)
  );
}

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}