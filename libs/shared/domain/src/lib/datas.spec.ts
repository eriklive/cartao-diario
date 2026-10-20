import {
  diaDaSemana,
  diasDaSemana,
  diferencaEmDias,
  fimDaSemana,
  formatarDataLonga,
  formatarDataNumerica,
  formatarPeriodoCurto,
  formatarPeriodoLongo,
  inicioDaSemana,
  intervalo,
  juntarLista,
  paraDataLocal,
  semanaIso,
  somarDias,
} from './datas';

describe('datas', () => {
  it('soma dias atravessando mês, ano e bissexto', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(somarDias('2026-10-18', -6)).toBe('2026-10-12');
  });

  it('não é afetada pelo horário de verão', () => {
    expect(diferencaEmDias('2026-03-01', '2026-04-01')).toBe(31);
    expect(diferencaEmDias('2026-10-18', '2026-10-12')).toBe(-6);
  });

  it('usa semanas de segunda a domingo', () => {
    expect(diaDaSemana('2026-10-18')).toBe(0);
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-12');
    expect(inicioDaSemana('2026-10-12')).toBe('2026-10-12');
    expect(fimDaSemana('2026-10-14')).toBe('2026-10-18');
    expect(diasDaSemana('2026-10-12')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });

  it('gera intervalos inclusivos', () => {
    expect(intervalo('2026-10-17', '2026-10-19')).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
    expect(intervalo('2026-10-19', '2026-10-17')).toEqual([]);
  });

  it('calcula a semana ISO', () => {
    expect(semanaIso('2026-10-14')).toBe(42);
    expect(semanaIso('2026-01-01')).toBe(1);
    expect(semanaIso('2027-01-01')).toBe(53);
    expect(semanaIso('2024-12-30')).toBe(1);
  });

  it('converte um instante para a data local', () => {
    expect(paraDataLocal(new Date(2026, 9, 18, 23, 59))).toBe('2026-10-18');
  });

  it('formata em português', () => {
    expect(formatarDataLonga('2026-10-18')).toBe('Domingo, 18 de outubro');
    expect(formatarDataNumerica('2026-10-08')).toBe('08/10/2026');
    expect(formatarPeriodoCurto('2026-10-12', '2026-10-18')).toBe('12 a 18 out');
    expect(formatarPeriodoCurto('2026-09-28', '2026-10-04')).toBe('28 set a 4 out');
    expect(formatarPeriodoCurto('2025-12-29', '2026-01-04')).toBe('29 dez 2025 a 4 jan 2026');
    expect(formatarPeriodoLongo('2026-10-12', '2026-10-18')).toBe('12 a 18 de outubro de 2026');
    expect(juntarLista(['terça'])).toBe('terça');
    expect(juntarLista(['segunda', 'terça', 'quarta'])).toBe('segunda, terça e quarta');
  });
});
