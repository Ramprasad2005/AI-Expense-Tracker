import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/reports';

  getReport(type: string, period: string): Observable<any> {
    return this.http.get<any>(this.apiUrl, {
      params: { type, period, pdf: 'false' }
    });
  }

  downloadReportPdf(type: string, period: string): Observable<Blob> {
    return this.http.get(this.apiUrl, {
      params: { type, period, pdf: 'true' },
      responseType: 'blob'
    });
  }
}
