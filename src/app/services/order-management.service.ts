import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { PromotionService } from '../services/promotion.service';
import { CartService } from '../services/cart.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';

// Interfaces
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
  discountedPrice?: number;
  hasPromotion?: boolean;
  promotionName?: string;
}

interface CartItem {
  product_id: number;
  quantity: number;
  price: number;
  discountedPrice: number;
  name: string;
  stock_quantity: number;
  hasPromotion?: boolean;
  promotionName?: string;
}

interface OrderResponse {
  success: boolean;
  message: string;
  order_id: number;
}

interface SaleResponse {
  success: boolean;
  message: string;
  sale_id: number;
}

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => void;
}

@Injectable({
  providedIn: 'root'
})
export class OrderManagementService {
  private readonly API_BASE_URL = 'http://localhost/user_api';

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private http: HttpClient,
    private router: Router,
    private promotionService: PromotionService,
    private cartService: CartService,
    private firestore: AngularFirestore
  ) { }

  private async validatePurchasePrerequisites(userId: string, cart: CartItem[]): Promise<void> {
    if (!userId) {
      throw new Error('User is not logged in. Please log in to complete the purchase.');
    }
    
    if (!cart?.length) {
      throw new Error('Your cart is empty. Please add items before checking out.');
    }

    const outOfStockItems = cart.filter(item => item.quantity > item.stock_quantity);
    if (outOfStockItems.length > 0) {
      const itemNames = outOfStockItems.map(item => item.name).join(', ');
      throw new Error(`The following items do not have enough stock: ${itemNames}`);
    }
  }

  private createOrderData(userId: string, cart: CartItem[], total: number, subtotal: number): any {
    return {
      user_id: userId,
      total_amount: total,
      discounted_amount: subtotal,
      order_type: 'walk-in',
      status: 'checked-out',
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discounted_price: item.discountedPrice
      }))
    };
  }

  private createSaleData(orderId: number, userId: string, total: number, 
    paymentType: string, amountPaid: number): any {
    return {
      order_id: orderId,
      cashier_id: userId,
      total_amount: total,
      payment_method: paymentType,
      amount_paid: paymentType === 'cash' ? amountPaid : total
    };
  }

  private async updateInventory(cart: CartItem[]): Promise<void> {
    try {
      const updatePromises = cart.map(item =>
        lastValueFrom(this.http.put(`${this.API_BASE_URL}/update_stock.php`, {
          product_id: item.product_id,
          quantity: item.stock_quantity - item.quantity
        }))
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw new Error('Failed to update inventory. Please contact support.');
    }
  }

  private async generateOrderPDF(
    cartItems: CartItem[],
    userEmail: string,
    deliveryMethod: string,
    selectedAddress: any,
    subtotal: number,
    discountedSubtotal: number,
    tax: number,
    discountedTotal: number
  ): Promise<Blob> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;

    // Set font
    pdf.setFont("helvetica", "normal");

    // Add header
    pdf.setFontSize(20);
    pdf.text("Invoice", pageWidth / 2, 20, { align: "center" });

    // Add order details
    pdf.setFontSize(12);
    const orderId = Date.now().toString();
    pdf.text(`Order ID: ${orderId}`, 20, 40);

    // Add customer details
    const customerName = sessionStorage.getItem('userName') || 'N/A';
    const customerSurname = sessionStorage.getItem('userSurname') || 'N/A';
    pdf.text(`Name: ${customerName} ${customerSurname}`, 20, 50);
    pdf.text(`Email: ${userEmail}`, 20, 60);

    // Add delivery address if applicable
    let yPos = 70;
    if (deliveryMethod === 'delivery' && selectedAddress) {
      pdf.text("Delivery Address:", 20, yPos);
      yPos += 10;
      pdf.text(selectedAddress.address_line1, 20, yPos);
      if (selectedAddress.address_line2) {
        yPos += 10;
        pdf.text(selectedAddress.address_line2, 20, yPos);
      }
      yPos += 10;
      pdf.text(`${selectedAddress.city}, ${selectedAddress.province} ${selectedAddress.postal_code}`, 20, yPos);
      yPos += 10;
      pdf.text(selectedAddress.country, 20, yPos);
      yPos += 20;
    }

    // Add order items table
    const columns = ["Item", "Quantity", "Price", "Total"];
    const data = cartItems.map(item => [
      item.name,
      item.quantity.toString(),
      `R${item.price.toFixed(2)}`,
      `R${(item.price * item.quantity).toFixed(2)}`
    ]);

    (pdf as any).autoTable({
      head: [columns],
      body: data,
      startY: yPos,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { top: 20 },
    });

    yPos = (pdf as any).lastAutoTable.finalY + 20;

    // Add price details
    pdf.setFontSize(12);
    pdf.text(`Subtotal: R${subtotal.toFixed(2)}`, pageWidth - 70, yPos);
    yPos += 10;
    pdf.text(`Discounted Subtotal: R${discountedSubtotal.toFixed(2)}`, pageWidth - 70, yPos);
    yPos += 10;
    pdf.text(`Tax (15%): R${tax.toFixed(2)}`, pageWidth - 70, yPos);
    yPos += 10;
    pdf.setFontSize(14);
    pdf.text(`Total: R${discountedTotal.toFixed(2)}`, pageWidth - 70, yPos);

    return pdf.output('blob');
  }

  private async sendOrderEmail(userEmail: string, pdfBlob: Blob): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('email', userEmail);
      formData.append('pdf', pdfBlob, 'order.pdf');

      await lastValueFrom(this.http.post(`${this.API_BASE_URL}/send_order_email.php`, formData));
    } catch (error) {
      console.error('Error sending order email:', error);
      throw new Error('Failed to send order confirmation email.');
    }
  }

  private async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    await toast.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async purchaseProducts(
    userId: string,
    userEmail: string,
    cart: CartItem[],
    deliveryMethod: string,
    selectedAddress: any,
    promotions: any[],
    subtotal: number,
    discountedSubtotal: number,
    tax: number,
    discountedTotal: number,
  ): Promise<void> {
    try {
      console.log('Starting order placement process');

      // Validate prerequisites
      await this.validatePurchasePrerequisites(userId, cart);

      // Generate and send PDF
      const pdfBlob = await this.generateOrderPDF(
        cart,
        userEmail,
        deliveryMethod,
        selectedAddress,
        subtotal,
        discountedSubtotal,
        tax,
        discountedTotal
      );
      await this.sendOrderEmail(userEmail, pdfBlob);

      // Prepare order data
      const orderData = {
        user_id: userId,
        total_amount: subtotal,
        discounted_amount: discountedTotal,
        order_type: deliveryMethod,
        status: 'pending',
        items: cart.map(item => ({
          ...item,
          applied_promotion: item.hasPromotion ? {
            name: item.promotionName,
            discount_percentage: promotions.find(p => p.name === item.promotionName)?.discount_percentage
          } : null
        })),
        created_at: new Date().toISOString()
      };

      // Create order in database
      const response = await lastValueFrom(this.http.post<OrderResponse>(
        `${this.API_BASE_URL}/orders.php`,
        orderData
      ));

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to create order');
      }

      // Store order in Firestore
      const firestoreOrderId = Date.now().toString();
      await this.firestore.collection('orders').doc(firestoreOrderId).set({
        ...orderData,
        firestore_order_id: firestoreOrderId
      });

      // Update inventory
      await this.updateInventory(cart);

      // Clear cart
      await lastValueFrom(this.cartService.clearAllItems());

      // Show success message
      await this.showAlert(
        'Order Placed',
        `Your order for R${discountedTotal.toFixed(2)} has been placed successfully!`
      );

    } catch (error) {
      console.error('Error in order placement process:', error);
      await this.showAlert(
        'Error',
        error instanceof Error ? error.message : 'There was an error completing the order. Please try again.'
      );
      throw error;
    }
  }
}