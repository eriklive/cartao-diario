import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Ilustração da splash de instalação: vetor chapado e colorido, de céu
 * estrelado e personagem simples. O ícone do Cartão Diário voa para o
 * espaço vazio na tela de início do celular. Original, sem imagens externas.
 */
@Component({
  selector: 'cd-ilustracao-tela-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .flutua {
      animation: flutua 3.2s ease-in-out infinite alternate;
    }
    .brilha {
      animation: brilha 2.4s ease-in-out infinite alternate;
    }
    .brilha.b2 {
      animation-delay: 0.8s;
    }
    .brilha.b3 {
      animation-delay: 1.6s;
    }
    .vaga {
      animation: vaga 1.6s ease-in-out infinite alternate;
    }
    @keyframes flutua {
      from {
        transform: translateY(0);
      }
      to {
        transform: translateY(-7px);
      }
    }
    @keyframes brilha {
      from {
        opacity: 0.35;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes vaga {
      from {
        opacity: 0.45;
      }
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .flutua,
      .brilha,
      .vaga {
        animation: none;
      }
    }
  `,
  template: `
    <svg viewBox="0 0 390 340" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="cd-ilu-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0D1B3D" />
          <stop offset="1" stop-color="#2A4A86" />
        </linearGradient>
        <linearGradient id="cd-ilu-tela" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4D6FB8" />
          <stop offset="1" stop-color="#86A6E3" />
        </linearGradient>
        <radialGradient id="cd-ilu-brilho" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#FFD166" stop-opacity="0.55" />
          <stop offset="1" stop-color="#FFD166" stop-opacity="0" />
        </radialGradient>
        <clipPath id="cd-ilu-planeta"><circle cx="72" cy="74" r="30" /></clipPath>
        <clipPath id="cd-ilu-bicho"><circle cx="70" cy="292" r="26" /></clipPath>
        <marker id="cd-ilu-seta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M1 1 L9 5 L1 9 Z" fill="#FFD166" />
        </marker>
      </defs>

      <rect width="390" height="340" [attr.fill]="ref('cd-ilu-ceu')" />

      <!-- estrelas -->
      <g fill="#FFFFFF">
        <circle cx="24" cy="30" r="1.4" opacity="0.8" />
        <circle cx="128" cy="22" r="1.1" opacity="0.6" />
        <circle cx="170" cy="58" r="1.6" opacity="0.9" />
        <circle cx="214" cy="18" r="1.2" opacity="0.7" />
        <circle cx="356" cy="34" r="1.5" opacity="0.8" />
        <circle cx="372" cy="102" r="1.1" opacity="0.6" />
        <circle cx="30" cy="150" r="1.3" opacity="0.7" />
        <circle cx="112" cy="128" r="1" opacity="0.5" />
        <circle cx="300" cy="214" r="1.2" opacity="0.6" />
        <circle cx="356" cy="236" r="1.5" opacity="0.8" />
        <circle cx="20" cy="222" r="1.1" opacity="0.6" />
        <circle cx="106" cy="196" r="1.4" opacity="0.7" />
      </g>
      <g fill="#FFD166">
        <path class="brilha" d="M150 92 Q150 98 156 98 Q150 98 150 104 Q150 98 144 98 Q150 98 150 92 Z" />
        <path class="brilha b2" d="M352 138 Q352 145 359 145 Q352 145 352 152 Q352 145 345 145 Q352 145 352 138 Z" />
        <path class="brilha b3" d="M36 100 Q36 104 40 104 Q36 104 36 108 Q36 104 32 104 Q36 104 36 100 Z" />
      </g>

      <!-- planeta com anel -->
      <g transform="translate(72 74) rotate(-18)">
        <path d="M-50 0 A50 13 0 0 1 50 0" fill="none" stroke="#FFD6A5" stroke-width="4" stroke-linecap="round" />
      </g>
      <g [attr.clip-path]="ref('cd-ilu-planeta')">
        <circle cx="72" cy="74" r="30" fill="#E25D4A" />
        <circle cx="64" cy="66" r="30" fill="#FF8C61" />
        <path d="M44 66 Q72 58 100 70" fill="none" stroke="#FFB38A" stroke-width="5" stroke-linecap="round" />
        <path d="M46 84 Q70 78 96 88" fill="none" stroke="#E9765A" stroke-width="4" stroke-linecap="round" />
      </g>
      <g transform="translate(72 74) rotate(-18)">
        <path d="M50 0 A50 13 0 0 1 -50 0" fill="none" stroke="#FFD6A5" stroke-width="4" stroke-linecap="round" />
      </g>

      <!-- lua pequena -->
      <circle cx="338" cy="176" r="12" fill="#7FD1F4" />
      <circle cx="334" cy="172" r="2.6" fill="#5BB6E0" />
      <circle cx="342" cy="180" r="2" fill="#5BB6E0" />

      <!-- colina de trás -->
      <path d="M0 288 C70 252 150 262 210 284 S330 300 390 266 L390 340 L0 340 Z" fill="#1C3A70" />

      <!-- celular com a tela de início -->
      <rect x="128" y="96" width="134" height="250" rx="26" fill="#0A1430" />
      <rect x="132" y="100" width="126" height="242" rx="23" fill="#2C3E6B" opacity="0.6" />
      <rect x="136" y="108" width="118" height="232" rx="17" [attr.fill]="ref('cd-ilu-tela')" />
      <rect x="180" y="114" width="30" height="8" rx="4" fill="#0A1430" />
      <g>
        <rect x="146" y="136" width="24" height="24" rx="7" fill="#F6BD60" />
        <rect x="183" y="136" width="24" height="24" rx="7" fill="#F28482" />
        <rect x="220" y="136" width="24" height="24" rx="7" fill="#84DCC6" />
        <rect x="146" y="173" width="24" height="24" rx="7" fill="#A5B4FC" />
        <rect x="220" y="173" width="24" height="24" rx="7" fill="#FFFFFF" opacity="0.85" />
        <rect x="146" y="210" width="24" height="24" rx="7" fill="#90BE6D" />
        <rect x="183" y="210" width="24" height="24" rx="7" fill="#F7A072" />
        <rect x="220" y="210" width="24" height="24" rx="7" fill="#C8B6FF" />
        <rect x="146" y="247" width="24" height="24" rx="7" fill="#FFFFFF" opacity="0.6" />
        <rect x="183" y="247" width="24" height="24" rx="7" fill="#84DCC6" opacity="0.8" />
      </g>
      <!-- vaga esperando o app -->
      <rect
        class="vaga"
        x="183"
        y="173"
        width="24"
        height="24"
        rx="7"
        fill="#FFD166"
        fill-opacity="0.18"
        stroke="#FFD166"
        stroke-width="2"
        stroke-dasharray="4 3"
      />

      <!-- caminho do ícone até a vaga -->
      <path
        d="M266 118 C252 140 236 156 213 172"
        fill="none"
        stroke="#FFD166"
        stroke-width="2.5"
        stroke-dasharray="5 5"
        stroke-linecap="round"
        [attr.marker-end]="ref('cd-ilu-seta')"
      />

      <!-- ícone do Cartão Diário voando -->
      <g class="flutua">
        <circle cx="290" cy="90" r="48" [attr.fill]="ref('cd-ilu-brilho')" />
        <g transform="rotate(-10 290 90)">
          <rect x="263" y="63" width="54" height="54" rx="14" fill="#2F4A78" stroke="#FFFFFF" stroke-width="3" />
          <g
            transform="translate(290 90) scale(1.45) translate(-12 -12.5)"
            fill="none"
            stroke="#FFFFFF"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="4" y="4" width="16" height="17" rx="2" />
            <path d="M8 2v4M16 2v4M4 10h16M8 15l2.5 2.5L16 13" />
          </g>
        </g>
        <path
          class="brilha b2"
          d="M326 58 Q326 65 333 65 Q326 65 326 72 Q326 65 319 65 Q326 65 326 58 Z"
          fill="#FFD166"
        />
        <path
          class="brilha b3"
          d="M252 52 Q252 56 256 56 Q252 56 252 60 Q252 56 248 56 Q252 56 252 52 Z"
          fill="#FFFFFF"
        />
      </g>

      <!-- colina da frente -->
      <path d="M0 306 C90 284 170 298 250 318 S350 316 390 298 L390 340 L0 340 Z" fill="#132856" />

      <!-- personagem: uma sementinha curiosa apontando para o ícone -->
      <path d="M70 268 C70 260 74 256 79 254" fill="none" stroke="#84DCC6" stroke-width="2.5" stroke-linecap="round" />
      <ellipse cx="82" cy="252" rx="7" ry="3.8" transform="rotate(-30 82 252)" fill="#84DCC6" />
      <ellipse cx="96" cy="274" rx="5" ry="11" transform="rotate(38 96 274)" fill="#FFC857" />
      <g [attr.clip-path]="ref('cd-ilu-bicho')">
        <circle cx="70" cy="292" r="26" fill="#F2A93B" />
        <circle cx="64" cy="287" r="26" fill="#FFC857" />
        <ellipse cx="68" cy="304" rx="14" ry="11" fill="#FFE29A" />
      </g>
      <circle cx="61" cy="285" r="6" fill="#FFFFFF" />
      <circle cx="78" cy="285" r="6" fill="#FFFFFF" />
      <circle cx="63.5" cy="282.5" r="3.2" fill="#0D1B3D" />
      <circle cx="80.5" cy="282.5" r="3.2" fill="#0D1B3D" />
      <circle cx="64.5" cy="281.3" r="1" fill="#FFFFFF" />
      <circle cx="81.5" cy="281.3" r="1" fill="#FFFFFF" />
      <ellipse cx="54" cy="295" rx="4" ry="2.4" fill="#F28482" opacity="0.8" />
      <ellipse cx="86" cy="295" rx="4" ry="2.4" fill="#F28482" opacity="0.8" />
      <path d="M66 296 Q70 300 74 296" fill="none" stroke="#0D1B3D" stroke-width="1.8" stroke-linecap="round" />
      <ellipse cx="60" cy="318" rx="6" ry="3" fill="#E0A63A" />
      <ellipse cx="80" cy="318" rx="6" ry="3" fill="#E0A63A" />
    </svg>
  `,
})
export class IlustracaoTelaInicio {
  /**
   * Com <base href> diferente da página, Safari e Firefox resolvem url(#id)
   * contra a base e o gradiente/recorte some. O endereço completo evita isso.
   */
  private readonly pagina = inject(DOCUMENT).location.href.replace(/#.*$/, '');

  protected ref(id: string): string {
    return `url(${this.pagina}#${id})`;
  }
}
