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
    const { fullName, username, email, password } = this.registerForm.value;
    const role = email.toLowerCase().startsWith('admin@') ? 'admin' : 'user';

    this.authService.register({ fullName, username, email, password, role }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('Verification code sent to your email!', 'success');
          this.router.navigate(['/verify-otp'], { queryParams: { email: email.toLowerCase().trim() } });
        } else {
          this.notificationService.showToast(res.message || 'Registration failed', 'danger');
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        const errMsg = err.status === 409
          ? (err.error?.message || 'Email or Username already registered.')
          : (err.error?.message || 'Registration failed.');
        this.notificationService.showToast(errMsg, 'danger');
      }
    });
  }
}
