import { Component, inject, input, model, signal } from '@angular/core';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import { shrinkImage } from '../../../utils/catalogue.util';

/**
 * Escolher uma imagem para uma página: reduzida no navegador (≤1200 px),
 * enviada já, e o endereço fica no campo. tile = a foto 4:5 do perfil.
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
    } @else {
      @if (url()) {
        <picture class="cat-image"><img [src]="url()" alt="Imagem escolhida" /></picture>
      }
      <div class="cat-actions">
        <button type="button" class="cat-btn-pill" (click)="file.click()" [disabled]="busy()">
          {{ busy() ? 'A enviar…' : url() ? 'Trocar imagem' : 'Escolher imagem' }}
        </button>
        @if (url()) {
          <button type="button" class="cat-btn-text" (click)="url.set(null)">Remover</button>
        }
      </div>
    }
    @if (tile() && url()) {
      <button type="button" class="cat-btn-text" (click)="url.set(null)">Remover fotografia</button>
    }
    <p class="cat-hint">JPG, PNG ou WebP até 15 MB. A imagem é reduzida automaticamente.</p>
    @if (error()) {
      <p class="cat-error" role="alert">{{ error() }}</p>
    }
  `,
})
export class ImageFieldComponent {
  private readonly api = inject(CatalogueApiService);

  readonly url = model<string | null>(null);
  readonly tile = input(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async pick(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    let blob: Blob;
    try {
      blob = await shrinkImage(file);
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
