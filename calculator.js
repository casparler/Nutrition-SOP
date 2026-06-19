/** Neonatologie Nutrition Calculator - V11 Master Logic
 * ESPGHAN 2018 & NICU Master Protocol 2026
 * Safety Core Engine - Solution Configurator, Tiered Alerting, Lipid Escalation
 * ALL arithmetic via Decimal.js — no IEEE 754 floats in clinical paths.
 */

/**
 * Dedizierte Exception-Klasse für Eingabe-Validierungsfehler.
 * Wird vor der Berechnung geworfen, wenn physikalisch/klinisch
 * unmögliche Werte erkannt werden (Safety-First-Prinzip).
 */
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class NutritionCalculator {
    constructor() {
        this.LIMITS = {
            TFI: { min: 40, max: 200, unit: 'ml/kg/d' },
            GIR: { min: 3, max: 12, unit: 'mg/kg/min' },
            PROTEIN: { max: 4.5, unit: 'g/kg/d' },
            LIPIDS: { max: 4.0, unit: 'g/kg/d' },
            OSM_PERIPHERAL: 900
        };
        this.CALORIES = { GLUCOSE: 4.0, LIPIDS_STANDARD: 9.0, LIPIDS_SMOFLIPID: 10.0, PROTEIN: 4.0 };
        this.MOLAR_MASS = { CALCIUM: 40.08, PHOSPHORUS: 30.97 };
        this.LIPID_TARGETS = {
            1: { min: 1.0, max: 2.0 },
            2: { min: 1.5, max: 3.0 },
            3: { min: 2.0, max: 3.5 },
            4: { min: 2.0, max: 4.0 }
        };
    }

    /** Decimal-first rounding — .toFixed() only at UI layer */
    _d(v) {
        return new Decimal(v || 0);
    }

    _round(num, decimals = 2) {
        return this._d(num).toDecimalPlaces(decimals).toNumber();
    }

    /**
     * Type-safe numeric parser (Ticket R-02).
     * Vereinheitlicht parse + validate: leere/null/undefined → defaultValue,
     * non-numerische Strings → ValidationError, Bereichsüberschreitung → ValidationError.
     * Garantiert, dass nie "NaN" oder undefined in die klinischen Berechnungen fließt.
     *
     * @param {*} raw          Rohwert aus input (string|number|null|undefined|'')
     * @param {string} field   Feldname für Fehlermeldung
     * @param {object} opts    { min?:number, max?:number, defaultValue?:number,
     *                           integer?:boolean, minMsg?:string, maxMsg?:string }
     * @returns {number}       Geparster Wert (Number, garantiert finit)
     * @throws  {ValidationError}
     */
    _safeParseNum(raw, field, opts = {}) {
        const { min, max, defaultValue = 0, integer = false, minMsg, maxMsg } = opts;
        // Leerwerte → default (keine Validierung — sichere Annahme)
        if (raw === '' || raw === null || raw === undefined) return defaultValue;
        const v = integer ? parseInt(raw, 10) : parseFloat(raw);
        if (isNaN(v) || !isFinite(v)) {
            throw new ValidationError(
                `${field}: "${raw}" ist keine gültige Zahl.`,
                field
            );
        }
        if (min !== undefined && v < min) {
            throw new ValidationError(minMsg || `${field} ${v} unterschreitet das Minimum (${min}).`, field);
        }
        if (max !== undefined && v > max) {
            throw new ValidationError(maxMsg || `${field} ${v} überschreitet das Maximum (${max}).`, field);
        }
        return v;
    }

    getTargets(input) {
        const bw = parseFloat(input.birthWeight) || 1000;
        const age = Math.max(1, parseInt(input.postnatalAge) || 1);
        const ventilation = input.ventilationStatus || 'spontaneous';
        const ssw = parseInt(input.ssw) || 28;
        const effectiveDay = Math.min(age, 14);

        // --- TFI targets by weight class ---
        // Master-Protokoll: ELBW-Klassengrenze inklusiv bei 1000g (bw <= 1000)
        let tfiMin, tfiMax;
        if (bw <= 1000) {
            if (effectiveDay === 1) { tfiMin = 80; tfiMax = 100; }
            else if (effectiveDay === 2) { tfiMin = 100; tfiMax = 120; }
            else { tfiMin = 120 + (effectiveDay - 3) * 20; tfiMax = 140 + (effectiveDay - 3) * 20; }
        } else if (bw <= 1500) {
            // VLBW (1000–1500g): Master-Protokoll konforme TFI-Ziele
            if (effectiveDay === 1) { tfiMin = 80; tfiMax = 100; }
            else if (effectiveDay === 2) { tfiMin = 100; tfiMax = 120; }
            else { tfiMin = 120 + (effectiveDay - 3) * 20; tfiMax = 140 + (effectiveDay - 3) * 20; }
        } else {
            if (effectiveDay === 1) { tfiMin = 60; tfiMax = 80; }
            else if (effectiveDay === 2) { tfiMin = 80; tfiMax = 100; }
            else { tfiMin = 100 + (effectiveDay - 3) * 20; tfiMax = 120 + (effectiveDay - 3) * 20; }
        }

        const tfiCap = ventilation === 'invasive' ? 140 : 180;
        tfiMin = Math.min(tfiMin, tfiCap);
        tfiMax = Math.min(tfiMax, tfiCap);

        // --- Protein targets ---
        let proteinMin, proteinMax;
        if (bw < 1000) { proteinMin = 3.5; proteinMax = 4.0; }
        else if (bw <= 1500) { proteinMin = 3.0; proteinMax = 3.5; }
        else if (ssw >= 37) { proteinMin = 2.5; proteinMax = 3.0; }
        else { proteinMin = 3.0; proteinMax = 3.5; }

        // --- Energy targets ---
        let energyMin, energyMax, energyDay;
        if (effectiveDay === 1) { energyMin = 45; energyMax = 60; energyDay = 1; }
        else if (effectiveDay === 2) { energyMin = 60; energyMax = 80; energyDay = 2; }
        else if (effectiveDay === 3) { energyMin = 80; energyMax = 100; energyDay = 3; }
        else { energyMin = 110; energyMax = 135; energyDay = '4+'; }

        // --- Lipid targets ---
        const lipidDayKey = Math.min(effectiveDay, 4);
        const lipidTarget = this.LIPID_TARGETS[lipidDayKey];

        return {
            tfi: { min: tfiMin, max: tfiMax, cap: tfiCap },
            protein: { min: proteinMin, max: proteinMax },
            lipids: { min: 1.0, max: 4.0 },
            energy: { min: energyMin, max: energyMax },
            energyDay,
            effectiveDay,
            lipidTarget
        };
    }

    /**
     * PREDICTIVE — Energy Gap Index (v2.1, Modell B: nur Hinweis)
     * Berechnet das kumulative Kalorien-Defizit der letzten N Tage aus dem
     * history-Objekt. Schwellwert > 150 kcal/kg/d → Warning.
     *
     * History-Format (per Tag-Key "1","2",…):
     *   { _kcal-kg: 95, _kcal-min: 110 }   // tatsächliche vs. minimale Zufuhr
     *
     * Quellen: Embleton et al. 2001 — kumulatives Defizit > 200 kcal/kg
     *          korreliert mit Wachstumsversagen; 150 als konservativer Trigger.
     */
    _analyzeEnergyGap(history, postnatalAge, lookbackDays = 7) {
        if (!history || typeof history !== 'object') return null;
        const curDay = parseInt(postnatalAge) || 1;
        const start = Math.max(1, curDay - (lookbackDays - 1));
        let cumulativeDeficit = 0;
        let daysCounted = 0;
        for (let d = start; d <= curDay; d++) {
            const dd = history[String(d)];
            if (!dd) continue;
            const actual = parseFloat(dd['_kcal-kg']);
            const targetMin = parseFloat(dd['_kcal-min']);
            if (!isFinite(actual) || !isFinite(targetMin)) continue;
            daysCounted++;
            const gap = targetMin - actual;
            if (gap > 0) cumulativeDeficit += gap;
        }
        cumulativeDeficit = Math.round(cumulativeDeficit * 10) / 10;
        return {
            cumulativeDeficit,
            daysAnalyzed: daysCounted,
            threshold: 150,
            critical: cumulativeDeficit > 150 && daysCounted >= 3
        };
    }

    /**
     * ENERGY-GAP ACCUMULATOR (v3.0, Modell B: diagnostischer Index)
     * Summiert das kumulative Kalorien-Defizit über ALLE im history-Objekt
     * dokumentierten Tage (nicht nur die letzten 7) — als „Energy-Gap-Index".
     *
     * Klinischer Hintergrund: Das frühe kumulative Energiedefizit der ersten
     * Lebenswochen korreliert linear mit postnataler Wachstumsrestriktion
     * (Embleton 2001). Ab ~150 kcal/kg kumulativ steigt das PEW-Risiko deutlich.
     *
     * History-Format (per Tag-Key "1","2",…):
     *   { '_kcal-kg': 95, '_kcal-min': 110 }   // Ist- vs. Mindest-Zufuhr
     *
     * @returns {object|null} {
     *   cumulativeDeficit, daysAnalyzed, dailyAverageGap, worstDay,
     *   index, severity ('ok'|'watch'|'high'), threshold
     * }
     */
    calculateEnergyGapIndex(history) {
        if (!history || typeof history !== 'object') return null;
        const days = Object.keys(history)
            .map(k => parseInt(k))
            .filter(n => Number.isFinite(n))
            .sort((a, b) => a - b);
        let cumulativeDeficit = 0;
        let daysAnalyzed = 0;
        let worstDay = null;
        let worstGap = 0;
        for (const d of days) {
            const dd = history[String(d)];
            if (!dd) continue;
            const actual = parseFloat(dd['_kcal-kg']);
            const targetMin = parseFloat(dd['_kcal-min']);
            if (!isFinite(actual) || !isFinite(targetMin)) continue;
            daysAnalyzed++;
            const gap = targetMin - actual;
            if (gap > 0) {
                cumulativeDeficit += gap;
                if (gap > worstGap) { worstGap = gap; worstDay = d; }
            }
        }
        if (daysAnalyzed === 0) return null;
        cumulativeDeficit = Math.round(cumulativeDeficit * 10) / 10;
        const dailyAverageGap = Math.round((cumulativeDeficit / daysAnalyzed) * 10) / 10;
        const threshold = 150;
        let severity;
        if (cumulativeDeficit > threshold) severity = 'high';
        else if (cumulativeDeficit >= 75) severity = 'watch';
        else severity = 'ok';
        return {
            cumulativeDeficit,
            daysAnalyzed,
            dailyAverageGap,
            worstDay,
            worstGap: Math.round(worstGap * 10) / 10,
            index: cumulativeDeficit,
            threshold,
            severity
        };
    }

    /**
     * SMART DEFAULTS (v3.0) — schlägt klinisch sinnvolle Startwerte für
     * Flüssigkeit (TFI) und Aminosäuren (Protein) sowie Lipide anhand des
     * Ernährungstages vor. Der Arzt muss nur bestätigen statt frei zu tippen.
     *
     * Quelle der Werte ist ausschließlich getTargets() (= Master-Protokoll /
     * ESPGHAN 2018). Es werden KEINE eigenen Schwellwerte erfunden — die
     * Defaults sind die Mittelwerte der jeweiligen Zielspannen (TFI: untere
     * Grenze, da konservativer Aufbau bevorzugt; Protein/Lipide: Mittelwert).
     *
     * @returns {object} { tfi, protein, lipids, day, rationale }
     */
    getSmartDefaults(input) {
        const t = this.getTargets(input);
        const mid = (a, b) => Math.round(((a + b) / 2) * 10) / 10;
        // TFI: konservativer Aufbau → untere Zielgrenze (gedeckelt durch Cap).
        const tfi = Math.min(t.tfi.min, t.tfi.cap);
        // Protein/AS + Lipide: Mittelwert der Zielspanne.
        const protein = mid(t.protein.min, t.protein.max);
        const lipids = mid(t.lipidTarget.min, t.lipidTarget.max);
        return {
            day: t.effectiveDay,
            tfi,
            protein,
            lipids,
            rationale: `Tag ${t.effectiveDay}: TFI ${t.tfi.min}–${t.tfi.max} (Start ${tfi}) ml/kg/d · ` +
                       `Protein ${t.protein.min}–${t.protein.max} (Ø ${protein}) g/kg/d · ` +
                       `Lipide ${t.lipidTarget.min}–${t.lipidTarget.max} (Ø ${lipids}) g/kg/d — ` +
                       `Quelle: Master-Protokoll / ESPGHAN 2018.`
        };
    }

    /**
     * PREDICTIVE — Sodium Intake Trend (v2.1, Modell B: nur Hinweis)
     * Erkennt eine signifikante Steigerung der Na-Zufuhr in den letzten 48h.
     * Wichtig: bezieht sich auf ZUFUHR (mmol/kg/d), nicht auf Serum-Na — die
     * App hat keinen Lab-Input für Serum-Na. Ein starker Anstieg ist aber
     * ein valider Risiko-Trigger („Serum-Na kontrollieren").
     *
     * Trigger (v2.1, lt. EXECUTION-Spec): Steigerung Δ > 5 mmol/kg/d
     *          zwischen aktueller Zufuhr und der von vor 48 h (Tag-2-Vorher).
     *          Modell-B-Wording: „Hinweis, kein Stop-Signal".
     */
    _analyzeSodiumTrend(history, postnatalAge, currentNaIntake) {
        if (!history || typeof history !== 'object') return null;
        const curDay = parseInt(postnatalAge) || 1;
        const dayMinus2 = String(curDay - 2);
        const prevData = history[dayMinus2];
        if (!prevData) return null;
        const prevNa = parseFloat(prevData['input-sodium']);
        if (!isFinite(prevNa)) return null;
        const delta = currentNaIntake - prevNa;
        return {
            currentIntake: Math.round(currentNaIntake * 100) / 100,
            previousIntake: Math.round(prevNa * 100) / 100,
            delta: Math.round(delta * 100) / 100,
            lookbackDays: 2,
            threshold: 5,
            rising: delta > 5
        };
    }

    /**
     * NICU Phase-Klassifikation (Master-Protokoll):
     *   Phase A — Tag 1–7   (Transition, IWL-dominiert, Elektrolyt-Shift)
     *   Phase B — Tag 8–28  (Aufbau, Wachstum, FM85-Eskalation)
     *   Phase C — Tag 29+   (Konsolidierung, ggf. Eiweiß-Supplement)
     */
    _phaseOfCare(postnatalAge) {
        const d = parseInt(postnatalAge) || 1;
        if (d <= 7) return { id: 'A', label: 'Phase A (Tag 1–7, Transition)' };
        if (d <= 28) return { id: 'B', label: 'Phase B (Tag 8–28, Aufbau)' };
        return { id: 'C', label: 'Phase C (Tag 29+, Konsolidierung)' };
    }

    /**
     * NARRATIVE CLINICAL ASSESSMENT (v2.0 — Chief Physician Review)
     * Erzeugt eine kompakte klinische Beurteilung aus dem berechneten Ergebnis.
     * KEIN Zahlen-Dump — sondern Headline + Bullets, die der Oberarzt in der Visite
     * vorliest. Status: 'critical' (rot) | 'attention' (gelb) | 'stable' (grün).
     *
     * Quellen: ESPGHAN 2018 + NICU_NUTRITION_MASTER_PROTOCOL_V2.
     */
    generateClinicalAssessment(res, input) {
        const r = res.results;
        const c = res.comparisons;
        const phase = this._phaseOfCare(input.postnatalAge);
        const criticals = (res.warnings || []).filter(w => w.startsWith('CRITICAL'));
        const attentions = (res.warnings || []).filter(w => !w.startsWith('CRITICAL'));

        // --- Status-Klassifikation ---
        let status, headline;
        if (criticals.length > 0 || !res.isSafe) {
            status = 'critical';
            headline = criticals.length > 0
                ? `Kritische Befunde (${criticals.length}) — sofortige Re-Evaluation`
                : 'Sicherheits-Limit überschritten — Plan anpassen';
        } else if (attentions.length > 0 ||
                   ['protein', 'energy', 'lipids', 'tfi'].some(k => c[k] && c[k].status !== 'green')) {
            status = 'attention';
            headline = 'Aufmerksamkeit erforderlich — gezielte Anpassungen empfohlen';
        } else {
            status = 'stable';
            headline = `${phase.label.split(' (')[0]}: Zufuhr stabil — Targets im Ziel`;
        }

        // --- Narrative Bullets (max. 5, priorisiert nach Schweregrad) ---
        const bullets = [];
        const push = (kind, text) => { if (bullets.length < 5) bullets.push({ kind, text }); };

        // 1) Kritische Befunde zuerst
        criticals.slice(0, 2).forEach(w => push('critical', w.replace(/^CRITICAL:\s*/, '')));

        // 2) Target-Bewertungen (Energie, Protein, Lipide, TFI)
        const targetBullet = (key, label, unit) => {
            const cm = c[key];
            if (!cm || !cm.target) return;
            const v = cm.value;
            const t = cm.target;
            if (cm.status === 'green') {
                push('positive', `${label} ${v} ${unit} → im Ziel (${t.min}–${t.max}).`);
            } else if (v < t.min) {
                push('warning', `${label}-Target unterschritten: ${v} ${unit} (Ziel ${t.min}–${t.max}).`);
            } else if (v > t.max) {
                push('warning', `${label}-Target überschritten: ${v} ${unit} (Ziel ${t.min}–${t.max}).`);
            }
        };
        // Reihenfolge: Protein und Energie sind klinisch wichtigste Treiber
        targetBullet('protein', 'Protein', 'g/kg/d');
        targetBullet('energy', 'Energie', 'kcal/kg/d');
        targetBullet('lipids', 'Lipide', 'g/kg/d');

        // 3) Ca:P Ratio (Knochenstoffwechsel)
        if (r.caPRatio > 0 && (r.caPRatio < 1.5 || r.caPRatio > 2.0)) {
            push('warning', `Ca:P Ratio ${r.caPRatio}:1 optimierungsbedürftig (Ziel 1.5–2.0).`);
        }

        // 4) Wachstum (Phase B/C)
        if (phase.id !== 'A' && typeof r.weightVelocity === 'number') {
            if (r.weightVelocity < 0) {
                push('warning', `Gewichtsverlust ${r.weightVelocity} g/kg/d — Trend evaluieren.`);
            } else if (r.weightVelocity >= 15 && r.weightVelocity <= 25) {
                push('positive', `Growth Velocity ${r.weightVelocity} g/kg/d → physiologisch.`);
            } else if (r.weightVelocity < 15 && phase.id === 'C') {
                push('warning', `Wachstumsstagnation (${r.weightVelocity} g/kg/d) — Fortifizierung prüfen.`);
            }
        }

        // 5) NPC/Protein (energetische Effizienz)
        if (bullets.length < 5 && r.npcPerProtein > 0 && (r.npcPerProtein < 20 || r.npcPerProtein > 40)) {
            push('warning', `NPC/Protein ${r.npcPerProtein} kcal/g — ${r.npcPerProtein < 20 ? 'Energie zu knapp' : 'Verfettungsrisiko'}.`);
        }

        // Wenn nach allem KEIN Bullet, dann positives Default
        if (bullets.length === 0) {
            push('positive', 'Alle ESPGHAN-Targets im Zielbereich, keine CRITICAL-Flags.');
        }

        // --- Predictive Hints (v2.1, Modell B: diagnostische Hinweise, kein Stop) ---
        // Aus der Trend-Analyse (res.predictive) abgeleitet. Bewusst SEPARAT von den
        // bullets (5er-Cap), damit Kern-Safety-Bullets nie verdrängt werden.
        const predictiveHints = [];
        const pred = res.predictive || {};
        if (pred.energyGap && pred.energyGap.critical) {
            predictiveHints.push({
                kind: 'hint',
                text: `Kumulatives Energiedefizit ${pred.energyGap.cumulativeDeficit} kcal/kg über ` +
                      `${pred.energyGap.daysAnalyzed} d (> ${pred.energyGap.threshold} kcal/kg) — ` +
                      `PEW-/Wachstumsrisiko, Energiezufuhr-Trend prüfen.`
            });
        }
        if (pred.sodiumTrend && pred.sodiumTrend.rising) {
            predictiveHints.push({
                kind: 'hint',
                text: `Na-Zufuhr-Anstieg +${pred.sodiumTrend.delta} mmol/kg/d in 48 h ` +
                      `(> ${pred.sodiumTrend.threshold}) — Serum-Natrium kontrollieren.`
            });
        }

        // --- Summary (1–2 Sätze für die "Visite") ---
        let summary;
        if (status === 'critical') {
            summary = `${phase.label}: ${criticals.length} kritische(r) Befund(e). Plan vor nächster Infusionsbestellung überarbeiten.`;
        } else if (status === 'attention') {
            const drift = bullets.filter(b => b.kind === 'warning').length;
            summary = `${phase.label}: ${drift} Optimierungspunkt${drift === 1 ? '' : 'e'} identifiziert — siehe Bullets.`;
        } else {
            summary = `${phase.label}: Stabile Zufuhr, Plan kann fortgeführt werden.`;
        }

        return {
            status,
            headline,
            summary,
            bullets,
            predictiveHints,
            phase: phase.id,
            phaseLabel: phase.label,
            criticalCount: criticals.length,
            attentionCount: attentions.length
        };
    }

    /**
     * ONE-CLICK CHARTING (v2.0 — Copy for Documentation)
     * Erzeugt einen für die elektronische Patientenakte (EPR) optimierten String,
     * den der Arzt direkt einfügen kann. Format ist kompakt, einzeilig-pro-Domäne,
     * arztverständlich (deutsch, klinische Abkürzungen).
     */
    generateDocumentationString(res, input) {
        const r = res.results;
        const phase = this._phaseOfCare(input.postnatalAge);
        const day = parseInt(input.postnatalAge) || 1;
        const cw = parseFloat(input.currentWeight) || parseFloat(input.birthWeight) || 0;
        const bw = parseFloat(input.birthWeight) || 0;
        const ssw = parseInt(input.ssw) || 0;

        // Korrigiertes GA: ssw + (day-1)/7 (vereinfacht)
        const corrW = ssw + Math.floor((day - 1) / 7);
        const corrD = (day - 1) % 7;
        const corrGA = `${corrW}+${corrD}`;

        // Produkt-Namen aufschlüsseln
        const num = (v, dp = 1) => {
            if (v === null || v === undefined) return '–';
            const n = Number(v);
            if (!isFinite(n)) return '–';
            return n.toFixed(dp);
        };

        const fm85 = parseInt(input.fm85Percent) || 0;
        const ep = input.selectedEnteralProduct || 'ebm';
        const enteralName = { ebm: 'EBM', bebaFG1: 'Beba FG 1', bebaFG2: 'Beba FG 2',
                              aptamilPre: 'Aptamil Pre', hippPre: 'Hipp Pre' }[ep] || ep;
        const enteralLabel = fm85 > 0 ? `${enteralName} + FM85 ${fm85}%` : enteralName;

        const lipidProd = input.selectedLipidProduct === 'smoflipid20' ? 'SMOFlipid 20%' : 'Standard 20%';
        const sol = input.selectedSolution && input.selectedSolution !== 'none'
            ? ({
                fgMix75: 'FG-Mix 7,5%', basisFG: 'Basislösung FG',
                basis100: 'Basis 100', basis120: 'Basis 120', basis150: 'Basis 150',
                basisPeripher: 'Basis peripher'
              }[input.selectedSolution] || input.selectedSolution)
            : 'manuell';
        const access = input.access === 'central' ? 'ZVK' : 'peripher';

        const lines = [];
        lines.push(`Ernährung Tag ${day} (${cw} g, korr. ${corrGA} SSW, ${phase.label}):`);
        lines.push(`- TFI ${num(input.tfi, 0)} ml/kg/d (Ziel ${res.targets.tfi.min}–${res.targets.tfi.max})`);

        if (r.enteralDaily > 0 || parseFloat(input.enteralVolume) > 0) {
            const portion = r.singlePortion ? `, ${input.mealFrequency || 8}× ${num(r.singlePortion)} ml` : '';
            lines.push(`- Enteral ${num(input.enteralVolume, 0)} ml/kg/d (${enteralLabel}${portion})`);
        }

        if (r.pnDaily > 0) {
            lines.push(`- PN ${num(r.pnDaily, 0)} ml/d (${sol}, ${access}) → GIR ${num(r.effectiveGIR)} mg/kg/min, AS ${num(r.proteinTotalGPerKg, 2)} g/kg/d`);
            lines.push(`- Lipide ${num(r.lipidsPNKg, 1)} g/kg/d (${lipidProd}, ${num(r.lipidVolDaily, 1)} ml/d)`);
        }

        const caP = r.caPRatio > 0 ? `Ca:P ${num(r.caPRatio, 2)}:1` : 'Ca:P –';
        const paa = r.paaRatio > 0 ? `P:AA ${num(r.paaRatio, 2)} mmol/g` : 'P:AA –';
        lines.push(`- Energie ${num(r.kcalPerKg, 0)} kcal/kg/d (PN ${num(r.kcalParenteralKg, 0)} / Enteral ${num(r.kcalEnteralKg, 0)}) | ${caP} | ${paa}`);

        if (r.effectiveNa > 0 || r.effectiveK > 0 || r.effectiveCl > 0) {
            lines.push(`- Elektrolyte: Na ${num(r.effectiveNa, 1)} | K ${num(r.effectiveK, 1)} | Cl ${num(r.effectiveCl, 1)} mmol/kg/d (SID ${num(r.sidLight, 1)})`);
        }

        if (typeof r.weightVelocity === 'number') {
            lines.push(`- Growth Velocity ${num(r.weightVelocity, 1)} g/kg/d${bw && cw ? ` (BW ${bw} g → akt. ${cw} g)` : ''}`);
        }

        // Beurteilung — narrative Synthese
        const ass = res.assessment;
        if (ass) {
            lines.push('');
            lines.push(`Beurteilung: ${ass.headline}.`);
            if (ass.bullets && ass.bullets.length) {
                ass.bullets.slice(0, 3).forEach(b => lines.push(`  • ${b.text}`));
            }
        }

        return lines.join('\n');
    }

    /**
     * Growth Velocity: g/kg/d
     * Formula: ((weight_today - weight_yesterday) / weight_today) * 1000
     */
    calculateGrowthVelocity(currentWeightG, previousWeightG) {
        if (!previousWeightG || previousWeightG <= 0 || !currentWeightG || currentWeightG <= 0) {
            return null;
        }
        const curr = this._d(currentWeightG);
        const prev = this._d(previousWeightG);
        return curr.minus(prev).div(curr).times(1000).toDecimalPlaces(1).toNumber();
    }

    calculate(input) {
        const D = (v) => this._d(v);

        // --- Step 0: Hard Input Validation (Safety-First, vor jeder Berechnung) ---
        // Klinisch/physikalisch unmögliche Werte führen zum sofortigen Abbruch.
        // SIEHE AGENTS.md — dieser Layer ist SAKROSANKT und darf nie entfernt werden.
        const validate = (raw, field, { min, max, minMsg, maxMsg, allowEmpty = true }) => {
            // Leere Strings/null/undefined als "nicht gesetzt" tolerieren (Default-Werte greifen unten)
            if (allowEmpty && (raw === '' || raw === null || raw === undefined)) return;
            const v = parseFloat(raw);
            // Non-numeric (z.B. "abc") → hart abbrechen
            if (raw !== '' && raw !== null && raw !== undefined && isNaN(v)) {
                throw new ValidationError(
                    `${field}: "${raw}" ist keine gültige Zahl.`,
                    field
                );
            }
            if (!isNaN(v) && min !== undefined && v < min) {
                throw new ValidationError(minMsg || `${field} ${v} unterschreitet das Minimum (${min}).`, field);
            }
            if (!isNaN(v) && max !== undefined && v > max) {
                throw new ValidationError(maxMsg || `${field} ${v} überschreitet das Maximum (${max}).`, field);
            }
        };

        // Gewicht & Alter
        validate(input.birthWeight, 'birthWeight', {
            min: 200.0001, max: 8000,
            minMsg: `Geburtsgewicht ${input.birthWeight}g ist klinisch unmöglich (muss > 200g sein).`,
            maxMsg: `Geburtsgewicht ${input.birthWeight}g überschreitet realistisches Maximum (8000g).`
        });
        validate(input.currentWeight, 'currentWeight', {
            min: 0, max: 10000,
            maxMsg: `Aktuelles Gewicht ${input.currentWeight}g überschreitet realistisches Maximum (10000g).`
        });
        validate(input.postnatalAge, 'postnatalAge', {
            min: 0, max: 365,
            maxMsg: `Postnatales Alter ${input.postnatalAge} Tage überschreitet 1 Jahr — Tool nicht validiert.`
        });
        validate(input.ssw, 'ssw', {
            min: 22, max: 44,
            minMsg: `SSW ${input.ssw} < 22 — außerhalb klinisch validierter Grenze.`,
            maxMsg: `SSW ${input.ssw} > 44 — unplausibel.`
        });

        // Flüssigkeit & Glucose
        validate(input.tfi, 'tfi', {
            min: 0, max: 200,
            maxMsg: `TFI ${input.tfi} ml/kg/d überschreitet das klinische Maximum (200 ml/kg/d).`
        });
        validate(input.gir, 'gir', {
            min: 0, max: 25,
            maxMsg: `GIR ${input.gir} mg/kg/min überschreitet realistisches Maximum (25).`
        });

        // Makronährstoffe — Hard-Limit deutlich über klinischem Max für Fat-Finger-Schutz
        validate(input.protein, 'protein', {
            min: 0, max: 6,
            maxMsg: `Protein ${input.protein} g/kg/d überschreitet jedes klinische Maximum (Tippfehler?).`
        });
        validate(input.lipids, 'lipids', {
            min: 0, max: 6,
            maxMsg: `Lipide ${input.lipids} g/kg/d überschreiten jedes klinische Maximum (Tippfehler?).`
        });

        // Mineralien
        validate(input.calcium, 'calcium', {
            min: 0, max: 200,
            maxMsg: `Calcium ${input.calcium} mg/kg/d überschreitet realistisches Maximum (200).`
        });
        validate(input.phosphate, 'phosphate', {
            min: 0, max: 150,
            maxMsg: `Phosphat ${input.phosphate} mg/kg/d überschreitet realistisches Maximum (150).`
        });
        validate(input.sodium, 'sodium', { min: 0, max: 15 });
        validate(input.potassium, 'potassium', { min: 0, max: 10 });

        // Enterale Konfiguration
        validate(input.enteralVolume, 'enteralVolume', { min: 0, max: 250 });
        validate(input.fm85Percent, 'fm85Percent', {
            min: 0, max: 6,
            maxMsg: `FM85 ${input.fm85Percent}% überschreitet maximale Dosierung (6%).`
        });
        validate(input.mealFrequency, 'mealFrequency', {
            min: 1, max: 24,
            minMsg: `Mahlzeiten-Frequenz muss ≥ 1 sein.`
        });

        // Labor
        validate(input.triglycerides, 'triglycerides', { min: 0, max: 2000 });
        validate(input.urea, 'urea', { min: 0, max: 100 });

        // --- R-02: Hard-Limits für bisher ungeprüfte Volumen-/Elektrolyt-Felder ---
        // Schutz vor Tippfehlern (z.B. "20" statt "2.0" ml NaCl).
        validate(input.carrierVolume, 'carrierVolume', {
            min: 0, max: 100,
            maxMsg: `Trägerlösung-Volumen ${input.carrierVolume} ml/kg/d überschreitet realistisches Maximum (100).`
        });
        validate(input.microVolume, 'microVolume', {
            min: 0, max: 50,
            maxMsg: `Mikronährstoff-Volumen ${input.microVolume} ml/d überschreitet realistisches Maximum (50).`
        });
        validate(input.naclMl, 'naclMl', {
            min: 0, max: 50,
            maxMsg: `NaCl-Zusatz ${input.naclMl} mmol/kg/d überschreitet realistisches Maximum (50) — Tippfehler?`
        });
        validate(input.kclMl, 'kclMl', {
            min: 0, max: 20,
            maxMsg: `KCl-Zusatz ${input.kclMl} mmol/kg/d überschreitet realistisches Maximum (20) — Tippfehler?`
        });
        validate(input.secondaryRateKg, 'secondaryRateKg', {
            min: 0, max: 200,
            maxMsg: `Sekundärinfusion ${input.secondaryRateKg} ml/kg/d überschreitet realistisches Maximum (200).`
        });
        validate(input.hiddenSodiumMmolKg, 'hiddenSodiumMmolKg', {
            min: 0, max: 20,
            maxMsg: `Hidden Sodium ${input.hiddenSodiumMmolKg} mmol/kg/d überschreitet realistisches Maximum (20).`
        });
        validate(input.length, 'length', {
            min: 0, max: 100,
            maxMsg: `Körperlänge ${input.length} cm überschreitet realistisches Maximum (100).`
        });
        validate(input.head, 'head', {
            min: 0, max: 60,
            maxMsg: `Kopfumfang ${input.head} cm überschreitet realistisches Maximum (60).`
        });
        validate(input.previousWeight, 'previousWeight', {
            min: 0, max: 10000,
            maxMsg: `Vortags-Gewicht ${input.previousWeight}g überschreitet realistisches Maximum (10000g).`
        });

        // --- Parse all inputs as Decimal (R-02: über _safeParseNum, garantiert finite numbers) ---
        const sp = (raw, field, opts) => this._safeParseNum(raw, field, opts);

        const birthWeightG = D(sp(input.birthWeight, 'birthWeight', { defaultValue: 1000 }));
        const currentWeightG = D(sp(input.currentWeight, 'currentWeight', { defaultValue: birthWeightG.toNumber() }));
        const postnatalAge = Math.max(1, sp(input.postnatalAge, 'postnatalAge', { defaultValue: 1, integer: true }));
        const ssw = sp(input.ssw, 'ssw', { defaultValue: 28, integer: true });
        const tfi = D(sp(input.tfi, 'tfi', { defaultValue: 0 }));
        const enteralVolKg = D(sp(input.enteralVolume, 'enteralVolume', { defaultValue: 0 }));
        const fm85Percent = sp(input.fm85Percent, 'fm85Percent', { defaultValue: 0, integer: true });
        const carrierVolKg = D(sp(input.carrierVolume, 'carrierVolume', { defaultValue: 0 }));
        const urea = input.urea !== null && input.urea !== undefined && input.urea !== ''
            ? sp(input.urea, 'urea', { defaultValue: null })
            : null;
        const triglycerides = input.triglycerides !== null && input.triglycerides !== undefined && input.triglycerides !== ''
            ? sp(input.triglycerides, 'triglycerides', { defaultValue: null })
            : null;
        const gir = D(sp(input.gir, 'gir', { defaultValue: 0 }));
        const proteinPNKg = D(sp(input.protein, 'protein', { defaultValue: 0 }));
        const lipidsPNKg = D(sp(input.lipids, 'lipids', { defaultValue: 0 }));
        const calciumMgKg = D(sp(input.calcium, 'calcium', { defaultValue: 0 }));
        const phosphateMgKg = D(sp(input.phosphate, 'phosphate', { defaultValue: 0 }));
        const sodiumMmolKg = D(sp(input.sodium, 'sodium', { defaultValue: 0 }));
        const potassiumMmolKg = D(sp(input.potassium, 'potassium', { defaultValue: 0 }));
        const access = input.access || 'peripheral';
        const ventilationStatus = input.ventilationStatus || 'spontaneous';
        const selectedSolution = input.selectedSolution || 'none';
        const selectedEnteralProduct = input.selectedEnteralProduct || 'ebm';
        const selectedLipidProduct = input.selectedLipidProduct || 'standardLipid';
        const mealFrequency = sp(input.mealFrequency, 'mealFrequency', { defaultValue: 8, integer: true });
        const naclMl = D(sp(input.naclMl, 'naclMl', { defaultValue: 0 }));
        const kclMl = D(sp(input.kclMl, 'kclMl', { defaultValue: 0 }));
        const secondarySolution = input.secondarySolution || 'none';
        const secondaryRateKg = D(sp(input.secondaryRateKg, 'secondaryRateKg', { defaultValue: 0 }));
        const hiddenSodiumMmolKg = D(sp(input.hiddenSodiumMmolKg, 'hiddenSodiumMmolKg', { defaultValue: 0 }));

        // --- Step 0: Growth Percentile ---
        let weightPercentile = 'N/A';
        if (typeof GrowthCalculator !== 'undefined') {
            try {
                weightPercentile = GrowthCalculator.getPercentile('WEIGHT', ssw, currentWeightG.toNumber());
            } catch (e) { /* ignore */ }
        }

        let lengthZScore = null;
        let headZScore = null;
        if (typeof GrowthCalculator !== 'undefined') {
            try {
                const lengthCm = parseFloat(input.length) || null;
                const headCm = parseFloat(input.head) || null;
                if (lengthCm) {
                    lengthZScore = GrowthCalculator.calculateZScore('length', 'male', ssw + (postnatalAge / 7), lengthCm);
                    if (lengthZScore !== null) lengthZScore = Math.round(lengthZScore * 100) / 100;
                }
                if (headCm) {
                    headZScore = GrowthCalculator.calculateZScore('head', 'male', ssw + (postnatalAge / 7), headCm);
                    if (headZScore !== null) headZScore = Math.round(headZScore * 100) / 100;
                }
            } catch (e) { /* ignore */ }
        }

        // --- Step 0b: Growth Velocity ---
        let weightVelocity = 'Initial';
        const previousWeight = input.previousWeight != null ? parseFloat(input.previousWeight) : null;
        if (previousWeight && previousWeight > 0) {
            const gv = this.calculateGrowthVelocity(currentWeightG.toNumber(), previousWeight);
            if (gv !== null) {
                weightVelocity = gv;
            }
        } else if (input.weightVelocity !== undefined && input.weightVelocity !== 'Initial') {
            weightVelocity = input.weightVelocity;
        }

        // --- Step 1: Weight Logic ---
        const calculationWeightG = postnatalAge <= 10
            ? Decimal.max(birthWeightG, currentWeightG)
            : currentWeightG;
        const weightKg = calculationWeightG.div(1000);

        // --- Step 2: Targets ---
        const targets = this.getTargets(input);

        // --- Step 3b: Secondary Infusion ---
        let secondaryGlucoseGKg = D(0);
        let secondaryNaMmolKg = D(0);
        let secondaryClMmolKg = D(0);
        const secondaryDaily = weightKg.times(secondaryRateKg).toDecimalPlaces(1);

        if (secondarySolution !== 'none' && secondaryRateKg.gt(0) && typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.secondarySolutions) {
            const secSol = window.NeoProducts.secondarySolutions.find(s => s.id === secondarySolution);
            if (secSol && secSol.per100ml) {
                // Calculate contributions per kg using Decimal.js
                const glucosePer100 = D(secSol.per100ml.glucose_g);
                const naPer100 = D(secSol.per100ml.sodium_mmol);
                const clPer100 = D(secSol.per100ml.chloride_mmol);
                
                secondaryGlucoseGKg = secondaryRateKg.times(glucosePer100).div(100).toDecimalPlaces(3);
                secondaryNaMmolKg = secondaryRateKg.times(naPer100).div(100).toDecimalPlaces(2);
                secondaryClMmolKg = secondaryRateKg.times(clPer100).div(100).toDecimalPlaces(2);
            }
        }

        // --- Step 4: Volumes ---
        // R-04: Lipid volume = lipids (g/kg) * weightKg / lipidConcentration (g/ml)
        // Both SMOFlipid 20% and Standard 20% = 20g fat per 100ml = 0.2 g/ml
        let lipidFatPer100ml = D(20);
        if (typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.lipidProducts) {
            const lp = window.NeoProducts.lipidProducts.find(p => p.id === selectedLipidProduct);
            if (lp && lp.fatPer100ml) lipidFatPer100ml = D(lp.fatPer100ml);
        }
        // lipidVolDaily (ml) = lipids_g_kg * weightKg / (fatPer100ml / 100)
        // = lipids_g_kg * weightKg * 100 / fatPer100ml
        const lipidVolDaily = lipidsPNKg.times(weightKg).times(100).div(lipidFatPer100ml).toDecimalPlaces(1);

        const microVolKg = D(parseFloat(input.microVolume) || 0);
        const totalDailyFluid = weightKg.times(tfi).toDecimalPlaces(1);
        const enteralDaily = weightKg.times(enteralVolKg).toDecimalPlaces(1);
        const carrierDaily = weightKg.times(carrierVolKg).toDecimalPlaces(1);
        const microDaily = weightKg.times(microVolKg).toDecimalPlaces(1);
        // R-07: Secondary infusion subtracts from available PN capacity
        const pnDailyGrossRaw = totalDailyFluid.minus(enteralDaily).minus(carrierDaily).minus(secondaryDaily).minus(microDaily);
        const pnVolumeOverflow = pnDailyGrossRaw.lt(0);
        const pnDailyGross = Decimal.max(0, pnDailyGrossRaw).toDecimalPlaces(1);
        // R-04: PN-Netto = Gross PN minus lipid volume
        const pnDaily = Decimal.max(0, pnDailyGross.minus(lipidVolDaily)).toDecimalPlaces(1);
        const lipidExceedsPN = lipidVolDaily.gt(pnDailyGross) && pnDailyGross.gt(0);

        // --- Step 3: Solution Configurator ---
        // BLIND-1 Guard: When PN volume = 0, manual PN inputs must not contribute
        const hasPNVolume = pnDaily.gt(0);

        let effectiveAS = hasPNVolume ? proteinPNKg : D(0);
        let effectiveGlucose = D(0);
        let effectiveNa = hasPNVolume ? sodiumMmolKg.plus(naclMl) : naclMl;
        let effectiveK = hasPNVolume ? potassiumMmolKg.plus(kclMl) : kclMl;
        let effectiveCa_mmol = hasPNVolume ? calciumMgKg.div(this.MOLAR_MASS.CALCIUM) : D(0);
        let effectiveP_mmol = hasPNVolume ? phosphateMgKg.div(this.MOLAR_MASS.PHOSPHORUS) : D(0);
        let effectiveGIR = hasPNVolume ? gir : D(0);
        let solutionMicro = null;
        let useSolution = false;

        if (selectedSolution !== 'none' && typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.parenteralSolutions) {
            const solution = window.NeoProducts.parenteralSolutions.find(s => s.id === selectedSolution);
            if (solution && solution.targetVolume && solution.perKgAtTarget) {
                useSolution = true;
                const targetVol = D(solution.targetVolume);
                const scaleFactor = weightKg.gt(0) && targetVol.gt(0)
                    ? pnDaily.div(targetVol.times(weightKg))
                    : D(0);

                effectiveAS = D(solution.perKgAtTarget.aminoAcids).times(scaleFactor).toDecimalPlaces(2);
                effectiveGlucose = D(solution.perKgAtTarget.glucose).times(scaleFactor).toDecimalPlaces(2);
                effectiveNa = D(solution.perKgAtTarget.sodium).times(scaleFactor).plus(naclMl).toDecimalPlaces(2);
                effectiveK = D(solution.perKgAtTarget.potassium).times(scaleFactor).plus(kclMl).toDecimalPlaces(2);
                effectiveCa_mmol = D(solution.perKgAtTarget.calcium).times(scaleFactor).toDecimalPlaces(4);
                effectiveP_mmol = D(solution.perKgAtTarget.phosphate).times(scaleFactor).toDecimalPlaces(4);

                if (solution.micronutrients) {
                    solutionMicro = solution.micronutrients;
                }
            }
        }

        if (!useSolution) {
            // GIR-based glucose: (GIR * 1440) / 1000 = g/kg/d
            effectiveGlucose = hasPNVolume ? gir.times(1440).div(1000).toDecimalPlaces(2) : D(0);
        }

        // Add secondary glucose to total glucose (for GIR calculation and energy)
        const totalGlucoseGKg = effectiveGlucose.plus(secondaryGlucoseGKg).toDecimalPlaces(2);

        // --- Step 5: GIR and Glucose ---
        if (useSolution) {
            // Reverse-calc GIR from solution glucose (PN only, not secondary)
            effectiveGIR = effectiveGlucose.times(1000).div(1440).toDecimalPlaces(2);
        }
        // For manual mode, effectiveGIR is already set via hasPNVolume guard above
        
        // Recalculate effective GIR including secondary glucose
        const totalGIR = totalGlucoseGKg.times(1000).div(1440).toDecimalPlaces(2);

        const glucoseTotalG = totalGlucoseGKg.times(weightKg).toDecimalPlaces(2);
        const glucoseConc = pnDaily.gt(0)
            ? glucoseTotalG.div(pnDaily).times(100).toDecimalPlaces(1)
            : D(0);

        // --- Step 6: Lipid Energy ---
        // SMOFlipid 20%: consistently 20g fat/100ml, 10 kcal/g
        let kcalPerGFat = D(this.CALORIES.LIPIDS_STANDARD);
        if (typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.lipidProducts) {
            const lipidProduct = window.NeoProducts.lipidProducts.find(p => p.id === selectedLipidProduct);
            if (lipidProduct && lipidProduct.kcalPerGFat) {
                kcalPerGFat = D(lipidProduct.kcalPerGFat);
            }
        }
        if (selectedLipidProduct === 'smoflipid20') {
            kcalPerGFat = D(this.CALORIES.LIPIDS_SMOFLIPID);
        }

        // --- Step 7: Enteral Nutrition ---
        let enteralProteinGKg = D(0);
        let enteralKcalKg = D(0);
        let enteralFatGKg = D(0);
        let enteralCarbsGKg = D(0);
        let enteralNaMmolKg = D(0);

        let baseProteinPer100 = D('1.13');
        let baseKcalPer100 = D(71);

        if (typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.enteralProducts) {
            const enteralProduct = window.NeoProducts.enteralProducts.find(p => p.id === selectedEnteralProduct);
            if (enteralProduct && enteralProduct.per100ml) {
                baseProteinPer100 = D(enteralProduct.per100ml.protein);
                baseKcalPer100 = D(enteralProduct.per100ml.kcal);
                const baseFatPer100 = D(enteralProduct.per100ml.fat || 0);
                const baseCarbsPer100 = D(enteralProduct.per100ml.carbs || 0);
                const baseNaMgPer100 = D(enteralProduct.per100ml.sodium_mg || 0);
            }
        }

        if (selectedEnteralProduct === 'ebm' && enteralVolKg.gt(0) && fm85Percent > 0) {
            // FM85 fortification — full nutrient model
            const fortifiedProtein = D('1.13').plus(D(fm85Percent).times('0.4675'));
            enteralProteinGKg = enteralVolKg.times(fortifiedProtein).div(100).toDecimalPlaces(3);
            const fortifiedKcal = D(71).plus(D(fm85Percent).times('3.5'));
            enteralKcalKg = enteralVolKg.times(fortifiedKcal).div(100).toDecimalPlaces(2);
            const fortifiedFat = D('4.03').plus(D(fm85Percent).times('0.05'));
            enteralFatGKg = enteralVolKg.times(fortifiedFat).div(100).toDecimalPlaces(3);
            const fortifiedCarbs = D('7.0').plus(D(fm85Percent).times('0.6'));
            enteralCarbsGKg = enteralVolKg.times(fortifiedCarbs).div(100).toDecimalPlaces(3);
            const fortifiedNaMg = D(7).plus(D(fm85Percent).times(3));
            enteralNaMmolKg = enteralVolKg.times(fortifiedNaMg).div(100).div(23).toDecimalPlaces(3);
        } else {
            enteralProteinGKg = enteralVolKg.times(baseProteinPer100).div(100).toDecimalPlaces(3);
            enteralKcalKg = enteralVolKg.times(baseKcalPer100).div(100).toDecimalPlaces(2);

            if (typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.enteralProducts) {
                const ep2 = window.NeoProducts.enteralProducts.find(p => p.id === selectedEnteralProduct);
                if (ep2 && ep2.per100ml) {
                    enteralFatGKg = enteralVolKg.times(D(ep2.per100ml.fat || 0)).div(100).toDecimalPlaces(3);
                    enteralCarbsGKg = enteralVolKg.times(D(ep2.per100ml.carbs || 0)).div(100).toDecimalPlaces(3);
                    enteralNaMmolKg = enteralVolKg.times(D(ep2.per100ml.sodium_mg || 0)).div(100).div(23).toDecimalPlaces(3);
                }
            }
        }

        // --- AUDIT: Enteral Ca/P contribution (Osteopenie-Prävention) ---
        let enteralCaMgKg = D(0);
        let enteralPMgKg = D(0);
        if (typeof window !== 'undefined' && window.NeoProducts && window.NeoProducts.enteralProducts) {
            const ep = window.NeoProducts.enteralProducts.find(p => p.id === selectedEnteralProduct);
            if (ep && ep.per100ml) {
                let basePMg = D(ep.per100ml.phosphorus_mg || 0);
                let baseCaMg = D(ep.per100ml.calcium_mg || (selectedEnteralProduct === 'ebm' ? 28 : 0));
                if (selectedEnteralProduct === 'ebm' && fm85Percent > 0) {
                    baseCaMg = baseCaMg.plus(D(fm85Percent).times(40));
                    basePMg = basePMg.plus(D(fm85Percent).times(22));
                }
                enteralPMgKg = enteralVolKg.times(basePMg).div(100).toDecimalPlaces(2);
                enteralCaMgKg = enteralVolKg.times(baseCaMg).div(100).toDecimalPlaces(2);
            }
        }

        // Effective Ca/P in mg/kg/d AND mmol/kg/d (PN only)
        const effectiveCaMg = effectiveCa_mmol.times(this.MOLAR_MASS.CALCIUM).toDecimalPlaces(1);
        const effectivePMg = effectiveP_mmol.times(this.MOLAR_MASS.PHOSPHORUS).toDecimalPlaces(1);
        const effectiveCaMmol = effectiveCa_mmol.toDecimalPlaces(3);
        const effectivePMmol = effectiveP_mmol.toDecimalPlaces(3);

        // Total Ca/P (PN + Enteral) for metabolic bone disease assessment
        const totalCaMgKg = effectiveCaMg.plus(enteralCaMgKg).toDecimalPlaces(1);
        const totalPMgKg = effectivePMg.plus(enteralPMgKg).toDecimalPlaces(1);
        const totalCaMmolKg = totalCaMgKg.div(this.MOLAR_MASS.CALCIUM).toDecimalPlaces(3);
        const totalPMmolKg = totalPMgKg.div(this.MOLAR_MASS.PHOSPHORUS).toDecimalPlaces(3);

        // Add secondary Na + Cl to electrolyte balance
        effectiveNa = effectiveNa.plus(secondaryNaMmolKg).plus(hiddenSodiumMmolKg).toDecimalPlaces(2);
        const effectiveCl = naclMl.plus(kclMl).plus(secondaryClMmolKg).toDecimalPlaces(2);

        // --- AUDIT: SID-light (Strong Ion Difference) ---
        // SID = (Na + K) - Cl [mmol/kg/d] — proxy for metabolic acid-base
        const sidLight = effectiveNa.plus(effectiveK).minus(effectiveCl).toDecimalPlaces(2);

        // --- Step 8: Totals ---
        const proteinTotalGKg = effectiveAS.plus(enteralProteinGKg).toDecimalPlaces(2);

        // Total glucose intake: PN glucose + enteral carbs (approximated as glucose equivalent)
        const totalGlucoseIntakeGKg = totalGlucoseGKg.plus(enteralCarbsGKg).toDecimalPlaces(2);
        const totalGIRIncEnteral = totalGlucoseIntakeGKg.times(1000).div(1440).toDecimalPlaces(1);

        const totalLipidsGKg = lipidsPNKg.plus(enteralFatGKg).toDecimalPlaces(2);

        // P:AA Ratio: mmol total phosphate / g total protein — target ≥ 1.0
        let paaRatio = D(0);
        if (proteinTotalGKg.gt(0)) {
            paaRatio = totalPMmolKg.div(proteinTotalGKg).toDecimalPlaces(2);
        }

        // Energy from total glucose (PN + secondary)
        const kcalGlucose = totalGlucoseGKg.times(this.CALORIES.GLUCOSE).toDecimalPlaces(1);
        const kcalLipid = lipidsPNKg.times(kcalPerGFat).toDecimalPlaces(1);
        const kcalProteinPN = effectiveAS.times(this.CALORIES.PROTEIN).toDecimalPlaces(1);
        const kcalParenteralKg = kcalGlucose.plus(kcalLipid).plus(kcalProteinPN).toDecimalPlaces(1);
        const kcalEnteralKg = enteralKcalKg.toDecimalPlaces(1);
        const kcalPerKg = kcalParenteralKg.plus(kcalEnteralKg).toDecimalPlaces(1);

        // --- NPC Ratio (Non-Protein Calories) ---
        const npcTotal = kcalGlucose.plus(kcalLipid).toDecimalPlaces(1);
        let npcLipidPercent = D(0);
        let npcGlucosePercent = D(0);
        if (npcTotal.gt(0)) {
            npcLipidPercent = kcalLipid.div(npcTotal).times(100).toDecimalPlaces(1);
            npcGlucosePercent = kcalGlucose.div(npcTotal).times(100).toDecimalPlaces(1);
        }

        // --- NPC/P Ratio (Energy Efficiency) ---
        const enteralProteinKcal = enteralProteinGKg.times(this.CALORIES.PROTEIN);
        const enteralNonProteinKcal = kcalEnteralKg.gt(0) ? Decimal.max(0, kcalEnteralKg.minus(enteralProteinKcal)) : D(0);
        const npcTotalAll = npcTotal.plus(enteralNonProteinKcal).toDecimalPlaces(1);
        let npcPerProtein = D(0);
        if (proteinTotalGKg.gt(0)) {
            npcPerProtein = npcTotalAll.div(proteinTotalGKg).toDecimalPlaces(1);
        }

        // --- Step 9: Ca:P Ratio (molar) — TOTAL (PN + Enteral) ---
        let caPRatio = D(0);
        if (totalPMmolKg.gt(0)) {
            caPRatio = totalCaMmolKg.div(totalPMmolKg).toDecimalPlaces(2);
        }

        // --- Step 10: Osmolarity (+ Breakdown für UI/Klinische Tiefe) ---
        // Beiträge der Hauptkomponenten zur Gesamt-Osmolarität (Glukose, AS, Na, K).
        // Rein deskriptiv — keine Dosierungsempfehlung. Faustformel:
        //   Glukose-Beitrag  = [g/l] × 5
        //   AS-Beitrag       = [g/l] × 10
        //   Na-Beitrag       = [mmol/l] × 2  (NaCl dissoziiert → 2 osmotisch aktive Teilchen)
        //   K-Beitrag        = [mmol/l] × 2
        let osmolarity = D(0);
        let osmolarityBreakdown = {
            glucose: 0, protein: 0, sodium: 0, potassium: 0, total: 0
        };
        if (pnDaily.gt(0)) {
            const pnLiters = pnDaily.div(1000);
            const glucoseGL = glucoseTotalG.div(pnLiters);
            const proteinGL = effectiveAS.times(weightKg).div(pnLiters);
            const naMmolL = effectiveNa.times(weightKg).div(pnLiters);
            const kMmolL = effectiveK.times(weightKg).div(pnLiters);
            const osmGlucose = glucoseGL.times(5);
            const osmProtein = proteinGL.times(10);
            const osmSodium = naMmolL.times(2);
            const osmPotassium = kMmolL.times(2);
            osmolarity = osmGlucose.plus(osmProtein).plus(osmSodium).plus(osmPotassium).toDecimalPlaces(0);
            osmolarityBreakdown = {
                glucose: osmGlucose.toDecimalPlaces(0).toNumber(),
                protein: osmProtein.toDecimalPlaces(0).toNumber(),
                sodium: osmSodium.toDecimalPlaces(0).toNumber(),
                potassium: osmPotassium.toDecimalPlaces(0).toNumber(),
                total: osmolarity.toNumber()
            };
        }

        // --- Step 11: Meal Portions & Reminders ---
        const singlePortion = mealFrequency > 0
            ? enteralDaily.div(mealFrequency).toDecimalPlaces(1)
            : D(0);

        // --- Convert Decimals to Numbers for comparisons & output ---
        const n = {
            totalDailyFluid: totalDailyFluid.toNumber(),
            pnDailyGross: pnDailyGross.toNumber(),
            pnDaily: pnDaily.toNumber(),
            lipidVolDaily: lipidVolDaily.toNumber(),
            enteralDaily: enteralDaily.toNumber(),
            secondaryDaily: secondaryDaily.toNumber(),
            glucoseConc: glucoseConc.toNumber(),
            effectiveGIR: totalGIR.toDecimalPlaces(1).toNumber(),
            osmolarity: osmolarity.toNumber(),
            osmolarityBreakdown: osmolarityBreakdown,
            caPRatio: caPRatio.toNumber(),
            proteinTotalGKg: proteinTotalGKg.toNumber(),
            effectiveAS: effectiveAS.toDecimalPlaces(2).toNumber(),
            lipidsPNKg: lipidsPNKg.toDecimalPlaces(1).toNumber(),
            kcalPerKg: kcalPerKg.toNumber(),
            kcalParenteralKg: kcalParenteralKg.toNumber(),
            kcalEnteralKg: kcalEnteralKg.toNumber(),
            effectiveCaMg: effectiveCaMg.toNumber(),
            effectivePMg: effectivePMg.toNumber(),
            effectiveCaMmol: effectiveCaMmol.toNumber(),
            effectivePMmol: effectivePMmol.toNumber(),
            effectiveNa: effectiveNa.toDecimalPlaces(2).toNumber(),
            effectiveK: effectiveK.toDecimalPlaces(2).toNumber(),
            effectiveCl: effectiveCl.toDecimalPlaces(2).toNumber(),
            singlePortion: singlePortion.toNumber(),
            enteralVolKg: enteralVolKg.toNumber(),
            sidLight: sidLight.toNumber(),
            naClRatio: effectiveCl.gt(0) ? effectiveNa.div(effectiveCl).toDecimalPlaces(2).toNumber() : 0,
            hiddenSodiumMmolKg: hiddenSodiumMmolKg.toNumber(),
            enteralCaMgKg: enteralCaMgKg.toNumber(),
            enteralPMgKg: enteralPMgKg.toNumber(),
            enteralProteinGKg: enteralProteinGKg.toDecimalPlaces(2).toNumber(),
            enteralFatGKg: enteralFatGKg.toDecimalPlaces(2).toNumber(),
            enteralCarbsGKg: enteralCarbsGKg.toDecimalPlaces(2).toNumber(),
            enteralKcalKg: enteralKcalKg.toDecimalPlaces(1).toNumber(),
            enteralNaMmolKg: enteralNaMmolKg.toDecimalPlaces(2).toNumber(),
            totalCaMgKg: totalCaMgKg.toNumber(),
            totalPMgKg: totalPMgKg.toNumber(),
            totalGIRIncEnteral: totalGIRIncEnteral.toNumber(),
            totalLipidsGKg: totalLipidsGKg.toDecimalPlaces(2).toNumber(),
            paaRatio: paaRatio.toNumber(),
            npcTotal: npcTotal.toNumber(),
            npcLipidPercent: npcLipidPercent.toNumber(),
            npcGlucosePercent: npcGlucosePercent.toNumber(),
            kcalGlucose: kcalGlucose.toNumber(),
            kcalLipid: kcalLipid.toNumber(),
            microVolDaily: microDaily.toNumber(),
            npcTotalAll: npcTotalAll.toNumber(),
            npcPerProtein: npcPerProtein.toNumber()
        };

        const reminders = [];
        const lipidDayKey = Math.min(Math.max(1, postnatalAge), 4);
        const dayLipidTarget = this.LIPID_TARGETS[lipidDayKey];

        if (n.singlePortion >= 3) {
            reminders.push('💡 Vitamin D (500 IE) und Proprems (Probiotika) ab jetzt indiziert');
        }
        if (postnatalAge >= 3 && selectedSolution === 'fgMix75') {
            reminders.push('💡 Tag ≥ 3: Wechsel von FG-Mix 7,5% auf Basislösung FG empfohlen');
        }
        if (fm85Percent > 0 && n.enteralVolKg < 100) {
            reminders.push('💡 FM85 aktiv bei < 100 ml/kg/d – Verträglichkeit engmaschig kontrollieren');
        }
        // BLIND-4: Only show lipid reminder when PN is actually running
        if (n.lipidsPNKg < dayLipidTarget.min && hasPNVolume) {
            reminders.push(`💡 Lipid-Dosis (${n.lipidsPNKg} g/kg) unter Tagesziel (${dayLipidTarget.min}–${dayLipidTarget.max} g/kg/d) – Steigerung prüfen`);
        }
        if (triglycerides !== null && triglycerides > 200 && triglycerides <= 250) {
            reminders.push(`💡 Triglyzeride erhöht (${triglycerides} mg/dl) – Lipid-Reduktion erwägen`);
        }
        // BLIND-3: Only suggest protein supplement if total protein is not already exceeding max
        if (fm85Percent >= 4 && urea !== null && urea < 3 && n.proteinTotalGKg <= this.LIMITS.PROTEIN.max) {
            reminders.push('💡 Empfehlung: +0.5 g/kg/d Protein (Aptamil Eiweiß+)');
        }
        if (n.enteralVolKg >= 50 && n.enteralVolKg < 100 && fm85Percent === 0 && selectedEnteralProduct === 'ebm') {
            reminders.push('💡 Fortifizierung (FM85) empfohlen ab enteralem Volumen von 50 ml/kg/d (ESPGHAN).');
        }
        if (n.enteralVolKg >= 100 && fm85Percent === 0 && selectedEnteralProduct === 'ebm') {
            reminders.push('💡 FM85 Start-Kriterium erfüllt (≥ 100 ml/kg/d enteral)');
        }
        if (fm85Percent > 0 && n.enteralVolKg >= 100) {
            reminders.push('💡 FM85-Voraussetzung: Stabiles Abdomen, enterale Ernährung > 5–7 Tage toleriert');
        }

        // --- Step 12: Warnings (Tiered Alerting) ---
        const warnings = [];

        // CRITICAL (red)
        if (access === 'peripheral' && n.osmolarity > this.LIMITS.OSM_PERIPHERAL) {
            warnings.push(`CRITICAL: Osmolarität ${n.osmolarity} mOsm/l > 900 mOsm/l bei peripherem Zugang!`);
        }
        if (n.effectiveGIR > this.LIMITS.GIR.max) {
            warnings.push(`CRITICAL: GIR ${n.effectiveGIR} mg/kg/min überschreitet Maximum (${this.LIMITS.GIR.max}).`);
        }
        if (n.proteinTotalGKg > this.LIMITS.PROTEIN.max) {
            warnings.push(`CRITICAL: Protein gesamt ${n.proteinTotalGKg} g/kg/d überschreitet Maximum (${this.LIMITS.PROTEIN.max}).`);
        }
        if (n.lipidsPNKg > this.LIMITS.LIPIDS.max) {
            warnings.push(`CRITICAL: Lipide ${n.lipidsPNKg} g/kg/d überschreitet Maximum (${this.LIMITS.LIPIDS.max}).`);
        }
        if (ventilationStatus === 'invasive' && tfi.gt(140)) {
            warnings.push('CRITICAL: TFI > 140 ml/kg/d bei invasiver Beatmung!');
        }
        if (pnVolumeOverflow) {
            warnings.push('CRITICAL: TFI überschritten! Sekundärinfusionen reduzieren.');
        }
        if (triglycerides !== null && triglycerides > 250) {
            warnings.push('CRITICAL: Triglyzeride > 250 mg/dl – Hypertriglyceridämie! Lipidzufuhr auf 0,5–1,0 g/kg/d reduzieren (ESPGHAN).');
        }

        // C-01: Glucose concentration > 12.5% at peripheral access
        if (access === 'peripheral' && n.glucoseConc > 12.5) {
            warnings.push(`CRITICAL: Glukose-Konzentration ${n.glucoseConc}% > 12,5% bei peripherem Zugang!`);
        }

        // R-04: Lipid volume exceeds available PN capacity
        if (lipidExceedsPN) {
            warnings.push(`CRITICAL: Lipid-Volumen (${n.lipidVolDaily} ml) übersteigt parenterale Kapazität (${n.pnDailyGross} ml)!`);
        }

        // BLIND-2/5: GIR below minimum — hypoglycemia risk
        if (hasPNVolume && n.effectiveGIR > 0 && n.effectiveGIR < this.LIMITS.GIR.min) {
            warnings.push(`Hinweis: GIR ${n.effectiveGIR} mg/kg/min unter Minimum (${this.LIMITS.GIR.min}) – Hypoglykämie-Risiko!`);
        }

        // BLIND-6: TFI below target minimum
        if (tfi.gt(0) && tfi.lt(targets.tfi.min)) {
            warnings.push(`Hinweis: TFI ${tfi.toNumber()} ml/kg/d unter Zielbereich (${targets.tfi.min}–${targets.tfi.max}) – restriktive Flüssigkeit.`);
        }

        // BLIND-7: Enteral volume exceeds TFI
        if (enteralVolKg.gt(tfi) && tfi.gt(0)) {
            warnings.push(`Warnung: Enterale Zufuhr (${n.enteralVolKg} ml/kg/d) übersteigt TFI (${tfi.toNumber()} ml/kg/d) – Volumen prüfen.`);
        }

        // Hinweis (amber) — BUN-Trigger
        if (urea !== null && urea < 3.0 && n.enteralVolKg >= 100) {
            warnings.push('Hinweis: Harnstoff < 3 mmol/l bei Vollernährung – Eiweiß-Supplementierung prüfen.');
        }
        if (urea !== null && urea > 8) {
            warnings.push('Hinweis: Hoher Harnstoff (> 8 mmol/l) – Proteinzufuhr prüfen oder Energiebedarf erhöhen (Katabolie?).');
        }

        if (fm85Percent > 0 && n.enteralVolKg < 100 && selectedEnteralProduct === 'ebm') {
            warnings.push('Hinweis: FM85 Start i.d.R. erst ab 100 ml/kg/d enteralem Volumen empfohlen.');
        }

        // C-02: Protein deficiency below target at day 4+ for ELBW
        if (postnatalAge >= 4 && n.proteinTotalGKg < targets.protein.min) {
            warnings.push(`Hinweis: Protein ${n.proteinTotalGKg} g/kg/d unter Zielbereich (${targets.protein.min}–${targets.protein.max}) – Steigerung prüfen.`);
        }

        // C-03: Energy deficiency below target at day 4+
        if (postnatalAge >= 4 && n.kcalPerKg < targets.energy.min) {
            warnings.push(`Hinweis: Energie ${n.kcalPerKg} kcal/kg/d unter Zielbereich (${targets.energy.min}–${targets.energy.max}) – Zufuhr steigern.`);
        }

        // Energy excess above target
        if (postnatalAge >= 4 && n.kcalPerKg > targets.energy.max) {
            warnings.push(`Hinweis: Energie ${n.kcalPerKg} kcal/kg/d über Zielbereich (${targets.energy.min}–${targets.energy.max}) – Überernährung prüfen.`);
        }

        // Warnung (yellow)
        if (n.caPRatio > 0 && (n.caPRatio < 1.5 || n.caPRatio > 2.0)) {
            warnings.push(`Warnung: Ca:P Verhältnis (${n.caPRatio}:1) außerhalb Zielbereich (1.5–2.0:1) – Zufuhr von Phosphat (z.B. Glycophos) oder Calcium anpassen.`);
        }

        // CRYSTAL GUARD: Ca-P solubility check in PN solution
        // Reference: Simplified solubility curve for Level-1 NICU
        if (pnDaily.gt(0) && (effectiveCa_mmol.gt(0) || effectiveP_mmol.gt(0))) {
            const pnLitersForCrystal = pnDaily.div(1000);
            const caConcMmolL = effectiveCa_mmol.times(weightKg).div(pnLitersForCrystal).toDecimalPlaces(1);
            const pConcMmolL = effectiveP_mmol.times(weightKg).div(pnLitersForCrystal).toDecimalPlaces(1);
            const caPSumMmolL = caConcMmolL.plus(pConcMmolL).toDecimalPlaces(1);
            
            // Threshold depends on volume density (simplified logic)
            const threshold = 72; 
            if (caPSumMmolL.gt(threshold)) {
                warnings.push(`CRITICAL: Ausfällungsrisiko! Calcium/Phosphat-Konzentration (${caPSumMmolL.toNumber()} mmol/l) zu hoch für dieses Volumen (Limit ${threshold} mmol/l).`);
            } else if (caPSumMmolL.gt(55)) {
                warnings.push(`Warnung: Ca+P Konzentration ${caPSumMmolL.toNumber()} mmol/l nähert sich der Löslichkeitsgrenze.`);
            }
        }

        // NPC-Ratio Guard: Lipid should be 25–50% of non-protein calories (ESPGHAN)
        if (n.npcTotal > 0 && hasPNVolume) {
            if (n.npcLipidPercent < 25) {
                warnings.push(`Warnung: Lipid-Anteil an NPC nur ${n.npcLipidPercent}% (Ziel 25–50%) – metabolische Imbalance, Lipide steigern.`);
            } else if (n.npcLipidPercent > 50) {
                warnings.push(`Warnung: Lipid-Anteil an NPC ${n.npcLipidPercent}% > 50% – metabolische Imbalance, Glucose-Anteil erhöhen.`);
            }
        }

        // ENERGY EFFICIENCY: NPC/P Ratio (ESPGHAN 2018)
        // Zielbereich: 20–30 kcal pro 1g Protein
        if (n.npcPerProtein > 0 && n.proteinTotalGKg > 0.5) {
            if (n.npcPerProtein < 20) {
                warnings.push(`Warnung: Energie-Ungleichgewicht: Protein wird energetisch verwertet (NPC/P ${n.npcPerProtein} < 20 kcal/g).`);
            } else if (n.npcPerProtein > 40) {
                warnings.push(`Warnung: Verfettungsrisiko (NPC/P ${n.npcPerProtein} > 40 kcal/g).`);
            }
        }

        // P:AA Rule (ESPGHAN): ≥ 1 mmol P per 1 g Protein
        if (n.paaRatio > 0 && n.paaRatio < 1.0 && n.proteinTotalGKg > 0) {
            warnings.push(`Warnung: P:AA Ratio ${n.paaRatio} mmol/g – Risiko für PIFS/Elektrolytshift: Phosphat im Verhältnis zum Protein zu niedrig (Ziel ≥ 1.0).`);
        }

        // --- AUDIT: SID-light warning (metabolic acidosis proxy) ---
        if (n.sidLight !== undefined && (n.effectiveNa > 0 || n.effectiveK > 0)) {
            if (n.sidLight < 0) {
                warnings.push(`CRITICAL: SID-light ${n.sidLight} mmol/kg/d negativ — hyperchlorämische Azidose-Gefahr!`);
            } else if (n.naClRatio > 0 && n.naClRatio < 1.0) {
                warnings.push(`Warnung: Na:Cl Ratio ${n.naClRatio}:1 — Chlorid-Überhang, Azidose-Risiko.`);
            }
        }

        // --- AUDIT: IWL / Hypernatriämie-Risiko (Phase A) ---
        if (birthWeightG.lt(1000) && postnatalAge <= 7) {
            if (tfi.lt(100) && postnatalAge >= 2) {
                warnings.push('Hinweis: ELBW Tag 2–7 mit TFI < 100 ml/kg/d — IWL-bedingte Hypernatriämie-Gefahr. Na-Kontrolle empfohlen.');
            }
            if (n.effectiveNa > 5) {
                warnings.push(`Warnung: Na-Zufuhr ${n.effectiveNa} mmol/kg/d bei ELBW Tag 1–7 — Hypernatriämie-Risiko (inkl. Hidden Sodium).`);
            }
        }

        // --- AUDIT: Osteopenie-Prävention (Phase B/C) ---
        if (postnatalAge >= 14 && n.totalCaMgKg < 120 && n.enteralVolKg >= 100) {
            warnings.push(`Hinweis: Calcium gesamt ${n.totalCaMgKg} mg/kg/d unter ESPGHAN-Ziel (120–140) bei enteraler Ernährung — Osteopenie-Risiko.`);
        }
        if (postnatalAge >= 14 && n.totalPMgKg < 60 && n.enteralVolKg >= 100) {
            warnings.push(`Hinweis: Phosphat gesamt ${n.totalPMgKg} mg/kg/d unter ESPGHAN-Ziel (60–90) — Osteopenie-Risiko.`);
        }

        // --- AUDIT: Growth Stagnation + Fortifier Logic (Phase C) ---
        if (postnatalAge >= 28 && n.enteralVolKg >= 140 && fm85Percent < 4 && selectedEnteralProduct === 'ebm') {
            warnings.push('Hinweis: Monat 2+ bei >140 ml/kg/d enteral mit FM85 < 4% — Fortifizierung auf 4% empfohlen.');
        }
        if (postnatalAge >= 28 && weightVelocity !== 'Initial' && weightVelocity < 15 && n.enteralVolKg >= 100) {
            warnings.push(`Hinweis: Growth Velocity ${weightVelocity} g/kg/d < 15 bei Monat 2+ — Wachstumsstagnation. Fortifizierung prüfen.`);
        }
        if (postnatalAge >= 28 && urea !== null && urea < 3 && n.enteralVolKg >= 100 && fm85Percent >= 4 && n.proteinTotalGKg <= this.LIMITS.PROTEIN.max) {
            warnings.push('Hinweis: BUN < 3 mmol/l trotz FM85 4% in Phase C — Aptamil Eiweiß+ Supplementierung prüfen.');
        }

        // --- AUDIT: Fat-Finger Guard (3-SD Plausibilitäts-Check) ---
        const plausibilityFlags = [];
        if (tfi.gt(0) && (tfi.lt(30) || tfi.gt(200))) {
            plausibilityFlags.push(`TFI ${tfi.toNumber()} ml/kg/d`);
        }
        if (n.effectiveGIR > 0 && (n.effectiveGIR < 1 || n.effectiveGIR > 18)) {
            plausibilityFlags.push(`GIR ${n.effectiveGIR} mg/kg/min`);
        }
        if (n.proteinTotalGKg > 6) {
            plausibilityFlags.push(`Protein ${n.proteinTotalGKg} g/kg/d`);
        }
        if (n.lipidsPNKg > 5) {
            plausibilityFlags.push(`Lipide ${n.lipidsPNKg} g/kg/d`);
        }
        if (n.effectiveNa > 10) {
            plausibilityFlags.push(`Na ${n.effectiveNa} mmol/kg/d`);
        }
        if (currentWeightG.gt(0) && (currentWeightG.lt(200) || currentWeightG.gt(6000))) {
            plausibilityFlags.push(`Gewicht ${currentWeightG.toNumber()} g`);
        }
        if (n.kcalPerKg > 180) {
            plausibilityFlags.push(`Energie ${n.kcalPerKg} kcal/kg/d`);
        }

        // --- Step 13: Comparisons ---
        const checkStatus = (val, target) => {
            if (!target || target.min === undefined) return 'green';
            const mid = D(target.min).plus(target.max).div(2);
            const range = D(target.max).minus(target.min);
            const tolerance = range.gt(0) ? range.times('0.1') : mid.times('0.1');
            const v = D(val);
            if (v.gte(target.min) && v.lte(target.max)) return 'green';
            if (v.gte(D(target.min).minus(tolerance)) && v.lte(D(target.max).plus(tolerance))) return 'yellow';
            return 'red';
        };

        const comparisons = {
            tfi: { value: tfi.toNumber(), target: targets.tfi, status: checkStatus(tfi.toNumber(), targets.tfi) },
            protein: { value: n.proteinTotalGKg, target: targets.protein, status: checkStatus(n.proteinTotalGKg, targets.protein) },
            lipids: { value: n.lipidsPNKg, target: targets.lipidTarget, status: checkStatus(n.lipidsPNKg, targets.lipidTarget) },
            energy: { value: n.kcalPerKg, target: targets.energy, status: checkStatus(n.kcalPerKg, targets.energy) }
        };

        // --- Step 14: Safety Checks ---
        const safetyChecks = {
            gir: n.effectiveGIR <= this.LIMITS.GIR.max,
            osm: access === 'central' || n.osmolarity <= this.LIMITS.OSM_PERIPHERAL,
            glucoseConc: access === 'central' || n.glucoseConc <= 12.5,
            proteinLimit: n.proteinTotalGKg <= this.LIMITS.PROTEIN.max,
            lipidLimit: n.lipidsPNKg <= this.LIMITS.LIPIDS.max
        };

        const hasCriticalWarning = warnings.some(w => w.startsWith('CRITICAL'));
        const allSafetyPass = Object.values(safetyChecks).every(v => v === true);
        const isSafe = !hasCriticalWarning && allSafetyPass;

        // --- Step 15: Recommendations ---
        let lipidEscalation = null;
        if (n.lipidsPNKg < dayLipidTarget.min && hasPNVolume) {
            lipidEscalation = `Steigerung auf ${dayLipidTarget.min}–${dayLipidTarget.max} g/kg/d empfohlen (Tag ${lipidDayKey})`;
        }

        const recommendations = {
            tfi: `${targets.tfi.min}–${targets.tfi.max} ml/kg/d`,
            protein: `${targets.protein.min}–${targets.protein.max} g/kg/d`,
            lipids: `${targets.lipidTarget.min}–${targets.lipidTarget.max} g/kg/d`,
            energy: `${targets.energy.min}–${targets.energy.max} kcal/kg/d`,
            lipidEscalation,
            fortification: (n.enteralVolKg >= 100 && fm85Percent < 4 && selectedEnteralProduct === 'ebm')
                ? 'FM85 Titrationsplan: Steigerung auf 4% empfohlen'
                : null,
            supplement: (urea !== null && urea < 3 && fm85Percent >= 4 && n.proteinTotalGKg <= this.LIMITS.PROTEIN.max)
                ? '+0.5 g/kg/d Protein (Aptamil Eiweiß+)'
                : null
        };

        // --- Step 16: Klinisches Fazit (Top 3 Optimizations) ---
        const fazit = [];
        if (n.proteinTotalGKg > this.LIMITS.PROTEIN.max) {
            fazit.push(`Protein um ${this._round(n.proteinTotalGKg - this.LIMITS.PROTEIN.max, 1)} g/kg reduzieren (aktuell ${n.proteinTotalGKg}, Max ${this.LIMITS.PROTEIN.max} g/kg/d).`);
        }
        if (pnVolumeOverflow) {
            fazit.push('Gesamtvolumen übersteigt TFI – Sekundärinfusionen oder enterales Volumen reduzieren.');
        }
        if (fazit.length < 3 && n.caPRatio > 0 && (n.caPRatio < 1.5 || n.caPRatio > 2.0)) {
            const action = n.caPRatio < 1.5
                ? `Phosphat reduzieren oder Calcium um ~${this._round((1.7 * totalPMmolKg.toNumber() - totalCaMmolKg.toNumber()) * this.MOLAR_MASS.CALCIUM, 0)} mg/kg erhöhen`
                : `Phosphat (z.B. Glycophos) um ~${this._round((totalCaMmolKg.toNumber() / 1.7 - totalPMmolKg.toNumber()) * this.MOLAR_MASS.PHOSPHORUS, 0)} mg/kg erhöhen`;
            fazit.push(`Ca:P Ratio ${n.caPRatio}:1 optimieren – ${action}.`);
        }
        if (fazit.length < 3 && postnatalAge >= 4 && n.kcalPerKg < targets.energy.min) {
            fazit.push(`Energiezufuhr um ${this._round(targets.energy.min - n.kcalPerKg, 0)} kcal/kg/d steigern (Ziel ${targets.energy.min}–${targets.energy.max}).`);
        }
        if (fazit.length < 3 && postnatalAge >= 4 && n.proteinTotalGKg < targets.protein.min && n.proteinTotalGKg <= this.LIMITS.PROTEIN.max) {
            fazit.push(`Proteinzufuhr um ${this._round(targets.protein.min - n.proteinTotalGKg, 1)} g/kg/d steigern (Ziel ${targets.protein.min}–${targets.protein.max}).`);
        }
        if (fazit.length < 3 && n.npcPerProtein > 0 && n.npcPerProtein < 20) {
            fazit.push(`NPC/Protein-Ratio zu niedrig (${n.npcPerProtein}) – Glukose- oder Lipidzufuhr steigern für optimale Proteinverwertung.`);
        }
        if (fazit.length < 3 && n.paaRatio > 0 && n.paaRatio < 1.0 && n.proteinTotalGKg > 0) {
            fazit.push(`Phosphat um ~${this._round((1.0 - n.paaRatio) * n.proteinTotalGKg * this.MOLAR_MASS.PHOSPHORUS, 0)} mg/kg erhöhen (P:AA Ratio ${n.paaRatio} → Ziel ≥ 1.0).`);
        }
        if (fazit.length < 3 && n.enteralVolKg >= 100 && fm85Percent === 0 && selectedEnteralProduct === 'ebm') {
            fazit.push('FM85-Fortifizierung starten – enterales Volumen ≥ 100 ml/kg/d erreicht.');
        }
        if (fazit.length === 0) {
            fazit.push('Ernährungsplan im ESPGHAN-Zielbereich – keine Korrekturen erforderlich.');
        }

        // --- Return ---
        const finalResult = {
            targets,
            recommendations,
            results: {
                totalDailyFluid: n.totalDailyFluid,
                pnDailyGross: n.pnDailyGross,
                pnDaily: n.pnDaily,
                lipidVolDaily: n.lipidVolDaily,
                enteralDaily: n.enteralDaily,
                glucoseConc: n.glucoseConc,
                effectiveGIR: n.effectiveGIR,
                osmolarity: n.osmolarity,
                osmolarityBreakdown: n.osmolarityBreakdown,
                caPRatio: n.caPRatio,
                weightPercentile,
                proteinTotalGPerKg: n.proteinTotalGKg,
                effectiveAS_GKg: n.effectiveAS,
                lipidsPNKg: n.lipidsPNKg,
                kcalPerKg: n.kcalPerKg,
                kcalParenteralKg: n.kcalParenteralKg,
                kcalEnteralKg: n.kcalEnteralKg,
                calciumMgKg: n.effectiveCaMg,
                phosphateMgKg: n.effectivePMg,
                calciumMmolKg: n.effectiveCaMmol,
                phosphateMmolKg: n.effectivePMmol,
                effectiveNa: n.effectiveNa,
                effectiveK: n.effectiveK,
                effectiveCl: n.effectiveCl,
                secondaryDaily: n.secondaryDaily,
                singlePortion: n.singlePortion,
                rates: {
                    total: totalDailyFluid.div(24).toDecimalPlaces(1).toNumber(),
                    pn: pnDaily.div(24).toDecimalPlaces(1).toNumber(),
                    enteral: enteralDaily.div(24).toDecimalPlaces(1).toNumber()
                },
                calculationWeight: calculationWeightG.toNumber(),
                weightVelocity: weightVelocity,
                lengthZScore,
                headZScore,
                solutionMicro,
                sidLight: n.sidLight,
                naClRatio: n.naClRatio,
                hiddenSodiumMmolKg: n.hiddenSodiumMmolKg,
                enteralCaMgKg: n.enteralCaMgKg,
                enteralPMgKg: n.enteralPMgKg,
                totalCaMgKg: n.totalCaMgKg,
                totalPMgKg: n.totalPMgKg,
                enteralProteinGKg: n.enteralProteinGKg,
                enteralFatGKg: n.enteralFatGKg,
                enteralCarbsGKg: n.enteralCarbsGKg,
                enteralNaMmolKg: n.enteralNaMmolKg,
                totalGIR: n.totalGIRIncEnteral,
                totalLipidsGKg: n.totalLipidsGKg,
                paaRatio: n.paaRatio,
                totalPMmolKg: totalPMmolKg.toDecimalPlaces(2).toNumber(),
                npcTotal: n.npcTotal,
                npcLipidPercent: n.npcLipidPercent,
                npcGlucosePercent: n.npcGlucosePercent,
                kcalGlucose: n.kcalGlucose,
                kcalLipid: n.kcalLipid,
                microVolDaily: n.microVolDaily,
                npcTotalAll: n.npcTotalAll,
                npcPerProtein: n.npcPerProtein
            },
            comparisons,
            warnings,
            reminders,
            safetyChecks,
            isSafe,
            plausibilityFlags,
            fazit
        };

        // --- v2.1: Predictive Analytics (Modell B — nur Hinweise) ---
        // History wird optional über input.history übergeben (UI lebt im Frontend).
        finalResult.predictive = {
            energyGap: this._analyzeEnergyGap(input.history, postnatalAge),
            energyGapIndex: this.calculateEnergyGapIndex(input.history),
            sodiumTrend: this._analyzeSodiumTrend(input.history, postnatalAge, n.effectiveNa)
        };

        // --- v3.0: Smart Defaults (Tages-basierte Startwert-Vorschläge) ---
        finalResult.smartDefaults = this.getSmartDefaults(input);

        // --- v2.0: Chief Physician Review + Copy-for-Documentation ---
        // Assessment muss VOR generateDocumentationString berechnet werden,
        // weil letztere die Beurteilung an den EPR-String anhängt.
        finalResult.assessment = this.generateClinicalAssessment(finalResult, input);
        finalResult.documentation = this.generateDocumentationString(finalResult, input);

        return finalResult;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutritionCalculator;
} else {
    window.NutritionCalculator = NutritionCalculator;
}
