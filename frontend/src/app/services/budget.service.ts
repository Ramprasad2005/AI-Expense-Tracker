import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/budgets`;

  getBudgets(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  getCurrentBudget(month?: string): Observable<any> {
    let params = new HttpParams();
    if (month) {
      params = params.set('month', month);
    }
    return this.http.get<any>(`${this.apiUrl}/current`, { params });
  }

  setBudget(data: { monthlyBudget: number; month: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }
}
