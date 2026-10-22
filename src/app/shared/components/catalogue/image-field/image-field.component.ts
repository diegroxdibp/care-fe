import { Component, inject, input, model, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import { imageFileError, shrinkImage } from '../../../utils/catalogue.util';
import {
  ImageCropDialogComponent,
  ImageCropDialogData,
  ImageCropDialogResult,
  ImageCropState,
} from '../image-crop-dialog/image-crop-dialog.component';

/**
 * Escolher uma imagem para uma página: ajustada (recorte, zoom, rotação),
 * reduzida no navegador (≤1200 px), enviada já, e o endereço fica no campo.
 * tile = a foto 4:5 do perfil.
 */
@Component({
  selector: 'app-image-field',
  standalone: true,
  template: `
    <input #file type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pick($any($event.target))" />
    @if (tile()) {
      <button type="button" class="cat-photo-tile" (click)="file.click()" [disabled]="busy()">
        @if (url()) {
          <img [src]="url()" alt="Fotografia escolhida" />
        } @else {
          {{ busy() ? 'A enviar…' : 'Escolher fotografia' }}
        }
      </button>
      @if (url()) {
        <div class="cat-actions">
          <button type="button" class="cat-btn-text" (click)="adjust()" [disabled]="busy()">Ajustar fotografia</button>
          <button type="button" class="cat-btn-text" (click)="remove()">Remover fotografia</button>
        </div>
      }
    } @else {
      @if (url()) {
        <picture class="cat-image"><img [src]="url()" alt="Imagem escolhida" /></picture>
      }
      <div class="cat-actions">
        <button type="button" class="cat-btn-pill" (click)="file.click()" [disabled]="busy()">
          {{ busy() ? 'A enviar…' : url() ? 'Trocar imagem' : 'Escolher imagem' }}
        </button>
        @if (url()) {
          <button type="button" class="cat-btn-text" (click)="adjust()" [disabled]="busy()">Ajustar imagem</button>
          <button type="button" class="cat-btn-text" (click)="remove()">Remover</button>
        }
      </div>
    }
    <p class="cat-hint">JPG, PNG ou WebP até 15 MB. A imagem é reduzida automaticamente.</p>
    @if (error()) {
      <p class="cat-error" role="alert">{{ error() }}</p>
    }
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
  `],
})
export class ImageFieldComponent {
  private readonly api = inject(CatalogueApiService);
  private readonly dialog = inject(MatDialog);

  readonly url = model<string | null>(null);
  readonly tile = input(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** O ficheiro original e o ajuste feito, para "Ajustar" recortar de novo sem perder qualidade. */
  private original: File | null = null;
  private cropState: ImageCropState | null = null;

  pick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = imageFileError(file);
    this.error.set(problem);
    if (problem) return;
    this.crop(file, null);
  }

  adjust(): void {
    const url = this.url();
    if (!url) return;
    this.error.set(null);
    this.crop(this.original ?? url, this.original ? this.cropState : null);
  }

  remove(): void {
    this.url.set(null);
    this.original = null;
    this.cropState = null;
  }

  private crop(source: File | string, state: ImageCropState | null): void {
    this.dialog
      .open<ImageCropDialogComponent, ImageCropDialogData, ImageCropDialogResult>(ImageCropDialogComponent, {
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'care-dialog',
        autoFocus: false,
        data: { source, aspectRatio: this.tile() ? 4 / 5 : undefined, state },
      })
      .afterClosed()
      .subscribe(result => {
        if (!result) return;
        if (source instanceof File) this.original = source;
        this.cropState = result.state;
        void this.upload(result.blob);
      });
  }

  private async upload(cropped: Blob): Promise<void> {
    let blob: Blob;
    try {
      blob = await shrinkImage(cropped);
    } catch (message) {
      this.error.set(String(message));
      return;
    }
    this.busy.set(true);
    this.api.uploadImage(blob).subscribe({
      next: r => {
        this.url.set(r.url);
        this.busy.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error ?? 'Não foi possível enviar a imagem. Tente novamente.');
        this.busy.set(false);
      },
    });
  }
}
