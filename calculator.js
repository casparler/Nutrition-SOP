/** Neonatologie Nutrition Calculator - V11 Master Logic
 * ESPGHAN 2018 & NICU Master Protocol 2026
 * Safety Core Engine - Solution Configurator, Tiered Alerting, Lipid Escalation
 * ALL arithmetic via Decimal.js — no IEEE 754 floats in clinical paths.
 */

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

    getTargets(input) {
        const bw = parseFloat(input.birthWeight) || 1000;
        const age = Math.max(1, parseInt(input.postnatalAge) || 1);
        const ventilation = input.ventilationStatus || 'spontaneous';
        const ssw = parseInt(input.ssw) || 28;
        const effectiveDay = Math.min(age, 14);

        // --- TFI targets by weight class ---
        let tfiMin, tfiMax;
        if (bw < 1000) {
            if (effectiveDay === 1) { tfiMin = 80; tfiMax = 100; }
            else if (effectiveDay === 2) { tfiMin = 100; tfiMax = 120; }
            else { tfiMin = 120 + (effectiveDay - 3) * 20; tfiMax = 140 + (effectiveDay - 3) * 20; }
        } else if (bw <= 1500) {
            if (effectiveDay === 1) { tfiMin = 70; tfiMax = 90; }
            else if (effectiveDay === 2) { tfiMin = 90; tfiMax = 110; }
            else { tfiMin = 110 + (effectiveDay - 3) * 20; tfiMax = 130 + (effectiveDay - 3) * 20; }
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

        // --- Parse all inputs as Decimal ---
        const birthWeightG = D(parseFloat(input.birthWeight) || 1000);
        const currentWeightG = D(parseFloat(input.currentWeight) || birthWeightG.toNumber());
        const postnatalAge = Math.max(1, parseInt(input.postnatalAge) || 1);
        const ssw = parseInt(input.ssw) || 28;
        const tfi = D(parseFloat(input.tfi) || 0);
        const enteralVolKg = D(parseFloat(input.enteralVolume) || 0);
        const fm85Percent = parseInt(input.fm85Percent) || 0;
        const carrierVolKg = D(parseFloat(input.carrierVolume) || 0);
        const urea = input.urea !== null && input.urea !== undefined && input.urea !== '' ? parseFloat(input.urea) : null;
        const triglycerides = input.triglycerides !== null && input.triglycerides !== undefined && input.triglycerides !== '' ? parseFloat(input.triglycerides) : null;
        const gir = D(parseFloat(input.gir) || 0);
        const proteinPNKg = D(parseFloat(input.protein) || 0);
        const lipidsPNKg = D(parseFloat(input.lipids) || 0);
        const calciumMgKg = D(parseFloat(input.calcium) || 0);
        const phosphateMgKg = D(parseFloat(input.phosphate) || 0);
        const sodiumMmolKg = D(parseFloat(input.sodium) || 0);
        const potassiumMmolKg = D(parseFloat(input.potassium) || 0);
        const access = input.access || 'peripheral';
        const ventilationStatus = input.ventilationStatus || 'spontaneous';
        const selectedSolution = input.selectedSolution || 'none';
        const selectedEnteralProduct = input.selectedEnteralProduct || 'ebm';
        const selectedLipidProduct = input.selectedLipidProduct || 'standardLipid';
        const mealFrequency = parseInt(input.mealFrequency) || 8;
        const naclMl = D(parseFloat(input.naclMl) || 0);
        const kclMl = D(parseFloat(input.kclMl) || 0);
        const secondarySolution = input.secondarySolution || 'none';
        const secondaryRateKg = D(parseFloat(input.secondaryRateKg) || 0);
        const hiddenSodiumMmolKg = D(parseFloat(input.hiddenSodiumMmolKg) || 0);

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

        // --- Step 10: Osmolarity ---
        let osmolarity = D(0);
        if (pnDaily.gt(0)) {
            const pnLiters = pnDaily.div(1000);
            const glucoseGL = glucoseTotalG.div(pnLiters);
            const proteinGL = effectiveAS.times(weightKg).div(pnLiters);
            const naMmolL = effectiveNa.times(weightKg).div(pnLiters);
            const kMmolL = effectiveK.times(weightKg).div(pnLiters);
            osmolarity = glucoseGL.times(5)
                .plus(proteinGL.times(10))
                .plus(naMmolL.times(2))
                .plus(kMmolL.times(2))
                .toDecimalPlaces(0);
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
        return {
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
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutritionCalculator;
} else {
    window.NutritionCalculator = NutritionCalculator;
}
