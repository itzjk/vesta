# Unified test table: independent verification

Verified Saturday Nov 14, 2026, about 12:10 p.m. EST, against the files on disk only (no web).
Subject: `pipeline/build_tests.py`, `data/tests.json`, `data/tests.csv`, `data/tests.report.txt`.
Checker: `pipeline/check_tests.py` (reads the raw CSVs itself, does not import the builder).

## Verdict

The table is right after four fixes. Final state:

- `python3 pipeline/build_tests.py` finishes clean (exit 0), twice in a row with identical output: 22 tables, 2,870 records read, **1,989 tests** kept, 3 CSV files excluded, 4 PSI records without a table.
- `python3 pipeline/check_tests.py` exits 0: **22 of 22 tables PASS**, plus the whole-file checks.
  - 1,989 tests checked, each against its own row of its own file.
  - 25,428 raw cells matched character for character.
  - 14,712 normalized numbers matched the cell times the conversion within 0.1 percent, plus 231 values inside lists and ranges.
  - 4 cells hold a clean number and are null on purpose (listed under "Nulls on a numeric cell").
  - tests.csv: 1,989 of 1,989 lines carry the same id, row, core numbers and raw cells as tests.json.
  - Summaries: 20 of 20 match the tests (n_tests, row kinds, oxygen / pressure / flow ranges, oxygen per basis).
- Before my fixes the first run reproduced the builder's files byte for byte (same counts as its report), and the checker failed on 2 tables (4 tests): see "Changes".

The checker was itself tested: 18 planted errors in a copy of tests.json (a pressure off by 0.2 percent, oxygen left as a fraction, an edited raw cell, a shifted row, a row pointing at a blank record, a nulled value, an invented value, a wrong outcome, a wrong composition, a wrong list value, an unconverted mm/s, an invented fuel, a removed test, a note row turned into a test, a changed stated conversion, a changed summary, a changed gravity, the 273.15 artifact restored) all gave exit 1 with the right message. A control change of 0.05 percent, inside the tolerance, passed the number check.

## Changes I made to the builder (every one)

1. **Kelvin artifact, PSI-159 inverse flames, row 130 (test 21265 H3).** `Peak burner temp (K)` is `Peak burner Temp (C)` + 273.15 in all 151 rows where both are numbers. In row 130 the Celsius cell is empty and the Kelvin cell reads 273.15: a spreadsheet formula on a blank, not a measurement. The builder shipped `peak_burner_temp_k = 273.15`. Now null, raw kept. Done with a new column option `needs="<column>"` (a computed column gives a value only when its source cell is a clean number). Effect: 152 to 151 converted cells in that column.
2. **"Candle" as a fuel name, BASS rows 47, 48, 49.** The cell reads only `candle`: a shape, no material. The builder named the fuel "Candle" against its own rule ("the material is named only when the cell names it"). Now `fuel` null, `fuel_form` "candle", `fuel_raw` unchanged. Effect: tests with a fuel name 1,888 to 1,885.
3. **Oxygen range per basis added to every summary** (`summaries[].o2_percent_by_basis`, also in the report and in `meta.fields`). PSI-10 and PSI-159 each hold two tables: normal flames (oxygen is the chamber atmosphere) and inverse flames (oxygen is fed through the burner into a fuel atmosphere). Their single `o2_percent` range mixed both (PSI-159 read "12 .. 85"). The per-test values were already right and tagged `o2_basis`; the summary now also says: PSI-159 ambient 17.97 to 39.97 percent (179 rows), burner stream 12 to 85 (154 rows); PSI-10 ambient 19.80 to 40 (207 rows), burner stream 21.20 to 85.00 (109 rows). **Design mode must use `o2_basis == "ambient"` only**: no table has a cabin-like atmosphere above 40 percent oxygen.
4. **Decision notes added** (text only, in `tables[].decisions`): SLICE row 12, BASS-II suspect cells, SPICE negative air rates, SAFFIRE-I sample size, BASS candle rule, the Kelvin rule. No value changes.

Nothing else in the mapping was changed. Files written: `pipeline/build_tests.py` (edited), `pipeline/check_tests.py` (new), `data/tests.json`, `data/tests.csv`, `data/tests.report.txt` (rebuilt), this file.

## Unit decisions confirmed, table by table

"Confirmed" means: I read the column name, looked for a unit row or unit text in the cells, and checked the value range for that unit.

| Table (tests) | Oxygen | Pressure | Flow | Other units and notes |
|---|---|---|---|---|
| PSI-10 Flame Design, normal (207) | `XO2 (init)` is a mole fraction: 0.198 to 0.400. x 100. Basis ambient (init / final pair = chamber gas). Confirmed. | `pinit (atm)`: 0.93 to 1.30. x 101.325. Confirmed. | none | `XO2 (final)` x 100 and `pfinal`, `pmean` x 101.325 as outcomes / condition. 60 rows read RAMP / RAMPED in the flow columns: null. |
| PSI-10 Flame Design, inverse (120) | `XO2`: 0.212 to 0.850, mole fraction, x 100. Basis burner stream: I recomputed row 1 from `mO2` and `mN2` (5.116 / 32 against 7.599 / 28) and got 0.371, the cell value, so XO2 is the O2 / N2 stream. Confirmed. | `pinit (atm)`: 0.42 to 3.01. x 101.325. Confirmed. | none | Fuel "Ethylene" comes from the header `XC2H4`; there is no fuel column. 11 rows RAMP / LOW O2: null. |
| PSI-20 ACME BRE (18 test days) | `Oxygen Conc (percent)`: percent. 16 cells are lists (21; 26.5; 40) kept in `multi`; `3400%` and `2100%` fail the 0..100 gate and are null. No single value. Confirmed. | none (the table note says pressure was varied but not listed) | none | Burner size 25 / 50 mm. |
| PSI-21 CLD Flame (32 test days) | none | none | none | MFC in slpm (table note). Fuel concentration in percent, mostly ranges. |
| PSI-22 E-FIELD Flames (21 test days) | none | none | none | Fuel concentration percent. 11 continuation records folded into the day above. |
| PSI-23 s-Flame (18 test days) | `Atmosphere*`: percent written in the cell ("~21% O2 with N2"), approximate. 13 single values (21 or 30), 5 cells with two values in `multi`. Confirmed. | none (note says "~1 atm", no cell gives it) | none | Diluent N2 / He from the cell; fill-series text "N3".."N6" gives diluent null. |
| PSI-159 CFI-G, normal (179) | `XO2 before test`: 0.180 to 0.400, mole fraction, x 100. Ambient. Confirmed. | `approx p (bar)`: 0.50665, 0.9443956, 1.0133, 2.0266, 3.0399. Four of the five are 0.5, 1, 2, 3 atm times 1.01325, so the unit really is bar. x 100, marked approx. Confirmed. | none | `XO2 after test` x 100 as outcome. `#DIV/0!` null. |
| PSI-159 CFI-G, inverse (154) | `XO2`: 0.12 to 0.85, mole fraction, x 100. Burner stream (table has `O2 flow rate (mg/s)` and the fuel as chamber fraction `Xf before / after`). Confirmed; matches the challenge page ("up to 85% oxygen flowing from a spherical burner"). | `approx p (bar)`: 0.495 to 3.31. x 100, approx. Confirmed. | none | 861 blank records after the last test, skipped. Kelvin column: see change 1. |
| PSI-25 BASS-II (129) | `Calibrated initial O2 % by vol`: 13.6 to 22.2, percent, no conversion. Ambient. Confirmed. | none | none. `Fan display` and `Air display` are instrument settings with no unit and often several per cell: correctly NOT mapped to cm/s. | Final O2, CO2 percent and CO ppm as written. |
| PSI-26 BASS (121) | none | none | none | Only date, test numbers, sample number and the fuel cell. |
| PSI-106 SLICE (12 test days) | none | none | none | Fuel percent and "balance N2" from the fuel cell. |
| PSI-107 SPICE (469) | none | none | `Air Rate (cm/s)`: -5.92 to 85.28, cm/s, no conversion. Confirmed (the PSI record speaks of co-flow velocities of 5.4 to 65 cm/s). | Nozzle mm (0.4064, 0.762, 1.6002), fuel rate sccm and mg/s. |
| PSI-39 CFI (87) | `Oxygen`: 0.17 or 0.21, fraction of 1, x 100. Oxygen + Nitrogen + Helium = 1.00 in 83 rows and 0.97 in 4. Ambient. Confirmed. | `Pressure`: every cell carries "atm" (0.5 to 5 atm). x 101.325. Confirmed. | none | Composition kept as fractions; no CO2 column. |
| PSI-68 FLEX-2 (8 fuel series) | `Oxygen Mole Fraction`: list 0.17; 0.21; 0.25; 0.3, x 100, in `multi`. Confirmed. | `Ambient Pressure (atm)`: list 0.5 to 3.0, x 101.325, in `multi`. Confirmed. | `Flow Velocity (cm/s)`: range 0.1 - 5, in `multi`. Confirmed. | One row is one fuel with its ranges, not one test: no single values, by design. |
| PSI-69 FLEX (274) | `O initial ambient composition; mole fraction`: 0.12 to 0.34, x 100. Ambient. Confirmed as a fraction. | `Ambient pressure; mmHg`: 757.7, 762 ... up to 2,319.9 (3.05 atm). mmHg, x 0.133322 (exact factor 0.1333224, difference 3 parts per million). One cell is 0: null. Confirmed. | none | O + N + CO + He = 1.00 in 245 rows, 0.98 to 1.01 in the rest. Droplet diameter mm, burn time s. |
| PSI-98 SAFFIRE-I (2) | `Percent O2`: "21.5 - 21.7" (range, `multi`) and "~ 21.5" (approx). Percent. Confirmed. | none | `Air Flow (cm/s)`: 20. Confirmed. | 2 flow-visualization records skipped. |
| PSI-99 SAFFIRE-II (9) | `Percent O2 (Note 1)`: "~ 21.5", "~ 22.1" (approx), two ranges in `multi`. Percent. Confirmed. | none | `Air Flow (cm/s)`: cells read "20 cm/s". Confirmed. | Burn lengths "29 cm" stay cm; spread rates "2.1 mm/s" x 0.1 to cm/s. The 1-g results are separate outcomes tagged normal gravity. 2 flow-visualization and 4 note records skipped. |
| PSI-100 SAFFIRE-III (2) | none | none | `Air Flow`: cells read "30 cm/s". Confirmed. | |
| PSI-101 SAME-R (109) | none | none | `Inlet velocity (cm/s)`: 0, 1, 2, 8, 8.1. Confirmed. | Times in seconds. |
| PSI-102 SAME (8) | none | none | `Air Flow (cm/s)`: 5, 10 in rows 1-4. Confirmed. | Rows 5-8 say "same conditions as 1-4": numbers are not copied, correctly. |
| PSI-47 DAFT (2 sessions) | none | none | none | Dust measurement, nothing burns; no fuel. |
| PSI-142 (8 data sets) | none | none | none | An index of data sets of a ground investigation; gravity null. |

No oxygen column was read as percent when it was a fraction or the reverse, and no pressure column has the wrong unit.

## Columns, fuel phase and form, skipped rows

- **Columns mapped to the wrong field:** none found. Every mapped column was read against its cells.
- **Fuel phase "gas"** (PSI-10, 20, 21, 23, 159): the PSI record's sub-research area reads "Flames of Gaseous Fuels" (or "gaseous fuel(s)"). PSI-22: record description "conducted with gas-fueled flames". Confirmed in the records.
- **Fuel phase "liquid", form "droplet"** (PSI-39, 68, 69): record texts found ("Droplets of fuel are dispensed", "bi-component fuel droplets", "flammability limits of liquid fuels"). Confirmed.
- **Fuel phase "solid"** (PSI-25, 26): record titles "Burning and Suppression of Solids". Confirmed. For SAFFIRE-I the record says "composite fabric". For SAFFIRE-II and -III the word "solid" is not in the record; the phase rests on the table's thickness / length / width columns. I accept it and flag it.
- **Phase left null** for SLICE, SPICE, SAME, SAME-R: correct, neither table nor record states it (SAME even lists dibutyl phthalate, a liquid).
- **Forms:** "porous circular burner" (BRE) and "spherical porous burner" (s-Flame) are in the records; coflow / gas-jet burner (E-FIELD) and the BASS shapes come from the cells; "jet from a nozzle" (SPICE) from the `Nozzle (mm)` column and the record's "jet diffusion flames".
- **Skipped rows:** 881 records, all confirmed as non-tests: 861 blank records (CFI-G inverse), 11 continuation records (E-FIELD, folded into their day), 1 "SOOT Cleaning" entry (BASS row 66, no test or sample number), 4 flow-visualization records and 4 note records (SAFFIRE-I and -II). The checker lists them by record number and fails if any other non-blank record is missing from the tests.

## Excluded list and summaries

- **Excluded, confirmed:** PSI-108 (two STDCE-1 tables: thermocapillary flow runs, research area Fluid Physics) and PSI-181 (solder samples, Materials Science). I read all three files: nothing burns in them.
- **Records without a table, confirmed:** PSI-60, 62, 115, 117 (empty `tables` in the PSI dump).
- **Summaries recomputed by hand from the raw CSVs** (separate from both scripts), all equal:
  - FLEX: 274 tests; oxygen 12 to 34 percent, 15 distinct, 274 rows; pressure 70.167369 to 309.293708 kPa, 182 distinct, 273 rows.
  - BASS-II: 129 tests; oxygen 13.6 to 22.2 percent, 50 distinct; final O2 0.6 to 40.4 over 127 cells.
  - SPICE: 469 tests; flow -5.92 to 85.28 cm/s, 62 distinct, 444 rows.
  - CFI-G: 333 tests; oxygen 12 to 85, 150 distinct; pressure 49.53817 to 330.99 kPa, 11 distinct.

## Nulls on a numeric cell (4, all intended)

- BRE rows 5 and 8: `3400%`, `2100%` (outside 0..100).
- FLEX row 114: pressure `0` mmHg.
- CFI-G inverse row 130: Kelvin 273.15 from an empty Celsius cell (change 1).

## What I could not confirm

1. **FLEX gas headers.** The saved CSV reads `O`, `N`, `CO`, `He`; the builder reads O2, N2, CO2. Support: the four add up to 1 in every row, "CO" reaches 0.70 beside O 0.21 and N 0.09, and the PSI record names CO2 and He as suppressants. The original PSI page was not opened.
2. **SAFFIRE-II `?-g` headers** read as microgravity (a character was lost in the file). They sit beside the `1-g` columns. Not checked against the original.
3. **Source cells that look wrong, kept as written** (they are in outcomes / conditions, not in the core fields): BASS-II final O2 of 1.6, 0.6, 39.1, 0.9, 40.4 percent (rows 2, 96, 97, 127, 128, initial O2 20 to 22.2), `Fan display` 80122 (row 114), initial CO -3 and -1 ppm; SPICE air rate -0.28 (5 rows) and -5.92 (3 rows), which makes the SPICE flow minimum negative; SAFFIRE-I thickness 0.37 under a "(cm)" header (SAFFIRE-II writes "037 mm") with length 40.6 and width 94 (the record says about 0.94 m long, 0.4 m wide). **Anything that plots or models these should filter them.**
4. **FLEX "Burning rate; mm".** The unit is kept as the header writes it; it is unlikely to be the real unit.
5. **Dates.** CFI cells like `9-Mar-17` are read as 2017 (century assumed; the run ids agree, f068 is day 68 = Mar 9 of a non-leap year, but the PSI record gives 2020-2021 for the investigation). 50 FLEX dates with two-digit years (`10/24/09`) are left null by the same builder: inconsistent, harmless, not changed.
6. **E-FIELD records 29-32 repeat 25-28** (test day 18319). Both are kept and the second is flagged `duplicate_of`; summing "flames ignited" over the table counts that day twice.
7. **CLD and s-Flame fill series.** Cells such as `40% CH5` or `with N3` are spreadsheet fill artifacts. The species / diluent is distrusted (null or taken from `Test Type`), the percent in the same cell is kept. Reasonable, not provable from the file.
8. **PSI-39 record against its table.** The record says the chamber ran "from 0.25 to 0.5 atm"; the cells say 0.5 to 5 atm. The table is used.
9. **Platform of SAFFIRE-I and -III** is "International Space Station (ISS)" because the PSI record field says so, although the description says Cygnus after it left the station. The rule (platform = record field) was kept.
10. **Tidy fuel names from formulas** (C12H26 to "Dodecane"; the record says n-dodecane). `fuel_raw` keeps the cell.
11. **Meaning of `Xf`, `TFP`, `SE` / `FT`** in CFI-G: kept under the table's own names, not spelled out by any file on disk.
12. One quoted source string in the mapping ("25 and 50 mm diameter") differs from the record by a double space; the content is the same.

## How to re-run

```
cd producto
python3 pipeline/build_tests.py     # rebuilds data/tests.json, tests.csv, tests.report.txt
python3 pipeline/check_tests.py     # PASS / FAIL per table, exit 0 only when all pass
```
If a PSI table changes or a new one is added, `check_tests.py` fails until its `EXPECT` block (the verifier's own reading of each table) is updated by hand: that is intended.
