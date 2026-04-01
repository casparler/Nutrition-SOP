/**
 * Neonatologie Nutrition Calculator - Core Logic (ESPGHAN 2018 Guidelines)
 * Senior Software Engineer & Medical Safety Expert Edition
 * 
 * V4: Advanced Nutrition Logic & UI Refinement
 */

class NutritionCalculator {
    constructor() {
        // Constants from ESPGHAN 2018
        this.LIMITS = {
            TFI: { min: 40, max: 200, unit: 'ml/kg/d' },
            GIR: { min: 3, max: 12, unit: 'mg/kg/min' },
            PROTEIN: { max: 4.5, unit: 'g/kg/d' },
            LIPIDS: { max: 4.0, unit: 'g/kg/d' }
        };

        this.CALORIES = {
            GLUCOSE: 4.0, // kcal/g
            LIPIDS: 9.0,   // kcal/g
            PROTEIN: 4.0   // kcal/g
        };

        // FM85 provides +0.25g Protein per 1% fortification
        this.FM85_PROTEIN_FACTOR = 0.25;
        // Standard energy content for breast milk/pre-formula (approx 67-70 kcal/100ml)
        // FM85 adds approx 0.8-1 kcal per 1% per 100ml (Standard 4% adds ~3.5-4 kcal/100ml)
        this.ENTERAL_BASE_KCAL_PER_ML = 0.67; 
        this.FM85_KCAL_FACTOR = 0.01; // kcal per ml per 1%
    }

    _round(num, decimals = 2) {
        return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    /**
     * Get Recommended Targets based on V2 Matrix
     */
    getTargets(input) {
        const weight = parseFloat(input.birthWeight) || 1000;
        const requestedAge = parseInt(input.postnatalAge) || 1;
        const postnatalAge = Math.min(Math.max(requestedAge, 1), 14);
        const ventilation = input.ventilationStatus; // 'spontaneous', 'cpap', 'invasive'
        const ssw = parseInt(input.ssw) || 28;
        const enteralVol = parseFloat(input.enteralVolume) || 0;

        const targets = {
            tfi: { min: 0, max: 0, cap: 180 },
            protein: { min: 0, max: 0 },
            lipids: { min: 1.0, max: 4.0 },
            energyParenteral: { min: 90, max: 120 },
            energyEnteral: { min: 110, max: 135 },
            effectiveDay: postnatalAge
        };

        // 1. TFI Targets (Fluid Management)
        if (weight < 1000) {
            if (postnatalAge === 1) targets.tfi = { min: 80, max: 100 };
            else if (postnatalAge === 2) targets.tfi = { min: 100, max: 120 };
            else targets.tfi = { min: 120 + (postnatalAge-3)*20, max: 140 + (postnatalAge-3)*20 };
        } else if (weight > 1500) {
            if (postnatalAge === 1) targets.tfi = { min: 60, max: 80 };
            else if (postnatalAge === 2) targets.tfi = { min: 80, max: 100 };
            else targets.tfi = { min: 100 + (postnatalAge-3)*20, max: 120 + (postnatalAge-3)*20 };
        } else {
            // Intermediate (1000-1500g)
            if (postnatalAge === 1) targets.tfi = { min: 70, max: 90 };
            else if (postnatalAge === 2) targets.tfi = { min: 90, max: 110 };
            else targets.tfi = { min: 110 + (postnatalAge-3)*20, max: 130 + (postnatalAge-3)*20 };
        }

        // TFI cap logic (mode dependent)
        if (ventilation === 'invasive') {
            targets.tfi.cap = 140;
        } else {
            targets.tfi.cap = 180;
        }

        // Recommendation should never exceed cap. (Plateau-Handling)
        targets.tfi.min = Math.min(targets.tfi.min, targets.tfi.cap);
        targets.tfi.max = Math.min(targets.tfi.max, targets.tfi.cap);

        // 2. Protein Targets
        if (weight < 1000) {
            targets.protein = { min: 3.5, max: 4.0 };
        } else if (weight <= 1500) {
            targets.protein = { min: 3.0, max: 3.5 };
        } else if (ssw >= 37) {
            targets.protein = { min: 2.5, max: 3.0 };
        } else {
            targets.protein = { min: 3.0, max: 3.5 };
        }

        // 3. Energy Targets
        targets.energyTarget = enteralVol >= 100 ? targets.energyEnteral : targets.energyParenteral;

        return targets;
    }

    calculate(input) {
        const weightKg = parseFloat(input.currentWeight) / 1000;
        const targets = this.getTargets(input);
        
        const tfi = parseFloat(input.tfi);
        const enteralVolKg = parseFloat(input.enteralVolume) || 0;
        const fm85Percent = parseFloat(input.fm85Percent) || 0;
        const carrierVolKg = parseFloat(input.carrierVolume) || 0;
        const gir = parseFloat(input.gir);
        const proteinPNKg = parseFloat(input.protein) || 0;
        const lipidsPNKg = parseFloat(input.lipids) || 0;

        // Volumes
        const totalDailyFluid = weightKg * tfi;
        const enteralDaily = weightKg * enteralVolKg;
        const carrierDaily = weightKg * carrierVolKg;
        const pnDaily = Math.max(0, totalDailyFluid - enteralDaily - carrierDaily);
        
        // Parenteral Nutrition Details
        const glucoseGPerKg = (gir * 1440) / 1000;
        const glucoseTotalG = glucoseGPerKg * weightKg;
        let glucoseConc = pnDaily > 0 ? (glucoseTotalG / pnDaily) * 100 : 0;

        // Enteral Nutrition Details (FM85)
        // Protein enteral: Base ~1.2g/100ml + FM85 Factor
        const proteinEnteralGKg = enteralVolKg * (0.012 + (fm85Percent * this.FM85_PROTEIN_FACTOR / 100));
        
        // Total Nährstoffe
        const proteinTotalGKg = proteinPNKg + proteinEnteralGKg;
        const proteinTotalG = proteinTotalGKg * weightKg;
        const lipidsTotalG = lipidsPNKg * weightKg;

        // Calories Calculation
        const glucoseKcal = glucoseTotalG * this.CALORIES.GLUCOSE;
        const lipidsKcal = lipidsTotalG * this.CALORIES.LIPIDS;
        const proteinPNKcal = (proteinPNKg * weightKg) * this.CALORIES.PROTEIN;
        
        // Enteral Calories: Base (approx 0.67 kcal/ml) + FM85 Energy (approx 0.01 kcal/ml per 1%)
        const enteralKcal = enteralDaily * (this.ENTERAL_BASE_KCAL_PER_ML + (fm85Percent * this.FM85_KCAL_FACTOR));
        
        const totalKcal = glucoseKcal + lipidsKcal + proteinPNKcal + enteralKcal;
        const kcalPerKg = totalKcal / weightKg;

        const warnings = [];
        const comparisons = {
            tfi: { status: 'green' },
            protein: { status: 'green' },
            lipids: { status: 'green' },
            energy: { status: 'green' }
        };

        // Safety logic for invasive ventilation cap
        if (input.ventilationStatus === 'invasive' && tfi > 140) {
            warnings.push('Restriktives Ziel (140ml) überschritten');
        }
        
        const checkStatus = (val, target) => {
            if (val < target.min * 0.9 || val > target.max * 1.1) return 'red';
            if (val < target.min || val > target.max) return 'yellow';
            return 'green';
        };

        comparisons.tfi.status = checkStatus(tfi, targets.tfi);
        comparisons.protein.status = checkStatus(proteinTotalGKg, targets.protein);
        comparisons.lipids.status = checkStatus(lipidsPNKg, targets.lipids);
        comparisons.energy.status = checkStatus(kcalPerKg, targets.energyTarget);

        // General ESPGHAN Safety
        if (gir > this.LIMITS.GIR.max) warnings.push(`CRITICAL: GIR exceeds ${this.LIMITS.GIR.max} mg/kg/min`);
        if (proteinTotalGKg > this.LIMITS.PROTEIN.max) warnings.push(`CRITICAL: Protein exceeds ${this.LIMITS.PROTEIN.max} g/kg/d`);
        if (lipidsPNKg > this.LIMITS.LIPIDS.max) warnings.push(`CRITICAL: Lipids exceed ${this.LIMITS.LIPIDS.max} g/kg/d`);

        return {
            targets,
            recommendations: {
                tfi: `Empfehlung für Tag ${targets.effectiveDay}: ${targets.tfi.min}-${targets.tfi.max} ml/kg/d`,
                protein: `Empfehlung (Protein): ${targets.protein.min}-${targets.protein.max} g/kg/d`,
                lipids: `Empfehlung (Lipide): ${targets.lipids.min}-${targets.lipids.max} g/kg/d`,
                energy: enteralVolKg >= 100
                    ? `Energieziel enteral: ${targets.energyEnteral.min}-${targets.energyEnteral.max} kcal/kg/d`
                    : `Energieziel parenteral: ${targets.energyParenteral.min}-${targets.energyParenteral.max} kcal/kg/d`,
                fortification: enteralVolKg >= 100 && fm85Percent == 0
                    ? 'Empfehlung: Start Fortifizierung (z.B. FM85 4%) zur Erreichung der Protein-Ziele'
                    : ''
            },
            results: {
                totalDailyFluid: this._round(totalDailyFluid),
                pnDaily: this._round(pnDaily),
                enteralDaily: this._round(enteralDaily),
                glucoseGPerKg: this._round(glucoseGPerKg),
                glucoseTotalG: this._round(glucoseTotalG),
                glucoseConc: this._round(glucoseConc),
                proteinTotalGPerKg: this._round(proteinTotalGKg),
                proteinTotalG: this._round(proteinTotalG),
                lipidsTotalG: this._round(lipidsTotalG),
                kcalPerKg: this._round(kcalPerKg),
                rates: {
                    total: this._round(totalDailyFluid / 24),
                    pn: this._round(pnDaily / 24),
                    enteral: this._round(enteralDaily / 24)
                }
            },
            comparisons,
            warnings,
            isSafe: warnings.filter(w => w.startsWith('CRITICAL')).length === 0
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutritionCalculator;
} else {
    window.NutritionCalculator = NutritionCalculator;
}
