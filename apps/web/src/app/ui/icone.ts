import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NomeIcone =
  | 'voltar'
  | 'avancar'
  | 'hoje'
  | 'semana'
  | 'exportar'
  | 'ajustes'
  | 'apoio'
  | 'check'
  | 'editar'
  | 'mais'
  | 'fechar'
  | 'cartao'
  | 'telefone'
  | 'baixar'
  | 'enviar'
  | 'historico'
  | 'instalar'
  | 'arquivo'
  | 'cadeado'
  | 'lista'
  | 'menu';

/** Ícones de contorno 1,75 px, cantos arredondados. Sempre decorativos: o texto ou `aria-label` vai no botão. */
@Component({
  selector: 'cd-icone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cd-icone' },
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
  `,
  template: `
    <svg
      [attr.width]="tamanho()"
      [attr.height]="tamanho()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="espessura()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (nome()) {
        @case ('voltar') {
          <path d="M15 6l-6 6 6 6" />
        }
        @case ('avancar') {
          <path d="M9 6l6 6-6 6" />
        }
        @case ('hoje') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        }
        @case ('semana') {
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        }
        @case ('exportar') {
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        }
        @case ('ajustes') {
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        }
        @case ('apoio') {
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        }
        @case ('check') {
          <path d="M5 12l5 5L19 7" />
        }
        @case ('editar') {
          <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
        }
        @case ('mais') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('fechar') {
          <path d="M6 6l12 12M18 6L6 18" />
        }
        @case ('cartao') {
          <rect x="4" y="4" width="16" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M4 10h16M8 15l2.5 2.5L16 13" />
        }
        @case ('telefone') {
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        }
        @case ('baixar') {
          <path d="M12 4v11M8 11l4 4 4-4M5 19h14" />
        }
        @case ('enviar') {
          <path d="M12 20V9M8 13l4-4 4 4M5 5h14" />
        }
        @case ('historico') {
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        }
        @case ('instalar') {
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M12 8v6M9.5 11.5L12 14l2.5-2.5" />
        }
        @case ('arquivo') {
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
        }
        @case ('cadeado') {
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        }
        @case ('menu') {
          <circle cx="12" cy="5" r="1.25" fill="currentColor" />
          <circle cx="12" cy="12" r="1.25" fill="currentColor" />
          <circle cx="12" cy="19" r="1.25" fill="currentColor" />
        }
        @case ('lista') {
          <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        }
      }
    </svg>
  `,
})
export class Icone {
  readonly nome = input.required<NomeIcone>();
  readonly tamanho = input(24);
  readonly espessura = input(1.75);
}
