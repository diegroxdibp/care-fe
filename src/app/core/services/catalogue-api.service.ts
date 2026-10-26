import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdminProfile,
  AdminRequests,
  Application,
  ApplicationRequest,
  BookableProfessional,
  CareService,
  CatalogueOptions,
  ChangeProposal,
  FormatKey,
  Offering,
  OfferingRequest,
  ProfessionalCard,
  ProfessionalPage,
  ProfessionalProfile,
  ReviewDecision,
  ServiceContent,
  ServicePage,
} from '../../shared/models/catalogue.model';

/**
 * A lista partilhada de serviços, perfis profissionais, pedidos para fazer
 * parte da Care e a área da equipa — ver care-be CatalogueController,
 * ProfessionalsController, ApplicationController, CatalogueAdminController.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  private readonly opts = { withCredentials: true };

  private options$?: Observable<CatalogueOptions>;

  // ─ Público ────────────────────────────────────────────────────────────────

  /** Públicos aprovados e idiomas — guardados para a sessão toda. */
  options(): Observable<CatalogueOptions> {
    this.options$ ??= this.http
      .get<CatalogueOptions>(`${this.base}/api/catalogue/options`, this.opts)
      .pipe(shareReplay(1));
    return this.options$;
  }

  /** Serviços aprovados que aparecem em listas (sem os privados). */
  services(format?: FormatKey): Observable<CareService[]> {
    const q = format ? `?format=${format}` : '';
    return this.http.get<CareService[]>(`${this.base}/api/catalogue/services${q}`, this.opts);
  }

  servicePage(slug: string): Observable<ServicePage> {
    return this.http.get<ServicePage>(`${this.base}/api/catalogue/services/${encodeURIComponent(slug)}`, this.opts);
  }

  /** Quem se pode agendar para um serviço, com a oferta de cada pessoa. */
  bookable(serviceId: number): Observable<BookableProfessional[]> {
    return this.http.get<BookableProfessional[]>(
      `${this.base}/api/catalogue/services/${serviceId}/professionals`, this.opts,
    );
  }

  professionals(): Observable<ProfessionalCard[]> {
    return this.http.get<ProfessionalCard[]>(`${this.base}/api/professionals`, this.opts);
  }

  professionalPage(slug: string): Observable<ProfessionalPage> {
    return this.http.get<ProfessionalPage>(`${this.base}/api/professionals/${encodeURIComponent(slug)}`, this.opts);
  }

  // ─ Com sessão ─────────────────────────────────────────────────────────────

  uploadImage(file: Blob, filename = 'imagem.jpg'): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file, filename);
    return this.http.post<{ url: string }>(`${this.base}/api/catalogue/images`, form, this.opts);
  }

  myApplication(): Observable<Application> {
    return this.http.get<Application>(`${this.base}/api/applications/mine`, this.opts);
  }

  submitApplication(body: ApplicationRequest): Observable<Application> {
    return this.http.post<Application>(`${this.base}/api/applications/mine`, body, this.opts);
  }

  myProfile(): Observable<ProfessionalProfile> {
    return this.http.get<ProfessionalProfile>(`${this.base}/api/professional-profile/mine`, this.opts);
  }

  saveMyProfile(body: ProfessionalProfile): Observable<ProfessionalProfile> {
    return this.http.put<ProfessionalProfile>(`${this.base}/api/professional-profile/mine`, body, this.opts);
  }

  myOfferings(): Observable<Offering[]> {
    return this.http.get<Offering[]>(`${this.base}/api/offerings/mine`, this.opts);
  }

  /** Todos os serviços aprovados que se podem oferecer, privados incluídos. */
  availableServices(): Observable<CareService[]> {
    return this.http.get<CareService[]>(`${this.base}/api/offerings/available`, this.opts);
  }

  saveOffering(serviceId: number, body: OfferingRequest): Observable<Offering> {
    return this.http.put<Offering>(`${this.base}/api/offerings/${serviceId}`, body, this.opts);
  }

  propose(body: ServiceContent): Observable<CareService> {
    return this.http.post<CareService>(`${this.base}/api/catalogue/proposals`, body, this.opts);
  }

  /** Rever uma proposta que a equipa devolveu para alterações. */
  reviseProposal(id: number, body: ServiceContent): Observable<CareService> {
    return this.http.put<CareService>(`${this.base}/api/catalogue/proposals/${id}`, body, this.opts);
  }

  myProposals(): Observable<CareService[]> {
    return this.http.get<CareService[]>(`${this.base}/api/catalogue/proposals/mine`, this.opts);
  }

  proposeChange(serviceId: number, body: ServiceContent): Observable<ChangeProposal> {
    return this.http.post<ChangeProposal>(
      `${this.base}/api/catalogue/services/${serviceId}/change-proposals`, body, this.opts,
    );
  }

  myChangeProposals(): Observable<ChangeProposal[]> {
    return this.http.get<ChangeProposal[]>(`${this.base}/api/catalogue/change-proposals/mine`, this.opts);
  }

  // ─ Equipa (ADMIN) ─────────────────────────────────────────────────────────

  adminRequests(): Observable<AdminRequests> {
    return this.http.get<AdminRequests>(`${this.base}/api/admin/requests`, this.opts);
  }

  decideChange(id: number, approve: boolean, body: ReviewDecision): Observable<ChangeProposal> {
    return this.http.post<ChangeProposal>(
      `${this.base}/api/admin/change-proposals/${id}/${approve ? 'approve' : 'reject'}`, body, this.opts,
    );
  }

  adminServices(): Observable<CareService[]> {
    return this.http.get<CareService[]>(`${this.base}/api/admin/services`, this.opts);
  }

  adminUpdateService(id: number, body: ReviewDecision): Observable<CareService> {
    return this.http.put<CareService>(`${this.base}/api/admin/services/${id}`, body, this.opts);
  }

  adminProfiles(): Observable<AdminProfile[]> {
    return this.http.get<AdminProfile[]>(`${this.base}/api/admin/professionals`, this.opts);
  }

  adminUpdateProfile(id: number, body: ProfessionalProfile): Observable<AdminProfile> {
    return this.http.put<AdminProfile>(`${this.base}/api/admin/professionals/${id}`, body, this.opts);
  }

  adminSetProfileVisible(id: number, visible: boolean): Observable<AdminProfile> {
    return this.http.post<AdminProfile>(
      `${this.base}/api/admin/professionals/${id}/${visible ? 'show' : 'hide'}`, {}, this.opts,
    );
  }

  adminAttachProfile(id: number, email: string): Observable<AdminProfile> {
    return this.http.post<AdminProfile>(`${this.base}/api/admin/professionals/${id}/attach`, { email }, this.opts);
  }
}
