import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['user']
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    this.authService.register(this.registerForm.value).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('Registration successful!', 'success');
          this.router.navigate(['/dashboard']);
        } else {
          this.notificationService.showToast(res.message || 'Registration failed', 'danger');
        }
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        const errMsg = err.error?.message || 'Registration failed. Try a different username/email.';
        this.notificationService.showToast(errMsg, 'danger');
      }
    });
  }
}
