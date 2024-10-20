// stock-request.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AlertController, LoadingController, ModalController, ToastController } from '@ionic/angular';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => void;
}

interface Product {
  product_id: number;
  name: string;
  category: string;
  stock_quantity: number;
  barcode: string;
  description: string;
  price: number;
  image_url: string;
  additional_images?: string[];
  sales_count?: number;
  last_sale_date?: Date;
  movement_rate?: number;
  movement_category?: 'fast' | 'medium' | 'slow';
  total_quantity_out: number;
  monthly_movement: number;
}

interface SelectedProduct extends Product {
  quantity: number;
}

@Component({
  selector: 'app-stock-request',
  templateUrl: './stock-request.component.html',
  styleUrls: ['./stock-request.component.scss'],
})
export class StockRequestComponent implements OnInit {
  products: Product[] = [];
  lowStockAlert: Product[] = [];
  filteredProducts: Product[] = [];
  selectedProducts: SelectedProduct[] = [];
  productForm: FormGroup;
  stockRequestForm: FormGroup;

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private firestore: AngularFirestore,
    private storage: AngularFireStorage,
    private modalController: ModalController,
    private formBuilder: FormBuilder
  ) {
    this.productForm = this.formBuilder.group({
      product_id: ['', Validators.required],
      quantity: ['', [Validators.required, Validators.min(1)]]
    });

    this.stockRequestForm = this.formBuilder.group({
      supplierEmail: ['', [Validators.required, Validators.email]],
      message: ['']
    });

    
  }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.http.get<Product[]>('http://localhost/user_api/products.php')
      .subscribe(
        data => {
          this.products = data;
          this.updateProductLists();
        },
        (error: HttpErrorResponse) => {
          console.error('Error fetching products:', error);
          this.presentToast('Error loading products: ' + error.message, 'danger');
        }
      );
  }

  updateProductLists() {
    const sortedProducts = [...this.products].sort((a, b) => b.stock_quantity - a.stock_quantity);
    this.lowStockAlert = this.products.filter(p => p.stock_quantity < 75);
  }

  addToList() {
    if (this.productForm.valid) {
      const productId = this.productForm.get('product_id')?.value;
      const quantity = this.productForm.get('quantity')?.value;
      const selectedProduct = this.products.find(p => p.product_id === productId);

      if (selectedProduct) {
        const existingIndex = this.selectedProducts.findIndex(p => p.product_id === productId);
        if (existingIndex !== -1) {
          this.selectedProducts[existingIndex].quantity += quantity;
        } else {
          this.selectedProducts.push({ ...selectedProduct, quantity });
        }
        this.productForm.reset();
        this.presentToast('Product added to the list', 'success');
      }
    } else {
      this.presentToast('Please select a product and enter a valid quantity', 'warning');
    }
  }

  removeFromList(index: number) {
    this.selectedProducts.splice(index, 1);
  }

  async presentToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  closeModal() {
    this.modalController.dismiss();
  }

  async requestNewStock() {
    if (this.stockRequestForm.valid && this.selectedProducts.length > 0) {
      const supplierEmail = this.stockRequestForm.get('supplierEmail')?.value;
      const message = this.stockRequestForm.get('message')?.value;

      const pdf = await this.generatePDF(message);
      await this.sendOrderEmail(supplierEmail, pdf, message);
    } else {
      this.presentToast('Please fill in all required fields and select at least one product.', 'warning');
    }
  }

  async generatePDF(message: string): Promise<Blob> {
    const pdf = new jsPDF() as jsPDFWithAutoTable;
    const pageWidth = pdf.internal.pageSize.width;

    // Add header
    pdf.setFontSize(20);
    pdf.text("Stock Request", pageWidth / 2, 20, { align: "center" });

    // Add message
    if (message) {
      pdf.setFontSize(12);
      pdf.text(message, 20, 40);
    }

    // Add table
    const columns = ["Product Name", "Quantity"];
    const data = this.selectedProducts.map(product => [product.name, product.quantity.toString()]);

    pdf.autoTable({
      head: [columns],
      body: data,
      startY: message ? 60 : 40,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { top: 20 },
    });

    return pdf.output('blob');
  }

  async sendOrderEmail(email: string, pdfBlob: Blob, message: string): Promise<void> {
    const loader = await this.loadingController.create({
      message: 'Sending Email...',
      cssClass: 'custom-loader-class'
    });
    await loader.present();

    const url = "http://localhost/user_api/send_email.php";
    const subject = "Stock Request";
    const body = message + "\n\nPlease find the attached stock request details PDF.";

    const formData = new FormData();
    formData.append('recipient', email);
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('pdf', pdfBlob, `StockRequest_${new Date().getTime()}.pdf`);

    this.http.post(url, formData).subscribe(
      async (response) => {
        loader.dismiss();
        this.presentToast('Email sent successfully!', 'success');
        this.selectedProducts = []; // Clear the selected products
        this.stockRequestForm.reset(); // Reset the form
      },
      (error) => {
        loader.dismiss();
        console.error('Error sending email:', error);
        this.presentToast('Failed to send email. Please try again.', 'danger');
      }
    );
  }

}