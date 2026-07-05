import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  // Forms
  infoForm: FormGroup;
  prefForm: FormGroup;
  passwordForm: FormGroup;

  // Loading & submission flags
  infoLoading = false;
  prefLoading = false;
  pwLoading = false;
  logoutLoading = false;
  deleteLoading = false;
  infoSubmitted = false;
  pwSubmitted = false;

  // Password strength UI
  strengthScore = 0; // 0 = none, 1 = weak, 2 = medium, 3 = strong
  strengthLabel = 'Weak';

  // Convenience getter for form controls
  get fi(): { [key: string]: AbstractControl } { return this.infoForm.controls; }
  get fp(): { [key: string]: AbstractControl } { return this.passwordForm.controls; }

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private notif: NotificationService,
    private router: Router
  ) {
    // Initialise forms
    this.infoForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]]
    });

    this.prefForm = this.fb.group({
      expenseAdded: [false],
      incomeAdded: [false],
      budgetExceeded: [false],
      monthlyReportGenerated: [false]
    });

    this.passwordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Populate account details
    this.auth.getProfile().subscribe((res: any) => {
      if (res.success && res.data) {
        this.infoForm.patchValue({
          username: res.data.username || '',
          email: res.data.email || ''
        });
      }
    });

    // Load notification preferences
    const user = this.auth.currentUserValue;
    if (user && user.notificationPreferences) {
      this.prefForm.patchValue(user.notificationPreferences);
    }
  }

  // Custom validator for password confirmation
  private passwordMatchValidator(group: FormGroup) {
    const newPwd = group.get('newPassword')?.value;
    const confirmPwd = group.get('confirmPassword')?.value;
    return newPwd === confirmPwd ? null : { mismatch: true };
  }

  // ---------------------- Account Info ----------------------
  onUpdateInfo(): void {
    this.infoSubmitted = true;
    if (this.infoForm.invalid) return;
    this.infoLoading = true;
    const payload = this.infoForm.value;
    this.auth.updateProfile(payload).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.notif.showToast('Profile updated successfully', 'success');
        }
        this.infoLoading = false;
      },
      error: (err: any) => {
        console.error('Update profile error', err);
        this.notif.showToast(err.error?.message || 'Failed to update profile', 'danger');
        this.infoLoading = false;
      }
    });
  }

  // ---------------------- Notification Preferences ----------------------
  onUpdatePrefs(): void {
    this.prefLoading = true;
    const prefs = this.prefForm.value;
    this.auth.updateNotificationPreferences(prefs).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.notif.showToast('Preferences saved', 'success');
        }
        this.prefLoading = false;
      },
      error: (err: any) => {
        console.error('Update prefs error', err);
        this.notif.showToast('Failed to save preferences', 'danger');
        this.prefLoading = false;
      }
    });
  }

  // ---------------------- Password Change ----------------------
  checkPasswordStrength(): void {
    const pwd = this.passwordForm.get('newPassword')?.value || '';
    let score = 0;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    // Normalize to 0‑3 range for UI
    this.strengthScore = Math.min(3, Math.floor(score / 2));
    this.strengthLabel = ['Weak', 'Weak', 'Medium', 'Strong'][this.strengthScore];
  }

  onChangePassword(): void {
    this.pwSubmitted = true;
    if (this.passwordForm.invalid) return;
    this.pwLoading = true;
    const { oldPassword, newPassword } = this.passwordForm.value;
    this.auth.changePassword({ oldPassword, newPassword }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.notif.showToast('Password changed successfully', 'success');
          this.passwordForm.reset();
          this.pwSubmitted = false;
          this.strengthScore = 0;
          this.strengthLabel = 'Weak';
        }
        this.pwLoading = false;
      },
      error: (err: any) => {
        console.error('Password change error', err);
        this.notif.showToast(err.error?.message || 'Failed to change password', 'danger');
        this.pwLoading = false;
      }
    });
  }

  // ---------------------- Danger Zone ----------------------
  onLogoutAll(): void {
    this.logoutLoading = true;
    this.auth.logoutAllDevices().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.notif.showToast('Logged out from all devices', 'success');
          this.auth.logout();
          this.router.navigate(['/login']);
        }
        this.logoutLoading = false;
      },
      error: (err: any) => {
        console.error('Logout all error', err);
        this.notif.showToast('Failed to logout all devices', 'danger');
        this.logoutLoading = false;
      }
    });
  }

  onDeleteAccount(): void {
    if (!confirm('Are you absolutely sure you want to permanently delete your account? This action cannot be undone.')) return;
    this.deleteLoading = true;
    this.auth.deleteUserAccount().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.notif.showToast('Account deleted', 'success');
          this.auth.logout();
          this.router.navigate(['/login']);
        }
        this.deleteLoading = false;
      },
      error: (err: any) => {
        console.error('Delete account error', err);
        this.notif.showToast('Failed to delete account', 'danger');
        this.deleteLoading = false;
      }
    });
  }
}

