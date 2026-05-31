# OPTIMIZATION_STRATEGY.md — NeoNutri v2.0 Evolution

> Branch: `feature/super-tool-v2-evolution`
> Verfasst nach systematischer Codebase-Analyse (calculator.js 933 LOC, index.html 1619 LOC, 31 Tests).
> Prinzip: **Klein, atomar, getestet, klinisch begründbar.** Kein Big-Bang-Rewrite.

---

## 🎯 Mission

Transformation des bestehenden klinischen Rechners in ein **stress-resilientes, prädiktives Decision Support Tool** — ohne die drei sakrosankten Invarianten ([AGENTS.md](./AGENTS.md)) zu verletzen.

---

## 📊 Beobachtungen aus der Codebase

| Bereich | Beobachtung | Hebel |
|---------|-------------|-------|
| **Validierung** | Nur 4 Hard-Checks (Step 0). Viele kritische Felder ungeprüft (Protein, Lipide, GIR, Elektrolyte, Gewichts-Obergrenze, Frequenz, FM85%). | 🟢 Sicher erweiterbar |
| **Input-Coercion** | `parseFloat(x) \|\| 0` schluckt Strings, NaN, "abc" lautlos → falsche Berechnungen ohne Warnung. | 🟢 Sicher erweiterbar |
| **Osmolarität** | Wird berechnet, aber dem User wird NICHT gezeigt, *welche Komponente* (Glucose vs. Elektrolyte vs. AS) den Wert treibt. | 🟡 UI-Erweiterung |
| **Trends** | `history` existiert im Frontend, wird aber für Trend-Analysen (Na-Trajektorie, Gewichtsverlauf, BUN-Trend) nicht genutzt. | 🟡 Mittlerer Aufwand |
| **Plausibilitätsflags** | Existieren als Liste, werden aber im UI nicht prominent angezeigt (User-Recherche nötig). | 🟢 UI-Hinweis |
| **Keyboard-A11y** | Keine sichtbaren Focus-States für Tab-Navigation; keine Shortcuts. | 🟢 CSS + JS |
| **Print-Layout** | `no-print`-Klassen vorhanden, aber kein optimiertes Bedside-Sheet. | 🟡 CSS-Arbeit |
| **Tests** | 31 grün, decken Kern-Safety. Validierung deckt nur 4 Fälle. Trends/Osmolarität-Breakdown ungetestet. | 🟢 Tests parallel zur Implementierung |

---

## 🗂️ Priorisierte Roadmap (atomare Tickets)

### EPIC 1 — Robustness & Validation Hardening (klein, hoher Wert)
*Risiko: niedrig. Tests: leicht zu schreiben. Patientensicherheit direkt verbessert.*

| # | Ticket | Beschreibung | Status |
|---|--------|--------------|--------|
| R-01 | **Extended ValidationError-Layer** | Hard-Limits für: Gewicht > 8000g, postnatalAge > 365, ssw < 22 oder > 44, GIR > 25, Protein > 6, Lipide > 6, Calcium > 200 mg/kg, Phosphat > 150 mg/kg, FM85 > 6%. | ✅ v1.2 |
| R-02 | **Type-Safe Input Parser** | Helper `_safeParseNum(raw, name, {min, max, default})` → wirft `ValidationError` bei NaN/non-numeric strings. Validiert auch bisher ungeprüfte Felder (naclMl, kclMl, carrierVolume, microVolume, secondaryRateKg, hiddenSodiumMmolKg, length, head). | ⏳ in Arbeit |
| R-03 | **Defensive Display** | Alle `displayResults`-Setter mit `?? '–'`-Fallback, damit `undefined` keine NaN-Anzeige produziert. | ☐ |
| R-04 | **Unit Tests** | A4a–A4m: 13 Tests für jeden ValidationError-Fall. Geplant A5a–A5e für R-02. | ✅ A4a–A4m / ⏳ A5* |

### EPIC 2 — Clinical Intelligence (mittel, sehr hoher Wert)
*Risiko: mittel. Erfordert klinische Validierung — User-Freigabe vor Merge.*

| # | Ticket | Beschreibung | Status |
|---|--------|--------------|--------|
| C-01 | **Osmolarity Breakdown** | Im Result: zeige Beitrag jeder Komponente (Glucose-mOsm, Na-mOsm, K-mOsm, AS-mOsm) → Klinik sieht sofort, wo zu kürzen ist. | ☐ |
| C-02 | **Trend-Engine (Sodium/BUN/Weight)** | Aus `history[day-1..day]` Δ pro Tag berechnen; bei Na-Anstieg > 5 mmol/l/d → CRITICAL "Akute Hypernatriämie-Trajektorie". | ☐ |
| C-03 | **Energy-Gap-Index** | Δ zwischen `kcalPerKg` und `targets.energy.min` über Tage akkumulieren → kumulatives Energiedefizit als Indikator für PEW-Risk. | ☐ |
| C-04 | **Smart Ca/P Suggestion** | Statt nur "Phosphat erhöhen" konkreten Vorschlag in **ml Glycophos** / **ml Calcium-Gluconat 10%** rechnen. | ☐ |
| C-05 | **Predictive Sodium** | Bei IWL-Phase A: vorhergesagter Na-Wert in 24h = aktueller Na + (Na-Zufuhr − geschätzter Verlust). | ☐ |

### EPIC 3 — Experience Design (mittel, hoher Wert)
*Risiko: niedrig–mittel. Visuelle Änderungen — User-Freigabe für Look&Feel.*

| # | Ticket | Beschreibung | Status |
|---|--------|--------------|--------|
| U-01 | **Color-Blind-Safe Palette** | Aktuell Rot/Grün/Gelb. Ergänzen um Symbole (✓ / ⚠ / ✕), Muster bei Farbe. | ☐ |
| U-02 | **Sparkline-SVGs** | Mini-Verlaufsgrafiken für Gewicht, Na, BUN, kcal/kg über die letzten 7 Tage. | ☐ |
| U-03 | **Sticky Safety-Banner** | Bei `isSafe=false`: persistent oben fixiert, scrollt nicht weg. | ☐ |
| U-04 | **Keyboard-Shortcuts** | `Ctrl+S` = Tag speichern, `Ctrl+P` = Print, `Esc` = Banner schließen, `?` = Help. | ☐ |
| U-05 | **Print-Optimiertes Bedside-Sheet** | Ein-Seiten-PDF mit allen relevanten Zahlen, Warnings, Reminders. | ☐ |
| U-06 | **High-Contrast-Mode** | Toggle für Tag/Nacht-Ansicht (NICU oft gedimmt). | ☐ |

### EPIC 4 — Code Quality & Maintainability
*Risiko: niedrig. Pure Refactorings hinter den 31 Tests.*

| # | Ticket | Beschreibung | Status |
|---|--------|--------------|--------|
| Q-01 | **JSDoc-Coverage** | Alle public methods in calculator.js mit `@param`/`@returns`/`@throws`. | ☐ |
| Q-02 | **Magic-Number-Extraktion** | Konstanten wie 5/10/2 (Osmolarity-Faktoren), 28 (Default SSW), 14 (effectiveDay-Cap) → `this.CONST`. | ☐ |
| Q-03 | **Test-Coverage-Report** | `npm run coverage` mit Istanbul; Ziel ≥ 85% Line Coverage. | ☐ |
| Q-04 | **CI-Workflow** | `.github/workflows/test.yml` → `npm test` bei jedem Push. | ☐ |

---

## 🚦 Workflow für jedes Ticket

```
1. Read affected files
2. Tests vorher: 31/31 grün?
3. Implementation atomic
4. Tests nachher: 31/31 + neue grün?
5. Git commit (descriptive message)
6. Push checkpoint
7. Bei klinischen Tickets (EPIC 2): User-Review BEVOR Merge
```

---

## ⚖️ Was ich autonom mache vs. was User-Freigabe braucht

| Autonom (Safety-First konservativ) | Freigabe nötig |
|------------------------------------|----------------|
| Erweiterte Validierung (EPIC 1) | Neue klinische Logik/Berechnungen (EPIC 2) |
| Defensive Programmiermuster | UI-Redesign / Look-Change (EPIC 3) |
| JSDoc, Refactorings hinter Tests | Neue klinische Dosierungsvorschläge |
| Neue Tests | Änderung von Warn-Schwellen |
| Bug-Fixes mit Test-Beweis | Merge in `main` |

---

## 📌 Iterations-Verlauf (Gedächtnis-Anker für Session-Unterbrechungen)

### Iteration 1 — v1.2 (commit `898a54a`) ✅
**Ticket R-01 + R-04**: Erweiterter ValidationError-Layer + 13 Tests A4a–A4m.
Begründung: Sofortiger Patientensicherheits-Gewinn, geringes Risiko, vollständig durch Tests abgesichert.
**Stand: 44 Tests grün.**

### Iteration 2 — v1.3 (in Arbeit) ⏳
**Ticket R-02 + R-03**: Type-safe Parser für bisher ungeprüfte Felder + Defensive Display-Fallbacks.
- R-02: `_safeParseNum()`-Helper in calculator.js; ergänzende Validierung für `naclMl`, `kclMl`, `carrierVolume`, `microVolume`, `secondaryRateKg`, `hiddenSodiumMmolKg`, `length`, `head`.
- R-03: `displayResults()` in index.html mit `fmt(v)`-Wrapper, der `null/undefined/NaN → '–'` ersetzt.
- Neue Tests A5a–A5e geplant für R-02.
- Bei Unterbrechung: hier weitermachen. Branch: `feature/super-tool-v2-evolution`.

### Iteration 3 — Vorschlag für User-Freigabe (noch nicht gestartet)
Nach v1.3-Commit warte ich auf Freigabe für eine der folgenden Stoßrichtungen:
- **B (UI/Visualisierung):** U-02 Sparklines + U-03 Sticky Safety-Banner.
- **C (Clinical Intelligence):** C-01 Osmolarity Breakdown (rein deskriptiv, keine neue Dosierung).
- **C-04 "Smart Ca/P ml-Vorschlag" bleibt OHNE explizite Freigabe TABU** (User-Konstitution: "keine Dosierungen erfinden").
