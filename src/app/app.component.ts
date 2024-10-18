// app.component.ts
import { Component } from '@angular/core';
import { MenuController, Platform } from '@ionic/angular';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  public appPages = [
    { title: 'Home', url: '/home', icon: 'home' },
    { title: 'Products', url: '/products', icon: 'grid' },
    { title: 'Promotions', url: '/promotions', icon: 'pricetag' },
    { title: 'Account', url: '/account', icon: 'person' },
  ];

  public adminPages = [
    { title: 'Dashboard', url: '/admin-dashboard', icon: 'speedometer' },
    { title: 'Customer Management', url: '/admin-customer-management', icon: 'people' },
    { title: 'Inventory Management', url: '/admin-inventory-management', icon: 'cube' },
    { title: 'Order Management', url: '/admin-order-management', icon: 'cart' },
    { title: 'Sales Report', url: '/admin-sales-report', icon: 'bar-chart' },
    { title: 'User Management', url: '/admin-user-management', icon: 'person-add' },
  ];

  public showAdminNav = false;
  public showUserNav = false;
  public isMobile = false;
  public currentPageTitle = '';

  constructor(
    private menu: MenuController,
    private router: Router,
    private platform: Platform
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.checkScreenSize();
      this.platform.resize.subscribe(() => {
        this.checkScreenSize();
      });
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const adminUrls = this.adminPages.map(page => page.url);
        const userUrls = this.appPages.map(page => page.url);
        
        this.showAdminNav = adminUrls.includes(event.urlAfterRedirects);
        this.showUserNav = userUrls.includes(event.urlAfterRedirects);
        
        const currentPage = [...this.appPages, ...this.adminPages].find(page => page.url === event.urlAfterRedirects);
        this.currentPageTitle = currentPage ? currentPage.title : 'BestBright';
      });
  }

  checkScreenSize() {
    this.isMobile = this.platform.width() < 768; // Adjust this breakpoint as needed
  }

  toggleMenu() {
    this.menu.toggle('main-menu');
  }
}