/**
 * Fenton 2013 Growth Charts — LMS Parameters & Z-Score Engine
 * Source: Fenton TR, Kim JH. BMC Pediatrics 2013, 13:59
 * LMS parameters reconstructed from published percentile tables.
 * Covers GA 22–50 weeks, sex-specific, for Weight (g), Length (cm), Head (cm).
 */

const FENTON_2013 = {
    male: {
        weight: {
            22: { L: 1, M: 496, S: 0.17 },
            23: { L: 1, M: 555, S: 0.17 },
            24: { L: 1, M: 630, S: 0.166 },
            25: { L: 1, M: 720, S: 0.162 },
            26: { L: 1, M: 830, S: 0.158 },
            27: { L: 1, M: 955, S: 0.154 },
            28: { L: 1, M: 1100, S: 0.15 },
            29: { L: 1, M: 1260, S: 0.146 },
            30: { L: 1, M: 1440, S: 0.142 },
            31: { L: 1, M: 1640, S: 0.138 },
            32: { L: 1, M: 1850, S: 0.134 },
            33: { L: 1, M: 2080, S: 0.13 },
            34: { L: 1, M: 2325, S: 0.126 },
            35: { L: 1, M: 2575, S: 0.122 },
            36: { L: 1, M: 2835, S: 0.118 },
            37: { L: 1, M: 3075, S: 0.115 },
            38: { L: 1, M: 3290, S: 0.112 },
            39: { L: 1, M: 3465, S: 0.11 },
            40: { L: 1, M: 3600, S: 0.108 },
            41: { L: 1, M: 3720, S: 0.107 },
            42: { L: 1, M: 3820, S: 0.106 },
            43: { L: 1, M: 3910, S: 0.106 },
            44: { L: 1, M: 4000, S: 0.105 },
            45: { L: 1, M: 4100, S: 0.105 },
            46: { L: 1, M: 4210, S: 0.105 },
            47: { L: 1, M: 4330, S: 0.105 },
            48: { L: 1, M: 4460, S: 0.105 },
            49: { L: 1, M: 4600, S: 0.105 },
            50: { L: 1, M: 4750, S: 0.105 }
        },
        length: {
            22: { L: 1, M: 27.8, S: 0.052 },
            23: { L: 1, M: 29.0, S: 0.051 },
            24: { L: 1, M: 30.5, S: 0.05 },
            25: { L: 1, M: 32.0, S: 0.049 },
            26: { L: 1, M: 33.5, S: 0.048 },
            27: { L: 1, M: 35.0, S: 0.047 },
            28: { L: 1, M: 36.5, S: 0.046 },
            29: { L: 1, M: 38.0, S: 0.045 },
            30: { L: 1, M: 39.5, S: 0.044 },
            31: { L: 1, M: 41.0, S: 0.043 },
            32: { L: 1, M: 42.5, S: 0.042 },
            33: { L: 1, M: 44.0, S: 0.041 },
            34: { L: 1, M: 45.3, S: 0.04 },
            35: { L: 1, M: 46.5, S: 0.039 },
            36: { L: 1, M: 47.5, S: 0.038 },
            37: { L: 1, M: 48.5, S: 0.037 },
            38: { L: 1, M: 49.5, S: 0.037 },
            39: { L: 1, M: 50.3, S: 0.036 },
            40: { L: 1, M: 51.0, S: 0.036 },
            41: { L: 1, M: 51.8, S: 0.036 },
            42: { L: 1, M: 52.5, S: 0.036 },
            43: { L: 1, M: 53.2, S: 0.036 },
            44: { L: 1, M: 53.9, S: 0.036 },
            45: { L: 1, M: 54.6, S: 0.036 },
            46: { L: 1, M: 55.3, S: 0.036 },
            47: { L: 1, M: 56.0, S: 0.036 },
            48: { L: 1, M: 56.7, S: 0.036 },
            49: { L: 1, M: 57.4, S: 0.036 },
            50: { L: 1, M: 58.1, S: 0.036 }
        },
        head: {
            22: { L: 1, M: 20.0, S: 0.045 },
            23: { L: 1, M: 21.0, S: 0.044 },
            24: { L: 1, M: 22.0, S: 0.043 },
            25: { L: 1, M: 23.0, S: 0.042 },
            26: { L: 1, M: 24.0, S: 0.041 },
            27: { L: 1, M: 25.0, S: 0.04 },
            28: { L: 1, M: 26.0, S: 0.039 },
            29: { L: 1, M: 27.1, S: 0.038 },
            30: { L: 1, M: 28.0, S: 0.037 },
            31: { L: 1, M: 29.0, S: 0.036 },
            32: { L: 1, M: 30.0, S: 0.035 },
            33: { L: 1, M: 31.0, S: 0.035 },
            34: { L: 1, M: 31.9, S: 0.034 },
            35: { L: 1, M: 32.7, S: 0.034 },
            36: { L: 1, M: 33.3, S: 0.033 },
            37: { L: 1, M: 34.0, S: 0.033 },
            38: { L: 1, M: 34.6, S: 0.032 },
            39: { L: 1, M: 35.0, S: 0.032 },
            40: { L: 1, M: 35.4, S: 0.032 },
            41: { L: 1, M: 35.8, S: 0.032 },
            42: { L: 1, M: 36.2, S: 0.032 },
            43: { L: 1, M: 36.5, S: 0.032 },
            44: { L: 1, M: 36.9, S: 0.032 },
            45: { L: 1, M: 37.2, S: 0.032 },
            46: { L: 1, M: 37.5, S: 0.032 },
            47: { L: 1, M: 37.8, S: 0.032 },
            48: { L: 1, M: 38.1, S: 0.032 },
            49: { L: 1, M: 38.4, S: 0.032 },
            50: { L: 1, M: 38.7, S: 0.032 }
        }
    },
    female: {
        weight: {
            22: { L: 1, M: 475, S: 0.17 },
            23: { L: 1, M: 530, S: 0.17 },
            24: { L: 1, M: 600, S: 0.166 },
            25: { L: 1, M: 690, S: 0.162 },
            26: { L: 1, M: 790, S: 0.158 },
            27: { L: 1, M: 910, S: 0.154 },
            28: { L: 1, M: 1045, S: 0.15 },
            29: { L: 1, M: 1195, S: 0.146 },
            30: { L: 1, M: 1365, S: 0.142 },
            31: { L: 1, M: 1550, S: 0.138 },
            32: { L: 1, M: 1755, S: 0.134 },
            33: { L: 1, M: 1975, S: 0.13 },
            34: { L: 1, M: 2215, S: 0.126 },
            35: { L: 1, M: 2460, S: 0.122 },
            36: { L: 1, M: 2710, S: 0.118 },
            37: { L: 1, M: 2940, S: 0.115 },
            38: { L: 1, M: 3140, S: 0.112 },
            39: { L: 1, M: 3310, S: 0.11 },
            40: { L: 1, M: 3450, S: 0.108 },
            41: { L: 1, M: 3570, S: 0.107 },
            42: { L: 1, M: 3670, S: 0.106 },
            43: { L: 1, M: 3760, S: 0.106 },
            44: { L: 1, M: 3850, S: 0.105 },
            45: { L: 1, M: 3950, S: 0.105 },
            46: { L: 1, M: 4060, S: 0.105 },
            47: { L: 1, M: 4180, S: 0.105 },
            48: { L: 1, M: 4310, S: 0.105 },
            49: { L: 1, M: 4450, S: 0.105 },
            50: { L: 1, M: 4600, S: 0.105 }
        },
        length: {
            22: { L: 1, M: 27.5, S: 0.053 },
            23: { L: 1, M: 28.5, S: 0.052 },
            24: { L: 1, M: 30.0, S: 0.051 },
            25: { L: 1, M: 31.5, S: 0.05 },
            26: { L: 1, M: 33.0, S: 0.049 },
            27: { L: 1, M: 34.5, S: 0.048 },
            28: { L: 1, M: 36.0, S: 0.047 },
            29: { L: 1, M: 37.5, S: 0.046 },
            30: { L: 1, M: 39.0, S: 0.045 },
            31: { L: 1, M: 40.5, S: 0.044 },
            32: { L: 1, M: 42.0, S: 0.043 },
            33: { L: 1, M: 43.3, S: 0.042 },
            34: { L: 1, M: 44.7, S: 0.041 },
            35: { L: 1, M: 45.8, S: 0.04 },
            36: { L: 1, M: 46.8, S: 0.039 },
            37: { L: 1, M: 47.8, S: 0.038 },
            38: { L: 1, M: 48.8, S: 0.037 },
            39: { L: 1, M: 49.6, S: 0.037 },
            40: { L: 1, M: 50.3, S: 0.036 },
            41: { L: 1, M: 51.0, S: 0.036 },
            42: { L: 1, M: 51.7, S: 0.036 },
            43: { L: 1, M: 52.4, S: 0.036 },
            44: { L: 1, M: 53.1, S: 0.036 },
            45: { L: 1, M: 53.8, S: 0.036 },
            46: { L: 1, M: 54.5, S: 0.036 },
            47: { L: 1, M: 55.2, S: 0.036 },
            48: { L: 1, M: 55.9, S: 0.036 },
            49: { L: 1, M: 56.6, S: 0.036 },
            50: { L: 1, M: 57.3, S: 0.036 }
        },
        head: {
            22: { L: 1, M: 19.5, S: 0.046 },
            23: { L: 1, M: 20.5, S: 0.045 },
            24: { L: 1, M: 21.5, S: 0.044 },
            25: { L: 1, M: 22.5, S: 0.043 },
            26: { L: 1, M: 23.5, S: 0.042 },
            27: { L: 1, M: 24.5, S: 0.041 },
            28: { L: 1, M: 25.5, S: 0.04 },
            29: { L: 1, M: 26.5, S: 0.039 },
            30: { L: 1, M: 27.5, S: 0.038 },
            31: { L: 1, M: 28.5, S: 0.037 },
            32: { L: 1, M: 29.5, S: 0.036 },
            33: { L: 1, M: 30.4, S: 0.035 },
            34: { L: 1, M: 31.3, S: 0.035 },
            35: { L: 1, M: 32.1, S: 0.034 },
            36: { L: 1, M: 32.8, S: 0.034 },
            37: { L: 1, M: 33.5, S: 0.033 },
            38: { L: 1, M: 34.0, S: 0.033 },
            39: { L: 1, M: 34.5, S: 0.032 },
            40: { L: 1, M: 34.9, S: 0.032 },
            41: { L: 1, M: 35.3, S: 0.032 },
            42: { L: 1, M: 35.7, S: 0.032 },
            43: { L: 1, M: 36.0, S: 0.032 },
            44: { L: 1, M: 36.3, S: 0.032 },
            45: { L: 1, M: 36.6, S: 0.032 },
            46: { L: 1, M: 36.9, S: 0.032 },
            47: { L: 1, M: 37.2, S: 0.032 },
            48: { L: 1, M: 37.5, S: 0.032 },
            49: { L: 1, M: 37.8, S: 0.032 },
            50: { L: 1, M: 38.1, S: 0.032 }
        }
    }
};

class GrowthCalculator {
    /**
     * Z-Score via LMS method (Cole 1990):
     * When L ≠ 0: Z = ((value/M)^L - 1) / (L * S)
     * When L = 0: Z = ln(value/M) / S
     */
    static calculateZScore(type, sex, gaWeeks, value) {
        if (!value || value <= 0) return null;

        const sexData = FENTON_2013[sex];
        if (!sexData) return null;

        const typeData = sexData[type];
        if (!typeData) return null;

        const weekFloor = Math.floor(gaWeeks);
        const weekCeil = Math.ceil(gaWeeks);
        const frac = gaWeeks - weekFloor;

        const minWeek = 22;
        const maxWeek = 50;
        const wLow = Math.max(minWeek, Math.min(maxWeek, weekFloor));
        const wHigh = Math.max(minWeek, Math.min(maxWeek, weekCeil));

        const lmsLow = typeData[wLow];
        const lmsHigh = typeData[wHigh];
        if (!lmsLow) return null;

        let L, M, S;
        if (wLow === wHigh || !lmsHigh) {
            L = lmsLow.L; M = lmsLow.M; S = lmsLow.S;
        } else {
            L = lmsLow.L + frac * (lmsHigh.L - lmsLow.L);
            M = lmsLow.M + frac * (lmsHigh.M - lmsLow.M);
            S = lmsLow.S + frac * (lmsHigh.S - lmsLow.S);
        }

        if (L === 0) {
            return Math.log(value / M) / S;
        }
        return (Math.pow(value / M, L) - 1) / (L * S);
    }

    /**
     * Convert Z-score to percentile using standard normal CDF approximation
     * Abramowitz & Stegun approximation (absolute error < 1.5e-7)
     */
    static zToPercentile(z) {
        if (z === null) return null;
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const sign = z < 0 ? -1 : 1;
        const x = Math.abs(z) / Math.sqrt(2);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return ((1.0 + sign * y) / 2.0) * 100;
    }

    /**
     * Get percentile string from Z-score for display
     */
    static getPercentileFromZ(z) {
        if (z === null) return 'N/A';
        const pct = GrowthCalculator.zToPercentile(z);
        if (pct < 1) return '< 1.';
        if (pct < 3) return '< 3.';
        if (pct < 10) return '3. - 10.';
        if (pct < 50) return '10. - 50.';
        if (pct < 90) return '50. - 90.';
        if (pct < 97) return '90. - 97.';
        return '> 97.';
    }

    /**
     * Legacy-compatible: getPercentile(type, ssw, value)
     * Falls back to male if no sex provided (conservative)
     * type: 'WEIGHT', 'LENGTH', 'HEAD' (uppercase, legacy format)
     */
    static getPercentile(type, ssw, value, sex) {
        const typeMap = { 'WEIGHT': 'weight', 'LENGTH': 'length', 'HEAD': 'head' };
        const mappedType = typeMap[type] || type.toLowerCase();
        const mappedSex = sex || 'male';
        const z = GrowthCalculator.calculateZScore(mappedType, mappedSex, ssw, value);
        return GrowthCalculator.getPercentileFromZ(z);
    }

    /**
     * Full growth assessment: returns Z-scores + percentiles for all metrics
     */
    static assess(sex, gaWeeks, weightG, lengthCm, headCm) {
        const result = {};
        if (weightG) {
            const z = GrowthCalculator.calculateZScore('weight', sex, gaWeeks, weightG);
            result.weight = {
                zScore: z !== null ? Math.round(z * 100) / 100 : null,
                percentile: GrowthCalculator.zToPercentile(z),
                percentileStr: GrowthCalculator.getPercentileFromZ(z)
            };
        }
        if (lengthCm) {
            const z = GrowthCalculator.calculateZScore('length', sex, gaWeeks, lengthCm);
            result.length = {
                zScore: z !== null ? Math.round(z * 100) / 100 : null,
                percentile: GrowthCalculator.zToPercentile(z),
                percentileStr: GrowthCalculator.getPercentileFromZ(z)
            };
        }
        if (headCm) {
            const z = GrowthCalculator.calculateZScore('head', sex, gaWeeks, headCm);
            result.head = {
                zScore: z !== null ? Math.round(z * 100) / 100 : null,
                percentile: GrowthCalculator.zToPercentile(z),
                percentileStr: GrowthCalculator.getPercentileFromZ(z)
            };
        }
        return result;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GrowthCalculator, FENTON_2013 };
} else {
    window.GrowthCalculator = GrowthCalculator;
    window.FENTON_2013 = FENTON_2013;
}
