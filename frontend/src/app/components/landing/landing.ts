import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.html',
  styleUrls: ['./landing.css']
})
export class LandingComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  router = inject(Router);

  currentTheme: 'light' | 'dark' = 'light';
  currentYear = new Date().getFullYear();
  private themeListener?: () => void;

  ngOnInit(): void {
    // If logged in, redirect to dashboard automatically
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }

    this.currentTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    this.updateThemeClass();

    // Listen to theme changes from other components
    this.themeListener = () => {
      this.currentTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    };
    window.addEventListener('themeChanged', this.themeListener);
  }

  toggleTheme(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.currentTheme);
    this.updateThemeClass();
    window.dispatchEvent(new Event('themeChanged'));
  }

  private updateThemeClass(): void {
    if (this.currentTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  ngOnDestroy(): void {
    if (this.themeListener) {
      window.removeEventListener('themeChanged', this.themeListener);
    }
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
