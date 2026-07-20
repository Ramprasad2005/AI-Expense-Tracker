import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  loginForm!: FormGroup;
  loading = false;
  submitted = false;

  // Unverified state tracker
  isUnverified = false;
  unverifiedEmail = '';
  resendLoading = false;

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.isUnverified = false;

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    const credentials = this.loginForm.value;

    this.authService.login(credentials).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('Login successful!', 'success');
          this.router.navigate(['/dashboard']);
        } else {
          this.notificationService.showToast(res.message || 'Login failed', 'danger');
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        const errMsg = err.error?.message || 'Invalid email or password.';
        
        // ISSUE 2 & 11: Catch unverified state
        if (errMsg.includes('not verified') || err.status === 401 && err.error?.email) {
          this.isUnverified = true;
          this.unverifiedEmail = err.error?.email || credentials.email;
          this.notificationService.showToast('Your email is not verified.', 'warning');
        } else {
          this.notificationService.showToast(errMsg, 'danger');
        }
      }
    });
  }

  goToVerify(): void {
    if (this.unverifiedEmail) {
      this.router.navigate(['/verify-otp'], { queryParams: { email: this.unverifiedEmail } });
    }
  }

  resendVerification(): void {
    if (!this.unverifiedEmail) return;

    this.resendLoading = true;
    this.authService.resendOtp(this.unverifiedEmail).subscribe({
      next: (res) => {
        this.resendLoading = false;
        if (res.success) {
          this.notificationService.showToast('New 6-digit verification code sent!', 'success');
          this.router.navigate(['/verify-otp'], { queryParams: { email: this.unverifiedEmail } });
        } else {
          this.notificationService.showToast(res.message || 'Failed to send verification code.', 'danger');
        }
      },
      error: (err) => {
        this.resendLoading = false;
        console.error(err);
        const msg = err.error?.message || 'Failed to send verification code.';
        this.notificationService.showToast(msg, 'danger');
        this.router.navigate(['/verify-otp'], { queryParams: { email: this.unverifiedEmail } });
      }
    });
  }
}
