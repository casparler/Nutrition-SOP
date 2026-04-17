# NeoNutri V11 - Benutzerhandbuch & Klinische Referenz

**Version:** 2.0 | **Master Logic:** V11  
**Zielgruppe:** Neonatologen, Ärzte in Weiterbildung, NICU-Pflegepersonal  
**Basis:** ESPGHAN 2018/2022, Level-1-NICU Hausstandard 2026

---

## 📋 Inhaltsverzeichnis

1. [Die Hierarchie des Dashboards (Visual Guide)](#1-die-hierarchie-des-dashboards-visual-guide)
2. [Das "PN-Restvolumen"-Konzept (Logik-Erklärung)](#2-das-pn-restvolumen-konzept-logik-erklärung)
3. [Klinische Parameter für Experten](#3-klinische-parameter-für-experten)
4. [Der Virtual NICU Simulator](#4-der-virtual-nicu-simulator)
5. [Fehlerbehebung & Warnungen](#5-fehlerbehebung--warnungen)
6. [Workflow für die tägliche Visite](#6-workflow-für-die-tägliche-visite)
7. [Cheatsheet (Schnellreferenz)](#7-cheatsheet-schnellreferenz)

---

## 1. Die Hierarchie des Dashboards (Visual Guide)

### 1.1 Quick View (Obere Leiste) — Die 3 wichtigsten Indikatoren

Die **Quick View** zeigt auf einen Blick den Ernährungs- und Sicherheitsstatus:

| **Indikator** | **Was zeigt er?** | **Warum wichtig?** |
|--------------|-------------------|-------------------|
| **Weight Velocity** | Gewichtszunahme in g/kg/d | **Gold-Standard für Wachstum:** Ziel 15–20 g/kg/d (ESPGHAN). Niedriger Wert → Unterernährung. Über 25 g/kg/d → Überfütterung/Ödem. |
| **Gesamt-Energie** | Total kcal/kg/d (PN + Enteral) | **Energie-Bilanz:** Zentrale Determinante für Wachstum. Tag 1: 45–60, Tag 4+: 110–135 kcal/kg/d. |
| **Sicherheitsstatus** | 🟢 Sicher / 🔴 Kritisch | **Ampel-System:** Grün = alle Parameter im sicheren Bereich. Rot = mind. 1 kritischer Grenzwert überschritten (z.B. GIR > 12, Osm > 900). |

**Klinische Philosophie:**  
- Wenn **Sicherheit = GRÜN** und **Energie ≥ 110 kcal** und **WV ≈ 15 g/kg/d** → Plan ist optimal.
- Wenn **ROT** → sofortige Intervention erforderlich (siehe Abschnitt 5).

---

### 1.2 Das Accordion-Prinzip — Warum Details eingeklappt sind

**Problemstellung:** Ein NICU-Dashboard muss **schnell überfliegbar** sein (für Notfall-Situationen), aber auch **detailliert genug** für die gezielte Optimierung.

**Lösung: Accordion-Design**

```
┌─────────────────────────────────────┐
│ IMMER SICHTBAR:                     │
│ • Gesamtenergie                     │
│ • Protein gesamt                    │
│ • GIR, Osmolarität                  │
│ • Sicherheits-Badge                 │
└─────────────────────────────────────┘
           ▼ (bei Bedarf)
┌─────────────────────────────────────┐
│ EINGEKLAPPT (Details):              │
│ • Mikronährstoffe (Zn, Cu, Se)      │
│ • Elektrolyte (Na, K, Cl, SID)      │
│ • Ca/P-Details (mmol-Umrechnung)    │
│ • Fenton Z-Scores                   │
└─────────────────────────────────────┘
```

**Eingeklappte Bereiche:**

1. **🍼 Enterale Ernährung:** FM85-Prozent, Mahlzeiten-Frequenz, Inhaltsstoffe (Protein, Fett, Carbs enteral).
2. **💉 Spülflüssigkeit / Perfusor-Träger:** Antibiotika-Trägervolumen, das vom PN-Volumen abgezogen wird.
3. **💊 Mikronährstoffe:** Soluvit, Vitalipid, Peditrace-Volumen (subtrahiert von PN).
4. **⚡ Elektrolyte & Mineralien:** NaCl/KCl-Zusätze, Hidden Sodium Buffer (für "versteckte" Na-Last aus Medikamenten).
5. **💎 Calcium & Phosphat (Details):** Umrechnung mg/kg ↔ mmol/kg, Ca:P-Ratio, Löslichkeitscheck.

**Warum?**  
→ **Cognitive Load Reduction:** Fokus auf das Wesentliche. Details nur bei Optimierung (z.B. Ca:P-Ratio-Warnung → Accordion öffnen → exakte mmol-Werte sehen).

---

## 2. Das "PN-Restvolumen"-Konzept (Logik-Erklärung)

### 2.1 Das fundamentale Prinzip der Volumen-Subtraktion

**Zentrale Formel:**

```
PN-Restvolumen (Netto) = TFI 
                         − Enteral 
                         − Spülflüssigkeit 
                         − Sekundärinfusion 
                         − Mikronährstoff-Volumen
                         − Lipid-Volumen
```

**Schritt-für-Schritt-Beispiel (1 kg Frühgeborenes, Tag 3):**

| Parameter | Wert | Berechnung |
|-----------|------|------------|
| **TFI** | 120 ml/kg/d | = 120 ml Gesamtflüssigkeit |
| **Enteral** | 20 ml/kg/d | = 20 ml Sondenkost |
| **Spülflüssigkeit** | 5 ml/kg/d | = 5 ml Perfusor-Träger (z.B. Ampicillin) |
| **Sekundärinfusion** | 0 ml/kg/d | = 0 ml |
| **Mikronährstoffe** | 6 ml/kg/d | = 6 ml (Soluvit 1ml + Vitalipid 4ml + Peditrace 1ml) |
| **Lipide** | 50 ml | = 2 g/kg ÷ 0.2 g/ml = 10 ml (SMOFlipid 20%) |
| → **PN-Restvolumen** | **89 ml** | 120 − 20 − 5 − 0 − 6 − 10 = **89 ml Trägerlösung** |

**Was passiert mit dem PN-Restvolumen?**  
→ Dieses Volumen wird mit der **Basislösung** (z.B. Basislösung FG) infundiert. Die Nährstoffe (AS, Glukose, Na, K, Ca, P) werden proportional zur Laufrate dosiert.

---

### 2.2 Warum sinkt das PN-Volumen, wenn ich die Spülflüssigkeit erhöhe?

**Klinisches Szenario:**  
Ein ELBW-Frühgeborenes erhält einen Perfusor mit Ampicillin (10 ml/kg/d als Träger). Der Arzt in Weiterbildung gibt dies als **zusätzliches Volumen** ein.

**Was passiert?**

```
VORHER (ohne Spülflüssigkeit):
TFI 100 ml − Enteral 10 ml = PN-Volumen 90 ml

NACHHER (Spülflüssigkeit 10 ml):
TFI 100 ml − Enteral 10 ml − Spülflüssigkeit 10 ml = PN-Volumen 80 ml
```

**Begründung: Vermeidung von Hyperhydratation**

- Das **TFI ist die Obergrenze** (z.B. 100 ml/kg/d bei ELBW Tag 1).
- Jedes zusätzliche Volumen (Medikamente, Spülungen) **konkurriert** mit der parenteralen Ernährung um dieses knappe Budget.
- Würde man die Spülflüssigkeit **zusätzlich** geben → TFI würde überschritten → Risiko für:
  - Periventrikuläre Leukomalazie (PVL)
  - Bronchopulmonale Dysplasie (BPD)
  - Offener Ductus arteriosus (PDA)

**Praktische Konsequenz:**  
→ Wenn die Spülflüssigkeit hoch ist (z.B. 20 ml/kg/d für Antibiotika + Sedierung), muss die enterale Ernährung aggressiv gesteigert werden, um die Nährstoffzufuhr zu kompensieren.

---

## 3. Klinische Parameter für Experten

### 3.1 P:AA Ratio (Phosphat-zu-Aminosäure-Verhältnis)

| **Was?** | **Warum wichtig?** | **Zielbereich** |
|----------|-------------------|-----------------|
| **mmol Phosphat / g Protein** | Verhindert **PIFS** (Phosphat-Insulin-Feedback-Syndrom) und Elektrolytshift bei Refeeding. | **≥ 1.0 mmol/g** |

**Pathophysiologie:**  
- Aminosäuren stimulieren **Anabolismus** → Protein-Synthese benötigt **Phosphat** (für ATP, DNA, Zellmembran-Phospholipide).
- Wenn P:AA < 1.0 → Phosphat wird aus dem Serum in die Zellen verschoben → **Hypophosphatämie** → Risiko für:
  - Respiratorische Insuffizienz (ATP-Mangel in Atemmuskulatur)
  - Herzrhythmusstörungen
  - Hämolyse

**Beispiel:**  
- Protein = 3.5 g/kg/d, Phosphat = 40 mg/kg/d → P:AA = (40 ÷ 30.97) ÷ 3.5 = **0.37 mmol/g** → **KRITISCH!**
- **Korrektur:** Phosphat auf 108 mg/kg erhöhen (= 3.5 mmol) → P:AA = 1.0 ✓

---

### 3.2 NPC/P Ratio (Non-Protein Calories pro Protein)

| **Was?** | **Warum wichtig?** | **Zielbereich** |
|----------|-------------------|-----------------|
| **(Glucose-kcal + Lipid-kcal) / g Protein** | Bestimmt, ob Protein für Anabolismus oder als Energiequelle verbrannt wird. | **20–30 kcal/g** |

**Klinische Interpretation:**

| **NPC/P** | **Bedeutung** | **Konsequenz** |
|-----------|---------------|---------------|
| **< 20** | Energie-Mangel → Protein wird verbrannt (Glukoneogenese) | **Katabolie:** Negative N-Bilanz, Muskel-Atrophie |
| **20–30** | **Optimal:** Protein wird für Wachstum genutzt | Positive N-Bilanz, Z-Score-Verbesserung |
| **> 40** | Energie-Überschuss bei moderatem Protein | **Verfettung:** Übermäßige Lipogenese, erhöhtes TG |

**Beispiel:**  
- NPC = 80 kcal/kg (Glucose 50 + Lipid 30), Protein = 4.0 g/kg → NPC/P = **20 kcal/g** ✓
- Wenn NPC/P = 15 → Protein um 1 g/kg reduzieren ODER Energie um 20 kcal/kg steigern.

---

### 3.3 SID-light (Strong Ion Difference) — Na:Cl Ratio

| **Was?** | **Warum wichtig?** | **Zielbereich** |
|----------|-------------------|-----------------|
| **SID = (Na + K) − Cl [mmol/kg/d]** | Proxy für metabolische Azidose-Gefahr (Stewart-Ansatz). | **SID > 0**, **Na:Cl 1.0–1.4** |

**Pathophysiologie:**  
- **Hyperchlorämie** (Cl > Na) → SID negativ → **metabolische Azidose** → kompensatorische Hyperventilation → erhöhter O₂-Verbrauch.
- Häufige Ursache: NaCl 0.9% (154 mmol Na **und** 154 mmol Cl) als Sekundärinfusion.

**Klinische Warnung:**

| **SID** | **Na:Cl Ratio** | **Interpretation** | **Aktion** |
|---------|-----------------|-------------------|------------|
| **< 0** | < 1.0 | **KRITISCH:** Hyperchlorämische Azidose | NaCl durch Glucose 5% ersetzen, Acetat-Puffer erwägen |
| **0–10** | 1.0–1.2 | Akzeptabel | Monitoring |
| **> 20** | > 1.5 | Metabolische Alkalose-Risiko | K-Zufuhr prüfen |

**Beispiel:**  
- Na = 3.5 mmol/kg, K = 2.0 mmol/kg, Cl = 6.0 mmol/kg → SID = (3.5 + 2.0) − 6.0 = **−0.5** → **AZIDOSE-RISIKO!**

---

### 3.4 Fenton Z-Scores — Interpretation über Perzentilen hinaus

| **Was?** | **Warum besser als Perzentilen?** | **Interpretation** |
|----------|-----------------------------------|-------------------|
| **Standardabweichung vom Median** | Z-Score = kontinuierliche Variable → bessere Trendbeobachtung. | **-2 bis +2 SD = normal** |

**Vergleich:**

| **Perzentile** | **Z-Score** | **Klinische Bedeutung** |
|---------------|-------------|------------------------|
| 3. Perz. | −2.0 SD | Grenze SGA (Small for Gestational Age) |
| 10. Perz. | −1.3 SD | Leichte Wachstumsrestriktion |
| 50. Perz. | 0 SD | Median |
| 90. Perz. | +1.3 SD | LGA (Large for Gestational Age) |
| 97. Perz. | +2.0 SD | Deutlich LGA |

**Klinischer Nutzen von Z-Scores:**

1. **Trendbeobachtung:** Z-Score sinkt von −1.0 auf −2.5 über 2 Wochen → **Postnatal Growth Restriction** → Fortifizierung intensivieren.
2. **Catch-up Growth:** Z-Score steigt von −2.5 auf −1.5 → Erfolgreiche Aufholwachstums-Strategie.
3. **Multidimensional:** Gewicht + Länge + Kopfumfang parallel betrachten (unverhältnismäßiger Kopfwachstum → Hydrozephalus?).

**In NeoNutri:**  
- Z-Scores werden automatisch berechnet, wenn Länge/Kopfumfang eingegeben werden (unter "Anthropometrie & Labor").
- Ausgabe unter "Mehr Details anzeigen" → Längen-Z-Score / KU-Z-Score.

---

## 4. Der Virtual NICU Simulator

### 4.1 Was ist der Simulator?

**Zweck:** Trainingstool für **Ärzte in Weiterbildung**, um typische NICU-Szenarien durchzuspielen **ohne Patientendaten** zu verwenden.

**3 vordefinierte Presets:**

| **Preset** | **Szenario** | **Lernziel** |
|------------|-------------|--------------|
| **🫀 ELBW Start (550g)** | Tag 1, nur Basislösung FG, 0 ml enteral, invasive Beatmung | Minimal-TFI, GIR-Eskalation, Hypoglykämie-Vermeidung |
| **🔄 Transition (1100g)** | Tag 5, PN + EBM 60 ml/kg, FM85 2%, SMOFlipid 2 g/kg | Hybrid-Ernährung, Fortifizierung, TG-Monitoring |
| **🍼 Full Enteral (2100g)** | Tag 14, 150 ml/kg EBM + FM85 4%, PN = 0 | Vollernährung, Supplement-Timing (Vit D, Proprems) |

---

### 4.2 Anleitung für die Nutzung

**Schritt 1: Preset laden**  
→ Klicken Sie auf einen der drei Buttons (z.B. "ELBW Start 550g").  
→ Alle Felder werden automatisch ausgefüllt + **Simulations-Modus-Badge** erscheint oben.

**Schritt 2: Validierungsbox öffnet sich**  
→ Zeigt **ESPGHAN-Zielwerte** und **Ist-Werte** im Vergleich (grün/gelb/rot).  
→ Beispiel-KPIs:
- Protein: 2.0 g/kg (Ziel 3.5–4.0) → **GELB** (Unterversorgung)
- Energie: 55 kcal/kg (Ziel 45–60) → **GRÜN**
- GIR: 6.0 mg/kg/min (Ziel 3–12) → **GRÜN**
- Ca:P Ratio: 1.6:1 (Ziel 1.5–1.7) → **GRÜN**

**Schritt 3: Parameter anpassen**  
→ Ändern Sie z.B. die Aminosäuren von 2.0 auf 3.0 g/kg.  
→ Validierungsbox aktualisiert in Echtzeit.

**Schritt 4: Klinisches Fazit lesen**  
→ Unten auf der Seite erscheint "Top 3 Optimierungen" (z.B. "Proteinzufuhr um 1.5 g/kg/d steigern").

**Schritt 5: Szenario wechseln oder Reset**  
→ "Reset"-Button oder neues Preset laden.

---

### 4.3 Typische Lernszenarien (Didaktik)

#### **Szenario A: ELBW Tag 1 — "Too Much Too Soon"**

**Aufgabe:** Erhöhen Sie die GIR von 6 auf 10 mg/kg/min und die Lipide auf 3 g/kg/d.

**Erwartete Beobachtung:**
- **WARNUNG:** "Lipid-Dosis über Tagesziel (1–2 g/kg/d) – TG-Kontrolle erforderlich."
- **Fazit:** Langsame Lipid-Eskalation ist besser toleriert (Tag 1: 1–2 g/kg, Tag 2: 2–3 g/kg, Tag 4: 3–4 g/kg).

---

#### **Szenario B: Transition Tag 5 — "The Ca:P Trap"**

**Aufgabe:** Reduzieren Sie das Phosphat von 40 auf 20 mg/kg/d (z.B. weil Glycophos nicht verfügbar ist).

**Erwartete Beobachtung:**
- **WARNUNG:** "Ca:P Verhältnis 2.5:1 außerhalb Zielbereich (1.5–2.0:1)."
- **WARNUNG:** "P:AA Ratio 0.5 mmol/g – Risiko für PIFS."
- **Fazit:** Calcium reduzieren oder Phosphat wiederherstellen.

---

#### **Szenario C: Full Enteral Tag 14 — "The Fortification Dilemma"**

**Aufgabe:** Setzen Sie FM85 auf 0% (z.B. weil Mutter ablehnt).

**Erwartete Beobachtung:**
- **HINWEIS:** "Protein 1.7 g/kg unter Zielbereich (3.0–3.5 g/kg)."
- **HINWEIS:** "Energie 107 kcal/kg unter Zielbereich (110–135 kcal/kg)."
- **Fazit:** Ohne Fortifizierung ist das Wachstumsziel bei reiner EBM nicht erreichbar.

---

## 5. Fehlerbehebung & Warnungen

### 5.1 Das Ampelsystem (Grün, Gelb, Rot)

**Visualisierung im Dashboard:**

```
┌────────────────────────────────────────┐
│  Sicherheitsstatus: 🟢 SICHER          │
│  → Alle Parameter im Zielbereich        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Sicherheitsstatus: 🟡 HINWEIS         │
│  → Defizit (z.B. Protein < 3.5 g/kg)    │
│  → Nicht akut gefährlich, aber suboptimal│
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  Sicherheitsstatus: 🔴 KRITISCH        │
│  → Grenzwert überschritten (z.B. GIR > 12)│
│  → SOFORTIGE INTERVENTION ERFORDERLICH  │
└────────────────────────────────────────┘
```

---

### 5.2 ROTE Alarme (Kritische Gefahr) — Was tun?

| **Warnung** | **Ursache** | **Sofortmaßnahme** |
|-------------|-------------|-------------------|
| **CRITICAL: GIR 13 mg/kg/min > 12** | Zu hohe Glukose-Infusionsrate | GIR auf 10–11 reduzieren, BZ-Kontrolle, ggf. Insulin |
| **CRITICAL: Osmolarität 950 mOsm/l > 900 (peripher)** | Konzentrierte Lösung bei peripherem Zugang | Auf ZVK wechseln ODER Lösung verdünnen (z.B. TFI erhöhen) |
| **CRITICAL: Glucose-Konz. 15% > 12,5% (peripher)** | Hochkonzentrierte Glukose | Glucose-Konzentration reduzieren, peripherer Zugang maximal 12.5% |
| **CRITICAL: Lipide 4.5 g/kg > 4.0** | Überdosierung | Lipid auf 3.0–3.5 g/kg reduzieren, TG-Kontrolle |
| **CRITICAL: Triglyzeride 280 mg/dl > 250** | Hypertriglyceridämie | Lipid-Pause oder auf 0.5–1.0 g/kg reduzieren (ESPGHAN) |
| **CRITICAL: TFI 150 ml/kg bei invasiver Beatmung** | Hyperhydratation-Risiko | TFI auf ≤ 140 ml/kg reduzieren (BPD/PDA-Prävention) |
| **CRITICAL: SID −2 mmol/kg — Azidose-Gefahr** | Hyperchlorämie | NaCl-Konzentrate reduzieren, Na-Acetat erwägen |
| **CRITICAL: Ausfällungsrisiko Ca+P 80 mmol/l** | Ca/P-Überdosierung | Ca ODER P reduzieren, Lösung verwerfen, neu ansetzen |

---

### 5.3 GELBE Hinweise (Warnung / Defizit) — Was prüfen?

| **Hinweis** | **Bedeutung** | **Nächste Schritte** |
|-------------|---------------|---------------------|
| **Protein 2.8 g/kg < 3.5 g/kg (ELBW Tag 4+)** | Unterversorgung | AS-Zufuhr steigern auf 3.5–4.0 g/kg/d |
| **Energie 95 kcal/kg < 110 (Tag 4+)** | Wachstumsphase-Defizit | Glukose oder Lipide erhöhen |
| **Harnstoff 2.5 mmol/l < 3.0 (enteral ≥ 100 ml/kg)** | Eiweiß-Katabolie bei Vollernährung | +0.5 g/kg Protein (Aptamil Eiweiß+) |
| **Ca:P Ratio 2.3:1 außerhalb 1.5–1.7** | Mineralstoff-Ungleichgewicht | Phosphat steigern (z.B. Glycophos 1 mmol/kg) |
| **Lipid-Anteil NPC 18% < 25%** | Metabolische Imbalance | Lipide erhöhen, Glucose-Anteil senken |
| **NPC/P 15 kcal/g < 20** | Protein wird energetisch verbrannt | Energie steigern (Glucose/Lipide) |
| **P:AA Ratio 0.7 mmol/g < 1.0** | PIFS-Risiko | Phosphat um ~30 mg/kg erhöhen |

---

### 5.4 Crystal Guard — Was ist die Löslichkeitswarnung?

**Problem:**  
Calcium und Phosphat können in der PN-Lösung **ausfallen** (Calciumphosphat-Präzipitat) → Katheter-Okklusion, Lungenembolie (!)

**Regel (vereinfacht):**  
`Ca (mmol/l) + P (mmol/l) < 72 mmol/l` (abhängig von pH, Temperatur, Aminosäuren).

**Warnung in NeoNutri:**
```
CRITICAL: Ausfällungsrisiko! Ca+P-Konzentration 78 mmol/l 
zu hoch für dieses Volumen (Limit 72 mmol/l).
```

**Sofortmaßnahme:**
1. **Lösung NICHT infundieren** (gegen das Licht halten → Trübung?).
2. **Volumen erhöhen** (z.B. TFI von 100 auf 120 ml/kg) → verdünnt Ca/P-Konzentration.
3. **ODER Ca/P reduzieren** (z.B. Ca von 50 auf 40 mg/kg).
4. Neue Lösung ansetzen lassen.

---

### 5.5 Fat-Finger Guard (Plausibilitäts-Check)

**Was ist das?**  
→ Automatische Erkennung von **Eingabefehlern** (z.B. TFI 500 ml/kg statt 50 ml/kg).

**Schwellenwerte (3-SD-Grenzen):**

| **Parameter** | **Plausibel** | **Unplausibel** |
|---------------|--------------|----------------|
| TFI | 30–200 ml/kg/d | < 30 oder > 200 |
| GIR | 1–18 mg/kg/min | < 1 oder > 18 |
| Gewicht | 200–6000 g | < 200 oder > 6000 |
| Protein | 0–6 g/kg/d | > 6 |
| Na | 0–10 mmol/kg/d | > 10 |

**Modal-Fenster:**  
→ Wenn Grenzwert überschritten: Pop-up "⚠️ Plausibilitäts-Check" mit Liste der auffälligen Werte.  
→ Button: "Klinisch plausibel ✓" (z.B. bei hydropsischem Kind mit 150 ml/kg TFI).

---

## 6. Workflow für die tägliche Visite

### 6.1 Schnellstart (5 Minuten pro Patient)

**1. Patientendaten eingeben**  
- Geburtsgewicht, aktuelles Gewicht, Gewicht gestern (für Weight Velocity)
- Tag (postnatal), SSW, invasive Beatmung (Checkbox)

**2. Volumen & Nahrung**  
- TFI (ml/kg/d)
- Enterales Volumen (ml/kg/d), Nahrungsart (EBM, Beba FG, etc.)
- FM85-Prozent (wenn EBM)

**3. Parenterale Ernährung**  
- **Entweder:** Basislösung auswählen (z.B. "Basislösung FG") → fertig!
- **Oder:** Manuelle Eingabe (GIR, AS, Ca, P, Na, K)
- Lipide (g/kg/d), Lipid-Typ (Standard 20% oder SMOFlipid 20%)

**4. Quick View prüfen**  
- Sicherheit GRÜN? → Gut.
- Energie im Zielbereich? → Gut.
- Weight Velocity ≥ 15 g/kg/d? → Gut.

**5. Klinisches Fazit lesen**  
- "Top 3 Optimierungen" → Notiz für morgen.

**6. PDF exportieren (optional)**  
- Button "PDF Export" → Dokumentation für Akte.

---

### 6.2 Erweiterte Optimierung (10–15 Minuten)

**Bei Warnungen (GELB/ROT):**

1. **Accordion "Elektrolyte & Mineralien" öffnen**  
   → Na/K/Cl-Bilanz prüfen, SID-light checken.

2. **Accordion "Calcium & Phosphat (Details)" öffnen**  
   → Umrechnung mg → mmol, Ca:P-Ratio optimieren.

3. **"Mehr Details anzeigen" klicken**  
   → Osmolarität, Fenton-Z-Scores, NPC-Ratio anschauen.

4. **Laborwerte eingeben (wenn verfügbar)**  
   → Triglyzeride, Harnstoff → triggert spezifische Empfehlungen.

5. **Adjustierung durchspielen**  
   → Z.B. Lipide von 2.0 auf 2.5 g/kg erhöhen → Warnung verschwindet?

---

## 7. Cheatsheet (Schnellreferenz)

→ **Siehe separates Dokument:** `NEONUTRI_CHEATSHEET_V11.pdf`  
(Inhalt auf nächster Seite als Markdown-Vorlage)

---

# 📄 ANHANG: One-Page Cheatsheet

```
╔════════════════════════════════════════════════════════════════════╗
║           NeoNutri V11 — NICU Quick Reference (Level-1)            ║
║                   ESPGHAN 2022 | Master Logic V11                  ║
╚════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────┐
│ 🎯 ZIELWERTE (ESPGHAN 2022)                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Parameter           │ ELBW (<1000g)  │ VLBW (1000–1500g) │ Term    │
├─────────────────────┼────────────────┼───────────────────┼─────────┤
│ Protein (g/kg/d)    │ 3.5 – 4.0      │ 3.0 – 3.5         │ 2.5–3.0 │
│ Energie (kcal/kg/d) │ 110 – 135 *    │ 110 – 130 *       │ 100–120 │
│ Lipide (g/kg/d)     │ 3.0 – 4.0 **   │ 2.5 – 3.5 **      │ 2.0–3.0 │
│ GIR (mg/kg/min)     │ 6 – 10         │ 5 – 9             │ 4 – 8   │
│ TFI (ml/kg/d)       │ 120 – 140 ***  │ 120 – 160         │ 140–160 │
│ Ca (mg/kg/d)        │ 100 – 140      │ 80 – 120          │ 60–100  │
│ P (mg/kg/d)         │ 60 – 90        │ 50 – 80           │ 40–70   │
│ Ca:P Ratio (molar)  │ 1.5 – 1.7:1    │ 1.5 – 1.7:1       │ 1.5–2.0 │
└─────────────────────────────────────────────────────────────────────┘
* ab Tag 4+ (Wachstumsphase). Tag 1: 45–60, Tag 2: 60–80, Tag 3: 80–100.
** Tagesabhängig: Tag 1: 1–2, Tag 2: 2–3, Tag 3+: 3–4 g/kg.
*** Bei invasiver Beatmung: MAX 140 ml/kg/d (BPD/PDA-Prävention).

┌─────────────────────────────────────────────────────────────────────┐
│ 🚨 KRITISCHE GRENZWERTE (ROTE ALARME)                               │
├─────────────────────────────────────────────────────────────────────┤
│ GIR > 12 mg/kg/min          │ Hyperglykämie → Insulin erwägen       │
│ Glukose > 12.5% (peripher)  │ Auf ZVK wechseln ODER verdünnen       │
│ Osmolarität > 900 mOsm/l    │ NUR bei ZVK erlaubt (peripher STOP!)  │
│ Lipide > 4.0 g/kg/d         │ Hypertriglyceridämie-Risiko           │
│ TG > 250 mg/dl              │ Lipid auf 0.5–1.0 g/kg reduzieren     │
│ Protein > 4.5 g/kg/d        │ Nierenbelastung, Azidose-Risiko       │
│ Ca+P > 72 mmol/l (in Lsg.)  │ AUSFÄLLUNGSGEFAHR → Lösung verwerfen  │
│ SID < 0 mmol/kg/d           │ Hyperchlorämische Azidose             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 🔑 EXPERTEN-RATIOS                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ P:AA Ratio    │ ≥ 1.0 mmol/g  │ Verhindert PIFS (Refeeding-Syndrom) │
│ NPC/P Ratio   │ 20–30 kcal/g  │ Optimale Proteinverwertung           │
│ NPC Lipid-%   │ 25–50%        │ Metabolische Balance (ESPGHAN)       │
│ Na:Cl Ratio   │ 1.0–1.4:1     │ Azidose-Prävention (Stewart)         │
│ Weight Vel.   │ 15–20 g/kg/d  │ Ziel-Wachstumsrate (Fenton-Kurve)    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 🧮 VOLUMEN-HIERARCHIE (PN-Restvolumen-Konzept)                     │
├─────────────────────────────────────────────────────────────────────┤
│  TFI (Gesamt)                                                       │
│   ↓ minus Enteral (Sondenkost)                                     │
│   ↓ minus Spülflüssigkeit (Perfusor-Träger)                        │
│   ↓ minus Sekundärinfusion (z.B. Glucose 5%)                       │
│   ↓ minus Mikronährstoffe (Soluvit, Vitalipid, Peditrace)          │
│   = PN-Volumen BRUTTO                                               │
│   ↓ minus Lipid-Volumen                                             │
│   = PN-NETTO (Trägerlösung für AS, Glukose, Elektrolyte)           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 📦 BASISLÖSUNGEN (Hausstandard) — Werte bei Zielvolumen            │
├─────────────────────────────────────────────────────────────────────┤
│ Lösung           │ Vol.  │ AS    │ Gluc  │ Na   │ K   │ Ca   │ P   │
├──────────────────┼───────┼───────┼───────┼──────┼─────┼──────┼─────┤
│ FG-Mix 7,5%      │ 100ml │ 1.75  │ 5.25  │ 0    │ 0   │ 0.70 │ 0   │
│ Basislösung FG   │ 100ml │ 1.40  │ 2.80  │ 3.11 │ 2.1 │ 1.08 │ 1.00│
│ Basislösung 100  │ 100ml │ 2.45  │ 10.50 │ 3.11 │ 2.1 │ 1.08 │ 1.00│
│ Basislösung 120  │ 120ml │ 2.04  │ 8.75  │ 2.59 │ 1.75│ 0.90 │ 0.84│
│ Basis peripher   │ 100ml │ 1.225 │ 5.25  │ 1.55 │ 1.05│ 0.50 │ 0.50│
└─────────────────────────────────────────────────────────────────────┘
Einheiten: AS/Gluc in g/kg, Na/K in mmol/kg, Ca/P in mmol/kg.

┌─────────────────────────────────────────────────────────────────────┐
│ 🍼 FORTIFIZIERUNG (FM85 bei EBM)                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Start-Kriterium  │ Enteral ≥ 100 ml/kg/d + stabiles Abdomen (>5-7d)│
│ Titration        │ 1% → 2% → 3% → 4% (über 4–7 Tage)               │
│ EBM + FM85 4%    │ 85 kcal, 3.0g Protein, 8.6g KH (pro 100ml)      │
│ Supplement       │ BUN < 3 mmol/l → +0.5 g/kg Protein (Aptamil E+) │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 🧪 LABOR-TRIGGER                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Triglyzeride     │ > 200 mg/dl → Lipid reduzieren erwägen           │
│                  │ > 250 mg/dl → KRITISCH: Lipid-Pause              │
│ Harnstoff (BUN)  │ < 3 mmol/l (enteral ≥100) → Protein-Mangel      │
│                  │ > 8 mmol/l → Protein reduzieren oder E↑          │
│ Serum-Phosphat   │ < 1.5 mmol/l → P:AA-Ratio prüfen, P steigern    │
│ Natrium (Serum)  │ > 150 mmol/l → Hidden Sodium + IWL prüfen        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ⚡ ELEKTROLYT-KONZENTRATE                                           │
├─────────────────────────────────────────────────────────────────────┤
│ NaCl 5,85%       │ 1 ml = 1 mmol Na + 1 mmol Cl                     │
│ KCl 7,46%        │ 1 ml = 1 mmol K + 1 mmol Cl                      │
│ ACHTUNG          │ Chlorid-Überhang → Na:Cl Ratio < 1.0 → Azidose! │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 🎓 VIRTUAL NICU SIMULATOR (Trainingsmodus)                          │
├─────────────────────────────────────────────────────────────────────┤
│ 🫀 ELBW 550g     │ Tag 1, Minimal-TFI, Basislösung FG, 0 ml enteral │
│ 🔄 Transition    │ Tag 5, PN + EBM 60 ml/kg, FM85 2%, SMOFlipid 2g  │
│ 🍼 Full Enteral  │ Tag 14, 150 ml/kg EBM + FM85 4%, PN = 0          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 📊 QUICK VIEW — Die 3 wichtigsten Indikatoren                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Weight Velocity (g/kg/d)  → Ziel 15–20 → Wachstumserfolg        │
│ 2. Gesamt-Energie (kcal/kg)  → Tag 4+: 110–135 → Energiebalance    │
│ 3. Sicherheitsstatus (🟢/🔴) → GRÜN = alle Checks bestanden        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 🔧 TROUBLESHOOTING — Häufigste Fehler                               │
├─────────────────────────────────────────────────────────────────────┤
│ ❌ "PN-Volumen negativ"     │ → Spülflüssigkeit zu hoch, TFI↑      │
│ ❌ "Lipid übersteigt PN"    │ → Lipid-Dosis reduzieren ODER TFI↑   │
│ ❌ "Ca:P Ratio 3:1"         │ → Phosphat fehlt, Glycophos +1 mmol  │
│ ❌ "GIR 15 mg/kg/min"       │ → Glucose-Konzentration senken       │
│ ❌ "Protein 5 g/kg"         │ → AS auf 3.5–4.0 g/kg reduzieren     │
│ ❌ "Osmolarität 980 (perip)"│ → Auf ZVK wechseln SOFORT            │
└─────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════╗
║  © 2026 Level-1-NICU | Nur für autorisiertes medizinisches Personal║
║  Bei klinischen Fragen: Oberarzt/Neonatologe konsultieren           ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## Impressum & Haftungsausschluss

**Entwickler:** Level-1-NICU Clinical Decision Support Team  
**Validierung:** Lead Neonatologist, Health Informatics Architect  
**Referenzen:**
- ESPGHAN 2018/2022: "Nutritional Care of Preterm Infants"
- Koletzko et al. (2022): "Pediatric Parenteral Nutrition"
- Fenton et al. (2013): "Preterm Growth Charts"

**Haftungsausschluss:**  
Dieses Tool dient der **klinischen Entscheidungsunterstützung** und ersetzt KEINE ärztliche Überprüfung. Alle Berechnungen sind validiert, aber die **finale Verantwortung** liegt beim verschreibenden Arzt. Bei Abweichungen von Leitlinien immer Oberarzt/Konsiliararzt einbeziehen.

**Feedback:**  
Verbesserungsvorschläge oder Fehlerberichte bitte an: nicu.support@hospital.de

---

**Ende des Benutzerhandbuchs**
