import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-verify-registration',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './verify-registration.html',
  styleUrls: ['./verify-registration.css']
})
export class VerifyRegistrationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  loading = false;
  submitted = false;

  // Animation states
  isSuccess = false;
  isError = false;

  otpForm!: FormGroup;

  // Timers
  private expiryTimer: any;
  private resendInterval: any;

  expirySecondsLeft = 600; // 10 minutes
  timerLabel = '10:00';
  resendCooldown = 60; // 60s cooldown

  private querySub?: Subscription;

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.otpForm = this.fb.group({
      otp0: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp1: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp2: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp3: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp4: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp5: ['', [Validators.required, Validators.pattern('^[0-9]$')]]
    });

    this.querySub = this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      if (!this.email) {
        this.notificationService.showToast('Email address is required for verification.', 'danger');
        this.router.navigate(['/register']);
        return;
      }
      this.cdr.detectChanges();
    });

    this.startOtpTimers();

    // Auto-focus first input box
    setTimeout(() => {
      const firstInput = document.getElementById('otp-0');
      if (firstInput) firstInput.focus();
    }, 150);
  }

  ngOnDestroy(): void {
    this.clearTimers();
    if (this.querySub) this.querySub.unsubscribe();
  }

  clearTimers(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    if (this.resendInterval) clearInterval(this.resendInterval);
  }

  startOtpTimers(): void {
    this.clearTimers();

    this.expirySecondsLeft = 600;
    this.updateTimerLabel();
    this.expiryTimer = setInterval(() => {
      this.expirySecondsLeft--;
      this.updateTimerLabel();
      if (this.expirySecondsLeft <= 0) {
        clearInterval(this.expiryTimer);
        this.notificationService.showToast('Verification code has expired. Please request a new code.', 'warning');
      }
      this.cdr.detectChanges();
    }, 1000);

    this.resendCooldown = 60;
    this.resendInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendInterval);
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  updateTimerLabel(): void {
    const mins = Math.floor(Math.max(0, this.expirySecondsLeft) / 60);
    const secs = Math.max(0, this.expirySecondsLeft) % 60;
    this.timerLabel = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  onOtpInput(event: any, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (value && !/^[0-9]$/.test(value)) {
      input.value = '';
      return;
    }

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace') {
      if (!input.value && index > 0) {
        const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
        if (prevInput) {
          prevInput.focus();
          prevInput.value = '';
        }
      } else {
        input.value = '';
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasteData = event.clipboardData?.getData('text');
    if (!pasteData) return;

    const cleanDigits = pasteData.replace(/\D/g, '').substring(0, 6);
    if (cleanDigits.length === 6) {
      const patchObj: any = {};
      for (let i = 0; i < 6; i++) {
        patchObj[`otp${i}`] = cleanDigits[i];
      }
      this.otpForm.patchValue(patchObj);
      this.cdr.detectChanges();

      const lastInput = document.getElementById('otp-5');
      if (lastInput) lastInput.focus();
    }
  }

  onSubmit(): void {
    this.submitted = true;
    this.isError = false;

    if (this.otpForm.invalid) {
      this.triggerErrorAnimation();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    const otp = [
      this.otpForm.value.otp0,
      this.otpForm.value.otp1,
      this.otpForm.value.otp2,
      this.otpForm.value.otp3,
      this.otpForm.value.otp4,
      this.otpForm.value.otp5
    ].join('');

    this.authService.verifyOtp(this.email, otp).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          this.isSuccess = true;
          this.notificationService.showToast('Email verified successfully! Welcome to AI Expense Tracker.', 'success');
          this.cdr.detectChanges();

          setTimeout(() => {
            if (this.authService.isLoggedIn()) {
              this.router.navigate(['/dashboard']);
            } else {
              this.router.navigate(['/login']);
            }
          }, 1200);
        } else {
          this.triggerErrorAnimation();
          this.notificationService.showToast(res.message || 'Verification failed.', 'danger');
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.triggerErrorAnimation();
        console.error(err);
        const msg = err.error?.message || 'Verification failed. Please check your OTP and try again.';
        this.notificationService.showToast(msg, 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  triggerErrorAnimation(): void {
    this.isError = true;
    setTimeout(() => {
      this.isError = false;
      this.cdr.detectChanges();
    }, 800);
  }

  resendOtp(): void {
    if (this.resendCooldown > 0) return;

    this.loading = true;
    this.cdr.detectChanges();

    this.authService.resendOtp(this.email).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('A new 6-digit verification code has been sent to your email.', 'success');
          this.startOtpTimers();
        } else {
          this.notificationService.showToast(res.message || 'Failed to resend verification code.', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        console.error(err);
        const msg = err.error?.message || 'Failed to resend code.';
        this.notificationService.showToast(msg, 'danger');
        this.cdr.detectChanges();
      }
    });
  }
}
