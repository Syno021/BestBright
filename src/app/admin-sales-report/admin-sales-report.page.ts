import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin-sales-report',
  templateUrl: './admin-sales-report.page.html',
  styleUrls: ['./admin-sales-report.page.scss'],
})
export class AdminSalesReportPage implements OnInit {
  salesData: any[] = [];
  totalSalesAmount: number = 0;
  totalOrders: number = 0;
  averageOrderValue: number = 0;
  itemsPerPage: number = 10;
  currentPage: number = 1;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchSalesData();
  }

  get totalPages(): number {
    return Math.ceil(this.salesData.length / this.itemsPerPage);
  }

  get paginatedSalesData(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.salesData.slice(start, start + this.itemsPerPage);
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

  fetchSalesData() {
    this.http.get<{ salesData: any[], totalSalesAmount: number }>('http://localhost/user_api/sales.php')
      .subscribe(response => {
        this.salesData = response.salesData;
        this.totalSalesAmount = response.totalSalesAmount;
        this.totalOrders = this.salesData.length;
        this.calculateAverageOrderValue();
      });
  }

  calculateAverageOrderValue() {
    if (this.totalOrders > 0) {
      this.averageOrderValue = this.totalSalesAmount / this.totalOrders;
    } else {
      this.averageOrderValue = 0;
    }
  }
}