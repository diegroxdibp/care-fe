import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { FormService } from '../../../core/services/form.service';
import { SessionService } from '../../services/session.service';
import { UserService } from '../../services/user.service';
import { FormControlsNames } from '../../enums/form-controls-names.enum';
import { CountryModel } from '../../models/country.model';
import { Countries } from '../../../../assets/countries';
import { Genders } from '../../enums/genders.enum';
import { OnboardingResponse } from '../../models/onboarding-response.model';
import { getBrowserCountry } from '../../utils/browser-country.util';
import { CountryPhoneFieldComponent } from '../country-phone-field/country-phone-field.component';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';
import { BirthdateCalendarComponent } from '../birthdate-calendar/birthdate-calendar.component';
import { CurrencyToggleComponent } from '../currency-toggle/currency-toggle.component';
import { currencyForCountry } from '../../enums/currency.enum';
import { allTimezones, detectBrowserTimezone, timezoneOffsetLabel } from '../../utils/timezones.util';

@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule, CountryPhoneFieldComponent, StyledSelectComponent, BirthdateCalendarComponent, CurrencyToggleComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent implements OnInit {
  private readonly formService = inject(FormService);
  private readonly sessionService = inject(SessionService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly countries = Countries;
  readonly genders = Object.values(Genders);
  error: string | null = null;

  readonly countryOptions: StyledSelectOption[] = Countries.map(c => ({
    value: c.code,
    label: c.namePt,
    meta: `+${c.InternationalAreaCode}`,
  }));

  readonly genderOptions: StyledSelectOption[] = Object.values(Genders).map(g => ({
    value: g,
    label: g,
  }));

  readonly timezoneOptions: StyledSelectOption[] = allTimezones().map(t => ({
    value: t.value,
    label: t.city,
    meta: timezoneOffsetLabel(t.value),
  }));

  get nameCtrl(): FormControl {
    return this.formService.onboardingForm.get(FormControlsNames.NAME) as FormControl;
  }

  get birthdateCtrl(): FormControl {
    return this.formService.onboardingForm.get(FormControlsNames.BIRTHDATE) as FormControl;
  }

  get genderCtrl(): FormControl {
    return this.formService.onboardingForm.get(FormControlsNames.GENDER) as FormControl;
  }

  get phoneCtrl(): FormControl {
    return this.formService.onboardingForm.get(FormControlsNames.PHONE) as FormControl;
  }

  readonly selectedCountry = signal<CountryModel>(getBrowserCountry());

  /** A nota informativa começa aberta na primeira visita. */
  readonly showCurrencyInfo = signal(true);

  /** Verdadeiro enquanto o PUT está em curso, para travar cliques repetidos. */
  readonly submitting = signal(false);

  /**
   * Verdadeiro depois que a pessoa toca no seletor de moeda: a partir daí,
   * trocar o país não sobrescreve mais a escolha feita à mão.
   */
  private currencyTouched = false;

  get currencyCtrl(): FormControl {
    return this.formService.onboardingForm.get(FormControlsNames.CURRENCY) as FormControl;
  }

  get timezoneCtrl(): FormControl {
    return this.formService.onboardingForm.get(FormControlsNames.TIMEZONE) as FormControl;
  }

  ngOnInit(): void {
    const initial = getBrowserCountry();
    this.selectedCountry.set(initial);
    // O reset limpa tudo o que não for indicado aqui, por isso a moeda e o
    // fuso precisam de ser semeados junto com o prefixo.
    this.formService.onboardingForm.reset({
      [FormControlsNames.PHONE_PREFIX]: initial,
      [FormControlsNames.CURRENCY]: currencyForCountry(initial.code),
      [FormControlsNames.TIMEZONE]: detectBrowserTimezone(),
    });

    this.currencyCtrl.valueChanges.subscribe(() => (this.currencyTouched = true));
  }

  onCountryChange(code: string): void {
    const c = Countries.find(x => x.code === code);
    if (c) {
      this.selectedCountry.set(c);
      if (!this.currencyTouched) {
        this.currencyCtrl.setValue(currencyForCountry(c.code), { emitEvent: false });
      }
    }
  }

  toggleCurrencyInfo(): void {
    this.showCurrencyInfo.update(v => !v);
  }

  onPhonePrefixChange(country: CountryModel): void {
    this.formService.onboardingForm.get(FormControlsNames.PHONE_PREFIX)?.setValue(country);
  }

  submit(event: Event): void {
    event.preventDefault();
    // Sem isto, cada clique repetido dispara outro PUT. O primeiro grava e os
    // seguintes vão atrás, o que enchia o separador de rede de chamadas iguais.
    if (this.submitting()) return;

    this.error = null;
    try {
      const payload = this.formService.onboardingPayload();
      this.submitting.set(true);
      this.userService.onboarding(payload).subscribe({
        next: (res: OnboardingResponse) => {
          // Uma resposta 200 aqui significa que o perfil ficou completo no
          // servidor. Marcamos a sessão como tal em vez de depender do corpo
          // trazer o campo: se não trouxer, o AccessGuard devolve a pessoa a
          // /onboarding e ela fica presa sem qualquer mensagem.
          this.sessionService.updateUser({ ...res, profileCompleted: true });

          this.router.navigate(['/dashboard']).then((ok) => {
            this.submitting.set(false);
            if (!ok) {
              this.error =
                'O perfil foi guardado, mas não foi possível abrir o painel. Recarregue a página.';
            }
          });
        },
        error: (err: any) => {
          this.submitting.set(false);
          this.error = err.error?.error ?? 'Erro ao guardar perfil. Tente novamente.';
        },
      });
    } catch (e: any) {
      this.submitting.set(false);
      this.error = e.message ?? 'Dados inválidos.';
    }
  }
}
