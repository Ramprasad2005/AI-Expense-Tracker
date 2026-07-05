import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { DashboardComponent } from './components/dashboard/dashboard';
import { IncomeComponent } from './components/income/income';
import { ExpensesComponent } from './components/expenses/expenses';
import { BudgetComponent } from './components/budget/budget';
import { ReportsComponent } from './components/reports/reports';
import { ProfileComponent } from './components/profile/profile';
import { AdminComponent } from './components/admin/admin';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password';
import { VerifyRegistrationComponent } from './components/verify-registration/verify-registration';
import { SettingsComponent } from './components/settings/settings';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'verify-registration', component: VerifyRegistrationComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'verify-otp', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ForgotPasswordComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'income', component: IncomeComponent, canActivate: [authGuard] },
  { path: 'expenses', component: ExpensesComponent, canActivate: [authGuard] },
  { path: 'budget', component: BudgetComponent, canActivate: [authGuard] },
  { path: 'reports', component: ReportsComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard, adminGuard] },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' }
];
