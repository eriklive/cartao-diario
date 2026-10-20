import type { DataLocal, Horario } from '@cartao/shared/models';

function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function carimboUtc(instante: Date): string {
  return instante.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Evento de calendário diário (iCalendar) no horário escolhido. Sem servidor,
 * é o jeito confiável de lembrar a pessoa no iOS e no Android: ela adiciona
 * o evento ao calendário do celular. O horário é "flutuante" (sem fuso),
 * então segue o fuso do aparelho.
 */
export function gerarIcsLembrete(opcoes: {
  horario: Horario;
  inicio: DataLocal;
  url: string;
  agora: Date;
}): string {
  const [h, m] = opcoes.horario.split(':');
  const titulo = 'Preencher o Cartão Diário';
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cartao Diario//Lembrete//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:lembrete-diario@cartao-diario',
    `DTSTAMP:${carimboUtc(opcoes.agora)}`,
    `DTSTART:${opcoes.inicio.replace(/-/g, '')}T${h}${m}00`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escaparTexto(titulo)}`,
    `DESCRIPTION:${escaparTexto(`Hora de registrar como foi o dia.\n${opcoes.url}`)}`,
    `URL:${opcoes.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escaparTexto(titulo)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return linhas.join('\r\n') + '\r\n';
}
