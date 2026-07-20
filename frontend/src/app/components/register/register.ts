import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  registerForm!: FormGroup;
  loading = false;
  submitted = false;

  // Registration success state
  registeredSuccess = false;
  registeredEmail = '';
  resendLoading = false;

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }

    this.registerForm = this.fb.group({
      fullName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  get f() {
    return this.registerForm.controls;
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { mismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    const { username, email, password } = this.registerForm.value;
    const role = email.toLowerCase().startsWith('admin@') ? 'admin' : 'user';

    this.authService.register({ username, email, password, role }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.registeredSuccess = true;
          this.registeredEmail = email;
          this.notificationService.showToast('Verification email has been sent.', 'success');
        } else {
          this.notificationService.showToast(res.message || 'Registration failed', 'danger');
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        const errMsg = err.status === 409
          ? (err.error?.message || 'Email already registered.')
          : (err.error?.message || 'Registration failed.');
        this.notificationService.showToast(errMsg, 'danger');
      }
    });
  }

  resendVerification(): void {
    if (!this.registeredEmail) return;

    this.resendLoading = true;
    this.authService.resendVerification(this.registeredEmail).subscribe({
      next: (res) => {
        this.resendLoading = false;
        if (res.success) {
          this.notificationService.showToast('Verification email sent.', 'success');
        } else {
          this.notificationService.showToast(res.message || 'Failed to resend verification.', 'danger');
        }
      },
      error: (err) => {
        this.resendLoading = false;
        console.error(err);
        this.notificationService.showToast(err.error?.message || 'Failed to resend verification.', 'danger');
      }
    });
  }
}
