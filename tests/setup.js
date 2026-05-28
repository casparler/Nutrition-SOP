/**
 * Vitest Global Setup
 * - Stellt Decimal als globalen Bezeichner bereit
 *   (calculator.js verwendet bare `Decimal` ohne import).
 * - Stellt window.NeoProducts bereit
 *   (Produktdatenbank wird via window referenziert).
 */
import Decimal from 'decimal.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const NeoProducts = require('../products.js');

globalThis.Decimal = Decimal;

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
}
globalThis.window.NeoProducts = NeoProducts;
globalThis.window.Decimal = Decimal;
