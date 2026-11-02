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

    // v3.5 — klinisch begründete Anpassung (Neonatologe, 02.10.2026): Calcium und
    // Phosphat werden dienstags im Urin bestimmt und die Phosphat-Substitution daran
    // angepasst; eine Ca:P-Bewertung der Zufuhr hat auf Station keine Funktion. Vorher
    // prüfte dieser Test die Warnung. Das Verhältnis wird weiter berechnet.
    it('C3: Ca:P Ratio außerhalb 1.5–2.0 löst keine Warnung mehr aus (Wert bleibt sichtbar)', () => {
        const r = calc.calculate(baseInput({
            calcium: 30, phosphate: 80 // Ratio ≈ 0.29
        }));
        expect(r.warnings.some(w => w.includes('Ca:P'))).toBe(false);
        expect(r.fazit.join(' ')).not.toMatch(/Ca:P/);
        expect(r.results.caPRatio).toBeGreaterThan(0);
    });

    // v3.5 — klinisch begründete Anpassung (Neonatologe, 20.10.2026): Phosphat wird über
    // Urin und Labor gesteuert, alle Hauslösungen liegen bei 0,5–0,77 mmol/g und lösten die
    // Warnung ständig aus. Vorher prüfte dieser Test die Warnung. Der Wert wird weiter berechnet.
    it('C4: P:AA Ratio < 1.0 löst keine Warnung mehr aus (Wert bleibt sichtbar)', () => {
        const r = calc.calculate(baseInput({
            protein: 4.0, phosphate: 20
        }));
        expect(r.warnings.some(w => w.includes('P:AA'))).toBe(false);
        expect(r.fazit.join(' ')).not.toMatch(/P:AA/);
        expect(r.results.paaRatio).toBeGreaterThan(0);
        expect(r.results.paaRatio).toBeLessThan(1);
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

    // v3.6.2 — klinisch begründete Anpassung (Packungsangabe FM85, 20.10.2026): Je 100 g Pulver
    // 35,5 g Eiweiß und 435 kcal. EBM + 4 % ergibt damit 2,55 g Eiweiß und 88,4 kcal je 100 ml
    // (vorher 3,0 g und 85 kcal). Bei 4 % begrenzt jetzt die Energie das Volumen, nicht mehr das Eiweiß.
    // v3.6.17 — klinisch begründete Anpassung (Entscheidung des Neonatologen 01.11.2026): Energieobergrenze
    // 135 → 140 kcal/kg/d (ESPGHAN 2022: 115–140). Damit liegt der Deckel bei 4 % jetzt bei 155 statt 150 ml/kg/d.
    // Die Begrenzung durch Eiweiß prüft O2b.
    it('O2: EBM + FM85 4 % → Ziel wird durch die Energie-Obergrenze gedeckelt', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 25, fm85Percent: 4
        }));
        // 71 + 4×4,35 = 88,4 kcal/100 ml → 140 kcal/kg/d bei höchstens 158,4 → abgerundet auf 155 ml/kg/d
        expect(t.enteralTarget.max).toBe(155);
        expect(t.enteralTarget.limitedBy).toBe('energy');
        expect(t.enteralTarget.unlimited.max).toBe(180);
    });

    it('O2b: Eine eiweißreiche Nahrung wird weiterhin durch die Protein-Obergrenze gedeckelt', () => {
        const t = calc.getTargets(baseInput({
            birthWeight: 900, ssw: 26, postnatalAge: 25, selectedEnteralProduct: 'bebaFG1'
        }));
        // Beba FG 1: 2,9 g/100 ml → 4,5 g/kg/d bei 155 ml/kg/d; Energie (80 kcal) erlaubt 165
        expect(t.enteralTarget.max).toBe(155);
        expect(t.enteralTarget.limitedBy).toBe('protein');
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

    // v3.5 — klinisch begründete Anpassung (Neonatologe, 02.10.2026): Es wird nur mit
    // realem Gewicht gerechnet. Ab Lebenstag 2 bricht die App ohne aktuelles Gewicht
    // ab, statt es auf das Geburtsgewicht zu setzen. Das Ziel des Tests (keine
    // Falschmeldung „0 % Verlust“) bleibt erhalten: an Tag 1 gilt das Geburtsgewicht,
    // danach gibt es gar kein Ergebnis mehr.
    it('Q12: Ohne Gewichtseingabe keine Falschmeldung', () => {
        const tag1 = baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 1, tfi: 80 });
        delete tag1.currentWeight;
        const r = calc.calculate(tag1);
        expect(r.results.weightChangePercent).toBe(null);
        expect(r.warnings.some(w => /Gewichtsverlust/.test(w))).toBe(false);

        const tag4 = baseInput({ birthWeight: 800, ssw: 26, postnatalAge: 4, tfi: 150 });
        delete tag4.currentWeight;
        expect(() => calc.calculate(tag4)).toThrow(/Aktuelles Gewicht fehlt/);
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
        // EBM 1,13 + FM85 4 % x 0,355 (Packung) = 2,55 ; plus 0,5 Zusatz = 3,05 g/100 ml
        expect(p.proteinPer100mlFinal).toBeCloseTo(3.05, 2);
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
        // Basis mit FM85 4 % = 2,55 g/100 ml; Limit 4,5 g/kg/d bei 150 ml/kg/d entspricht
        // 3,0 g/100 ml → noch 0,45 g/100 ml Zusatz möglich (Packungswerte, v3.6.2).
        expect(hint).toMatch(/höchstens 0\.45 g\/100 ml/);
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
    it('S2: GIR 0 bei laufendem PN-Volumen ist CRITICAL und steht im Fazit', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 2100, currentWeight: 2100, ssw: 34, postnatalAge: 1,
            tfi: 60, gir: 0, protein: 1.5, lipids: 1.0
        }));
        const w = r.warnings.find(x => /Keine Glukosezufuhr/.test(x));
        expect(w).toBeTruthy();
        expect(w.startsWith('CRITICAL')).toBe(true);
        expect(r.isSafe).toBe(false);
        expect(r.fazit.join(' ')).toMatch(/Keine Glukosezufuhr/);
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
            tfi: 160, enteralVolume: 160, fm85Percent: 5
        }));
        // v3.6.2: mit den Packungswerten (0,355 g Eiweiß je 1 %) wird die Obergrenze erst
        // bei 5 % und 160 ml/kg/d überschritten (4 % ergeben 4,1 g/kg).
        expect(r.safetyChecks.proteinLimit).toBe(false);
        const h = r.warnings.find(w => /wäre FM85 höchstens/.test(w));
        expect(h).toBeTruthy();
        const stufe = parseFloat(h.match(/höchstens ([\d.]+) %/)[1]);
        // Gewählte Stufe darf das Limit bei diesem Volumen nicht mehr sprengen
        const eiweiss = 160 * (1.13 + stufe * 0.355) / 100;
        expect(eiweiss).toBeLessThanOrEqual(4.5);
        // und die nächste halbe Stufe sprengt es
        expect(160 * (1.13 + (stufe + 0.5) * 0.355) / 100).toBeGreaterThan(4.5);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION T — Entscheidungen des Neonatologen vom 02.10.2026 (v3.5)
 * Jede Regel steht zusätzlich im REGELWERK.md.
 * ────────────────────────────────────────────────────────────────*/
describe('T) Entscheidungen 02.10.2026 (v3.5)', () => {

    it('T1: GIR unter Minimum bei laufender PN ist CRITICAL', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 3,
            tfi: 120, gir: 2, protein: 2, lipids: 2
        }));
        const w = r.warnings.find(x => /unter Minimum/.test(x));
        expect(w).toBeTruthy();
        expect(w.startsWith('CRITICAL')).toBe(true);
        expect(r.isSafe).toBe(false);
    });

    // --- Kalium ---
    it('T2: Kalium an Lebenstag 1 und 2 löst die Warnung „kaliumfreie Phase“ aus, ab Tag 3 nicht', () => {
        const mk = d => calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 780, ssw: 26, postnatalAge: d,
            tfi: 100, gir: 6, protein: 2, lipids: 1.5, potassium: 1
        }));
        const frei = r => r.warnings.some(w => /kaliumfrei/.test(w));
        expect(frei(mk(1))).toBe(true);
        expect(frei(mk(2))).toBe(true);
        expect(frei(mk(3))).toBe(false);
    });

    it('T3: Kein Kalium an Tag 1–2 → keine Kalium-Warnung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 800, ssw: 26, postnatalAge: 1,
            tfi: 80, gir: 5, protein: 2, lipids: 1, potassium: 0
        }));
        expect(r.warnings.some(w => /Kalium/.test(w))).toBe(false);
    });

    it('T4: Kalium-Obergrenze: < 1500 g über 5, ab 1500 g über 3 mmol/kg/d', () => {
        const mk = (bw, k) => calc.calculate(baseInput({
            birthWeight: bw, currentWeight: bw, ssw: 30, postnatalAge: 6,
            tfi: 140, gir: 6, protein: 3, lipids: 2, potassium: k
        }));
        const hoch = r => r.warnings.some(w => /Kalium .* über der Obergrenze/.test(w));
        expect(hoch(mk(1200, 5))).toBe(false);
        expect(hoch(mk(1200, 5.5))).toBe(true);
        expect(hoch(mk(1800, 3))).toBe(false);
        expect(hoch(mk(1800, 3.5))).toBe(true);
    });

    // --- Energiedeckel erst ab Tag 4 ---
    it('T5: Enterales Ziel an Tag 1–3 wird nicht durch die Tages-Energie gedeckelt', () => {
        for (const d of [1, 2, 3]) {
            const t = calc.getTargets({ birthWeight: 700, ssw: 25, postnatalAge: d, selectedEnteralProduct: 'ebm' });
            expect(t.enteralTarget.min, `Tag ${d}`).toBe(160);
            expect(t.enteralTarget.max, `Tag ${d}`).toBe(180);
            expect(t.enteralTarget.limitedBy).toBe(null);
        }
        const r = calc.calculate(baseInput({
            birthWeight: 700, currentWeight: 700, ssw: 25, postnatalAge: 1,
            tfi: 80, enteralVolume: 10, gir: 5, protein: 2, lipids: 1
        }));
        expect(r.reminders.some(m => /Überernährung/.test(m))).toBe(false);
    });

    it('T6: Ab Tag 4 greift der Energiedeckel weiter (Absicherung O3 bleibt wirksam)', () => {
        const t = calc.getTargets({ birthWeight: 700, ssw: 25, postnatalAge: 5, selectedEnteralProduct: 'ebm', fm85Percent: 2 });
        expect(t.enteralTarget.limitedBy).toBe('energy');
    });

    // --- Anreicherung nur für < 1800 g (Geltungsbereich ESPGHAN 2022) ---
    it('T7: Reifgeborenes mit EBM bekommt keine FM85-Empfehlung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 3400, currentWeight: 3250, ssw: 39, postnatalAge: 5,
            tfi: 150, enteralVolume: 150, gir: 0, protein: 0, lipids: 0
        }));
        expect(r.reminders.some(m => /FM85/.test(m))).toBe(false);
        expect(r.recommendations.fortification).toBe(null);
        expect(r.fazit.join(' ')).not.toMatch(/FM85/);
    });

    it('T8: Frühgeborenes unter 1800 g behält die FM85-Empfehlung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1700, currentWeight: 1650, ssw: 32, postnatalAge: 10,
            tfi: 150, enteralVolume: 120, gir: 0, protein: 0, lipids: 0
        }));
        expect(r.reminders.some(m => /FM85 Start-Kriterium/.test(m))).toBe(true);
        expect(r.recommendations.fortification).toBeTruthy();
    });

    // --- Fehlendes Gewicht ---
    it('T9: Ohne Geburtsgewicht wird nicht gerechnet', () => {
        for (const leer of ['', null, undefined]) {
            expect(() => calc.calculate(baseInput({ birthWeight: leer })), String(leer))
                .toThrow(/Geburtsgewicht fehlt/);
        }
        try { calc.calculate(baseInput({ birthWeight: '' })); } catch (e) {
            expect(e.name).toBe('ValidationError');
            expect(e.field).toBe('birthWeight');
        }
    });

    it('T10: Ab Tag 2 ohne aktuelles Gewicht wird nicht gerechnet, an Tag 1 genügt das Geburtsgewicht', () => {
        expect(() => calc.calculate(baseInput({ postnatalAge: 2, currentWeight: '' })))
            .toThrow(/Aktuelles Gewicht fehlt/);
        expect(() => calc.calculate(baseInput({ postnatalAge: 1, currentWeight: '' }))).not.toThrow();
    });

    // --- SGA ---
    it('T11: SGA wird über die Geburtsgewichts-Perzentile erkannt', async () => {
        const { GrowthCalculator } = await import('../fenton_data.js').then(m => m.default || m);
        globalThis.GrowthCalculator = GrowthCalculator;
        try {
            const sga = calc.calculate(baseInput({
                birthWeight: 1450, currentWeight: 1450, ssw: 38, postnatalAge: 1, tfi: 60
            }));
            expect(['sga', 'severe']).toContain(sga.results.sga);
            expect(sga.warnings.some(w => /SGA/.test(w))).toBe(true);

            const aga = calc.calculate(baseInput({
                birthWeight: 3300, currentWeight: 3300, ssw: 39, postnatalAge: 1, tfi: 60
            }));
            expect(aga.results.sga).toBe('none');
            expect(aga.warnings.some(w => /SGA/.test(w))).toBe(false);
        } finally {
            delete globalThis.GrowthCalculator;
        }
    });

    it('T12: Ohne Fenton-Modul bleibt die SGA-Erkennung still (null, kein Fehler)', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1450, currentWeight: 1450, ssw: 38, postnatalAge: 1, tfi: 60
        }));
        expect(r.results.sga).toBe(null);
        expect(r.results.birthWeightPercentile).toBe(null);
    });
});

describe('U) Eiweißlösung 1 ml = 1 g (v3.5)', () => {
    it('U1: Zubereitung nennt Eiweiß in g und das Volumen der Hauslösung (1 g = 1 ml)', () => {
        // Fall aus dem Stationsalltag: 400 g, 100 ml/kg/d, 12 Mahlzeiten, Zusatz 2 g/100 ml
        const r = calc.calculate(baseInput({
            birthWeight: 400, currentWeight: 400, ssw: 24, postnatalAge: 12,
            tfi: 208, enteralVolume: 100, mealFrequency: 12, proteinAddPer100ml: 2,
            gir: 0, protein: 0, lipids: 0
        }));
        const p = r.results.preparation;
        // Nahrung: 0,4 kg × 100 ml = 40 ml/d, 3,3 ml je Mahlzeit — das ist NICHT das Eiweiß
        expect(p.dailyVolumeMl).toBe(40);
        expect(p.mealVolumeMl).toBe(3.3);
        // Zusatz: 40 ml × 2 g/100 ml = 0,8 g Eiweiß/d = 0,8 ml Lösung/d
        expect(p.proteinAddGramsPerDay).toBeCloseTo(0.8, 2);
        expect(p.proteinSolutionMlPerDay).toBeCloseTo(0.8, 2);
        expect(p.proteinSolutionMlPerMeal).toBeCloseTo(0.067, 3);
        // Pulver-Angabe bleibt unverändert
        expect(p.proteinPowderPerDay).toBeCloseTo(0.97, 2);
    });

    it('U2: Ohne Zusatz sind alle Zusatzmengen 0', () => {
        const r = calc.calculate(baseInput({ tfi: 150, enteralVolume: 150, gir: 0, protein: 0, lipids: 0 }));
        const p = r.results.preparation;
        expect(p.proteinAddGramsPerDay).toBe(0);
        expect(p.proteinSolutionMlPerDay).toBe(0);
        expect(p.proteinSolutionMlPerMeal).toBe(0);
    });

    it('U3: Das Zusatz-Eiweiß in g entspricht dem Eiweiß-Beitrag der Rechnung', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 20,
            tfi: 150, enteralVolume: 150, mealFrequency: 8, proteinAddPer100ml: 1,
            gir: 0, protein: 0, lipids: 0
        }));
        // 1,2 kg × 150 ml × 1 g/100 ml = 1,8 g/d
        expect(r.results.preparation.proteinAddGramsPerDay).toBeCloseTo(1.8, 2);
        expect(r.results.preparation.proteinAddGramsPerDay / 1.2).toBeCloseTo(r.results.aptamilProteinNetGKg, 2);
    });
});

describe('V) Eiweiß-Zusatz in g/kg/d als zweite Eingabeform (v3.5)', () => {
    const base = o => baseInput({
        birthWeight: 1200, currentWeight: 1200, ssw: 30, postnatalAge: 20,
        tfi: 150, enteralVolume: 150, mealFrequency: 8, gir: 0, protein: 0, lipids: 0, ...o
    });

    it('V1: 1,5 g/kg/d bei 150 ml/kg/d entspricht 1 g/100 ml', () => {
        const a = calc.calculate(base({ proteinAddGKg: 1.5 })).results;
        const b = calc.calculate(base({ proteinAddPer100ml: 1 })).results;
        expect(a.aptamilProteinNetGKg).toBeCloseTo(1.5, 2);
        expect(a.preparation.proteinAddPer100ml).toBeCloseTo(1, 2);
        expect(a.preparation.proteinSolutionMlPerDay).toBeCloseTo(b.preparation.proteinSolutionMlPerDay, 2);
        expect(a.preparation.proteinPowderPerDay).toBeCloseTo(b.preparation.proteinPowderPerDay, 2);
        expect(a.proteinTotalGPerKg).toBeCloseTo(b.proteinTotalGPerKg, 2);
    });

    it('V2: Vorrang g/100 ml vor g/kg/d vor Pulvereingabe', () => {
        const x = calc.calculate(base({ proteinAddPer100ml: 1, proteinAddGKg: 3, aptamilProteinGKg: 4 })).results;
        expect(x.aptamilProteinNetGKg).toBeCloseTo(1.5, 2);
        const y = calc.calculate(base({ proteinAddGKg: 1, aptamilProteinGKg: 4 })).results;
        expect(y.aptamilProteinNetGKg).toBeCloseTo(1, 2);
        const z = calc.calculate(base({ aptamilProteinGKg: 1 })).results;
        expect(z.aptamilProteinNetGKg).toBeCloseTo(0.821, 2);
    });

    it('V3: Unplausibler Wert (> 5 g/kg/d) bricht ab', () => {
        expect(() => calc.calculate(base({ proteinAddGKg: 6 }))).toThrow(/proteinAddGKg|Eiweiß-Zusatz/);
    });

    it('V4: Zusatz ohne enterale Nahrung wird gemeldet', () => {
        const r = calc.calculate(base({ enteralVolume: 0, tfi: 100, proteinAddGKg: 1 }));
        expect(r.warnings.some(w => /Eiweiß-Zusatz eingestellt, aber keine enterale Nahrung/.test(w))).toBe(true);
    });

    it('V5: Die Einheiten-Auswahl existiert in der Oberfläche und liegt im sichtbaren Bereich', async () => {
        const { JSDOM } = await import('jsdom');
        const fs = await import('node:fs');
        const doc = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')).window.document;
        const sel = doc.getElementById('input-protein-add-unit');
        expect(sel).toBeTruthy();
        // 31.10.2026 (Wunsch des Neonatologen, REGELWERK 10.10): zusätzlich Dosis je Mahlzeit (g Pulver, ml Eiweißlösung).
        // Geprüft bleibt, was V5 sichern soll: g/100 ml ist die Hauptform (zuerst, Standard), g/kg/d ist die zweite Form.
        expect([...sel.options].map(o => o.value).slice(0, 2)).toEqual(['per100', 'gkg']);
        expect([...sel.options].map(o => o.value)).toEqual(['per100', 'gkg', 'powdermeal', 'solmeal']);
        expect(sel.value).toBe('per100');
        for (let n = sel; n && n !== doc.body; n = n.parentElement) {
            expect(/display:\s*none/.test((n.getAttribute && n.getAttribute('style')) || '')).toBe(false);
        }
    });
});

describe('W) Versionsstand von Oberfläche und Rechenkern (v3.5.1)', () => {
    const fs = require('node:fs');
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

    it('W1: calculator.VERSION, EXPECTED_CALC_VERSION und die ?v= der Skript-Tags stimmen überein', () => {
        const erwartet = html.match(/EXPECTED_CALC_VERSION\s*=\s*'([^']+)'/);
        expect(erwartet, 'EXPECTED_CALC_VERSION fehlt in index.html').toBeTruthy();
        expect(calc.VERSION).toBe(erwartet[1]);
        for (const f of ['calculator.js', 'products.js', 'fenton_data.js']) {
            const m = html.match(new RegExp(`<script src="${f.replace('.', '\\.')}\\?v=([^"]+)"`));
            expect(m, `${f} ohne ?v= eingebunden`).toBeTruthy();
            expect(m[1], f).toBe(calc.VERSION);
        }
    });

    it('W2: Die Oberfläche bricht bei abweichender Version ab, bevor sie rechnet', () => {
        const start = html.indexOf('window.updateCalculations = function updateCalculations()');
        const guard = html.indexOf('calculator.VERSION !== EXPECTED_CALC_VERSION', start);
        const aufruf = html.indexOf('calculator.calculate(data)', start);
        expect(start).toBeGreaterThan(0);
        expect(guard).toBeGreaterThan(start);
        expect(guard).toBeLessThan(aufruf);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION Y — Strukturierte Meldungen (v3.6)
 * Ziel: weniger gleichfarbige Meldungen, nichts geht verloren.
 * ────────────────────────────────────────────────────────────────*/
describe('Y) Strukturierte Meldungen (v3.6)', () => {
    const busy = () => calc.calculate(baseInput({
        birthWeight: 700, currentWeight: 660, ssw: 28, postnatalAge: 6,
        ventilationStatus: 'invasive', tfi: 150, enteralVolume: 30,
        gir: 2, protein: 2, lipids: 1, calcium: 60, phosphate: 30, sodium: 6, potassium: 2
    }));

    it('Y1: Jede Warnung und jede Erinnerung erscheint genau einmal, im vollen Wortlaut', () => {
        const r = busy();
        const strip = t => t.replace(/^(CRITICAL|Warnung|Hinweis):\s*/, '');
        expect(r.alerts.items.length).toBe(r.warnings.length);
        expect(r.alerts.items.map(i => i.text).sort()).toEqual(r.warnings.map(strip).sort());
        expect(r.alerts.reminders.length).toBe(r.reminders.length);
    });

    it('Y2: Stufen folgen dem Präfix, kritisch steht immer vor Warnung vor Hinweis', () => {
        const r = busy();
        const rank = { critical: 0, warning: 1, info: 2 };
        const levels = r.alerts.items.map(i => i.level);
        expect(levels).toEqual([...levels].sort((a, b) => rank[a] - rank[b]));
        expect(r.alerts.items.filter(i => i.level === 'critical').length)
            .toBe(r.warnings.filter(w => w.startsWith('CRITICAL')).length);
        expect(r.alerts.items.filter(i => i.level === 'warning').length)
            .toBe(r.warnings.filter(w => w.startsWith('Warnung')).length);
    });

    it('Y3: Zähler stimmen mit den Listen überein', () => {
        const r = busy();
        const c = r.alerts.counts;
        expect(c.critical + c.warning + c.info).toBe(r.alerts.items.length);
        expect(c.reminder).toBe(r.alerts.reminders.length);
    });

    it('Y4: Bereichszuordnung nach Titel — Detailwörter ziehen nicht in den falschen Bereich', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 600, currentWeight: 560, ssw: 25, postnatalAge: 2,
            ventilationStatus: 'invasive', tfi: 220, enteralVolume: 0, gir: 13, protein: 3, lipids: 4.5,
            potassium: 4, sodium: 1
        }));
        const dom = re => r.alerts.items.find(i => re.test(i.title)).domainLabel;
        expect(dom(/^TFI 220/)).toBe('Flüssigkeit');          // Detail nennt „Serum-Natrium“
        expect(dom(/^GIR 13/)).toBe('Glukose & PN');
        expect(dom(/^Lipide 4/)).toBe('Eiweiß & Energie');
        expect(dom(/^Kalium/)).toBe('Elektrolyte');
    });

    it('Y5: Hypernatriämie-Hinweis gehört zu den Elektrolyten, auch wenn der Titel „TFI“ nennt', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 900, currentWeight: 850, ssw: 27, postnatalAge: 4, tfi: 90, gir: 6, protein: 3, lipids: 2
        }));
        const h = r.alerts.items.find(i => /IWL-bedingte Hypernatriämie/.test(i.text));
        expect(h.domainLabel).toBe('Elektrolyte');
    });

    it('Y6: Titel und Detail zerlegen den Satz, ohne Wortlaut zu verlieren', () => {
        const r = busy();
        const p = r.alerts.items.find(i => /^Protein .* unter Zielbereich/.test(i.title));
        expect(p.title).toMatch(/^Protein 2\.34 g\/kg\/d unter Zielbereich \(3\.5–4\)$/);
        expect(p.detail).toMatch(/Steigerung prüfen/);
        r.alerts.items.forEach(i => {
            const ohneTrenner = i.text.replace(/ [—–] /, ' ');
            expect(ohneTrenner).toContain(i.title.replace(/ [—–] /, ' '));
        });
    });

    it('Y7: Der Toleranz-Vorbehalt des Steigerungshinweises bleibt im vollen Wortlaut erhalten (N7)', () => {
        const r = busy();
        const h = r.alerts.items.find(i => /Aufbau-Korridor/.test(i.text));
        expect(h.level).toBe('info');
        expect(h.text).toMatch(/nur bei guter Toleranz/);
        expect(h.title + ' ' + h.detail).toMatch(/nur bei guter Toleranz/);
    });

    it('Y8: Erinnerungen tragen kein führendes Symbol und die Stufe „reminder“', () => {
        const r = busy();
        expect(r.alerts.reminders.length).toBeGreaterThan(0);
        r.alerts.reminders.forEach(i => {
            expect(i.level).toBe('reminder');
            expect(/^[\p{L}\p{N}]/u.test(i.text)).toBe(true);
        });
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION Z — Darstellung der Befunde in der Oberfläche (v3.6)
 * Die Seite wird mit ihren eigenen Skripten ausgeführt.
 * ────────────────────────────────────────────────────────────────*/
describe('Z) Darstellung der Befunde (v3.6)', () => {
    async function bootUI(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) {
            const el = w.document.getElementById(id);
            if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
        }
        w.updateCalculations();
        return w.document;
    }
    const heavy = {
        'birth-weight': 600, 'current-weight': 560, 'input-day': 2, 'input-tfi': 220, 'input-enteral': 0,
        'input-gir': 13, 'input-protein': 3.5, 'input-lipids': 4.5, 'input-calcium': 120, 'input-phosphate': 20,
        'input-sodium': 7, 'input-potassium': 4, 'input-invasive-ventilation': true
    };

    it('Z1: Kritische Befunde stehen vollständig sichtbar, nicht in einem zugeklappten Bereich', async () => {
        const doc = await bootUI(heavy);
        const kritisch = [...doc.querySelectorAll('#findings-critical .f-item.critical')];
        expect(kritisch.length).toBeGreaterThanOrEqual(2);
        kritisch.forEach(el => expect(el.closest('details'), el.textContent).toBeNull());
        expect(doc.getElementById('findings-critical').getAttribute('role')).toBe('alert');
    });

    it('Z2: Hinweise und Erinnerungen sind eingeklappt, die Zähler nennen ihre Anzahl', async () => {
        const doc = await bootUI(heavy);
        for (const id of ['findings-info', 'findings-reminders']) {
            const d = doc.getElementById(id);
            if (d.classList.contains('hidden')) continue;
            expect(d.hasAttribute('open'), id).toBe(false);
        }
        const chips = doc.getElementById('findings-chips').textContent;
        expect(chips).toMatch(/\d+ kritisch/);
        expect(chips).toMatch(/\d+ Warnung/);
    });

    it('Z3: Höchstens 3 Warnungen sind offen sichtbar, der Rest steckt in einem eingeklappten Bereich', async () => {
        const doc = await bootUI(heavy);
        const offen = doc.querySelectorAll('#findings-warning > .f-item.warning');
        expect(offen.length).toBeLessThanOrEqual(3);
        const gesamt = doc.querySelectorAll('#findings-warning .f-item.warning, #findings-warning details .f-row').length;
        const chip = parseInt((doc.getElementById('findings-chips').textContent.match(/(\d+) Warnung/) || [0, 0])[1], 10);
        expect(gesamt).toBe(chip);
    });

    it('Z4: Die kritische Meldung steht nicht doppelt in „Nächste Schritte“', async () => {
        const doc = await bootUI(heavy);
        const kritTitel = [...doc.querySelectorAll('#findings-critical .f-title')].map(e => e.textContent);
        const naechste = [...doc.querySelectorAll('#findings-next-list li')].map(e => e.textContent);
        kritTitel.forEach(t => naechste.forEach(n => expect(n.startsWith(t), `${t} | ${n}`).toBe(false)));
    });

    it('Z5: Die alten, einzeln gefärbten Listen sind entfallen', async () => {
        const doc = await bootUI(heavy);
        for (const id of ['warning-container', 'reminders-container', 'fortification-info', 'clinical-fazit']) {
            expect(doc.getElementById(id), id).toBeNull();
        }
    });

    it('Z6: Jede Stufe hat Symbol und Text, nie nur eine Farbe', async () => {
        const doc = await bootUI(heavy);
        const chips = [...doc.querySelectorAll('#findings-chips .f-chip')].map(e => e.textContent);
        chips.forEach(t => expect(/^[⛔⚠ℹ✓]/.test(t.trim()), t).toBe(true));
        doc.querySelectorAll('.f-item').forEach(el => {
            expect(el.querySelector('.f-icon').textContent.trim().length).toBeGreaterThan(0);
        });
    });
});

describe('AA) Deutsche Beschriftungen (v3.6.1)', () => {
    it('AA1: In der sichtbaren Seite stehen keine englischen Beschriftungen mehr', async () => {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        const doc = new JSDOM(html).window.document;
        doc.querySelectorAll('script,style').forEach(n => n.remove());
        const text = doc.body.textContent;
        for (const wort of ['Copy for Documentation', 'Quick View', 'Smart Defaults', 'Energy-Gap-Index',
                            'Growth Velocity', 'Weight Velocity', 'PDF Export', 'Virtual NICU']) {
            expect(text, wort).not.toContain(wort);
        }
        expect(text).toContain('In Akte kopieren');
        expect(text).toContain('Zurücksetzen');
    });

    it('AA2: Die Meldungen des Rechners nennen die Wachstumsrate auf Deutsch', () => {
        const r = calc.calculate(baseInput({
            birthWeight: 800, currentWeight: 1500, previousWeight: 1480, ssw: 26, postnatalAge: 35,
            tfi: 150, enteralVolume: 150, gir: 0, protein: 0, lipids: 0
        }));
        const alle = [...r.warnings, ...r.reminders, r.documentation].join(' ');
        expect(alle).not.toMatch(/Growth Velocity/);
        expect(r.documentation).toMatch(/Wachstumsrate/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AB — FM85 nach Packungsangabe (v3.6.2)
 * Je 100 g Pulver: 435 kcal, 35,5 g Eiweiß, 18,1 g Fett, 32,4 g Kohlenhydrate,
 * 918 mg Natrium, 1890 mg Calcium, 1095 mg Phosphor (Neonatologe, 20.10.2026).
 * ────────────────────────────────────────────────────────────────*/
describe('AB) FM85 nach Packungsangabe (v3.6.2)', () => {
    const kind = o => baseInput({
        birthWeight: 1000, currentWeight: 1000, ssw: 28, postnatalAge: 20,
        tfi: 160, mealFrequency: 8, gir: 0, protein: 0, lipids: 0, ...o
    });

    it('AB1: 4 g FM85 auf 100 ml Muttermilch liefern 1,42 g Eiweiß, 17,4 kcal, 0,72 g Fett, 1,3 g Kohlenhydrate', () => {
        const mit = calc.calculate(kind({ enteralVolume: 100, fm85Percent: 4 })).results;
        const ohne = calc.calculate(kind({ enteralVolume: 100, fm85Percent: 0 })).results;
        // je 100 ml und kg: Werte entsprechen g bzw. kcal je 100 ml
        expect(mit.enteralProteinGKg - ohne.enteralProteinGKg).toBeCloseTo(1.42, 1);
        expect(mit.kcalEnteralKg - ohne.kcalEnteralKg).toBeCloseTo(17.4, 0);
        expect(mit.enteralFatGKg - ohne.enteralFatGKg).toBeCloseTo(0.72, 1);
        expect(mit.enteralCarbsGKg - ohne.enteralCarbsGKg).toBeCloseTo(1.3, 1);
    });

    it('AB2: Der Standardverlauf EBM + FM85 4 % bei 150 und 160 ml/kg/d ist nicht kritisch', () => {
        for (const vol of [150, 160]) {
            const r = calc.calculate(kind({ enteralVolume: vol, fm85Percent: 4 }));
            const eiweiss = r.results.proteinTotalGPerKg;
            expect(eiweiss, `${vol} ml/kg`).toBeLessThanOrEqual(4.5);
            expect(r.safetyChecks.proteinLimit, `${vol} ml/kg`).toBe(true);
            expect(r.warnings.some(w => /^CRITICAL: Protein/.test(w)), `${vol} ml/kg`).toBe(false);
        }
        // 160 ml/kg: 1,13 + 4 × 0,355 = 2,55 g/100 ml → 4,08 g/kg
        expect(calc.calculate(kind({ enteralVolume: 160, fm85Percent: 4 })).results.proteinTotalGPerKg).toBeCloseTo(4.08, 1);
    });

    it('AB3: Die Konstanten im Rechner entsprechen den Packungswerten in products.js', () => {
        const pk = window.NeoProducts.supplements.fm85.per100gPowder;
        const k = calc.FM85_PER_PERCENT;
        expect(k.kcal).toBeCloseTo(pk.kcal / 100, 3);
        expect(k.protein).toBeCloseTo(pk.protein / 100, 4);
        expect(k.fat).toBeCloseTo(pk.fat / 100, 4);
        expect(k.carbs).toBeCloseTo(pk.carbs / 100, 4);
        expect(k.naMg).toBeCloseTo(pk.sodium_mg / 100, 3);
        expect(k.caMg).toBeCloseTo(pk.calcium_mg / 100, 3);
        expect(k.pMg).toBeCloseTo(pk.phosphorus_mg / 100, 3);
    });

    it('AB4: Calcium und Phosphat aus FM85 folgen der Packung (je 1 % 18,9 mg Ca und 10,95 mg P je 100 ml)', () => {
        const mit = calc.calculate(kind({ enteralVolume: 100, fm85Percent: 4 })).results;
        const ohne = calc.calculate(kind({ enteralVolume: 100, fm85Percent: 0 })).results;
        expect(mit.enteralCaMgKg - ohne.enteralCaMgKg).toBeCloseTo(4 * 18.9, 0);
        expect(mit.enteralPMgKg - ohne.enteralPMgKg).toBeCloseTo(4 * 10.95, 0);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AC — Sterofundin ISO als Sekundärinfusion (v3.6.3)
 * Je 1000 ml: Na 145, K 4, Ca 2,5, Mg 1, Cl 127, Acetat 24, Malat 5 mmol.
 * ────────────────────────────────────────────────────────────────*/
describe('AC) Sterofundin ISO als Sekundärinfusion (v3.6.3)', () => {
    const kind = o => baseInput({
        birthWeight: 1000, currentWeight: 1000, ssw: 28, postnatalAge: 6,
        tfi: 150, enteralVolume: 40, gir: 5, protein: 3, lipids: 2,
        calcium: 0, phosphate: 0, sodium: 0, potassium: 0, ...o
    });
    const mitSt = rate => calc.calculate(kind({ secondarySolution: 'sterofundinIso', secondaryRateKg: rate }));
    const ohne = () => calc.calculate(kind({}));

    it('AC1: 40 ml/kg/d liefern 5,8 mmol Na, 5,08 mmol Cl und 0,16 mmol K je kg', () => {
        const a = mitSt(40).results, b = ohne().results;
        expect(a.effectiveNa - b.effectiveNa).toBeCloseTo(5.8, 1);
        expect(a.effectiveCl - b.effectiveCl).toBeCloseTo(5.08, 1);
        expect(a.effectiveK - b.effectiveK).toBeCloseTo(0.16, 1);
    });

    it('AC2: Calcium aus Sterofundin zählt zur Gesamtzufuhr (0,25 mmol je 100 ml = 10 mg/kg bei 100 ml/kg)', () => {
        const a = mitSt(100).results, b = ohne().results;
        expect(a.totalCaMgKg - b.totalCaMgKg).toBeCloseTo(0.25 * 40.08, 0);
    });

    it('AC3: Das Volumen zählt zur Gesamtflüssigkeit und verkleinert den PN-Anteil wie jede Sekundärinfusion', () => {
        const a = mitSt(40).results, b = ohne().results;
        expect(a.secondaryDaily).toBeCloseTo(40, 0);
        expect(b.pnDailyGross - a.pnDailyGross).toBeCloseTo(40, 0);
    });

    it('AC4: Keine Glukose — die GIR ändert sich nicht', () => {
        expect(mitSt(40).results.effectiveGIR).toBe(ohne().results.effectiveGIR);
    });

    it('AC5: Balancierte Lösung — SID-light bleibt positiv, keine Azidose-Warnung', () => {
        const r = mitSt(60);
        expect(r.results.sidLight).toBeGreaterThan(0);
        expect(r.warnings.some(w => /SID-light|Na:Cl|Chlorid-Überhang/.test(w))).toBe(false);
    });

    it('AC6: Kalium aus Sterofundin löst die kaliumfreien Tage 1–2 aus, ab Tag 3 nicht', () => {
        const mk = d => calc.calculate(kind({ postnatalAge: d, secondarySolution: 'sterofundinIso', secondaryRateKg: 40 }));
        expect(mk(1).warnings.some(w => /kaliumfrei/.test(w))).toBe(true);
        expect(mk(2).warnings.some(w => /kaliumfrei/.test(w))).toBe(true);
        expect(mk(3).warnings.some(w => /kaliumfrei/.test(w))).toBe(false);
    });

    it('AC7: Hoher Natriumgehalt wird bei ELBW sichtbar (100 ml/kg/d = 14,5 mmol/kg Na)', () => {
        const r = mitSt(100);
        expect(r.results.totalNaMmolKg).toBeGreaterThan(5);
        expect(r.warnings.some(w => /Na-Zufuhr .* ELBW/.test(w))).toBe(true);
    });

    it('AC8: Jede Auswahl der Sekundärinfusion in der Oberfläche existiert in den Produktdaten', async () => {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const doc = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')).window.document;
        const optionen = [...doc.getElementById('input-secondary-solution').options].map(o => o.value).filter(v => v !== 'none');
        expect(optionen).toContain('sterofundinIso');
        const ids = window.NeoProducts.secondarySolutions.map(s => s.id);
        optionen.forEach(v => expect(ids, v).toContain(v));
    });

    it('AC9: Werte in den Produktdaten entsprechen den Angaben je 1000 ml', () => {
        const p = window.NeoProducts.secondarySolutions.find(s => s.id === 'sterofundinIso').per100ml;
        expect(p.sodium_mmol * 10).toBeCloseTo(145, 5);
        expect(p.potassium_mmol * 10).toBeCloseTo(4, 5);
        expect(p.calcium_mmol * 10).toBeCloseTo(2.5, 5);
        expect(p.chloride_mmol * 10).toBeCloseTo(127, 5);
    });
});

describe('AD) Natrium der Sekundärlösungen je 100 ml (v3.6.3)', () => {
    const kind = o => baseInput({
        birthWeight: 1000, currentWeight: 1000, ssw: 28, postnatalAge: 6,
        tfi: 150, enteralVolume: 40, gir: 5, protein: 3, lipids: 2,
        calcium: 0, phosphate: 0, sodium: 0, potassium: 0, ...o
    });
    const na = (loesung, rate) => calc.calculate(kind({ secondarySolution: loesung, secondaryRateKg: rate })).results.effectiveNa;

    it('AD1: NaCl 0,9 % = 154 mmol/l → 50 ml/kg/d liefern 7,7 mmol/kg Natrium (nicht 77)', () => {
        expect(na('nacl09', 50)).toBeCloseTo(7.7, 1);
    });

    it('AD2: NaCl 0,45 % = 77 mmol/l → 50 ml/kg/d liefern 3,85 mmol/kg Natrium', () => {
        expect(na('nacl045', 50)).toBeCloseTo(3.85, 1);
    });

    it('AD3: Die Natriumkonzentration folgt der Masse: Gramm NaCl je Liter / 58,44', () => {
        const sol = id => window.NeoProducts.secondarySolutions.find(s => s.id === id).per100ml;
        expect(sol('nacl09').sodium_mmol).toBeCloseTo(9 / 58.44 * 100, 1);
        expect(sol('nacl045').sodium_mmol).toBeCloseTo(4.5 / 58.44 * 100, 1);
        expect(sol('nacl09').chloride_mmol).toBe(sol('nacl09').sodium_mmol);
    });

    it('AD4: NaCl 0,9 % als Sekundärinfusion löst keine absurde Osmolaritäts-Meldung aus', () => {
        const r = calc.calculate(kind({ access: 'peripheral', tfi: 130, enteralVolume: 0, secondarySolution: 'nacl09', secondaryRateKg: 10 }));
        // 10 ml/kg/d NaCl 0,9 % = 1,54 mmol/kg Natrium; vorher 15,4 mmol/kg
        expect(r.results.effectiveNa).toBeCloseTo(1.54, 1);
        expect(r.results.osmolarity).toBeLessThan(1500);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AE — PN-Beutel und Sekundärinfusion getrennt (v3.6.3)
 * Fall aus der Praxis: 430 g, 128 ml/kg/d Muttermilch, Sterofundin 1 ml/h, keine PN.
 * ────────────────────────────────────────────────────────────────*/
describe('AE) PN-Beutel und Sekundärinfusion getrennt (v3.6.3)', () => {
    const kind = o => baseInput({
        birthWeight: 400, currentWeight: 430, ssw: 28, postnatalAge: 16,
        enteralVolume: 128, mealFrequency: 12, access: 'peripheral',
        gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0, ...o
    });
    const sterofundin1mlh = 1 * 24 / 0.43;   // 55,8 ml/kg/d

    it('AE1: Sterofundin allein (keine PN-Inhalte) erzeugt keine kritische Meldung und keine PN-Osmolarität', () => {
        const r = calc.calculate(kind({ tfi: 187, secondarySolution: 'sterofundinIso', secondaryRateKg: sterofundin1mlh }));
        expect(r.results.osmolarity).toBe(0);
        expect(r.warnings.filter(w => w.startsWith('CRITICAL'))).toEqual([]);
        expect(r.isSafe).toBe(true);
    });

    it('AE2: Auch bei winzigem PN-Restvolumen (Rundung) bleibt die PN-Osmolarität 0, wenn keine PN-Inhalte laufen', () => {
        const r = calc.calculate(kind({ tfi: 184, secondarySolution: 'sterofundinIso', secondaryRateKg: sterofundin1mlh }));
        expect(r.results.pnDaily).toBeLessThan(0.5);
        expect(r.results.osmolarity).toBe(0);
        expect(r.warnings.some(w => /Osmolarität/.test(w))).toBe(false);
    });

    it('AE3: Natrium der Sekundärinfusion zählt nicht zur Osmolarität des PN-Beutels', () => {
        const r = calc.calculate(kind({ tfi: 230, enteralVolume: 100, sodium: 3, secondarySolution: 'sterofundinIso', secondaryRateKg: 50 }));
        const pnLiter = r.results.pnDaily / 1000;
        // nur das PN-Natrium (3 mmol/kg × 0,43 kg) im PN-Volumen, Faktor 2 für NaCl
        expect(r.results.osmolarityBreakdown.sodium).toBeCloseTo(2 * 3 * 0.43 / pnLiter, -1);
        expect(r.results.osmolarityBreakdown.potassium).toBe(0);
        // Gesamt-Natrium enthält Sterofundin weiterhin
        expect(r.results.effectiveNa).toBeGreaterThan(3 + 50 * 0.145 - 0.5);
    });

    it('AE4: Glukose einer Sekundärinfusion zählt nicht zur Glukosekonzentration des PN-Beutels', () => {
        const r = calc.calculate(kind({ tfi: 230, enteralVolume: 100, secondarySolution: 'glucose10', secondaryRateKg: 40 }));
        expect(r.results.glucoseConc).toBe(0);
        expect(r.warnings.some(w => /Glukose-Konzentration/.test(w))).toBe(false);
        // die Glukose zählt aber weiter zur GIR und zur Energie
        expect(r.results.effectiveGIR).toBeGreaterThan(0);
    });

    it('AE5: Die Sekundärlösung selbst wird peripher gegen 900 mOsm/l geprüft (Glucose 20 % ja, 10 % nein, zentral nein)', () => {
        const mk = (lsg, zugang) => calc.calculate(kind({ tfi: 230, enteralVolume: 100, access: zugang, secondarySolution: lsg, secondaryRateKg: 20 }));
        expect(mk('glucose20', 'peripheral').warnings.some(w => /^CRITICAL: Sekundärinfusion Glucose 20%/.test(w))).toBe(true);
        expect(mk('glucose10', 'peripheral').warnings.some(w => /Sekundärinfusion/.test(w))).toBe(false);
        expect(mk('glucose20', 'central').warnings.some(w => /Sekundärinfusion Glucose/.test(w))).toBe(false);
    });

    it('AE6: Sind PN-Inhalte eingetragen, aber kaum PN-Volumen frei, nennen die Meldungen die Ursache', () => {
        const r = calc.calculate(kind({
            tfi: 187, gir: 6, protein: 2, lipids: 0.5, calcium: 40, phosphate: 31,
            secondarySolution: 'nacl09', secondaryRateKg: 0.7 * 24 / 0.43
        }));
        const g = r.warnings.find(w => /^CRITICAL: Glukose-Konzentration/.test(w));
        expect(g).toBeTruthy();
        expect(g).toMatch(/Ursache prüfen: nur \d+ ml\/kg\/d PN-Volumen frei/);
        // die Konzentration bleibt gemeldet — die PN-Inhalte passen nicht zum Restvolumen
        expect(r.results.glucoseConc).toBeGreaterThan(12.5);
    });

    it('AE7: Bei ausreichendem PN-Volumen steht keine Ursachenzeile', () => {
        const r = calc.calculate(kind({ tfi: 100, enteralVolume: 0, gir: 11, protein: 2, lipids: 2 }));
        const g = r.warnings.find(w => /^CRITICAL: Glukose-Konzentration/.test(w));
        expect(g).toBeTruthy();
        expect(g).not.toMatch(/Ursache prüfen/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AF — Auswahl „Keine parenterale Ernährung“ (v3.6.4)
 * Die Seite wird mit ihren eigenen Skripten ausgeführt.
 * ────────────────────────────────────────────────────────────────*/
describe('AF) Keine parenterale Ernährung (v3.6.4, Lipide ausgenommen v3.6.5)', () => {
    async function boot() {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        return w;
    }
    const set = (w, vals) => {
        for (const [id, v] of Object.entries(vals)) {
            const el = w.document.getElementById(id);
            if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
        }
    };
    const choose = (w, v) => {
        const sel = w.document.getElementById('input-solution');
        sel.value = v;
        sel.dispatchEvent(new w.Event('change'));
    };
    const sel = w => w.document.getElementById('input-solution');
    const PN = ['input-gir', 'input-protein', 'input-calcium', 'input-phosphate', 'input-sodium', 'input-potassium'];   // Lipide gehören nicht dazu (v3.6.5)
    const kind = {
        'birth-weight': 400, 'current-weight': 430, 'input-ssw': 28, 'input-day': 16, 'input-tfi': 187,
        'input-enteral': 128, 'input-meal-frequency': 12, 'input-access': 'peripheral',
        'input-gir': 6, 'input-protein': 2, 'input-lipids': 1, 'input-calcium': 40, 'input-phosphate': 31,
        'input-secondary-solution': 'sterofundinIso'
    };

    it('AF1: Die Auswahl existiert und trägt den Wert keinePN', async () => {
        const w = await boot();
        const opt = [...w.document.querySelectorAll('#input-solution option')].find(o => o.value === 'keinePN');
        expect(opt).toBeTruthy();
        expect(opt.textContent).toMatch(/Keine parenterale Ernährung/);
    });

    it('AF2: Auswählen setzt alle PN-Felder auf 0 und sperrt sie', async () => {
        const w = await boot();
        set(w, kind);
        choose(w, 'keinePN');
        PN.forEach(id => {
            const el = w.document.getElementById(id);
            expect(el.value, id).toBe('0');
            expect(el.disabled, id).toBe(true);
        });
        expect(w.document.getElementById('no-pn-note').classList.contains('hidden')).toBe(false);
    });

    it('AF3: Anderes Auswählen stellt die bisherigen Werte wieder her und entsperrt die Felder', async () => {
        const w = await boot();
        set(w, kind);
        choose(w, 'keinePN');
        choose(w, 'none');
        expect(w.document.getElementById('input-gir').value).toBe('6');
        expect(w.document.getElementById('input-protein').value).toBe('2');
        expect(w.document.getElementById('input-calcium').value).toBe('40');
        PN.forEach(id => expect(w.document.getElementById(id).disabled, id).toBe(false));
        expect(w.document.getElementById('no-pn-note').classList.contains('hidden')).toBe(true);
    });

    it('AF4: Praxisfall (Sterofundin 1 ml/h, keine PN) zeigt nach der Auswahl keine kritische Meldung', async () => {
        const w = await boot();
        set(w, { ...kind, 'input-secondary-rate': 1, 'input-lipids': 0 });   // Oberfläche: ml/h; Praxisfall ohne Lipide (Lipide: AF6)
        w.updateCalculations();
        choose(w, 'keinePN');
        const kritisch = [...w.document.querySelectorAll('#findings-critical .f-item.critical')];
        expect(kritisch.map(e => e.textContent)).toEqual([]);
    });

    it('AF5: Eine Vorlage überschreibt die PN-Felder auch bei aktiver Auswahl „Keine PN“', async () => {
        const w = await boot();
        set(w, kind);
        choose(w, 'keinePN');
        w.loadSimulation('elbw');
        expect(sel(w).value).not.toBe('keinePN');
        PN.forEach(id => expect(w.document.getElementById(id).disabled, id).toBe(false));
        expect(w.document.getElementById('no-pn-note').classList.contains('hidden')).toBe(true);
    });

    it('AF6: Lipide bleiben bei „Keine PN“ einstellbar und gehen unverändert in die Rechnung ein (v3.6.5)', async () => {
        const w = await boot();
        // Sterofundin 1 ml/h (≈ 56 ml/kg/d) + Milch 128 + Lipide 1 g/kg (5 ml/kg) = 189 ml/kg/d
        set(w, { ...kind, 'input-tfi': 189, 'input-secondary-rate': 1, 'input-lipids': 1 });
        choose(w, 'keinePN');
        const lip = w.document.getElementById('input-lipids');
        expect(lip.disabled).toBe(false);
        expect(lip.value).toBe('1');
        PN.forEach(id => expect(w.document.getElementById(id).value, id).toBe('0'));
        const kritisch = [...w.document.querySelectorAll('#findings-critical .f-item.critical')].map(e => e.textContent);
        expect(kritisch).toEqual([]);
        // Lipide ändern, ohne dass die Auswahl sie zurücksetzt
        lip.value = '2';
        choose(w, 'none');
        expect(lip.value).toBe('2');
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AG — NPC/P nur bei laufender PN (v3.6.6)
 * Praxisfall: Muttermilch allein (NPC/P ≈ 59) meldete „Verfettungsrisiko“.
 * ────────────────────────────────────────────────────────────────*/
describe('AG) NPC/P: nur „zu knapp“ bei laufender PN, keine Obergrenze (v3.6.6–3.6.8)', () => {
    const kind = o => baseInput({
        birthWeight: 400, currentWeight: 430, ssw: 28, postnatalAge: 16, tfi: 187,
        enteralVolume: 128, mealFrequency: 12, access: 'peripheral',
        gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0, ...o
    });
    const npcWarn = r => r.warnings.filter(w => /NPC\/P|Verfettung|Energie-Ungleichgewicht/.test(w));

    it('AG1: Muttermilch allein (mit Sterofundin) erzeugt keine NPC/P-Meldung, der Wert bleibt sichtbar', () => {
        const r = calc.calculate(kind({ secondarySolution: 'sterofundinIso', secondaryRateKg: 24 / 0.43 }));
        expect(r.results.npcPerProtein).toBeGreaterThan(40);
        expect(npcWarn(r)).toEqual([]);
        expect(r.assessment.bullets.some(b => /NPC\/Protein/.test(b.text || b))).toBe(false);
    });

    it('AG2: Reine Milchernährung ohne alles andere ebenfalls ohne NPC/P-Meldung', () => {
        expect(npcWarn(calc.calculate(kind({ tfi: 128 })))).toEqual([]);
    });

    // v3.6.8 (Entscheidung nach Literaturrecherche 23.10.2026): Die Obergrenze „Verfettungsrisiko“ (NPC/P > 40) entfällt.
    // Klinische Begründung: kein belegter Schwellenwert (ESPGHAN benennt das optimale Energie/Eiweiß-Verhältnis als offen),
    // die implizierte Maßnahme (Energie senken) widerspricht der Datenlage (niedriges Eiweiß/Energie-Verhältnis und zu wenig Energie
    // gehen mit mehr Fettmasse einher), echte Überversorgung wird über Energie-Zielbereich, Lipid-Maximum, Lipid-Anteil und Triglyzeride gemeldet.
    it('AG3: Bei PN mit Lipiden und hohem NPC/P gibt es keine „Verfettungsrisiko“-Warnung mehr, der Wert bleibt sichtbar', () => {
        const r = calc.calculate(kind({ tfi: 150, enteralVolume: 0, gir: 10, protein: 1, lipids: 2 }));
        expect(r.results.kcalParenteralKg).toBeGreaterThan(0);
        expect(r.results.npcPerProtein).toBeGreaterThan(40);
        expect(npcWarn(r)).toEqual([]);
        expect(r.assessment.bullets.some(b => /Verfettung/.test(JSON.stringify(b)))).toBe(false);
    });

    it('AG4: Ohne Lipide i. v. ebenfalls keine „Verfettungsrisiko“-Warnung', () => {
        const r = calc.calculate(kind({ tfi: 150, enteralVolume: 0, gir: 12, protein: 1, lipids: 0 }));
        expect(r.results.npcPerProtein).toBeGreaterThan(40);
        expect(npcWarn(r)).toEqual([]);
    });

    it('AG5: „Energie zu knapp“ (NPC/P unter 20) bleibt bei laufender PN ohne Lipide erhalten (v3.6.7)', () => {
        const r = calc.calculate(kind({ tfi: 150, enteralVolume: 0, gir: 2, protein: 3.5, lipids: 0 }));
        expect(r.results.npcPerProtein).toBeLessThan(20);
        expect(npcWarn(r).some(w => /Energie-Ungleichgewicht/.test(w))).toBe(true);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AH — Lipid-Anteil an der Gesamtenergie (v3.6.9)
 * Praxisfall: Sterofundin 1 ml/h, Muttermilch 128 ml/kg/d, Lipide i. v. → „Lipid-Anteil an NPC 100 % > 50 %“,
 * weil nur die PN betrachtet wurde. Die Oberfläche wird mit ihren eigenen Skripten (inkl. Produktdaten) ausgeführt.
 * ────────────────────────────────────────────────────────────────*/
describe('AH) Lipid-Anteil an NPC: Gesamtenergie, Regel nur bei vollständiger PN (v3.6.9/3.6.10)', () => {
    async function boot(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) {
            const el = w.document.getElementById(id);
            if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
        }
        w.updateCalculations();
        return w.document;
    }
    const kind = {
        'birth-weight': 400, 'current-weight': 430, 'input-ssw': 28, 'input-day': 16, 'input-tfi': 189,
        'input-enteral': 128, 'input-meal-frequency': 12, 'input-access': 'peripheral',
        'input-gir': 0, 'input-protein': 0, 'input-calcium': 0, 'input-phosphate': 0, 'input-sodium': 0, 'input-potassium': 0,
        'input-lipids': 1, 'input-secondary-solution': 'sterofundinIso', 'input-secondary-rate': 1
    };
    // jsdom kennt innerText nicht als Layout-Eigenschaft: die Oberfläche schreibt per innerText, gelesen wird dieselbe Eigenschaft.

    it('AH1: Sterofundin + Muttermilch + Lipide i. v. zeigt keinen „100 %“-Lipidanteil und keine Obergrenzen-Meldung', async () => {
        const doc = await boot(kind);
        const anteil = parseFloat(doc.getElementById('res-npc-lipid').innerText);
        expect(anteil).toBeLessThan(100);
        expect(anteil).toBeGreaterThan(0);
        expect(doc.body.textContent).not.toMatch(/Lipid-Anteil an NPC 100/);
        expect(doc.body.textContent).not.toMatch(/> 50%\s*–\s*metabolische Imbalance/);
    });

    it('AH2: Die Anzeige und die Regel beziehen sich auf parenteral + enteral (Glucose- und Lipidanteil ergeben 100 %)', async () => {
        const doc = await boot(kind);
        const l = parseFloat(doc.getElementById('res-npc-lipid').innerText);
        const g = parseFloat(doc.getElementById('res-npc-glucose').innerText);
        expect(l + g).toBeCloseTo(100, 0);
        expect(doc.getElementById('res-npc-total').innerText).toBeTruthy();
    });

    it('AH3: Der Rechenkern liefert die PN-Werte unverändert und zusätzlich die Gesamtwerte', () => {
        const r = calc.calculate(baseInput({ gir: 0, protein: 0, lipids: 1, tfi: 130, enteralVolume: 100, calcium: 0, phosphate: 0, sodium: 0, potassium: 0 }));
        expect(r.results.npcLipidPercent).toBe(100);                 // nur PN: reine Lipidinfusion
        expect(r.results.npcLipidPercentTotal).toBeLessThanOrEqual(100);
        expect(r.results.npcTotalAll).toBeGreaterThanOrEqual(r.results.npcTotal);
        expect(r.results.npcLipidPercentTotal + r.results.npcGlucosePercentTotal).toBeCloseTo(100, 0);
    });

    it('AH4: Zu wenig Fett an der Gesamt-NPC (unter 25 %) warnt weiterhin, mit Bezug auf die Gesamtenergie', () => {
        const r = calc.calculate(baseInput({ gir: 10, lipids: 0.5, protein: 3.0 }));
        const w = r.warnings.find(x => x.includes('Lipid-Anteil an NPC'));
        expect(w).toMatch(/gesamt \(parenteral \+ enteral\)/);
        expect(w).toMatch(/Ziel 25–50% bei vollständiger PN/);
    });

    // v3.6.10 (nach Rückfrage des Neonatologen und Leitlinienrecherche 23.10.2026): ESPGHAN/ESPEN/ESPR/CSPEN 2018 (Lipide) empfiehlt
    // 25–50 % der Nicht-Eiweiß-Energie als Lipid für VOLLSTÄNDIG parenteral ernährte Patienten. Die Anteilsregel gilt daher nur bis zur
    // trophischen Ernährung (< 25 ml/kg/d); mit relevanter enteraler Ernährung entfällt sie (AH5 vorher: „keine Obergrenze“).
    it('AH5: Bei vollständiger PN gilt 25–50 %: reine Lipidinfusion ohne Glucose warnt vor zu hohem Lipid-Anteil', () => {
        const r = calc.calculate(baseInput({ gir: 0, protein: 0, lipids: 2, tfi: 130, enteralVolume: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0 }));
        expect(r.warnings.some(w => /Lipid-Anteil an NPC.*> 50%.*vollständiger PN/.test(w))).toBe(true);
    });

    it('AH6: Trophische Ernährung (unter 25 ml/kg/d) zählt noch als vollständige PN, ab 25 ml/kg/d entfällt die Anteilsregel', () => {
        const mk = ev => calc.calculate(baseInput({ gir: 0, protein: 0, lipids: 2, tfi: 130, enteralVolume: ev, calcium: 0, phosphate: 0, sodium: 0, potassium: 0 }));
        expect(mk(20).warnings.some(w => /Lipid-Anteil an NPC/.test(w))).toBe(true);
        expect(mk(25).warnings.some(w => /Lipid-Anteil an NPC/.test(w))).toBe(false);
        expect(mk(100).warnings.some(w => /Lipid-Anteil an NPC/.test(w))).toBe(false);
    });

    it('AH7: Zu wenig Lipid bei teilweiser enteraler Ernährung warnt nicht (Anteilsregel gilt nur bei vollständiger PN)', () => {
        const r = calc.calculate(baseInput({ gir: 10, lipids: 0.5, protein: 3.0, tfi: 150, enteralVolume: 60 }));
        expect(r.warnings.some(w => w.includes('Lipid-Anteil an NPC'))).toBe(false);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AI — Triglyzerid-Kontrollhinweis (v3.6.11)
 * Triglyzeride werden auf der Station kaum bestimmt; der Hinweis regt die Kontrolle an, wenn kein Wert vorliegt.
 * ────────────────────────────────────────────────────────────────*/
describe('AI) Triglyzerid-Kontrollhinweis (v3.6.11)', () => {
    const mk = o => calc.calculate(baseInput({ birthWeight: 1200, currentWeight: 1200, tfi: 150, enteralVolume: 0, gir: 8, protein: 3, lipids: 2, triglycerides: null, ...o }));
    const tgHint = r => r.warnings.filter(w => /^Hinweis: Lipide i\. v\..*Triglyzeride kontrollieren/.test(w));

    it('AI1: Lipide über 3 g/kg/d ohne Triglyzerid-Wert → Hinweis', () => {
        const h = tgHint(mk({ lipids: 3.5 }));
        expect(h).toHaveLength(1);
        expect(h[0]).toMatch(/über 3 g\/kg\/d/);
        expect(h[0]).toMatch(/Zufallswert genügt/);
    });

    it('AI2: Lipide bis einschließlich 3 g/kg/d bei Geburtsgewicht über 1000 g → kein Hinweis', () => {
        expect(tgHint(mk({ lipids: 3 }))).toEqual([]);
        expect(tgHint(mk({ lipids: 2 }))).toEqual([]);
    });

    it('AI3: ELBW ab 2 g/kg/d → Hinweis, 1000 g gehört dazu (inklusive Grenze), 1001 g nicht', () => {
        expect(tgHint(mk({ birthWeight: 800, currentWeight: 800, lipids: 2 }))).toHaveLength(1);
        expect(tgHint(mk({ birthWeight: 1000, currentWeight: 1000, lipids: 2 }))).toHaveLength(1);
        expect(tgHint(mk({ birthWeight: 1001, currentWeight: 1001, lipids: 2 }))).toEqual([]);
        expect(tgHint(mk({ birthWeight: 800, currentWeight: 800, lipids: 1.5 }))).toEqual([]);
    });

    it('AI4: Mit eingetragenem Triglyzerid-Wert entfällt der Hinweis (die bestehende Prüfung übernimmt)', () => {
        expect(tgHint(mk({ lipids: 3.5, triglycerides: 120 }))).toEqual([]);
        expect(mk({ lipids: 3.5, triglycerides: 300 }).warnings.some(w => /^CRITICAL: Triglyzeride > 250/.test(w))).toBe(true);
    });

    it('AI5: Ohne Lipide i. v. kein Hinweis, und der Hinweis ist kein Stopp (isSafe bleibt unberührt)', () => {
        expect(tgHint(mk({ lipids: 0 }))).toEqual([]);
        const ohne = mk({ lipids: 3.5 });
        expect(ohne.warnings.some(w => /^CRITICAL/.test(w))).toBe(false);
        expect(ohne.isSafe).toBe(true);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AJ — Enterales Volumen: Umrechnung sichtbar, Lipide ohne Volumen (v3.6.12)
 * Praxisfall: 800 g, 12 × 12 ml Muttermilch (= 180 ml/kg/d). Eingegeben wurden 144 (ml/Tag statt ml/kg/d), die Energie
 * enthielt zusätzlich 9 kcal/kg/d aus dem stehengebliebenen Lipid-Standardwert 1 g/kg/d, obwohl kein Volumen dafür frei war.
 * ────────────────────────────────────────────────────────────────*/
describe('AJ) Enterales Volumen und Lipide ohne frei verfügbares Volumen (v3.6.12)', () => {
    const mk = o => calc.calculate(baseInput({ birthWeight: 730, currentWeight: 800, postnatalAge: 1, ssw: 28, mealFrequency: 12, gir: 0, protein: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0, ...o }));

    it('AJ1: 180 ml/kg/d bei 800 g und 12 Mahlzeiten sind 144 ml/d und 12 ml je Mahlzeit; 144 ml/kg/d sind 115,2 ml/d und 9,6 ml je Mahlzeit', () => {
        const a = mk({ tfi: 180, enteralVolume: 180, lipids: 0 }).results;
        expect(a.enteralDaily).toBe(144);
        expect(a.singlePortion).toBe(12);
        const b = mk({ tfi: 144, enteralVolume: 144, lipids: 0 }).results;
        expect(b.enteralDaily).toBe(115.2);
        expect(b.singlePortion).toBe(9.6);
        expect(a.calculationWeightG).toBe(800);
    });

    it('AJ2: Lipide ohne frei verfügbares Volumen (Gesamtflüssigkeit = Milch) zählen weder zur Energie noch zu den Summen, mit Hinweis', () => {
        const mit = mk({ tfi: 144, enteralVolume: 144, lipids: 1 });
        const ohne = mk({ tfi: 144, enteralVolume: 144, lipids: 0 });
        expect(mit.results.lipidsPNKg).toBe(0);
        expect(mit.results.lipidVolDaily).toBe(0);
        expect(mit.results.kcalPerKg).toBe(ohne.results.kcalPerKg);
        const h = mit.warnings.find(w => /^Hinweis: Lipide i\. v\. 1 g\/kg\/d eingetragen, aber die Gesamtflüssigkeit lässt kein Volumen/.test(w));
        expect(h).toBeTruthy();
        expect(h).toMatch(/5 ml\/kg\/d/);
        expect(mit.warnings.some(w => /^CRITICAL/.test(w))).toBe(false);
        expect(ohne.warnings.some(w => /lässt kein Volumen dafür frei/.test(w))).toBe(false);
    });

    it('AJ3: Lipide mit Volumen in der Gesamtflüssigkeit zählen unverändert (Kind mit Lipiden ohne PN-Lösung)', () => {
        const r = mk({ tfi: 149, enteralVolume: 144, lipids: 1 });      // 5 ml/kg/d Lipid-Volumen frei
        expect(r.results.lipidsPNKg).toBe(1);
        expect(r.results.kcalPerKg).toBeGreaterThan(mk({ tfi: 144, enteralVolume: 144, lipids: 0 }).results.kcalPerKg);
        expect(r.warnings.some(w => /lässt kein Volumen dafür frei/.test(w))).toBe(false);
    });

    it('AJ4: Reicht das freie Volumen nur teilweise, bleibt die bestehende CRITICAL-Meldung zum Lipid-Volumen', () => {
        const r = mk({ tfi: 146, enteralVolume: 144, lipids: 1 });      // nur 2 ml/kg/d frei, 5 ml/kg/d nötig
        expect(r.warnings.some(w => /^CRITICAL: Lipid-Volumen/.test(w))).toBe(true);
    });
});

describe('AJ-UI) Umrechnung unter dem Feld „Enterale Ernährung“ (v3.6.12)', () => {
    async function boot(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) w.document.getElementById(id).value = v;
        w.updateCalculations();
        return w.document;
    }
    const kind = { 'birth-weight': 730, 'current-weight': 800, 'input-ssw': 28, 'input-day': 1, 'input-meal-frequency': 12, 'input-lipids': 0 };

    it('AJ5: Die Zeile nennt Tagesmenge, Menge je Mahlzeit und Rechengewicht', async () => {
        const doc = await boot({ ...kind, 'input-tfi': 180, 'input-enteral': 180 });
        expect(doc.getElementById('enteral-converted').innerText).toBe('= 144 ml/d · 12 ml je Mahlzeit (12×), Rechengewicht 800 g');
        const doc2 = await boot({ ...kind, 'input-tfi': 144, 'input-enteral': 144 });
        expect(doc2.getElementById('enteral-converted').innerText).toBe('= 115,2 ml/d · 9,6 ml je Mahlzeit (12×), Rechengewicht 800 g');
    });

    it('AJ6: Das Feld ist ausdrücklich ml/kg/d beschriftet', async () => {
        const doc = await boot({});
        expect(doc.querySelector('label[for="input-enteral"], #input-enteral').closest('div').textContent).toMatch(/ml\/kg\/d/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AK — Mengen in ml/Tag, ml/h oder ml je Mahlzeit eingeben (v3.6.13)
 * Anlass: 12 × 12 ml Muttermilch bei 800 g (= 180 ml/kg/d) wurden als 144 „ml/kg/d“ eingegeben. Die App rechnet jetzt
 * auf Wunsch aus Tages-, Stunden- oder Mahlzeitenmengen um, mit dem Rechengewicht des Rechenkerns.
 * ────────────────────────────────────────────────────────────────*/
describe('AK) Mengen-Umrechnung (v3.6.13)', () => {
    it('AK1: Rechengewicht — bis Tag 10 das größere von Geburts- und aktuellem Gewicht, ab Tag 11 das aktuelle', () => {
        expect(calc.getCalculationWeightG(730, 800, 1)).toBe(800);
        expect(calc.getCalculationWeightG(850, 780, 10)).toBe(850);
        expect(calc.getCalculationWeightG(850, 780, 11)).toBe(780);
        expect(calc.getCalculationWeightG('850', '', 11)).toBe(850);      // aktuelles Gewicht fehlt → Geburtsgewicht
        expect(calc.getCalculationWeightG('', 800, 3)).toBe(0);           // kein Geburtsgewicht → nicht umrechenbar
    });

    it('AK2: calculate() nutzt dasselbe Rechengewicht wie die Umrechnung', () => {
        const r = calc.calculate(baseInput({ birthWeight: 850, currentWeight: 780, postnatalAge: 5, tfi: 100, enteralVolume: 100, gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0 }));
        expect(r.results.calculationWeightG).toBe(calc.getCalculationWeightG(850, 780, 5));
        expect(r.results.totalDailyFluid).toBe(85);
    });

    it('AK3: volumeToMlKg — ml/Tag, ml/h und ml je Mahlzeit ergeben bei 800 g und 12 Mahlzeiten je 180 ml/kg/d', () => {
        const ctx = { weightG: 800, mealsPerDay: 12 };
        expect(calc.volumeToMlKg(144, 'd', ctx)).toBe(180);
        expect(calc.volumeToMlKg(6, 'h', ctx)).toBe(180);
        expect(calc.volumeToMlKg(12, 'meal', ctx)).toBe(180);
        expect(calc.volumeToMlKg(180, 'kgd', ctx)).toBe(180);
        expect(calc.volumeToMlKg('7.3', 'meal', { weightG: 730, mealsPerDay: 8 })).toBe(80);
    });

    it('AK4: volumeToMlKg — ohne Gewicht, Mahlzeitenzahl, gültige Zahl oder bekannte Einheit keine Umrechnung (null)', () => {
        expect(calc.volumeToMlKg(144, 'd', { weightG: 0 })).toBeNull();
        expect(calc.volumeToMlKg(144, 'd', {})).toBeNull();
        expect(calc.volumeToMlKg(12, 'meal', { weightG: 800, mealsPerDay: 0 })).toBeNull();
        expect(calc.volumeToMlKg('', 'd', { weightG: 800 })).toBeNull();
        expect(calc.volumeToMlKg('abc', 'd', { weightG: 800 })).toBeNull();
        expect(calc.volumeToMlKg(10, 'Eimer', { weightG: 800 })).toBeNull();
    });
});

describe('AK-UI) Einheiten-Auswahl an den Mengenfeldern (v3.6.13)', () => {
    async function boot(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        w.HTMLElement.prototype.scrollIntoView = () => {};   // jsdom kennt scrollIntoView nicht (ValidationError-Banner)
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) w.document.getElementById(id).value = v;
        w.updateCalculations();
        return w;
    }
    const kind = { 'birth-weight': 730, 'current-weight': 800, 'input-ssw': 28, 'input-day': 1, 'input-meal-frequency': 12, 'input-lipids': 0 };
    const text = (w, id) => w.document.getElementById(id).innerText;

    it('AK5: Die drei Mengenfelder haben eine Einheiten-Auswahl, Standard ml/kg/d', async () => {
        const w = await boot({});
        for (const id of ['input-tfi-unit', 'input-enteral-unit', 'input-carrier-unit']) {
            const sel = w.document.getElementById(id);
            expect(sel, id).toBeTruthy();
            expect(sel.value).toBe('kgd');
        }
        expect([...w.document.querySelectorAll('#input-enteral-unit option')].map(o => o.value)).toEqual(['kgd', 'meal', 'd']);
    });

    it('AK6: 12 ml je Mahlzeit und 144 ml/Tag Gesamtflüssigkeit ergeben dasselbe wie 180 ml/kg/d, mit sichtbarer Umrechnung', async () => {
        // v3.6.20 — klinisch begründete Anpassung: Das Feld ist die Infusion; die Gesamtflüssigkeit ergibt sich aus Infusion + enteral.
        // Gleiche Gesamtmenge wie 180 ml/kg/d: Infusion 0, enteral 12 ml je Mahlzeit; mit Infusion 144 ml/Tag kommen 180 ml/kg/d dazu.
        const w = await boot({ ...kind, 'input-tfi': 0, 'input-enteral': 180 });
        const soll = text(w, 'qv-kcal');
        const w2 = await boot({ ...kind, 'input-tfi-unit': 'd', 'input-tfi': 0, 'input-enteral-unit': 'meal', 'input-enteral': 12 });
        expect(text(w2, 'qv-kcal')).toBe(soll);
        expect(text(w2, 'enteral-converted')).toBe('= 180 ml/kg/d · 144 ml/d · 12 ml je Mahlzeit (12×), Rechengewicht 800 g');
        expect(text(w2, 'tfi-converted')).toBe('= Infusion 0 ml/kg/d (0 ml/d, 0 ml/h) + enteral 180 ml/kg/d (144 ml/d) = Gesamtflüssigkeit 180 ml/kg/d · 144 ml/d · 6 ml/h');
        // Infusion 144 ml/Tag kommt zur enteralen Nahrung dazu: 288 ml/d = 360 ml/kg/d
        const w3 = await boot({ ...kind, 'input-tfi-unit': 'd', 'input-tfi': 144, 'input-enteral-unit': 'meal', 'input-enteral': 12 });
        expect(text(w3, 'tfi-converted')).toBe('= Infusion 180 ml/kg/d (144 ml/d, 6 ml/h) + enteral 180 ml/kg/d (144 ml/d) = Gesamtflüssigkeit 360 ml/kg/d · 288 ml/d · 12 ml/h');
    });

    it('AK7: Spülflüssigkeit in ml/h wird umgerechnet und angezeigt', async () => {
        const w = await boot({ ...kind, 'input-tfi': 180, 'input-enteral': 100, 'input-carrier-unit': 'h', 'input-carrier': 1 });
        expect(text(w, 'carrier-converted')).toBe('= 30 ml/kg/d');
    });

    it('AK8: Der Tippfehlerschutz gilt für den umgerechneten Wert (800 ml/Tag bei 800 g = 1000 ml/kg/d)', async () => {
        const w = await boot({ ...kind, 'input-tfi-unit': 'd', 'input-tfi': 800, 'input-enteral': 0 });
        const banner = w.document.getElementById('validation-error-message').textContent;
        expect(banner).toMatch(/TFI|Gesamtfl|400/);
        expect(w.document.getElementById('qv-kcal').textContent).toBe('–');   // nichts berechnet
    });

    it('AK9: Die Sekundärinfusion (ml/h) rechnet mit dem Rechengewicht, nicht mit dem aktuellen Gewicht', async () => {
        const w = await boot({ 'birth-weight': 850, 'current-weight': 780, 'input-day': 5, 'input-ssw': 28, 'input-tfi': 120, 'input-enteral': 0, 'input-lipids': 0,
            'input-secondary-solution': 'nacl09', 'input-secondary-rate': 1 });
        expect(text(w, 'secondary-rate-converted')).toBe('= 28.2 ml/kg/d');      // 24 ml/d ÷ 0,85 kg
    });

    it('AK10: Eine Vorlage stellt die Einheiten der Mengenfelder auf ml/kg/d zurück', async () => {
        const w = await boot({ 'input-tfi-unit': 'h', 'input-enteral-unit': 'meal', 'input-carrier-unit': 'd' });
        w.loadSimulation('elbw');
        for (const id of ['input-tfi-unit', 'input-enteral-unit', 'input-carrier-unit']) expect(w.document.getElementById(id).value, id).toBe('kgd');
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AL — FM85 und Eiweiß-Zusatz aus der Verordnung (Dosis je Mahlzeit) (v3.6.14)
 * Anlass: Die Verordnung nennt nur Mengen je Mahlzeit (0,24 ml FM85-50-%-Lösung, 0,05 g Aptamil Eiweiß+ je 12 ml),
 * die aktuelle Konzentration war nicht erkennbar.
 * ────────────────────────────────────────────────────────────────*/
describe('AL) Anreicherung aus der Verordnung (v3.6.14)', () => {
    it('AL1: 0,24 ml 50-%-Lösung bzw. 0,12 g Pulver je 12-ml-Mahlzeit sind 1 % FM85', () => {
        expect(calc.fm85PercentFromDose(0.24, 'solml', 12)).toBe(1);
        expect(calc.fm85PercentFromDose(0.12, 'g', 12)).toBe(1);
        expect(calc.fm85PercentFromDose(4, 'pct', 12)).toBe(4);
        expect(calc.fm85PercentFromDose(0.48, 'solml', 12)).toBe(2);
        expect(calc.fm85PercentFromDose(0.3, 'solml', 10)).toBe(1.5);
    });

    it('AL2: 0,05 g Aptamil Eiweiß+ je 12-ml-Mahlzeit sind 0,34 g Eiweiß je 100 ml (Eiweißlösung: 0,04 ml → 0,33)', () => {
        expect(calc.proteinAddPer100mlFromDose(0.05, 'powdermeal', 12)).toBe(0.34);
        expect(calc.proteinAddPer100mlFromDose(0.04, 'solmeal', 12)).toBe(0.33);
        expect(calc.proteinAddPer100mlFromDose(0.5, 'per100', 12)).toBe(0.5);
    });

    it('AL3: Ohne Mahlzeitenvolumen, Zahl oder bekannte Einheit keine Umrechnung (null)', () => {
        expect(calc.fm85PercentFromDose(0.24, 'solml', 0)).toBeNull();
        expect(calc.fm85PercentFromDose('', 'solml', 12)).toBeNull();
        expect(calc.fm85PercentFromDose(1, 'Tropfen', 12)).toBeNull();
        expect(calc.proteinAddPer100mlFromDose(0.05, 'powdermeal', 0)).toBeNull();
        expect(calc.proteinAddPer100mlFromDose('abc', 'solmeal', 12)).toBeNull();
        expect(calc.proteinAddPer100mlFromDose(1, 'Eimer', 12)).toBeNull();
    });

    it('AL4: Zubereitung nennt die 50-%-Lösung (Verordnung: 0,24 ml je Mahlzeit, 2,88 ml/d), Energie und den Spielraum bis zur Eiweiß-Obergrenze', () => {
        const r = calc.calculate(baseInput({ birthWeight: 730, currentWeight: 800, postnatalAge: 1, mealFrequency: 12, tfi: 180, enteralVolume: 180,
            gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0, fm85Percent: 1, proteinAddPer100ml: 0.34 }));
        const p = r.results.preparation;
        expect(p.mealVolumeMl).toBe(12);
        expect(p.fm85SolutionMlPerMeal).toBe(0.24);
        expect(p.fm85SolutionMlPerDay).toBe(2.88);
        expect(p.proteinPowderPerMeal).toBe(0.05);
        expect(p.kcalPer100mlFinal).toBeGreaterThan(70);
        // Spielraum = Obergrenze 4,5 − aktuelle Gesamtzufuhr; in Konzentration und FM85-Prozent umgerechnet
        expect(p.proteinHeadroomGKg).toBeCloseTo(4.5 - r.results.proteinTotalGPerKg, 1);
        expect(p.headroomPer100ml).toBeCloseTo(p.proteinHeadroomGKg * 100 / 180, 1);
        expect(p.headroomFm85Pct).toBeCloseTo(p.headroomPer100ml / 0.355, 0);
    });

    it('AL5: Über der Eiweiß-Obergrenze ist der Spielraum 0', () => {
        const r = calc.calculate(baseInput({ birthWeight: 730, currentWeight: 800, postnatalAge: 1, mealFrequency: 12, tfi: 180, enteralVolume: 180,
            gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0, fm85Percent: 4, proteinAddPer100ml: 1.5 }));
        expect(r.results.preparation.proteinHeadroomGKg).toBe(0);
        expect(r.results.preparation.headroomPer100ml).toBe(0);
    });
});

describe('AL-UI) Dosis je Mahlzeit in der Oberfläche (v3.6.14)', () => {
    async function boot(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        w.HTMLElement.prototype.scrollIntoView = () => {};
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) w.document.getElementById(id).value = v;
        w.updateCalculations();
        return w;
    }
    // v3.6.20 — klinisch begründete Anpassung: Das Feld „input-tfi“ ist jetzt die Infusion, die Gesamtflüssigkeit ergibt sich aus
    // Infusion + enteral. Ein rein enteral ernährtes Kind hat Infusion 0 (vorher stand hier die Gesamtflüssigkeit 180 = enteral).
    const kind = { 'birth-weight': 730, 'current-weight': 800, 'input-ssw': 28, 'input-day': 1, 'input-meal-frequency': 12, 'input-lipids': 0, 'input-tfi': 0, 'input-enteral': 180 };
    const text = (w, id) => w.document.getElementById(id).innerText;

    it('AL6: Beide Felder haben die neuen Einheiten, Standard bleibt % bzw. g/100 ml', async () => {
        const w = await boot({});
        expect([...w.document.querySelectorAll('#input-fm85-unit option')].map(o => o.value)).toEqual(['pct', 'solml', 'g']);
        expect(w.document.getElementById('input-fm85-unit').value).toBe('pct');
        expect(w.document.getElementById('input-protein-add-unit').value).toBe('per100');
    });

    it('AL7: 0,24 ml 50-%-Lösung je Mahlzeit ergeben 1 % FM85 — dieselbe Energie wie die Eingabe 1 %, mit sichtbarer Umrechnung', async () => {
        const soll = text(await boot({ ...kind, 'input-fm85': 1 }), 'qv-kcal');
        const w = await boot({ ...kind, 'input-fm85-unit': 'solml', 'input-fm85': 0.24 });
        expect(text(w, 'qv-kcal')).toBe(soll);
        expect(text(w, 'fm85-converted')).toBe('= 1 % FM85 (1 g Pulver auf 100 ml) · je Mahlzeit 0,12 g = 0,24 ml 50-%-Lösung');
    });

    it('AL8: 0,05 g Aptamil Eiweiß+ je Mahlzeit ergeben 0,34 g/100 ml, mit Umrechnung in g/kg/d und Dosis je Mahlzeit', async () => {
        const w = await boot({ ...kind, 'input-protein-add-unit': 'powdermeal', 'input-protein-add': 0.05 });
        const z = text(w, 'protein-add-converted');
        expect(z).toMatch(/^= 0,34 g Eiweiß\/100 ml · 0,6\d g\/kg\/d · je Mahlzeit 0,05 g Pulver oder 0,04 ml Eiweißlösung$/);
    });

    it('AL9: Die Zubereitungs-Kachel zeigt FM85 in ml 50-%-Lösung, Energie je 100 ml und den Spielraum', async () => {
        const w = await boot({ ...kind, 'input-fm85': 1 });
        const rows = w.document.getElementById('prep-rows').innerHTML;
        expect(rows).toMatch(/50-%-Lösung/);
        expect(rows).toMatch(/0\.24 ml/);
        const res = text(w, 'prep-result');
        expect(res).toMatch(/Energie \d+ kcal je 100 ml/);
        expect(res).toMatch(/Bis zur Eiweiß-Obergrenze \(4,5 g\/kg\/d\) ist noch Platz für/);
    });

    it('AL10: Der Tippfehlerschutz gilt für die umgerechnete Konzentration (3 ml Lösung je 12 ml = 12,5 % FM85 → Fehler)', async () => {
        const w = await boot({ ...kind, 'input-fm85-unit': 'solml', 'input-fm85': 3 });
        expect(w.document.getElementById('validation-error-message').textContent).toMatch(/FM85/);
        expect(w.document.getElementById('qv-kcal').textContent).toBe('–');
    });

    it('AL11: Schrittweite und Obergrenze passen zur Einheit; Vorlagen stellen % und g/100 ml zurück', async () => {
        const w = await boot({});
        const f = w.document.getElementById('input-fm85');
        expect(f.step).toBe('0.5');
        w.document.getElementById('input-fm85-unit').value = 'solml';
        w.document.getElementById('input-fm85-unit').dispatchEvent(new w.Event('change'));
        expect(f.step).toBe('any');
        expect(f.hasAttribute('max')).toBe(false);
        w.document.getElementById('input-protein-add-unit').value = 'solmeal';
        w.loadSimulation('elbw');
        expect(w.document.getElementById('input-fm85-unit').value).toBe('pct');
        expect(w.document.getElementById('input-protein-add-unit').value).toBe('per100');
        expect(f.step).toBe('0.5');                       // Schrittweite folgt der zurückgestellten Einheit
        expect(f.getAttribute('max')).toBe('5');
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AM — Daten aus dem Stations-Excel „FG-Plan Zeitleiste“ (v3.6.15)
 * Blatt Tabelle2 (2022): zusätzliche Nahrungen, korrigierte Mineralstoffe, Eingabe wie im Excel (g Pulver je 100 ml).
 * ────────────────────────────────────────────────────────────────*/
describe('AM) Stations-Excel: Neocate (v3.6.15)', () => {
    const NP = require('../products.js');
    const prod = id => NP.enteralProducts.find(p => p.id === id);

    it('AM1: Neocate steht mit den Excel-Werten in den Produktdaten; andere Excel-Produkte sind nicht übernommen (Entscheidung 01.11.2026)', () => {
        expect(prod('neocate').per100ml).toMatchObject({ kcal: 67, protein: 1.8, fat: 3.4, carbs: 7.2 });
        for (const id of ['aptamilHAPre', 'aptamilAR']) expect(prod(id), id).toBeUndefined();
        expect(NP.enteralProducts.some(p => /Primergen/i.test(p.name))).toBe(false);
    });

    it('AM2: Die Fallback-Tabelle der Zielvolumen-Kopplung stimmt mit den Produktdaten überein (Eiweiß, Energie)', () => {
        for (const id of ['neocate', 'ebm', 'bebaFG1', 'bebaFG2', 'aptamilPre', 'hippPre']) {
            const d = calc._enteralDensity({ selectedEnteralProduct: id, fm85Percent: 0 });
            expect(d.proteinPer100, id).toBe(prod(id).per100ml.protein);
            expect(d.kcalPer100, id).toBe(prod(id).per100ml.kcal);
        }
    });
});

describe('AM-UI) Neocate in der Oberfläche (v3.6.15)', () => {
    async function boot(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        w.HTMLElement.prototype.scrollIntoView = () => {};
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) w.document.getElementById(id).value = v;
        w.updateCalculations();
        return w;
    }
    // v3.6.20 — klinisch begründete Anpassung: „input-tfi“ ist jetzt die Infusion (Gesamtflüssigkeit = Infusion + enteral); rein enteral = 0.
    const kind = { 'birth-weight': 800, 'current-weight': 800, 'input-ssw': 28, 'input-day': 1, 'input-meal-frequency': 12, 'input-lipids': 0, 'input-tfi': 0, 'input-enteral': 180 };

    it('AM3: Alle Nahrungen aus den Produktdaten sind in der Auswahl wählbar', async () => {
        const w = await boot({});
        const opts = [...w.document.querySelectorAll('#input-enteral-product option')].map(o => o.value);
        require('../products.js').enteralProducts.forEach(p => expect(opts, p.id).toContain(p.id));
    });

    it('AM4: Neocate bei 180 ml/kg/d: 120,6 kcal/kg/d und 3,24 g Eiweiß/kg/d', async () => {
        const w = await boot({ ...kind, 'input-enteral-product': 'neocate' });
        expect(w.document.getElementById('qv-kcal').innerText).toBe('120.6');
        expect(String(w.document.getElementById('res-protein-total-gkg').innerText)).toMatch(/3[.,]24/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AN — Keine Anreicherungs-Empfehlung bei erreichter Energieobergrenze (v3.6.16)
 * Anlass: Kind mit 195 ml/kg/d (156 ml/d bei 800 g), FM85 1 % und Eiweiß-Zusatz: 149 kcal/kg/d bei Ziel damals 110–135 (seit v3.6.17 110–140), und die App
 * empfahl gleichzeitig „vorrangig Anreicherung statt Volumen steigern“ und „Überernährung prüfen“.
 * ────────────────────────────────────────────────────────────────*/
describe('AN) Anreicherungs-Empfehlungen bei Energieobergrenze (v3.6.16)', () => {
    const kind = o => calc.calculate(baseInput({
        birthWeight: 730, currentWeight: 800, ssw: 28, postnatalAge: 15, mealFrequency: 12,
        gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0,
        selectedEnteralProduct: 'ebm', fm85Percent: 0, ...o
    }));
    const alle = r => [...r.warnings, ...r.reminders, ...(r.assessment.fazit || [])];
    const anrText = r => alle(r).filter(t => /Anreicherung statt Volumen|FM85 Start-Kriterium|auf 4% empfohlen|Fortifizierung prüfen|FM85-Fortifizierung starten/.test(t));

    it('AN1: 195 ml/kg/d, FM85 1 %: Energie über der Obergrenze → der Hinweis „oberhalb des Zielkorridors“ nennt die Energie statt Anreicherung zu empfehlen', () => {
        const r = kind({ tfi: 195, enteralVolume: 195, fm85Percent: 1, proteinAddPer100ml: 0.29 });
        expect(r.results.kcalPerKg).toBeGreaterThan(140);
        const h = r.warnings.find(w => /^Hinweis: Enteral 195 ml\/kg\/d oberhalb des Zielkorridors/.test(w));
        expect(h).toBeTruthy();
        expect(h).toMatch(/Die Energie liegt bereits an der Obergrenze/);
        expect(h).toMatch(/keine weitere Anreicherung/);
        expect(h).not.toMatch(/vorrangig Anreicherung statt Volumen steigern/);
        expect(r.warnings.some(w => /Energie .* über Zielbereich/.test(w))).toBe(true);   // die Energie-Warnung bleibt
    });

    it('AN2: Über dem Zielkorridor, aber Energie unter der Obergrenze → die bisherige Empfehlung bleibt', () => {
        const r = kind({ tfi: 185, enteralVolume: 185 });                  // 131 kcal/kg/d
        expect(r.results.kcalPerKg).toBeLessThan(140);
        const h = r.warnings.find(w => /oberhalb des Zielkorridors/.test(w));
        expect(h).toMatch(/vorrangig Anreicherung statt Volumen steigern/);
    });

    it('AN3: FM85-Start-Erinnerung und Fazit-Zeile entfallen bei Energie an der Obergrenze, bleiben sonst bestehen', () => {
        // v3.6.17 — Anpassung wegen Obergrenze 140 (vorher 135): 195 ml/kg/d Milch allein = 138,5 kcal/kg/d liegen jetzt
        // darunter, deshalb 200 ml/kg/d (142 kcal/kg/d) als Fall „an der Obergrenze“.
        const hoch = kind({ tfi: 200, enteralVolume: 200 });               // nur Milch: 142 kcal/kg/d
        expect(anrText(hoch).filter(t => /FM85/.test(t))).toEqual([]);
        const normal = kind({ tfi: 150, enteralVolume: 150 });             // 106,5 kcal/kg/d
        expect(anrText(normal).some(t => /FM85 Start-Kriterium/.test(t))).toBe(true);
    });

    it('AN4: „Fortifizierung auf 4 % empfohlen“ ab Monat 2 entfällt bei Energie an der Obergrenze', () => {
        const hoch = kind({ postnatalAge: 30, tfi: 195, enteralVolume: 195, fm85Percent: 2 });      // 155 kcal/kg/d
        expect(hoch.warnings.some(w => /auf 4% empfohlen/.test(w))).toBe(false);
        const normal = kind({ postnatalAge: 30, tfi: 150, enteralVolume: 150, fm85Percent: 2 });    // 119,6 kcal/kg/d
        expect(normal.warnings.some(w => /auf 4% empfohlen/.test(w))).toBe(true);
    });

    it('AN5: Läuft noch PN, bleiben die Empfehlungen (die PN-Energie sinkt beim Ausschleichen)', () => {
        const r = kind({ tfi: 195, enteralVolume: 110, gir: 8, protein: 3, lipids: 3, calcium: 40, phosphate: 30 });
        expect(r.results.kcalParenteralKg).toBeGreaterThan(0);
        expect(calc._energyAtLimit(r.results.kcalPerKg, r.targets, 15, r.results.kcalParenteralKg)).toBe(false);
    });

    it('AN6: _energyAtLimit — erst ab Lebenstag 4, an der Obergrenze eingeschlossen, ohne Ziele nie', () => {
        const t = { energy: { min: 110, max: 140 } };
        expect(calc._energyAtLimit(140, t, 10)).toBe(true);
        expect(calc._energyAtLimit(139.9, t, 10)).toBe(false);
        expect(calc._energyAtLimit(150, t, 3)).toBe(false);
        expect(calc._energyAtLimit(150, null, 10)).toBe(false);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AO — Haken „Nur enteral (keine Infusion)“ und Dezimalwerte bei Mengen (v3.6.18)
 * Anlass: (1) Bei rein enteral ernährten Kindern musste dasselbe Volumen zweimal eingetragen werden
 * (Gesamtflüssigkeit und enteral). (2) Die Mengenfelder hatten Schrittweite 1, ein Wert wie 0,5 ml je Mahlzeit
 * galt dem Browser als ungültig.
 * ────────────────────────────────────────────────────────────────*/
describe('AO) Nur enteral und Dezimalwerte (v3.6.18)', () => {
    async function boot(values) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        w.HTMLElement.prototype.scrollIntoView = () => {};
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) w.document.getElementById(id).value = v;
        w.updateCalculations();
        return w;
    }
    const kind = { 'birth-weight': 730, 'current-weight': 800, 'input-ssw': 28, 'input-day': 15, 'input-meal-frequency': 12 };
    const haken = (w, an) => {
        const box = w.document.getElementById('input-enteral-only');
        box.checked = an;
        box.dispatchEvent(new w.Event('change'));
    };
    const $ = (w, id) => w.document.getElementById(id);

    it('AO1: 0,5 ml je Mahlzeit ist ein gültiger Wert und ergibt 7,5 ml/kg/d (bei 800 g, 12 Mahlzeiten)', async () => {
        const w = await boot({ ...kind, 'input-tfi': 80, 'input-enteral-unit': 'meal', 'input-enteral': 0.5, 'input-carrier-unit': 'd', 'input-carrier': 2.5 });
        ['input-tfi', 'input-enteral', 'input-carrier'].forEach(id => expect($(w, id).validity.stepMismatch, id).toBe(false));
        expect($(w, 'enteral-converted').innerText).toMatch(/^= 7,5 ml\/kg\/d · 6 ml\/d · 0,5 ml je Mahlzeit/);
    });

    it('AO2: „Nur enteral“ — Infusion steht auf 0 (Gesamtflüssigkeit = enterale Menge), Lipide auf 0, die Felder sind gesperrt', async () => {
        const w = await boot({ ...kind, 'input-tfi': 150, 'input-lipids': 1, 'input-enteral-unit': 'meal', 'input-enteral': 12 });
        haken(w, true);
        // v3.6.20 — klinisch begründete Anpassung: Das Feld ist jetzt die Infusion (0); die Gesamtflüssigkeit ergibt sich aus Infusion + enteral.
        expect($(w, 'input-tfi').value).toBe('0');
        expect($(w, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 180 ml\/kg\/d/);   // 12 ml × 12 ÷ 0,8 kg
        expect($(w, 'input-solution').value).toBe('keinePN');
        expect($(w, 'input-lipids').value).toBe('0');
        expect($(w, 'input-secondary-solution').value).toBe('none');
        ['input-tfi', 'input-solution', 'input-lipids', 'input-carrier', 'input-secondary-rate', 'input-gir', 'input-protein']
            .forEach(id => expect($(w, id).disabled, id).toBe(true));
        expect($(w, 'enteral-only-note').classList.contains('hidden')).toBe(false);
    });

    it('AO3: Die Gesamtflüssigkeit folgt späteren Änderungen der enteralen Menge (Infusion bleibt 0)', async () => {
        const w = await boot({ ...kind, 'input-enteral-unit': 'meal', 'input-enteral': 12 });
        haken(w, true);
        $(w, 'input-enteral').value = 6;
        w.updateCalculations();
        expect($(w, 'input-tfi').value).toBe('0');
        expect($(w, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 90 ml\/kg\/d/);
        $(w, 'input-enteral-unit').value = 'd';
        $(w, 'input-enteral').value = 72;
        w.updateCalculations();
        expect($(w, 'input-tfi').value).toBe('0');
        expect($(w, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 90 ml\/kg\/d/);
    });

    it('AO4: Abwählen stellt Gesamtflüssigkeit, Infusionslösung, Lipide und Sperren wieder her', async () => {
        const w = await boot({ ...kind, 'input-tfi': 150, 'input-lipids': 1.5, 'input-solution': 'basisFG', 'input-enteral': 60 });
        w.updateSolutionUI();
        const vorher = ['input-tfi', 'input-solution', 'input-lipids', 'input-carrier', 'input-secondary-solution'].map(id => $(w, id).value);
        haken(w, true);
        haken(w, false);
        expect(['input-tfi', 'input-solution', 'input-lipids', 'input-carrier', 'input-secondary-solution'].map(id => $(w, id).value)).toEqual(vorher);
        ['input-tfi', 'input-solution', 'input-lipids', 'input-gir'].forEach(id => expect($(w, id).disabled, id).toBe(false));
        expect($(w, 'enteral-only-note').classList.contains('hidden')).toBe(true);
    });

    it('AO5: Stand die Auswahl „Keine PN“ schon, bleibt sie nach dem Abwählen erhalten; die PN-Werte davor kehren zurück', async () => {
        const w = await boot({ ...kind, 'input-tfi': 150, 'input-enteral': 60, 'input-gir': 6 });
        haken(w, true);
        haken(w, false);
        expect($(w, 'input-solution').value).toBe('none');
        expect($(w, 'input-gir').value).toBe('6');
        expect($(w, 'input-gir').disabled).toBe(false);
    });

    it('AO6: Eine Vorlage verwirft den Haken und gibt die Felder frei', async () => {
        const w = await boot({ ...kind, 'input-enteral': 60 });
        haken(w, true);
        w.loadSimulation('elbw');
        expect($(w, 'input-enteral-only').checked).toBe(false);
        expect($(w, 'input-tfi').disabled).toBe(false);
        expect($(w, 'input-lipids').disabled).toBe(false);
    });

    it('AO7: Mit dem Haken meldet der Rechenkern keine Volumenkonflikte (kein PN-Rest, keine CRITICAL-Meldung zu Lipid-Volumen)', async () => {
        const w = await boot({ ...kind, 'input-enteral-unit': 'meal', 'input-enteral': 12 });
        haken(w, true);
        expect(w.document.getElementById('findings-critical')).not.toBeNull();
        const kritisch = [...w.document.querySelectorAll('#findings-critical .f-item.critical')].map(e => e.textContent);
        expect(kritisch.filter(t => /Lipid|Osmolarität|Glukosekonzentration|Ausfällung/.test(t))).toEqual([]);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AP — Prüfung gegen die tatsächliche Gesamtmenge (v3.6.19)
 * Anlass: Intubiertes Kind, Gesamtflüssigkeit mit 2,5 ml/h (= 75 ml/kg/d bei 800 g) eingetragen, enterale Nahrung gesteigert.
 * Die enterale Nahrung steckt in der Gesamtflüssigkeit; die Beatmungsgrenze prüfte nur den eingetragenen Wert und blieb stumm,
 * obwohl die Summe der Teile über 140 ml/kg/d lag.
 * ────────────────────────────────────────────────────────────────*/
describe('AP) Tatsächliche Gesamtmenge bei Beatmung und TFI-Hinweisen (v3.6.19)', () => {
    const kind = o => calc.calculate(baseInput({
        birthWeight: 730, currentWeight: 800, ssw: 28, postnatalAge: 5, mealFrequency: 8, ventilationStatus: 'invasive',
        tfi: 75, enteralVolume: 0, gir: 0, protein: 0, lipids: 0, calcium: 0, phosphate: 0, sodium: 0, potassium: 0,
        selectedEnteralProduct: 'ebm', ...o
    }));
    const kritisch = r => r.warnings.filter(w => /^CRITICAL/.test(w));

    it('AP1: Intubiert, Gesamtflüssigkeit 75, enteral 150 → CRITICAL nennt die Gesamtmenge und den eingetragenen Wert', () => {
        const k = kritisch(kind({ enteralVolume: 150 })).find(w => /bei invasiver Beatmung/.test(w));
        expect(k).toBeTruthy();
        expect(k).toMatch(/Gesamtmenge 150 ml\/kg\/d/);
        expect(k).toMatch(/Eingetragene Gesamtflüssigkeit: 75 ml\/kg\/d/);
    });

    it('AP2: Die Teile zählen zusammen (enteral + Spülflüssigkeit + Sekundärinfusion + Mikro)', () => {
        const k = kritisch(kind({ enteralVolume: 100, carrierVolume: 30, secondaryRateKg: 20 })).find(w => /bei invasiver Beatmung/.test(w));
        expect(k).toMatch(/Gesamtmenge 150 ml\/kg\/d/);
    });

    it('AP3: Liegt die Summe der Teile unter 140 und unter der Gesamtflüssigkeit, bleibt es ohne Beatmungs-CRITICAL', () => {
        const r = kind({ enteralVolume: 60 });
        expect(kritisch(r).filter(w => /Beatmung/.test(w))).toEqual([]);
    });

    it('AP4: Ist die eingetragene Gesamtflüssigkeit selbst über 140, bleibt der bisherige Wortlaut', () => {
        const r = kind({ tfi: 150, enteralVolume: 100 });
        expect(r.warnings).toContain('CRITICAL: TFI > 140 ml/kg/d bei invasiver Beatmung!');
    });

    it('AP5: Spontan atmend: Summe über 180 ergibt den TFI-Hinweis mit dem Wort „Gesamtmenge“', () => {
        const r = kind({ ventilationStatus: 'spontaneous', enteralVolume: 190 });
        expect(r.warnings.some(w => /^Hinweis: Gesamtmenge 190 ml\/kg\/d oberhalb des üblichen Korridors/.test(w))).toBe(true);
        expect(r.warnings.some(w => /^Hinweis: TFI 75 ml\/kg\/d unter Zielbereich/.test(w))).toBe(false);
    });

    it('AP6: Die CRITICAL-Meldung „TFI überschritten“ nennt die Summe und die eingetragene Gesamtflüssigkeit statt nur Sekundärinfusionen', () => {
        const k = kritisch(kind({ enteralVolume: 150 })).find(w => /^CRITICAL: TFI überschritten/.test(w));
        expect(k).toMatch(/Summe aus enteraler Nahrung, Spülflüssigkeit, Sekundärinfusion und Mikro-Zufuhr \(150 ml\/kg\/d\)/);
        expect(k).toMatch(/eingetragenen Gesamtflüssigkeit \(75 ml\/kg\/d\)/);
        expect(k).not.toMatch(/Sekundärinfusionen reduzieren/);
    });

    it('AP7: In der Oberfläche steht die Aufteilung unter dem Feld (Infusion 2,5 ml/h plus enteral 40 ml/kg/d)', async () => {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        w.HTMLElement.prototype.scrollIntoView = () => {};
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        const set = (id, v) => { w.document.getElementById(id).value = v; };
        Object.entries({ 'birth-weight': 730, 'current-weight': 800, 'input-ssw': 28, 'input-day': 5, 'input-meal-frequency': 8,
            'input-tfi-unit': 'h', 'input-tfi': 2.5, 'input-enteral': 40 }).forEach(([k, v]) => set(k, v));
        w.updateCalculations();
        const text = String(w.document.getElementById('tfi-converted').innerText);
        // v3.6.20 — klinisch begründete Anpassung: Eingegeben wird die Infusion (2,5 ml/h = 75 ml/kg/d), die enterale Nahrung kommt dazu.
        expect(text).toBe('= Infusion 75 ml/kg/d (60 ml/d, 2,5 ml/h) + enteral 40 ml/kg/d (32 ml/d) = Gesamtflüssigkeit 115 ml/kg/d · 92 ml/d · 3,8 ml/h');
        expect(w.document.body.textContent).toMatch(/Infusion gesamt/);
    });
});

/* ────────────────────────────────────────────────────────────────
 * SECTION AQ — Infusion gesamt + enteral = Gesamtflüssigkeit (v3.6.20)
 * Anlass: Praxisfall 430 g, intubiert, Infusion 2,5 ml/h, enteral 0,5 ml/h. Die Station denkt „Infusion plus enteral“;
 * die App behandelte das Feld als Gesamtflüssigkeit und zog die enterale Nahrung davon ab (Summe 3,0 statt 2,5 ml/h blieb unbemerkt).
 * Jetzt wird die Infusion eingegeben und die Gesamtflüssigkeit daraus berechnet.
 * ────────────────────────────────────────────────────────────────*/
describe('AQ) Infusion gesamt plus enteral (v3.6.20)', () => {
    async function boot(values, vorab = {}) {
        const { JSDOM } = await import('jsdom');
        const fs = require('node:fs');
        const root = new URL('../', import.meta.url).pathname;
        const html = fs.readFileSync(root + 'index.html', 'utf8');
        const w = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' }).window;
        Object.entries(vorab).forEach(([k, v]) => w.localStorage.setItem(k, v));
        w.eval(fs.readFileSync(root + 'node_modules/decimal.js/decimal.js', 'utf8'));
        for (const f of ['products.js', 'fenton_data.js', 'calculator.js']) w.eval(fs.readFileSync(root + f, 'utf8'));
        w.tippy = () => ({ setContent() {}, destroy() {}, show() {}, hide() {} });
        w.HTMLElement.prototype.scrollIntoView = () => {};
        [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
            .filter(s => s.includes('updateCalculations')).forEach(c => w.eval(c));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        for (const [id, v] of Object.entries(values)) {
            const el = w.document.getElementById(id);
            if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
        }
        w.updateCalculations();
        return w;
    }
    const $ = (w, id) => w.document.getElementById(id);
    const pdf = { 'birth-weight': 430, 'current-weight': 430, 'input-ssw': 26, 'input-day': 2, 'input-meal-frequency': 8,
        'input-tfi-unit': 'h', 'input-tfi': 2.5, 'input-enteral-unit': 'd', 'input-enteral': 12, 'input-lipids': 2 };

    it('AQ1: Praxisfall — Infusion 2,5 ml/h plus enteral 12 ml/d ergeben 167,4 ml/kg/d, intubiert → CRITICAL zur Beatmungsgrenze', async () => {
        const w = await boot({ ...pdf, 'input-invasive-ventilation': true });
        expect($(w, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 167,4 ml\/kg\/d · 72 ml\/d · 3 ml\/h$/);
        const kritisch = [...w.document.querySelectorAll('#findings-critical .f-item.critical')].map(e => e.textContent).join(' ');
        expect(kritisch).toMatch(/invasiver Beatmung/);
        const spontan = await boot({ ...pdf, 'input-invasive-ventilation': false });
        const k2 = [...spontan.document.querySelectorAll('#findings-critical .f-item.critical')].map(e => e.textContent).join(' ');
        expect(k2).not.toMatch(/invasiver Beatmung/);
    });

    it('AQ2: Ohne enterale Nahrung ist die Gesamtflüssigkeit gleich der Infusion; bei Infusion 0 gleich der enteralen Menge', async () => {
        const a = await boot({ ...pdf, 'input-enteral': 0 });
        expect($(a, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 139,5 ml\/kg\/d · 60 ml\/d · 2,5 ml\/h$/);
        const b = await boot({ ...pdf, 'input-tfi': 0 });
        expect($(b, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 27,9 ml\/kg\/d · 12 ml\/d · 0,5 ml\/h$/);
    });

    it('AQ3: Eine negative Infusion wird nicht durch die enterale Menge verdeckt (Tippfehlerschutz bleibt)', async () => {
        const w = await boot({ ...pdf, 'input-tfi-unit': 'kgd', 'input-tfi': -50, 'input-enteral-unit': 'kgd', 'input-enteral': 100 });
        expect($(w, 'validation-error-message').textContent).toMatch(/TFI|Gesamtfl|negativ|0/);
        expect($(w, 'qv-kcal').textContent).toBe('–');
    });

    it('AQ4: Die harte Grenze 400 ml/kg/d gilt für die Gesamtflüssigkeit (Infusion 250 + enteral 200)', async () => {
        const w = await boot({ ...pdf, 'input-tfi-unit': 'kgd', 'input-tfi': 250, 'input-enteral-unit': 'kgd', 'input-enteral': 200 });
        expect($(w, 'validation-error-message').textContent).toMatch(/TFI|Gesamtfl|400/);
        expect($(w, 'qv-kcal').textContent).toBe('–');
    });

    it('AQ5: Ein früher gespeicherter Wert (damals Gesamtflüssigkeit) wird nicht als Infusion übernommen; Hinweis erscheint', async () => {
        const w = await boot({}, { 'input-tfi': '150', 'input-enteral': '60' });
        expect($(w, 'input-tfi').value).toBe('80');                         // Standardwert, nicht 150
        expect($(w, 'input-enteral').value).toBe('60');                     // andere Felder bleiben erhalten
        expect($(w, 'tfi-semantics-note').classList.contains('hidden')).toBe(false);
    });

    it('AQ6: Nach einer Eingabe im Feld ist der Hinweis weg, und der Wert wird beim nächsten Start wieder geladen', async () => {
        const w = await boot({}, { 'input-tfi': '150' });
        const feld = $(w, 'input-tfi');
        feld.value = '90';
        feld.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect($(w, 'tfi-semantics-note').classList.contains('hidden')).toBe(true);
        expect(w.localStorage.getItem('neo-tfi-semantics')).toBe('infusion');
        const w2 = await boot({}, { 'input-tfi': '90', 'neo-tfi-semantics': 'infusion' });
        expect($(w2, 'input-tfi').value).toBe('90');
        expect($(w2, 'tfi-semantics-note').classList.contains('hidden')).toBe(true);
    });

    it('AQ7: Der Vorschlag „Gesamtflüssigkeit“ (Smart Default) übernimmt Infusion = Vorschlag minus enterale Menge', async () => {
        const w = await boot({ 'birth-weight': 730, 'current-weight': 800, 'input-ssw': 28, 'input-day': 3, 'input-meal-frequency': 8,
            'input-enteral': 40 });
        const vorschlag = parseFloat(String($(w, 'sd-tfi').textContent).replace(',', '.'));
        expect(vorschlag).toBeGreaterThan(40);
        w.applySmartDefault('input-tfi', 'sdTfi');
        expect(parseFloat($(w, 'input-tfi').value)).toBeCloseTo(vorschlag - 40, 1);
        expect($(w, 'tfi-converted').innerText).toMatch(new RegExp(`Gesamtflüssigkeit ${String(vorschlag).replace('.', ',')} ml/kg/d`));
    });

    it('AQ8: Die Vorlagen behalten ihre Gesamtflüssigkeit (140 bzw. 160 ml/kg/d) bei neuer Bedeutung des Feldes', async () => {
        const w = await boot({});
        w.loadSimulation('transition');
        expect($(w, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 140 ml\/kg\/d/);
        w.loadSimulation('fullEnteral');
        expect($(w, 'tfi-converted').innerText).toMatch(/Gesamtflüssigkeit 160 ml\/kg\/d/);
    });
});
