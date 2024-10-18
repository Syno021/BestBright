import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';
import { ToastController } from '@ionic/angular'; 

declare global {
  interface Window {
    PaystackPop: any;
  }
}

@Component({
  selector: 'app-paymentgate',
  templateUrl: './paymentgate.component.html',
  styleUrls: ['./paymentgate.component.scss'],
})
export class PaymentgateComponent implements OnInit {
  private paystackScriptLoaded: boolean = false;

  constructor(private toastController: ToastController) { }

  ngOnInit() {
    this.loadPaystackScript();
  }

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
    if (!this.paystackScriptLoaded) {
      await this.presentToast('Paystack script not loaded yet. Please try again.');
      return;
    }

    if (typeof window.PaystackPop === 'undefined') {
      await this.presentToast('PaystackPop is not defined. Please refresh the page and try again.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: environment.paystackTestPublicKey,
      email: 'customer@email.com',
      amount: 5000 * 100, // Amount in cents
      currency: 'ZAR', // South African Rand
      ref: `YOUR_REFERENCE_${new Date().getTime()}`,
      onClose: () => {
        console.log('Payment window closed');
      },
      callback: (response: any) => {
        console.log('Payment successful', response);
        this.verifyTransaction(response.reference);
      },
      onError: async (error: any) => {
        console.error('Payment error:', error);
        await this.presentToast(`Payment error: ${error.message || 'Unknown error occurred'}`);
      }
    });

    handler.openIframe();
  }

  verifyTransaction(reference: string) {
    // Here you would typically make an API call to your backend
    // Your backend would then verify the transaction with Paystack
    console.log('Verifying transaction with reference:', reference);
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom'
    });
    toast.present();
  }
}