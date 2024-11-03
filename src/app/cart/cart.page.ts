import { Component, OnInit } from '@angular/core';
import { CartService } from '../services/cart.service';
import { PromotionService } from '../services/promotion.service'; 
import { Router } from '@angular/router';
import { AlertController,ToastController, AlertOptions } from '@ionic/angular';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { catchError, firstValueFrom, forkJoin, map, Observable, of, Subscription, throwError } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AngularFirestore, AngularFirestoreDocument, DocumentReference } from '@angular/fire/compat/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';
import { LoadingController} from '@ionic/angular';
// import { AddressModalComponent } from './address-modal.component';
import { PaymentgateComponent } from '../paymentgate/paymentgate.component';
import { environment } from '../../environments/environment';


declare global {
  interface Window {
    PaystackPop: any;
  }
}

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => void;
}

interface User {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface Product {
  id: any;
  product_id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  category: string;
  barcode: string;
  image_url: string;
  total_ratings: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
  quantity?: number;
  discountedPrice?: number; // Add this property
  hasPromotion?: boolean; // Add this property
  promotionName?: string; // Add this property
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
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
})
export class CartPage implements OnInit {
  private paystackScriptLoaded: boolean = false;

  cartItems: any[] = [];
  promotions: any[] = [];
  deliveryMethod: string = 'delivery';
  selectedAddress: any = null;
  savedAddresses: any[] = []; // Fetch this from a service or storage
  userId: string | null = null;
  userEmail: string | null = null;
  users: User[] = [];
  currentUser: User | null = null;
  currentAddress: any = null;
  selectedAddressId: number | null = null;

  subtotal: number = 0;
  discountedSubtotal: number = 0;
  tax: number = 0;
  total: number = 0;
  discountedTotal: number = 0;
  loading: boolean = false;
  

  private cartSubscription: Subscription | undefined;

  constructor(
    private cartService: CartService,
    private promotionService: PromotionService, 
     private alertController: AlertController,
     private toastController: ToastController,
     private cd: ChangeDetectorRef,
     private http: HttpClient,
     private afStorage: AngularFireStorage,
     private loadingController: LoadingController,
     private firestore: AngularFirestore,
     private modalController: ModalController,
     private router: Router
  ) {}

  async ngOnInit() {
    this.loadPromotions();
    this.loadCart();
    await this.getUserId();
    this.getUserEmail();
    this.loadUserDetails();
    this.loadSavedAddresses();
    this.loadPaystackScript();
  }

  loadUserDetails() {
    if (this.userId) {
      this.http.get<User[]>(`http://localhost/user_api/register.php?role=customer`)
        .subscribe(
          (users) => {
            const currentUser = users.find(user => user.user_id.toString() === this.userId);
            if (currentUser) {
              this.currentUser = currentUser;
              console.log('Current user loaded:', this.currentUser);
            }
          },
          (error: HttpErrorResponse) => {
            console.error('Error fetching user details:', error);
          }
        );
    }
  }

  loadCart() {
    this.loading = true; // Add loading state
    this.cartSubscription = this.cartService.getCart().pipe(
      map(items => items.map(item => ({
        ...item,
        price: this.ensureValidNumber(item.price),
        quantity: this.ensureValidNumber(item.quantity),
        originalPrice: this.ensureValidNumber(item.originalPrice || item.price),
        discountedPrice: this.ensureValidNumber(item.discountedPrice || item.price),
        hasPromotion: Boolean(item.hasPromotion),
        promotionName: item.promotionName || '',
        discountPercentage: this.ensureValidNumber(item.discountPercentage || 0)
      })))
    ).subscribe({
      next: (items) => {
        this.cartItems = items;
        console.log('Merged cart items loaded:', this.cartItems);
        if (this.promotions.length > 0) {
          this.applyPromotions();
        }
        this.loading = false; // Clear loading state
      },
      error: (error) => {
        console.error('Error loading cart:', error);
        this.showToast('Error loading cart items');
        this.loading = false; // Clear loading state on error
      }
    });
  }

  async PlaceOrder(): Promise<void> {
    if (!this.userId || !this.userEmail) {
      const alert = await this.alertController.create({
        header: 'Login Required',
        message: 'Please log in or create an account to place an order.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Sign In',
            handler: () => {
              // Navigate to signup page
              this.router.navigate(['/signup'], {
                queryParams: { returnUrl: '/cart' } // Store return URL to come back after signup
              });
            }
          },
        ]
      });
      await alert.present();
      return;
    }
    try {
      if (!(await this.validateOrder())) {
        return;
      }
      if (this.cartItems.length === 0) {
        const alert = await this.alertController.create({
          header: 'Empty Cart',
          message: 'Your cart is empty. Add some items before placing an order.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }
  
      
      
  
      console.log('Starting order placement process');
  
      // Check product quantities
      const {isValid, invalidItems} = await this.checkProductQuantities();
      if (!isValid) {
        let message = 'The following items have insufficient quantity:\n';
        invalidItems.forEach(item => {
          message += `${item.name}: ${item.availableQuantity} available\n`;
        });
        const alert = await this.alertController.create({
          header: 'Insufficient Quantity',
          message: message,
          buttons: ['OK']
        });
        await alert.present();
        return;
      }
  
      // Update stock quantities
      try {
        for (const item of this.cartItems) {
          const stockResponse = await firstValueFrom(
            this.http.get<{quantity: number}>(
              `http://localhost/user_api/products.php?check_quantity=1&product_id=${item.product_id}`
            )
          );
          
          const currentStock = stockResponse.quantity;
          const newQuantity = currentStock - item.quantity;
  
          await firstValueFrom(
            this.http.put('http://localhost/user_api/update_stock.php', {
              product_id: item.product_id,
              quantity: newQuantity
            })
          );
        }
      } catch (error) {
        console.error('Error updating stock quantities:', error);
        this.showToast('Error updating product quantities. Please try again.');
        return;
      }
  
      // Prepare the order data
      const orderData = {
        user_id: this.userId,
        total_amount: this.total,
        discounted_amount: this.discountedTotal,
        order_type: this.deliveryMethod,
        status: 'pending',
        items: this.cartItems.map(item => ({
          ...item,
          applied_promotion: item.hasPromotion ? {
            name: item.promotionName,
            discount_percentage: this.promotions.find(p => p.name === item.promotionName)?.discount_percentage
          } : null
        })),
        created_at: new Date()
      };
  
      // 1. Create order in MySQL first
      const response = await this.http.post<{ 
        success: boolean, 
        message: string,
        order_id: number
      }>('http://localhost/user_api/orders.php', orderData).toPromise();
  
      if (!response || !response.success || !response.order_id) {
        throw new Error('Failed to create order in MySQL database');
      }
  
      const mysql_order_id = response.order_id;
  
      // 2. Generate PDF
      const pdfBlob = await this.generateOrderPDF(orderData, mysql_order_id.toString());
  
      // 3. Upload PDF to Firebase Storage and get URL
      const pdfUrl = await this.uploadPDFToFirebase(pdfBlob, mysql_order_id.toString());
  
      // 4. Prepare Firestore order data with PDF URL
      const firestoreOrderData = { 
        ...orderData, 
        order_id: mysql_order_id,
        pdf_url: pdfUrl,
        created_at: new Date(), // Firestore timestamp
        updated_at: new Date()
      };
  
      // 5. Create new document in Firestore (using set instead of update)
      await this.firestore.collection('orders')
        .doc(mysql_order_id.toString())
        .set(firestoreOrderData);
  
      // 6. Send email with the PDF
      await this.sendOrderEmail(this.userEmail, pdfBlob, mysql_order_id.toString());
  
      // Clear cart and show success message
      this.cartService.clearAllItems().subscribe({
        next: () => {
          console.log('Cart cleared successfully');
        },
        error: (error) => {
          console.error('Error clearing cart:', error);
          this.showToast('Failed to clear cart. Please try again.');
        }
      });
  
    await firstValueFrom(this.cartService.clearAllItems());
    await firstValueFrom(this.cartService.clearCart());
    
    this.cartItems = [];
    this.calculateTotals();
    
    const alert = await this.alertController.create({
      header: 'Order Placed',
      message: `Your order #${mysql_order_id} for R${this.total.toFixed(2)} has been placed successfully!`,
      buttons: [{
        text: 'OK',
        handler: () => {
          // Refresh the cart display
          this.loadCart();
        }
      }]
    });
    await alert.present();

  } catch (error) {
    console.error('Error in order placement process:', error);
    this.showToast('An error occurred while placing your order. Please try again.');
  }
}

// Add this helper method if you don't have it already
private roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
  switchMainImage(item: any, newImage: string) {
    const currentMain = item.image_url;
    item.image_url = newImage;
    // Update the thumbnails array accordingly
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  loadPaystackScript() {
    if (!this.paystackScriptLoaded) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => {
        this.paystackScriptLoaded = true;
        console.log('Paystack script loaded');
      };
      document.body.appendChild(script);
    }
  }

  async makePayment() {
    if (!this.userId || !this.userEmail) {
      const alert = await this.alertController.create({
        header: 'Login Required',
        message: 'Please log in or create an account to place an order.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Sign In',
            handler: () => {
              this.router.navigate(['/signup'], {
                queryParams: { returnUrl: '/cart' }
              });
            }
          },
        ]
      });
      await alert.present();
      return;
    }
    try {
      if (!this.paystackScriptLoaded) {
        await this.showToast('Paystack script not loaded yet. Please try again.');
        return;
      }
  
      if (typeof window.PaystackPop === 'undefined') {
        await this.showToast('PaystackPop is not defined. Please refresh the page and try again.');
        return;
      }

      // Validate order first
      if (!(await this.validateOrder())) {
        return;
      }
  
      if (this.cartItems.length === 0) {
        const alert = await this.alertController.create({
          header: 'Empty Cart',
          message: 'Your cart is empty. Add some items before placing an order.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }
  
      // Check product quantities first
      const {isValid, invalidItems} = await this.checkProductQuantities();
      if (!isValid) {
        let message = 'The following items have insufficient quantity:\n';
        invalidItems.forEach(item => {
          message += `${item.name}: ${item.availableQuantity} available\n`;
        });
        const alert = await this.alertController.create({
          header: 'Insufficient Quantity',
          message: message,
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Update stock quantities
      try {
        for (const item of this.cartItems) {
          const stockResponse = await firstValueFrom(
            this.http.get<{quantity: number}>(
              `http://localhost/user_api/products.php?check_quantity=1&product_id=${item.product_id}`
            )
          );
          
          const currentStock = stockResponse.quantity;
          const newQuantity = currentStock - item.quantity;
  
          await firstValueFrom(
            this.http.put('http://localhost/user_api/update_stock.php', {
              product_id: item.product_id,
              quantity: newQuantity
            })
          );
        }
      } catch (error) {
        console.error('Error updating stock quantities:', error);
        this.showToast('Error updating product quantities. Please try again.');
        return;
      }
  
      // Prepare the order data
      const orderData = {
        user_id: this.userId,
        total_amount: this.total,
        discounted_amount: this.discountedTotal,
        order_type: this.deliveryMethod,
        status: 'online-payment',
        items: this.cartItems.map(item => ({
          ...item,
          applied_promotion: item.hasPromotion ? {
            name: item.promotionName,
            discount_percentage: this.promotions.find(p => p.name === item.promotionName)?.discount_percentage
          } : null
        })),
        created_at: new Date()
      };
  
      // Create order in MySQL first to get order_id
      const response = await this.http.post<{ 
        success: boolean, 
        message: string,
        order_id: number
      }>('http://localhost/user_api/orders.php', orderData).toPromise();
  
      if (!response || !response.success || !response.order_id) {
        throw new Error('Failed to create order in MySQL database');
      }
  
      const order_id = response.order_id;
  
      // Initialize Paystack payment
      const handler = window.PaystackPop.setup({
        key: environment.paystackTestPublicKey,
        email: this.userEmail,
        amount: Math.round(this.discountedTotal * 100),
        currency: 'ZAR',
        ref: `ORDER_${order_id}`,
        metadata: {
          order_id: order_id,
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: order_id
            }
          ]
        },
        onClose: async () => {
          console.log('Payment window closed');
          // If payment window is closed, we need to:
          // 1. Reverse the stock quantity updates
          try {
            for (const item of this.cartItems) {
              const stockResponse = await firstValueFrom(
                this.http.get<{quantity: number}>(
                  `http://localhost/user_api/products.php?check_quantity=1&product_id=${item.product_id}`
                )
              );
              
              const currentStock = stockResponse.quantity;
              const newQuantity = currentStock + item.quantity; // Add back the quantities
              
              await firstValueFrom(
                this.http.put('http://localhost/user_api/update_stock.php', {
                  product_id: item.product_id,
                  quantity: newQuantity
                })
              );
            }
          } catch (error) {
            console.error('Error reversing stock quantities:', error);
          }
          // 2. Delete the pending order
          await this.http.delete(`http://localhost/user_api/orders.php?order_id=${order_id}`).toPromise();
        },
        
        callback: async (response: any) => {
          console.log('Payment successful', response);
          try {
            await this.verifyTransaction(order_id);
            await firstValueFrom(this.cartService.clearAllItems());
            
            this.cartItems = [];
            this.calculateTotals();
            
            window.location.reload();
          } catch (error) {
            // If verification fails, reverse the stock quantity updates
            try {
              for (const item of this.cartItems) {
                const stockResponse = await firstValueFrom(
                  this.http.get<{quantity: number}>(
                    `http://localhost/user_api/products.php?check_quantity=1&product_id=${item.product_id}`
                  )
                );
                
                const currentStock = stockResponse.quantity;
                const newQuantity = currentStock + item.quantity; // Add back the quantities
                
                await firstValueFrom(
                  this.http.put('http://localhost/user_api/update_stock.php', {
                    product_id: item.product_id,
                    quantity: newQuantity
                  })
                );
              }
            } catch (reverseError) {
              console.error('Error reversing stock quantities:', reverseError);
            }
            console.error('Error in payment callback:', error);
            this.showToast('Error processing payment confirmation. Please contact support.');
          }
        },
        onError: async (error: any) => {
          console.error('Payment error:', error);
          // If payment fails, reverse the stock quantity updates
          try {
            for (const item of this.cartItems) {
              const stockResponse = await firstValueFrom(
                this.http.get<{quantity: number}>(
                  `http://localhost/user_api/products.php?check_quantity=1&product_id=${item.product_id}`
                )
              );
              
              const currentStock = stockResponse.quantity;
              const newQuantity = currentStock + item.quantity; // Add back the quantities
              
              await firstValueFrom(
                this.http.put('http://localhost/user_api/update_stock.php', {
                  product_id: item.product_id,
                  quantity: newQuantity
                })
              );
            }
          } catch (reverseError) {
            console.error('Error reversing stock quantities:', reverseError);
          }
          await this.http.delete(`http://localhost/user_api/orders.php?order_id=${order_id}`).toPromise();
          await this.showToast(`Payment error: ${error.message || 'Unknown error occurred'}`);
        }
      });
  
      handler.openIframe();
  
    } catch (error) {
      console.error('Error in payment process:', error);
      await this.showToast('An error occurred while processing your payment. Please try again.');
    }
  }
  
  async verifyTransaction(order_id: number) {
    try {
      // Verify order with your backend
      const verificationResponse = await this.http.post<{
        success: boolean,
        message: string,
        data?: any
      }>('http://localhost/user_api/verify_payment.php', {
        order_id: order_id
      }).toPromise();
  
      if (verificationResponse?.success) {
        // Clear cart with proper error handling
        try {
          await firstValueFrom(this.cartService.clearAllItems());
          
          // Double-check cart is cleared locally
          this.cartItems = [];
          this.calculateTotals();
          
          await this.showToast('Payment successful! Your order has been placed.');
          
          // Navigate to order confirmation page and force reload
          this.router.navigate(['/orders']).then(() => {
            window.location.reload();
          });
        } catch (error) {
          console.error('Error clearing cart after payment:', error);
          this.showToast('Order placed but error clearing cart. Please refresh the page.');
        }
      } else {
        // If verification fails, delete the pending order
        await this.http.delete(`http://localhost/user_api/orders.php?order_id=${order_id}`).toPromise();
        await this.showToast('Order verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying order:', error);
      // Delete the pending order if verification fails
      await this.http.delete(`http://localhost/user_api/orders.php?order_id=${order_id}`).toPromise();
      await this.showToast('Error verifying order. Please contact support.');
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  
  
  private async generateOrderPDF(orderData: any, mysql_order_id: string): Promise<Blob> {
    const pdf = new jsPDF() as jsPDFWithAutoTable;
    const pageWidth = pdf.internal.pageSize.width;

    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("Invoice", pageWidth / 2, 20, { align: "center" });

    // Business Banking Details (Top Right)
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text([
        "Business name: Best brightnes",
        "Account number: 0000000000",
        "Bank: Absa",
        "Branch code: 1000235"
    ], pageWidth - 20, 20, { align: "right" });

    // Order Details (adjusted Y positions)
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Order Number: ${mysql_order_id}`, 20, 35);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 43);

    // Customer Details Section (adjusted Y positions)
    pdf.setFont("helvetica", "bold");
    pdf.text("Customer Information:", 20, 55);
    pdf.setFont("helvetica", "normal");

    // Use currentUser details instead of sessionStorage
    if (this.currentUser) {
        pdf.text(`Name: ${this.currentUser.first_name} ${this.currentUser.last_name}`, 20, 63);
        pdf.text(`Email: ${this.currentUser.email}`, 20, 71);
    } else {
        pdf.text(`Name: Not Available`, 20, 63);
        pdf.text(`Email: ${this.userEmail || 'Not Available'}`, 20, 71);
    }

    // Delivery Address Section (adjusted Y positions)
    let startY = 83;
    if (this.deliveryMethod === 'delivery') {
        const selectedAddress = this.getSelectedAddress();
        if (selectedAddress) {
            pdf.setFont("helvetica", "bold");
            pdf.text("Delivery Address:", 20, startY);
            pdf.setFont("helvetica", "normal");
            pdf.text(`${selectedAddress.address_line1}`, 20, startY + 8);
            if (selectedAddress.address_line2) {
                pdf.text(`${selectedAddress.address_line2}`, 20, startY + 16);
                startY += 8;
            }
            pdf.text(`${selectedAddress.city}${selectedAddress.province ? ', ' + selectedAddress.province : ''}`, 20, startY + 16);
            pdf.text(`${selectedAddress.postal_code || ''}`, 20, startY + 24);
            pdf.text(`${selectedAddress.country}`, 20, startY + 32);
            startY += 45;
        } else {
            pdf.setFont("helvetica", "bold");
            pdf.text("Delivery Address:", 20, startY);
            pdf.setFont("helvetica", "normal");
            pdf.text("No delivery address specified", 20, startY + 8);
            startY += 20;
        }
    }

    // Order Items Table
    const tableData = this.cartItems.map(item => [
        item.name,
        item.quantity,
        `R${item.price.toFixed(2)}`,
        item.hasPromotion ? `${item.promotionName} (-${this.getPromotionDiscount(item)}%)` : 'No Promotion',
        `R${(item.hasPromotion ? item.discountedPrice : item.price).toFixed(2)}`
    ]);

    // Reduce row height and font size for the table
    pdf.autoTable({
        startY: startY,
        head: [['Item', 'Quantity', 'Unit Price', 'Promotion', 'Final Price']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { top: 20, right: 20, bottom: 40, left: 20 },
        rowPageBreak: 'avoid'
    });

    // Order Summary (adjusted positioning)
    const finalY = (pdf as any).lastAutoTable.finalY + 10;
    pdf.setFontSize(11);
    pdf.text(`Subtotal: R${this.subtotal.toFixed(2)}`, pageWidth - 60, finalY);
    pdf.text(`Discount: R${(this.subtotal - this.discountedSubtotal).toFixed(2)}`, pageWidth - 60, finalY + 8);
    pdf.text(`Tax (15%): R${this.tax.toFixed(2)}`, pageWidth - 60, finalY + 16);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total: R${this.discountedTotal.toFixed(2)}`, pageWidth - 60, finalY + 24);

    return pdf.output('blob');
}
  
  private async uploadPDFToFirebase(pdfBlob: Blob, mysql_order_id: string): Promise<string> {
    try {
      // 1. Upload PDF to Storage first
      const filePath = `orders/${mysql_order_id}/order_${mysql_order_id}.pdf`;
      const fileRef = this.afStorage.ref(filePath);
      await fileRef.put(pdfBlob);
      
      // 2. Get the download URL
      const downloadURL = await fileRef.getDownloadURL().toPromise();
      return downloadURL;
    } catch (error) {
      console.error('Error uploading PDF to Firebase:', error);
      throw error;
    }
  }
  private getPromotionDiscount(item: any): number {
    const promotion = this.promotions.find(p => p.name === item.promotionName);
    return promotion ? promotion.discount_percentage : 0;
  }

// Updated email function to use MySQL order ID
async sendOrderEmail(email: string, pdfBlob: Blob, order_id: string): Promise<void> {
    const loader = await this.loadingController.create({
        message: 'Sending Email...',
        cssClass: 'custom-loader-class'
    });
    await loader.present();

    const url = "http://localhost/user_api/send_email.php";
    const subject = `Order Details - Order #${order_id}`;
    const body = `Please find the attached order details PDF for order #${order_id}.`;
    
    const formData = new FormData();
    formData.append('recipient', email);
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('pdf', pdfBlob, `Order_${order_id}.pdf`);

    this.http.post(url, formData).subscribe(
        async (response) => {
            loader.dismiss();
            this.showToast('Email sent successfully!');
        },
        (error) => {
            loader.dismiss();
            console.error('Error sending email:', error);
            this.showToast('Failed to send email. Please try again.');
        }
    );
}

loadSavedAddresses() {
  if (this.userId) {
    this.http.get<any[]>(`http://localhost/user_api/address.php?user_id=${this.userId}`)
      .pipe(
        catchError(error => {
          console.error('Error loading addresses:', error);
          this.showToast('Failed to load saved addresses');
          return of([]);
        })
      )
      .subscribe(
        (addresses) => {
          console.log('Addresses received:', addresses);
          this.savedAddresses = addresses;
          
          // If there's only one address, select it automatically
          if (addresses.length === 1) {
            this.selectAddress(addresses[0].id);
          }
        }
      );
  }
}

  selectAddress(addressId: number) {
    this.selectedAddressId = addressId;
    this.selectedAddress = this.savedAddresses.find(addr => addr.id === addressId);
  }
  getSelectedAddress() {
    return this.savedAddresses.find(addr => addr.id === this.selectedAddressId);
  }

  async validateOrder(): Promise<boolean> {
    if (this.deliveryMethod === 'delivery' && !this.selectedAddressId) {
      const alert = await this.alertController.create({
        header: 'Address Required',
        message: 'Please select a delivery address before proceeding.',
        buttons: ['OK']
      });
      await alert.present();
      return false;
    }
    return true;
  }

  ngOnDestroy() {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
  }

  hasAnyPromotion() {
    return this.cartItems.some(item => item.hasPromotion);
  }
  
 

  async openPaymentModal() {
    const modal = await this.modalController.create({
      component: PaymentgateComponent
    });
    return await modal.present();
  }

  loadPromotions() {
    this.promotionService.getPromotions().subscribe({
      next: (promotions: any[]) => {
        // Ensure proper data formatting
        this.promotions = promotions.map(promo => ({
          ...promo,
          discount_percentage: parseFloat(promo.discount_percentage),
          product_ids: Array.isArray(promo.product_ids) 
            ? promo.product_ids.map(String) 
            : [String(promo.product_ids)]
        }));
        
        console.log('Formatted promotions:', this.promotions);
        this.applyPromotions(); // Apply promotions after loading
      },
      error: (error) => {
        console.error('Error loading promotions:', error);
        this.showToast('Error loading promotions');
      }
    });
  }

applyPromotions() {
  if (!this.promotions || !this.cartItems) {
    console.warn('Promotions or cart items not loaded yet');
    return;
  }

  console.log('Applying promotions to cart items...'); // Debug log

  this.cartItems.forEach(item => {
    console.log('Processing item:', item); // Debug log
    
    // Ensure we have the original price
    if (!item.originalPrice) {
      item.originalPrice = item.price;
    }

    const applicablePromotion = this.promotions.find(promo => {
      // Convert both to strings for comparison
      const cartItemProductId = String(item.product_id);
      
      // Debug log for promotion checking
      console.log('Checking promotion:', {
        promoName: promo.name,
        promoProductIds: promo.product_ids,
        itemProductId: cartItemProductId,
        isIncluded: promo.product_ids.includes(cartItemProductId)
      });

      const isProductIncluded = promo.product_ids.includes(cartItemProductId);
      const currentDate = new Date();
      const startDate = new Date(promo.start_date);
      const endDate = new Date(promo.end_date);
      const isDateValid = currentDate >= startDate && currentDate <= endDate;
      
      return isProductIncluded && isDateValid;
    });

    if (applicablePromotion) {
      console.log('Found applicable promotion:', applicablePromotion); // Debug log
      
      const discountPercentage = parseFloat(applicablePromotion.discount_percentage);
      const discountAmount = item.originalPrice * (discountPercentage / 100);
      
      item.discountedPrice = this.roundToTwo(item.originalPrice - discountAmount);
      item.hasPromotion = true;
      item.promotionName = applicablePromotion.name;
      item.discountPercentage = discountPercentage;
      
      console.log('Applied promotion to item:', {
        itemName: item.name,
        originalPrice: item.originalPrice,
        discountedPrice: item.discountedPrice,
        promotionName: applicablePromotion.name,
        discountPercentage: discountPercentage
      });
    } else {
      console.log('No applicable promotion found for item:', item.name);
      item.discountedPrice = item.originalPrice;
      item.hasPromotion = false;
      item.promotionName = '';
      item.discountPercentage = 0;
    }
  });

  console.log('Final cart items after applying promotions:', this.cartItems);
  this.calculateTotals();
}

  getUserId() {
    this.userId = sessionStorage.getItem('userId');
    if (!this.userId) {
      console.warn('User is not logged in');
      // You might want to redirect to login page or show a message
    }
  }

  getUserEmail() {
    this.userEmail = sessionStorage.getItem('userEmail');
    if (!this.userEmail) {
      console.warn('User email not found in session storage');
      // You might want to redirect to login page or show a message
    }
  }


  calculateTotals() {
    this.subtotal = this.roundToTwo(
      this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    );
    
    this.discountedSubtotal = this.roundToTwo(
      this.cartItems.reduce((sum, item) => sum + (item.discountedPrice * item.quantity), 0)
    );
    
    this.tax = this.roundToTwo(this.discountedSubtotal * 0.15); // 15% tax
    this.total = this.roundToTwo(this.subtotal + this.tax);
    this.discountedTotal = this.roundToTwo(this.discountedSubtotal + this.tax);
  }

  calculateTotals2() {
    this.subtotal = this.cartItems.reduce((total, item) => {
      return total + (item.originalPrice || item.price) * item.quantity;
    }, 0);
  
    this.discountedSubtotal = this.cartItems.reduce((total, item) => {
      const priceToUse = item.discountedPrice || item.price;
      return total + (priceToUse * item.quantity);
    }, 0);
  
    this.tax = this.discountedSubtotal * 0.175; // 17.5% tax
    this.total = this.subtotal + this.tax;
    this.discountedTotal = this.discountedSubtotal + this.tax;
  
    // Update the display
    this.cd.detectChanges();
  }
  
  // Update the cart page HTML template to show both original and discounted prices

  ensureValidNumber(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  removeItem(productId: number) {
    console.log('removeItem: Attempting to remove item with productId:', productId);
    this.cartService.removeFromCart(productId).subscribe({
      next: () => {
        console.log('removeItem: Item successfully removed from cart');
        this.showToast('Item removed from cart');
        this.loadCart();
      },
      error: (error: Error) => {
        this.showToast(`Failed to remove item from cart: ${error.message}`);
      }
    });
}

async updateQuantity(productId: number, newQuantity: number) {
  console.log('updateQuantity: Attempting to update quantity for productId:', productId, 'with new quantity:', newQuantity);
  if (newQuantity < 1) {
    console.log('updateQuantity: New quantity is less than 1, removing item with productId:', productId);
    this.removeItem(productId);
    return;
  }
  
  try {
    const response = await this.http.get<{quantity: number}>(
      `http://localhost/user_api/products.php?check_quantity=1&product_id=${productId}`
    ).toPromise();

    if (response && newQuantity <= response.quantity) {
      this.cartService.updateQuantity(productId, newQuantity).subscribe({
        next: () => {
          this.showToast('Quantity updated');
          this.loadCart();
        },
        error: (error) => {
          this.showToast(`Failed to update quantity for productId ${productId}: ${error.message}`);
        }
      });
    } else {
      const availableQuantity = response ? response.quantity : 0;
      this.showToast(`Sorry, only ${availableQuantity} units are available for this product.`);
      // Update to the maximum available quantity
      if (availableQuantity > 0) {
        this.cartService.updateQuantity(productId, availableQuantity).subscribe({
          next: () => {
            this.showToast(`Quantity updated to maximum available: ${availableQuantity}`);
            this.loadCart();
          },
          error: (error) => {
            this.showToast(`Failed to update quantity for productId ${productId}: ${error.message}`);
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error checking quantity for product ${productId}:`, error);
    this.showToast('Error checking product availability. Please try again.');
  }
}

async enterCustomQuantity(productId: number) {
  const item = this.cartItems.find(i => i.product_id === productId);
  if (!item) return;

  const alert = await this.alertController.create({
    header: 'Enter Quantity',
    inputs: [
      {
        name: 'quantity',
        type: 'number',
        placeholder: 'Enter quantity',
        min: 1,
        value: item.quantity.toString()
      }
    ],
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Update',
        handler: async (data) => {
          const newQuantity = parseInt(data.quantity, 10);
          if (isNaN(newQuantity) || newQuantity < 1) {
            this.showToast('Please enter a valid quantity');
            return false;
          }

          try {
            const response = await this.http.get<{quantity: number}>(
              `http://localhost/user_api/products.php?check_quantity=1&product_id=${productId}`
            ).toPromise();

            if (response && newQuantity <= response.quantity) {
              this.updateQuantity(productId, newQuantity);
              return true;
            } else {
              const availableQuantity = response ? response.quantity : 0;
              this.showToast(`Sorry, only ${availableQuantity} units are available for this product.`);
              return false;
            }
          } catch (error) {
            console.error(`Error checking quantity for product ${productId}:`, error);
            this.showToast('Error checking product availability. Please try again.');
            return false;
          }
        }
      }
    ]
  });

  await alert.present();
}

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }

  decreaseQuantity(productId: number) {
    const item = this.cartItems.find(i => i.product_id === productId);
    if (item && item.quantity > 1) {
      this.updateQuantity(productId, item.quantity - 1);
    } else if (item && item.quantity === 1) {
      // If the quantity is 1, removing the item instead of setting it to zero
      this.removeItem(productId);
    }
  }
  

  async increaseQuantity(productId: number) {
    const item = this.cartItems.find(i => i.product_id === productId);
    if (item) {
      try {
        const response = await this.http.get<{quantity: number}>(
          `http://localhost/user_api/products.php?check_quantity=1&product_id=${productId}`
        ).toPromise();
  
        if (response && item.quantity < response.quantity) {
          // There's still stock available, so we can increase the quantity
          this.updateQuantity(productId, item.quantity + 1);
        } else {
          // Show an alert or toast that max quantity has been reached
          const alert = await this.alertController.create({
            header: 'Maximum Quantity Reached',
            message: `Sorry, there are only ${response ? response.quantity : item.quantity} units available for this product.`,
            buttons: ['OK']
          });
          await alert.present();
        }
      } catch (error) {
        console.error(`Error checking quantity for product ${productId}:`, error);
        this.showToast('Error checking product availability. Please try again.');
      }
    }
  }

  
async addNewAddress() {
  const alert = await this.alertController.create({
    header: 'Add New Address',
    cssClass: 'address-alert',
    inputs: [
      {
        name: 'address_line1',
        type: 'text',
        placeholder: 'Address Line 1 *',
        cssClass: 'address-input'
      },
      {
        name: 'address_line2',
        type: 'text',
        placeholder: 'Address Line 2',
        cssClass: 'address-input'
      },
      {
        name: 'city',
        type: 'text',
        placeholder: 'City *',
        cssClass: 'address-input'
      },
      {
        name: 'province',
        type: 'text',
        placeholder: 'Province',
        cssClass: 'address-input'
      },
      {
        name: 'postal_code',
        type: 'text',
        placeholder: 'Postal Code',
        cssClass: 'address-input'
      },
      {
        name: 'country',
        type: 'text',
        placeholder: 'Country *',
        cssClass: 'address-input'
      }
    ],
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
        handler: () => {
          return true; // Dismiss the alert
        }
      },
      {
        text: 'Add',
        handler: (data) => {
          if (!data.address_line1 || !data.city || !data.country) {
            this.showErrorToast('Please fill in all required fields.');
            return false;
          }

          const newAddress = {
            user_id: this.userId,
            address_line1: data.address_line1,
            address_line2: data.address_line2,
            city: data.city,
            province: data.province,
            postal_code: data.postal_code,
            country: data.country
          };

          this.http.post('http://localhost/user_api/address.php', newAddress)
            .pipe(
              catchError(error => {
                console.error('Error adding address:', error);
                this.showErrorToast('Failed to add address');
                return throwError(error);
              })
            )
            .subscribe({
              next: (response: any) => {
                console.log('Server response:', response);
                if (response && (response.status === 201 || response.success)) {
                  this.showToast('Address added successfully');
                  this.loadSavedAddresses();
                } else {
                  this.showErrorToast('Failed to add address: ' + (response.message || 'Unknown error'));
                }
              }
            });

          return true;
        }
      }
    ]
  });

  await alert.present();
}

deleteAddress(addressId: number) {
  if (this.userId) {
    this.http.delete('http://localhost/user_api/address.php', {
      body: { address_id: addressId, user_id: this.userId },
      responseType: 'text'
    }).pipe(
      map(response => {
        try {
          return JSON.parse(response);
        } catch (e) {
          console.error('Error parsing response:', e);
          return { status: 200, message: 'Address might have been deleted successfully' };
        }
      }),
      catchError(this.handleError<any>('deleteAddress'))
    ).subscribe({
      next: (response: any) => {
        if (response && (response.status === 200 || response.message.includes('successfully'))) {
          this.showToast('Address deleted successfully');
          this.loadSavedAddresses();
        } else {
          this.showErrorToast('Failed to delete address');
        }
      }
    });
  }
}

private handleError<T>(operation = 'operation', result?: T) {
  return (error: any): Observable<T> => {
    console.error(`${operation} failed:`, error);
    
    // If the error is actually a successful response
    if (error instanceof HttpErrorResponse && error.status === 200) {
      try {
        const parsedResponse = JSON.parse(error.error.text);
        if (parsedResponse.status === 200 || parsedResponse.message.includes('successfully')) {
          return of(parsedResponse as T);
        }
      } catch (e) {
        console.error('Error parsing successful response:', e);
      }
    }

    // Let the app keep running by returning an empty result.
    return of(result as T);
  };
}

  async showErrorToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: 'danger'
    });
    toast.present();
  }
  

  async checkProductQuantities(): Promise<{isValid: boolean, invalidItems: {name: string, availableQuantity: number}[]}> {
    const invalidItems: {name: string, availableQuantity: number}[] = [];
    let isValid = true;
  
    for (const item of this.cartItems) {
      try {
        const response = await this.http.get<{quantity: number}>(
          `http://localhost/user_api/products.php?check_quantity=1&product_id=${item.product_id}`
        ).toPromise();
  
        if (response && item.quantity > response.quantity) {
          isValid = false;
          invalidItems.push({name: item.name, availableQuantity: response.quantity});
        }
      } catch (error) {
        console.error(`Error checking quantity for product ${item.product_id}:`, error);
        // Assume invalid if we can't check
        isValid = false;
        invalidItems.push({name: item.name, availableQuantity: 0});
      }
    }
  
    return {isValid, invalidItems};
  }

  

  
}