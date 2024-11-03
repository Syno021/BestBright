import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

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
  previousUrl: string | null = null;
  
  // Add restricted paths that shouldn't be used for return navigation
  private restrictedPaths = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ];

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
    private router: Router,
    private location: Location
  ) {}

  ngOnInit() {
    // Get the previous URL from query params first
    const queryParams = new URLSearchParams(window.location.search);
    const returnUrl = queryParams.get('returnUrl');
    
    if (returnUrl && this.isValidReturnUrl(returnUrl)) {
      this.previousUrl = returnUrl;
      sessionStorage.setItem('previousUrl', returnUrl);
    } else {
      // Fall back to stored previousUrl in sessionStorage
      this.previousUrl = sessionStorage.getItem('previousUrl');
      
      // If no stored URL, try to use referrer
      if (!this.previousUrl && document.referrer) {
        try {
          const referrerUrl = new URL(document.referrer);
          if (
            referrerUrl.origin === window.location.origin &&
            this.isValidReturnUrl(referrerUrl.pathname)
          ) {
            this.previousUrl = referrerUrl.pathname;
            sessionStorage.setItem('previousUrl', this.previousUrl);
          }
        } catch (e) {
          console.error('Error processing referrer URL:', e);
        }
      }
    }
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

  private isValidReturnUrl(url: string): boolean {
    // Check if the URL is restricted
    if (this.restrictedPaths.some(path => url.toLowerCase().includes(path))) {
      return false;
    }
    
    // Ensure the URL starts with a slash and only contains valid characters
    const urlPattern = /^\/[a-zA-Z0-9\-\_\/]*$/;
    return urlPattern.test(url);
  }

  private getDefaultRouteForRole(role: string): string {
    switch (role.toLowerCase()) {
      case 'admin':
        return '/admin-dashboard';
      case 'cashier':
        return '/pos';
      default:
        return '/products';
    }
  }

  private async handleNavigation(userRole: string) {
    let targetUrl = '/products';  // Default fallback

    if (this.previousUrl && this.isValidReturnUrl(this.previousUrl)) {
      // Check role-specific paths
      const adminPaths = ['/admin', '/admin-dashboard'];
      const cashierPaths = ['/pos', '/cashier'];
      
      const isAdminPath = adminPaths.some(path => this.previousUrl?.includes(path));
      const isCashierPath = cashierPaths.some(path => this.previousUrl?.includes(path));
      
      if ((userRole === 'admin' && isAdminPath) ||
          (userRole === 'cashier' && isCashierPath) ||
          (userRole === 'customer' && !isAdminPath && !isCashierPath)) {
        targetUrl = this.previousUrl;
      } else {
        targetUrl = this.getDefaultRouteForRole(userRole);
      }
    } else {
      targetUrl = this.getDefaultRouteForRole(userRole);
    }

    // Clear stored URL before navigation
    sessionStorage.removeItem('previousUrl');
    
    // Navigate to target URL
    await this.router.navigate([targetUrl]);
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
        .subscribe(
          async (response: any) => {
            if (response.status === 1) {
              await this.presentToast('Registration successful', 'success');
              this.clearFields();
            } else {
              await this.presentToast('Registration failed: ' + response.message, 'danger');
            }
          },
          async (error: HttpErrorResponse) => {
            console.error('Error during registration:', error);
            await this.presentToast('Error during registration: ' + error.message, 'danger');
          }
        );
    } else {
      this.http.post('http://localhost/user_api/login.php', this.loginData)
        .subscribe(
          async (response: any) => {
            if (response.status === 1) {
              await this.presentToast('Login successful', 'success');

              // Store user info
              sessionStorage.setItem('userEmail', response.email);
              sessionStorage.setItem('userRole', response.role);
              sessionStorage.setItem('userId', response.user_id);
              sessionStorage.setItem('username', response.username);

              // Handle navigation with improved logic
              await this.handleNavigation(response.role);
            } else {
              await this.presentToast('Login failed: ' + response.message, 'danger');
            }
          },
          async (error: HttpErrorResponse) => {
            console.error('Error during login:', error);
            await this.presentToast('Error during login: ' + error.message, 'danger');
          }
        );
    }
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