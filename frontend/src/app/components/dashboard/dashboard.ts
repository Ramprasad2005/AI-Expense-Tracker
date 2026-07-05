import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { BudgetService } from '../../services/budget.service';
import { AiService } from '../../services/ai.service';
import { NotificationService } from '../../services/notification.service';
import { DataSyncService } from '../../services/datasync.service';
import { Chart, registerables } from 'chart.js';
import { Subscription, forkJoin } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private reportService = inject(ReportService);
  private budgetService = inject(BudgetService);
  private aiService = inject(AiService);
  private notificationService = inject(NotificationService);
  private dataSyncService = inject(DataSyncService);
  private cdr = inject(ChangeDetectorRef);

  // Financial totals
  totalIncome = 0;
  totalExpense = 0;
  savings = 0;
  balance = 0;

  recentTransactions: any[] = [];
  categoryBreakdown: any[] = [];

  // Budget
  budget = {
    monthlyBudget: 0,
    totalSpent: 0,
    remaining: 0,
    status: 'no_budget'
  };
  spendPercentage = 0;

  // AI suggestions
  aiAdvice = '';
  aiLoading = false;
  aiError = false;
  aiHistory: string[] = [];

  loading = false;
  backgroundRefreshing = false;

  // Charts
  private barChartInstance?: Chart;
  private lineChartInstance?: Chart;
  private pieChartInstance?: Chart;

  private txSub?: Subscription;
  private budgetSub?: Subscription;

  ngOnInit(): void {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    this.loadDashboardData(currentMonth, false);
    this.loadAiHistory();

    // Sync dashboard on transaction edits
    this.txSub = this.dataSyncService.transactionChange$.subscribe(() => {
      console.log('[SYNC] Dashboard transactions updated');
      const updatedMonth = new Date().toISOString().slice(0, 7);
      this.loadDashboardData(updatedMonth, true);
    });

    // Sync dashboard on budget edits
    this.budgetSub = this.dataSyncService.budgetChange$.subscribe(() => {
      console.log('[SYNC] Dashboard budget settings updated');
      const updatedMonth = new Date().toISOString().slice(0, 7);
      this.loadDashboardData(updatedMonth, true);
    });

    // Listen to themeChanged event to adjust charts colors
    window.addEventListener('themeChanged', this.themeListener);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
    if (this.txSub) this.txSub.unsubscribe();
    if (this.budgetSub) this.budgetSub.unsubscribe();
    window.removeEventListener('themeChanged', this.themeListener);
  }

  private themeListener = () => {
    this.initCharts();
  };

  destroyCharts(): void {
    if (this.barChartInstance) this.barChartInstance.destroy();
    if (this.lineChartInstance) this.lineChartInstance.destroy();
    if (this.pieChartInstance) this.pieChartInstance.destroy();
  }

  getDashboardCacheKey(month: string): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    return `cached_dashboard_${userId}_${month}`;
  }

  loadDashboardData(month: string, forceFresh = false): void {
    const key = this.getDashboardCacheKey(month);
    const cached = localStorage.getItem(key);

    if (cached && !forceFresh) {
      try {
        const d = JSON.parse(cached);
        this.totalIncome = d.totalIncome;
        this.totalExpense = d.totalExpense;
        this.savings = d.savings;
        this.balance = d.balance;
        this.recentTransactions = d.recentTransactions;
        this.categoryBreakdown = d.categoryBreakdown;
        this.budget = d.budget;
        this.spendPercentage = d.spendPercentage;
        this.loading = false;
        
        // Render charts based on cached metrics
        setTimeout(() => this.initCharts(), 0);
        
        // Background refresh only (stale-while-revalidate)
        this.backgroundRefreshing = true;
        this.fetchFreshDashboard(month, key);
        return;
      } catch (e) {
        console.error('Error loading dashboard cache:', e);
      }
    }

    this.loading = true;
    this.fetchFreshDashboard(month, key);
  }

  fetchFreshDashboard(month: string, cacheKey: string): void {
    // parallel API calls via forkJoin
    forkJoin({
      report: this.reportService.getReport('monthly', month, '', '', true),
      budget: this.budgetService.getCurrentBudget(month)
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.backgroundRefreshing = false;

        if (res.report.success && res.report.data) {
          const d = res.report.data;
          this.totalIncome = d.totalIncome;
          this.totalExpense = d.totalExpense;
          this.savings = d.savings;
          this.balance = d.totalIncome - d.totalExpense;
          this.recentTransactions = d.recentTransactions.slice(0, 5);
          this.categoryBreakdown = d.categoryBreakdown;
        }

        if (res.budget.success && res.budget.data) {
          this.budget = res.budget.data;
          this.spendPercentage = this.budget.monthlyBudget > 0
            ? (this.budget.totalSpent / this.budget.monthlyBudget) * 100
            : 0;
        }

        // Cache combined payload
        const payload = {
          totalIncome: this.totalIncome,
          totalExpense: this.totalExpense,
          savings: this.savings,
          balance: this.balance,
          recentTransactions: this.recentTransactions,
          categoryBreakdown: this.categoryBreakdown,
          budget: this.budget,
          spendPercentage: this.spendPercentage
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch (e) {
          console.error('Error saving dashboard cache:', e);
        }

        this.initCharts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        console.error('Error fetching dashboard payload:', err);
        this.cdr.detectChanges();
      }
    });
  }

  initCharts(): void {
    this.destroyCharts();

    const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
    const lineCtx = document.getElementById('lineChart') as HTMLCanvasElement;
    const pieCtx = document.getElementById('pieChart') as HTMLCanvasElement;

    if (!barCtx && !lineCtx && !pieCtx) return;

    // Dynamically calculate grid and label colors based on the active theme
    const isDark = document.body.classList.contains('dark-theme');
    const labelColor = isDark ? '#94A3B8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    // A. Bar Chart: Income vs Expense
    if (barCtx) {
      this.barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: ['Current Month'],
          datasets: [
            {
              label: 'Income',
              data: [this.totalIncome],
              backgroundColor: '#10B981', // Emerald 500
              borderRadius: 8,
              maxBarThickness: 60
            },
            {
              label: 'Expense',
              data: [this.totalExpense],
              backgroundColor: '#EF4444', // Red 500
              borderRadius: 8,
              maxBarThickness: 60
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: labelColor, font: { family: 'Inter', weight: 'normal' } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: labelColor } },
            y: { grid: { color: gridColor }, ticks: { color: labelColor } }
          }
        }
      });
    }

    // B. Line Chart: Expense Daily Trend
    if (lineCtx) {
      const expensesOnly = this.recentTransactions.filter(t => t.type === 'Expense');
      const dailyMap: { [key: string]: number } = {};
      
      expensesOnly.forEach(t => {
        const d = new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        dailyMap[d] = (dailyMap[d] || 0) + t.amount;
      });

      const dates = Object.keys(dailyMap).reverse();
      const amounts = dates.map(d => dailyMap[d]);

      this.lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: dates.length > 0 ? dates : ['No Data'],
          datasets: [
            {
              label: 'Daily Expenses',
              data: amounts.length > 0 ? amounts : [0],
              borderColor: '#2563EB', // Blue 600
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.05)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointBackgroundColor: '#2563EB'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: labelColor, font: { family: 'Inter' } } }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: labelColor } },
            y: { grid: { color: gridColor }, ticks: { color: labelColor } }
          }
        }
      });
    }

    // C. Pie Chart: Category breakdown
    if (pieCtx) {
      const activeCategories = this.categoryBreakdown.filter(c => c.amount > 0);
      const labels = activeCategories.map(c => c.category);
      const data = activeCategories.map(c => c.amount);

      this.pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: labels.length > 0 ? labels : ['No Expenses'],
          datasets: [
            {
              data: data.length > 0 ? data : [1],
              backgroundColor: [
                '#F59E0B', // Food (Amber)
                '#3B82F6', // Travel (Blue)
                '#06B6D4', // Shopping (Cyan)
                '#EF4444', // Rent (Red)
                '#64748B', // Bills (Slate)
                '#10B981', // Medical (Emerald)
                '#8B5CF6', // Entertainment (Purple)
                '#EC4899', // Education (Pink)
                '#94A3B8'  // Others (Grey)
              ],
              borderWidth: 2,
              borderColor: isDark ? '#1E293B' : '#FFFFFF'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: labelColor, boxWidth: 12, font: { family: 'Inter' } }
            }
          }
        }
      });
    }
  }

  getFormattedAdvice(advice: string): string {
    if (!advice) return '';
    let html = advice;
    
    // Replace headings ### (removed hardcoded .text-dark for dark mode legibility)
    html = html.replace(/### (.*?)\n/g, '<h6 class="fw-bold mt-3 mb-2 font-premium-header text-primary">$1</h6>');
    
    // Replace bold text **text** (removed hardcoded .text-dark for dark mode legibility)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="fw-semibold">$1</strong>');
    
    // Replace bullet points
    html = html.replace(/^- (.*?)\n/gm, '<li class="mb-1 text-secondary">$1</li>');
    return html;
  }

  getStorageKey(): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    return `ai_advice_history_${userId}`;
  }

  getAiSuggestions(): void {
    this.aiLoading = true;
    this.aiError = false;
    this.aiService.getSuggestions().subscribe({
      next: (res) => {
        this.aiLoading = false;
        if (res.success && res.data) {
          this.aiAdvice = res.data;
          this.aiError = false;
          
          // Save to local history list
          this.aiHistory.unshift(this.aiAdvice);
          if (this.aiHistory.length > 5) this.aiHistory.pop();
          localStorage.setItem(this.getStorageKey(), JSON.stringify(this.aiHistory));

          this.notificationService.showToast('AI suggestions successfully updated!', 'success');
        } else {
          this.aiError = true;
          this.notificationService.showToast('Failed to load AI suggestions', 'warning');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.aiLoading = false;
        this.aiError = true;
        console.error(err);
        const errMsg = err.error?.message || 'Could not fetch AI advisor recommendations';
        this.notificationService.showToast(errMsg, 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  copyAdvice(): void {
    if (this.aiAdvice) {
      navigator.clipboard.writeText(this.aiAdvice);
      this.notificationService.showToast('Advice copied to clipboard', 'info');
    }
  }

  downloadAdvice(): void {
    if (!this.aiAdvice) return;
    const blob = new Blob([this.aiAdvice], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Financial-Advice-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    this.notificationService.showToast('Financial advice text downloaded!', 'success');
  }

  loadAiHistory(): void {
    const raw = localStorage.getItem(this.getStorageKey());
    if (raw) {
      try {
        this.aiHistory = JSON.parse(raw);
        if (this.aiHistory.length > 0) {
          this.aiAdvice = this.aiHistory[0];
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      this.aiHistory = [];
      this.aiAdvice = '';
    }
  }

  selectHistoryAdvice(advice: string): void {
    this.aiAdvice = advice;
  }

  mathAbs(val: number): number {
    return Math.abs(val);
  }
}
