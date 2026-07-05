import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { DataSyncService } from '../../services/datasync.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './expenses.html',
  styleUrls: ['./expenses.css']
})
export class ExpensesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private dataSyncService = inject(DataSyncService);
  private cdr = inject(ChangeDetectorRef);

  expenses: any[] = [];
  loading = false;
  backgroundRefreshing = false;

  categories = ['Food', 'Travel', 'Shopping', 'Rent', 'Bills', 'Medical', 'Entertainment', 'Education', 'Others'];

  filters = {
    search: '',
    category: '',
    startDate: '',
    endDate: '',
    sortBy: 'date',
    sortOrder: 'desc',
    page: 1,
    limit: 8
  };

  pagination = {
    total: 0,
    page: 1,
    limit: 8,
    pages: 0
  };

  showModal = false;
  editMode = false;
  currentEditingId?: string;
  expenseForm!: FormGroup;
  formSubmitted = false;
  modalLoading = false;

  ngOnInit(): void {
    this.loadExpenses(false);
    this.initForm();
  }

  initForm(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.expenseForm = this.fb.group({
      category: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      date: [today, Validators.required],
      description: ['']
    });
  }

  get f() {
    return this.expenseForm.controls;
  }

  getStorageKey(): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    return `cached_expense_${userId}_page_${this.filters.page}_limit_${this.filters.limit}_sort_${this.filters.sortBy}_order_${this.filters.sortOrder}_search_${this.filters.search}_cat_${this.filters.category}_start_${this.filters.startDate}_end_${this.filters.endDate}`;
  }

  loadExpenses(forceFresh = false): void {
    const key = this.getStorageKey();
    const cached = localStorage.getItem(key);
    
    if (cached && !forceFresh) {
      try {
        const parsed = JSON.parse(cached);
        this.expenses = parsed.data;
        this.pagination = parsed.pagination;
        this.loading = false;
        
        // Background refresh only (stale-while-revalidate)
        this.backgroundRefreshing = true;
        this.fetchFreshExpenses(key);
        return;
      } catch (e) {
        console.error('Error loading cached expense:', e);
      }
    }
    
    // Fallback if no cache exists or fresh reload requested
    this.loading = true;
    this.fetchFreshExpenses(key);
  }

  fetchFreshExpenses(cacheKey: string): void {
    this.expenseService.getExpenses(this.filters).subscribe({
      next: (res) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        if (res.success) {
          this.expenses = res.data;
          this.pagination = res.pagination;
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res));
          } catch (e) {
            console.error('Error saving cache:', e);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        console.error(err);
        this.notificationService.showToast('Failed to load expense records', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange(): void {
    this.filters.page = 1;
    this.loadExpenses(true);
  }

  changePage(newPage: number): void {
    this.filters.page = newPage;
    this.loadExpenses(false);
  }

  openAddModal(): void {
    this.editMode = false;
    this.currentEditingId = undefined;
    this.formSubmitted = false;
    this.initForm();
    this.showModal = true;
  }

  openEditModal(expense: any): void {
    this.editMode = true;
    this.currentEditingId = expense._id;
    this.formSubmitted = false;

    const formattedDate = new Date(expense.date).toISOString().slice(0, 10);
    this.expenseForm.patchValue({
      category: expense.category,
      amount: expense.amount,
      date: formattedDate,
      description: expense.description
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.expenseForm.reset();
  }

  onDelete(id: string): void {
    if (confirm('Are you sure you want to delete this record?')) {
      this.expenseService.deleteExpense(id).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.showToast('Expense deleted successfully', 'success');
            this.dataSyncService.announceTransactionChange();
            this.loadExpenses(true);
          }
        },
        error: (err) => {
          console.error(err);
          this.notificationService.showToast('Failed to delete expense', 'danger');
        }
      });
    }
  }

  onSave(): void {
    this.formSubmitted = true;

    if (this.expenseForm.invalid) {
      return;
    }

    this.modalLoading = true;
    const data = this.expenseForm.value;

    if (this.editMode && this.currentEditingId) {
      this.expenseService.updateExpense(this.currentEditingId, data).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.showModal = false;
          this.notificationService.showToast('Expense updated successfully', 'success');
          this.dataSyncService.announceTransactionChange();
          this.loadExpenses(true);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to update expense', 'danger');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.expenseService.createExpense(data).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.showModal = false;
          this.notificationService.showToast('Expense added successfully', 'success');
          this.dataSyncService.announceTransactionChange();
          this.loadExpenses(true);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to add expense', 'danger');
          this.cdr.detectChanges();
        }
      });
    }
  }

  getCategoryBadgeClass(category: string): string {
    const map: { [key: string]: string } = {
      'Food': 'badge-food',
      'Travel': 'badge-travel',
      'Shopping': 'badge-shopping',
      'Rent': 'badge-rent',
      'Bills': 'badge-bills',
      'Medical': 'badge-medical',
      'Entertainment': 'badge-entertainment',
      'Education': 'badge-education',
      'Others': 'badge-others'
    };
    return map[category] || 'badge-others';
  }
}
