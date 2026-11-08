import { Component, effect, ElementRef, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { Editor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';

import { fromEditorDoc, parseRichText, serializeRichText, toEditorDoc } from '../../../utils/rich-text.util';

interface ToolState {
  heading: boolean;
  bold: boolean;
  italic: boolean;
  bulletList: boolean;
  orderedList: boolean;
}

const NONE: ToolState = { heading: false, bold: false, italic: false, bulletList: false, orderedList: false };

/**
 * Caixa de texto com formatação para os textos dos serviços e perfis:
 * subtítulo, negrito, itálico e listas. O valor que entra e sai é o texto
 * guardado (rich-text.util), nunca HTML.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  template: `
    <div class="cat-rt-editor" [class.cat-invalid]="invalid()" [class.cat-rt-disabled]="disabled()">
      <div class="cat-rt-toolbar" role="toolbar" [attr.aria-label]="'Formatação: ' + label()">
        @for (t of tools; track t.key) {
          <button
            type="button"
            class="cat-rt-tool"
            [attr.aria-pressed]="state()[t.key]"
            [attr.aria-label]="t.label"
            [title]="t.label"
            [disabled]="disabled()"
            (mousedown)="$event.preventDefault()"
            (click)="run(t.key)"
          >
            @if (t.text) {
              <span class="cat-rt-tool-text">{{ t.text }}</span>
            } @else {
              <span translate="no" class="material-symbols-outlined" aria-hidden="true">{{ t.icon }}</span>
            }
          </button>
        }
      </div>
      <div #host class="cat-rt-host" [style.--rt-rows]="rows()"></div>
    </div>
  `,
})
export class RichTextEditorComponent implements OnDestroy {
  /** O texto guardado (com as marcas de rich-text.util). */
  readonly value = input<string>('');
  readonly label = input.required<string>();
  readonly inputId = input<string | null>(null);
  readonly placeholder = input('');
  readonly rows = input(6);
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  readonly state = signal<ToolState>(NONE);

  readonly tools: { key: keyof ToolState; label: string; text?: string; icon?: string }[] = [
    { key: 'heading', label: 'Subtítulo', text: 'Subtítulo' },
    { key: 'bold', label: 'Negrito', icon: 'format_bold' },
    { key: 'italic', label: 'Itálico', icon: 'format_italic' },
    { key: 'bulletList', label: 'Lista com marcadores', icon: 'format_list_bulleted' },
    { key: 'orderedList', label: 'Lista numerada', icon: 'format_list_numbered' },
  ];

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private editor: Editor | null = null;
  /** O último texto que este editor tem: o que veio de fora ou o que emitiu. */
  private current: string | null = null;

  constructor() {
    effect(() => {
      const value = this.value() ?? '';
      const host = this.host().nativeElement;
      if (!this.editor) {
        this.create(host, value);
      } else if (value !== this.current) {
        // Mudou por fora (rascunho reposto, parte aprovada reposta): mostra-o.
        this.current = value;
        this.editor.commands.setContent(toEditorDoc(parseRichText(value)), { emitUpdate: false });
      }
    });
    effect(() => {
      const editable = !this.disabled();
      if (this.editor && this.editor.isEditable !== editable) this.editor.setEditable(editable, false);
    });
  }

  private create(host: HTMLElement, value: string): void {
    this.current = value;
    const attributes: Record<string, string> = {
      class: 'cat-rt-content',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': this.label(),
    };
    const id = this.inputId();
    if (id) attributes['id'] = id;
    this.editor = new Editor({
      element: host,
      editable: !this.disabled(),
      extensions: [
        StarterKit.configure({
          heading: { levels: [3] },
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          link: false,
          underline: false,
          hardBreak: false,
        }),
        Placeholder.configure({ placeholder: this.placeholder() }),
      ],
      content: toEditorDoc(parseRichText(value)),
      editorProps: { attributes },
      onUpdate: ({ editor }) => {
        const text = serializeRichText(fromEditorDoc(editor.getJSON()));
        if (text === this.current) return;
        this.current = text;
        this.valueChange.emit(text);
      },
      onTransaction: ({ editor }) =>
        this.state.set({
          heading: editor.isActive('heading', { level: 3 }),
          bold: editor.isActive('bold'),
          italic: editor.isActive('italic'),
          bulletList: editor.isActive('bulletList'),
          orderedList: editor.isActive('orderedList'),
        }),
    });
  }

  run(key: keyof ToolState): void {
    const chain = this.editor?.chain().focus();
    if (!chain) return;
    switch (key) {
      case 'heading':
        chain.toggleHeading({ level: 3 }).run();
        break;
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'bulletList':
        chain.toggleBulletList().run();
        break;
      case 'orderedList':
        chain.toggleOrderedList().run();
        break;
    }
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }
}
