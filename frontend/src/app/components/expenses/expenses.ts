import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { NotificationService } from '../../services/notification.service';

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
  private notificationService = inject(NotificationService);

  expenses: any[] = [];
  loading = false;

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
    this.loadExpenses();
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

  loadExpenses(): void {
    this.loading = true;
    this.expenseService.getExpenses(this.filters).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.expenses = res.data;
          this.pagination = res.pagination;
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast('Failed to load expense records', 'danger');
      }
    });
  }

  onFilterChange(): void {
    this.filters.page = 1;
    this.loadExpenses();
  }

  changePage(newPage: number): void {
    this.filters.page = newPage;
    this.loadExpenses();
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
            this.loadExpenses();
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
          this.loadExpenses();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to update expense', 'danger');
        }
      });
    } else {
      this.expenseService.createExpense(data).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.showModal = false;
          this.notificationService.showToast('Expense added successfully', 'success');
          this.loadExpenses();
        },
        error: (err) => {
          this.modalLoading = false;
          console.error(err);
          this.notificationService.showToast('Failed to add expense', 'danger');
        }
      });
    }
  }

  getCategoryBadgeClass(category: string): string {
    switch (category) {
      case 'Food': return 'bg-warning text-dark';
      case 'Travel': return 'bg-primary';
      case 'Shopping': return 'bg-info text-dark';
      case 'Rent': return 'bg-danger';
      case 'Bills': return 'bg-dark text-white border border-secondary';
      case 'Medical': return 'bg-success';
      case 'Entertainment': return 'bg-secondary';
      case 'Education': return 'bg-info text-dark';
      default: return 'bg-light text-dark';
    }
  }
}
