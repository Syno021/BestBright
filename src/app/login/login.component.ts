import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  showPassword = false;
  previousUrl: string = '/home'; // Default fallback route

  loginData = {
    email: '',
    password: ''
  };

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router,
    private modalController: ModalController
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['returnUrl']) {
      this.previousUrl = navigation.extras.state['returnUrl'];
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  login() {
    this.http.post('http://localhost/user_api/login.php', this.loginData)
      .subscribe(
        async (response: any) => {
          if (response.status === 1) {
            await this.presentToast('Login successful', 'success');

            // Store user info in session storage
            sessionStorage.setItem('userEmail', response.email);
            sessionStorage.setItem('userRole', response.role);
            sessionStorage.setItem('userId', response.user_id);
            sessionStorage.setItem('username', response.username);

            // Check if user can access the return URL
            if (this.canAccessRoute(response.role, this.previousUrl)) {
              if (await this.modalController.getTop()) {
                this.modalController.dismiss(true);
              } else {
                this.router.navigate([this.previousUrl]);
              }
            } else {
              // Navigate to default route based on role
              if (response.role === 'admin') {
                this.router.navigate(['/admin-dashboard']);
              } else if (response.role === 'cashier') {
                this.router.navigate(['/pos']);
              } else {
                this.router.navigate(['/home']);
              }
            }
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

  private canAccessRoute(role: string, url: string): boolean {
    if (role === 'admin' && url.includes('admin')) return true;
    if (role === 'cashier' && url.includes('pos')) return true;
    if (!url.includes('admin') && !url.includes('pos')) return true;
    return false;
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
    this.loginData = {
      email: '',
      password: ''
    };
  }

  dismissModal() {
    this.modalController.dismiss();
  }
}