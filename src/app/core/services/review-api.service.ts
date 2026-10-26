import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AvailabilityModel } from '../../shared/models/availability.model';
import {
  InterviewBooking,
  Review,
  ReviewKind,
  ReviewSummary,
  ReviewUpdate,
} from '../../shared/models/review.model';

/**
 * A análise dos pedidos (candidaturas e propostas de serviço) — ver care-be
 * ReviewController (a pessoa e a equipa) e ReviewAdminController (só a equipa).
 */
@Injectable({ providedIn: 'root' })
export class ReviewApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly opts = { withCredentials: true };

  private path(kind: ReviewKind, id: number): string {
    return `${kind === 'APPLICATION' ? 'application' : 'proposal'}/${id}`;
  }

  // ─ A pessoa (e a equipa) ──────────────────────────────────────────────────

  mine(): Observable<ReviewSummary[]> {
    return this.http.get<ReviewSummary[]>(`${this.base}/api/reviews/mine`, this.opts);
  }

  /** team = a vista da equipa a analisar (só para ADMIN; quem é da equipa também faz pedidos). */
  get(kind: ReviewKind, id: number, team = false): Observable<Review> {
    return this.http.get<Review>(`${this.base}/api/reviews/${this.path(kind, id)}?team=${team}`, this.opts);
  }

  comment(kind: ReviewKind, id: number, key: string, text: string, team = false): Observable<Review> {
    return this.http.post<Review>(
      `${this.base}/api/reviews/${this.path(kind, id)}/points/${encodeURIComponent(key)}/comments?team=${team}`,
      { text },
      this.opts,
    );
  }

  /** As vagas do serviço "Entrevista" (com as datas já ocupadas). */
  interviewSlots(applicationId: number): Observable<AvailabilityModel[]> {
    return this.http.get<AvailabilityModel[]>(
      `${this.base}/api/reviews/application/${applicationId}/interview/slots`, this.opts,
    );
  }

  bookInterview(applicationId: number, body: InterviewBooking): Observable<Review> {
    return this.http.post<Review>(`${this.base}/api/reviews/application/${applicationId}/interview`, body, this.opts);
  }

  // ─ Equipa ─────────────────────────────────────────────────────────────────

  queue(): Observable<ReviewSummary[]> {
    return this.http.get<ReviewSummary[]>(`${this.base}/api/admin/reviews`, this.opts);
  }

  setPointStatus(kind: ReviewKind, id: number, key: string, body: ReviewUpdate): Observable<Review> {
    return this.http.put<Review>(
      `${this.base}/api/admin/reviews/${this.path(kind, id)}/points/${encodeURIComponent(key)}`, body, this.opts,
    );
  }

  setItemDecision(kind: ReviewKind, id: number, item: string, body: ReviewUpdate): Observable<Review> {
    return this.http.put<Review>(
      `${this.base}/api/admin/reviews/${this.path(kind, id)}/items/${encodeURIComponent(item)}`, body, this.opts,
    );
  }

  setSlug(kind: ReviewKind, id: number, item: string, slug: string): Observable<Review> {
    return this.http.put<Review>(
      `${this.base}/api/admin/reviews/${this.path(kind, id)}/items/${encodeURIComponent(item)}/slug`,
      { slug },
      this.opts,
    );
  }

  setAudience(kind: ReviewKind, id: number, audienceId: number, body: ReviewUpdate): Observable<Review> {
    return this.http.put<Review>(
      `${this.base}/api/admin/reviews/${this.path(kind, id)}/audiences/${audienceId}`, body, this.opts,
    );
  }

  conclude(kind: ReviewKind, id: number): Observable<Review> {
    return this.http.post<Review>(`${this.base}/api/admin/reviews/${this.path(kind, id)}/conclude`, {}, this.opts);
  }

  requestChanges(kind: ReviewKind, id: number): Observable<Review> {
    return this.http.post<Review>(
      `${this.base}/api/admin/reviews/${this.path(kind, id)}/request-changes`, {}, this.opts,
    );
  }

  reopen(kind: ReviewKind, id: number): Observable<Review> {
    return this.http.post<Review>(`${this.base}/api/admin/reviews/${this.path(kind, id)}/reopen`, {}, this.opts);
  }

  interviewDone(applicationId: number): Observable<Review> {
    return this.http.post<Review>(
      `${this.base}/api/admin/reviews/application/${applicationId}/interview/done`, {}, this.opts,
    );
  }

  cancelInterview(applicationId: number): Observable<Review> {
    return this.http.delete<Review>(
      `${this.base}/api/admin/reviews/application/${applicationId}/interview`, this.opts,
    );
  }
}
