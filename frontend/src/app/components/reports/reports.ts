import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../services/report.service';
import { AuthService } from '../../services/auth.service';
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
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  type = 'monthly';
  period = '';
  periodYear = new Date().getFullYear();
  
  // Custom date ranges
  customStartDate = '';
  customEndDate = '';

  loading = false;
  backgroundRefreshing = false;
  pdfLoading = false;
  csvLoading = false;
  reportLoaded = false;
  apiError = false;
  apiErrorMessage = '';

  reportData = {
    totalIncome: 0,
    totalExpense: 0,
    savings: 0,
    categoryBreakdown: [] as any[],
    recentTransactions: [] as any[],
    aiAdvice: ''
  };

  activePeriod = '';
  activeStartDate = '';
  activeEndDate = '';
  savingsRate = '0';
  activeBreakdown: any[] = [];

  ngOnInit(): void {
    const today = new Date();
    this.period = today.toISOString().slice(0, 7); // YYYY-MM
    
    // Load cached report data instantly if it exists
    this.loadCachedReport();
    
    // Immediately fetch fresh data from backend
    this.fetchReport(false);
  }

  getStorageKey(): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    const targetPeriod = this.type === 'custom' ? `${this.customStartDate}_${this.customEndDate}` : (this.type === 'monthly' ? this.period : String(this.periodYear));
    return `cached_report_${userId}_${this.type}_${targetPeriod}`;
  }

  loadCachedReport(): void {
    const key = this.getStorageKey();
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.reportData = parsed;
        this.savingsRate = this.reportData.totalIncome > 0
          ? ((this.reportData.savings / this.reportData.totalIncome) * 100).toFixed(1)
          : '0';
        this.activeBreakdown = this.reportData.categoryBreakdown.filter((c: any) => c.amount > 0);
        this.reportLoaded = true;
        this.apiError = false;
        console.log('[REPORTS] Loaded report instantly from localStorage cache.');
      } catch (e) {
        console.error('Error parsing cached report', e);
      }
    }
  }

  generateReport(forceFresh: boolean = true): void {
    this.fetchReport(forceFresh);
  }

  retryLoad(): void {
    this.fetchReport(true);
  }

  fetchReport(forceFresh: boolean = false): void {
    const targetPeriod = this.type === 'monthly' ? this.period : String(this.periodYear);
    
    if (this.type === 'monthly' && !this.period) {
      this.notificationService.showToast('Please select a month', 'warning');
      return;
    }

    if (this.type === 'custom') {
      if (!this.customStartDate || !this.customEndDate) {
        this.notificationService.showToast('Please select both start and end dates', 'warning');
        return;
      }
      if (new Date(this.customStartDate) > new Date(this.customEndDate)) {
        this.notificationService.showToast('Start date cannot be after end date', 'warning');
        return;
      }
    }

    this.activePeriod = targetPeriod;
    this.activeStartDate = this.customStartDate;
    this.activeEndDate = this.customEndDate;

    // Check if we have cached report and don't need a hard refresh
    const cacheKey = this.getStorageKey();
    const hasCache = !!localStorage.getItem(cacheKey);

    if (hasCache && !forceFresh) {
      // Background refresh mode (stale-while-revalidate)
      this.backgroundRefreshing = true;
      this.apiError = false;
      this.loadCachedReport(); // Double check cache is loaded
    } else {
      // Hard loading mode (show skeletons)
      this.loading = true;
      this.reportLoaded = false;
      this.apiError = false;
    }
    
    this.cdr.detectChanges();

    // Call API with refresh=true to ensure the DB cache gets updated
    this.reportService.getReport(this.type, targetPeriod, this.customStartDate, this.customEndDate, true).subscribe({
      next: (res) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        this.apiError = false;

        if (res.success && res.data) {
          this.reportData = res.data;
          this.savingsRate = this.reportData.totalIncome > 0
            ? ((this.reportData.savings / this.reportData.totalIncome) * 100).toFixed(1)
            : '0';
          
          this.activeBreakdown = this.reportData.categoryBreakdown.filter(c => c.amount > 0);
          this.reportLoaded = true;

          // Save to localStorage cache
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
          
          if (forceFresh) {
            this.notificationService.showToast('Report updated successfully!', 'success');
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        console.error(err);
        
        // If we have cached data, don't show full error block, just toast a warning
        if (this.reportLoaded) {
          this.notificationService.showToast('Background sync failed. Showing offline version.', 'warning');
        } else {
          this.apiError = true;
          this.apiErrorMessage = err.error?.message || 'Could not fetch report data. Please check connection.';
          this.notificationService.showToast('Failed to compile report', 'danger');
        }
        this.cdr.detectChanges();
      }
    });
  }

  exportPdf(): void {
    this.pdfLoading = true;
    this.cdr.detectChanges();

    this.reportService.downloadReportPdf(this.type, this.activePeriod, this.activeStartDate, this.activeEndDate).subscribe({
      next: (blob) => {
        this.pdfLoading = false;
        const file = new Blob([blob], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        
        // Open PDF in a new tab
        const newWindow = window.open(fileURL, '_blank');
        
        // Compute filename (Financial_Report_Month_Year.pdf)
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        let displayFilename = 'Financial_Report_Statement.pdf';
        
        if (this.type === 'monthly' && this.activePeriod) {
          const [year, month] = this.activePeriod.split('-');
          const monthName = months[parseInt(month, 10) - 1] || 'Month';
          displayFilename = `Financial_Report_${monthName}_${year}.pdf`;
        } else if (this.type === 'yearly' && this.activePeriod) {
          displayFilename = `Financial_Report_Year_${this.activePeriod}.pdf`;
        } else if (this.type === 'custom') {
          displayFilename = `Financial_Report_${this.activeStartDate}_to_${this.activeEndDate}.pdf`;
        }

        // Fallback to direct download if popup was blocked
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          const a = document.createElement('a');
          a.href = fileURL;
          a.download = displayFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        
        this.notificationService.showToast('PDF compiled successfully!', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.pdfLoading = false;
        console.error(err);
        this.notificationService.showToast('Failed to compile PDF', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  exportCsv(): void {
    this.csvLoading = true;
    this.cdr.detectChanges();

    this.reportService.downloadReportCsv(this.type, this.activePeriod, this.activeStartDate, this.activeEndDate).subscribe({
      next: (blob) => {
        this.csvLoading = false;
        const file = new Blob([blob], { type: 'text/csv;charset=utf-8' });
        const fileURL = URL.createObjectURL(file);
        
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        let displayFilename = 'Financial_Report_Statement.csv';
        
        if (this.type === 'monthly' && this.activePeriod) {
          const [year, month] = this.activePeriod.split('-');
          const monthName = months[parseInt(month, 10) - 1] || 'Month';
          displayFilename = `Financial_Report_${monthName}_${year}.csv`;
        } else if (this.type === 'yearly' && this.activePeriod) {
          displayFilename = `Financial_Report_Year_${this.activePeriod}.csv`;
        } else if (this.type === 'custom') {
          displayFilename = `Financial_Report_${this.activeStartDate}_to_${this.activeEndDate}.csv`;
        }

        const a = document.createElement('a');
        a.href = fileURL;
        a.download = displayFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(fileURL);
        
        this.notificationService.showToast('CSV statement downloaded!', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.csvLoading = false;
        console.error(err);
        this.notificationService.showToast('Failed to download CSV', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  printReport(): void {
    window.print();
  }

  getPercentOfExpense(amount: number): string {
    const total = this.reportData.totalExpense;
    return total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
  }

  getFormattedAdviceHtml(): string {
    const raw = this.reportData.aiAdvice;
    if (!raw) return '';
    
    let html = raw;
    
    // Replace ### Headers
    html = html.replace(/^### (.*$)/gim, '<h6 class="fw-bold text-primary mt-3 mb-2">$1</h6>');
    // Replace ## Headers
    html = html.replace(/^## (.*$)/gim, '<h5 class="fw-bold text-primary mt-4 mb-2">$1</h5>');
    // Replace # Headers
    html = html.replace(/^# (.*$)/gim, '<h4 class="fw-bold text-primary mt-4 mb-3">$1</h4>');
    
    // Replace **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="fw-semibold">$1</strong>');
    
    // Replace lists
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="mb-1 text-secondary small">$1</li>');
    
    // Replace newlines
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }
}
