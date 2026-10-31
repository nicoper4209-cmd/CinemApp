import { Component, inject } from '@angular/core';
import { NotificationsService } from '../../services/notifications';

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.html',
  styleUrl: './notification-settings.css',
})
export class NotificationSettings {
  notifications = inject(NotificationsService);
}
