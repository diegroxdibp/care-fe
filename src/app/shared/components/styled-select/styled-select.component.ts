import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
  computed,
  input,
  signal,
} from '@angular/core';

export interface StyledSelectOption {
  value: string;
  label: string;
  meta?: string;
}

// Generic popover-styled select, replacing native <select> for cases where
// we want consistent, custom-styled dropdown UI (and, as a side effect, avoid
// the native-select-plus-*ngFor timing quirk where the bound value doesn't
// visually reflect until options have already been rendered once).
@Component({
  selector: 'app-styled-select',
  imports: [],
  templateUrl: './styled-select.component.html',
  styleUrl: './styled-select.component.scss',
})
export class StyledSelectComponent implements AfterViewChecked {
  readonly options = input.required<StyledSelectOption[]>();
  readonly value = input<string | null>(null);
  readonly placeholder = input('Selecione');
  readonly inputId = input('');
  readonly searchPlaceholder = input('Pesquisar...');

  @Output() readonly valueChange = new EventEmitter<string>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly dropdownOpen = signal(false);
  readonly search = signal('');

  // options() has to be read here (not just `this.options`) so this computed
  // actually depends on it - a plain field read is invisible to computed()'s
  // dependency tracking, and the dropdown's list would freeze at whatever it
  // was the first time it opened, forever after, even though the closed
  // trigger (selectedOption below, a getter Angular re-runs every check)
  // kept showing the right value the whole time.
  readonly filteredOptions = computed(() => {
    const q = this.search().trim().toLowerCase();
    const opts = this.options();
    if (!q) return opts;
    return opts.filter(
      o => o.label.toLowerCase().includes(q) || (o.meta ?? '').toLowerCase().includes(q),
    );
  });

  private focusPending = false;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  get selectedOption(): StyledSelectOption | undefined {
    return this.options().find(o => o.value === this.value());
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

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
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

  select(option: StyledSelectOption): void {
    this.valueChange.emit(option.value);
    this.dropdownOpen.set(false);
  }
}
