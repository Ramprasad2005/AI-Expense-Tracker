import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../services/report.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private notificationService = inject(NotificationService);

  type = 'monthly';
  period = '';
  periodYear = new Date().getFullYear();

  loading = false;
  pdfLoading = false;
  reportLoaded = false;

  reportData = {
    totalIncome: 0,
    totalExpense: 0,
    savings: 0,
    categoryBreakdown: [] as any[],
    recentTransactions: [] as any[]
  };

  activePeriod = '';
  savingsRate = '0';
  activeBreakdown: any[] = [];

  ngOnInit(): void {
    const today = new Date();
    this.period = today.toISOString().slice(0, 7); // YYYY-MM
  }

  generateReport(): void {
    const targetPeriod = this.type === 'monthly' ? this.period : String(this.periodYear);
    
    if (this.type === 'monthly' && !this.period) {
      this.notificationService.showToast('Please select a month', 'warning');
      return;
    }

    this.loading = true;
    this.reportLoaded = false;
    this.activePeriod = targetPeriod;

    this.reportService.getReport(this.type, targetPeriod).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.reportData = res.data;
          this.savingsRate = this.reportData.totalIncome > 0
            ? ((this.reportData.savings / this.reportData.totalIncome) * 100).toFixed(1)
            : '0';
          
          this.activeBreakdown = this.reportData.categoryBreakdown.filter(c => c.amount > 0);
          this.reportLoaded = true;
          this.notificationService.showToast('Report generated successfully!', 'success');
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast('Failed to compile report', 'danger');
      }
    });
  }

  exportPdf(): void {
    const targetPeriod = this.activePeriod;
    
    this.pdfLoading = true;
    this.reportService.downloadReportPdf(this.type, targetPeriod).subscribe({
      next: (blob) => {
        this.pdfLoading = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report-${targetPeriod}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.notificationService.showToast('PDF Statement downloaded!', 'success');
      },
      error: (err) => {
        this.pdfLoading = false;
        console.error(err);
        this.notificationService.showToast('Failed to download PDF', 'danger');
      }
    });
  }

  getPercentOfExpense(amount: number): string {
    const total = this.reportData.totalExpense;
    return total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
  }
}
