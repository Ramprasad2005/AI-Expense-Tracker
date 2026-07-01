import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  private router = inject(Router);

  notifications: any[] = [];
  unreadCount = 0;
  private pollSub?: Subscription;

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.loadNotifications();
      // Poll notifications every 30 seconds
      this.pollSub = interval(30000).subscribe(() => this.loadNotifications());
    }
  }

  ngOnDestroy(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
  }

  loadNotifications(): void {
    this.notificationService.getNotifications().subscribe({
      next: (res) => {
        if (res.success) {
          this.notifications = res.data;
          this.unreadCount = res.unreadCount;
        }
      },
      error: (err) => console.error('Error fetching notifications', err)
    });
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id).subscribe({
      next: () => this.loadNotifications()
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => this.loadNotifications()
    });
  }

  onLogout(): void {
    this.authService.logout();
    if (this.pollSub) {
      this.pollSub.unsubscribe();
    }
    this.router.navigate(['/login']);
  }
}
