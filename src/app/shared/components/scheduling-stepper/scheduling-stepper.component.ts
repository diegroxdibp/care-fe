import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-scheduling-stepper',
  imports: [],
  templateUrl: './scheduling-stepper.component.html',
  styleUrl: './scheduling-stepper.component.scss',
})
export class SchedulingStepperComponent {
  readonly labels = ['Conta', 'Serviço', 'Profissional', 'Agendar', 'Confirmar'];

  /** 1-indexed, matching the labels above. */
  @Input({ required: true }) currentStep!: number;

  isCurrent(step: number): boolean {
    return step === this.currentStep;
  }
}
