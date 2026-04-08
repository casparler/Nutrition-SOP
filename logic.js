/**
 * Neonatologische SOP Logik-Engine (Stand 05/2021)
 *
 * Ergänzt mit Hinweisen für Kombinationslogik in ui_update():
 * 
 * if (state.eos || state.vanco) {
 *   // Ampicillin bleibt immer die Basis (außer bei explizitem Absetzen)
 *   const ampi = SOP_LOGIC.getAmpiCefo(pma, pna, weight, state.meningitis);
 *   html += renderMedCard('Ampicillin', ampi.dose, ampi.interval, 'mg');
 * 
 *   if (state.vanco) {
 *     // SWAP: Vancomycin statt Tobramycin bei KNS/gezielter Therapie
 *     const vanco = SOP_LOGIC.getVancomycin(pma, pna, weight, state.meningitis);
 *     html += renderMedCard('Vancomycin', vanco.dose, vanco.interval, 'mg',
 *         `Ziel-Talspiegel: ${state.meningitis ? '15-20' : '5-10'} mg/l`); // [cite: 1]
 *   } else {
 *     // Standard EOS: Tobramycin anzeigen
 *     const tobra = SOP_LOGIC.getTobramycin(pma, pna, weight);
 *     html += renderMedCard('Tobramycin', tobra.dose, tobra.interval, 'mg',
 *         'Ziel-Talspiegel: < 2 mg/l (vor 3. Gabe)'); // [cite: 1]
 *   }
 * }
 */

const SOP_LOGIC = {
    // Hilfsfunktion zur Berechnung des dezimalen PMA
    calculatePMA: function(ssw_w, ssw_d, pna_d) {
        const totalDays = (ssw_w * 7) + ssw_d + pna_d;
        return {
            weeks: Math.floor(totalDays / 7),
            days: totalDays % 7,
            decimal: totalDays / 7
        };
    },

    // Dosierung Ampicillin & Cefotaxim (50 mg/kg ED)
    getAmpiCefo: function(pma, pna, weight, isMeningitis) {
        // Bei Meningitis: 200 mg/kg/Tag, verteilt auf 3 ED => 66.6 mg/kg pro ED, Intervall 8h
        if (isMeningitis) {
            return {
                dose: Math.round(weight * 66.6),
                interval: 8,
                unit: "mg"
            };
        }

        const dosePerKg = 50;
        let interval = 12;

        if (pma.decimal <= 28.85) { // <= 28+6 SSW
            interval = (pna <= 28) ? 12 : 8;
        } else if (pma.decimal <= 35.85) { // 29+0 - 35+6 SSW
            interval = (pna <= 14) ? 12 : 8;
        } else if (pma.decimal <= 43.85) { // 36+0 - 43+6 SSW
            interval = (pna <= 7) ? 12 : 8;
        } else { // >= 44+0 SSW
            interval = 6;
        }

        return {
            dose: Math.round(weight * dosePerKg),
            interval: interval,
            unit: "mg"
        };
    },

    // Dosierung Tobramycin (4-5 mg/kg ED)
    getTobramycin: function(pma, pna, weight) {
        let dosePerKg = 4;
        let interval = 24;

        if (pma.decimal <= 28.85) { // <= 28+6 SSW
            dosePerKg = (pna <= 7) ? 5 : 4;
            interval = (pna <= 7) ? 48 : (pna <= 28 ? 36 : 24);
        } else if (pma.decimal <= 33.85) { // 29+0 - 33+6 SSW
            dosePerKg = (pna <= 7) ? 4.5 : 4;
            interval = (pna <= 7) ? 36 : 24;
        } else { // >= 34+0 SSW
            dosePerKg = 4;
            interval = 24;
        }

        return {
            dose: (weight * dosePerKg).toFixed(1),
            interval: interval,
            unit: "mg"
        };
    },

    // Dosierung Vancomycin (10-15 mg/kg ED)
    getVancomycin: function(pma, pna, weight, isMeningitis) {
        const dosePerKg = isMeningitis ? 15 : 10;
        let interval = 12;

        if (pma.decimal <= 28.85) {
            interval = (pna <= 14) ? 18 : 12;
        } else if (pma.decimal <= 35.85) {
            interval = (pna <= 14) ? 12 : 8;
        } else if (pma.decimal <= 43.85) {
            interval = (pna <= 7) ? 12 : 8;
        } else {
            interval = 6;
        }

        return {
            dose: Math.round(weight * dosePerKg),
            interval: interval,
            unit: "mg"
        };
    },

    // Infobox & Prophylaxen
    getInfobox: function(ssw_dec, weight, pna, hasNvkEsk = false) {
        hasNvkEsk = !!hasNvkEsk;
        let desinfektion = "Kodan (Spray)";
        if (ssw_dec < 26.0) desinfektion = "Betaisadona 1:10 (9ml Aqua + 1ml Betaisadona). Kontrolle TSH/fT3/fT4 nach 7 Tagen!";
        else if (ssw_dec < 32.0) desinfektion = "Octenidin 0,1%";

        const fluconazol = hasNvkEsk
            ? ((ssw_dec < 28.0 || weight < 1.0) ? "Fluconazol-Prophylaxe indiziert (Kriterien erfüllt)" : "Fluconazol-Prophylaxe nicht standardmäßig indiziert (Kriterien nicht erfüllt)")
            : "Fluconazol-Prophylaxe nicht indiziert (NVK/ESK nicht einliegend)";
        const ampho = (ssw_dec < 28.0) ? "Amphomoronal po 2x0,3ml bis 48h nach Ende Antibiotika" : "Nicht indiziert";
        return { desinfektion, fluconazol, ampho };
    }
};