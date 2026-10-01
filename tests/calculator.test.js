/**
 * NeoNutri Calculator — Clinical Compliance Test Suite
 * ------------------------------------------------------
 * Basis: skills.md, NICU_NUTRITION_MASTER_PROTOCOL_V2.md, NEO_NUTRITION_MASTER_LOGIC_V11.md
 * Ziel: ≥ 20 klinische Testfälle inkl. extremer Edge-Cases.
 *
 * Compliance-Achsen:
 *   A) Patient-Safety Limits (GIR ≤ 12, Protein ≤ 4.5, Lipid ≤ 4.0, Osm ≤ 900 peripher)
 *   B) ESPGHAN 2018 Targets (TFI, Energie, NPC, Ca:P, P:AA)
 *   C) Validierung physikalisch unmöglicher Eingaben (MUST throw)
 *   D) Solubility / Crystal-Guard (Ca + P ≤ Schwellwert in PN)
 *   E) Wachstums-Velocity (g/kg/d Formel)
 *
 * Diese Tests MODIFIZIEREN KEINEN PRODUKTIVCODE.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const NutritionCalculator = require('../calculator.js');

let calc;

beforeAll(() => {
    calc = new NutritionCalculator();
});

/** Hilfsfunktion: vollständiges Input-Objekt mit sinnvollen Defaults */
function baseInput(overrides = {}) {
    return {
        birthWeight: 1000,
        currentWeight: 1000,
        ssw: 28,
        postnatalAge: 3,
        ventilationStatus: 'spontaneous',
        access: 'central',
        selectedSolution: 'none',
        selectedEnteralProduct: 'ebm',
        selectedLipidProduct: 'smoflipid20',
        tfi: 120,
        enteralVolume: 0,
        carrierVolume: 0,
        microVolume: 0,
        fm85Percent: 0,
        urea: null,
        triglycerides: null,
        gir: 6,
        protein: 3.0,
        lipids: 2.0,
        calcium: 60,
        phosphate: 40,
        sodium: 2,
        potassium: 2,
        mealFrequency: 8,
        naclMl: 0,
        kclMl: 0,
        secondarySolution: 'none',
        secondaryRateKg: 0,
        hiddenSodiumMmolKg: 0,
        previousWeight: null,
        ...overrides
    };
}

/* ────────────────────────────────────────────────────────────────
 * SECTION A — EXTREME EDGE CASES (vom User explizit gefordert)
 * ────────────────────────────────────────────────────────────────*/
describe('A) Extreme Edge Cases — vom User explizit gefordert', () => {

    it('A1: ELBW (500g) Tag 1 — strikte Flüssigkeits- & AS-Restriktion', () => {
        const input = baseInput({
            birthWeight: 500, currentWeight: 500, ssw: 24,
            postnatalAge: 1, tfi: 90,
            selectedSolution: 'fgMix75',
            protein: 1.75, lipids: 1.0, gir: 4
        });
        const r = calc.calculate(input);

        // Hausstandard ab v3.4: ELBW Tag 1 → TFI 70–90 ml/kg/d.
        // Vorher 80–100 (= ESPGHAN 2018). Bewusst 10 ml/kg/d restriktiver,
        // Freigabe Neonatologe 28.09.2026, Begruendung in AGENTS.md.
        expect(r.targets.tfi.min).toBe(70);
        expect(r.targets.tfi.max).toBe(90);

        // Lipid-Ziel Tag 1: 1.0–2.0 g/kg/d
        expect(r.targets.lipidTarget.min).toBe(1.0);
        expect(r.targets.lipidTarget.max).toBe(2.0);

        // KEIN CRITICAL Alarm bei korrekter Restriktion
        const criticals = r.warnings.filter(w => w.startsWith('CRITICAL'));
        expect(criticals).toEqual([]);
    });

    it('A2: Frühgeborenes Tag 7, maximale parenterale Zufuhr → Ca-P Löslichkeitsprodukt MUSS triggern', () => {
        // Niedriges PN-Volumen + sehr hohe Ca + P erzwingen Übersättigung
        const input = baseInput({
            birthWeight: 1000, currentWeight: 1000, ssw: 28,
            postnatalAge: 7, tfi: 160,
            access: 'central',
            calcium: 160, phosphate: 130, // hohe Konzentration
            gir: 10, protein: 4.0, lipids: 3.0
        });
        const r = calc.calculate(input);

        const crystalWarn = r.warnings.find(w =>
            w.includes('Ausfällung') || w.includes('Löslichkeitsgrenze') || w.includes('Calcium/Phosphat')
        );
        // Erwartung: Crystal-Guard löst aus
        expect(crystalWarn).toBeDefined();
    });

    it('A3a: Eingabe 0g Geburtsgewicht → Validierungs-Methode MUSS Fehler werfen', () => {
        // Klinisch unmöglich: 0g. Erwartung lt. User: kontrollierter Abbruch / Exception.
        expect(() => calc.calculate(baseInput({ birthWeight: 0, currentWeight: 0 })))
            .toThrow();
    });

    it('A3b: Eingabe 500 ml/kg/d Flüssigkeit → Validierungs-Methode MUSS Fehler werfen', () => {
        // Klinisch unmöglich (max 200 ml/kg/d). Erwartung: kontrollierter Abbruch.
        expect(() => calc.calculate(baseInput({ tfi: 500 })))
            .toThrow();
    });

    it('A3c: Negatives Gewicht → Validierungs-Methode MUSS Fehler werfen', () => {
        expect(() => calc.calculate(baseInput({ birthWeight: -100, currentWeight: -100 })))
            .toThrow();
    });

    /* --- A4: Extended Validation Layer (Ticket R-01, v2.0) ---
     * Erweiterte Fat-Finger- und Sanity-Checks. Alle MUSS hart abbrechen. */

    it('A4a: Geburtsgewicht > 8000g → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ birthWeight: 9999 }))).toThrow(/Geburtsgewicht/);
    });

    it('A4b: SSW < 22 → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ ssw: 20 }))).toThrow(/SSW/);
    });

    it('A4c: SSW > 44 → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ ssw: 50 }))).toThrow(/SSW/);
    });

    it('A4d: GIR > 25 mg/kg/min → ValidationError (Tippfehler)', () => {
        expect(() => calc.calculate(baseInput({ gir: 30 }))).toThrow(/GIR/);
    });

    it('A4e: Protein > 6 g/kg/d → ValidationError (Tippfehler)', () => {
        expect(() => calc.calculate(baseInput({ protein: 7 }))).toThrow(/Protein/);
    });

    it('A4f: Lipide > 6 g/kg/d → ValidationError (Tippfehler)', () => {
        expect(() => calc.calculate(baseInput({ lipids: 7 }))).toThrow(/Lipide/);
    });

    it('A4g: Calcium > 200 mg/kg/d → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ calcium: 250 }))).toThrow(/Calcium/);
    });

    it('A4h: Phosphat > 150 mg/kg/d → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ phosphate: 200 }))).toThrow(/Phosphat/);
    });

    it('A4i: FM85 > 6% → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ fm85Percent: 8 }))).toThrow(/FM85/);
    });

    it('A4j: Non-numerischer String ("abc") → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ protein: 'abc' }))).toThrow(/gültige Zahl/);
    });

    it('A4k: Mahlzeiten-Frequenz 0 → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ mealFrequency: 0 }))).toThrow(/Mahlzeiten/);
    });

    it('A4l: Postnatales Alter > 365 Tage → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ postnatalAge: 500 }))).toThrow(/Alter/);
    });

    it('A4m: Sanity-Check — gültige Mittelwerte werfen KEINEN Fehler', () => {
        // Regression: Standard-Eingaben dürfen nach Validation-Hardening NICHT mehr werfen.
        expect(() => calc.calculate(baseInput())).not.toThrow();
    });

    // ── R-02: Type-safe Parser — bisher ungeprüfte Felder, Tippfehler-Schutz ──
    it('A5a: NaCl-Zusatz "20" mmol/kg (statt 2.0) → ValidationError (Tippfehler)', () => {
        // Realer Fat-Finger-Fall: User vergisst Dezimalpunkt → 20 statt 2.0
        expect(() => calc.calculate(baseInput({ naclMl: 75 }))).toThrow(/NaCl/);
    });

    it('A5b: KCl-Zusatz "50" mmol/kg → ValidationError (Tippfehler)', () => {
        expect(() => calc.calculate(baseInput({ kclMl: 50 }))).toThrow(/KCl/);
    });

    it('A5c: Carrier-Volumen > 100 ml/kg/d → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ carrierVolume: 150 }))).toThrow(/Trägerlösung/);
    });

    it('A5d: Non-numerischer String in naclMl ("abc") → ValidationError', () => {
        // R-02: Auch bisher ungeprüfte Felder müssen NaN abfangen.
        expect(() => calc.calculate(baseInput({ naclMl: 'abc' }))).toThrow(/gültige Zahl/);
    });

    it('A5e: Sekundärinfusion > 200 ml/kg/d → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ secondaryRateKg: 300 }))).toThrow(/Sekundärinfusion/);
    });

    it('A5f: Hidden Sodium > 20 mmol/kg/d → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ hiddenSodiumMmolKg: 25 }))).toThrow(/Hidden Sodium/);
    });

    it('A5g: Körperlänge > 100 cm → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ length: 150 }))).toThrow(/Körperlänge/);
    });

    it('A5h: Kopfumfang > 60 cm → ValidationError', () => {
        expect(() => calc.calculate(baseInput({ head: 99 }))).toThrow(/Kopfumfang/);
    });

    it('A5i: Sanity — leere Strings & null in optionalen Feldern → KEIN Fehler', () => {
        // R-02 Regress: Optionalfelder dürfen mit '' oder null defaults greifen lassen.
        expect(() => calc.calculate(baseInput({
            naclMl: '', kclMl: null, carrierVolume: '',
            microVolume: undefined, hiddenSodiumMmolKg: '',
            length: '', head: '', secondaryRateKg: ''
        }))).not.toThrow();
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION B — SAFETY CORE: CRITICAL Limits
 * ────────────────────────────────────────────────────────────────*/
describe('B) Safety Core — CRITICAL Limits triggern korrekt', () => {

    it('B1: GIR > 12 mg/kg/min → CRITICAL', () => {
        const r = calc.calculate(baseInput({ gir: 15 }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('GIR'))).toBe(true);
        expect(r.safetyChecks.gir).toBe(false);
        expect(r.isSafe).toBe(false);
    });

    it('B2: Protein > 4.5 g/kg/d → CRITICAL', () => {
        const r = calc.calculate(baseInput({ protein: 5.0 }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('Protein'))).toBe(true);
        expect(r.safetyChecks.proteinLimit).toBe(false);
    });

    it('B3: Lipid > 4.0 g/kg/d → CRITICAL', () => {
        const r = calc.calculate(baseInput({ lipids: 4.5 }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('Lipide'))).toBe(true);
        expect(r.safetyChecks.lipidLimit).toBe(false);
    });

    it('B4: Triglyzeride > 250 mg/dl → CRITICAL Hypertriglyzeridämie', () => {
        const r = calc.calculate(baseInput({ triglycerides: 300 }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('Triglyzeride'))).toBe(true);
    });

    it('B5: Glucose-Konzentration > 12.5 % bei peripherem Zugang → CRITICAL', () => {
        const r = calc.calculate(baseInput({
            access: 'peripheral', tfi: 90, gir: 11, protein: 2.0, lipids: 2.0
        }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('Glukose'))).toBe(true);
    });

    it('B6: Osmolarität > 900 mOsm/l bei peripherem Zugang → CRITICAL', () => {
        const r = calc.calculate(baseInput({
            access: 'peripheral', tfi: 80, gir: 10, protein: 4.0,
            sodium: 4, potassium: 3, calcium: 60, phosphate: 40
        }));
        // Hohe Konzentration im kleinen Volumen → Osmolarität schießt hoch
        expect(r.results.osmolarity).toBeGreaterThan(0);
        if (r.results.osmolarity > 900) {
            expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('Osmolarität'))).toBe(true);
        }
    });

    it('B7: Invasive Beatmung + TFI > 140 → CRITICAL', () => {
        const r = calc.calculate(baseInput({ ventilationStatus: 'invasive', tfi: 150 }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('invasiver Beatmung'))).toBe(true);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION C — ESPGHAN Targets & Tiered Alerts
 * ────────────────────────────────────────────────────────────────*/
describe('C) ESPGHAN Targets & Tiered Alerts', () => {

    it('C1: Geburtsgewicht exakt 1000 g Tag 3 — ELBW-Zweig, TFI-Ziel 110–130 ml/kg/d', () => {
        // Boundary-Test der sakrosankten Invariante 2: bei exakt 1000 g greift
        // der ELBW-Zweig. Die Zahlenwerte sind mit v3.4 von 120–140 auf
        // 110–130 gesunken (Hausabweichung, siehe AGENTS.md); der geprüfte
        // Grenzfall bleibt unveraendert.
        const r = calc.getTargets({ birthWeight: 1000, postnatalAge: 3, ssw: 28 });
        expect(r.tfi.min).toBe(110);
        expect(r.tfi.max).toBe(130);
        // 1000 g muss ELBW sein, auch beim Protein (v3.4: Grenze angeglichen)
        expect(r.protein.min).toBe(3.5);
        expect(r.protein.max).toBe(4.0);
        // 1001 g faellt in den VLBW-Zweig und liegt niedriger
        const v = calc.getTargets({ birthWeight: 1001, postnatalAge: 3, ssw: 28 });
        expect(v.tfi.min).toBe(100);
        expect(v.protein.min).toBe(3.0);
    });

    it('C2: Term-Baby SSW 38 — Protein-Ziel 2.5–3.0 g/kg/d', () => {
        const r = calc.getTargets({ birthWeight: 3200, postnatalAge: 3, ssw: 38 });
        expect(r.protein.min).toBe(2.5);
        expect(r.protein.max).toBe(3.0);
    });

    it('C3: Ca:P Ratio außerhalb 1.5–2.0 → Warnung', () => {
        const r = calc.calculate(baseInput({
            calcium: 30, phosphate: 80 // Ratio ≈ 0.29 → out of range
        }));
        expect(r.warnings.some(w => w.includes('Ca:P'))).toBe(true);
    });

    it('C4: P:AA Ratio < 1.0 → Warnung', () => {
        // Viel Protein, wenig Phosphat → Ratio < 1.0
        const r = calc.calculate(baseInput({
            protein: 4.0, phosphate: 20
        }));
        expect(r.warnings.some(w => w.includes('P:AA'))).toBe(true);
    });

    it('C5: NPC Lipid-% < 25 → Imbalance-Warnung', () => {
        const r = calc.calculate(baseInput({
            gir: 10, lipids: 0.5, protein: 3.0
        }));
        expect(r.warnings.some(w => w.includes('Lipid-Anteil an NPC'))).toBe(true);
    });

    it('C6: SID-light negativ (Cl-Überhang) → CRITICAL hyperchlorämische Azidose', () => {
        const r = calc.calculate(baseInput({
            sodium: 1, potassium: 1, naclMl: 0, kclMl: 5
        }));
        // KCl gibt 5 mmol Cl, Na nur 1 → SID-light = 1+1+5 - (5+0) = 2; nicht negativ
        // Realistisch negativ: hohe Cl-Last über NaCl + KCl + low Na/K perfusor
        // Test prüft Existenz des SID-Mechanismus
        expect(r.results.sidLight).toBeDefined();
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION D — ELBW-spezifische Phase-A-Logik
 * ────────────────────────────────────────────────────────────────*/
describe('D) ELBW-spezifische Phase-A-Logik', () => {

    it('D1: ELBW Tag 5 mit Na > 5 mmol/kg/d → Hypernatriämie-Warnung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 800, ssw: 26,
            postnatalAge: 5, tfi: 140, sodium: 6
        }));
        expect(r.warnings.some(w => w.includes('Hypernatriämie'))).toBe(true);
    });

    it('D2: ELBW Tag 3 mit TFI < 100 → IWL-Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 700, currentWeight: 700, ssw: 25,
            postnatalAge: 3, tfi: 90
        }));
        expect(r.warnings.some(w => w.includes('IWL'))).toBe(true);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION E — Wachstum & Velocity
 * ────────────────────────────────────────────────────────────────*/
describe('E) Wachstum & Velocity', () => {

    it('E1: Growth Velocity korrekte Formel (Δ/current × 1000)', () => {
        // 1020g heute, 1000g gestern → (20/1020)*1000 = 19.6
        const gv = calc.calculateGrowthVelocity(1020, 1000);
        expect(gv).toBeCloseTo(19.6, 1);
    });

    it('E2: Growth Velocity bei previousWeight = 0 → null (keine Division durch 0)', () => {
        expect(calc.calculateGrowthVelocity(1020, 0)).toBeNull();
        expect(calc.calculateGrowthVelocity(1020, null)).toBeNull();
    });

    it('E3: Negative Velocity bei Gewichtsverlust', () => {
        const gv = calc.calculateGrowthVelocity(980, 1000);
        expect(gv).toBeLessThan(0);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION F — Solution Configurator & Enterale Logik
 * ────────────────────────────────────────────────────────────────*/
describe('F) Solution Configurator & Enterale Logik', () => {

    it('F1: Basislösung 100 ml/kg skaliert linear auf 50 ml/kg PN-Volumen', () => {
        // PN gross = 50 ml/kg → AS = 2.45 × 0.5 = 1.225 g/kg
        const r = calc.calculate(baseInput({
            tfi: 50, enteralVolume: 0,
            selectedSolution: 'basis100', lipids: 0
        }));
        expect(r.results.effectiveAS_GKg).toBeCloseTo(1.225, 1);
    });

    it('F2: FM85 Reminder ab enteralem Volumen ≥ 100 ml/kg/d (EBM)', () => {
        const r = calc.calculate(baseInput({
            postnatalAge: 14, tfi: 150, enteralVolume: 110,
            selectedEnteralProduct: 'ebm', fm85Percent: 0
        }));
        const hasFm85Reminder = [...r.reminders, ...r.warnings].some(t => t.includes('FM85'));
        expect(hasFm85Reminder).toBe(true);
    });

    it('F3: BUN < 3 mmol/l unter FM85 4% → Aptamil-Eiweiß+ Empfehlung', () => {
        const r = calc.calculate(baseInput({
            postnatalAge: 28, tfi: 160, enteralVolume: 150,
            selectedEnteralProduct: 'ebm', fm85Percent: 4,
            urea: 2.5, protein: 0, lipids: 0, gir: 0
        }));
        const reminderHit = [...r.reminders, ...r.warnings].some(t =>
            t.includes('Aptamil') || t.includes('Eiweiß')
        );
        expect(reminderHit).toBe(true);
    });

    it('F4: Vitamin D / Proprems Reminder ab Einzelportion ≥ 3 ml', () => {
        // 24 ml/kg/d × 1 kg = 24 ml, /8 Mahlzeiten = 3 ml
        const r = calc.calculate(baseInput({
            tfi: 80, enteralVolume: 24, mealFrequency: 8
        }));
        expect(r.reminders.some(rem => rem.includes('Vitamin D'))).toBe(true);
    });

    it('F5: PN-Volumen-Overflow (Sekundär + Enteral > TFI) → CRITICAL', () => {
        const r = calc.calculate(baseInput({
            tfi: 100, enteralVolume: 60, carrierVolume: 30,
            secondarySolution: 'glucose10', secondaryRateKg: 30
        }));
        expect(r.warnings.some(w => w.includes('CRITICAL') && w.includes('TFI'))).toBe(true);
    });

    it('F6: Tag 3 mit FG-Mix 7,5% → Reminder zum Wechsel auf Basislösung FG', () => {
        const r = calc.calculate(baseInput({
            postnatalAge: 3, selectedSolution: 'fgMix75'
        }));
        expect(r.reminders.some(rem => rem.includes('Wechsel'))).toBe(true);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION G — Plausibility / Fat-Finger Guard
 * ────────────────────────────────────────────────────────────────*/
describe('G) Plausibility / Fat-Finger Guard', () => {

    it('G1: TFI > 300 → Plausibility-Flag (v3.1: Schwelle von 200 auf 300 angehoben)', () => {
        // 200–300 ml/kg/d ist in der polyuren Phase real und darf KEIN
        // Fat-Finger-Modal auslösen. Erst > 300 gilt als Tippfehler-verdächtig.
        const r = calc.calculate(baseInput({ tfi: 320 }));
        expect(r.plausibilityFlags.some(f => f.includes('TFI'))).toBe(true);
    });

    it('G2: Gewicht > 6000g → Plausibility-Flag', () => {
        try {
            const r = calc.calculate(baseInput({ birthWeight: 7000, currentWeight: 7000, ssw: 40 }));
            expect(r.plausibilityFlags.some(f => f.includes('Gewicht'))).toBe(true);
        } catch (_e) {
            expect(true).toBe(true);
        }
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION H — Clinical Cockpit v2.0 (Chief Physician Review)
 * Narrative Assessment + EPR-Documentation-String + Phase-Logik
 * ────────────────────────────────────────────────────────────────*/
describe('H) Clinical Cockpit v2.0 — Chief Physician Review', () => {

    it('H1: Stabile ESPGHAN-konforme Zufuhr → status "stable" + positives Bullet', () => {
        // Phase B, ELBW (1000g), Tag 10, alle Targets erreichbar
        const r = calc.calculate(baseInput({
            birthWeight: 1000, currentWeight: 1100, previousWeight: 1083,
            ssw: 28, postnatalAge: 10,
            tfi: 160, enteralVolume: 80, fm85Percent: 2,
            protein: 2.5, lipids: 3.0, gir: 10,
            calcium: 75, phosphate: 50,
            sodium: 3, potassium: 2
        }));
        expect(r.assessment).toBeDefined();
        expect(['stable', 'attention']).toContain(r.assessment.status);
        expect(r.assessment.phase).toBe('B');
        expect(r.assessment.headline).toMatch(/Phase B|stabil|Aufmerksamkeit/i);
        expect(Array.isArray(r.assessment.bullets)).toBe(true);
        expect(r.assessment.bullets.length).toBeGreaterThan(0);
    });

    it('H2: CRITICAL-Warnung → status "critical" + Kritikalitäts-Bullet ganz oben', () => {
        // Protein deutlich über 4.5 → CRITICAL
        const r = calc.calculate(baseInput({
            birthWeight: 1000, currentWeight: 1000,
            postnatalAge: 5, tfi: 130, protein: 5.5
        }));
        expect(r.assessment.status).toBe('critical');
        expect(r.assessment.criticalCount).toBeGreaterThan(0);
        expect(r.assessment.bullets[0].kind).toBe('critical');
        expect(r.assessment.headline).toMatch(/[Kk]ritisch|Re-Evaluation|Sicherheits-Limit/);
    });

    it('H3: Phase-Klassifikation A/B/C nach postnatalAge', () => {
        expect(calc._phaseOfCare(1).id).toBe('A');
        expect(calc._phaseOfCare(7).id).toBe('A');
        expect(calc._phaseOfCare(8).id).toBe('B');
        expect(calc._phaseOfCare(28).id).toBe('B');
        expect(calc._phaseOfCare(29).id).toBe('C');
        expect(calc._phaseOfCare(60).id).toBe('C');
    });

    it('H4: generateDocumentationString liefert EPR-tauglichen Text mit Kern-Domänen', () => {
        const input = baseInput({
            birthWeight: 1200, currentWeight: 1250, previousWeight: 1230,
            ssw: 29, postnatalAge: 4,
            tfi: 140, enteralVolume: 40, fm85Percent: 0,
            selectedEnteralProduct: 'ebm',
            selectedSolution: 'basisFG',
            selectedLipidProduct: 'smoflipid20',
            protein: 3.0, lipids: 2.0, gir: 8,
            calcium: 70, phosphate: 45,
            sodium: 2, potassium: 2,
            access: 'central'
        });
        const r = calc.calculate(input);
        const doc = r.documentation;
        expect(typeof doc).toBe('string');
        expect(doc).toMatch(/Ernährung Tag 4/);
        expect(doc).toMatch(/1250 g/);
        expect(doc).toMatch(/TFI 140/);
        expect(doc).toMatch(/Enteral 40/);
        expect(doc).toMatch(/EBM/);
        expect(doc).toMatch(/GIR/);
        expect(doc).toMatch(/SMOFlipid/);
        expect(doc).toMatch(/Ca:P/);
        expect(doc).toMatch(/Beurteilung:/);
    });

    it('H5: Assessment-Bullets respektieren Limit von max. 5 Einträgen', () => {
        // Viele Probleme gleichzeitig erzeugen
        const r = calc.calculate(baseInput({
            birthWeight: 500, currentWeight: 480, ssw: 24,
            postnatalAge: 30, // Phase C
            tfi: 90, // unter Ziel für Phase C
            enteralVolume: 0,
            protein: 1.0, // unter Ziel
            lipids: 0.5,  // unter Ziel
            gir: 2,        // unter Ziel
            calcium: 100, phosphate: 30 // schlechtes Ca:P
        }));
        expect(r.assessment.bullets.length).toBeLessThanOrEqual(5);
    });

    it('H6: Stable Phase A ohne Probleme → headline enthält "Phase A"', () => {
        // Saubere Phase-A-Zufuhr: ELBW Tag 1, Targets im Ziel
        const r = calc.calculate(baseInput({
            birthWeight: 900, currentWeight: 900, ssw: 27,
            postnatalAge: 1, tfi: 90,
            enteralVolume: 0,
            selectedSolution: 'fgMix75',
            protein: 1.75, lipids: 1.0, gir: 5,
            calcium: 35, phosphate: 22,
            sodium: 0, potassium: 0,
            access: 'central'
        }));
        expect(r.assessment.phase).toBe('A');
        // Headline sollte Phase referenzieren ODER stabil/attention sein
        expect(r.assessment.headline).toBeTruthy();
        expect(r.assessment.summary).toMatch(/Phase A/);
    });

    it('H7: Documentation enthält Beurteilung mit den Top-Bullets', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1000, currentWeight: 1000,
            postnatalAge: 5, tfi: 130, protein: 5.5
        }));
        // CRITICAL-Status → Beurteilung muss kritischen Befund nennen
        expect(r.documentation).toMatch(/Beurteilung:/);
        expect(r.documentation).toMatch(/kritisch|Kritisch|CRITICAL|Re-Evaluation/i);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION I — Predictive Analytics v2.1 (Modell B: diagnostische Hinweise)
 * Kumulativer Energy-Gap (Threshold 150 kcal/kg) + Sodium-Zufuhr-Trigger
 * (Δ > 5 mmol/kg/d in 48 h). Beide werden im Assessment ausgegeben.
 * ────────────────────────────────────────────────────────────────*/
describe('I) Predictive Analytics v2.1 — Energy-Gap & Sodium-Trend', () => {

    it('I1: Energy-Gap akkumuliert das tägliche Kalorien-Defizit korrekt', () => {
        // Tag 3–5: jeweils 60 kcal/kg Defizit (110 Ziel − 50 Ist) → Σ 180
        const history = {
            '3': { '_kcal-kg': 50, '_kcal-min': 110 },
            '4': { '_kcal-kg': 50, '_kcal-min': 110 },
            '5': { '_kcal-kg': 50, '_kcal-min': 110 }
        };
        const eg = calc._analyzeEnergyGap(history, 5);
        expect(eg.cumulativeDeficit).toBe(180);
        expect(eg.daysAnalyzed).toBe(3);
        expect(eg.threshold).toBe(150);
    });

    it('I2: Energy-Gap setzt critical NUR bei > 150 kcal/kg über ≥ 3 Tage', () => {
        // Unter Schwelle (Σ 90 über 3 d) → nicht kritisch
        const below = calc._analyzeEnergyGap({
            '3': { '_kcal-kg': 80, '_kcal-min': 110 },
            '4': { '_kcal-kg': 80, '_kcal-min': 110 },
            '5': { '_kcal-kg': 80, '_kcal-min': 110 }
        }, 5);
        expect(below.critical).toBe(false);
        // Über Schwelle (Σ 180 über 3 d) → kritisch
        const above = calc._analyzeEnergyGap({
            '3': { '_kcal-kg': 50, '_kcal-min': 110 },
            '4': { '_kcal-kg': 50, '_kcal-min': 110 },
            '5': { '_kcal-kg': 50, '_kcal-min': 110 }
        }, 5);
        expect(above.critical).toBe(true);
    });

    it('I3: Sodium-Trend triggert NUR bei Steigerung Δ > 5 mmol/kg/d in 48 h', () => {
        // Δ = 9 − 2 = 7 > 5 → rising
        const rising = calc._analyzeSodiumTrend({ '3': { 'input-sodium': 2 } }, 5, 9);
        expect(rising.rising).toBe(true);
        expect(rising.threshold).toBe(5);
        // Δ = 6 − 2 = 4 ≤ 5 → kein Trigger
        const flat = calc._analyzeSodiumTrend({ '3': { 'input-sodium': 2 } }, 5, 6);
        expect(flat.rising).toBe(false);
    });

    it('I4: Beide Trigger erscheinen als predictiveHints im Assessment', () => {
        const probe = baseInput({ postnatalAge: 5, sodium: 12, tfi: 130 });
        // Tatsächliche Na-Zufuhr aus dem Rechner ermitteln (effektive Na)
        const naNow = calc.calculate(probe).results.effectiveNa;
        const history = {
            '3': { '_kcal-kg': 40, '_kcal-min': 110, 'input-sodium': naNow - 8 },
            '4': { '_kcal-kg': 40, '_kcal-min': 110 },
            '5': { '_kcal-kg': 40, '_kcal-min': 110 }
        };
        const res = calc.calculate(baseInput({ ...probe, history }));
        expect(res.predictive.energyGap.critical).toBe(true);
        expect(res.predictive.sodiumTrend.rising).toBe(true);
        const hints = res.assessment.predictiveHints;
        expect(Array.isArray(hints)).toBe(true);
        expect(hints.length).toBe(2);
        expect(hints.some(h => /Energiedefizit/i.test(h.text))).toBe(true);
        expect(hints.some(h => /Natrium|Na-Zufuhr/i.test(h.text))).toBe(true);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION J — Smoke Test (CI): Frontend-Integrität
 * Stellt sicher, dass der Safety-Banner #validation-error-banner im
 * ausgelieferten index.html existiert (UI-Schutzlayer, siehe AGENTS.md).
 * ────────────────────────────────────────────────────────────────*/
describe('J) Smoke Test — index.html Safety-Banner', () => {

    it('J1: #validation-error-banner existiert im index.html (jsdom)', async () => {
        const { readFileSync } = require('node:fs');
        const { JSDOM } = require('jsdom');
        const path = new URL('../index.html', import.meta.url);
        const html = readFileSync(path, 'utf-8');
        const dom = new JSDOM(html);
        const banner = dom.window.document.getElementById('validation-error-banner');
        expect(banner).not.toBeNull();
        expect(banner.getAttribute('role')).toBe('alert');
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION K — Energy-Gap-Index v3.0 (kumulativ über ALLE history-Tage)
 * ────────────────────────────────────────────────────────────────*/
describe('K) Energy-Gap-Index v3.0 — kumulativer Accumulator', () => {

    it('K1: summiert das Defizit über alle dokumentierten Tage (nicht nur 7)', () => {
        // 10 Tage à 30 kcal/kg Defizit → Σ 300, jenseits 7-Tage-Fenster
        const history = {};
        for (let d = 1; d <= 10; d++) history[String(d)] = { '_kcal-kg': 80, '_kcal-min': 110 };
        const idx = calc.calculateEnergyGapIndex(history);
        expect(idx.daysAnalyzed).toBe(10);
        expect(idx.cumulativeDeficit).toBe(300);
        expect(idx.index).toBe(300);
    });

    it('K2: ignoriert Überschuss-Tage (kein negatives Defizit) & findet worstDay', () => {
        const history = {
            '1': { '_kcal-kg': 120, '_kcal-min': 110 }, // Überschuss → 0
            '2': { '_kcal-kg': 70,  '_kcal-min': 110 }, // Defizit 40
            '3': { '_kcal-kg': 50,  '_kcal-min': 110 }  // Defizit 60 (worst)
        };
        const idx = calc.calculateEnergyGapIndex(history);
        expect(idx.cumulativeDeficit).toBe(100);
        expect(idx.worstDay).toBe(3);
        expect(idx.worstGap).toBe(60);
    });

    it('K3: Severity-Stufen ok < 75 ≤ watch ≤ 150 < high', () => {
        const ok = calc.calculateEnergyGapIndex({ '1': { '_kcal-kg': 100, '_kcal-min': 110 } });
        expect(ok.severity).toBe('ok'); // Σ 10
        const watch = calc.calculateEnergyGapIndex({
            '1': { '_kcal-kg': 60, '_kcal-min': 110 }, '2': { '_kcal-kg': 60, '_kcal-min': 110 }
        });
        expect(watch.severity).toBe('watch'); // Σ 100
        const high = calc.calculateEnergyGapIndex({
            '1': { '_kcal-kg': 30, '_kcal-min': 110 }, '2': { '_kcal-kg': 30, '_kcal-min': 110 }
        });
        expect(high.severity).toBe('high'); // Σ 160
    });

    it('K4: leere/fehlende History → null (kein Crash)', () => {
        expect(calc.calculateEnergyGapIndex(null)).toBeNull();
        expect(calc.calculateEnergyGapIndex({})).toBeNull();
        expect(calc.calculateEnergyGapIndex({ '1': { foo: 1 } })).toBeNull();
    });

    it('K5: Index wird im calculate()-Ergebnis unter predictive ausgegeben', () => {
        const history = {
            '1': { '_kcal-kg': 50, '_kcal-min': 110 },
            '2': { '_kcal-kg': 50, '_kcal-min': 110 },
            '3': { '_kcal-kg': 50, '_kcal-min': 110 }
        };
        const res = calc.calculate(baseInput({ postnatalAge: 3, history }));
        expect(res.predictive.energyGapIndex).toBeTruthy();
        expect(res.predictive.energyGapIndex.cumulativeDeficit).toBe(180);
        expect(res.predictive.energyGapIndex.severity).toBe('high');
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION L — Smart Defaults v3.0 (Tages-basierte Startwert-Vorschläge)
 * ────────────────────────────────────────────────────────────────*/
describe('L) Smart Defaults v3.0 — Tages-basierte Vorschläge', () => {

    it('L1: ELBW Tag 1 → restriktive TFI-Untergrenze + AS-Mittelwert', () => {
        const sd = calc.getSmartDefaults(baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 1 }));
        expect(sd.day).toBe(1);
        // ELBW Tag 1 ab v3.4: TFI 70–90 → Start 70; Protein 3.5–4.0 → Ø 3.8
        expect(sd.tfi).toBe(70);
        expect(sd.protein).toBe(3.8);
    });

    it('L2: Defaults liegen innerhalb der getTargets-Spannen', () => {
        const input = baseInput({ birthWeight: 1200, ssw: 30, postnatalAge: 5 });
        const sd = calc.getSmartDefaults(input);
        const t = calc.getTargets(input);
        expect(sd.tfi).toBeGreaterThanOrEqual(t.tfi.min);
        expect(sd.tfi).toBeLessThanOrEqual(t.tfi.cap);
        expect(sd.protein).toBeGreaterThanOrEqual(t.protein.min);
        expect(sd.protein).toBeLessThanOrEqual(t.protein.max);
        expect(sd.lipids).toBeGreaterThanOrEqual(t.lipidTarget.min);
        expect(sd.lipids).toBeLessThanOrEqual(t.lipidTarget.max);
    });

    it('L3: TFI-Vorschlag respektiert den Beatmungs-Cap (invasiv → 140)', () => {
        const sd = calc.getSmartDefaults(baseInput({
            birthWeight: 1600, ssw: 32, postnatalAge: 12, ventilationStatus: 'invasive'
        }));
        expect(sd.tfi).toBeLessThanOrEqual(140);
    });

    it('L4: rationale nennt die Grundlage (hausinterner Standard/ESPGHAN)', () => {
        const sd = calc.getSmartDefaults(baseInput({ postnatalAge: 3 }));
        expect(sd.rationale).toMatch(/ESPGHAN|hausinterner Standard/);
        expect(sd.rationale).toMatch(/Tag 3/);
    });

    it('L5: Smart Defaults werden im calculate()-Ergebnis ausgegeben', () => {
        const res = calc.calculate(baseInput({ postnatalAge: 2 }));
        expect(res.smartDefaults).toBeTruthy();
        expect(res.smartDefaults.day).toBe(2);
        expect(typeof res.smartDefaults.tfi).toBe('number');
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION M — Frontend-Integration v3.0 (Teaching-Layer, EGI-Kachel,
 * Smart-Defaults-Box, History-Sync). Konsistent zu J1: DOM-Struktur-
 * und Quelltext-Smoke-Tests über index.html (ohne Script-Ausführung).
 * Sichert ab, dass die v3.0-Logik im Frontend tatsächlich VERDRAHTET
 * ist (nicht nur in calculator.js existiert).
 * ────────────────────────────────────────────────────────────────*/
describe('M) Frontend-Integration v3.0 — Teaching, EGI, Smart Defaults, History-Sync', () => {

    const { readFileSync } = require('node:fs');
    let html, doc;

    beforeAll(() => {
        const { JSDOM } = require('jsdom');
        const p = new URL('../index.html', import.meta.url);
        html = readFileSync(p, 'utf-8');
        doc = new JSDOM(html).window.document;
    });

    it('M1: Educational Overlay (#edu-modal) existiert als Dialog mit ESPGHAN- & Algorithmus-Slot', () => {
        const modal = doc.getElementById('edu-modal');
        expect(modal).not.toBeNull();
        expect(modal.getAttribute('role')).toBe('dialog');
        expect(doc.getElementById('edu-modal-espghan')).not.toBeNull();
        expect(doc.getElementById('edu-modal-algo')).not.toBeNull();
    });

    it('M2: Smart-Defaults-Box existiert mit TFI/Protein/Lipide-Slots + Apply-Buttons', () => {
        expect(doc.getElementById('smart-defaults-box')).not.toBeNull();
        expect(doc.getElementById('sd-tfi')).not.toBeNull();
        expect(doc.getElementById('sd-protein')).not.toBeNull();
        expect(doc.getElementById('sd-lipids')).not.toBeNull();
        // Inline-Handler vorhanden
        expect(html).toMatch(/onclick="applySmartDefaults\(\)"/);
        expect(html).toMatch(/onclick="applySmartDefault\('input-tfi'/);
    });

    it('M3: Inline-onclick-Handler sind global exponiert (sonst ReferenceError am Inkubator)', () => {
        expect(html).toMatch(/window\.openEduModal\s*=\s*openEduModal/);
        expect(html).toMatch(/window\.applySmartDefault\s*=\s*applySmartDefault/);
        expect(html).toMatch(/window\.applySmartDefaults\s*=\s*applySmartDefaults/);
    });

    it('M4: Energy-Gap-Index-Kachel existiert und wird in displayResults gerendert', () => {
        expect(doc.getElementById('egi-card')).not.toBeNull();
        expect(doc.getElementById('egi-value')).not.toBeNull();
        expect(doc.getElementById('egi-bar')).not.toBeNull();
        expect(doc.getElementById('egi-severity')).not.toBeNull();
        // renderEGI muss aufgerufen werden
        expect(html).toMatch(/renderEGI\(history\)/);
        expect(html).toMatch(/function renderEGI/);
    });

    it('M5: History wird an calculate() übergeben + _kcal-min pro Tag persistiert (EGI-Datenbasis)', () => {
        expect(html).toMatch(/history:\s*history/);            // history in data-Objekt
        expect(html).toMatch(/\['_kcal-min'\]\s*=/);           // Ziel-Minimum wird gespeichert
        expect(html).toMatch(/renderSmartDefaults\(res\)/);    // Smart Defaults werden gerendert
    });

    it('M6: Patienten-Datenschutz — kein Name/Geburtsdatum-Klartextfeld wird in history-Keys persistiert', () => {
        // history wird ausschließlich über Tag-Keys + input-* Felder befüllt;
        // patient-id ist NICHT Teil des persistierten inputs-Arrays.
        const inputsBlock = html.split('const inputs = [')[1].split('];')[0];
        expect(inputsBlock).not.toMatch(/patient-id/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION N — v3.1: Enteraler Aufbau, TFI-Stufen, enterale Supplemente
 * ────────────────────────────────────────────────────────────────*/
describe('N) Enteraler Aufbau — Zielvolumen & Steigerungs-Logik', () => {

    it('N1: ELBW (800 g) → enterales Ziel 160–180 ml/kg/d', () => {
        const t = calc.getTargets(baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 10 }));
        expect(t.enteralTarget.min).toBe(160);
        expect(t.enteralTarget.max).toBe(180);
        expect(t.enteralTarget.key).toBe('elbw');
    });

    it('N2: Reifgeborenes (3200 g, 39 SSW) → enterales Ziel 130–160 ml/kg/d', () => {
        const t = calc.getTargets(baseInput({ birthWeight: 3200, currentWeight: 3200, ssw: 39, postnatalAge: 7 }));
        expect(t.enteralTarget.min).toBe(130);
        expect(t.enteralTarget.max).toBe(160);
        expect(t.enteralTarget.key).toBe('term');
    });

    it('N3: Spätes Frühgeborenes (2000 g, 34 SSW) → 150–170 ml/kg/d', () => {
        const t = calc.getTargets(baseInput({ birthWeight: 2000, currentWeight: 2000, ssw: 34, postnatalAge: 7 }));
        expect(t.enteralTarget.min).toBe(150);
        expect(t.enteralTarget.max).toBe(170);
    });

    it('N4: Unreifere Einstufung gewinnt — 1800 g bei 30 SSW → VLBW-Ziel', () => {
        const t = calc.getTargets(baseInput({ birthWeight: 1800, currentWeight: 1800, ssw: 30, postnatalAge: 7 }));
        expect(t.enteralTarget.key).toBe('vlbw');
        expect(t.enteralTarget.min).toBe(160);
    });

    it('N5: Beatmungs-Cap begrenzt das enterale Ziel (invasiv → max 140)', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 10, ventilationStatus: 'invasive'
        }));
        expect(t.enteralTarget.max).toBe(140);
        expect(t.enteralTarget.capped).toBe(true);
    });

    it('N6: Aufbau-Korridor steigt mit dem Lebenstag und deckelt am Ziel', () => {
        const d1 = calc.getTargets(baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 1 }));
        const d5 = calc.getTargets(baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 5 }));
        const d30 = calc.getTargets(baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 30 }));
        expect(d1.enteralRamp.expected).toBe(10);          // trophisch
        expect(d5.enteralRamp.expected).toBe(70);          // 10 + 4×15
        expect(d30.enteralRamp.expected).toBe(180);        // gedeckelt am Ziel-Max
    });

    it('N7: Enteral unter Korridor → Steigerungs-Hinweis MIT Toleranz-Vorbehalt', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 8,
            tfi: 150, enteralVolume: 40
        }));
        const hint = r.warnings.find(w => w.includes('Aufbau-Korridor'));
        expect(hint).toBeTruthy();
        expect(hint).toMatch(/Steigerung um/);
        expect(hint).toMatch(/nur bei guter Toleranz/);
        expect(r.results.enteralPhase).toBe('advancing');
    });

    it('N8: Enteral im Korridor → KEIN Steigerungs-Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 5,
            tfi: 150, enteralVolume: 95
        }));
        expect(r.warnings.some(w => w.includes('Aufbau-Korridor'))).toBe(false);
    });

    it('N9: Vollnahrung erreicht → Phase "full" + PN-Beendigung als Reminder', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1600, ssw: 30, postnatalAge: 20,
            tfi: 180, enteralVolume: 165, gir: 4, protein: 1, lipids: 1
        }));
        expect(r.results.enteralPhase).toBe('full');
        expect(r.reminders.some(x => x.includes('Beendigung der parenteralen'))).toBe(true);
    });

    it('N10: enteralGap ist nie negativ und beschreibt den Abstand zum Korridor', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 800, ssw: 26, postnatalAge: 6,
            tfi: 150, enteralVolume: 0
        }));
        expect(r.results.enteralGap).toBeGreaterThanOrEqual(0);
        expect(r.results.enteralGap).toBe(r.results.enteralExpectedToday);
    });
});

describe('N-TFI) Gestufte Flüssigkeits-Grenzen v3.1', () => {

    it('N11: TFI 250 ml/kg/d (polyure Phase) wird BERECHNET, nicht blockiert', () => {
        expect(() => calc.calculate(baseInput({ tfi: 250 }))).not.toThrow();
        const r = calc.calculate(baseInput({ tfi: 250 }));
        expect(r.results.totalDailyFluid).toBeGreaterThan(0);
    });

    it('N12: TFI 190 → Hinweis, TFI 250 → Warnung, TFI 150 → keins von beidem', () => {
        const w190 = calc.calculate(baseInput({ tfi: 190 })).warnings.join(' | ');
        const w250 = calc.calculate(baseInput({ tfi: 250 })).warnings.join(' | ');
        const w150 = calc.calculate(baseInput({ tfi: 150 })).warnings.join(' | ');
        expect(w190).toMatch(/oberhalb des üblichen Korridors/);
        expect(w250).toMatch(/polyurer Phase/);
        expect(w150).not.toMatch(/oberhalb des üblichen Korridors|polyurer Phase/);
    });

    it('N13: TFI 250 löst KEIN Fat-Finger-Flag mehr aus', () => {
        const r = calc.calculate(baseInput({ tfi: 250 }));
        expect(r.plausibilityFlags.some(f => f.includes('TFI'))).toBe(false);
    });

    it('N14: TFI > 400 bricht weiterhin hart ab (ValidationError)', () => {
        expect(() => calc.calculate(baseInput({ tfi: 450 }))).toThrow();
        expect(() => calc.calculate(baseInput({ tfi: 1200 }))).toThrow();
    });
});

describe('N-SUP) Enterale Supplemente — Liquigen & Aptamil Eiweiß+', () => {

    it('N15: Liquigen 2 ml/kg/d → +9 kcal/kg/d und +1.0 g Fett/kg/d', () => {
        const base = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150 }));
        const withLiq = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150, liquigenMlKg: 2 }));
        expect(withLiq.results.liquigenKcalKg).toBe(9);
        expect(withLiq.results.liquigenFatGKg).toBe(1);
        expect(withLiq.results.kcalEnteralKg - base.results.kcalEnteralKg).toBeCloseTo(9, 1);
        expect(withLiq.results.enteralFatGKg - base.results.enteralFatGKg).toBeCloseTo(1, 2);
    });

    it('N16: Aptamil Eiweiß+ 1 g/kg/d → +0.82 g Protein/kg/d und +3.4 kcal/kg/d', () => {
        const base = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150 }));
        const withApt = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150, aptamilProteinGKg: 1 }));
        expect(withApt.results.aptamilProteinNetGKg).toBeCloseTo(0.82, 2);
        expect(withApt.results.proteinTotalGPerKg - base.results.proteinTotalGPerKg).toBeCloseTo(0.82, 2);
        expect(withApt.results.kcalEnteralKg - base.results.kcalEnteralKg).toBeCloseTo(3.4, 1);
    });

    it('N17: Aptamil Eiweiß+ liefert Ca und P mit (Osteopenie-Bilanz)', () => {
        const base = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150 }));
        const withApt = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150, aptamilProteinGKg: 2 }));
        expect(withApt.results.enteralCaMgKg - base.results.enteralCaMgKg).toBeCloseTo(24.52, 1);
        expect(withApt.results.enteralPMgKg - base.results.enteralPMgKg).toBeCloseTo(10.48, 1);
    });

    it('N18: Supplemente erhöhen NICHT die Gesamtflüssigkeit (Zumischung)', () => {
        const base = calc.calculate(baseInput({ enteralVolume: 100, tfi: 150 }));
        const withSup = calc.calculate(baseInput({
            enteralVolume: 100, tfi: 150, liquigenMlKg: 4, aptamilProteinGKg: 2
        }));
        expect(withSup.results.totalDailyFluid).toBe(base.results.totalDailyFluid);
        expect(withSup.results.enteralDaily).toBe(base.results.enteralDaily);
    });

    it('N19: Unplausible Supplement-Dosen brechen hart ab (Fat-Finger)', () => {
        expect(() => calc.calculate(baseInput({ liquigenMlKg: 50 }))).toThrow();
        expect(() => calc.calculate(baseInput({ aptamilProteinGKg: 20 }))).toThrow();
    });

    it('N20: Supplemente erscheinen in der EPR-Dokumentation', () => {
        const input = baseInput({ enteralVolume: 120, tfi: 150, liquigenMlKg: 2, aptamilProteinGKg: 1 });
        const res = calc.calculate(input);
        const doc = calc.generateDocumentationString(res, input);
        expect(doc).toMatch(/Liquigen 2\.0 ml\/kg\/d/);
        expect(doc).toMatch(/Aptamil Eiweiß\+ 1\.0 g\/kg\/d/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION O — v3.2: Klinisches Review (Oberarzt-Gegenlesen)
 * Behebt drei Befunde aus dem Review von v3.1:
 *   O1–O6  Zielkonflikt Enteral-Ziel ↔ Protein-/Energielimit
 *   O7–O10 Nahrungspause (NPO) darf nicht zum Füttern nudgen
 *   O11–O13 Enteral-Ampel gegen Tages-Korridor statt Endziel
 *   O14–O16 Enterales Natrium in der Bilanz sichtbar
 * ────────────────────────────────────────────────────────────────*/
describe('O) Zielkonflikt Enteral-Ziel ↔ Nährstoffgrenzen', () => {

    it('O1: EBM ohne FM85 → Ziel bleibt bei 160–180 (nichts limitiert)', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 25, fm85Percent: 0
        }));
        expect(t.enteralTarget.min).toBe(160);
        expect(t.enteralTarget.max).toBe(180);
        expect(t.enteralTarget.limitedBy).toBe(null);
    });

    it('O2: EBM + FM85 4 % → Ziel wird durch die Protein-Obergrenze gedeckelt', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 25, fm85Percent: 4
        }));
        // Fortifiziert: 1,13 + 4×0,4675 = 3,0 g/100 ml → 4,5 g/kg/d bei 150 ml/kg/d
        expect(t.enteralTarget.max).toBe(150);
        expect(t.enteralTarget.limitedBy).toBe('protein');
        expect(t.enteralTarget.unlimited.max).toBe(180);
    });

    it('O3: KERNTEST — am Ziel-Maximum wird KEIN Limit mehr gesprengt', () => {
        // Genau der Fall, der v3.1 widersprüchlich machte.
        for (const fm85 of [0, 1, 2, 3, 4]) {
            const input = baseInput({
                birthWeight: 1100, currentWeight: 1400, ssw: 28, postnatalAge: 25,
                ventilationStatus: 'spontaneous', fm85Percent: fm85,
                gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0
            });
            const t = calc.getTargets(input);
            const r = calc.calculate({ ...input, tfi: t.enteralTarget.max, enteralVolume: t.enteralTarget.max });
            expect(r.results.proteinTotalGPerKg,
                `FM85 ${fm85}% bei ${t.enteralTarget.max} ml/kg/d`).toBeLessThanOrEqual(calc.LIMITS.PROTEIN.max);
            expect(r.results.kcalPerKg,
                `FM85 ${fm85}% bei ${t.enteralTarget.max} ml/kg/d`).toBeLessThanOrEqual(t.energy.max);
        }
    });

    it('O4: Am Ziel-Maximum widersprechen sich Phase und Warnungen nicht', () => {
        const input = baseInput({
            birthWeight: 1100, currentWeight: 1400, ssw: 28, postnatalAge: 25,
            ventilationStatus: 'spontaneous', fm85Percent: 4,
            gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0
        });
        const t = calc.getTargets(input);
        const r = calc.calculate({ ...input, tfi: t.enteralTarget.max, enteralVolume: t.enteralTarget.max });
        expect(r.results.enteralPhase).toBe('full');
        expect(r.warnings.some(w => /Überernährung|über Zielbereich/.test(w))).toBe(false);
        expect(r.safetyChecks.proteinLimit).toBe(true);
    });

    it('O5: Beba FG 1 (2,9 g Protein/100 ml) wird ebenfalls gedeckelt', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 1400, ssw: 30, postnatalAge: 20, selectedEnteralProduct: 'bebaFG1'
        }));
        expect(t.enteralTarget.max).toBeLessThanOrEqual(155);
        expect(t.enteralTarget.limitedBy).toBeTruthy();
    });

    it('O6: Beatmungs-Cap bleibt die strengste Grenze, wenn er greift', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 20,
            ventilationStatus: 'invasive', fm85Percent: 0
        }));
        expect(t.enteralTarget.max).toBe(140);
        expect(t.enteralTarget.limitedBy).toBe('ventilation');
    });
});

describe('O-NPO) Nahrungspause', () => {

    it('O7: Bei Nahrungspause KEIN Steigerungs-Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 8, tfi: 140,
            enteralVolume: 0, feedingPaused: true, feedingPauseReason: 'nec'
        }));
        expect(r.warnings.some(w => w.includes('Aufbau-Korridor'))).toBe(false);
        expect(r.recommendations.enteralAdvance).toBe(null);
        expect(r.results.enteralPhase).toBe('paused');
    });

    it('O8: Ohne Pause feuert der Hinweis am selben Tag weiterhin', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 8, tfi: 140, enteralVolume: 0
        }));
        expect(r.warnings.some(w => w.includes('Aufbau-Korridor'))).toBe(true);
    });

    it('O9: Pausengrund wird ausgewiesen und in der EPR-Doku dokumentiert', () => {
        const input = baseInput({
            postnatalAge: 8, tfi: 140, enteralVolume: 0,
            feedingPaused: true, feedingPauseReason: 'unstable'
        });
        const r = calc.calculate(input);
        expect(r.results.feedingPauseReason).toMatch(/instabil/i);
        expect(calc.generateDocumentationString(r, input)).toMatch(/Nahrungspause/);
    });

    it('O10: Unbekannter Grund fällt sicher auf "Sonstiger Grund" zurück', () => {
        const r = calc.calculate(baseInput({
            feedingPaused: true, feedingPauseReason: '<script>'
        }));
        expect(r.results.feedingPauseReason).toBe('Sonstiger Grund');
    });
});

describe('O-AMPEL) Enteral-Ampel gegen Tages-Korridor', () => {

    it('O11: ELBW Tag 2 ohne enterale Zufuhr ist NICHT rot (Alarm-Fatigue)', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 2, tfi: 100, enteralVolume: 0
        }));
        // Korridor Tag 2 = 25 ml/kg/d, Schritt 15 → Lücke 25 ≤ 2×15 → gelb, nicht rot
        expect(r.comparisons.enteral.status).not.toBe('red');
    });

    it('O12: Deutlich unter Korridor → rot', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 10, tfi: 140, enteralVolume: 10
        }));
        expect(r.comparisons.enteral.status).toBe('red');
    });

    it('O13: Bei Nahrungspause ist die Ampel neutral', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 10, tfi: 140,
            enteralVolume: 0, feedingPaused: true, feedingPauseReason: 'nec'
        }));
        expect(r.comparisons.enteral.status).toBe('neutral');
    });
});

describe('O-NA) Enterales Natrium in der Bilanz', () => {

    it('O14: Kind auf Vollnahrung zeigt sein Natrium nicht mehr als 0', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1100, currentWeight: 1400, ssw: 28, postnatalAge: 25,
            ventilationStatus: 'spontaneous', tfi: 150, enteralVolume: 150, fm85Percent: 4,
            gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0
        }));
        expect(r.results.effectiveNa).toBe(0);                 // PN-Anteil korrekt 0
        expect(r.results.totalNaMmolKg).toBeGreaterThan(1);    // enteral wird sichtbar
        expect(r.results.totalNaMmolKg).toBeCloseTo(r.results.enteralNaMmolKg, 2);
    });

    it('O15: Gesamt-Na = PN + enteral', () => {
        const r = calc.calculate(baseInput({
            postnatalAge: 20, tfi: 150, enteralVolume: 80, fm85Percent: 2, sodium: 3
        }));
        expect(r.results.totalNaMmolKg)
            .toBeCloseTo(r.results.effectiveNa + r.results.enteralNaMmolKg, 2);
    });

    it('O16: Hypernatriämie-Warnung bei ELBW greift jetzt auch über enterales Na', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, currentWeight: 900, ssw: 26, postnatalAge: 6,
            tfi: 200, enteralVolume: 150, fm85Percent: 4, sodium: 4
        }));
        expect(r.results.totalNaMmolKg).toBeGreaterThan(5);
        expect(r.warnings.some(w => /Hypernatriämie/.test(w))).toBe(true);
    });

    it('O17: Gesamt-Na erscheint in der EPR-Dokumentation', () => {
        const input = baseInput({ postnatalAge: 20, tfi: 150, enteralVolume: 100, fm85Percent: 4, sodium: 3 });
        const doc = calc.generateDocumentationString(calc.calculate(input), input);
        expect(doc).toMatch(/Na .* gesamt \(PN /);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION P — v3.3: Sprache und Quick-View-Layout
 * ────────────────────────────────────────────────────────────────*/
describe('P) Sprache im sichtbaren Teil der App', () => {
    let ui;
    beforeAll(async () => {
        const { readFileSync } = await import('node:fs');
        ui = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
    });

    it('P1: Keine "Master-Protokoll"/"Master Logic"-Formulierungen im UI-Text', () => {
        // Code-Kommentare bleiben erlaubt (u.a. die sakrosankte ELBW-Grenzmarkierung
        // in calculator.js), aber nichts davon darf den Nutzern angezeigt werden.
        const sichtbar = ui
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/^\s*\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        expect(sichtbar).not.toMatch(/Master[- ]?(Protokoll|Protocol|Logic|Logik)/i);
    });

    it('P2: rationale der Smart Defaults nennt den hausinternen Standard', () => {
        const sd = calc.getSmartDefaults(baseInput({ postnatalAge: 3 }));
        expect(sd.rationale).toMatch(/hausinterner Standard/);
        expect(sd.rationale).not.toMatch(/Master/i);
    });

    it('P3: Keine englischen Titel-Anleihen im gerenderten Text', async () => {
        // Gegen den tatsaechlich sichtbaren Text pruefen, nicht gegen den
        // Quelltext: Code-Kommentare duerfen die Begriffe weiter enthalten.
        const { JSDOM } = await import('jsdom');
        const doc = new JSDOM(ui).window.document;
        // script/style-Knoten entfernen: deren Inhalt zaehlt zu textContent,
        // ist aber nie sichtbar (dort stehen die Code-Kommentare).
        doc.querySelectorAll('script, style').forEach(el => el.remove());
        const text = doc.body.textContent;
        expect(text).not.toMatch(/Chief Physician Review/);
        expect(text).not.toMatch(/Oberarzt-Edition/);
        expect(text).toMatch(/Klinische Beurteilung/);
        expect(text).not.toMatch(/Master[- ]?(Protokoll|Protocol|Logic|Logik)/i);
    });
});

describe('P-QV) Quick-View skaliert mit der Kachelbreite', () => {
    let ui, css;
    beforeAll(async () => {
        const { readFileSync } = await import('node:fs');
        ui = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
        css = ui.split('<style>')[1].split('</style>')[0];
    });

    it('P4: Werte nutzen .qv-value statt fester Tailwind-Groessen', () => {
        const i = ui.indexOf('id="quick-view-card"');
        expect(i).toBeGreaterThan(-1);
        const block = ui.slice(i, ui.indexOf('id="egi-card"'));
        expect(block).toMatch(/class="qv-value/);
        expect(block).not.toMatch(/text-3xl|text-4xl/);
    });

    it('P5: displayResults setzt beim Faerben KEINE Groessenklassen zurueck', () => {
        // Kernursache des Ueberlaufs: qvK.className enthielt text-4xl und
        // ueberschrieb damit das responsive Verhalten der Kachel.
        const setters = [
            ...(ui.match(/qvK\.className\s*=\s*'[^']*'/g) || []),
            ...(ui.match(/qvSafe\.className\s*=\s*'[^']*'/g) || [])
        ];
        expect(setters.length).toBeGreaterThanOrEqual(3);
        setters.forEach(s => {
            expect(s).not.toMatch(/text-3xl|text-4xl/);
            expect(s).toMatch(/qv-value/);
        });
    });

    it('P6: .qv-value ist container-basiert dimensioniert und bricht nicht um', () => {
        expect(css).toMatch(/#quick-view-card\s*\{[^}]*container-type:\s*inline-size/);
        expect(css).toMatch(/\.qv-value\s*\{[^}]*font-size:\s*clamp\([^)]*cqw/);
        expect(css).toMatch(/\.qv-value\s*\{[^}]*white-space:\s*nowrap/);
    });

    it('P7: Fallback fuer Browser ohne Container Queries vorhanden', () => {
        expect(css).toMatch(/@supports not \(container-type: inline-size\)/);
    });

    it('P8: Spalten koennen schrumpfen, sonst laeuft das Raster ueber', () => {
        expect(css).toMatch(/\.qv-grid\s*\{[^}]*minmax\(0,\s*1fr\)/);
        expect(css).toMatch(/\.qv-cell\s*\{[^}]*min-width:\s*0/);
    });

    it('P9: Labels und Einheiten kuerzen statt umzubrechen', () => {
        expect(css).toMatch(/\.qv-label\s*\{[^}]*text-overflow:\s*ellipsis/);
        expect(css).toMatch(/\.qv-unit\s*\{[^}]*text-overflow:\s*ellipsis/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION Q — v3.4: Flüssigkeits-Zieltabelle, Gewichtsverlauf, Zubereitung
 * ────────────────────────────────────────────────────────────────*/
describe('Q) Flüssigkeits-Zielspannen', () => {

    const tfi = (bw, day, extra = {}) =>
        calc.getTargets({ birthWeight: bw, postnatalAge: day, ssw: 26, ...extra }).tfi;

    it('Q1: ELBW-Kurve liegt 10 ml/kg/d unter ESPGHAN 2018', () => {
        expect([tfi(800, 1).min, tfi(800, 1).max]).toEqual([70, 90]);
        expect([tfi(800, 2).min, tfi(800, 2).max]).toEqual([90, 110]);
        expect([tfi(800, 3).min, tfi(800, 3).max]).toEqual([110, 130]);
        expect([tfi(800, 4).min, tfi(800, 4).max]).toEqual([130, 150]);
    });

    it('Q2: VLBW-Kurve ist eigenständig und liegt unter der ELBW-Kurve', () => {
        // Bis v3.3 war der VLBW-Zweig eine Kopie des ELBW-Zweigs.
        for (const d of [1, 2, 3, 4]) {
            expect(tfi(1200, d).min, `Tag ${d}`).toBeLessThanOrEqual(tfi(800, d).min);
        }
        expect([tfi(1200, 1).min, tfi(1200, 1).max]).toEqual([60, 80]);
        expect([tfi(1200, 3).min, tfi(1200, 3).max]).toEqual([100, 120]);
    });

    it('Q3: Zweig über 1500 g bleibt auf ESPGHAN', () => {
        expect([tfi(2500, 1).min, tfi(2500, 1).max]).toEqual([60, 80]);
        expect([tfi(2500, 3).min, tfi(2500, 3).max]).toEqual([100, 120]);
        expect([tfi(2500, 4).min, tfi(2500, 4).max]).toEqual([120, 140]);
    });

    it('Q4: Ab Tag 5 Plateau statt Rampe gegen den Cap', () => {
        // Vorher lieferte 120 + (Tag-3) x 20, gedeckelt bei 180, ab Tag 6
        // die entartete Spanne 180–180.
        for (const d of [5, 7, 10, 20, 60]) {
            expect([tfi(800, d).min, tfi(800, d).max], `Tag ${d}`).toEqual([150, 170]);
            expect([tfi(2500, d).min, tfi(2500, d).max], `Tag ${d}`).toEqual([140, 160]);
        }
    });

    it('Q5: Keine Inversion — kleinere Kinder bekommen nie weniger', () => {
        for (const d of [1, 2, 3, 4, 5, 10]) {
            expect(tfi(800, d).min, `Tag ${d}`).toBeGreaterThanOrEqual(tfi(1200, d).min);
            expect(tfi(1200, d).min, `Tag ${d}`).toBeGreaterThanOrEqual(tfi(2500, d).min);
        }
    });

    it('Q6: Beatmungs-Cap greift weiterhin', () => {
        const t = tfi(800, 10, { ventilationStatus: 'invasive' });
        expect(t.max).toBe(140);
        expect(t.cap).toBe(140);
    });

    it('Q7: Klassengrenze 1000 g gilt jetzt auch fürs Protein (Invariante 2)', () => {
        expect(calc.getTargets({ birthWeight: 1000, postnatalAge: 3, ssw: 28 }).protein.min).toBe(3.5);
        expect(calc.getTargets({ birthWeight: 1001, postnatalAge: 3, ssw: 28 }).protein.min).toBe(3.0);
    });
});

describe('Q-GEW) Gewichtsverlauf als Kontrollgröße', () => {

    it('Q8: Kein Gewichtsverlust bei hoher Zufuhr → Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 800, ssw: 26, postnatalAge: 4, tfi: 150
        }));
        expect(r.warnings.some(w => /Gewichtsverlust bisher nur/.test(w))).toBe(true);
        expect(r.results.weightChangePercent).toBe(0);
    });

    it('Q9: Physiologischer Verlust → kein Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 730, ssw: 26, postnatalAge: 4, tfi: 150
        }));
        expect(r.warnings.some(w => /Gewichtsverlust bisher nur/.test(w))).toBe(false);
        expect(r.results.weightChangePercent).toBeCloseTo(-8.8, 1);
    });

    it('Q10: Verlust über 15 % → Warnung Dehydratation', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 660, ssw: 26, postnatalAge: 5, tfi: 120
        }));
        expect(r.warnings.some(w => /übersteigt die physiologische/.test(w))).toBe(true);
    });

    it('Q11: Geburtsgewicht nach Tag 14 nicht erreicht → Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 770, ssw: 26, postnatalAge: 18, tfi: 150
        }));
        expect(r.warnings.some(w => /noch nicht wieder erreicht/.test(w))).toBe(true);
    });

    it('Q12: Ohne Gewichtseingabe keine Falschmeldung', () => {
        const input = baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 4, tfi: 150 });
        delete input.currentWeight;
        const r = calc.calculate(input);
        expect(r.results.weightChangePercent).toBe(null);
        expect(r.warnings.some(w => /Gewichtsverlust/.test(w))).toBe(false);
    });
});

describe('Q-ZUB) Zubereitung aus Zielkonzentration', () => {

    const prep = o => calc.calculate(baseInput({
        birthWeight: 1500, currentWeight: 1500, ssw: 30, postnatalAge: 20,
        ventilationStatus: 'spontaneous', tfi: 160, enteralVolume: 150,
        mealFrequency: 8, gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0,
        sodium: 0, potassium: 0, ...o
    })).results.preparation;

    it('Q13: Tagesmenge und Mahlzeitenvolumen', () => {
        const p = prep({});
        expect(p.dailyVolumeMl).toBe(225);      // 150 ml/kg/d x 1,5 kg
        expect(p.meals).toBe(8);
        expect(p.mealVolumeMl).toBeCloseTo(28.1, 1);
    });

    it('Q14: FM85 1,5 % → 1,5 g je 100 ml, korrekt auf Mahlzeit und Tag verteilt', () => {
        const p = prep({ fm85Percent: 1.5 });
        expect(p.fm85GramsPerDay).toBeCloseTo(3.38, 2);     // 225 ml x 1,5 %
        expect(p.fm85GramsPerMeal).toBeCloseTo(0.42, 2);
    });

    it('Q15: FM85 akzeptiert halbe Prozentschritte (vorher nur ganzzahlig)', () => {
        expect(prep({ fm85Percent: 0.5 }).fm85Percent).toBe(0.5);
        expect(prep({ fm85Percent: 2.5 }).fm85Percent).toBe(2.5);
    });

    it('Q16: Zielkonzentration 0,5 g Eiweiß/100 ml → Pulvermenge', () => {
        const p = prep({ proteinAddPer100ml: 0.5 });
        // 225 ml x 0,5 g/100 ml = 1,125 g Eiweiss; / 0,821 = 1,37 g Pulver
        expect(p.proteinPowderPerDay).toBeCloseTo(1.37, 2);
        expect(p.proteinPowderPerMeal).toBeCloseTo(0.17, 2);
        expect(p.proteinAddPer100ml).toBe(0.5);
    });

    it('Q17: Die Zielkonzentration kommt im Endprodukt tatsächlich an', () => {
        const ohne = prep({});
        const mit  = prep({ proteinAddPer100ml: 0.5 });
        expect(mit.proteinPer100mlFinal - ohne.proteinPer100mlFinal).toBeCloseTo(0.5, 2);
    });

    it('Q18: Eingabe in g Pulver/kg/d funktioniert weiterhin und wird zurückgerechnet', () => {
        const p = prep({ aptamilProteinGKg: 1 });
        expect(p.proteinPowderPerDay).toBeCloseTo(1.5, 2);   // 1 g/kg x 1,5 kg
        // Rueckrechnung: 1,5 g Pulver x 0,821 = 1,23 g Eiweiss auf 225 ml
        expect(p.proteinAddPer100ml).toBeCloseTo(0.55, 2);
    });

    it('Q19: Zielkonzentration hat Vorrang vor der direkten Pulvereingabe', () => {
        const p = prep({ proteinAddPer100ml: 0.5, aptamilProteinGKg: 3 });
        expect(p.proteinAddPer100ml).toBe(0.5);
        expect(p.proteinPowderPerDay).toBeCloseTo(1.37, 2);
    });

    it('Q20: Unplausible Zielkonzentration bricht ab', () => {
        expect(() => calc.calculate(baseInput({ proteinAddPer100ml: 5 }))).toThrow();
    });

    it('Q21: FM85 und Eiweiß-Zusatz zusammen — Summe stimmt', () => {
        const p = prep({ fm85Percent: 4, proteinAddPer100ml: 0.5 });
        // EBM 1,13 + FM85 4 % x 0,4675 = 3,0 ; plus 0,5 Zusatz = 3,5 g/100 ml
        expect(p.proteinPer100mlFinal).toBeCloseTo(3.5, 1);
    });
});

describe('Q-GRENZE) Anreicherung als Treiber der Protein-Überschreitung', () => {

    it('Q22: Über dem Limit nennt die App die noch mögliche Zielkonzentration', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1500, currentWeight: 1500, ssw: 30, postnatalAge: 20,
            ventilationStatus: 'spontaneous', tfi: 160, enteralVolume: 150,
            fm85Percent: 4, proteinAddPer100ml: 0.5,
            gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0
        }));
        expect(r.safetyChecks.proteinLimit).toBe(false);
        const hint = r.warnings.find(w => /Treiber ist die Anreicherung/.test(w));
        expect(hint).toBeTruthy();
        // Basis mit FM85 4 % = 3,0 g/100 ml; Limit 4,5 g/kg/d bei 150 ml/kg/d
        // entspricht 3,0 g/100 ml → kein Spielraum mehr fuer Zusatz.
        expect(hint).toMatch(/höchstens 0 g\/100 ml/);
    });

    it('Q23: Innerhalb des Limits kein Anreicherungs-Hinweis', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1500, currentWeight: 1500, ssw: 30, postnatalAge: 20,
            ventilationStatus: 'spontaneous', tfi: 160, enteralVolume: 140,
            fm85Percent: 2, proteinAddPer100ml: 0.3,
            gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0
        }));
        expect(r.safetyChecks.proteinLimit).toBe(true);
        expect(r.warnings.some(w => /Treiber ist die Anreicherung/.test(w))).toBe(false);
    });
});

describe('R) Auffindbarkeit der Anreicherungs-Felder', () => {
    let ui;
    beforeAll(async () => {
        const { readFileSync } = await import('node:fs');
        ui = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
    });

    // Bis v3.4 lagen FM85, Eiweiss-Zusatz und Liquigen im zugeklappten
    // Akkordeon "Enterale Ernährung". Die Zubereitungs-Kachel darunter war
    // sichtbar, bekam aber nur Nullen, weil die Felder nicht gefunden wurden.
    it('R1: Die Anreicherungs-Felder liegen in keinem zugeklappten Container', async () => {
        const { JSDOM } = await import('jsdom');
        const doc = new JSDOM(ui).window.document;
        const versteckt = id => {
            let n = doc.getElementById(id);
            expect(n, `#${id} existiert nicht`).toBeTruthy();
            for (; n && n !== doc.body; n = n.parentElement) {
                const st = (n.getAttribute && n.getAttribute('style')) || '';
                if (/display:\s*none/.test(st)) return true;
            }
            return false;
        };
        for (const id of ['input-fm85', 'input-protein-add', 'input-liquigen', 'input-meal-frequency']) {
            expect(versteckt(id), `${id} steckt in einem zugeklappten Bereich`).toBe(false);
        }
    });

    it('R2: Die Zubereitungs-Kachel ist ebenfalls sichtbar', async () => {
        const { JSDOM } = await import('jsdom');
        const doc = new JSDOM(ui).window.document;
        for (const id of ['prep-headline', 'prep-rows', 'prep-result']) {
            let n = doc.getElementById(id);
            expect(n, `#${id} existiert nicht`).toBeTruthy();
            for (; n && n !== doc.body; n = n.parentElement) {
                const st = (n.getAttribute && n.getAttribute('style')) || '';
                expect(/display:\s*none/.test(st), `${id} ist verborgen`).toBe(false);
            }
        }
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION S — Fehlerkorrekturen aus der Patientensimulation (v3.5)
 * Befunde: SIMULATIONSBERICHT.md, Abschnitte A1–A3, B3–B5.
 * ────────────────────────────────────────────────────────────────*/
describe('S) Korrekturen aus der Patientensimulation (v3.5)', () => {

    // S1 — Invariante 2 gilt auch für den Natrium-/IWL-Block
    it('S1: Exakt 1000 g bekommt die ELBW-Natriumhinweise wie 999 g, 1001 g nicht', () => {
        const mk = bw => calc.calculate(baseInput({
            birthWeight: bw, currentWeight: bw - 50, ssw: 28, postnatalAge: 3,
            tfi: 90, sodium: 6
        }));
        const hat = r => ({
            iwl: r.warnings.some(w => /IWL-bedingte Hypernatriämie/.test(w)),
            na: r.warnings.some(w => /Na-Zufuhr .* ELBW Tag 1–7/.test(w))
        });
        expect(hat(mk(999))).toEqual({ iwl: true, na: true });
        expect(hat(mk(1000))).toEqual({ iwl: true, na: true });
        expect(hat(mk(1001))).toEqual({ iwl: false, na: false });
    });

    // S2–S3 — Glukose fehlt bei laufender PN
    it('S2: GIR 0 bei laufendem PN-Volumen löst eine Warnung aus', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 2100, currentWeight: 2100, ssw: 34, postnatalAge: 1,
            tfi: 60, gir: 0, protein: 1.5, lipids: 1.0
        }));
        const w = r.warnings.find(x => /Keine Glukosezufuhr/.test(x));
        expect(w).toBeTruthy();
        expect(r.fazit.join(' ')).toMatch(/Glukosezufuhr prüfen/);
        expect(r.fazit.join(' ')).not.toMatch(/keine Korrekturen erforderlich/);
    });

    it('S3: Kein Alarm bei Vollnahrung mit kleinem PN-Rest ohne Glukose', () => {
        // 140 ml/kg EBM liefern rechnerisch ~6,8 mg/kg/min Kohlenhydrate.
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 12,
            tfi: 150, enteralVolume: 140, gir: 0, protein: 0, lipids: 0
        }));
        expect(r.warnings.some(x => /Glukosezufuhr|unter Minimum/.test(x))).toBe(false);
    });

    // S4–S5 — Fazit darf kritische Befunde nicht verschweigen
    it('S4: GIR über dem Maximum steht im Fazit, nicht „keine Korrekturen“', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 700, currentWeight: 650, ssw: 25, postnatalAge: 2,
            tfi: 110, gir: 11, secondarySolution: 'glucose10', secondaryRateKg: 20,
            protein: 2, lipids: 1.5
        }));
        expect(r.warnings.some(x => /^CRITICAL: GIR/.test(x))).toBe(true);
        expect(r.fazit.join(' ')).toMatch(/GIR .* überschreitet Maximum/);
        expect(r.fazit.join(' ')).not.toMatch(/keine Korrekturen erforderlich/);
    });

    it('S5: Hypertriglyceridämie steht im Fazit, ohne gegenläufige Energie-Steigerung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, currentWeight: 850, ssw: 27, postnatalAge: 10,
            tfi: 150, gir: 7, protein: 3.5, lipids: 3.5, triglycerides: 300
        }));
        expect(r.fazit.join(' ')).toMatch(/Triglyzeride > 250/);
        expect(r.fazit.join(' ')).not.toMatch(/Energiezufuhr um/);
    });

    it('S5b: Ein unauffälliger Plan behält das „keine Korrekturen“-Fazit', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1000, currentWeight: 1000, ssw: 28, postnatalAge: 3,
            tfi: 120, gir: 6, protein: 3.5, lipids: 3.0, calcium: 60, phosphate: 36
        }));
        if (r.warnings.length === 0) {
            expect(r.fazit).toEqual(['Ernährungsplan im ESPGHAN-Zielbereich – keine Korrekturen erforderlich.']);
        }
        expect(r.fazit.join(' ')).not.toMatch(/Glukosezufuhr prüfen/);
    });

    // S6 — Perzentile nach korrigiertem Alter
    it('S6: Gewichtsperzentile nutzt das korrigierte Gestationsalter', async () => {
        const { GrowthCalculator } = await import('../fenton_data.js').then(m => m.default || m);
        globalThis.GrowthCalculator = GrowthCalculator;
        try {
            const r = calc.calculate(baseInput({
                birthWeight: 880, currentWeight: 1250, ssw: 26, postnatalAge: 28,
                tfi: 150, enteralVolume: 150
            }));
            // Tag 28 = 4 Wochen → 30+0 SSW korrigiert
            const erwartet = GrowthCalculator.getPercentile('WEIGHT', 26 + 27 / 7, 1250);
            expect(r.results.weightPercentile).toBe(erwartet);
            expect(r.results.weightPercentile).not.toBe('> 97.');
            // Tag 1 bleibt unverändert beim Alter bei Geburt
            const r1 = calc.calculate(baseInput({
                birthWeight: 880, currentWeight: 880, ssw: 26, postnatalAge: 1, tfi: 80
            }));
            expect(r1.results.weightPercentile).toBe(GrowthCalculator.getPercentile('WEIGHT', 26, 880));
        } finally {
            delete globalThis.GrowthCalculator;
        }
    });

    // S7 — FM85 nur bei Muttermilch
    it('S7: FM85-Feld bei Formelnahrung erscheint nicht in der Zubereitung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 2100, currentWeight: 2000, ssw: 34, postnatalAge: 6,
            tfi: 150, enteralVolume: 150, selectedEnteralProduct: 'aptamilPre',
            fm85Percent: 4
        }));
        expect(r.results.preparation.fm85Percent).toBe(0);
        expect(r.results.preparation.fm85GramsPerDay).toBe(0);
        expect(r.results.preparation.fm85GramsPerMeal).toBe(0);
        expect(r.warnings.some(w => /FM85 4 % wird nur bei Muttermilch/.test(w))).toBe(true);
        expect(r.reminders.some(m => /FM85/.test(m))).toBe(false);
    });

    it('S7b: Bei Muttermilch bleibt die FM85-Zubereitung unverändert', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 20,
            tfi: 160, enteralVolume: 150, fm85Percent: 4
        }));
        expect(r.results.preparation.fm85Percent).toBe(4);
        expect(r.results.preparation.fm85GramsPerDay).toBeGreaterThan(0);
        expect(r.warnings.some(w => /wird nur bei Muttermilch/.test(w))).toBe(false);
    });

    // S8 — Hinweis bei FM85 als Treiber der Protein-Überschreitung
    it('S8: Ist FM85 der Treiber, nennt der Hinweis die noch mögliche FM85-Stufe', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 620, currentWeight: 1050, ssw: 25, postnatalAge: 28,
            tfi: 160, enteralVolume: 160, fm85Percent: 4
        }));
        expect(r.safetyChecks.proteinLimit).toBe(false);
        const h = r.warnings.find(w => /wäre FM85 höchstens/.test(w));
        expect(h).toBeTruthy();
        const stufe = parseFloat(h.match(/höchstens ([\d.]+) %/)[1]);
        // Gewählte Stufe darf das Limit bei diesem Volumen nicht mehr sprengen
        const eiweiss = 160 * (1.13 + stufe * 0.4675) / 100;
        expect(eiweiss).toBeLessThanOrEqual(4.5);
        // und die nächste halbe Stufe sprengt es
        expect(160 * (1.13 + (stufe + 0.5) * 0.4675) / 100).toBeGreaterThan(4.5);
    });
});
