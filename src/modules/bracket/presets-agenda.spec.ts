import { planDiasPorFormato } from './presets-agenda';

// Helpers de fechas conocidas (UTC): 2026-07-02 = jueves … 2026-07-05 = domingo.
const JUE = '2026-07-02';
const VIE = '2026-07-03';
const SAB = '2026-07-04';
const DOM = '2026-07-05';

describe('planDiasPorFormato', () => {
  it('FINDE (jue–dom): zona jue/vie, llave sáb, finales dom', () => {
    const plan = planDiasPorFormato('FINDE', [JUE, VIE, SAB, DOM]);
    expect(plan.map((d) => d.fasesPermitidas)).toEqual([
      ['ZONA', 'REPECHAJE'],
      ['ZONA', 'REPECHAJE'],
      ['TREINTAYDOSAVOS', 'DIECISEISAVOS', 'OCTAVOS', 'CUARTOS'],
      ['SEMIS', 'FINAL'],
    ]);
    // ventanas: semana 18–23, finde 14–23
    expect(plan[0]).toMatchObject({ horaInicio: '18:00', horaFin: '23:00' });
    expect(plan[2]).toMatchObject({ horaInicio: '14:00', horaFin: '23:00' });
  });

  it('EXPRESS: un solo día con TODAS las fases', () => {
    const plan = planDiasPorFormato('EXPRESS', [SAB]);
    expect(plan).toHaveLength(1);
    expect(plan[0].fasesPermitidas).toEqual(
      ['ZONA', 'REPECHAJE', 'TREINTAYDOSAVOS', 'DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'],
    );
  });

  it('NOCTURNO: secuencial, finales el último día, ventana 18–23', () => {
    const noches = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']; // lun–jue
    const plan = planDiasPorFormato('NOCTURNO', noches);
    expect(plan.every((d) => d.horaInicio === '18:00' && d.horaFin === '23:00')).toBe(true);
    expect(plan[plan.length - 1].fasesPermitidas).toEqual(['SEMIS', 'FINAL']);
    expect(plan[0].fasesPermitidas).toEqual(['ZONA', 'REPECHAJE']);
    // ningún día intermedio recibe finales
    expect(plan.slice(0, -1).some((d) => d.fasesPermitidas.includes('FINAL'))).toBe(false);
  });

  it('todo formato deja exactamente UN día con FINAL (las finales tienen dónde caer)', () => {
    const sets: { f: any; dias: string[] }[] = [
      { f: 'FINDE', dias: [JUE, VIE, SAB, DOM] },
      { f: 'EXPRESS', dias: [SAB] },
      { f: 'NOCTURNO', dias: ['2026-07-06', '2026-07-07', '2026-07-08'] },
      { f: 'LIGA', dias: [SAB, DOM, '2026-07-11', '2026-07-12'] },
    ];
    for (const { f, dias } of sets) {
      const plan = planDiasPorFormato(f, dias);
      const conFinal = plan.filter((d) => d.fasesPermitidas.includes('FINAL')).length;
      expect(conFinal).toBeGreaterThanOrEqual(1);
    }
  });

  it('FINDE con fechas que NO incluyen domingo cae a secuencial (no deja finales sin día)', () => {
    const plan = planDiasPorFormato('FINDE', [JUE, VIE, SAB]); // sin domingo
    const conFinal = plan.filter((d) => d.fasesPermitidas.includes('FINAL')).length;
    expect(conFinal).toBe(1);
    expect(plan[plan.length - 1].fasesPermitidas).toEqual(['SEMIS', 'FINAL']);
  });

  it('ordena las fechas y deduplica', () => {
    const plan = planDiasPorFormato('NOCTURNO', [DOM, JUE, JUE, SAB]);
    expect(plan.map((d) => d.fecha)).toEqual([JUE, SAB, DOM]);
  });

  it('lista vacía → plan vacío', () => {
    expect(planDiasPorFormato('FINDE', [])).toEqual([]);
  });
});
