import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/auth';
  
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
          localStorage.setItem('currentUser', JSON.stringify(res.data));
          this.currentUserSubject.next(res.data);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
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
    return this.http.put<any>(`${this.apiUrl}/password`, passwordData);
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user && user.role === 'admin';
  }
}
