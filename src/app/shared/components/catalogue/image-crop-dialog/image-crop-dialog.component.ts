import { Component, inject, signal, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CropperPosition, ImageCropperComponent, ImageTransform } from 'ngx-image-cropper';

/** O ajuste feito, para reabrir o recorte onde ficou. */
export interface ImageCropState {
  cropper: CropperPosition;
  scale: number;
  rotation: number;
  ratio: number | null;
}

export interface ImageCropDialogData {
  /** O ficheiro escolhido agora, ou o endereço da imagem já guardada. */
  source: File | string;
  /** Proporção fixa (largura / altura). Sem ela, escolhe-se: livre, 1:1, 4:3, 16:9. */
  aspectRatio?: number;
  state?: ImageCropState | null;
}

export interface ImageCropDialogResult {
  blob: Blob;
  state: ImageCropState;
}

const RATIOS: { label: string; value: number | null }[] = [
  { label: 'Livre', value: null },
  { label: 'Quadrada', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

/** Recortar, enquadrar e rodar uma imagem antes de a enviar. */
@Component({
  selector: 'app-image-crop-dialog',
  standalone: true,
  imports: [MatDialogModule, ImageCropperComponent],
  template: `
    <div class="dialog">
      <h3>Ajustar imagem</h3>
      <p class="body">Arraste a moldura para escolher a parte que aparece. Use o zoom para aproximar e arraste a imagem para enquadrá-la.</p>

      <div class="stage">
        <image-cropper
          [imageFile]="file"
          [imageURL]="url"
          [maintainAspectRatio]="ratio() !== null"
          [aspectRatio]="ratio() ?? 1"
          [transform]="transform()"
          [cropper]="cropperPos()"
          [canvasRotation]="rotation()"
          [allowMoveImage]="true"
          [autoCrop]="false"
          output="blob"
          format="jpeg"
          [imageQuality]="90"
          backgroundColor="#ffffff"
          [onlyScaleDown]="true"
          cropperFrameAriaLabel="Área de recorte"
          (cropperReady)="ready()"
          (loadImageFailed)="failed.set(true)"
          (transformChange)="transform.set($event)"
        />
        @if (failed()) {
          <p class="cat-error" role="alert">Não foi possível abrir esta imagem para ajustar.</p>
        }
      </div>

      <div class="controls">
        <label class="zoom">
          <span class="material-symbols-outlined" translate="no" aria-hidden="true">zoom_out</span>
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            aria-label="Zoom"
            [value]="transform().scale ?? 1"
            (input)="zoom(+$any($event.target).value)"
          />
          <span class="material-symbols-outlined" translate="no" aria-hidden="true">zoom_in</span>
        </label>
        <div class="cat-actions">
          <button type="button" class="cat-btn-text" (click)="rotate(-1)">
            <span class="material-symbols-outlined" translate="no" aria-hidden="true">rotate_left</span> Girar
          </button>
          <button type="button" class="cat-btn-text" (click)="rotate(1)">
            <span class="material-symbols-outlined" translate="no" aria-hidden="true">rotate_right</span> Girar
          </button>
          <button type="button" class="cat-btn-text" (click)="reset()">Redefinir</button>
        </div>
        @if (!data.aspectRatio) {
          <div class="cat-chips" role="group" aria-label="Proporção">
            @for (r of ratios; track r.label) {
              <button type="button" class="cat-chip" [attr.aria-pressed]="ratio() === r.value" (click)="ratio.set(r.value)">
                {{ r.label }}
              </button>
            }
          </div>
        }
      </div>

      <div class="btns">
        <button type="button" class="cat-btn-text" (click)="ref.close()">Cancelar</button>
        <button type="button" class="cat-btn-pill cat-btn-primary" [disabled]="!isReady() || busy()" (click)="apply()">
          {{ busy() ? 'Recortando…' : 'Aplicar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog {
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: var(--font-sans);
    }
    h3 {
      font-size: 22px;
      font-weight: var(--fw-bold);
      color: var(--color-primary-blue);
      margin: 0;
    }
    .body {
      font-size: 15px;
      line-height: 1.5;
      color: var(--fg-1);
      margin: 0;
      text-align: left;
    }
    .stage {
      background: var(--color-surface-tint);
      border-radius: var(--radius-md);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    image-cropper {
      max-height: 55vh;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zoom {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--fg-1);

      input {
        flex: 1;
        accent-color: var(--color-primary-blue);
      }
    }
    .cat-btn-text {
      display: inline-flex;
      align-items: center;
      gap: 4px;

      .material-symbols-outlined {
        font-size: 20px;
        text-decoration: none;
      }
    }
    .btns {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      align-items: center;
    }
  `],
})
export class ImageCropDialogComponent {
  readonly ref = inject(MatDialogRef<ImageCropDialogComponent, ImageCropDialogResult>);
  readonly data = inject<ImageCropDialogData>(MAT_DIALOG_DATA);
  private readonly cropperCmp = viewChild.required(ImageCropperComponent);

  readonly ratios = RATIOS;
  readonly file = this.data.source instanceof File ? this.data.source : undefined;
  readonly url = typeof this.data.source === 'string' ? this.data.source : undefined;

  readonly ratio = signal<number | null>(this.data.aspectRatio ?? this.data.state?.ratio ?? null);
  readonly transform = signal<ImageTransform>({ scale: this.data.state?.scale ?? 1 });
  readonly rotation = signal(this.data.state?.rotation ?? 0);
  readonly cropperPos = signal<CropperPosition | undefined>(undefined);
  readonly isReady = signal(false);
  readonly failed = signal(false);
  readonly busy = signal(false);

  /** A moldura só se pode repor depois de a imagem estar carregada (o cropper repõe-na ao carregar). */
  ready(): void {
    const saved = this.data.state?.cropper;
    if (saved && !this.isReady()) {
      setTimeout(() => this.cropperPos.set({ ...saved }));
    }
    this.isReady.set(true);
  }

  zoom(scale: number): void {
    this.transform.update(t => ({ ...t, scale }));
  }

  rotate(step: 1 | -1): void {
    this.rotation.update(r => r + step);
  }

  reset(): void {
    this.transform.set({ scale: 1 });
    this.rotation.set(0);
    this.cropperCmp().resetCropperPosition();
  }

  async apply(): Promise<void> {
    const cropper = this.cropperCmp();
    this.busy.set(true);
    const event = await cropper.crop('blob');
    this.busy.set(false);
    if (!event?.blob) {
      this.failed.set(true);
      return;
    }
    this.ref.close({
      blob: event.blob,
      state: {
        cropper: event.cropperPosition,
        scale: this.transform().scale ?? 1,
        rotation: this.rotation(),
        ratio: this.ratio(),
      },
    });
  }
}
