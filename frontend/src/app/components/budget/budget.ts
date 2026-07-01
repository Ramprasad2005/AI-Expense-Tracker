import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './budget.html',
  styleUrls: ['./budget.css']
})
export class BudgetComponent implements OnInit {
  private fb = inject(FormBuilder);
  private budgetService = inject(BudgetService);
  private notificationService = inject(NotificationService);

  budgetForm!: FormGroup;
  loading = false;
  saveLoading = false;
  historyLoading = false;

  currentBudget = {
    monthlyBudget: 0,
    totalSpent: 0,
    remaining: 0,
    status: 'no_budget',
    month: ''
  };

  spendPercentage = 0;
  currentMonthLabel = '';
  budgetHistory: any[] = [];

  ngOnInit(): void {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

    this.budgetForm = this.fb.group({
      month: [currentMonth, Validators.required],
      monthlyBudget: ['', [Validators.required, Validators.min(0.01)]]
    });

    this.loadCurrentBudgetStatus(currentMonth);
    this.loadBudgetHistory();
  }

  loadCurrentBudgetStatus(month: string): void {
    this.loading = true;
    this.currentMonthLabel = month;
    this.budgetService.getCurrentBudget(month).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.currentBudget = res.data;
          this.spendPercentage = this.currentBudget.monthlyBudget > 0
            ? (this.currentBudget.totalSpent / this.currentBudget.monthlyBudget) * 100
            : 0;
          this.budgetForm.patchValue({
            monthlyBudget: this.currentBudget.monthlyBudget || ''
          });
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast('Failed to calculate budget progress', 'danger');
      }
    });
  }

  loadBudgetHistory(): void {
    this.historyLoading = true;
    this.budgetService.getBudgets().subscribe({
      next: (res) => {
        this.historyLoading = false;
        if (res.success) {
          this.budgetHistory = res.data;
        }
      },
      error: (err) => {
        this.historyLoading = false;
        console.error(err);
      }
    });
  }

  onMonthChange(): void {
    const selectedMonth = this.budgetForm.get('month')?.value;
    if (selectedMonth) {
      this.loadCurrentBudgetStatus(selectedMonth);
    }
  }

  onSaveBudget(): void {
    if (this.budgetForm.invalid) {
      return;
    }

    this.saveLoading = true;
    const data = this.budgetForm.value;

    this.budgetService.setBudget(data).subscribe({
      next: (res) => {
        this.saveLoading = false;
        if (res.success && res.data) {
          this.currentBudget = res.data;
          this.spendPercentage = this.currentBudget.monthlyBudget > 0
            ? (this.currentBudget.totalSpent / this.currentBudget.monthlyBudget) * 100
            : 0;
          this.notificationService.showToast('Budget settings updated successfully', 'success');
          this.loadBudgetHistory();
        }
      },
      error: (err) => {
        this.saveLoading = false;
        console.error(err);
        this.notificationService.showToast('Failed to save budget settings', 'danger');
      }
    });
  }

  getPercentColorClass(percentage: number): string {
    if (percentage < 70) return 'text-success';
    if (percentage <= 100) return 'text-warning';
    return 'text-danger';
  }

  getProgressBarColorClass(percentage: number): string {
    if (percentage < 70) return 'bg-success';
    if (percentage <= 100) return 'bg-warning text-dark';
    return 'bg-danger';
  }

  getStatusAlertClass(): string {
    const status = this.currentBudget.status;
    if (status === 'within_limit') return 'alert-success bg-success bg-opacity-10 text-success border border-success border-opacity-25';
    if (status === 'exceeded') return 'alert-danger bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25';
    return 'alert-secondary bg-dark bg-opacity-50 text-muted border border-secondary border-opacity-25';
  }
}
