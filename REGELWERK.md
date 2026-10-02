# NeoNutri — Regelwerk (Manuskript)

Stand: 02.10.2026, Version v3.5, 174 Tests.

Dieses Dokument beschreibt **jede Regel, nach der der Rechner arbeitet**: Wert, Herkunft,
Entscheidungsdatum, Stelle im Code und Absicherung durch Tests. Es dient dazu, Regeln später
gegenzulesen und gezielt zu ändern.

**Pflege:** Wird eine Regel eingeführt, geändert oder gestrichen, wird sie hier im selben
Arbeitsschritt nachgezogen. Das steht auch in `AGENTS.md`.

## Legende

| Status | Bedeutung |
|---|---|
| **Entscheidung** | vom Neonatologen ausdrücklich festgelegt (mit Datum) |
| **Haus** | hausinterner Standard, übernommen aus dem bisherigen Protokoll |
| **Leitlinie** | aus einer Leitlinie übernommen (Quelle genannt) |
| **Technisch** | Tippfehlerschutz oder Rechenkonvention ohne klinische Aussage |
| **Offen** | noch nicht entschieden, siehe Abschnitt 17 |

Spalte *Code*: Funktion bzw. Konstante in `calculator.js`. Spalte *Test*: ID in
`tests/calculator.test.js`; „–“ heißt, es gibt keinen eigenen Test.

---

## 1. Unveränderliche Regeln

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 1.1 | Alle Tests müssen grün sein, die Zahl darf nie schrumpfen | Entscheidung | `AGENTS.md` | alle |
| 1.2 | ELBW-Grenze **inklusiv bei 1000 g** (`bw <= 1000`), überall im Code (seit v3.5 auch im Natrium-Block) | Entscheidung | `getTargets`, `calculate` (IWL-Block) | C1, Q7, S1 |
| 1.3 | Eingabeprüfung am Anfang von `calculate()` darf nie entfernt oder gelockert werden | Entscheidung | `calculate` Step 0 | A3a–c, A4*, A5* |
| 1.4 | In der Oberfläche läuft `calculate()` nur innerhalb von try-catch | Entscheidung | `index.html` | J1 |

## 2. Eingaben und Plausibilitätsgrenzen

Außerhalb dieser Bereiche bricht die Berechnung mit einer roten Meldung ab. Es sind reine
Tippfehlergrenzen (Technisch), keine klinischen Ziele.

| Feld | Bereich | Feld | Bereich |
|---|---|---|---|
| Geburtsgewicht | > 200 bis 8000 g | Calcium | 0–200 mg/kg/d |
| aktuelles Gewicht | 0–10 000 g | Phosphat | 0–150 mg/kg/d |
| Lebenstag | 0–365 | Natrium / Kalium | 0–15 / 0–10 mmol/kg/d |
| SSW | 22–44 | enteral | 0–250 ml/kg/d |
| TFI | 0–400 ml/kg/d | FM85 | 0–6 % |
| GIR | 0–25 mg/kg/min | Mahlzeiten | 1–24 |
| Protein (PN) | 0–6 g/kg/d | Liquigen / Eiweißzusatz / Aptamil | 0–20 ml / 0–3 g/100 ml / 0–5 g/kg/d |
| Lipide (PN) | 0–6 g/kg/d | Triglyzeride / Harnstoff | 0–2000 mg/dl / 0–100 mmol/l |
| Trägerlösung / Mikro | 0–100 ml/kg/d / 0–50 ml/d | NaCl / KCl | 0–50 / 0–20 mmol/kg/d |
| Sekundärinfusion | 0–200 ml/kg/d | Hidden Sodium | 0–20 mmol/kg/d |
| Länge / Kopf | 0–100 / 0–60 cm | Vortagsgewicht | 0–10 000 g |

Nichtnumerische Eingaben brechen immer ab.

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 2.1 | **Geburtsgewicht leer → keine Berechnung** (vorher stiller Ersatzwert 1000 g) | Entscheidung 02.10.2026 | `calculate` Step 0 | T9 |
| 2.2 | **Ab Lebenstag 2 aktuelles Gewicht leer → keine Berechnung**; Tag 1 gilt das Geburtsgewicht | Entscheidung 02.10.2026 | `calculate` Step 0 | T10, Q12 |
| 2.3 | Die Oberfläche zeigt bei fehlendem Gewicht das rote Banner, springt aber nicht dorthin | Technisch | `index.html` | – |

## 3. Rechengewicht

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 3.1 | Bis einschließlich Lebenstag 10 rechnet der Rechner mit dem **größeren** von Geburts- und aktuellem Gewicht, ab Tag 11 mit dem aktuellen | Haus, **Offen** (Sprung, siehe 17.3) | `calculate` Step 1 | – |

## 4. Flüssigkeit (TFI)

Zielspannen in ml/kg/d (`TFI_TARGETS`). ELBW und VLBW liegen **bewusst 10 ml unter ESPGHAN 2018**
(Entscheidung 28.09.2026; Begründung: Cochrane Bell/Acarregui, hohe Inkubatorfeuchte, J Perinatol 2025).

| Lebenstag | ELBW (≤ 1000 g) | VLBW (≤ 1500 g) | > 1500 g |
|---|---|---|---|
| 1 | 70–90 | 60–80 | 60–80 |
| 2 | 90–110 | 90–100 | 80–100 |
| 3 | 110–130 | 100–120 | 100–120 |
| 4 | 130–150 | 120–140 | 120–140 |
| ab 5 | 150–170 | 150–170 | 140–160 |

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 4.1 | Beatmungs-Cap: bei invasiver Beatmung Obergrenze **140 ml/kg/d**, sonst 180 | Haus | `getTargets` | – |
| 4.2 | Invasiv beatmet und TFI > 140 → **CRITICAL** | Entscheidung 02.10.2026 („macht Sinn“) | `calculate` Step 12 | – |
| 4.3 | TFI > 180 Hinweis, > 200 Warnung, > 300 Plausibilitäts-Flag, > 400 Abbruch | Entscheidung 14.08.2026 | `LIMITS.TFI` | N11–N14 |
| 4.4 | TFI unter Zielminimum → Hinweis „restriktive Flüssigkeit“ | Haus | `calculate` | – |
| 4.5 | Enterales Volumen größer als TFI → Warnung | Technisch | `calculate` | – |
| 4.6 | Plateau ab Tag 5 statt Rampe | Entscheidung 28.09.2026 | `TFI_TARGETS` | Q1–Q6 |

## 5. Energie

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 5.1 | Ziel kcal/kg/d: Tag 1 **45–60**, Tag 2 **60–80**, Tag 3 **80–100**, ab Tag 4 **110–135** | Haus | `getTargets` | – |
| 5.2 | Ab Tag 4: unter Ziel → Hinweis; über Ziel → Hinweis „Überernährung prüfen“ | Haus | `calculate` Step 12 | – |
| 5.3 | Brennwerte: Glukose 4, Protein 4, Lipide 9 (Standard) bzw. 10 kcal/g (SMOFlipid) | Technisch | `CALORIES` | – |
| 5.4 | Plausibilitäts-Flag bei > 180 kcal/kg/d | Technisch | `calculate` | – |

## 6. Protein

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 6.1 | Ziel g/kg/d: ELBW ≤ 1000 g **3,5–4,0**; ≤ 1500 g **3,0–3,5**; ≥ 37 SSW und > 1500 g **2,5–3,0**; sonst 3,0–3,5 | Haus (Leitlinie ELBW) | `getTargets` | C1, C2, Q7 |
| 6.2 | Obergrenze gesamt (PN + enteral) **4,5 g/kg/d** → CRITICAL, `isSafe = false` | Haus + Leitlinie | `LIMITS.PROTEIN` | – |
| 6.3 | Ab Tag 4: unter Zielminimum → Hinweis | Haus | `calculate` | – |
| 6.4 | Ampel (grün/gelb/rot) vergleicht an **jedem** Lebenstag gegen das Ziel, auch an Tag 1–3 | Haus, **Offen** (17.5) | `comparisons` | – |
| 6.5 | Überschreitung durch Anreicherung: Hinweis nennt noch mögliche Zielkonzentration und FM85-Stufe | Entscheidung 01.10.2026 | `calculate` Step 12 | Q22, Q23, S8 |

*Leitlinie (ESPGHAN 2022, < 1800 g):* mindestens 3,5–4,0 g/kg/d, bis 4,5 nur bei langsamem Wachstum,
guter Proteinqualität und ausreichender Energie. Für die Gesamtzufuhr 4,8 g/kg (EBM + FM85 4 % bei
160 ml/kg) ist die Warnung damit leitlinienkonform. *Parenteral:* 2,5–3,5 g/kg/d ab Tag 2,
darüber nur in Studien (ESPGHAN 2018).

## 7. Lipide

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 7.1 | Ziel g/kg/d: Tag 1 1,0–2,0; Tag 2 1,5–3,0; Tag 3 2,0–3,5; ab Tag 4 2,0–4,0 | Haus | `LIPID_TARGETS` | – |
| 7.2 | Obergrenze 4,0 g/kg/d → CRITICAL | Haus | `LIMITS.LIPIDS` | – |
| 7.3 | Triglyzeride > 250 mg/dl → CRITICAL, Lipide auf 0,5–1,0 g/kg/d; 200–250 → Erinnerung | Leitlinie | `calculate` | – |
| 7.4 | Lipidanteil an Nicht-Protein-Energie unter 25 % oder über 50 % → Warnung | Leitlinie | `calculate` | – |
| 7.5 | Lipid unter Tagesziel bei laufender PN → Erinnerung | Haus | `calculate` | – |
| 7.6 | Lipidvolumen größer als PN-Volumen → CRITICAL | Technisch | `calculate` | – |

## 8. Glukose und Osmolarität

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 8.1 | GIR-Grenzen **3–12 mg/kg/min** | Haus | `LIMITS.GIR` | – |
| 8.2 | GIR > 12 → CRITICAL | Haus | `calculate` | – |
| 8.3 | **GIR unter 3 bei laufendem PN-Volumen → CRITICAL**, gilt auch für GIR = 0. Bewertet wird die Gesamt-Glukose inklusive enteraler Kohlenhydrate | Entscheidung 02.10.2026 | `calculate` Step 12 | S2, S3, T1 |
| 8.4 | Peripherer Zugang: Glukosekonzentration > 12,5 % → CRITICAL; Osmolarität > 900 mOsm/l → CRITICAL | Haus | `calculate` | – |
| 8.5 | Plausibilitäts-Flag bei GIR < 1 oder > 18 | Technisch | `calculate` | – |

## 9. Elektrolyte

### Natrium

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 9.1 | Gesamt-Natrium = PN + enteral + Hidden Sodium; PN-Wert bleibt getrennt für Osmolarität | Entscheidung (v3.2) | `totalNaMmolKg` | O14–O17 |
| 9.2 | ELBW (≤ 1000 g), Lebenstag ≤ 7: TFI < 100 ab Tag 2 → Hinweis (insensibler Verlust, Hypernatriämie); Na > 5 mmol/kg/d → Warnung | Haus | `calculate` | S1 |
| 9.3 | Natrium-Zufuhr steigt innerhalb von 48 h um > 5 mmol/kg/d → Hinweis „Serum-Natrium kontrollieren“ | Haus | `_analyzeSodiumTrend` | I* |
| 9.4 | Plausibilitäts-Flag Na > 10 mmol/kg/d | Technisch | `calculate` | – |

### Kalium (neu v3.5)

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 9.5 | **Kaliumfreie Phase an Lebenstag 1 und 2**: jede Kaliumzufuhr > 0 löst eine Warnung aus | Entscheidung 02.10.2026 | `POTASSIUM.freeUntilDay` | T2, T3 |
| 9.6 | **Obergrenze**: Geburtsgewicht < 1500 g → 5 mmol/kg/d, ab 1500 g → 3 mmol/kg/d; darüber Warnung | Entscheidung 02.10.2026, Werte nach ESPGHAN 2018 | `POTASSIUM` | T4 |
| 9.7 | Bewertet wird nur das parenterale Kalium (inkl. KCl-Zusatz); enterales Kalium wird nicht gerechnet | Technisch, **Offen** (17.6) | `effectiveK` | – |

*Leitlinie (ESPGHAN 2018 Fluid and Electrolytes):* wachsende Frühgeborene 2–5 mmol/kg/d bei < 1500 g
und 1–3 mmol/kg/d bei > 1500 g, Reifgeborene 1,5–3 mmol/kg/d. In der oligurischen Phase kann eine
Verschiebung der Kaliumgabe nötig sein (Risiko nicht-oligurische Hyperkaliämie).

### Säure-Basen-Näherung

| ID | Regel | Status | Code |
|---|---|---|---|
| 9.8 | SID-light (Na + K − Cl) negativ → CRITICAL; Na:Cl-Verhältnis < 1 → Warnung | Haus | `calculate` |

## 10. Calcium, Phosphat, Eiweiß-Verhältnisse

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 10.1 | **Ca:P-Verhältnis wird nicht mehr bewertet** — keine Warnung, kein Fazit, kein Zielbereich. Der Wert wird weiter berechnet und angezeigt. Grund: Calcium und Phosphat werden dienstags im Urin bestimmt und die Phosphat-Substitution daran angepasst | Entscheidung 02.10.2026 | `calculate` Step 9 | C3 |
| 10.2 | P:AA-Verhältnis (mmol Phosphat je g Protein) unter 1,0 → Warnung | Haus, **Offen** (17.1) | `calculate` | C4 |
| 10.3 | Energie je g Protein (NPC/P) unter 20 → Warnung „Protein wird energetisch verwertet“; über 40 → „Verfettungsrisiko“ | Leitlinie | `calculate` | – |
| 10.4 | Ausfällung in der PN: Ca + P > 72 mmol/l → CRITICAL; > 55 → Warnung | Haus | `calculate` | – |
| 10.5 | Ab Tag 14 bei enteral ≥ 100 ml/kg/d: Calcium gesamt < 120 oder Phosphat gesamt < 60 mg/kg/d → Hinweis (Osteopenie) | Leitlinie, **Offen** (17.2) | `calculate` | – |

## 11. Enterale Ernährung

### 11.1 Zielvolumen und Aufbau

| Klasse | Kriterium (unreifere Einstufung gewinnt) | Ziel ml/kg/d | Aufbau Start / Schritt |
|---|---|---|---|
| ELBW | ≤ 1000 g | 160–180 | 10 / 15 |
| VLBW | ≤ 1500 g oder < 32 SSW | 160–180 | 15 / 20 |
| spät-frühgeboren | 32–36 SSW | 150–170 | 20 / 25 |
| reif | ≥ 37 SSW | 130–160 | 20 / 25 |

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 11.1 | Tagesziel des Aufbaus = Start + (Tag − 1) × Schritt, gedeckelt am Zielmaximum | Haus (DGPM/GNPI, SIFT) | `enteralRamp` | N1–N10 |
| 11.2 | Zielmaximum = Minimum aus Basisziel, Beatmungs-Cap, Protein-Obergrenze, Energie-Obergrenze | Entscheidung (v3.2) | `getTargets` | O1–O6 |
| 11.3 | **Energie-Obergrenze nur ab Lebenstag 4.** An Tag 1–3 war sie die PN-Tagesgrenze und lieferte „Ziel 80–80“ | Entscheidung 02.10.2026 | `getTargets` | T5, T6, O3 |
| 11.4 | Phasen: keine / trophisch (< 25) / Aufbau (< Zielminimum) / voll / pausiert | Leitlinie | `calculate` | N* |
| 11.5 | Steigerungshinweis ab 10 ml/kg/d Lücke zum Tageskorridor, **immer** mit Toleranz-Vorbehalt; nie ein Stopp | Entscheidung | `calculate` | N7 |
| 11.6 | Ampel bewertet den Tageskorridor: grün ab erreicht, gelb bis 2 versäumte Schritte, darüber rot | Entscheidung (v3.2) | `comparisons.enteral` | O11–O13 |
| 11.7 | **Nahrungspause** (Grund aus fester Liste: NEC-Verdacht, instabil, peri-OP, sonstiges) unterdrückt Aufbau-Hinweise, Ampel neutral | Entscheidung (v3.2) | `feedingPaused` | O7–O10 |
| 11.8 | Vollnahrung erreicht und noch PN → Erinnerung „Beendigung der PN prüfen“ | Haus | `calculate` | N* |

### 11.2 Anreicherung (FM85) und Supplemente

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 11.9 | FM85 wirkt nur auf Muttermilch: je 1 % +0,4675 g Protein, +3,5 kcal, +0,05 g Fett, +0,6 g Kohlenhydrate, +3 mg Na, +40 mg Ca, +22 mg P je 100 ml; 1 % = 1 g auf 100 ml (4 % = 1 g auf 25 ml) | Haus | `calculate` Step 7 | Q14–Q21 |
| 11.10 | Basis EBM je 100 ml: 71 kcal, 1,13 g Protein, 4,03 g Fett, 7,0 g KH, 7 mg Na, 28 mg Ca, 32 mg P | Haus | `calculate`, `products.js` | – |
| 11.11 | **Bei Formelnahrung wird ein stehendes FM85-Feld ignoriert**, die Zubereitung zeigt 0 g, ein Hinweis erscheint | Entscheidung 01.10.2026 | `fm85Ignoriert` | S7, S7b |
| 11.12 | **FM85-Empfehlungen** (Erinnerung ab 50 ml/kg/d, Start-Kriterium ab 100 ml/kg/d, Titrationsplan auf 4 %, Fazit-Zeile, Hinweis ab Tag 28) nur bei **Geburtsgewicht < 1800 g** | Entscheidung 02.10.2026, Geltungsbereich ESPGHAN 2022 | `FORTIFIER.maxBirthWeight` | T7, T8 |
| 11.13 | FM85 bei enteral < 100 ml/kg/d → Hinweis; Voraussetzungs-Erinnerung (stabiles Abdomen, > 5–7 Tage toleriert) | Haus | `calculate` | – |
| 11.14 | Zielkonzentration wird eingegeben (g Eiweiß/100 ml, FM85 in 0,5-%-Schritten); Aptamil Eiweiß+: 82,1 g Protein je 100 g Pulver, 338 kcal; Zielkonzentration hat Vorrang | Entscheidung (v3.4) | `calculate` | Q15–Q19 |
| 11.15 | Liquigen: 4,5 kcal/ml, 0,5 g Fett/ml. Supplement-Volumen erhöht die Gesamtflüssigkeit **nicht** | Haus | `calculate` Step 7b | N15–N20 |
| 11.16 | Harnstoff < 3 mmol/l bei enteral ≥ 100 → Hinweis (Eiweißmangel); > 8 mmol/l → Hinweis (Eiweiß prüfen) | Haus, **Offen** (17.4) | `calculate` | – |
| 11.17 | Wachstum: Growth Velocity = (Gewicht − Vortag) / Gewicht × 1000 g/kg/d; ab Tag 28 unter 15 → Hinweis | Leitlinie | `calculateGrowthVelocity` | E1 |

*Leitlinie (ESPGHAN 2022, < 1800 g):* Energie 115–140 kcal/kg/d, darüber nur bei zu geringem Wachstum
und höchstens 160. Multikomponenten-Fortifier ab 40–100 ml/kg/d enteral. Harnstoff > 5,7 mmol/l ohne
Volumen- oder Nierenproblem: Eiweißzufuhr senken erwägen.

## 12. Erinnerungen

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 12.1 | **Vitamin D und Proprems**, sobald die Einzelmahlzeit **≥ 3 ml** beträgt. Die absolute Grenze bleibt bewusst so | Entscheidung 02.10.2026 | `calculate` Step 11 | – |
| 12.2 | Ab Tag 3 auf FG-Mix 7,5 %: Wechsel auf Basislösung FG empfohlen | Haus | `calculate` | – |
| 12.3 | Triglyzeride 200–250: Lipid-Reduktion erwägen | Haus | `calculate` | – |

## 13. Gewicht, Perzentilen, SGA

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 13.1 | Physiologischer Verlust rund 3 %/Tag, kumulativ 7–15 %; Rückkehr zum Geburtsgewicht bis Tag 14 | Leitlinie | `WEIGHT_COURSE` | Q8–Q12 |
| 13.2 | Tag 3–7, Verlust < 2 % und TFI am oberen Zielrand → Hinweis (Überwässerung, PDA) | Haus | `calculate` | Q8–Q12 |
| 13.3 | Verlust > 15 % → Warnung; nach Tag 14 Geburtsgewicht nicht erreicht → Hinweis | Haus | `calculate` | Q8–Q12 |
| 13.4 | Gewichtsregeln laufen nur, wenn ein aktuelles Gewicht eingegeben wurde | Entscheidung (v3.4) | `calculate` | Q12 |
| 13.5 | **Gewichtsperzentile** nach Fenton gegen das **korrigierte** Gestationsalter (SSW + Lebenswochen) | Entscheidung 01.10.2026 | `calculate` Step 0 | S6 |
| 13.6 | Fenton-Tabelle **männlich** für alle (kein Geschlechtsfeld); die weibliche Tabelle liegt rund 5 % niedriger | Haus, **Offen** (17.7) | `calculate` | – |
| 13.7 | **SGA**: Geburtsgewicht unter der **10. Perzentile** beim Gestationsalter bei Geburt → Hinweis; unter der **3.** → „schwer“. Der Hinweis nennt Hypoglykämie-, Phosphat- und Kaliumrisiko; kein Eingriff in Zielwerte | Entscheidung 02.10.2026 | `SGA` | T11, T12 |

## 14. Beurteilung, Ampeln, Fazit

| ID | Regel | Status | Code |
|---|---|---|---|
| 14.1 | Ampel je Größe: grün im Ziel, gelb bis 10 % der Spannbreite daneben, sonst rot | Haus | `checkStatus` |
| 14.2 | Beurteilung **kritisch**, wenn mindestens ein CRITICAL oder ein Sicherheitslimit gerissen ist; **Aufmerksamkeit**, wenn andere Warnungen oder eine Ampel nicht grün; sonst stabil | Haus | `generateClinicalAssessment` |
| 14.3 | Höchstens 5 Aussagen, kritische zuerst (zwei) | Haus | `generateClinicalAssessment` |
| 14.4 | **Fazit enthält alle CRITICAL-Befunde** (GIR, Osmolarität, Triglyzeride, Hypoglykämie, Kristallgefahr, SID). „Keine Korrekturen erforderlich“ steht nur bei leerer Befundliste. Bei Hypertriglyzeridämie keine Zeile „Energie steigern“ | Entscheidung 01.10.2026 | `calculate` Step 16 (S4, S5) |
| 14.5 | Plausibilitäts-Flags: TFI < 30 oder > 300; Protein > 6; Lipide > 5; Gewicht < 200 oder > 6000 g | Technisch | `calculate` |

## 15. Vorhersagehinweise (nur Hinweis, nie Sperre)

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 15.1 | Kumuliertes Energiedefizit > 150 kcal/kg über ≥ 3 Tage → Hinweis | Leitlinie (Embleton 2001) | `_analyzeEnergyGap`, `calculateEnergyGapIndex` | K1–K5, I* |
| 15.2 | Natrium-Trend siehe 9.3 | Haus | `_analyzeSodiumTrend` | I* |

## 16. Versorgungsphasen

Phase A Tag 1–7 (Übergang), Phase B Tag 8–28 (Aufbau), Phase C ab Tag 29 (Konsolidierung). Haus.

---

## 17. Offene Punkte (brauchen eine Entscheidung)

| Nr. | Punkt | Stand |
|---|---|---|
| 17.1 | **P:AA-Warnung (10.2)**: soll sie bleiben oder entfallen? Alle Hauslösungen liegen bei 0,5–0,77 mmol/g und lösen sie immer aus | zur Erklärung vorgelegt |
| 17.2 | **Osteopenie-Hinweise (10.5)**: Calcium und Phosphat steuern Sie über den Urin am Dienstag. Sollen die Zufuhr-Hinweise entfallen? | offen |
| 17.3 | **Rechengewicht (3.1)**: Tag-10-Sprung. Immer aktuelles Gewicht, oder Geburtsgewicht bis es wieder erreicht ist? | offen |
| 17.4 | **Harnstoff (11.16)**: Haus-Grenze > 8 mmol/l, ESPGHAN 2022 nennt > 5,7 mmol/l als Anlass, die Proteinzufuhr zu senken | offen |
| 17.5 | **Protein-Ziel und Aufbau (6.4)**: Soll die Protein-Ampel erst gelten, wenn enteral aufgebaut wird? Die Regel „Protein erst beim enteralen Aufbau“ ist in den Projektdokumenten nicht auffindbar | Passage aus dem Protokoll nötig |
| 17.6 | **Kalium-Schwere (9.5, 9.6)**: aktuell Warnung. Soll es CRITICAL sein? Soll enterales Kalium mitgerechnet werden? | offen |
| 17.7 | **Geschlecht (13.6)** für Perzentile und SGA | zurückgestellt |
| 17.8 | **Protein-Obergrenze 4,5 g/kg/d für Reife** (6.2): in ESPGHAN 2022 nicht geregelt (nur < 1800 g) | Quelle fehlt |
| 17.9 | **Energie- und Protein-Ziele für Reife** (5.1, 6.1): Leitlinienwerte für Reife nicht belegt | Quelle fehlt |

---

## 18. Quellenlage dieser Sitzung (02.10.2026)

Volltexte der Leitlinien waren nicht abrufbar (Zugriff gesperrt). Die genannten Werte stammen aus
Zusammenfassungen und Auszügen und sollten einmal gegen die Originale geprüft werden:

- Embleton ND et al. *Enteral Nutrition in Preterm Infants (2022): ESPGHAN Position Paper.*
  J Pediatr Gastroenterol Nutr 2023;76:248–268. [DOI 10.1097/MPG.0000000000003642](https://doi.org/10.1097/MPG.0000000000003642)
- Jochum F et al. *ESPGHAN/ESPEN/ESPR/CSPEN guidelines on pediatric parenteral nutrition: Fluid and electrolytes.*
  Clin Nutr 2018 (PMID 30064846).
- van Goudoever JB et al. *… guidelines on pediatric parenteral nutrition: Amino acids.*
  Clin Nutr 2018 (PMID 30100107).

## 19. Entscheidungsprotokoll

| Datum | Entscheidung |
|---|---|
| 14.08.2026 | TFI-Grenzen 180 / 200 / 300 / 400 |
| 28.09.2026 | Flüssigkeitsziele ELBW und VLBW 10 ml/kg/d unter ESPGHAN, Plateau ab Tag 5 |
| 01.10.2026 | Korrekturen aus der Patientensimulation: GIR-0-Warnung, 1000-g-Grenze im Natrium-Block, Fazit mit kritischen Befunden, Perzentile nach korrigiertem Alter, FM85 nur bei Muttermilch |
| 02.10.2026 | Ca:P entfällt. Beatmungs-CRITICAL bleibt. Kalium: Warnung bei hoher Zufuhr, kaliumfreie Tage 1–2. Vitamin-D-/Proprems-Grenze (3 ml absolut) bleibt. Nur mit realem Gewicht rechnen. Hypoglykämie ist CRITICAL. SGA-Erkennung ja, Phototherapie nein. Geschlecht zurückgestellt. FM85-Empfehlungen nur bei < 1800 g. Energie-Obergrenze des enteralen Ziels erst ab Tag 4 |
