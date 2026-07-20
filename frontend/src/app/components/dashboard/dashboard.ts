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
import { Subscription, forkJoin, of, catchError } from 'rxjs';

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
  displayedAdvice = '';
  isTypingAi = false;
  aiLoading = false;
  aiError = false;
  aiHistory: string[] = [];

  loading = false;
  backgroundRefreshing = false;

  quickPrompts = [
    'How can I lower monthly expenses?',
    'Analyze my recurring spending habits',
    'What percentage should I move to reserves?'
  ];

  // Charts
  private barChartInstance?: Chart;
  private lineChartInstance?: Chart;
  private pieChartInstance?: Chart;

  private txSub?: Subscription;
  private budgetSub?: Subscription;
  private typingTimer?: any;

  ngOnInit(): void {
    const currentMonth = new Date().toISOString().slice(0, 7);
    this.loadDashboardData(currentMonth, false);
    this.loadAiHistory();

    this.txSub = this.dataSyncService.transactionChange$.subscribe(() => {
      const updatedMonth = new Date().toISOString().slice(0, 7);
      this.loadDashboardData(updatedMonth, true);
    });

    this.budgetSub = this.dataSyncService.budgetChange$.subscribe(() => {
      const updatedMonth = new Date().toISOString().slice(0, 7);
      this.loadDashboardData(updatedMonth, true);
    });

    window.addEventListener('themeChanged', this.themeListener);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
    if (this.txSub) this.txSub.unsubscribe();
    if (this.budgetSub) this.budgetSub.unsubscribe();
    if (this.typingTimer) clearInterval(this.typingTimer);
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
        this.aiAdvice = d.aiAdvice || '';
        this.displayedAdvice = this.aiAdvice;
        this.loading = false;
        
        this.cdr.detectChanges();
        setTimeout(() => this.initCharts(), 0);

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
    forkJoin({
      report: this.reportService.getReport('monthly', month, '', '', true).pipe(catchError(err => of({ success: false, error: err }))),
      budget: this.budgetService.getCurrentBudget(month).pipe(catchError(err => of({ success: false, error: err }))),
      ai: this.aiService.getSuggestions().pipe(catchError(err => of({ success: false, error: err })))
    }).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.backgroundRefreshing = false;

        if (res.report && res.report.success && res.report.data) {
          const d = res.report.data;
          this.totalIncome = d.totalIncome;
          this.totalExpense = d.totalExpense;
          this.savings = d.savings;
          this.balance = d.totalIncome - d.totalExpense;
          this.recentTransactions = d.recentTransactions.slice(0, 5);
          this.categoryBreakdown = d.categoryBreakdown;
        }

        if (res.budget && res.budget.success && res.budget.data) {
          this.budget = res.budget.data;
          this.spendPercentage = this.budget.monthlyBudget > 0
            ? (this.budget.totalSpent / this.budget.monthlyBudget) * 100
            : 0;
        }

        if (res.ai && res.ai.success && res.ai.data) {
          const newAdvice = res.ai.data;
          if (newAdvice !== this.aiAdvice) {
            this.aiAdvice = newAdvice;
            this.triggerTypingEffect(this.aiAdvice);
          } else {
            this.displayedAdvice = this.aiAdvice;
          }
          this.aiError = false;
          if (!this.aiHistory.includes(this.aiAdvice)) {
            this.aiHistory.unshift(this.aiAdvice);
            if (this.aiHistory.length > 5) this.aiHistory.pop();
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.aiHistory));
          }
        } else if (res.ai && res.ai.error) {
          if (!this.aiAdvice && this.aiHistory.length > 0) {
            this.aiAdvice = this.aiHistory[0];
            this.displayedAdvice = this.aiAdvice;
          }
        }

        const payload = {
          totalIncome: this.totalIncome,
          totalExpense: this.totalExpense,
          savings: this.savings,
          balance: this.balance,
          recentTransactions: this.recentTransactions,
          categoryBreakdown: this.categoryBreakdown,
          budget: this.budget,
          spendPercentage: this.spendPercentage,
          aiAdvice: this.aiAdvice
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch (e) {
          console.error('Error saving dashboard cache:', e);
        }

        this.cdr.detectChanges();
        setTimeout(() => {
          this.initCharts();
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        console.error('Error fetching dashboard payload:', err);
        this.cdr.detectChanges();
      }
    });
  }

  triggerTypingEffect(fullText: string): void {
    if (this.typingTimer) clearInterval(this.typingTimer);
    this.displayedAdvice = '';
    this.isTypingAi = true;
    let i = 0;
    const step = Math.max(1, Math.floor(fullText.length / 80));

    this.typingTimer = setInterval(() => {
      i += step;
      if (i >= fullText.length) {
        this.displayedAdvice = fullText;
        this.isTypingAi = false;
        clearInterval(this.typingTimer);
      } else {
        this.displayedAdvice = fullText.slice(0, i);
      }
      this.cdr.detectChanges();
    }, 25);
  }

  initCharts(): void {
    this.destroyCharts();

    const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
    const lineCtx = document.getElementById('lineChart') as HTMLCanvasElement;
    const pieCtx = document.getElementById('pieChart') as HTMLCanvasElement;

    if (!barCtx && !lineCtx && !pieCtx) return;

    const labelColor = '#E5E7EB';
    const gridColor = 'rgba(212, 175, 55, 0.1)';

    // Bar Chart in Pure Royal Gold
    if (barCtx && (this.totalIncome > 0 || this.totalExpense > 0)) {
      const ctx = barCtx.getContext('2d');
      if (ctx) {
        const goldGradient = ctx.createLinearGradient(0, 0, 0, 300);
        goldGradient.addColorStop(0, '#FFD700');
        goldGradient.addColorStop(1, '#D4AF37');

        const redGradient = ctx.createLinearGradient(0, 0, 0, 300);
        redGradient.addColorStop(0, '#EF4444');
        redGradient.addColorStop(1, '#991B1B');

        this.barChartInstance = new Chart(barCtx, {
          type: 'bar',
          data: {
            labels: ['Current Month'],
            datasets: [
              {
                label: 'Income',
                data: [this.totalIncome],
                backgroundColor: goldGradient,
                borderRadius: 10,
                maxBarThickness: 65
              },
              {
                label: 'Expense',
                data: [this.totalExpense],
                backgroundColor: redGradient,
                borderRadius: 10,
                maxBarThickness: 65
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeOutQuart' },
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
    }

    // Line Chart in Royal Gold Area Fill
    if (lineCtx) {
      const expensesOnly = this.recentTransactions.filter(t => t.type === 'Expense');
      if (expensesOnly.length > 0) {
        const dailyMap: { [key: string]: number } = {};
        expensesOnly.forEach(t => {
          const d = new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
          dailyMap[d] = (dailyMap[d] || 0) + t.amount;
        });

        const dates = Object.keys(dailyMap).reverse();
        const amounts = dates.map(d => dailyMap[d]);

        const ctx = lineCtx.getContext('2d');
        let goldLineGradient: any = 'rgba(212, 175, 55, 0.15)';
        if (ctx) {
          goldLineGradient = ctx.createLinearGradient(0, 0, 0, 300);
          goldLineGradient.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
          goldLineGradient.addColorStop(1, 'rgba(212, 175, 55, 0.02)');
        }

        this.lineChartInstance = new Chart(lineCtx, {
          type: 'line',
          data: {
            labels: dates,
            datasets: [
              {
                label: 'Daily Outflow (₹)',
                data: amounts,
                borderColor: '#D4AF37',
                backgroundColor: goldLineGradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#F4C542',
                pointRadius: 5
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200 },
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
    }

    // Pie Chart in Gold and High-Contrast Royal Palette
    if (pieCtx) {
      const activeCategories = this.categoryBreakdown.filter(c => c.amount > 0);
      if (activeCategories.length > 0) {
        const labels = activeCategories.map(c => c.category);
        const data = activeCategories.map(c => c.amount);

        this.pieChartInstance = new Chart(pieCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [
              {
                data: data,
                backgroundColor: [
                  '#D4AF37',
                  '#F4C542',
                  '#FFD700',
                  '#EF4444',
                  '#10B981',
                  '#8B5CF6',
                  '#EC4899',
                  '#94A3B8'
                ],
                borderWidth: 2,
                borderColor: '#101010'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateRotate: true, duration: 1000 },
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
  }

  getFormattedAdvice(advice: string): string {
    if (!advice) return '';
    let html = advice;
    html = html.replace(/### (.*?)\n/g, '<h6 class="fw-bold mt-3 mb-2 font-heading text-gold">$1</h6>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gold-bright fw-bold">$1</strong>');
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
          this.triggerTypingEffect(this.aiAdvice);
          this.aiError = false;
          
          this.aiHistory.unshift(this.aiAdvice);
          if (this.aiHistory.length > 5) this.aiHistory.pop();
          localStorage.setItem(this.getStorageKey(), JSON.stringify(this.aiHistory));

          this.notificationService.showToast('Gemini AI recommendations synthesized!', 'success');
        } else {
          this.aiError = true;
          this.notificationService.showToast('Failed to load AI advice', 'warning');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.aiLoading = false;
        this.aiError = true;
        console.error(err);
        const errMsg = err.error?.message || 'Could not fetch AI recommendations';
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
          this.displayedAdvice = this.aiAdvice;
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      this.aiHistory = [];
      this.aiAdvice = '';
      this.displayedAdvice = '';
    }
  }

  selectHistoryAdvice(advice: string): void {
    this.aiAdvice = advice;
    this.triggerTypingEffect(this.aiAdvice);
  }

  mathAbs(val: number): number {
    return Math.abs(val);
  }
}
