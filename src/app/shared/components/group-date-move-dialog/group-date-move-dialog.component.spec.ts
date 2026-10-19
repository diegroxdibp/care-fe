import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { GroupDateMoveDialogComponent, GroupDateMoveDialogData } from './group-date-move-dialog.component';
import { AvailabilityModel } from '../../models/availability.model';
import { DayOfWeek } from '../../enums/day-of-week.enum';

/** Mudar uma data de um grupo só para uma vaga de grupo com lugar para todas as pessoas. */
describe('GroupDateMoveDialogComponent', () => {
  function slot(id: number, capacity: number, seatsTaken: Record<string, number> = {}): AvailabilityModel {
    return {
      id, professionalId: 1, professionalName: 'Luane', startDate: '2026-01-06', endDate: '2100-01-01',
      startTime: id === 21 ? '19:00:00' : '18:00:00', endTime: '19:30:00', isRecurring: true,
      dayOfWeek: 'TUESDAY' as unknown as DayOfWeek, recurrenceFrequency: 'WEEKLY', bookedDates: [],
      modality: 'ANY', timeZone: 'Europe/Lisbon', services: [], format: 'GROUP', capacity, seatsTaken,
    } as AvailabilityModel;
  }

  function open(data: Partial<GroupDateMoveDialogData>) {
    const close = jest.fn();
    TestBed.configureTestingModule({
      imports: [GroupDateMoveDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            fromLabel: 'terça, 27/10 · 18:00', fromAvailabilityId: 20, fromDate: '2099-10-27', people: 3,
            groupSlots: [], ...data,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(GroupDateMoveDialogComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, close };
  }

  it('só oferece vagas que abrem nesse dia e têm lugar para todos', () => {
    const { component } = open({
      groupSlots: [slot(20, 8, { '2099-11-03': 6 }), slot(21, 8)],
    });
    component.pickDate('2099-11-03');
    // A das 18:00 só tem 2 livres nesse dia; a das 19:00 tem 8.
    expect(component.options().map(o => o.slot.id)).toEqual([21]);
    expect(component.targetId()).toBe(21);
  });

  it('não oferece a própria data de origem', () => {
    const { component } = open({ groupSlots: [slot(20, 8)] });
    component.pickDate('2099-10-27');
    expect(component.options()).toEqual([]);
  });

  it('devolve a vaga e a data escolhidas', () => {
    const { component, close } = open({ groupSlots: [slot(21, 8)] });
    component.pickDate('2099-11-03');
    component.submit();
    expect(close).toHaveBeenCalledWith({ targetAvailabilityId: 21, targetDate: '2099-11-03' });
  });
});
