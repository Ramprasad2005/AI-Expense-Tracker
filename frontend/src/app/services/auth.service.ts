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
    return this.http.post<any>(`${this.apiUrl}/register`, userData).pipe(
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

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-otp`, { email, otp });
  }

  resetPassword(resetData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, resetData);
  }

  verifyRegistrationOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-registration-otp`, { email, otp });
  }

  resendRegistrationOtp(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resend-registration-otp`, { email });
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user && user.role === 'admin';
  }
}
