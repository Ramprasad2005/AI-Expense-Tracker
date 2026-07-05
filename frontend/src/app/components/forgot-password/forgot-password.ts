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

  step = 1;
  loading = false;
  
  // Forms
  emailForm!: FormGroup;
  otpForm!: FormGroup;
  resetForm!: FormGroup;

  // Validation submitted flags
  submitted1 = false;
  submitted2 = false;
  submitted3 = false;

  // OTP Reset Token from verify-otp response
  resetToken = '';

  // Timer trackers
  private expiryTimer: any;
  private resendInterval: any;
  
  expirySecondsLeft = 300; // 5 mins
  timerLabel = '05:00';
  resendCooldown = 0;

  // Password Options
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

    // 6 discrete controls for each OTP box (otp0 - otp5)
    this.otpForm = this.fb.group({
      otp0: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp1: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp2: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp3: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp4: ['', [Validators.required, Validators.pattern('^[0-9]$')]],
      otp5: ['', [Validators.required, Validators.pattern('^[0-9]$')]]
    });

    this.resetForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    // Track active route path
    this.routeSub = this.route.url.subscribe(urlSegments => {
      const path = urlSegments[0]?.path;
      if (path === 'verify-otp') {
        this.step = 2;
        this.startOtpTimers();
      } else if (path === 'reset-password') {
        this.step = 3;
      } else {
        this.step = 1;
        this.clearTimers();
      }
      this.cdr.detectChanges();
    });

    // Track query parameters
    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.emailForm.patchValue({ email: params['email'] });
      }
      if (params['token']) {
        this.resetToken = params['token'];
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
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

  clearTimers(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    if (this.resendInterval) clearInterval(this.resendInterval);
  }

  startOtpTimers(): void {
    this.clearTimers();
    
    // 5 Mins Expiry Countdown
    this.expirySecondsLeft = 300;
    this.updateTimerLabel();
    this.expiryTimer = setInterval(() => {
      this.expirySecondsLeft--;
      this.updateTimerLabel();
      if (this.expirySecondsLeft <= 0) {
        clearInterval(this.expiryTimer);
        this.notificationService.showToast('Your OTP code has expired. Please request a new one.', 'warning');
        this.router.navigate(['/forgot-password']);
      }
      this.cdr.detectChanges();
    }, 1000);

    // 60s Resend Cooldown
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
    const mins = Math.floor(this.expirySecondsLeft / 60);
    const secs = this.expirySecondsLeft % 60;
    this.timerLabel = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  sendOtp(): void {
    this.submitted1 = true;
    if (this.emailForm.invalid) return;

    this.loading = true;
    this.cdr.detectChanges();
    const email = this.emailForm.get('email')?.value;

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('Verification OTP sent successfully', 'success');
          this.router.navigate(['/verify-otp'], { queryParams: { email } });
        } else {
          this.notificationService.showToast(res.message || 'Failed to dispatch OTP', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast(err.error?.message || 'Error sending OTP verification code', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  resendOtp(): void {
    if (this.resendCooldown > 0) return;
    this.sendOtp();
  }

  // Box focus helpers
  onOtpInput(event: any, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Allow numeric digits only
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

    // Filter only numeric values
    const cleanDigits = pasteData.replace(/\D/g, '').substring(0, 6);
    if (cleanDigits.length === 6) {
      const patchObj: any = {};
      for (let i = 0; i < 6; i++) {
        patchObj[`otp${i}`] = cleanDigits[i];
      }
      this.otpForm.patchValue(patchObj);
      this.cdr.detectChanges();
      
      // Focus on last input
      const lastInput = document.getElementById('otp-5');
      if (lastInput) lastInput.focus();
    }
  }

  verifyOtp(): void {
    this.submitted2 = true;
    if (this.otpForm.invalid) return;

    this.loading = true;
    this.cdr.detectChanges();
    
    const email = this.emailForm.get('email')?.value;
    const otp = [
      this.otpForm.value.otp0,
      this.otpForm.value.otp1,
      this.otpForm.value.otp2,
      this.otpForm.value.otp3,
      this.otpForm.value.otp4,
      this.otpForm.value.otp5
    ].join('');

    this.authService.verifyOtp(email, otp).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.resetToken) {
          this.resetToken = res.resetToken;
          this.clearTimers();
          this.notificationService.showToast('OTP verified. Set new password.', 'success');
          this.router.navigate(['/reset-password'], { queryParams: { email, token: res.resetToken } });
        } else {
          this.notificationService.showToast(res.message || 'OTP validation failed', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast(err.error?.message || 'Verification failed. Try again.', 'danger');
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
    if (pw.length >= 8) score++;
    
    const hasLower = /[a-z]/.test(pw);
    const hasUpper = /[A-Z]/.test(pw);
    const hasDigit = /[0-9]/.test(pw);
    const hasSpecial = /[@$!%*?&]/.test(pw);

    if (hasLower && hasUpper) score++;
    if (hasDigit && hasSpecial) score++;

    this.strengthScore = score;

    if (score === 1) {
      this.strengthLabel = 'Weak';
    } else if (score === 2) {
      this.strengthLabel = 'Medium';
    } else if (score === 3) {
      this.strengthLabel = 'Strong';
    } else {
      this.strengthLabel = 'None';
    }
  }

  resetPassword(): void {
    this.submitted3 = true;
    if (this.resetForm.invalid) return;

    this.loading = true;
    this.cdr.detectChanges();
    
    const email = this.emailForm.get('email')?.value;
    const newPassword = this.resetForm.get('newPassword')?.value;

    this.authService.resetPassword({
      email,
      token: this.resetToken,
      newPassword
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.notificationService.showToast('Password reset complete. You can login now!', 'success');
          this.router.navigate(['/login']);
        } else {
          this.notificationService.showToast(res.message || 'Reset failed', 'danger');
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
        this.notificationService.showToast(err.error?.message || 'Failed to reset password', 'danger');
        this.cdr.detectChanges();
      }
    });
  }
}
