import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { InvitationPageComponent } from './invitation-page.component';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { Invitation, InvitationPreview } from '../../models/invitation.model';
import { readStoredReturnPath } from '../../utils/return-path.util';

/**
 * A página do link de um convite: quem não tem conta vai criá-la com o email
 * convidado (fixo) e volta aqui; quem entrou com outra conta não responde por
 * engano; a hora aparece no fuso de quem vê (São Paulo vs Lisboa).
 */
const PREVIEW: InvitationPreview = {
  token: 'tok-1',
  professionalName: 'Luane Bastos',
  serviceName: 'MINDFULNESS',
  kind: 'DATE',
  startDate: '2026-01-15',
  recurrenceFrequency: null,
  dayOfWeek: 'THURSDAY',
  startTime: '18:00:00',
  endTime: '19:00:00',
  timeZone: 'Europe/Lisbon',
  // 18:00 em Lisboa em janeiro (UTC+0).
  firstSessionAt: '2026-01-15T18:00:00Z',
  modality: 'REMOTE',
  status: 'PENDING',
  invitedEmail: 'nova.pessoa@example.com',
  accountExists: false,
};

const FULL: Invitation = {
  id: 1,
  token: 'tok-1',
  availabilityId: 478,
  professionalId: 2,
  professionalName: 'Luane Bastos',
  invitedEmail: 'nova.pessoa@example.com',
  kind: 'DATE',
  startDate: '2026-01-15',
  dayOfWeek: 'THURSDAY',
  startTime: '18:00:00',
  endTime: '19:00:00',
  timeZone: 'Europe/Lisbon',
  firstSessionAt: '2026-01-15T18:00:00Z',
  professionalServiceId: 10,
  serviceName: 'MINDFULNESS',
  modality: 'REMOTE',
  message: 'Vamos começar com calma.',
  status: 'PENDING',
  createdAt: '2026-01-01T10:00:00Z',
};

describe('InvitationPageComponent', () => {
  let fixture: ComponentFixture<InvitationPageComponent>;
  let api: Record<string, jest.Mock>;
  let router: { navigate: jest.Mock };

  async function open(user: { email: string; timeZone?: string; profileCompleted?: boolean } | null,
                      preview: InvitationPreview = PREVIEW, full: Invitation = FULL) {
    localStorage.clear();
    api = {
      previewInvitation: jest.fn().mockReturnValue(of(preview)),
      getInvitation: jest.fn().mockReturnValue(of(full)),
      acceptInvitation: jest.fn().mockReturnValue(of({})),
      declineInvitation: jest.fn().mockReturnValue(of({})),
    };
    router = { navigate: jest.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [InvitationPageComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: MatDialog, useValue: { open: jest.fn().mockReturnValue({ afterClosed: () => of(true) }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'tok-1' }) } } },
      ],
    }).compileComponents();
    if (user) {
      TestBed.inject(SessionService).setUser({
        roles: ['USER'], profileCompleted: user.profileCompleted ?? true, ...user,
      });
    }
    fixture = TestBed.createComponent(InvitationPageComponent);
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const button = (label: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
    .find(b => b.textContent?.includes(label));

  it('sem conta: cria a conta com o email convidado, fixo, e volta ao convite', async () => {
    await open(null);
    expect(text()).toContain('nova.pessoa@example.com');

    button('Criar conta')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/signup'], {
      queryParams: { next: '/invitations/tok-1', email: 'nova.pessoa@example.com', lockEmail: 1 },
    });
    expect(readStoredReturnPath()).toBe('/invitations/tok-1');
    expect(api['getInvitation']).not.toHaveBeenCalled();
  });

  it('com conta mas sem sessão: entra e volta ao convite', async () => {
    await open(null, { ...PREVIEW, accountExists: true });
    button('Entrar para responder')!.click();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/signin'], { queryParams: { next: '/invitations/tok-1' } });
  });

  it('entrou com outra conta: explica, e não oferece aceitar', async () => {
    await open({ email: 'outra@example.com' });
    expect(text()).toContain('outra@example.com');
    expect(button('Aceitar')).toBeUndefined();
    expect(api['getInvitation']).not.toHaveBeenCalled();
  });

  it('com a conta certa: mostra a mensagem e aceita', async () => {
    await open({ email: 'Nova.Pessoa@example.com', timeZone: 'Europe/Lisbon' });
    expect(text()).toContain('Vamos começar com calma.');

    button('Aceitar')!.click();

    expect(api['acceptInvitation']).toHaveBeenCalledWith('tok-1');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('conta nova por completar: vai ao onboarding e volta depois', async () => {
    await open({ email: 'nova.pessoa@example.com', profileCompleted: false });
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
    expect(readStoredReturnPath()).toBe('/invitations/tok-1');
  });

  it('a hora aparece no fuso de quem vê: 18:00 em Lisboa é 15:00 em São Paulo (janeiro)', async () => {
    await open({ email: 'nova.pessoa@example.com', timeZone: 'America/Sao_Paulo' });
    expect(text()).toContain('15:00');
    expect(text()).not.toContain('18:00');
  });

  it('e 14:00 em São Paulo no verão europeu (julho, Lisboa a UTC+1)', async () => {
    const july = { ...FULL, startDate: '2026-07-16', firstSessionAt: '2026-07-16T17:00:00Z' };
    await open({ email: 'nova.pessoa@example.com', timeZone: 'America/Sao_Paulo' },
      { ...PREVIEW, startDate: '2026-07-16', firstSessionAt: '2026-07-16T17:00:00Z' }, july);
    expect(text()).toContain('14:00');
  });

  it('um convite já respondido não oferece responder de novo', async () => {
    await open(null, { ...PREVIEW, status: 'WITHDRAWN' });
    expect(text()).toContain('retirou este convite');
    expect(button('Criar conta')).toBeUndefined();
  });
});
