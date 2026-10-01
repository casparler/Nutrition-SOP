// ESLint Flat Config — NeoNutri
//
// Ziel: echte Fehler finden, nicht Stilfragen diskutieren. Die Regeln sind
// bewusst eng gehalten, damit `npm run lint` auf dem Bestand leer durchlaeuft
// und nur bei tatsaechlichen Neuzugaengen anschlaegt.
//
// Nicht geprueft wird das Inline-JavaScript in index.html. Das braeuchte ein
// HTML-Plugin; die Frontend-Integritaet sichern stattdessen die Tests der
// Sektionen M, P und R.

import globals from 'globals';

const klinischeRegeln = {
    // Fehlerklassen, die in einer Dosierungsrechnung real Schaden anrichten
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    'no-redeclare': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    'no-fallthrough': 'error',
    'no-self-compare': 'error',
    'no-constant-condition': 'error',
    'no-sparse-arrays': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    // Praezisionsfallen: in klinischen Pfaden ist Decimal.js Pflicht,
    // lose Vergleiche und implizite Umwandlungen sind hier unerwuenscht
    'eqeqeq': ['error', 'smart'],
    'no-implicit-coercion': ['error', { boolean: false }]
};

export default [
    {
        // Browser-Skripte: definieren ihre Globals selbst, daher NICHT als
        // readonly-Globals deklarieren, sonst schlaegt no-redeclare an.
        files: ['calculator.js', 'products.js', 'fenton_data.js', 'logic.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,
                Decimal: 'readonly'          // kommt per CDN bzw. im Test ueber global
            }
        },
        rules: klinischeRegeln
    },
    {
        // calculator.js liest GrowthCalculator und NeoProducts, definiert sie aber nicht
        files: ['calculator.js'],
        languageOptions: {
            globals: { GrowthCalculator: 'readonly', NeoProducts: 'readonly' }
        }
    },
    {
        // logic.js gehoert inhaltlich zur Antibiotika-App und wird hier von
        // nichts geladen (offener Punkt in AGENTS.md). Nicht pruefen, solange
        // ungeklaert ist, ob die Datei bleibt.
        ignores: ['logic.js']
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.vitest }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            // Ein Test, der nichts prueft, ist schlimmer als kein Test
            'no-constant-condition': 'error'
        }
    },
    {
        ignores: ['node_modules/**', 'backup_*', '_Archiv/**', 'index.html']
    }
];
