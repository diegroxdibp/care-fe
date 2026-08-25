import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuoteBandComponent } from './quote-band.component';

describe('QuoteBandComponent', () => {
  let component: QuoteBandComponent;
  let fixture: ComponentFixture<QuoteBandComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteBandComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuoteBandComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
