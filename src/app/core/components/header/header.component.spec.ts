import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderComponent } from './header.component';
import { SessionService } from '../../../shared/services/session.service';
import { Roles } from '../../../shared/enums/roles.enum';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('papel por baixo do nome', () => {
    const cases: [string[], string][] = [
      [[Roles.USER], 'Paciente'],
      [[Roles.USER, Roles.PROFESSIONAL], 'Profissional'],
      [[Roles.USER, Roles.PROFESSIONAL, Roles.THERAPIST], 'Terapeuta'],
      [[Roles.USER, Roles.THERAPIST, Roles.ADMIN], 'Admin'],
    ];

    it.each(cases)('%j mostra %s', (roles, label) => {
      TestBed.inject(SessionService).setUser({ name: 'Ana Silva', email: 'a@b.c', roles, profileCompleted: true });
      expect(component.roleLabel()).toBe(label);
    });
  });

  describe('fundo enquanto um diálogo está aberto', () => {
    const html = document.documentElement;

    function scrollTo(y: number): void {
      Object.defineProperty(window, 'pageYOffset', { value: y, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    }

    function headerBackground(): string {
      return (fixture.nativeElement.querySelector('header') as HTMLElement).style.backgroundColor;
    }

    afterEach(() => {
      html.classList.remove('cdk-global-scrollblock');
      scrollTo(0);
    });

    it('mantém o fundo quando o Material bloqueia o scroll e a janela passa a ler 0', () => {
      scrollTo(500);
      expect(headerBackground()).toBe('white');

      // O que o BlockScrollStrategy faz ao abrir um MatDialog.
      html.classList.add('cdk-global-scrollblock');
      scrollTo(0);
      expect(headerBackground()).toBe('white');

      // Ao fechar: classe removida e posição real reposta.
      html.classList.remove('cdk-global-scrollblock');
      scrollTo(500);
      expect(headerBackground()).toBe('white');
    });

    it('sem diálogo, voltar mesmo ao topo continua a tirar o fundo', () => {
      scrollTo(500);
      scrollTo(0);
      expect(headerBackground()).toBe('transparent');
    });
  });
});

