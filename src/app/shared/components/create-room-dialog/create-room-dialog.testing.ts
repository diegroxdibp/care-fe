import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { CreateRoomDialogComponent } from './create-room-dialog.component';
import { SessionService } from '../../services/session.service';

/** Partilhado pelos dois specs do diálogo - o normal e o browser-zone. */
export async function createDialog(profileTimeZone: string) {
  const dialogRef = { close: jest.fn() };

  await TestBed.configureTestingModule({
    imports: [CreateRoomDialogComponent],
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
  }).compileComponents();

  TestBed.inject(SessionService).setUser({
    email: 'luane@example.com',
    roles: ['PROFESSIONAL'],
    profileCompleted: true,
    timeZone: profileTimeZone,
  });

  const component = TestBed.createComponent(CreateRoomDialogComponent).componentInstance;
  return { component, dialogRef };
}

export function scheduleAndSubmit(component: CreateRoomDialogComponent, date: string, time: string): void {
  component.startsNow.set(false);
  component.scheduledDate.set(date);
  component.scheduledTime.set(time);
  component.accessMode.set('ANYONE_WITH_LINK');
  component.submit();
}
