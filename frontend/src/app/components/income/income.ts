import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IncomeService } from '../../services/income.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { DataSyncService } from '../../services/datasync.service';

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './income.html',
  styleUrls: ['./income.css']
})
export class IncomeComponent implements OnInit {
  private fb = inject(FormBuilder);
  private incomeService = inject(IncomeService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private dataSyncService = inject(DataSyncService);
  private cdr = inject(ChangeDetectorRef);

  incomes: any[] = [];
  loading = false;
  backgroundRefreshing = false;
  
  // Filters state
  filters = {
    search: '',
    source: '',
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

  // Modal State
  showModal = false;
  editMode = false;
  currentEditingId?: string;
  incomeForm!: FormGroup;
  formSubmitted = false;
  modalLoading = false;

  ngOnInit(): void {
    this.loadIncomes(false);
    this.initForm();
  }

  initForm(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.incomeForm = this.fb.group({
      source: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      date: [today, Validators.required],
      description: ['']
    });
  }

  get f() {
    return this.incomeForm.controls;
  }

  getStorageKey(): string {
    const user = this.authService.currentUserValue;
    const userId = user ? user._id : 'guest';
    return `cached_income_${userId}_page_${this.filters.page}_limit_${this.filters.limit}_sort_${this.filters.sortBy}_order_${this.filters.sortOrder}_search_${this.filters.search}_source_${this.filters.source}_start_${this.filters.startDate}_end_${this.filters.endDate}`;
  }

  loadIncomes(forceFresh = false): void {
    const key = this.getStorageKey();
    const cached = localStorage.getItem(key);
    
    if (cached && !forceFresh) {
      try {
        const parsed = JSON.parse(cached);
        this.incomes = parsed.data;
        this.pagination = parsed.pagination;
        this.loading = false;
        
        // Background refresh only (stale-while-revalidate)
        this.backgroundRefreshing = true;
        this.fetchFreshIncomes(key);
        return;
      } catch (e) {
        console.error('Error loading cached income:', e);
      }
    }
    
    // Fallback if no cache exists or fresh reload requested
    this.loading = true;
    this.fetchFreshIncomes(key);
  }

  fetchFreshIncomes(cacheKey: string): void {
    this.incomeService.getIncomes(this.filters).subscribe({
      next: (res) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        if (res.success) {
          this.incomes = res.data;
          this.pagination = res.pagination;
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res));
          } catch (e) {
            console.error('Error saving cache:', e);
          }
        }
      },
      error: (err) => {
        this.loading = false;
        this.backgroundRefreshing = false;
        console.error(err);
        this.notificationService.showToast('Failed to load income records', 'danger');
      }
    });
  }

  onFilterChange(): void {
    this.filters.page = 1;
    this.loadIncomes(true);
  }

  changePage(newPage: number): void {
    this.filters.page = newPage;
    this.loadIncomes(false);
  }

  openAddModal(): void {
    this.editMode = false;
    this.currentEditingId = undefined;
    this.formSubmitted = false;
    this.initForm();
    this.showModal = true;
  }

  openEditModal(income: any): void {
    this.editMode = true;
    this.currentEditingId = income._id;
    this.formSubmitted = false;
    
    const formattedDate = new Date(income.date).toISOString().slice(0, 10);
    this.incomeForm.patchValue({
      source: income.source,
      amount: income.amount,
      date: formattedDate,
      description: income.description
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.incomeForm.reset();
  }

  onDelete(id: string): void {
    if (confirm('Are you sure you want to delete this record?')) {
      this.incomeService.deleteIncome(id).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.showToast('Income deleted successfully', 'success');
            this.dataSyncService.announceTransactionChange();
            this.loadIncomes(true);
          }
        },
        error: (err) => {
          console.error(err);
          this.notificationService.showToast('Failed to delete income', 'danger');
        }
      });
    }
  }

  onSave(): void {
    this.formSubmitted = true;

    if (this.incomeForm.invalid) {
      return;
    }

    this.modalLoading = true;
    const data = this.incomeForm.value;

    if (this.editMode && this.currentEditingId) {
      this.incomeService.updateIncome(this.currentEditingId, data).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.showModal = false;
          this.notificationService.showToast('Income updated successfully', 'success');
          this.dataSyncService.announceTransactionChange();
          this.loadIncomes(true);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to update income', 'danger');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.incomeService.createIncome(data).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.showModal = false;
          this.notificationService.showToast('Income added successfully', 'success');
          this.dataSyncService.announceTransactionChange();
          this.loadIncomes(true);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to add income', 'danger');
          this.cdr.detectChanges();
        }
      });
    }
  }
}
