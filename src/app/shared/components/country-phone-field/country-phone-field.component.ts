import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MaskitoDirective } from '@maskito/angular';
import { MaskitoOptions } from '@maskito/core';
import { CountryModel } from '../../models/country.model';
import { Countries } from '../../../../assets/countries';
import phoneNumberMask from '../../masks/phone-number.mask';

// Phone number input with a clickable, overridable country prefix.
// The prefix mirrors the `country` input (e.g. a "País" selector elsewhere
// on the same form) until the user picks a different prefix directly from
// this component's own dropdown - from that point on it stops following
// `country`, since the two are no longer assumed to be the same thing
// (e.g. living in Portugal but keeping a Brazilian mobile number).
@Component({
  selector: 'app-country-phone-field',
  imports: [ReactiveFormsModule, MaskitoDirective],
  templateUrl: './country-phone-field.component.html',
  styleUrl: './country-phone-field.component.scss',
})
export class CountryPhoneFieldComponent implements OnChanges, AfterViewChecked {
  @Input({ required: true }) country!: CountryModel;
  @Input({ required: true }) phoneControl!: FormControl;
  @Input() placeholder = '000 000 000';
  @Input() inputId = 'phone';
  @Input() invalid = false;

  @Output() readonly prefixCountryChange = new EventEmitter<CountryModel>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly countries = Countries;
  readonly phoneMask: MaskitoOptions = phoneNumberMask;

  readonly prefixCountry = signal<CountryModel>(Countries[0]);
  readonly dropdownOpen = signal(false);
  readonly search = signal('');

  readonly filteredCountries = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.countries;
    return this.countries.filter(
      c => c.namePt.toLowerCase().includes(q) || String(c.InternationalAreaCode).includes(q),
    );
  });

  private linked = true;
  private focusPending = false;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['country'] && this.country && this.linked) {
      this.prefixCountry.set(this.country);
      this.prefixCountryChange.emit(this.country);
    }
  }

  ngAfterViewChecked(): void {
    if (this.focusPending && this.searchInputRef) {
      this.focusPending = false;
      this.searchInputRef.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen.set(false);
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.dropdownOpen.set(false);
  }

  // Como no StyledSelect: clicar na barra de scroll da lista de países tira o
  // foco da pesquisa (para lado nenhum, ou para o contentor de um diálogo) e
  // fechava a lista a meio do scroll. Um clique que começou cá dentro não é
  // sair; no fim dele o foco volta à pesquisa.
  private pointerDownInside = false;

  @HostListener('mousedown')
  onHostMousedown(): void {
    this.pointerDownInside = true;
  }

  @HostListener('document:mouseup')
  onDocumentMouseup(): void {
    if (!this.pointerDownInside) return;
    this.pointerDownInside = false;
    if (this.dropdownOpen() && !this.elementRef.nativeElement.contains(document.activeElement)) {
      this.searchInputRef?.nativeElement.focus();
    }
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    if (this.pointerDownInside) return;
    const next = event.relatedTarget as Node | null;
    if (!next || !this.elementRef.nativeElement.contains(next)) {
      this.dropdownOpen.set(false);
    }
  }

  toggleDropdown(): void {
    const next = !this.dropdownOpen();
    this.dropdownOpen.set(next);
    if (next) {
      this.search.set('');
      this.focusPending = true;
    }
  }

  selectPrefixCountry(country: CountryModel): void {
    this.linked = false;
    this.prefixCountry.set(country);
    this.dropdownOpen.set(false);
    this.prefixCountryChange.emit(country);
  }
}
