import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AlertController, ToastController, IonModal, LoadingController } from '@ionic/angular';
import { catchError, tap } from 'rxjs/operators';
import { Observable, of, throwError } from 'rxjs';
import { AngularFirestore, DocumentSnapshot } from '@angular/fire/compat/firestore';

interface User {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}


@Component({
  selector: 'app-admin-order-management',
  templateUrl: './admin-order-management.page.html',
  styleUrls: ['./admin-order-management.page.scss'],
})
export class AdminOrderManagementPage implements OnInit {
  @ViewChild('updateStatusModal') updateStatusModal!: IonModal;
  @ViewChild('viewOrderModal') viewOrderModal!: IonModal;
  currentOrderDetails: any = null;
  currentUserDetails: User | null = null;
  
  orderData: any[] = [];
  selectedStatus: string = '';
  currentOrder: any = null;
  searchTerm: string = '';
  filterType: string = '';
  filterValue: string = '';
  filteredOrderData: any[] = [];

  itemsPerPage: number = 10;
  currentPage: number = 1;
  firebaseDocument: any = null;

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private firestore: AngularFirestore
  ) { }

  ngOnInit() {
    this.fetchOrders();
  }

  get totalPages(): number {
    return Math.ceil(this.orderData.length / this.itemsPerPage);
  }

  get paginatedOrderData(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.orderData.slice(start, start + this.itemsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  fetchOrders() {
    this.http.get<{ orderData: any[] }>('http://localhost/user_api/orders.php')
      .subscribe(
        response => {
          this.orderData = response.orderData;
        },
        error => {
          console.error('Error fetching orders:', error);
          this.presentToast('Failed to fetch orders', 'danger');
        }
      );
  }

  applyFilters() {
    this.filteredOrderData = this.orderData.filter(order => {
      const matchesSearch = this.searchTerm ? order.order_id.toString().includes(this.searchTerm) : true;
      let matchesFilter = true;

      if (this.filterType === 'status' && this.filterValue) {
        matchesFilter = order.status.toLowerCase() === this.filterValue.toLowerCase();
      } else if (this.filterType === 'date' && this.filterValue) {
        const orderDate = new Date(order.created_at).toDateString();
        const filterDate = new Date(this.filterValue).toDateString();
        matchesFilter = orderDate === filterDate;
      }

      return matchesSearch && matchesFilter;
    });
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value;
    this.applyFilters();
  }

  onFilterTypeChange(event: any) {
    this.filterType = event.detail.value;
    this.filterValue = ''; // Reset filter value when type changes
    this.applyFilters();
  }

  onFilterValueChange(event: any) {
    this.filterValue = event.detail.value;
    this.applyFilters();
  }

  async viewOrderDetails(order: any) {
    const loader = await this.loadingController.create({
      message: 'Loading order details...',
    });
    await loader.present();

    this.http.get(`http://localhost/user_api/orders.php?id=${order.order_id}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching order details:', error);
          this.presentToast('Failed to fetch order details', 'danger');
          return throwError(() => error);
        })
      )
      .subscribe(async (response: any) => {
        if (response.success) {
          this.currentOrderDetails = response.order;
          this.currentUserDetails = response.user;
          console.log('Current User Details:', this.currentUserDetails);
          
          // Fetch Firebase document
          await this.fetchFirebaseDocument(order.order_id);
          
          loader.dismiss();
          await this.viewOrderModal.present();
        } else {
          loader.dismiss();
          this.presentToast(response.message || 'Failed to fetch order details', 'danger');
        }
      });
  }

  async fetchFirebaseDocument(orderId: string) {
    try {
      const docRef = this.firestore.collection('uploads').doc(orderId);
      const docSnapshot = await docRef.get().toPromise();
      
      if (docSnapshot && docSnapshot.exists) {
        this.firebaseDocument = docSnapshot.data();
        console.log('Firebase document:', this.firebaseDocument);
      } else {
        this.firebaseDocument = null;
        console.log('No matching document in Firebase');
      }
    } catch (error) {
      console.error('Error fetching Firebase document:', error);
      this.firebaseDocument = null;
    }
  }

  openDocument(url: string) {
    if (url) {
      window.open(url, '_blank');

    } else {
      this.presentToast('Document URL is not available', 'danger');
    }
  }


  fetchUserDetails(userId: number): Observable<User> {
    return this.http.get<User>(`http://localhost/user_api/register.php?id=${userId}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching user details:', error);
          this.presentToast('Failed to fetch user details', 'danger');
          return throwError(() => error);
        })
      );
  }

  async sendOrderStatusUpdateEmail(order: any, newStatus: string): Promise<void> {
    if (!this.currentUserDetails || !this.currentUserDetails.email) {
      console.error('Invalid user details:', this.currentUserDetails);
      await this.presentToast('Failed to send email: Invalid user email', 'danger');
      return;
    }

    const loader = await this.loadingController.create({
      message: 'Sending Email...',
      cssClass: 'custom-loader-class'
    });
    await loader.present();

    const user = this.currentUserDetails;
    const url = "http://localhost/user_api/send_email.php";
    const subject = "Order Status Update";

    const body = `
      Dear ${user.first_name} ${user.last_name},

      We are writing to inform you that the status of your order (Order ID: ${order.order_id}) has been updated.

      New Status: ${newStatus}

      Order Details:
      Order ID: ${order.order_id}
      Total Amount: ${order.total_amount || 'N/A'}
      Order Type: ${order.order_type || 'N/A'}
      Date Placed: ${order.created_at || 'N/A'}

      If you have any questions or concerns about this update, please don't hesitate to contact our customer support team.

      Thank you for your business!

      Best regards,
      The Order Management Team
    `;
    
    const formData = new FormData();
    formData.append('recipient', user.email);
    formData.append('subject', subject);
    formData.append('body', body);

    this.http.post(url, formData).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error sending email:', error);
        return throwError(() => new Error(error.message));
      })
    ).subscribe(
      async (response: any) => {
        loader.dismiss();
        if (response && response.message) {
          await this.presentToast('Status update email sent successfully!', 'success');
        } else if (response && response.error) {
          console.error('Email sending failed:', response.error);
          await this.presentToast(`Failed to send status update email: ${response.error}`, 'danger');
        } else {
          console.error('Unexpected response:', response);
          await this.presentToast('Failed to send status update email. Unexpected server response.', 'danger');
        }
      },
      async (error) => {
        loader.dismiss();
        console.error('Error sending email:', error);
        await this.presentToast(`Failed to send status update email: ${error.message}`, 'danger');
      }
    );
  }

  async openUpdateStatusModal(order: any) {
    this.currentOrder = order;
    this.selectedStatus = order.status;
    this.updateStatusModal.present();
  }

  async updateOrderStatus() {
    if (!this.currentOrderDetails || !this.selectedStatus) {
      console.error('Validation Error:', {
        currentOrderDetails: this.currentOrderDetails,
        selectedStatus: this.selectedStatus
      });
      this.presentToast('Please select a status', 'danger');
      return;
    }

    const loader = await this.loadingController.create({
      message: 'Updating order status...',
    });
    await loader.present();

    console.log('Attempting to update order:', {
      orderId: this.currentOrderDetails.order_id,
      currentStatus: this.currentOrderDetails.status,
      newStatus: this.selectedStatus,
      timestamp: new Date().toISOString()
    });

    const updateData = {
      status: this.selectedStatus,
      previousStatus: this.currentOrderDetails.status
    };

    this.http.put(`http://localhost/user_api/orders.php?id=${this.currentOrderDetails.order_id}`, updateData)
      .pipe(
        tap(response => {
          console.log('Server Response:', {
            response,
            timestamp: new Date().toISOString()
          });
        }),
        catchError(this.handleError<any>('updateOrderStatus'))
      )
      .subscribe({
        next: async (response: any) => {
          loader.dismiss();
          if (response && response.success) {
            this.presentToast('Order status updated successfully', 'success');
            this.fetchOrders();
            
            // Send email to user about order status update
            await this.sendOrderStatusUpdateEmail(this.currentOrderDetails, this.selectedStatus);
            
            this.viewOrderModal.dismiss();
          } else {
            this.presentToast(response && response.message || 'Failed to update order status', 'danger');
          }
        },
        error: (error) => {
          loader.dismiss();
          console.error('Error updating order status:', error);
          this.presentToast('Failed to update order status', 'danger');
        }
      });
  }

  private calculateQuantityChanges(orderItems: any[], currentStatus: string, newStatus: string): any[] {
    const changes = [];
    const shouldSubtract = newStatus === 'order-processed';
    const shouldRestore = (currentStatus === 'order-processed') && (newStatus === 'pending' || newStatus === 'payment-received');

    if (shouldSubtract || shouldRestore) {
      for (const item of orderItems) {
        changes.push({
          product_id: item.product_id,
          quantity: shouldSubtract ? -item.quantity : item.quantity
        });
      }
    }

    return changes;
  }

  async deleteOrder(order: any) {
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: 'Are you sure you want to delete this order?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: () => {
            this.http.delete(`http://localhost/user_api/orders.php?id=${order.order_id}`)
              .pipe(
                catchError(error => {
                  console.error('Error deleting order:', error);
                  this.presentToast('Failed to delete order', 'danger');
                  return throwError(() => error);
                })
              )
              .subscribe((response: any) => {
                if (response.success) {
                  this.presentToast('Order deleted successfully', 'success');
                  this.fetchOrders();
                } else {
                  this.presentToast(response.message || 'Failed to delete order', 'danger');
                }
              });
          }
        }
      ]
    });

    await alert.present();
  }

  private async presentToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      this.presentToast(`${operation} failed. Please try again.`, 'danger');
      return of(result as T);
    };
  }
}