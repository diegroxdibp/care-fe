import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ServicesSettingsComponent } from './services-settings.component';
import { ApiService } from '../../../core/services/api.service';
import { MyService } from '../../models/my-service.model';

/** Ligar e desligar serviços por formato — o "Grupo" é o que abre vagas de grupo. */
describe('ServicesSettingsComponent', () => {
  const mindfulness: MyService = {
    id: 10, professionalId: 1, name: 'MINDFULNESS', format: 'INDIVIDUAL', modality: 'ANY', active: true,
  };

  function setup(mine: MyService[]) {
    const api = {
      getMyServices: jest.fn().mockReturnValue(of(mine)),
      createService: jest.fn().mockReturnValue(of({})),
      setServiceActive: jest.fn().mockReturnValue(of('ok')),
    };
    TestBed.configureTestingModule({
      imports: [ServicesSettingsComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });
    const fixture = TestBed.createComponent(ServicesSettingsComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, api };
  }

  it('mostra o que já está ligado', () => {
    const { component } = setup([mindfulness]);
    const row = component.rows().find(r => r.name === 'MINDFULNESS')!;
    expect(row.on.INDIVIDUAL).toBe(true);
    expect(row.on.GROUP).toBe(false);
  });

  it('ligar "Grupo" cria o serviço em grupo', () => {
    const { component, api } = setup([mindfulness]);
    component.toggle('MINDFULNESS', 'GROUP', true);
    expect(api.createService).toHaveBeenCalledWith({ name: 'MINDFULNESS', modality: 'ANY', format: 'GROUP' });
  });

  it('voltar a ligar um serviço desligado reativa-o, em vez de criar outro', () => {
    const { component, api } = setup([{ ...mindfulness, active: false }]);
    component.toggle('MINDFULNESS', 'INDIVIDUAL', true);
    expect(api.setServiceActive).toHaveBeenCalledWith(10, true);
    expect(api.createService).not.toHaveBeenCalled();
  });

  it('desligar desativa', () => {
    const { component, api } = setup([mindfulness]);
    component.toggle('MINDFULNESS', 'INDIVIDUAL', false);
    expect(api.setServiceActive).toHaveBeenCalledWith(10, false);
  });
});
