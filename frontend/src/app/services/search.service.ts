import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/search`;

  search(filters: any): Observable<any> {
    let params = new HttpParams();
    
    if (filters.q) params = params.set('q', filters.q);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.minAmount) params = params.set('minAmount', String(filters.minAmount));
    if (filters.maxAmount) params = params.set('maxAmount', String(filters.maxAmount));
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);
    if (filters.page) params = params.set('page', String(filters.page));
    if (filters.limit) params = params.set('limit', String(filters.limit));

    return this.http.get<any>(this.apiUrl, { params });
  }
}
