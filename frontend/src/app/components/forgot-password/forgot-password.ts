import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  step = 1; // 1: Request Email, 2: Email Dispatched Notice, 3: Reset Password (with token)
  loading = false;
  
  emailForm!: FormGroup;
  resetForm!: FormGroup;

  submitted1 = false;
  submitted3 = false;

  resetToken = '';

  showPassword = false;
  strengthScore = 0;
  strengthLabel = 'None';

  private routeSub?: Subscription;
  private querySub?: Subscription;

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.routeSub = this.route.url.subscribe(urlSegments => {
      const path = urlSegments[0]?.path;
      if (path === 'reset-password') {
        this.step = 3;
      }
      this.cdr.detectChanges();
    });

    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.resetToken = params['token'];
        this.step = 3;
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.querySub) this.querySub.unsubscribe();
  }

  get f1() { return this.emailForm.controls; }
  get f3() { return this.resetForm.controls; }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { mismatch: true };
    }
    return null;
  }

  sendResetLink(): void {
    this.submitted1 = true;
    if (this.emailForm.invalid) return;

    this.loading = true;
    this.cdr.detectChanges();
    const email = this.emailForm.get('email')?.value;

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.step = 2;
          this.notificationService.showToast('Verification email sent.', 'success');
        } else {
          this.notificationService.showToast(res.message || 'Failed to dispatch email', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast(err.error?.message || 'Error sending reset email.', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  checkPasswordStrength(): void {
    const pw = this.resetForm.get('newPassword')?.value || '';
    if (pw.length === 0) {
      this.strengthScore = 0;
      this.strengthLabel = 'None';
      return;
    }

    let score = 0;
    if (pw.length >= 6) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;

    this.strengthScore = score;
    if (score === 1) this.strengthLabel = 'Weak';
    else if (score === 2) this.strengthLabel = 'Medium';
    else if (score >= 3) this.strengthLabel = 'Strong';
    else this.strengthLabel = 'None';
  }

  resetPassword(): void {
    this.submitted3 = true;
    if (this.resetForm.invalid) return;
    if (!this.resetToken) {
      this.notificationService.showToast('Reset token missing from URL.', 'danger');
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();
    
    const newPassword = this.resetForm.get('newPassword')?.value;

    this.authService.resetPassword({
      token: this.resetToken,
      newPassword
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('Password reset successful.', 'success');
          this.router.navigate(['/login']);
        } else {
          this.notificationService.showToast(res.message || 'Reset failed', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast(err.error?.message || 'Verification link expired.', 'danger');
        this.cdr.detectChanges();
      }
    });
  }
}
