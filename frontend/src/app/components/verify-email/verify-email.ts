import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.css']
})
export class VerifyEmailComponent implements OnInit {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = true;
  success = false;
  errorMessage = '';
  token = '';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.loading = false;
        this.success = false;
        this.errorMessage = 'Verification token missing from URL link.';
        return;
      }
      this.verifyToken();
    });
  }

  verifyToken(): void {
    this.loading = true;
    this.authService.verifyEmail(this.token).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.success = true;
          this.notificationService.showToast('Email Verified Successfully', 'success');
        } else {
          this.success = false;
          this.errorMessage = res.message || 'Verification link expired.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.success = false;
        this.errorMessage = err.error?.message || 'Verification link expired.';
      }
    });
  }
}
