import { SessionService } from './../../shared/services/session.service';
import { SchedulingService } from './../../shared/services/scheduling.service';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AvailabilityModel } from '../../shared/models/availability.model';

export interface AvailabilityPayload {
  professionalServiceIds: number[];
  startDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  modality: string;
  platform?: string;
  /** Morada em texto livre para sessões presenciais. */
  address?: string;
  price?: number;
  priceBRL?: number;
}
import { Roles } from '../../shared/enums/roles.enum';
import { AppointmentPayload } from '../../shared/models/appointment-payload.model';
import { AppConstants } from '../../app-constants';

import { HttpClient } from '@angular/common/http';
import { ProfessionalModel } from '../../shared/models/professional.model';
import { environment } from '../../../environments/environment';
import { ProfessionalService } from '../../shared/models/professional-service.model';
import { ProfessionalSessionService } from '../../shared/enums/professional-session-service.enum';
import { Professional } from '../../shared/models/get-professional-by-service-response.model';
import { Appointment } from '../../shared/models/appointment.model';
import { ContactPayload } from '../../shared/models/contact-payload';
import { PatientSummary } from '../../shared/models/patient.model';
import { RecurringProposalPayload } from '../../shared/models/recurring-proposal-payload.model';
import { ReschedulePayload } from '../../shared/models/reschedule-payload.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);

  // getCourses() {
  //   return this.http.get(AppConstants.apiEndpoints.root + '/api/courses');
  // }

  getTherapists(): Observable<ProfessionalModel[]> {
    return this.http.post<ProfessionalModel[]>(
      environment.apiUrl + '/api/user/findByRole',
      { role: Roles.THERAPIST },
      { withCredentials: true },
    );
  }

  getAvailabilitites(): Observable<AvailabilityModel[]> {
    return this.http.get<AvailabilityModel[]>(
      environment.apiUrl + '/api/availability/getAll',
      { withCredentials: true },
    );
  }

  getAvailabilitiesByProfessionalId(
    professionalId: number,
  ): Observable<AvailabilityModel[]> {
    return this.http.get<AvailabilityModel[]>(
      environment.apiUrl + `/api/availability/professional/${professionalId}`,
      { withCredentials: true },
    );
  }

  getAvailabilititesByService(
    sessionService: ProfessionalSessionService,
  ): Observable<ProfessionalService[]> {
    return this.http.get<ProfessionalService[]>(
      environment.apiUrl + `/api/availability/service/${sessionService}`,
      { withCredentials: true },
    );
  }

  getServices(): Observable<ProfessionalService[]> {
    return this.http.get<ProfessionalService[]>(
      environment.apiUrl + `/api/services/getAll`,
      { withCredentials: true },
    );
  }

  getProfessionalByService(serviceId: number): Observable<Professional[]> {
    return this.http.get<Professional[]>(
      environment.apiUrl + `/api/services/${serviceId}/professionals`,
      { withCredentials: true },
    );
  }

  setAppointment(payload: AppointmentPayload): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/api/appointments/create`,
      payload,
      {
        withCredentials: true,
      },
    );
  }

  getProfessionalAppointments(professionalId: number): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(
      `${environment.apiUrl}/api/appointments/professional/${professionalId}`,
      { withCredentials: true },
    );
  }

  getUserAppointments(userEmail: string): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(
      `${environment.apiUrl}/api/appointments/client/email/${userEmail}`,
      {
        withCredentials: true,
      },
    );
  }

  createAvailability(payload: AvailabilityPayload): Observable<AvailabilityModel> {
    return this.http.post<AvailabilityModel>(
      `${environment.apiUrl}/api/availability/create`,
      payload,
      { withCredentials: true },
    );
  }

  updateAvailability(id: number, payload: AvailabilityPayload): Observable<AvailabilityModel> {
    return this.http.put<AvailabilityModel>(
      `${environment.apiUrl}/api/availability/${id}`,
      payload,
      { withCredentials: true },
    );
  }

  deleteAvailability(id: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/api/availability/delete/${id}`,
      { withCredentials: true },
    );
  }

  /**
   * `occurrenceDate` (yyyy-MM-dd) diz qual sessão da série está a ser
   * cancelada; sem `scope` o backend cancela só essa. THIS_AND_FOLLOWING
   * encurta a série a partir dela.
   */
  deleteAppointment(
    id: number,
    justification?: string,
    occurrenceDate?: string,
    scope?: 'SINGLE' | 'THIS_AND_FOLLOWING',
  ): Observable<void> {
    let params: Record<string, string> = {};
    if (justification) params['justification'] = justification;
    if (occurrenceDate) params['occurrenceDate'] = occurrenceDate;
    if (scope) params['scope'] = scope;
    return this.http.delete<void>(
      `${environment.apiUrl}/api/appointments/delete/${id}`,
      { withCredentials: true, params },
    );
  }

  getAppointmentById(id: number): Observable<Appointment> {
    return this.http.get<Appointment>(
      `${environment.apiUrl}/api/appointments/${id}`,
      { withCredentials: true },
    );
  }

  getPatients(professionalId: number): Observable<PatientSummary[]> {
    return this.http.get<PatientSummary[]>(
      `${environment.apiUrl}/api/appointments/professional/${professionalId}/patients`,
      { withCredentials: true },
    );
  }

  proposeRecurringAppointment(payload: RecurringProposalPayload): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${environment.apiUrl}/api/appointments/propose-recurring`,
      payload,
      { withCredentials: true },
    );
  }

  /**
   * Move uma sessão para outra vaga.
   *
   * `occurrenceDate` é a data que está a ser movida: numa sessão recorrente é
   * ela que fica livre, ficando a série de pé. Numa de data única a marcação
   * muda por inteiro e o campo é ignorado.
   */
  rescheduleAppointment(id: number, payload: ReschedulePayload): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${environment.apiUrl}/api/appointments/${id}/reschedule`,
      payload,
      { withCredentials: true },
    );
  }

  respondToProposal(id: number, accept: boolean): Observable<Appointment> {
    return this.http.patch<Appointment>(
      `${environment.apiUrl}/api/appointments/${id}/respond`,
      { accept },
      { withCredentials: true },
    );
  }

  updateAppointmentNotes(id: number, notes: string): Observable<Appointment> {
    return this.http.patch<Appointment>(
      `${environment.apiUrl}/api/appointments/${id}/notes`,
      { notes },
      { withCredentials: true },
    );
  }

  sendContactMessage(payload: ContactPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/contact`,
      payload,
      { withCredentials: true },
    );
  }
}
