import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/reports`;

  getReport(type: string, period: string, startDate?: string, endDate?: string, refresh?: boolean): Observable<any> {
    const params: any = { type, period, startDate: startDate || '', endDate: endDate || '', pdf: 'false' };
    if (refresh) {
      params.refresh = 'true';
    }
    return this.http.get<any>(this.apiUrl, { params });
  }

  downloadReportPdf(type: string, period: string, startDate?: string, endDate?: string): Observable<Blob> {
    return this.http.get(this.apiUrl, {
      params: { type, period, startDate: startDate || '', endDate: endDate || '', pdf: 'true' },
      responseType: 'blob'
    });
  }

  downloadReportCsv(type: string, period: string, startDate?: string, endDate?: string): Observable<Blob> {
    return this.http.get(this.apiUrl, {
      params: { type, period, startDate: startDate || '', endDate: endDate || '', csv: 'true' },
      responseType: 'blob'
    });
  }
}
