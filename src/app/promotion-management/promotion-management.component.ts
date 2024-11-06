import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Promotion {
  promotion_id?: number;
  name: string;
  description: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  product_ids: number[];
  product_names: string[];
  image_url?: string;
}

interface Product {
  product_id: number;
  name: string;
}

@Component({
  selector: 'app-promotion-management',
  templateUrl: './promotion-management.component.html',
  styleUrls: ['./promotion-management.component.scss']
})
export class PromotionManagementComponent implements OnInit {
  promotions: Promotion[] = [];
  products: Product[] = [];
  promotionForm: FormGroup;
  editMode = false;
  currentPromotionId?: number;
  selectedFile: File | null = null;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private toastController: ToastController,
    private firestore: AngularFirestore,
    private storage: AngularFireStorage
  ) {
    this.promotionForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      discount_percentage: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      product_ids: [[], Validators.required],
      image_url: ['']
    });
  }

  ngOnInit() {
    this.loadProducts();
    this.loadPromotions();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }

  async uploadImage(): Promise<string> {
    if (!this.selectedFile) {
      return '';
    }

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `promotions/${Date.now()}_${this.selectedFile.name}`);
      await uploadBytes(storageRef, this.selectedFile);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Store URL in localStorage as fallback
      localStorage.setItem(`promotion_image_${this.currentPromotionId || 'new'}`, downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  loadProducts() {
    this.http.get<Product[]>('http://localhost/user_api/products.php')
      .subscribe(
        data => {
          this.products = data;
        },
        (error: HttpErrorResponse) => {
          this.showToast('Failed to load products.', 'danger');
        }
      );
  }

  loadPromotions() {
    this.http.get<Promotion[]>('http://localhost/user_api/promotions.php')
      .subscribe(
        data => {
          this.promotions = data;
        },
        (error: HttpErrorResponse) => {
          this.showToast('Failed to load promotions.', 'danger');
        }
      );
  }

  async onSubmit() {
    if (this.promotionForm.valid) {
      try {
        let imageUrl = '';
        if (this.selectedFile) {
          imageUrl = await this.uploadImage();
        }

        const promotion = {
          ...this.promotionForm.value,
          image_url: imageUrl || this.promotionForm.value.image_url
        };

        if (this.editMode && this.currentPromotionId) {
          this.http.put(`http://localhost/user_api/promotions.php?id=${this.currentPromotionId}`, promotion)
            .subscribe(
              (response) => {
                this.loadPromotions();
                this.resetForm();
                this.showToast('Promotion updated successfully.', 'success');
              },
              this.handleError.bind(this)
            );
        } else {
          this.http.post('http://localhost/user_api/promotions.php', promotion)
            .subscribe(
              (response) => {
                this.loadPromotions();
                this.resetForm();
                this.showToast('Promotion added successfully.', 'success');
              },
              this.handleError.bind(this)
            );
        }
      } catch (error) {
        this.handleError(error as HttpErrorResponse);
      }
    } else {
      this.showToast('Please fill in all required fields correctly.', 'warning');
    }
  }

  getImageUrl(promotion: Promotion): string {
    // Try to get image from promotion first, then fallback to localStorage
    return promotion.image_url || 
           localStorage.getItem(`promotion_image_${promotion.promotion_id}`) || 
           'assets/default-promotion.jpg';
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && error.error.message) {
        errorMessage += `\nServer message: ${error.error.message}`;
      }
    }
    console.error(errorMessage);
    this.showToast(errorMessage, 'danger');
  }

  editPromotion(promotion: Promotion) {
    this.editMode = true;
    this.currentPromotionId = promotion.promotion_id;
    this.promotionForm.patchValue({
      ...promotion,
      product_ids: promotion.product_ids || []
    });
  }

  deletePromotion(id?: number) {
    if (id && confirm('Are you sure you want to delete this promotion?')) {
      this.http.delete(`http://localhost/user_api/promotions.php?id=${id}`)
        .subscribe(
          () => {
            this.loadPromotions();
            this.showToast('Promotion deleted successfully.', 'success');
          },
          (error: HttpErrorResponse) => {
            this.showToast('Failed to delete promotion.', 'danger');
          }
        );
    }
  }

  resetForm() {
    this.editMode = false;
    this.currentPromotionId = undefined;
    this.promotionForm.reset();
  }

  compareProducts(p1: number, p2: number) {
    return p1 === p2;
  }
}