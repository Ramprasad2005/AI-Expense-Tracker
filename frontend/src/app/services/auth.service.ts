import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/auth`;
  
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }

  public get currentUserValue(): any {
    return this.currentUserSubject.value;
  }

  public get token(): string | null {
    const user = this.currentUserValue;
    return user ? user.token : null;
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData);
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        if (res && res.success && res.data) {
          const theme = localStorage.getItem('theme');
          localStorage.clear();
          sessionStorage.clear();
          if (theme) {
            localStorage.setItem('theme', theme);
          }
          localStorage.setItem('currentUser', JSON.stringify(res.data));
          this.currentUserSubject.next(res.data);
        }
      })
    );
  }

  logout(): void {
    const theme = localStorage.getItem('theme');
    localStorage.clear();
    sessionStorage.clear();
    if (theme) {
      localStorage.setItem('theme', theme);
    }
    this.currentUserSubject.next(null);
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-email`, { token });
  }

  resendVerification(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resend-otp`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-otp`, { email, otp }).pipe(
      tap(res => {
        if (res && res.success && res.data && res.data.token) {
          const theme = localStorage.getItem('theme');
          localStorage.clear();
          sessionStorage.clear();
          if (theme) {
            localStorage.setItem('theme', theme);
          }
          localStorage.setItem('currentUser', JSON.stringify(res.data));
          this.currentUserSubject.next(res.data);
        }
      })
    );
  }

  resendOtp(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resend-otp`, { email });
  }

  checkOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/check-otp`, { email, otp });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email });
  }

  validateResetToken(token: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/validate-reset-token`, { params: { token } });
  }

  resetPassword(resetData: { token: string; newPassword: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, resetData);
  }

  // Compatibility methods
  verifyRegistrationOtp(email: string, otp: string): Observable<any> {
    return this.verifyOtp(email, otp);
  }

  resendRegistrationOtp(email: string): Observable<any> {
    return this.resendOtp(email);
  }

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/profile`);
  }

  updateProfile(profileData: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/profile`, profileData).pipe(
      tap(res => {
        if (res && res.success && res.data) {
          const current = this.currentUserValue;
          const updated = { ...current, ...res.data };
          localStorage.setItem('currentUser', JSON.stringify(updated));
          this.currentUserSubject.next(updated);
        }
      })
    );
  }

  changePassword(passwordData: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/password`, passwordData).pipe(
      tap(res => {
        if (res && res.success && res.token) {
          const current = this.currentUserValue;
          const updated = { ...current, token: res.token };
          localStorage.setItem('currentUser', JSON.stringify(updated));
          this.currentUserSubject.next(updated);
        }
      })
    );
  }

  updateNotificationPreferences(preferences: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/preferences`, { preferences }).pipe(
      tap(res => {
        if (res && res.success) {
          const current = this.currentUserValue;
          const updated = { ...current, notificationPreferences: res.data };
          localStorage.setItem('currentUser', JSON.stringify(updated));
          this.currentUserSubject.next(updated);
        }
      })
    );
  }

  logoutAllDevices(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/logout-all`, {});
  }

  deleteUserAccount(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/account`);
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user && user.role === 'admin';
  }
}
