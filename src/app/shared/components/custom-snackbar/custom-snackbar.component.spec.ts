import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

import { CustomSnackbarComponent } from './custom-snackbar.component';

describe('CustomSnackbarComponent', () => {
  let component: CustomSnackbarComponent;
  let fixture: ComponentFixture<CustomSnackbarComponent>;

  beforeEach(async () => {
    // Opened by MatSnackBar in the app, which supplies these two; here they
    // have to be given by hand.
    await TestBed.configureTestingModule({
      imports: [CustomSnackbarComponent],
      providers: [
        { provide: MatSnackBarRef, useValue: { dismiss: jest.fn(), dismissWithAction: jest.fn() } },
        { provide: MAT_SNACK_BAR_DATA, useValue: { message: 'Notas guardadas.', duration: 3000 } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomSnackbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the message it was opened with', () => {
    expect(fixture.nativeElement.textContent).toContain('Notas guardadas.');
  });
});
