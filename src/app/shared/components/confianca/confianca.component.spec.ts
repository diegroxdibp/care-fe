import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfiancaComponent } from './confianca.component';

describe('ConfiancaComponent', () => {
  let component: ConfiancaComponent;
  let fixture: ComponentFixture<ConfiancaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiancaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfiancaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
