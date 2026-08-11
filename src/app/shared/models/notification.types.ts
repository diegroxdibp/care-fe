export type NotificationType =
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_PROPOSAL_RECEIVED'
  | 'APPOINTMENT_PROPOSAL_ACCEPTED'
  | 'APPOINTMENT_PROPOSAL_DECLINED'
  | 'APPOINTMENT_PROPOSAL_CANCELLED'
  | 'RESCHEDULE_REQUEST_RECEIVED'
  | 'RESCHEDULE_REQUEST_ACCEPTED'
  | 'RESCHEDULE_REQUEST_DECLINED'
  | 'GENERAL';

export type Role =
  | 'ADMIN'
  | 'USER'
  | 'MODERATOR'
  | 'THERAPIST'
  | 'PATIENT'
  | 'PROFESSIONAL'
  | 'CLIENT';

export type SessionService =
  | 'REICHIAN_BODY_ANALYSIS'
  | 'MINDFULNESS'
  | 'SOMATIC_EXPERIENCE'
  | 'SUPERVISION';

export interface NotificationResponse {
  id: number;
  message: string;
  type: NotificationType;
  read: boolean;
  /** Optional deep-link — e.g. a recurring-appointment-proposal confirmation page. */
  link?: string | null;
  /** ISO-8601 datetime string, e.g. "2026-05-23T14:30:00" */
  createdAt: string;
}

export interface BroadcastNotificationRequest {
  /** At least one role required */
  roles: Role[];
  /** Null means no service filter — all users with the given roles are targeted */
  services?: SessionService[] | null;
  message: string;
}

export interface UnreadCountResponse {
  count: number;
}
