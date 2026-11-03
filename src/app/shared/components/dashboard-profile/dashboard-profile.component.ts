import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormService } from '../../../core/services/form.service';
import { SessionService } from '../../services/session.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/auth.service';
import { FormControlsNames } from '../../enums/form-controls-names.enum';
import { CountryModel } from '../../models/country.model';
import { Countries } from '../../../../assets/countries';
import { Genders } from '../../enums/genders.enum';
import { UpdateProfilePayload } from '../../models/update-profile-payload.model';
import { ConfirmDeleteDialogComponent } from './confirm-delete-dialog.component';
import { RequestAccountClosureDialogComponent } from './request-account-closure-dialog.component';
import { User } from '../../../auth/user.model';
import {getEnumKeyByValue} from '../../utils/getEnumKeyByValue';
import { getBrowserCountry } from '../../utils/browser-country.util';
import { Roles } from '../../enums/roles.enum';
import { RouterLink } from '@angular/router';
import { CountryPhoneFieldComponent } from '../country-phone-field/country-phone-field.component';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';
import { BirthdateCalendarComponent } from '../birthdate-calendar/birthdate-calendar.component';
import { SnackbarService } from '../../services/snackbar.service';
import { CurrencyToggleComponent } from '../currency-toggle/currency-toggle.component';
import { Currency, formatPrice } from '../../enums/currency.enum';
import {
  allTimezones,
  detectBrowserTimezone,
  timezoneLabel,
  timezoneOffsetLabel,
} from '../../utils/timezones.util';
import {
  ImageCropDialogComponent,
  ImageCropDialogData,
  ImageCropDialogResult,
  ImageCropState,
} from '../catalogue/image-crop-dialog/image-crop-dialog.component';
import { shrinkImage } from '../../utils/catalogue.util';
import { ChangeEmailDialogComponent, ChangeEmailDialogData } from './change-email-dialog.component';
import { EmailChangeStatus } from '../../models/email-change-status.model';

/** Valores de exemplo da seção Preferências (o preço real vem do serviço). */
const SAMPLE_PRICE: Record<Currency, number> = {
  [Currency.EUR]: 60,
  [Currency.BRL]: 320,
};

// Quem atende pessoas clientes tem uma bio pública; conta de paciente não.
const BIO_ALLOWED_ROLES: string[] = [
  Roles.THERAPIST,
  Roles.PROFESSIONAL,
  Roles.ADMIN,
];

// Mantém em sincronia com o hint "JPG ou PNG, até 5 MB" no template e com
// a validação equivalente no backend (ProfilePictureService).
const ALLOWED_PICTURE_TYPES = ['image/jpeg', 'image/png'];
const MAX_PICTURE_SIZE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-dashboard-profile',
  imports: [ReactiveFormsModule, MatDialogModule, CountryPhoneFieldComponent, StyledSelectComponent, BirthdateCalendarComponent, CurrencyToggleComponent, RouterLink],
  templateUrl: './dashboard-profile.component.html',
  styleUrl: './dashboard-profile.component.scss',
})
export class DashboardProfileComponent implements OnInit {
  private readonly formService = inject(FormService);
  private readonly sessionService = inject(SessionService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbarService = inject(SnackbarService);

  readonly countries = Countries;
  readonly genders = Object.values(Genders);
  readonly user = this.sessionService.user;
  readonly selectedCountry = signal<CountryModel>(getBrowserCountry());

  readonly countryOptions: StyledSelectOption[] = Countries.map(c => ({
    value: c.code,
    label: c.namePt,
    meta: `+${c.InternationalAreaCode}`,
  }));

  readonly genderOptions: StyledSelectOption[] = Object.values(Genders).map(g => ({
    value: g,
    label: g,
  }));

  readonly userInitials = computed(() => {
    const parts = (this.user()?.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  /** Troca de email: o pedido em curso e se esta conta pode trocar (null até carregar). */
  readonly emailChange = signal<EmailChangeStatus | null>(null);
  readonly emailChangeBusy = signal(false);
  readonly emailChangeError = signal<string | null>(null);

  readonly saveSuccess = signal(false);
  saveError: string | null = null;

  @ViewChild('pictureInput') pictureInput!: ElementRef<HTMLInputElement>;
  readonly pictureUploading = signal(false);
  pictureError: string | null = null;

  // Foto fica só "pendente" até Salvar alterações — mesmo padrão do resto do
  // formulário, e evita gastar upload/transformação do Cloudinary com fotos
  // que a pessoa acaba nem guardando.
  private readonly pendingPictureFile = signal<File | null>(null);
  private readonly pendingPictureRemoved = signal(false);
  private readonly picturePreviewUrl = signal<string | null>(null);
  // A foto escolhida, antes do recorte, e o ajuste feito: "Ajustar" reabre o
  // recorte a partir do original (sem perder qualidade) e onde ficou.
  private readonly pictureOriginal = signal<File | null>(null);
  private pictureCropState: ImageCropState | null = null;
  readonly canAdjustPicture = computed(() => !!this.pictureOriginal() && !!this.pendingPictureFile());

  readonly displayPicture = computed(() =>
    this.pendingPictureRemoved() ? null : this.picturePreviewUrl() ?? this.user()?.picture ?? null,
  );

  get nameCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.NAME_PROFILE) as FormControl;
  }

  get birthdateCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.BIRTHDATE_PROFILE) as FormControl;
  }

  get genderCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.GENDER_PROFILE) as FormControl;
  }

  get phoneCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.PHONE_PROFILE) as FormControl;
  }

  get bioCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.BIO_PROFILE) as FormControl;
  }

  /** Só profissionais, terapeutas e admins têm uma bio a mostrar às pessoas clientes. */
  readonly showBio = computed(() =>
    (this.user()?.roles ?? []).some((role) => BIO_ALLOWED_ROLES.includes(role)),
  );

  get phonePrefixCountry(): CountryModel {
    const v = this.formService.profileForm.get(FormControlsNames.PHONE_PREFIX_PROFILE)?.value;
    return (v && typeof v === 'object' ? v : getBrowserCountry()) as CountryModel;
  }

  /** Redesenha os exemplos da seção Preferências quando o formulário muda. */
  private readonly prefsTick = signal(0);

  readonly timezoneOptions: StyledSelectOption[] = allTimezones().map((t) => ({
    value: t.value,
    label: t.city,
    meta: timezoneOffsetLabel(t.value),
  }));

  readonly samplePrice = computed(() => {
    this.prefsTick();
    const currency = (this.currencyCtrl.value as Currency) ?? Currency.EUR;
    return formatPrice(SAMPLE_PRICE[currency], currency);
  });

  /**
   * Reformata a próxima sessão no fuso selecionado. O backend devolve um
   * instante em UTC, então basta escolher o fuso de exibição.
   */
  readonly nextSessionPreview = computed(() => {
    this.prefsTick();
    const timeZone = this.timezoneCtrl.value || detectBrowserTimezone();
    const next = this.sessionService.user()?.nextAppointmentAt;
    if (!next) return '';
    const date = new Date(next);
    if (Number.isNaN(date.getTime())) return '';
    const day = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone,
    }).format(date);
    const time = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date);
    return `${day.replace(/\.$/, '')} · ${time}`;
  });

  get currencyCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.CURRENCY_PROFILE) as FormControl;
  }

  get timezoneCtrl(): FormControl {
    return this.formService.profileForm.get(FormControlsNames.TIMEZONE_PROFILE) as FormControl;
  }

  /** Rótulo pronto ('Lisboa (GMT+1)') para reuso em outras telas. */
  get timezoneLabel(): string {
    return timezoneLabel(this.timezoneCtrl.value || detectBrowserTimezone());
  }

  ngOnInit(): void {
    this.formService.profileForm.valueChanges.subscribe(() =>
      this.prefsTick.update((n) => n + 1),
    );
    this.userService.getProfile().subscribe({
      next: (user) => this.patchForm(user),
    });
    this.userService.getEmailChange().subscribe({
      next: (status) => this.emailChange.set(status),
    });
  }

  /** Pede a troca (novo email + senha atual); o email só muda ao abrir o link enviado. */
  changeEmail(): void {
    this.emailChangeError.set(null);
    this.dialog
      .open<ChangeEmailDialogComponent, ChangeEmailDialogData, EmailChangeStatus>(ChangeEmailDialogComponent, {
        width: '480px',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'care-dialog',
        data: { currentEmail: this.user()?.email ?? '' },
      })
      .afterClosed()
      .subscribe((status) => {
        if (status) this.emailChange.set(status);
      });
  }

  cancelEmailChange(): void {
    this.emailChangeError.set(null);
    this.emailChangeBusy.set(true);
    this.userService.cancelEmailChange().subscribe({
      next: (status) => {
        this.emailChangeBusy.set(false);
        this.emailChange.set(status);
      },
      error: (err) => {
        this.emailChangeBusy.set(false);
        this.emailChangeError.set(err.error?.error ?? 'Não foi possível cancelar o pedido. Tente novamente.');
      },
    });
  }

  private patchForm(user: User): void {
    const { country, localNumber } = this.parsePhone(user.phone ?? '');
    const genderValue = user.gender
      ? (Genders[(user.gender as unknown) as keyof typeof Genders] ?? user.gender)
      : '';
    this.selectedCountry.set(country);
    this.formService.profileForm.patchValue({
      [FormControlsNames.NAME_PROFILE]: user.name ?? '',
      [FormControlsNames.EMAIL_PROFILE]: user.email ?? '',
      [FormControlsNames.BIRTHDATE_PROFILE]: user.birthDate?.slice(0, 10) ?? '',
      [FormControlsNames.GENDER_PROFILE]: genderValue,
      [FormControlsNames.BIO_PROFILE]: user.bio ?? '',
      [FormControlsNames.PHONE_PREFIX_PROFILE]: country,
      [FormControlsNames.PHONE_PROFILE]: localNumber,
      // Sem preferência guardada ainda: moeda pelo país do telefone, fuso pelo navegador.
      [FormControlsNames.CURRENCY_PROFILE]:
        user.currency ?? (country.code?.toLowerCase() === 'br' ? Currency.BRL : Currency.EUR),
      [FormControlsNames.TIMEZONE_PROFILE]: user.timeZone ?? detectBrowserTimezone(),
    });
    this.formService.profileForm.enable();
  }

  private parsePhone(phone: string): { country: CountryModel; localNumber: string } {
    if (!phone.startsWith('+')) return { country: getBrowserCountry(), localNumber: phone };
    const digits = phone.slice(1);
    const sorted = [...Countries].sort(
      (a, b) => String(b.InternationalAreaCode).length - String(a.InternationalAreaCode).length
    );
    for (const c of sorted) {
      const code = String(c.InternationalAreaCode);
      if (digits.startsWith(code)) {
        return { country: c, localNumber: digits.slice(code.length) };
      }
    }
    return { country: getBrowserCountry(), localNumber: phone };
  }

  onCountryChange(code: string): void {
    const c = Countries.find(x => x.code === code);
    if (c) {
      this.selectedCountry.set(c);
    }
  }

  onPhonePrefixChange(country: CountryModel): void {
    this.formService.profileForm.get(FormControlsNames.PHONE_PREFIX_PROFILE)?.setValue(country);
  }

  save(): void {
    this.saveError = null;
    this.pictureError = null;

    if (this.pendingPictureFile()) {
      this.pictureUploading.set(true);
      this.userService.updateProfilePicture(this.pendingPictureFile()!).subscribe({
        next: () => {
          this.pictureUploading.set(false);
          this.clearPendingPicture();
          this.saveProfileFields();
        },
        error: (err) => {
          this.pictureUploading.set(false);
          this.pictureError = err.error?.error ?? 'Não foi possível enviar a imagem. Tente novamente.';
        },
      });
      return;
    }

    if (this.pendingPictureRemoved()) {
      this.pictureUploading.set(true);
      this.userService.removeProfilePicture().subscribe({
        next: () => {
          this.pictureUploading.set(false);
          this.clearPendingPicture();
          this.saveProfileFields();
        },
        error: (err) => {
          this.pictureUploading.set(false);
          this.pictureError = err.error?.error ?? 'Não foi possível remover a imagem. Tente novamente.';
        },
      });
      return;
    }

    this.saveProfileFields();
  }

  private saveProfileFields(): void {
    const country = this.phonePrefixCountry;
    const rawPhone = (this.phoneCtrl.value ?? '').replace(/\D/g, '');
    const phone = rawPhone ? `+${country.InternationalAreaCode}${rawPhone}` : '';

    const payload: UpdateProfilePayload = {
      name: this.nameCtrl.value ?? '',
      birthDate: this.birthdateCtrl.value ?? '',
      phone,
      gender: getEnumKeyByValue(Genders, this.genderCtrl.value) as Genders,
      bio: this.formService.profileForm.get(FormControlsNames.BIO_PROFILE)?.value ?? '',
      currency: (this.currencyCtrl.value as Currency) ?? Currency.EUR,
      timeZone: this.timezoneCtrl.value || detectBrowserTimezone(),
    };

    this.userService.updateProfile(payload).subscribe({
      next: () => {
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (err) => {
        this.saveError = err.error?.error ?? 'Erro ao salvar. Tente novamente.';
      },
    });
  }

  cancel(): void {
    this.pictureError = null;
    this.clearPendingPicture();
    const user = this.user();
    if (user) this.patchForm(user);
  }

  triggerPictureInput(): void {
    this.pictureError = null;
    this.pictureInput.nativeElement.click();
  }

  onPictureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Allow reselecting the same file later even if this attempt fails.
    input.value = '';
    if (!file) return;

    this.pictureError = null;

    if (!ALLOWED_PICTURE_TYPES.includes(file.type)) {
      this.pictureError = 'Formato inválido. Envie um arquivo JPG ou PNG.';
      return;
    }
    if (file.size > MAX_PICTURE_SIZE_BYTES) {
      this.pictureError = 'A imagem deve ter até 5 MB.';
      return;
    }

    this.cropPicture(file, null);
  }

  /** Reabre o recorte da foto escolhida, a partir do original. */
  adjustPicture(): void {
    const original = this.pictureOriginal();
    if (!original) return;
    this.pictureError = null;
    this.cropPicture(original, this.pictureCropState);
  }

  /**
   * Recorta (quadrado, moldura redonda como o avatar) e gira a foto antes de
   * a deixar pendente. O servidor ainda corta para 512×512 com gravity face,
   * mas um quadrado chega lá inteiro, por isso o enquadramento escolhido fica.
   * Cancelar o recorte deixa a foto anterior como estava.
   */
  private cropPicture(source: File, state: ImageCropState | null): void {
    this.dialog
      .open<ImageCropDialogComponent, ImageCropDialogData, ImageCropDialogResult>(ImageCropDialogComponent, {
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'care-dialog',
        autoFocus: false,
        data: { source, aspectRatio: 1, round: true, state },
      })
      .afterClosed()
      .subscribe(async result => {
        if (!result) return;
        let blob: Blob;
        try {
          // O recorte sai em JPEG no tamanho original; reduzi-lo poupa o
          // envio e garante que fica abaixo do limite de 5 MB do backend.
          blob = await shrinkImage(result.blob);
        } catch (message) {
          this.pictureError = String(message);
          return;
        }
        this.pictureOriginal.set(source);
        this.pictureCropState = result.state;
        this.revokePreview();
        this.picturePreviewUrl.set(URL.createObjectURL(blob));
        this.pendingPictureFile.set(new File([blob], 'foto-perfil.jpg', { type: 'image/jpeg' }));
        this.pendingPictureRemoved.set(false);
      });
  }

  removePicture(): void {
    this.pictureError = null;
    const hadPendingFile = !!this.pendingPictureFile();
    this.revokePreview();
    this.pendingPictureFile.set(null);
    this.pictureOriginal.set(null);
    this.pictureCropState = null;
    // Só marca remoção de verdade se já havia foto guardada no servidor; se
    // era apenas uma seleção pendente, cancelar a seleção já basta.
    this.pendingPictureRemoved.set(!hadPendingFile && !!this.user()?.picture);
  }

  private revokePreview(): void {
    const preview = this.picturePreviewUrl();
    if (preview) URL.revokeObjectURL(preview);
    this.picturePreviewUrl.set(null);
  }

  private clearPendingPicture(): void {
    this.revokePreview();
    this.pendingPictureFile.set(null);
    this.pendingPictureRemoved.set(false);
    this.pictureOriginal.set(null);
    this.pictureCropState = null;
  }

  openDeleteDialog(): void {
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.userService.deleteAccount().subscribe({
        next: () => this.authService.logout(),
        error: (err) => {
          // 409: has upcoming appointments as a professional - closing the
          // account outright would strand those patients, so it goes through
          // a staff-mediated request instead.
          if (err.status === 409) {
            this.openRequestAccountClosureDialog();
          }
        },
      });
    });
  }

  openRequestAccountClosureDialog(): void {
    const ref = this.dialog.open(RequestAccountClosureDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
    });
    ref.afterClosed().subscribe((reason: string | null) => {
      if (!reason) return;
      this.userService.requestAccountDeletion({ reason }).subscribe({
        next: () => this.snackbarService.openSnackBar({
          message: 'Seu pedido foi enviado. Nossa equipe entrará em contato em breve.',
        }),
        error: (err) => this.snackbarService.openSnackBar({
          message: err.error?.error ?? 'Não foi possível enviar o pedido. Tente novamente.',
        }),
      });
    });
  }
}
