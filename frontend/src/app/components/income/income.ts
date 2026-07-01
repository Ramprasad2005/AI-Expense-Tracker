import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IncomeService } from '../../services/income.service';
import { NotificationService } from '../../services/notification.service';

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
  private notificationService = inject(NotificationService);

  incomes: any[] = [];
  loading = false;
  
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
    this.loadIncomes();
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

  loadIncomes(): void {
    this.loading = true;
    this.incomeService.getIncomes(this.filters).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.incomes = res.data;
          this.pagination = res.pagination;
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast('Failed to load income records', 'danger');
      }
    });
  }

  onFilterChange(): void {
    this.filters.page = 1;
    this.loadIncomes();
  }

  changePage(newPage: number): void {
    this.filters.page = newPage;
    this.loadIncomes();
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
            this.loadIncomes();
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
          this.loadIncomes();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to update income', 'danger');
        }
      });
    } else {
      this.incomeService.createIncome(data).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.showModal = false;
          this.notificationService.showToast('Income added successfully', 'success');
          this.loadIncomes();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to add income', 'danger');
        }
      });
    }
  }
}
