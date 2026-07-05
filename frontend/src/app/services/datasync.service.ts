import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataSyncService {
  private transactionSource = new Subject<void>();
  public transactionChange$ = this.transactionSource.asObservable();

  private budgetSource = new Subject<void>();
  public budgetChange$ = this.budgetSource.asObservable();

  announceTransactionChange(): void {
    this.transactionSource.next();
  }

  announceBudgetChange(): void {
    this.budgetSource.next();
  }
}
