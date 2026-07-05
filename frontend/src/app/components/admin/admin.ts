import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  loading = false;

  analytics = {
    totalUsers: 0,
    totalTransactions: 0,
    totalIncomeVolume: 0,
    totalExpenseVolume: 0,
    userStats: [] as any[]
  };

  ngOnInit(): void {
    this.loadAdminData();
  }

  loadAdminData(): void {
    this.loading = true;
    this.adminService.getAnalytics().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.analytics = res.data;
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast('Failed to load system analytics', 'danger');
      }
    });
  }

  onDeleteUser(user: any): void {
    if (user.email === this.authService.currentUserValue?.email) {
      this.notificationService.showToast('Cannot delete your own administrator account', 'warning');
      return;
    }

    if (user.role === 'admin') {
      this.notificationService.showToast('Cannot delete other administrative users', 'warning');
      return;
    }

    if (confirm(`CRITICAL WARNING: Are you sure you want to permanently delete user "${user.username}" (${user.email})? This will erase all of their logs, incomes, expenses, reports, and budgets. This cannot be undone.`)) {
      this.adminService.deleteUser(user._id).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.showToast('User and all associated data deleted successfully', 'success');
            this.loadAdminData();
          }
        },
        error: (err) => {
          console.error(err);
          this.notificationService.showToast(err.error?.message || 'Failed to delete user', 'danger');
        }
      });
    }
  }
}
