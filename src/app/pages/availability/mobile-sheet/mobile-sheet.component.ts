import { Component, ElementRef, output, viewChild } from '@angular/core';

// The availability page's mobile bottom sheet: scrim, handle, a header row
// with a close button, a scrolling body and a footer. The page fills it by
// projection (attribute sheetHead for the header's left side, sheetFoot for
// the footer, the rest goes in the body), so the form and the appointment
// details keep the page's own templates and styles.
@Component({
  selector: 'app-mobile-sheet',
  standalone: true,
  templateUrl: './mobile-sheet.component.html',
  styleUrl: './mobile-sheet.component.scss',
})
export class MobileSheetComponent {
  // Scrim tap or the close button.
  readonly closed = output<void>();

  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  scrollToTop(): void {
    this.body().nativeElement.scrollTop = 0;
  }
}
