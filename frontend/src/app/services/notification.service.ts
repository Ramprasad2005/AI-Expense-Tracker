import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

import { API_BASE_URL } from '../config';

export interface Toast {
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/notifications`;

  private toastSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastSubject.asObservable();

  showToast(message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info', duration: number = 4000) {
    const current = this.toastSubject.value;
    const toast: Toast = { message, type, duration };
    this.toastSubject.next([...current, toast]);

    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  removeToast(toast: Toast) {
    this.toastSubject.next(this.toastSubject.value.filter(t => t !== toast));
  }

  getNotifications(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  markAsRead(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/read-all`, {});
  }

  deleteNotification(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
