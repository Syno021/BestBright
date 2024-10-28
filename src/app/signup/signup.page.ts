import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router'; // Import Router
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
})
export class SignupPage implements OnInit {
  isRegister = false;
  showLoginPassword = false;
  showRegisterPassword = false;
  showRegisterConfirmPassword = false;

  userData = {
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    
  };

  loginData = {
    email: '',
    password: ''
  };

  

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router, // Inject Router
    private cartService: CartService
  ) {}



  ngOnInit() {
    // Initialize any necessary data or perform any required setup
  }
  togglePasswordVisibility(field: 'login' | 'register' | 'registerConfirm') {
    switch (field) {
      case 'login':
        this.showLoginPassword = !this.showLoginPassword;
        break;
      case 'register':
        this.showRegisterPassword = !this.showRegisterPassword;
        break;
      case 'registerConfirm':
        this.showRegisterConfirmPassword = !this.showRegisterConfirmPassword;
        break;
    }
  }

  async submitForm() {
    if (this.isRegister) {
      if (!this.validateForm()) {
        return;
      }

      const registerData = {
        ...this.userData,
        role: 'customer'
      };

      this.http.post('http://localhost/user_api/register.php', registerData)
        .subscribe({
          next: async (response: any) => {
            console.log('Registration response:', response);
            if (response.status === 1) {
              await this.presentToast('Registration successful', 'success');
              this.clearFields();
            } else {
              await this.presentToast('Registration failed: ' + response.message, 'danger');
            }
          },
          error: async (error: HttpErrorResponse) => {
            console.error('Error during registration:', error);
            await this.presentToast('Error during registration: ' + error.message, 'danger');
          }
        });
    } else {
      // Login logic
      this.http.post('http://localhost/user_api/login.php', this.loginData)
        .subscribe({
          next: async (response: any) => {
            if (response.status === 1) {
              // Store user info in session storage
              sessionStorage.setItem('userEmail', response.email);
              sessionStorage.setItem('userRole', response.role);
              sessionStorage.setItem('userId', response.user_id);
              sessionStorage.setItem('username', response.username);

              // Sync local cart with server
              try {
                await this.cartService.syncLocalCartWithServer(response.user_id).toPromise();
                console.log('Local cart synced with server');
              } catch (syncError) {
                console.error('Error syncing cart:', syncError);
                // Continue with login process even if sync fails
              }

              await this.presentToast('Login successful', 'success');

              // Log user details
              console.log("User logged in:", {
                email: response.email,
                userId: response.user_id,
                username: response.username
              });

              // Navigate based on role
              switch (response.role) {
                case 'admin':
                  this.router.navigate(['/admin-dashboard']);
                  break;
                case 'cashier':
                  this.router.navigate(['/pos']);
                  break;
                default:
                  this.router.navigate(['/home']);
              }
            } else {
              await this.presentToast('Login failed: ' + response.message, 'danger');
            }
          },
          error: async (error: HttpErrorResponse) => {
            console.error('Error during login:', error);
            await this.presentToast('Error during login: ' + error.message, 'danger');
          }
        });
    }
  }
  

  validateForm(): boolean {
    if (!this.userData.username || !this.userData.first_name || !this.userData.last_name || 
        !this.userData.email || !this.userData.password || !this.userData.confirmPassword) {
      this.presentToast('All fields are required', 'warning');
      return false;
    }

    if (this.userData.password !== this.userData.confirmPassword) {
      this.presentToast('Passwords do not match', 'danger');
      return false;
    }

    if (this.userData.password.length < 8) {
      this.presentToast('Password must be at least 8 characters long', 'warning');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.userData.email)) {
      this.presentToast('Invalid email format', 'warning');
      return false;
    }

    return true;
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

  clearFields() {
    this.userData = {
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: ''
    };
    this.loginData = {
      email: '',
      password: ''
    };
  }


}
