import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/ai`;

  getSuggestions(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/suggestions`, {});
  }
}
