import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationResponse, NotificationType } from '../../models/notification.types';

@Component({
  selector: 'app-dashboard-notifications',
  imports: [],
  templateUrl: './dashboard-notifications.component.html',
  styleUrl: './dashboard-notifications.component.scss',
})
export class DashboardNotificationsComponent {
  readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  typeIcon(type: NotificationType): string {
    switch (type) {
      case 'APPOINTMENT_BOOKED':      return 'event_available';
      case 'APPOINTMENT_CANCELLED':   return 'event_busy';
      case 'APPOINTMENT_RESCHEDULED': return 'event_repeat';
      case 'APPOINTMENT_PROPOSAL_RECEIVED':  return 'event_repeat';
      case 'APPOINTMENT_PROPOSAL_ACCEPTED':  return 'check_circle';
      case 'APPOINTMENT_PROPOSAL_DECLINED':  return 'cancel';
      case 'APPOINTMENT_PROPOSAL_CANCELLED': return 'cancel';
      case 'RESCHEDULE_REQUEST_RECEIVED':    return 'event_repeat';
      case 'RESCHEDULE_REQUEST_ACCEPTED':    return 'check_circle';
      case 'RESCHEDULE_REQUEST_DECLINED':    return 'cancel';
      default:                        return 'notifications';
    }
  }

  typeClass(type: NotificationType): string {
    switch (type) {
      case 'APPOINTMENT_BOOKED':      return 'type-booked';
      case 'APPOINTMENT_CANCELLED':   return 'type-cancelled';
      case 'APPOINTMENT_RESCHEDULED': return 'type-rescheduled';
      case 'APPOINTMENT_PROPOSAL_RECEIVED':  return 'type-proposal';
      case 'APPOINTMENT_PROPOSAL_ACCEPTED':  return 'type-booked';
      case 'APPOINTMENT_PROPOSAL_DECLINED':  return 'type-cancelled';
      case 'APPOINTMENT_PROPOSAL_CANCELLED': return 'type-cancelled';
      case 'RESCHEDULE_REQUEST_RECEIVED':    return 'type-proposal';
      case 'RESCHEDULE_REQUEST_ACCEPTED':    return 'type-rescheduled';
      case 'RESCHEDULE_REQUEST_DECLINED':    return 'type-cancelled';
      default:                         return 'type-general';
    }
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'agora mesmo';
    if (mins < 60) return `há ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `há ${days} dia${days > 1 ? 's' : ''}`;
    return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  }

  markAsRead(n: NotificationResponse): void {
    if (!n.read) {
      this.notificationService.markAsRead(n.id).subscribe();
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }
}
