import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { BudgetService } from '../../services/budget.service';
import { AiService } from '../../services/ai.service';
import { NotificationService } from '../../services/notification.service';
import { Chart, registerables } from 'chart.js';

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

  // Charts
  private barChartInstance?: Chart;
  private lineChartInstance?: Chart;
  private pieChartInstance?: Chart;

  ngOnInit(): void {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    this.loadDashboardData(currentMonth);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  destroyCharts(): void {
    if (this.barChartInstance) this.barChartInstance.destroy();
    if (this.lineChartInstance) this.lineChartInstance.destroy();
    if (this.pieChartInstance) this.pieChartInstance.destroy();
  }

  loadDashboardData(month: string): void {
    // 1. Load Financial stats via report service
    this.reportService.getReport('monthly', month).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          this.totalIncome = d.totalIncome;
          this.totalExpense = d.totalExpense;
          this.savings = d.savings;
          this.balance = d.totalIncome - d.totalExpense;
          this.recentTransactions = d.recentTransactions.slice(0, 5); // display top 5
          this.categoryBreakdown = d.categoryBreakdown;

          this.initCharts();
        }
      },
      error: (err) => console.error('Error loading dashboard stats', err)
    });

    // 2. Load Budget details
    this.budgetService.getCurrentBudget(month).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.budget = res.data;
          this.spendPercentage = this.budget.monthlyBudget > 0
            ? (this.budget.totalSpent / this.budget.monthlyBudget) * 100
            : 0;
        }
      },
      error: (err) => console.error('Error loading current budget', err)
    });
  }

  initCharts(): void {
    this.destroyCharts();

    const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
    const lineCtx = document.getElementById('lineChart') as HTMLCanvasElement;
    const pieCtx = document.getElementById('pieChart') as HTMLCanvasElement;

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
              backgroundColor: '#10b981',
              borderRadius: 6
            },
            {
              label: 'Expense',
              data: [this.totalExpense],
              backgroundColor: '#ef4444',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    // B. Line Chart: Expense Daily Trend (Group transactions by date)
    if (lineCtx) {
      // Aggregate expenses by day
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
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8' } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8' } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
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
                '#f59e0b', // Food
                '#3b82f6', // Travel
                '#06b6d4', // Shopping
                '#ef4444', // Rent
                '#64748b', // Bills
                '#10b981', // Medical
                '#8b5cf6', // Entertainment
                '#ec4899', // Education
                '#94a3b8'  // Others
              ],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#94a3b8', boxWidth: 12 }
            }
          }
        }
      });
    }
  }

  getAiSuggestions(): void {
    this.aiLoading = true;
    this.aiService.getSuggestions().subscribe({
      next: (res) => {
        this.aiLoading = false;
        if (res.success) {
          this.aiAdvice = res.data;
          this.notificationService.showToast('AI suggestion loaded!', 'success');
        } else {
          this.notificationService.showToast('Failed to load AI suggestions', 'warning');
        }
      },
      error: (err) => {
        this.aiLoading = false;
        console.error(err);
        const errMsg = err.error?.message || 'Could not fetch AI financial advice';
        this.notificationService.showToast(errMsg, 'danger');
      }
    });
  }

  mathAbs(val: number): number {
    return Math.abs(val);
  }
}
