/**
 * NeoNutri Product Database - V11 Master Logic
 * All values from NICU Hausstandard Excel & Nahrungstabelle 08/17
 */

const NeoProducts = {

    parenteralSolutions: [
        {
            id: 'fgMix75',
            name: 'FG-Mix 7,5% (Transition)',
            targetVolume: 100,
            perKgAtTarget: {
                aminoAcids: 1.75,
                glucose: 5.25,
                sodium: 0.00,
                potassium: 0.00,
                calcium: 0.70,
                phosphate: 0.00
            },
            micronutrients: null
        },
        {
            id: 'basisFG',
            name: 'Basislösung FG (Frühgeborene)',
            targetVolume: 100,
            perKgAtTarget: {
                aminoAcids: 1.40,
                glucose: 2.80,
                sodium: 3.11,
                potassium: 2.10,
                calcium: 1.08,
                phosphate: 1.00
            },
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
            id: 'basis100',
            name: 'Basislösung 100 ml/kg',
            targetVolume: 100,
            perKgAtTarget: {
                aminoAcids: 2.45,
                glucose: 10.50,
                sodium: 3.11,
                potassium: 2.10,
                calcium: 1.08,
                phosphate: 1.00
            },
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
            id: 'basis120',
            name: 'Basislösung 120 ml/kg',
            targetVolume: 120,
            perKgAtTarget: {
                aminoAcids: 2.04,
                glucose: 8.75,
                sodium: 2.59,
                potassium: 1.75,
                calcium: 0.90,
                phosphate: 0.84
            },
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
            id: 'basis150',
            name: 'Basislösung 150 ml/kg',
            targetVolume: 150,
            perKgAtTarget: {
                aminoAcids: 1.63,
                glucose: 7.00,
                sodium: 2.07,
                potassium: 1.40,
                calcium: 0.72,
                phosphate: 0.67
            },
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
            id: 'basisPeripher',
            name: 'Basis peripher',
            targetVolume: 100,
            perKgAtTarget: {
                aminoAcids: 1.225,
                glucose: 5.25,
                sodium: 1.554,
                potassium: 1.05,
                calcium: 0.50,
                phosphate: 0.50
            },
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
        }
    ],

    supplements: {
        fm85: {
            name: 'FM85 (Nestlé)',
            description: '4% = 1g auf 25ml MM',
            fortifiedEBM: { kcal: 85, protein: 3.0, carbs: 8.6 }
        },
        aptamilProtein: {
            name: 'Aptamil Eiweiß+',
            per100gPowder: { kcal: 338, protein: 82.1, sodium_mg: 776, calcium_mg: 1226, phosphorus_mg: 524 }
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
            per100ml: { glucose_g: 0, sodium_mmol: 77, chloride_mmol: 77 }
        },
        {
            id: 'nacl09',
            name: 'NaCl 0,9%',
            per100ml: { glucose_g: 0, sodium_mmol: 154, chloride_mmol: 154 }
        }
    ]

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NeoProducts;
} else {
    window.NeoProducts = NeoProducts;
}
