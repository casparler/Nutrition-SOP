# NeoNutri — Regelwerk (Manuskript)

Stand: 01.11.2026, Version v3.6.17, 285 Tests.

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
| 1.5 | **Versionswächter:** Die Oberfläche rechnet nur, wenn `calculator.VERSION` zu `EXPECTED_CALC_VERSION` in `index.html` passt, sonst Banner „Rechenkern veraltet“ und keine Berechnung. Die Skript-Tags tragen `?v=` gegen den Browser-Cache. Bei jeder Änderung an `calculator.js` oder `index.html` die Version an **drei Stellen** hochzählen | Entscheidung 20.10.2026 | `VERSION`, `index.html` | W1, W2 |

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
| 5.1 | Ziel kcal/kg/d: Tag 1 **45–60**, Tag 2 **60–80**, Tag 3 **80–100**, ab Tag 4 **110–140** (bis v3.6.16: 110–135; Entscheidung 01.11.2026, ESPGHAN 2022: 115–140) | Haus | `getTargets` | O2, AN1–AN6 |
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
guter Proteinqualität und ausreichender Energie. Mit den Packungswerten ergibt EBM + FM85 4 % bei 150 ml/kg 3,8 g/kg und bei
160 ml/kg 4,1 g/kg (vorher fälschlich 4,5 bzw. 4,8); die Obergrenze 4,5 wird erst bei höherem Volumen oder zusätzlichem Eiweißzusatz erreicht. *Parenteral:* 2,5–3,5 g/kg/d ab Tag 2,
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

## 9a. Sekundärinfusionen (v3.6.3)

Auswahl in der Oberfläche; die Rate wird in ml/h eingegeben und in ml/kg/d umgerechnet. Das Volumen zählt zur
Gesamtflüssigkeit und verkleinert den PN-Anteil. Werte je 100 ml:

| Lösung | Glukose | Natrium | Chlorid | Kalium | Calcium |
|---|---|---|---|---|---|
| Glucose 5 / 10 / 20 % | 5 / 10 / 20 g | – | – | – | – |
| NaCl 0,45 % | – | 7,7 mmol | 7,7 mmol | – | – |
| NaCl 0,9 % | – | 15,4 mmol | 15,4 mmol | – | – |
| **Sterofundin ISO** | – | 14,5 mmol | 12,7 mmol | 0,4 mmol | 0,25 mmol |

Sterofundin ISO je 1000 ml: Na 145, K 4, Ca 2,5, Mg 1, Cl 127, Acetat 24, Malat 5 mmol, theoretische Osmolarität
309 mOsm/l. Magnesium, Acetat und Malat werden nicht gerechnet.

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 9a.1 | **Sterofundin ISO** ist als Sekundärinfusion wählbar und trägt Natrium, Chlorid, Kalium und Calcium bei | Entscheidung 23.10.2026 | `products.js`, `calculate` Step 3b | AC1–AC9 |
| 9a.2 | **Kalium aus der Sekundärinfusion** zählt zur Kaliumzufuhr und löst damit die kaliumfreien Tage 1–2 und die Obergrenze aus (Regeln 9.5, 9.6) | Entscheidung 23.10.2026 | `effectiveK` | AC6 |
| 9a.3 | **Calcium aus der Sekundärinfusion** zählt zur Gesamtzufuhr, nicht zur PN-Konzentration (die Ausfällungsprüfung betrifft nur den PN-Beutel) | Entscheidung 23.10.2026 | `totalCaMgKg` | AC2 |
| 9a.4 | **Korrektur der Produktdaten:** NaCl 0,9 % hatte 154 statt 15,4 mmol Natrium je 100 ml, NaCl 0,45 % 77 statt 7,7. Die App rechnete bei diesen Lösungen mit zehnfachem Natrium (z. B. 74 statt 7,4 mmol/kg bei 48 ml/kg/d) | Fehlerkorrektur 23.10.2026 | `products.js` | AD1–AD4 |
| 9a.5 | Jede Auswahl der Oberfläche muss in den Produktdaten existieren | Technisch | `index.html`, `products.js` | AC8 |
| 9a.6 | **PN-Beutel und Sekundärinfusion sind getrennt:** Osmolarität und Glukosekonzentration der PN betrachten nur Glukose, Eiweiß, Natrium und Kalium des PN-Beutels, geteilt durch das PN-Volumen. Natrium, Kalium und Glukose der Sekundärinfusion gehen in Gesamtzufuhr, GIR und Energie ein, nicht in die PN-Konzentration. Ohne PN-Inhalte ist die PN-Osmolarität 0 | Fehlerkorrektur 23.10.2026 (Praxisfall: 430 g, Sterofundin 1 ml/h, keine PN) | `calculate` (`pnGlucoseG`, `pnNaMmolKg`, `pnKMmolKg`) | AE1–AE4 |
| 9a.7 | **Die Sekundärlösung selbst** wird bei peripherem Zugang gegen 900 mOsm/l geprüft (Faustformel Glukose g/l × 5 + (Na + K) mmol/l × 2). Glucose 20 % peripher: CRITICAL, Glucose 10 % und Sterofundin: keine Meldung | Entscheidung 23.10.2026 | `secondaryOsmolarity` | AE5 |
| 9a.8 | **Ursachenzeile:** Bleiben bei eingetragenen PN-Inhalten weniger als 50 ml/kg/d PN-Volumen frei (TFI − enteral − Sekundärinfusion − Träger − Lipide), nennen die CRITICAL-Meldungen zu Osmolarität, Glukosekonzentration, Ausfällung und Lipid-Volumen diese Ursache. Die Meldung bleibt bestehen, die Eingaben passen dann nicht zusammen | Entscheidung 23.10.2026 | `pnVolumenUrsache` | AE6, AE7 |
| 9a.9 | **Auswahl „Keine parenterale Ernährung“** (Infusionslösung): GIR, Aminosäuren, Calcium, Phosphat, Natrium und Kalium werden von der App auf 0 gesetzt und gesperrt; **Lipide bleiben unabhängig einstellbar** (manche Kinder erhalten Lipide i. v. ohne PN-Lösung, Korrektur 23.10.2026), ein Hinweis erklärt das. Bei anderer Auswahl (oder Vorlage) kehren die bisherigen Werte zurück bzw. werden verworfen. Der Rechenkern erhält `selectedSolution: none` mit Nullen | Entscheidung 23.10.2026 (Neonatologe: „selbst leeren“) | `index.html` (`applyNoPN`, `discardNoPN`) | AF1–AF6 |

## 10. Calcium, Phosphat, Eiweiß-Verhältnisse

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 10.1 | **Ca:P-Verhältnis wird nicht mehr bewertet** — keine Warnung, kein Fazit, kein Zielbereich. Der Wert wird weiter berechnet und angezeigt. Grund: Calcium und Phosphat werden dienstags im Urin bestimmt und die Phosphat-Substitution daran angepasst | Entscheidung 02.10.2026 | `calculate` Step 9 | C3 |
| 10.2 | **P:AA-Verhältnis wird nicht mehr bewertet** — keine Warnung, kein Fazit. Der Wert wird weiter berechnet und angezeigt. Grund: Phosphat wird über Urin und Labor gesteuert, alle Hauslösungen liegen bei 0,5–0,77 mmol/g und lösten die Warnung ständig aus | Entscheidung 20.10.2026 | `calculate` | C4 |
| 10.3 | Energie je g Protein (NPC/P): unter 20 → Warnung „Protein wird energetisch verwertet“, **nur bei laufender PN** (Energie i. v. größer 0). **Keine Obergrenze mehr** (früher „Verfettungsrisiko“ über 40). Der Wert bleibt immer sichtbar. Begründung: kein belegter Schwellenwert (die ESPGHAN/ESPEN/ESPR/CSPEN-Gruppe nennt das optimale Energie/Eiweiß-Verhältnis bei Frühgeborenen ausdrücklich als offen, Johnson 2022, doi:10.1038/s41390-021-01670-9); Muttermilch allein liegt bei 50–60 kcal/g; die implizierte Maßnahme (Energie senken) widerspricht der Datenlage, nach der niedrige Energie- und Eiweißzufuhr mit höherer Fettmasse einhergehen (Lingwood 2020, doi:10.1017/S000711451900343X; Cardoso 2023, doi:10.3390/nu15061533). Echte Überversorgung melden weiter Energie-Zielbereich, Lipid-Maximum, Lipid-Anteil an NPC und Triglyzeride. Untergrenze: Huston 2025 (doi:10.1177/19345798251318605), niedriges NPC:AA mit höherem Harnstoff | Entscheidung 23.10.2026 nach Literaturrecherche | `calculate`, `generateClinicalAssessment`, Tooltip | AG1–AG5 |
| 10.4 | Ausfällung in der PN: Ca + P > 72 mmol/l → CRITICAL; > 55 → Warnung | Haus | `calculate` | – |
| 10.5 | **Lipid-Anteil an der Nicht-Eiweiß-Energie (NPC)**: Die Empfehlung 25–50 % gilt laut Zusammenfassung der ESPGHAN/ESPEN/ESPR/CSPEN-Leitlinie 2018 (Lipide, Lapillonne et al., doi:10.1016/j.clnu.2018.06.946; nur die Zusammenfassung war einsehbar, nicht der Volltext) für **vollständig parenteral ernährte** Patienten. Deshalb: Bezug auf die Gesamtenergie (parenteral + enteral), Regel **nur bis zur trophischen Ernährung** (enteral unter 25 ml/kg/d, wie Phase „trophisch“) und nur bei PN-Energie. Unter 25 % → Warnung (Mangel an essentiellen Fettsäuren), über 50 % → Warnung (Glucose-Anteil erhöhen). **Ab 25 ml/kg/d enteral gibt es keine Anteilsregel** (Milch liefert selbst etwa die Hälfte als Fett); dann gelten nur Lipid-Maximum und Triglyzerid-Prüfung. Die reinen PN-Werte (`npcLipidPercent`, `npcGlucosePercent`) bleiben im Rechenkern erhalten, die Anzeige nutzt die Gesamtwerte (`npcLipidPercentTotal`, `npcGlucosePercentTotal`, `npcTotalAll`). Anlass: Sterofundin 1 ml/h + Muttermilch + Lipide i. v. meldete „Lipid-Anteil 100 % > 50 %“ | Entscheidung 23.10.2026 (Neonatologe: Bezug Gesamtenergie; Leitlinie: vollständige PN) | `calculate`, Stationstabelle, Tooltip | AH1–AH7, C5 |
| 10.6 | **Triglyzerid-Kontrollhinweis** (Stufe „Hinweis“, nie ein Stopp): Ist **kein** Triglyzerid-Wert eingetragen und laufen Lipide i. v. **über 3 g/kg/d**, oder bei **Geburtsgewicht bis 1000 g (inklusive) ab 2 g/kg/d**, erscheint „Triglyzeride kontrollieren (Zufallswert genügt)“. Mit eingetragenem Wert greift die bestehende Prüfung (200–250 Erinnerung, über 250 CRITICAL). Belege: Frost 2023 (doi:10.1038/s41372-023-01637-0, Steigerung bis 3 g/kg/d fördert das Wachstum, keine einheitliche Definition der Hypertriglyzeridämie), Suh 2025 (doi:10.3389/fped.2025.1520420, Risikofaktoren niedriges Geburtsgewicht und Lipiddosis), Bader 2021 (doi:10.3389/fped.2021.601915, Zufallswert genügt). Die Schwellen 3 und 2 g/kg/d sind Hausfestlegung auf dieser Grundlage | Entscheidung 23.10.2026 (Neonatologe: „Hinweis einbauen“; Auslöser nach Vorschlag) | `LIPID_TG_HINT`, `calculate` | AI1–AI5 |
| 10.7 | **Lipide brauchen Volumen:** Lässt die Gesamtflüssigkeit (Gesamtflüssigkeit − Milch − Sekundärinfusion − Träger − Mikro) gar kein Volumen frei, werden eingetragene Lipide **nicht gerechnet** (weder Energie noch Summen, Lipid-Volumen 0) und die App meldet einen Hinweis mit dem benötigten Volumen in ml/kg/d. Reicht das Volumen nur teilweise, bleibt CRITICAL „Lipid-Volumen übersteigt parenterale Kapazität“. Gleiches Prinzip wie bei den übrigen PN-Feldern ohne PN-Volumen. Anlass: 800 g, rein enteral, stehengebliebener Lipid-Standardwert 1 g/kg/d zählte still 9 kcal/kg/d zur Energie (117,5 statt 108,5 kcal/kg/d). Kinder mit Lipiden ohne PN-Lösung geben das Lipid-Volumen in der Gesamtflüssigkeit an, dann zählen die Lipide unverändert | Fehlerkorrektur 23.10.2026 | `calculate` (`lipidsNoRoom`) | AJ2–AJ4 |
| 10.8 | **Enterales Volumen wird in ml/kg/d eingegeben.** Unter dem Feld zeigt die App die Umrechnung: Tagesmenge in ml, Menge je Mahlzeit und das Rechengewicht (vor Tag 11 das größere von Geburts- und aktuellem Gewicht, danach das aktuelle). Anlass: 12 × 12 ml bei 800 g sind 180 ml/kg/d; eingegeben wurden 144 (die Tagesmenge in ml), die App rechnete richtig, aber mit 144 ml/kg/d (9,6 ml je Mahlzeit) | Entscheidung 31.10.2026 | `index.html` (`enteral-converted`), `results.calculationWeightG` | AJ1, AJ5, AJ6 |
| 10.9 | **Mengen in anderer Einheit eingeben:** Gesamtflüssigkeit (ml/kg/d, ml/Tag, ml/h), enterale Ernährung (ml/kg/d, **ml je Mahlzeit**, ml/Tag) und Spülflüssigkeit (ml/kg/d, ml/h, ml/Tag) haben eine Einheiten-Auswahl, Standard ml/kg/d. Die Oberfläche rechnet mit `getCalculationWeightG` und `volumeToMlKg` des Rechenkerns in ml/kg/d um (ml je Mahlzeit × Mahlzeiten pro Tag ÷ Rechengewicht); `calculate()` erhält weiter ml/kg/d, die harten Grenzen (Invariante 3, z. B. Gesamtflüssigkeit über 400 ml/kg/d) gelten damit für den **umgerechneten** Wert. Unter den Feldern steht die Umrechnung (ml/kg/d, ml/d, ml/h, ml je Mahlzeit, Rechengewicht). Ohne Gewicht keine Umrechnung. Vorlagen und die Übernahme der Startwerte stellen die Einheiten auf ml/kg/d zurück. Die Sekundärinfusion (ml/h) rechnet jetzt mit dem Rechengewicht statt mit dem aktuellen Gewicht (vorher mit Ersatzwert 1000 g, wenn das aktuelle Gewicht fehlte; bei Geburtsgewicht über aktuellem Gewicht vor Tag 11 wurde die Menge um bis zu das Verhältnis der Gewichte überschätzt) | Entscheidung 31.10.2026 (Neonatologe: Mengen direkt eintragen) | `calculator.js` (`getCalculationWeightG`, `volumeToMlKg`), `index.html` (`input-*-unit`) | AK1–AK10 |
| 10.10 | **FM85 und Eiweiß-Zusatz aus der Verordnung:** FM85 kann als % (Standard), als **ml 50-%-Lösung je Mahlzeit** oder als g Pulver je Mahlzeit eingegeben werden, der Eiweiß-Zusatz zusätzlich als g Aptamil-Eiweiß+-Pulver je Mahlzeit oder ml Eiweißlösung je Mahlzeit (neben g/100 ml und g/kg/d). Die Konzentration ergibt sich aus dem Nahrungsvolumen je Mahlzeit (`fm85PercentFromDose`, `proteinAddPer100mlFromDose`); `calculate()` erhält weiter % bzw. g/100 ml, die Grenzen (z. B. FM85 6 %) gelten für den umgerechneten Wert. Unter den Feldern steht die Umrechnung, die Zubereitungs-Kachel nennt FM85 zusätzlich in ml 50-%-Lösung je Mahlzeit und pro Tag (Gegenprobe Verordnung: 0,24 ml je 12 ml, 2,88 ml/d), die Energie je 100 ml und den **Spielraum bis zur Eiweiß-Obergrenze** (4,5 g/kg/d minus aktuelle Gesamtzufuhr) als g/kg/d, als zusätzliche g Eiweiß je 100 ml und als zusätzliche FM85-Prozent. Vorlagen stellen % und g/100 ml zurück | Entscheidung 31.10.2026 (Neonatologe: Verordnung zeigt nur Mengen je Mahlzeit) | `calculator.js` (`FM85_SOLUTION`, `preparation`), `index.html` (`input-fm85-unit`) | AL1–AL11, V5 |
| 10.11 | **Aus dem Stations-Excel (01.11.2026, Punkte 17.16–17.22) ist nur Neocate übernommen:** 67 kcal, 1,8 g Eiweiß, 3,4 g Fett, 7,2 g Kohlenhydrate je 100 ml, in der Auswahl mit dem Zusatz „(Stations-Excel)“, nicht an der Packung geprüft, Natrium und Mineralstoffe nicht hinterlegt (zählen 0). Auf Anweisung des Neonatologen **nicht** übernommen: Aptamil HA Pre, Aptamil AR, Primergen, Frühkarotten, die Einheit „g Pulver je 100 ml“ und die Mineralstoff-Korrekturen (Muttermilch-Phosphor 15,5 statt 32 mg, Beba FG 1 Calcium 116 und Phosphor 77 mg); sie bleiben als offene Punkte 17.18 bis 17.22 stehen | Entscheidung 01.11.2026 („nur Neocate“) | `products.js`, `_enteralDensity`, `index.html` | AM1–AM4 |
| 10.12 | **Keine Anreicherungs-Empfehlung bei erreichter Energieobergrenze:** Liegt die Energie bei **rein enteraler Ernährung** (keine parenterale Energie) ab Lebenstag 4 an oder über der Obergrenze des Zielbereichs (ab Tag 4: 140 kcal/kg/d), entfallen die Empfehlungen zu mehr Anreicherung: „vorrangig Anreicherung statt Volumen steigern“ (stattdessen der Satz „Die Energie liegt bereits an der Obergrenze … keine weitere Anreicherung“), „FM85 Start-Kriterium“, „Fortifizierung (FM85) empfohlen“, „Monat 2+ … Fortifizierung auf 4 % empfohlen“, das Fazit „FM85-Fortifizierung starten“ und der Zusatz „Fortifizierung prüfen“ bei Wachstumsstagnation. Läuft noch PN, bleiben die Empfehlungen (die PN-Energie sinkt beim Ausschleichen). Die Warnung „Energie über Zielbereich“ bleibt. Anlass: Kind mit 195 ml/kg/d, FM85 1 %, 149 kcal/kg/d bekam gleichzeitig „Anreicherung steigern“ und „Überernährung prüfen“ | Entscheidung 01.11.2026 | `_energyAtLimit`, Hinweise im Rechenkern | AN1–AN6 |
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
| 11.9 | **FM85 wirkt nur auf Muttermilch, Zusammensetzung nach Packung** (je 100 g Pulver: 435 kcal, 35,5 g Eiweiß, 18,1 g Fett, 32,4 g Kohlenhydrate, 918 mg Natrium, 1890 mg Calcium, 1095 mg Phosphor). Je 1 % (= 1 g auf 100 ml; 4 % = 1 g auf 25 ml): +0,355 g Eiweiß, +4,35 kcal, +0,181 g Fett, +0,324 g Kohlenhydrate, +9,18 mg Na, +18,9 mg Ca, +10,95 mg P je 100 ml. Vorher 0,4675 g Eiweiß und 3,5 kcal je 1 %, was das Eiweiß um rund 30 % zu hoch und die Energie zu niedrig rechnete | Entscheidung 20.10.2026 (Packungsangabe) | `FM85_PER_PERCENT`, `products.js` | AB1–AB4, Q14–Q21 |
| 11.10 | Basis EBM je 100 ml: 71 kcal, 1,13 g Protein, 4,03 g Fett, 7,0 g KH, 7 mg Na, 28 mg Ca, 32 mg P | Haus | `calculate`, `products.js` | – |
| 11.11 | **Bei Formelnahrung wird ein stehendes FM85-Feld ignoriert**, die Zubereitung zeigt 0 g, ein Hinweis erscheint | Entscheidung 01.10.2026 | `fm85Ignoriert` | S7, S7b |
| 11.12 | **FM85-Empfehlungen** (Erinnerung ab 50 ml/kg/d, Start-Kriterium ab 100 ml/kg/d, Titrationsplan auf 4 %, Fazit-Zeile, Hinweis ab Tag 28) nur bei **Geburtsgewicht < 1800 g** | Entscheidung 02.10.2026, Geltungsbereich ESPGHAN 2022 | `FORTIFIER.maxBirthWeight` | T7, T8 |
| 11.13 | FM85 bei enteral < 100 ml/kg/d → Hinweis; Voraussetzungs-Erinnerung (stabiles Abdomen, > 5–7 Tage toleriert) | Haus | `calculate` | – |
| 11.14 | Zielkonzentration wird eingegeben (g Eiweiß/100 ml, FM85 in 0,5-%-Schritten); Aptamil Eiweiß+: 82,1 g Protein je 100 g Pulver, 338 kcal; Zielkonzentration hat Vorrang | Entscheidung (v3.4) | `calculate` | Q15–Q19 |
| 11.14a | **Eiweißlösung der Station: 1 g Eiweiß = 1 ml.** Die Zubereitung nennt das Zusatz-Eiweiß in g und das Volumen der Lösung je Mahlzeit und pro Tag. Die Zeile „Nahrung: … ml je Mahlzeit“ meint die Milchmenge, nicht das Eiweiß. Das Pulver bleibt als zweite Zeile | Entscheidung 20.10.2026 | `PROTEIN_SOLUTION`, `results.preparation` | U1–U3 |
| 11.14b | **Eiweiß-Zusatz in zwei Einheiten** über eine Auswahl am Eingabefeld: **g/100 ml** (Hauptform, die Station steigert in der Regel bis 2 g/100 ml) oder **g Eiweiß/kg/d**. Vorrang: g/100 ml, dann g/kg/d, dann direkte Pulvereingabe. Grenzen: g/100 ml 0–3, g/kg/d 0–5. Zusatz ohne enterale Nahrung → Hinweis | Entscheidung 20.10.2026 | `proteinAddGKg`, `proteinAddPer100ml` | V1–V5, Q16–Q19 |
| 11.15 | Liquigen: 4,5 kcal/ml, 0,5 g Fett/ml. Supplement-Volumen erhöht die Gesamtflüssigkeit **nicht** | Haus | `calculate` Step 7b | N15–N20 |
| 11.16 | Harnstoff < 3 mmol/l bei enteral ≥ 100 → Hinweis (Eiweißmangel); > 8 mmol/l → Hinweis (Eiweiß prüfen) | Haus, **Offen** (17.4) | `calculate` | – |
| 11.17 | Wachstumsrate = (Gewicht − Vortag) / Gewicht × 1000 g/kg/d; ab Tag 28 unter 15 → Hinweis (Bezeichnung „Wachstumsrate“) | Leitlinie | `calculateGrowthVelocity` | E1 |

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

## 16a. Darstellung und Priorisierung von Meldungen (v3.6)

Ziel: wenige, eindeutige Signale statt vieler gleichfarbiger Zeilen (Alarmmüdigkeit). Alle Meldungen
bleiben im vollen Wortlaut erhalten; es wird nur gestaffelt, nie unterdrückt.

| ID | Regel | Status | Code | Test |
|---|---|---|---|---|
| 16a.1 | **Vier Stufen:** kritisch (`CRITICAL:`), Warnung (`Warnung:`), Hinweis (`Hinweis:` und alles Übrige), Erinnerung (💡). Die Stufe ergibt sich aus dem **Präfix des Meldungstextes**; neue Meldungen müssen mit einem dieser Präfixe beginnen | Entscheidung 20.10.2026 | `_buildAlerts` | Y2 |
| 16a.2 | **Kritisch ist immer vollständig sichtbar**, nie eingeklappt, mit `role="alert"` | Entscheidung 20.10.2026 | `renderFindings` | Z1 |
| 16a.3 | **Warnungen:** die ersten 3 sichtbar, weitere unter „n weitere Warnungen“. Hinweise und Erinnerungen eingeklappt, je Zeile aufklappbar | Entscheidung 20.10.2026 | `renderFindings` | Z2, Z3 |
| 16a.4 | Reihenfolge: Stufe, dann Bereich (Wachstum, Glukose & PN, Elektrolyte, Enteral, Flüssigkeit, Eiweiß & Energie) | Haus | `_buildAlerts` | Y2 |
| 16a.5 | Eine Stufe ist immer an **Symbol, Text und Farbe** erkennbar (⛔ kritisch, ⚠ Warnung, ℹ Hinweis), nie nur an der Farbe | Entscheidung 20.10.2026 | CSS `.f-*` | Z6 |
| 16a.6 | Zähler oben nennen die Anzahl je Stufe; gibt es keine Befunde, steht „✓ Keine Befunde“ | Entscheidung 20.10.2026 | `renderFindings` | Z2 |
| 16a.7 | **Nächste Schritte** (bisher „Klinisches Fazit“): höchstens 3 Handlungen, ohne Wiederholung der kritischen Meldungen | Entscheidung 20.10.2026 | `renderFindings` | Z4 |
| 16a.8 | Ein Satz wird in Titel (bis zum ersten Gedankenstrich oder Satzende) und Detail zerlegt; der Bereich folgt dem **Titel**, eindeutige Leitbegriffe (z. B. Hypernatriämie) gelten über den ganzen Text | Entscheidung 20.10.2026 | `_buildAlerts` | Y4–Y6 |
| 16a.9 | Der Toleranz-Vorbehalt beim Steigerungshinweis bleibt im vollen Wortlaut erhalten, auch wenn die Zeile eingeklappt ist | Entscheidung (v3.1) | `_buildAlerts` | Y7, N7 |
| 16a.10 | Entfallen sind die getrennten Listen (Warnliste, Erinnerungsbox, Empfehlungsbox, Fazit-Karte) und die Bullets der Beurteilung. Alles steht in einem Bereich der Beurteilungskarte | Entscheidung 20.10.2026 | `index.html` | Z5 |
| 16a.11 | „Im Ziel“-Zeile ersetzt die einzelnen grünen Positiv-Meldungen | Entscheidung 20.10.2026 | `renderFindings` | – |
| 16a.12 | Nur in der Oberfläche berechnet: Wachstumsrate > 30 g/kg/d → kritisch (Ödem, Plausibilität). Beeinflusst `isSafe` nicht | Haus | `renderFindings` | – |

## 17. Offene Punkte (brauchen eine Entscheidung)

| Nr. | Punkt | Stand |
|---|---|---|
| 17.1 | ~~P:AA-Warnung~~ | **entschieden 20.10.2026: entfällt** (siehe 10.2) |
| 17.2 | **Osteopenie-Hinweise (10.5)**: Calcium und Phosphat steuern Sie über den Urin am Dienstag. Sollen die Zufuhr-Hinweise entfallen? | offen |
| 17.3 | **Rechengewicht (3.1)**: Tag-10-Sprung. Immer aktuelles Gewicht, oder Geburtsgewicht bis es wieder erreicht ist? | offen |
| 17.4 | **Harnstoff (11.16)**: Haus-Grenze > 8 mmol/l, ESPGHAN 2022 nennt > 5,7 mmol/l als Anlass, die Proteinzufuhr zu senken | offen |
| 17.5 | **Protein-Ziel und Aufbau (6.4)**: Soll die Protein-Ampel erst gelten, wenn enteral aufgebaut wird? Die Regel „Protein erst beim enteralen Aufbau“ ist in den Projektdokumenten nicht auffindbar | Passage aus dem Protokoll nötig |
| 17.6 | **Kalium-Schwere (9.5, 9.6)**: aktuell Warnung. Soll es CRITICAL sein? Soll enterales Kalium mitgerechnet werden? | offen |
| 17.7 | **Geschlecht (13.6)** für Perzentile und SGA | zurückgestellt |
| 17.8 | **Protein-Obergrenze 4,5 g/kg/d für Reife** (6.2): in ESPGHAN 2022 nicht geregelt (nur < 1800 g) | Quelle fehlt |
| 17.9 | **Energie- und Protein-Ziele für Reife** (5.1, 6.1): Leitlinienwerte für Reife nicht belegt | Quelle fehlt |
| 17.10 | ~~FM85-Zusammensetzung~~ | **entschieden 20.10.2026:** Packungswerte übernommen (siehe 11.9). Folge: Der Standardverlauf EBM + FM85 4 % ist nicht mehr dauerhaft kritisch; die Energie begrenzt das Volumen bei 4 % auf 150 ml/kg/d |
| 17.11 | **Sterofundin ISO (9a)**: Zusammensetzung aus meinem Wissen eingetragen, **nicht an der Packung geprüft**. Bitte mit dem Etikett abgleichen. Ist eine andere Sterofundin-Variante im Einsatz (z. B. mit Glucose oder Halbelektrolyt), fehlt sie noch | Packungswerte nötig |
| 17.12 | ~~Osmolarität bei Sekundärinfusion~~ **erledigt 23.10.2026** (Regeln 9a.6–9a.9). Die stehengebliebenen PN-Felder leert die App jetzt selbst über die Auswahl „Keine parenterale Ernährung“ | erledigt |
| 17.13 | ~~NPC/P bei gemischter Ernährung~~ **erledigt 23.10.2026** durch Wegfall der Obergrenze (Regel 10.3). Offen bleibt: Soll die Untergrenze 20 für „zu knapp“ an einer Quelle belegt werden (ESPGHAN-Volltext lag nicht vor)? | erledigt / Quelle offen |
| 17.14 | ~~Triglyzeride und Lipiddosis~~ **erledigt 23.10.2026** durch Regel 10.6. Offen: Die Schwellen 200/250 mg/dl der App sind nicht an der Leitlinie belegt (Volltext der ESPGHAN-Lipidleitlinie lag nicht vor) | erledigt / Quelle offen |
| 17.15 | **FM85-Lösung der Station**: Die Umrechnung nimmt 1 ml „Beba FM85 50 % Lösung“ = 0,5 g Pulver an (50 g auf 100 ml). Gegenprobe: 0,24 ml je 12-ml-Mahlzeit sind 1 % und passen zur Verordnung (2,88 ml/d bei 144 ml/d). **Packungsbeilage (vom Neonatologen übermittelt 01.11.2026):** bestätigt die Standardauflösung 1 g Pulver auf 25 ml Frauenmilch (= 4 %, Regel 11.9) und „eine individuell errechnete Menge, die dein Arzt verschrieben hat“; die **50-%-Lösung kommt darin nicht vor**, ihre Konzentration bleibt also eine Annahme und ist an der Apothekenzubereitung zu bestätigen. Die Beilage fordert außerdem, die Nahrung vor jeder Mahlzeit frisch zuzubereiten, Reste zu verwerfen und das Pulver nur mit dem beiliegenden, abgestrichenen Messlöffel abzumessen; Dose nach dem Öffnen innerhalb von 3 Wochen aufbrauchen | Standard bestätigt, Lösung zu bestätigen |
| 17.16 | **Stations-Excel „FG-Plan Zeitleiste“ (2022), Blatt „Nahrung“, ausgewertet am 01.11.2026.** Eingaben: aktuelles Gewicht, Mahlzeiten pro Tag, Portion (ml), Nahrung, Aptamil Eiweiß (g Pulver je 100 ml Milch), FM85 (g je 100 ml Milch), Frühkarotten (ml je Mahlzeit), Liquigen (ml). Ausgaben: enterales Volumen (ml/d, ml/kg/d), Energie, Eiweiß, Kohlenhydrate, Fett (g/kg/d), Calcium, Phosphat (mmol/kg/d). Beispiel im Blatt: 800 g, 12 × 12 ml Muttermilch, Aptamil 1, FM85 1 → 180 ml/kg/d, 132,6 kcal/kg/d, Eiweiß 4,17 g/kg/d | dokumentiert |
| 17.17 | **Rechenfehler im Excel (nicht in der App):** Die Beiträge von Aptamil, FM85, Liquigen und Frühkarotten werden pro Tag statt pro kg zu den g/kg/d addiert (nur der Milchanteil wird durch das Gewicht geteilt). Die Zusätze sind damit um den Faktor Gewicht in kg zu klein: bei 800 g um 20 %, bei 1,6 kg um 38 %. Im Beispiel Eiweiß 4,17 statt 4,54 g/kg/d mit den eigenen Konstanten. Außerdem zählt das Liquigen-Volumen dort zum enteralen Volumen und die Frühkarotten ml je Mahlzeit ebenfalls | dem Neonatologen mitgeteilt |
| 17.18 | **Muttermilch: Stations-Excel 1,5 g Eiweiß, 3,8 g Fett, 7,0 g KH, 68,2 kcal je 100 ml (Ca 0,64 mmol, P 0,5 mmol) gegen App 1,13 g Eiweiß, 4,03 g Fett, 7,0 g KH, 71 kcal (Ca 28 mg, P 32 mg).** Entscheidung 01.11.2026: **1,13 g Eiweiß bleibt.** Für die Veröffentlichung fehlt aber der Beleg: In Code, Regelwerk und Spezifikation ist keine Quelle genannt (Wert seit dem ersten Upload im Repository). Literatur (Gidrewicz und Fenton 2014, BMC Pediatr 14:216, doi:10.1186/1471-2431-14-216, Frühgeborenenmilch, gemessenes Eiweiß): Woche 2 1,5; Woche 3/4 1,4; Woche 5–12 1,1 g/100 ml. 71 kcal entsprechen dort Tag 4–14 (71 kcal, gemessen). Fett 4,03 g (Studie: 3,5 g) und Phosphor 32 mg (Studie: 12–15 mg) sind dort nicht gedeckt. **Offen:** belegbare Quelle eintragen oder Werte an die Literatur angleichen | beibehalten, Quelle offen |
| 17.19 | **FM85 im Excel entspricht der alten Rezeptur** (347 kcal, 20 g Eiweiß, 66 g KH, 0,4 g Fett je 100 g; Ca 0,375, P 0,29 mmol/g). Die App rechnet nach aktueller Packungsangabe (Regel 11.9: 435 kcal, 35,5 g Eiweiß, 32,4 g KH, 18,1 g Fett). Aptamil Eiweiß+ stimmt überein (338 kcal, 82,1 g Eiweiß, 2,2 g KH, 0,1 g Fett je 100 g). Das Excel sollte aktualisiert werden | Excel veraltet |
| 17.20 | **Produkte nur im Excel (Werte je 100 ml, aus dem Excel, nicht an der Packung geprüft):** Aptamil HA Pre 66 kcal, 1,5 g Eiweiß, 3,4 g Fett, 7,2 g KH; Aptamil AR Komplettnahrung 66 kcal, 1,6 g, 3,5 g, 6,8 g (Ca 77, P 43 mg); Neocate 67 kcal, 1,8 g, 3,4 g, 7,2 g; „Primergen, Aptamil“ 62 kcal, **0,7 g Eiweiß** (wirkt zu niedrig, vermutlich Tippfehler), 3,6 g, 6,4 g; Frühkarotten je 100 ml 39 kcal, 0,8 g Eiweiß, 1,0 g Fett, 5,5 g KH. Soll das in die App? Frühkarotten und Liquigen als Volumen zusätzlich oder in der Mahlzeit enthalten? | zu entscheiden |
| 17.21 | **Mögliche Datenverwechslung in `products.js`:** Beba FG 1 hat dort 116 mg Phosphor, im Excel stehen 116 für Calcium und 77 für Phosphat; Beba FG 2 hat 77 mg Phosphor. Bitte an der Packung prüfen | zu prüfen |
| 17.22 | **Eingabe Aptamil Eiweiß+ wie im Excel** (g Pulver je 100 ml Milch): 1 entspricht 0,82 g Eiweiß/100 ml der App. Als zusätzliche Einheit denkbar | Vorschlag |

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
| 23.10.2026 | Sterofundin ISO als Sekundärinfusion; NaCl-Natrium je 100 ml korrigiert (war zehnfach zu hoch) |
| 23.10.2026 | PN-Osmolarität und Glukosekonzentration nur aus dem PN-Beutel; Eigenosmolarität der Sekundärlösung; Ursachenzeile bei zu kleinem PN-Volumen (Regeln 9a.6–9a.8) |
| 20.10.2026 | FM85 nach Packungsangabe gerechnet (35,5 g Eiweiß und 435 kcal je 100 g); damit entfällt die dauerhaft kritische Eiweißmeldung im Standardverlauf |
| 20.10.2026 | P:AA-Warnung entfällt (Wert bleibt sichtbar). Alle sichtbaren Beschriftungen auf Deutsch: „In Akte kopieren“, „Auf einen Blick“, „Startwerte“, „Energiedefizit-Index“, „Wachstumsrate“, „PDF-Export“, „Zurücksetzen“ |
| 20.10.2026 | Meldungen gestaffelt: eine Hierarchie, kritisch immer sichtbar, Warnungen begrenzt, Hinweise und Erinnerungen eingeklappt; Fazit-Karte und Einzellisten entfallen |
| 20.10.2026 | Versionswächter gegen veralteten Rechenkern (Anlass: neue Oberfläche mit alter `calculator.js` zeigte „undefined“ und ignorierte g/kg/d stumm) |
| 20.10.2026 | Eiweiß-Zusatz wahlweise in g/100 ml (Hauptform) oder g/kg/d |
| 20.10.2026 | Zubereitung zeigt die Eiweißlösung (1 g = 1 ml) in ml; Milchzeile eindeutig als „Nahrung“ benannt. Anlass: 3,3 ml Nahrung je Mahlzeit wurden als Eiweißmenge gelesen |
| 02.10.2026 | Ca:P entfällt. Beatmungs-CRITICAL bleibt. Kalium: Warnung bei hoher Zufuhr, kaliumfreie Tage 1–2. Vitamin-D-/Proprems-Grenze (3 ml absolut) bleibt. Nur mit realem Gewicht rechnen. Hypoglykämie ist CRITICAL. SGA-Erkennung ja, Phototherapie nein. Geschlecht zurückgestellt. FM85-Empfehlungen nur bei < 1800 g. Energie-Obergrenze des enteralen Ziels erst ab Tag 4 |
| 23.10.2026 | Auswahl „Keine parenterale Ernährung“ leert und sperrt die PN-Felder (Regel 9a.9), Version 3.6.4 |
| 23.10.2026 | „Keine parenterale Ernährung“ lässt die Lipide unberührt (Rückmeldung: manche Kinder erhalten Lipide ohne PN-Lösung), Version 3.6.5 |
| 23.10.2026 | NPC/P-Warnungen (unter 20, über 40) nur noch bei laufender PN; Muttermilch allein meldet kein „Verfettungsrisiko“ mehr (Regel 10.3, Version 3.6.6) |
| 23.10.2026 | „Verfettungsrisiko“ (NPC/P über 40) nur noch bei Lipiden i. v.; „Energie zu knapp“ (unter 20) bei laufender PN (Regel 10.3, Version 3.6.7) |
| 23.10.2026 | „Verfettungsrisiko“ (NPC/P über 40) entfällt nach Literaturrecherche; Wert bleibt sichtbar, „zu knapp“ bei PN bleibt (Regel 10.3, Version 3.6.8) |
| 23.10.2026 | Lipid-Anteil an NPC auf Gesamtenergie bezogen, Regel 25–50 % nur bei vollständiger PN (enteral unter 25 ml/kg/d), laut Leitlinie 2018; Version 3.6.10 (Regel 10.5) |
| 23.10.2026 | Triglyzerid-Kontrollhinweis bei Lipiden i. v. über 3 g/kg/d bzw. bei Geburtsgewicht bis 1000 g ab 2 g/kg/d ohne eingetragenen Wert (Regel 10.6, Version 3.6.11) |
| 31.10.2026 | Enterales Volumen: Umrechnung (Tagesmenge, Menge je Mahlzeit, Rechengewicht) unter dem Eingabefeld; Lipide ohne frei verfügbares Volumen werden nicht gerechnet (Regeln 10.7, 10.8, Version 3.6.12) |
| 31.10.2026 | Mengenfelder mit Einheiten-Auswahl (ml/Tag, ml/h, ml je Mahlzeit), gemeinsames Rechengewicht für Umrechnung und Sekundärinfusion (Regel 10.9, Version 3.6.13) |
| 31.10.2026 | FM85 und Eiweiß-Zusatz als Dosis je Mahlzeit eingebbar (ml 50-%-Lösung, g Pulver, ml Eiweißlösung), Zubereitung mit ml Lösung, Energie je 100 ml und Eiweiß-Spielraum (Regel 10.10, Version 3.6.14)  |
| 01.11.2026 | Packungsbeilage FM85 ausgewertet: Standard 1 g auf 25 ml (= 4 %) bestätigt, Konzentration der 50-%-Lösung weiter offen (Punkt 17.15) |
| 01.11.2026 | Stations-Excel (Blatt Nahrung) ausgewertet, Abweichungen und Rechenfehler als offene Punkte 17.16 bis 17.22 festgehalten |
| 01.11.2026 | Aus dem Stations-Excel nur Neocate übernommen, alles andere bleibt offen (Regel 10.11, Version 3.6.15) |
| 01.11.2026 | Keine Anreicherungs-Empfehlung mehr, wenn die Energie bei rein enteraler Ernährung an der Obergrenze liegt (Regel 10.12, Version 3.6.16) |
| 01.11.2026 | Energieobergrenze ab Tag 4 von 135 auf 140 kcal/kg/d angehoben (ESPGHAN 2022: 115–140), Muttermilch-Eiweiß 1,13 g/100 ml beibehalten, Beleg fehlt (Regel 5.1, Punkt 17.18, Version 3.6.17). Tests O2, AN1–AN6 mit Begründung angepasst |
