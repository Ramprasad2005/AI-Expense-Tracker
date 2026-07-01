import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);

  infoForm!: FormGroup;
  passwordForm!: FormGroup;
  
  infoLoading = false;
  pwLoading = false;
  
  infoSubmitted = false;
  pwSubmitted = false;

  ngOnInit(): void {
    const current = this.authService.currentUserValue;
    
    this.infoForm = this.fb.group({
      username: [current?.username || '', [Validators.required, Validators.minLength(3)]],
      email: [current?.email || '', [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group({
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  get fi() {
    return this.infoForm.controls;
  }

  get fp() {
    return this.passwordForm.controls;
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPw = control.get('newPassword');
    const confirmPw = control.get('confirmPassword');
    if (newPw && confirmPw && newPw.value !== confirmPw.value) {
      return { mismatch: true };
    }
    return null;
  }

  onUpdateInfo(): void {
    this.infoSubmitted = true;

    if (this.infoForm.invalid) {
      return;
    }

    this.infoLoading = true;
    this.authService.updateProfile(this.infoForm.value).subscribe({
      next: (res) => {
        this.infoLoading = false;
        if (res.success) {
          this.notificationService.showToast('Profile updated successfully!', 'success');
        } else {
          this.notificationService.showToast(res.message || 'Update failed', 'danger');
        }
      },
      error: (err) => {
        this.infoLoading = false;
        console.error(err);
        const errMsg = err.error?.message || 'Failed to update profile details';
        this.notificationService.showToast(errMsg, 'danger');
      }
    });
  }

  onChangePassword(): void {
    this.pwSubmitted = true;

    if (this.passwordForm.invalid) {
      return;
    }

    this.pwLoading = true;
    this.authService.changePassword(this.passwordForm.value).subscribe({
      next: (res) => {
        this.pwLoading = false;
        this.pwSubmitted = false;
        this.passwordForm.reset();
        this.notificationService.showToast('Password updated successfully!', 'success');
      },
      error: (err) => {
        this.pwLoading = false;
        console.error(err);
        const errMsg = err.error?.message || 'Failed to update password';
        this.notificationService.showToast(errMsg, 'danger');
      }
    });
  }
}
