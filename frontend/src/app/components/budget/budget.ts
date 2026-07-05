import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { DataSyncService } from '../../services/datasync.service';

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
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private dataSyncService = inject(DataSyncService);
  private cdr = inject(ChangeDetectorRef);

  budgetForm!: FormGroup;
  loading = false;
  historyLoading = false;
  backgroundRefreshing = false;
  historyRefreshing = false;
  submitted = false;

  budget = {
    monthlyBudget: 0,
    totalSpent: 0,
    remaining: 0,
    status: 'no_budget',
    month: ''
  };

  spendPercentage = 0;
  budgetHistory: any[] = [];

  ngOnInit(): void {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

    this.budgetForm = this.fb.group({
      month: [currentMonth, Validators.required],
      monthlyBudget: ['', [Validators.required, Validators.min(0.01)]]
    });

    this.loadCurrentBudgetStatus(currentMonth, false);
    this.loadBudgetHistory(false);

    // Reset validation state when month dropdown changes
    this.budgetForm.get('month')?.valueChanges.subscribe((selectedMonth) => {
      if (selectedMonth) {
        this.submitted = false;
        this.loadCurrentBudgetStatus(selectedMonth, false);
      }
    });
  }

  get f() {
    return this.budgetForm.controls;
  }

  getBudgetCacheKey(month: string): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    return `cached_budget_${userId}_${month}`;
  }

  getHistoryCacheKey(): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    return `cached_budget_history_${userId}`;
  }

  loadCurrentBudgetStatus(month: string, forceFresh = false): void {
    const key = this.getBudgetCacheKey(month);
    const cached = localStorage.getItem(key);

    if (cached && !forceFresh) {
      try {
        const parsed = JSON.parse(cached);
        this.budget = parsed;
        this.spendPercentage = this.budget.monthlyBudget > 0
          ? (this.budget.totalSpent / this.budget.monthlyBudget) * 100
          : 0;
        this.budgetForm.patchValue({
          monthlyBudget: this.budget.monthlyBudget || ''
        }, { emitEvent: false });
        this.loading = false;
        
        // Background refresh only (stale-while-revalidate)
        this.backgroundRefreshing = true;
        this.fetchFreshBudgetStatus(month, key);
        return;
      } catch (e) {
        console.error('Error loading cached budget status:', e);
      }
    }

    this.loading = true;
    this.fetchFreshBudgetStatus(month, key);
  }

  fetchFreshBudgetStatus(month: string, cacheKey: string): void {
    this.budgetService.getCurrentBudget(month).subscribe({
      next: (res) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        if (res.success && res.data) {
          this.budget = res.data;
          this.spendPercentage = this.budget.monthlyBudget > 0
            ? (this.budget.totalSpent / this.budget.monthlyBudget) * 100
            : 0;
          this.budgetForm.patchValue({
            monthlyBudget: this.budget.monthlyBudget || ''
          }, { emitEvent: false });
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res.data));
          } catch (e) {
            console.error('Error saving budget cache:', e);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        console.error(err);
        this.notificationService.showToast('Failed to calculate budget progress', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  loadBudgetHistory(forceFresh = false): void {
    const key = this.getHistoryCacheKey();
    const cached = localStorage.getItem(key);

    if (cached && !forceFresh) {
      try {
        const parsed = JSON.parse(cached);
        this.budgetHistory = parsed;
        this.historyLoading = false;
        
        // Background refresh only
        this.historyRefreshing = true;
        this.fetchFreshHistory(key);
        return;
      } catch (e) {
        console.error('Error loading cached history:', e);
      }
    }

    this.historyLoading = true;
    this.fetchFreshHistory(key);
  }

  fetchFreshHistory(cacheKey: string): void {
    this.budgetService.getBudgets().subscribe({
      next: (res) => {
        this.historyLoading = false;
        this.historyRefreshing = false;
        if (res.success) {
          this.budgetHistory = res.data;
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res.data));
          } catch (e) {
            console.error('Error saving history cache:', e);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.historyLoading = false;
        this.historyRefreshing = false;
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onSetBudget(): void {
    this.submitted = true;
    if (this.budgetForm.invalid) {
      return;
    }

    this.loading = true;
    const data = this.budgetForm.value;

    this.budgetService.setBudget(data).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.budget = res.data;
          this.spendPercentage = this.budget.monthlyBudget > 0
            ? (this.budget.totalSpent / this.budget.monthlyBudget) * 100
            : 0;
          this.notificationService.showToast('Budget settings updated successfully', 'success');
          this.dataSyncService.announceBudgetChange();
          
          // Update local storage cache
          const statusKey = this.getBudgetCacheKey(data.month);
          localStorage.setItem(statusKey, JSON.stringify(res.data));
          
          this.loadBudgetHistory(true);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast('Failed to save budget settings', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  mathAbs(val: number): number {
    return Math.abs(val);
  }
}
