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

  step = 1; // 1: Request Email, 2: Email Sent Notice, 3: Reset Password Form, 4: Expired Token Error
  loading = false;
  validatingToken = false;
  tokenValid = false;
  tokenErrorMessage = '';
  
  emailForm!: FormGroup;
  resetForm!: FormGroup;

  submitted1 = false;
  submitted3 = false;

  resetToken = '';
  dispatchedEmailMessage = "We've securely sent a password reset link to your registered email address.";

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
        const token = this.route.snapshot.queryParams['token'];
        if (token) {
          this.resetToken = token;
          this.verifyTokenOnLoad(token);
        } else {
          this.step = 4;
          this.tokenErrorMessage = 'No reset token provided in URL. Please request a new reset link.';
        }
      }
      this.cdr.detectChanges();
    });

    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['token'] && this.step !== 3 && this.step !== 4) {
        this.resetToken = params['token'];
        this.verifyTokenOnLoad(params['token']);
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

  verifyTokenOnLoad(token: string): void {
    this.validatingToken = true;
    this.cdr.detectChanges();

    this.authService.validateResetToken(token).subscribe({
      next: (res) => {
        this.validatingToken = false;
        if (res.success) {
          this.tokenValid = true;
          this.step = 3;
        } else {
          this.tokenValid = false;
          this.step = 4;
          this.tokenErrorMessage = res.message || 'Verification link expired or invalid.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.validatingToken = false;
        this.tokenValid = false;
        this.step = 4;
        this.tokenErrorMessage = err.error?.message || 'Verification link expired or invalid. Please request a new recovery link.';
        this.cdr.detectChanges();
      }
    });
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
          if (res.message) {
            this.dispatchedEmailMessage = res.message;
          }
          this.notificationService.showToast(this.dispatchedEmailMessage, 'success');
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

  goToRequestStep(): void {
    this.step = 1;
    this.resetToken = '';
    this.tokenValid = false;
    this.router.navigate(['/forgot-password']);
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
          this.notificationService.showToast('Password reset successful! Redirecting to sign in...', 'success');
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1500);
        } else {
          this.notificationService.showToast(res.message || 'Reset failed', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        const msg = err.error?.message || 'Verification link expired or invalid.';
        this.notificationService.showToast(msg, 'danger');
        this.cdr.detectChanges();
      }
    });
  }
}
