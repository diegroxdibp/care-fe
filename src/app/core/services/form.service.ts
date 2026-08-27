import { CountryModel } from './../../shared/models/country.model';
import { Genders } from './../../shared/enums/genders.enum';
import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SchedulingFormControls } from '../../shared/enums/scheduling-form-controls.enum';
import { AvailabilityModel } from '../../shared/models/availability.model';
import { FormControlsNames } from '../../shared/enums/form-controls-names.enum';
import { SignInPayload } from '../../shared/models/sign-in-payload';
import { SignUpPayload } from '../../shared/models/sign-up-payload';
import { BehaviorSubject } from 'rxjs';
import { getEnumKeyByValue } from '../../shared/utils/getEnumKeyByValue';
import { OnboardingPayload } from '../../shared/models/onboarding-payload.model';
import { ProfileView } from '../../shared/models/profile-view.model';
import { User } from '../../auth/user.model';
import { ProfessionalModel } from '../../shared/models/professional.model';
import { Modality } from '../../shared/enums/modality.enum';
import { getBrowserCountry } from '../../shared/utils/browser-country.util';
import { Currency, currencyForCountry } from '../../shared/enums/currency.enum';
import { detectBrowserTimezone } from '../../shared/utils/timezones.util';

@Injectable({
  providedIn: 'root',
})
export class FormService {
  authForm: FormGroup;
  onboardingForm: FormGroup;
  profileForm: FormGroup;
  availability: AvailabilityModel[] = [];
  timeSlots = new Map<string, string[]>();
  professionals: ProfessionalModel[] = [];

  currentCountryPhone: BehaviorSubject<CountryModel> =
    new BehaviorSubject<CountryModel>(getBrowserCountry());

  passwordRules = {
    minLength: 8,
    maxLength: 128,
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    digit: /\d/,
    specialChar: /[\W_]/,
  };

  constructor(private readonly fb: FormBuilder) {
    this.authForm = this.fb.group({
      [FormControlsNames.EMAIL]: this.fb.control('', [
        Validators.required,
        Validators.email,
        Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
      ]),
      [FormControlsNames.PASSWORD]: this.fb.control('', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/),
      ]),
    });

    this.onboardingForm = this.fb.group({
      [FormControlsNames.NAME]: this.fb.control('', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
      ]),
      [FormControlsNames.BIRTHDATE]: this.fb.control('', [Validators.required]),
      [FormControlsNames.PHONE_PREFIX]:
        this.fb.control<CountryModel>(getBrowserCountry()),
      [FormControlsNames.PHONE]: this.fb.control(''),
      [FormControlsNames.GENDER]: this.fb.control(''),
      [FormControlsNames.CURRENCY]: this.fb.control<Currency>(
        currencyForCountry(getBrowserCountry().code),
        [Validators.required],
      ),
      // O fuso não é perguntado no onboarding — é detectado e enviado no payload.
      [FormControlsNames.TIMEZONE]: this.fb.control<string>(
        detectBrowserTimezone(),
      ),
    });

    this.profileForm = this.fb.group({
      [FormControlsNames.NAME_PROFILE]: this.fb.control('', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
      ]),
      [FormControlsNames.EMAIL_PROFILE]: this.fb.control('', [
        Validators.required,
        Validators.email,
        Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
      ]),
      [FormControlsNames.BIRTHDATE_PROFILE]: this.fb.control('', [
        Validators.required,
      ]),
      [FormControlsNames.PHONE_PREFIX_PROFILE]:
        this.fb.control<CountryModel>(getBrowserCountry()),
      [FormControlsNames.PHONE_PROFILE]: this.fb.control(''),
      [FormControlsNames.GENDER_PROFILE]: this.fb.control(''),
      [FormControlsNames.BIO_PROFILE]: this.fb.control('', [
        Validators.maxLength(700),
      ]),
      [FormControlsNames.CURRENCY_PROFILE]: this.fb.control<Currency>(
        Currency.EUR,
        [Validators.required],
      ),
      [FormControlsNames.TIMEZONE_PROFILE]: this.fb.control<string>(
        detectBrowserTimezone(),
      ),
    });
  }

  signUp() {}

  signInPayload(): SignInPayload {
    const payload = {
      email: this.authForm.get(FormControlsNames.EMAIL)?.value,
      password: this.authForm.get(FormControlsNames.PASSWORD)?.value,
    };
    return payload;
  }

  signUpPayload(): SignUpPayload {
    const payload = {
      email: this.authForm.get(FormControlsNames.EMAIL)?.value,
      password: this.authForm.get(FormControlsNames.PASSWORD)?.value,
    };
    return payload;
  }

  onboardingPayload(): OnboardingPayload {
    const nameCtrl = this.onboardingForm.get(FormControlsNames.NAME);
    const name = nameCtrl?.value;

    const gender = getEnumKeyByValue(
      Genders,
      this.onboardingForm.get(FormControlsNames.GENDER)?.value,
    );
    const birthDate = this.onboardingForm.get(
      FormControlsNames.BIRTHDATE,
    )?.value;
    const phone = this.buildPhoneNumber();

    if (nameCtrl?.hasError('required')) {
      throw new Error('Indique o seu nome.');
    }
    if (nameCtrl?.hasError('minlength')) {
      throw new Error('O nome deve ter pelo menos 8 caracteres.');
    }
    if (nameCtrl?.hasError('maxlength')) {
      throw new Error('O nome é demasiado longo.');
    }
    if (!birthDate) {
      throw new Error('Indique a sua data de nascimento.');
    }
    if (!phone) {
      throw new Error('Indique o seu número de telefone.');
    }

    if (!gender) {
      throw new Error('Selecione o seu género.');
    }

    const currency = this.onboardingForm.get(FormControlsNames.CURRENCY)?.value;
    if (!currency) {
      throw new Error('Selecione a moeda de cobrança.');
    }
    const timeZone =
      this.onboardingForm.get(FormControlsNames.TIMEZONE)?.value ??
      detectBrowserTimezone();

    const payload: OnboardingPayload = {
      name,
      birthDate,
      phone,
      gender: gender,
      currency,
      timeZone,
    };

    return payload;
  }

  buildPhoneNumber(): string {
    const country: CountryModel = this.onboardingForm.get(
      FormControlsNames.PHONE_PREFIX,
    )?.value;
    const raw: string = (this.onboardingForm.get(FormControlsNames.PHONE)?.value ?? '').replace(/\D/g, '');
    if (!raw) return '';
    let phoneNumber = raw;
    if (country?.code === 'br' && phoneNumber.length === 10)
      phoneNumber = phoneNumber.slice(0, 2) + '9' + phoneNumber.slice(2);
    return '+' + country.InternationalAreaCode + phoneNumber;
  }

  fillProfileFields(profileData: User): void {
    console.log(profileData);
    this.profileForm
      .get(FormControlsNames.NAME_PROFILE)
      ?.setValue(profileData.name);

    this.profileForm
      .get(FormControlsNames.EMAIL_PROFILE)
      ?.setValue(profileData.email);

    this.profileForm
      .get(FormControlsNames.BIRTHDATE_PROFILE)
      ?.setValue(profileData.birthDate);

    this.profileForm
      .get(FormControlsNames.PHONE_PREFIX_PROFILE)
      ?.setValue('55');

    this.profileForm
      .get(FormControlsNames.PHONE_PROFILE)
      ?.setValue(profileData.phone);

    this.profileForm
      .get(FormControlsNames.GENDER_PROFILE)
      ?.setValue(profileData.gender);

    this.profileForm
      .get(FormControlsNames.BIO_PROFILE)
      ?.setValue(profileData.bio);

    this.profileForm.updateValueAndValidity();
    console.log(this.profileForm.get(FormControlsNames.NAME_PROFILE)?.value);
  }
}
