import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';

import { CatalogueApiService } from '../../../core/services/catalogue-api.service';
import { CareService } from '../../models/catalogue.model';
import { serviceRowOf, ServicesListComponent } from './services-list.component';

function service(changes: Partial<CareService>): CareService {
  return {
    id: 1,
    slug: 'mindfulness',
    name: 'Mindfulness',
    summary: 'Atenção plena no dia a dia.',
    status: 'APPROVED',
    allowsIndividual: true,
    allowsGroup: false,
    allowsInPerson: false,
    allowsRemote: true,
    allowsPublic: true,
    allowsPrivate: false,
    intro: '### Sobre\n\nA prática em **Mindfulness** fomenta a regulação.\n\nSegundo parágrafo.',
    howItWorks: null,
    quote: null,
    imageUrl: null,
    imageAlt: null,
    forWhom: [],
    audiences: [{ id: 3, name: 'Adultos', pending: false }],
    specialties: [],
    createdAt: null,
    proposedBy: null,
    reviewNote: null,
    ...changes,
  } as CareService;
}

describe('serviceRowOf', () => {
  it('shows the summary when the service has one', () => {
    const row = serviceRowOf(service({}));
    expect(row.text).toBe('Atenção plena no dia a dia.');
    expect(row.fromIntro).toBe(false);
    expect(row.meta).toContain('Adultos');
  });

  it('falls back to the first plain paragraph of the presentation', () => {
    const row = serviceRowOf(service({ summary: null }));
    expect(row.text).toBe('A prática em Mindfulness fomenta a regulação.');
    expect(row.fromIntro).toBe(true);
    expect(serviceRowOf(service({ summary: '   ' })).fromIntro).toBe(true);
  });
});

describe('ServicesListComponent', () => {
  let fixture: ComponentFixture<ServicesListComponent>;
  let calls: { format?: string; listed?: boolean }[];

  async function render(response: Observable<CareService[]>): Promise<HTMLElement> {
    calls = [];
    const api = {
      services: (format?: string, listed?: boolean) => {
        calls.push({ format, listed });
        return response;
      },
    };
    await TestBed.configureTestingModule({
      imports: [ServicesListComponent],
      providers: [provideRouter([]), provideNoopAnimations(), { provide: CatalogueApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ServicesListComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('asks only for listed services and shows one row per service, in the order received', async () => {
    const el = await render(of([service({}), service({ id: 2, slug: 'supervisao', name: 'Supervisão' })]));
    expect(calls).toEqual([{ format: undefined, listed: true }]);
    const names = Array.from(el.querySelectorAll('.type-name')).map(n => n.textContent?.trim());
    expect(names).toEqual(['Mindfulness', 'Supervisão']);
    expect(el.querySelector('#type-panel-supervisao')).not.toBeNull();
  });

  it('clamps the fallback text only', async () => {
    const el = await render(of([service({}), service({ id: 2, slug: 'outro', summary: null })]));
    const texts = el.querySelectorAll('.type-description');
    expect(texts[0].classList).not.toContain('is-clamped');
    expect(texts[1].classList).toContain('is-clamped');
  });

  it('says so when nothing is listed or the list fails, keeping a way to the team', async () => {
    let el = await render(of([]));
    expect(el.querySelector('.services-state')?.textContent).toContain('Ainda não há serviços');
    expect(el.querySelector('.services-state a')?.getAttribute('href')).toBe('/contact');

    TestBed.resetTestingModule();
    el = await render(throwError(() => new Error('offline')));
    expect(el.querySelector('.services-state')?.textContent).toContain('Não foi possível carregar');
  });
});
