import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PilaresComponent } from './pilares.component';

describe('PilaresComponent', () => {
  let component: PilaresComponent;
  let fixture: ComponentFixture<PilaresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PilaresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PilaresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
