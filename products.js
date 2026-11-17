/**
 * NeoNutri Product Database - V11 Master Logic
 * All values from NICU Hausstandard Excel & Nahrungstabelle 08/17
 * Hauslösungen: Stations-Verordnungstabelle 09/2023 (v3.6.23)
 */

const NeoProducts = {

    // v3.6.23: Zusammensetzung der Hauslösungen aus der Stations-Verordnungstabelle
    // („IntensivVerordnung KITS PZ September 2023“, Blatt „Eingabemaske“, Zellen V4:AD10 und W22:AK58),
    // übermittelt vom Neonatologen am 17.11.2026. Angaben je 100 ml fertiger Lösung:
    // Aminosäuren und Glukose in g, Elektrolyte in mmol.
    //
    // Elektrolyte der Basislösungen = Anteil des pädiatrischen Elektrolyt-Konzentrats
    // (je 100 ml Konzentrat: Na 11,1 | K 7,51 | Ca 3,863 | Mg 0,507 | Phosphat 3,58 | Cl 11,4 mmol),
    // siehe electrolyteConcentrate und concentrateMlPer100ml (Test AT2 rechnet nach).
    //
    // FEHLERKORREKTUR: Bis v3.6.22 standen hier die Werte, die die Tabelle bei einer Einstellung von
    // 70 ml/kg/d anzeigt (z. B. Basislösung 100: 2,45 g Aminosäuren statt 3,5 g je 100 ml). Alle Nährstoffe
    // aus Hauslösungen wurden dadurch 30 % zu niedrig gerechnet, bei Basislösung 120 und 150 zusätzlich
    // durch das Zielvolumen geteilt (42 % bzw. 53 % zu niedrig).
    //
    // perKgAtTarget (Zufuhr je kg bei targetVolume ml/kg/d) wird unten aus per100ml berechnet.
    electrolyteConcentrate: {
        name: 'Pädiatrisches Elektrolyt-Konzentrat',
        per100ml: { sodium: 11.1, potassium: 7.51, calcium: 3.863, magnesium: 0.507, phosphate: 3.58, chloride: 11.4 }
    },

    parenteralSolutions: [
        {
            // Glukose 75 g/l, Aminosäuren 25 g/l (12,5 ml Aminopäd 10 % je 50 ml), Calcium 0,497 mmol je 50 ml; ohne Natrium, Kalium, Phosphat
            id: 'fgMix75',
            name: 'FG-Mix 7,5% (Transition)',
            targetVolume: 100,
            concentrateMlPer100ml: 0,
            per100ml: { aminoAcids: 2.5, glucose: 7.5, sodium: 0, potassium: 0, calcium: 0.994, magnesium: 0, phosphate: 0, chloride: 0 },
            micronutrients: null
        },
        {
            // v3.6.25, Stations-Tabelle: Glukose 75 g/l, Natrium 40 mmol/l (als NaCl), Calcium 0,497 mmol je 50 ml; ohne Aminosäuren
            id: 'ngMix75',
            name: 'NG-Mix 7,5%',
            targetVolume: 100,
            concentrateMlPer100ml: 0,
            per100ml: { aminoAcids: 0, glucose: 7.5, sodium: 4.0, potassium: 0, calcium: 0.994, magnesium: 0, phosphate: 0, chloride: 4.0 },
            micronutrients: null
        },
        {
            // Aminosäuren 20 g/l, Glukose 40 g/l, 40 ml Elektrolyt-Konzentrat je 100 ml
            id: 'basisFG',
            name: 'Basislösung FG (Frühgeborene)',
            targetVolume: 100,
            concentrateMlPer100ml: 40,
            per100ml: { aminoAcids: 2.0, glucose: 4.0, sodium: 4.44, potassium: 3.004, calcium: 1.5452, magnesium: 0.2028, phosphate: 1.432, chloride: 4.56 },
            micronutrients: {
                soluvit: 1.0,
                peditrace: 0.68,
                zinc_umol: 3.83,
                copper_umol: 0.32,
                selenium_nmol: 30,
                manganese_nmol: 18,
                iodine_umol: 1.0
            }
        },
        {
            // Aminosäuren 35 g/l, Glukose 150 g/l, 40 ml Elektrolyt-Konzentrat je 100 ml
            id: 'basis100',
            name: 'Basislösung 100 ml/kg',
            targetVolume: 100,
            concentrateMlPer100ml: 40,
            per100ml: { aminoAcids: 3.5, glucose: 15.0, sodium: 4.44, potassium: 3.004, calcium: 1.5452, magnesium: 0.2028, phosphate: 1.432, chloride: 4.56 },
            micronutrients: {
                soluvit: 1.0,
                peditrace: 0.68,
                zinc_umol: 3.83,
                copper_umol: 0.32,
                selenium_nmol: 30,
                manganese_nmol: 18,
                iodine_umol: 1.0
            }
        },
        {
            // Aminosäuren 29,2 g/l, Glukose 125 g/l, 33,33 ml Elektrolyt-Konzentrat je 100 ml
            id: 'basis120',
            name: 'Basislösung 120 ml/kg',
            targetVolume: 120,
            concentrateMlPer100ml: 33.33,
            per100ml: { aminoAcids: 2.92, glucose: 12.5, sodium: 3.6996, potassium: 2.5031, calcium: 1.2875, magnesium: 0.169, phosphate: 1.1932, chloride: 3.7996 },
            micronutrients: {
                soluvit: 1.0,
                peditrace: 0.68,
                zinc_umol: 3.83,
                copper_umol: 0.32,
                selenium_nmol: 30,
                manganese_nmol: 18,
                iodine_umol: 1.0
            }
        },
        {
            // Aminosäuren 23,3 g/l, Glukose 100 g/l, 26,67 ml Elektrolyt-Konzentrat je 100 ml
            id: 'basis150',
            name: 'Basislösung 150 ml/kg',
            targetVolume: 150,
            concentrateMlPer100ml: 26.67,
            per100ml: { aminoAcids: 2.33, glucose: 10.0, sodium: 2.9604, potassium: 2.0029, calcium: 1.0303, magnesium: 0.1352, phosphate: 0.9548, chloride: 3.0404 },
            micronutrients: {
                soluvit: 1.0,
                peditrace: 0.68,
                zinc_umol: 3.83,
                copper_umol: 0.32,
                selenium_nmol: 30,
                manganese_nmol: 18,
                iodine_umol: 1.0
            }
        },
        {
            // Halbe Konzentration der Basislösung 100: Aminosäuren 17,5 g/l, Glukose 75 g/l, 20 ml Elektrolyt-Konzentrat je 100 ml
            id: 'basisPeripher',
            name: 'Basis peripher',
            targetVolume: 100,
            concentrateMlPer100ml: 20,
            per100ml: { aminoAcids: 1.75, glucose: 7.5, sodium: 2.22, potassium: 1.502, calcium: 0.7726, magnesium: 0.1014, phosphate: 0.716, chloride: 2.28 },
            micronutrients: {
                soluvit: 1.0,
                peditrace: 0.68,
                zinc_umol: 3.83,
                copper_umol: 0.32,
                selenium_nmol: 30,
                manganese_nmol: 18,
                iodine_umol: 1.0
            }
        }
    ],

    lipidProducts: [
        {
            id: 'smoflipid20',
            name: 'SMOFlipid 20%',
            fatPer100ml: 20,
            kcalPerGFat: 10
        },
        {
            id: 'standardLipid',
            name: 'Standard-Lipidemulsion 20%',
            fatPer100ml: 20,
            kcalPerGFat: 9
        }
    ],

    enteralProducts: [
        {
            id: 'ebm',
            name: 'Muttermilch (EBM)',
            per100ml: { kcal: 71, protein: 1.13, fat: 4.03, carbs: 7.0, sodium_mg: 7, phosphorus_mg: 32 }
        },
        {
            id: 'bebaFG1',
            name: 'Beba FG Stufe 1',
            per100ml: { kcal: 80, protein: 2.90, fat: 4.00, carbs: 8.1, sodium_mg: 51, phosphorus_mg: 116 }
        },
        {
            id: 'bebaFG2',
            name: 'Beba FG Stufe 2',
            per100ml: { kcal: 73, protein: 2.05, fat: 3.80, carbs: 7.67, sodium_mg: 34, phosphorus_mg: 77 }
        },
        {
            id: 'aptamilPre',
            name: 'Aptamil Pre',
            per100ml: { kcal: 66, protein: 1.30, fat: 3.30, carbs: 7.5, sodium_mg: 16, phosphorus_mg: 49 }
        },
        {
            id: 'hippPre',
            name: 'Hipp Pre Bio',
            per100ml: { kcal: 66, protein: 1.25, fat: 3.50, carbs: 7.3, sodium_mg: 20, phosphorus_mg: 50 }
        },
        // v3.6.15: aus dem Stations-Excel „FG-Plan Zeitleiste“ (2022), Blatt Tabelle2. Nicht an der Packung geprüft;
        // Natrium, Calcium und Phosphor sind dort nicht hinterlegt und zählen als 0.
        {
            id: 'neocate',
            name: 'Neocate (Stations-Excel)',
            per100ml: { kcal: 67, protein: 1.8, fat: 3.4, carbs: 7.2 }
        }
    ],

    supplements: {
        fm85: {
            name: 'FM85 (Nestlé)',
            description: '4% = 1g auf 25ml MM',
            // Packungsangabe je 100 g Pulver (übermittelt vom Neonatologen, 20.10.2026).
            // Muss mit NutritionCalculator.FM85_PER_PERCENT übereinstimmen (Test AB3).
            per100gPowder: { kcal: 435, protein: 35.5, fat: 18.1, carbs: 32.4, sodium_mg: 918, calcium_mg: 1890, phosphorus_mg: 1095 }
        },
        aptamilProtein: {
            id: 'aptamilProtein',
            name: 'Aptamil Eiweiß+',
            unit: 'g Pulver/kg/d',
            description: 'Enterale Eiweiß-Supplementierung bei niedrigem BUN trotz Fortifizierung',
            per100gPowder: { kcal: 338, protein: 82.1, fat: 0, carbs: 0, sodium_mg: 776, calcium_mg: 1226, phosphorus_mg: 524 }
        },
        // Liquigen (Nutricia) — MCT-Emulsion 50 %, 4,5 kcal/ml.
        // Quelle: Nutricia Produktdatenblatt (100 ml = 450 kcal, 50 g Fett, davon
        // 96,4 % MCT; Protein 0 g, KH 0 g, Na 5 mg).
        // Hinweis: Wird der Nahrung zugemischt → KEIN zusätzliches TFI-Volumen.
        liquigen: {
            id: 'liquigen',
            name: 'Liquigen (MCT-Emulsion 50 %)',
            unit: 'ml/kg/d',
            description: 'Energie-/Fettanreicherung; Volumen ist im enteralen Volumen enthalten',
            per100ml: { kcal: 450, protein: 0, fat: 50, carbs: 0, sodium_mg: 5, calcium_mg: 0, phosphorus_mg: 0 }
        }
    },

    electrolyteConcentrates: [
        {
            id: 'nacl585',
            name: 'NaCl 5,85%',
            mmolPerMl: { sodium: 1, chloride: 1 }
        },
        {
            id: 'kcl746',
            name: 'KCl 7,46%',
            mmolPerMl: { potassium: 1, chloride: 1 }
        }
    ],

    micronutrientProducts: [
        {
            id: 'soluvit',
            name: 'Soluvit N (wasserlösliche Vitamine)',
            mlPerKgPerDay: 1.0,
            contents: 'Thiamin, Riboflavin, Niacin, Pyridoxin, Pantothensäure, Biotin, Folsäure, Cyanocobalamin, Ascorbinsäure'
        },
        {
            id: 'vitalipid',
            name: 'Vitalipid N Infant (fettlösliche Vitamine)',
            mlPerKgPerDay: 4.0,
            contents: 'Vitamin A 230 µg, Vitamin D₂ 10 µg (400 IE), Vitamin E 0.64 mg, Vitamin K₁ 20 µg'
        },
        {
            id: 'peditrace',
            name: 'Peditrace (Spurenelemente)',
            mlPerKgPerDay: 1.0,
            contents: 'Zn 3.83 µmol, Cu 0.32 µmol, Mn 18 nmol, Se 30 nmol, F 1.5 µmol, I 1.0 µmol'
        }
    ],

    secondarySolutions: [
        {
            id: 'glucose5',
            name: 'Glucose 5%',
            per100ml: { glucose_g: 5.0, sodium_mmol: 0, chloride_mmol: 0 }
        },
        {
            id: 'glucose10',
            name: 'Glucose 10%',
            per100ml: { glucose_g: 10.0, sodium_mmol: 0, chloride_mmol: 0 }
        },
        {
            id: 'glucose20',
            name: 'Glucose 20%',
            per100ml: { glucose_g: 20.0, sodium_mmol: 0, chloride_mmol: 0 }
        },
        {
            id: 'nacl045',
            name: 'NaCl 0,45%',
            // 4,5 g NaCl/l = 77 mmol/l = 7,7 mmol je 100 ml (vorher fälschlich 77 je 100 ml)
            per100ml: { glucose_g: 0, sodium_mmol: 7.7, chloride_mmol: 7.7 }
        },
        {
            id: 'nacl09',
            name: 'NaCl 0,9%',
            // 9 g NaCl/l = 154 mmol/l = 15,4 mmol je 100 ml (vorher fälschlich 154 je 100 ml)
            per100ml: { glucose_g: 0, sodium_mmol: 15.4, chloride_mmol: 15.4 }
        },
        {
            // Sterofundin ISO (B. Braun), balancierte Vollelektrolytlösung. Werte je 1000 ml:
            // Na 145, K 4, Ca 2,5, Mg 1, Cl 127, Acetat 24, Malat 5 mmol; theoretische
            // Osmolarität 309 mOsm/l. Hier je 100 ml. ACHTUNG: nicht an der Packung geprüft,
            // bitte mit Etikett/Fachinformation abgleichen (REGELWERK 17.11).
            id: 'sterofundinIso',
            name: 'Sterofundin ISO',
            per100ml: { glucose_g: 0, sodium_mmol: 14.5, chloride_mmol: 12.7, potassium_mmol: 0.4, calcium_mmol: 0.25, magnesium_mmol: 0.1, acetate_mmol: 2.4, malate_mmol: 0.5 }
        },
        // v3.6.25: weitere Lösungen aus der Stations-Verordnungstabelle 09/2023 (Blatt „Eingabemaske“, V15–V19, Werte je Liter ÷ 10).
        {
            id: 'sterofundinVG5',
            name: 'Sterofundin VG-5 (Glucose 5%)',
            per100ml: { glucose_g: 5.0, sodium_mmol: 14.0, chloride_mmol: 14.1, potassium_mmol: 0.4, calcium_mmol: 0.25, magnesium_mmol: 0.1 }
        },
        {
            id: 'halbElytG5',
            name: 'Halbelektrolyt-Lösung mit Glucose 5%',
            per100ml: { glucose_g: 5.0, sodium_mmol: 7.7, chloride_mmol: 7.7 }
        },
        {
            id: 'nacl045Gluc25',
            name: 'NaCl 0,45% / Glucose 2,5% (1:1 aus NaCl 0,9% und G5%)',
            per100ml: { glucose_g: 2.5, sodium_mmol: 7.7, chloride_mmol: 7.7 }
        },
        {
            id: 'elyt153',
            name: 'Elektrolyt-Infusionslösung 153 (acetathaltig)',
            per100ml: { glucose_g: 0, sodium_mmol: 14.0, chloride_mmol: 10.3, potassium_mmol: 0.5, calcium_mmol: 0.25, magnesium_mmol: 0.15 }
        }
    ]

};

// v3.6.23: Zufuhr je kg beim Zielvolumen aus der Zusammensetzung je 100 ml ableiten
// (eine Quelle der Wahrheit; vorher standen hier von Hand übertragene, falsche Werte).
NeoProducts.parenteralSolutions.forEach(function (s) {
    var f = s.targetVolume / 100;
    var r = function (x) { return Math.round(x * f * 10000) / 10000; };
    s.perKgAtTarget = {
        aminoAcids: r(s.per100ml.aminoAcids), glucose: r(s.per100ml.glucose),
        sodium: r(s.per100ml.sodium), potassium: r(s.per100ml.potassium),
        calcium: r(s.per100ml.calcium), magnesium: r(s.per100ml.magnesium),
        phosphate: r(s.per100ml.phosphate), chloride: r(s.per100ml.chloride)
    };
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NeoProducts;
} else {
    window.NeoProducts = NeoProducts;
}
