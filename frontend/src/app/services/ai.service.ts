import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5050/api/ai';

  getSuggestions(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/suggestions`, {});
  }
}
