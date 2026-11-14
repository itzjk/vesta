# acme.json: rejected and changed items

Input: 75 findings, 6 investigation records. Kept unchanged: 0. Kept with changes: 75. Rejected: 0. Pending: 0.

- Step 1: the exact requested quotecheck --refetch command returned 0: total 75, passed 75, failed 0. ACME-032 was also present in the live NTRS title/abstract. No FAIL required rejection or source relabeling at this step.
- Step 2: all findings and their surrounding sentences were read. Every original finding could be retained after narrowing. Field-change counts, excluding the verified flag: claim: 21, quote: 22, source: 4, conditions: 73, earth_instinct: 5, decision_hint: 61, evidence_level: 8, conditions_quote added: 1.
- Step 3: all 6 investigation records retained with changes; 224 final field-source quotes match their text_file. Every non-null field has a source entry. All 6 PSI ids and URLs match research/psi-investigations.json.
- Scope: this verifies the evidence file. No full build, live product screen, publication, detector design or operational safety procedure was approved.

## Rejected findings

None. Literal matches were necessary but not sufficient; all retained records were changed as documented below.

## Changed findings (kept, narrowed or corrected)

### ACME-001: BRE, burning without airflow

Fields changed: claim, quote, source, conditions, earth_instinct, decision_hint.
Reason and context: The BRE final-report Impacts paragraph describes microgravity emulation, not direct plastic tests. The widened quote includes elevated-oxygen persistence and 21% oxygen self-extinction. The source’s explicit preliminary-results qualification is retained.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "Quasi-steady burning that corresponds to condensed-phase materials such as PMMA and Nylon was observed in microgravity with no air flow, even though stopping ventilation is an established step in putting out spacecraft fires." -> "Preliminary BRE results describe quasi-steady emulated burning corresponding to materials such as PMMA and Nylon in microgravity without air flow, with continued burning in elevated oxygen and short-time self-extinction at 21% oxygen.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `source`: raw/psi/investigations/PSI-20.json (https://psi.nasa.gov/physci/repo/data/investigations/PSI-20) -> raw/pdf/PSI-20_final-report-20220201.txt (https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4). Same result in live-checked PDF prose, avoiding escaped metadata in the drawer.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "gaseous fuel emulating condensed-phase materials such as PMMA and Nylon" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `earth_instinct`: "A fire with no draft feeding it dies out by itself." -> null.
- `decision_hint`: "Do not treat a ventilation shutdown as proof that the fire is out; keep monitoring and be ready to suppress, above all in an oxygen-enriched cabin." -> "BRE observed continued burning without air flow in elevated oxygen; ventilation shutdown alone did not establish extinction in those tests.".

### ACME-002: BRE, oxygen limit in still atmosphere

Fields changed: claim, quote, conditions, decision_hint.
Reason and context: The BRE section names the experiment and reports outcomes by oxygen, flame size and fuel. The complete three While sentences preserve the limitations omitted by the original threshold hint.
Evidence: `raw/pdf/20210021781.txt`; https://ntrs.nasa.gov/citations/20210021781.

- `claim`: "BRE flames could burn for minutes at elevated oxygen concentrations, like those considered for future spacecraft, but self-extinguished at oxygen concentrations below about 25% by volume." -> "In BRE, low-momentum microgravity flames could burn for minutes without air flow, but self-extinguished below about 25% oxygen by volume. At elevated oxygen, larger flames generally self-extinguished within 1.5 minutes, and methane flames within a minute, while smaller or ethylene flames could burn for minutes.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "pure or nitrogen-diluted ethylene and methane" -> "ethylene and methane". Confined to the quoted setting, without inherited context.
- `conditions.o2_percent`: "below ~25 (self-extinguish); elevated (burn for minutes)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Treat about 25% oxygen as the level above which a flame in still microgravity air may no longer put itself out; rank cabin atmospheres above it as higher risk." -> "The reported BRE outcomes depended on oxygen, flame size and fuel; about 25% is not a universal persistence threshold.".

### ACME-003: BRE, normal atmosphere versus elevated oxygen

Fields changed: claim, quote, source, conditions, decision_hint.
Reason and context: The BRE final-report Impacts paragraph gives this comparison and immediately labels the results preliminary; that qualification is now included.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "Without air flow, combustion continued in elevated-oxygen atmospheres being considered for future spacecraft, while the same kind of flame in a normal 21% oxygen atmosphere self-extinguished in a short time." -> "BRE reports continued combustion without air flow in elevated-oxygen atmospheres, versus short-time self-extinction at 21% oxygen; the source explicitly calls the results preliminary.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `source`: raw/psi/investigations/PSI-20.json (https://psi.nasa.gov/physci/repo/data/investigations/PSI-20) -> raw/pdf/PSI-20_final-report-20220201.txt (https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4). Same result in live-checked PDF prose, avoiding escaped metadata in the drawer.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "gaseous fuel emulating condensed-phase materials" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "21 (self-extinguished); elevated (kept burning)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Evidence that still-air self-extinction holds at 21% oxygen does not carry over to exploration atmospheres with more oxygen." -> "BRE reports that short-time self-extinction at 21% oxygen did not extend to the tested elevated-oxygen cases.".

### ACME-004: BRE, oxygen limit in still atmosphere

Fields changed: conditions, decision_hint.
Reason and context: Section 4.E.3 of the BRE final report gives both the normal-atmosphere 40 s result and quasi-steady observations at mole fractions 0.265 and above, not a universal threshold.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "CH4/N2 and C2H4/N2 mixtures on porous circular burners of 25- and 50-mm diameter" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "normal atmosphere (self-extinguished within 40 s); 26.5 and above (quasi-steady)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "At 26.5% oxygen or more, plan for a flame that can keep burning in still air; do not count on self-extinction." -> "BRE obtained quasi-steady flames at oxygen mole fractions of 0.265 and above; this does not mean every flame at those concentrations persisted.".

### ACME-005: BRE, oxygen as the dominant factor

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.1 concerns a flat-surface pool-fire emulation and identifies ambient oxygen as the largest influence in that configuration.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "gaseous fuel on a flat burner representing a pool fire" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "When ranking habitat atmospheres for fire risk, weight oxygen concentration first." -> "In the BRE emulation, ambient oxygen mole fraction had the largest reported influence on quasi-steady burning.".

### ACME-006: BRE, exploration atmosphere 34% oxygen at 8.2 psia

Fields changed: quote, conditions, decision_hint.
Reason and context: Figure 9 and its adjacent text identify test 19070D1, ethylene/N2, mass flux 4.95 g/m2s, 34% oxygen, 8.2 psia and a nominal 0.56 atm. Only the quoted pressure representation is retained in conditions.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "0.56 atm (8.2 psia)" -> "0.56 atm". Confined to the quoted setting, without inherited context.
- `conditions.flow`: "quiescent; fuel mass flux 4.95 g/m2s" -> "fuel mass flux 4.95 g/m2s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "For a 34% oxygen, 8.2 psia cabin, assume a small flat fuel surface can reach steady burning in still air in under two minutes." -> "The cited BRE test at 34% oxygen and 0.56 atm appeared steady after about 100 s; this is a gas-burner emulation result.".

### ACME-007: BRE, exploration atmosphere 26.5% oxygen at 10.2 psia

Fields changed: conditions, decision_hint.
Reason and context: The complete Figure 7 caption identifies test 19070K1 and the quoted fuel, mass flux, oxygen and pressure. The source is gas emulation, not a direct PMMA burn.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent; fuel mass flux 2.3 g/m2s" -> "fuel mass flux 2.3 g/m2s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "For a 26.5% oxygen, 10.2 psia cabin, treat steady burning in still air as demonstrated for a PMMA-like emulated fuel." -> "BRE test 19070K1 demonstrated steady burning of the quoted ethylene/nitrogen emulation at 26.5% oxygen and 10.2 psia.".

### ACME-008: BRE, self-extinction case at 10.2 psia

Fields changed: conditions, decision_hint.
Reason and context: The complete Figure 6 caption explicitly records test 19056F1 and extinction at 45 s with these quoted conditions.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent; fuel mass flux 4.55 g/m2s" -> "fuel mass flux 4.55 g/m2s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "A similar atmosphere gave a steady flame in one test and self-extinction in another with a different fuel supply; atmosphere alone does not settle the outcome." -> "The quoted ethylene/nitrogen test self-extinguished at 45 s despite 27% oxygen and 10.2 psia; those atmospheric values alone do not establish sustained burning.".

### ACME-009: BRE, common plastic in exploration atmospheres

Fields changed: claim, conditions, evidence_level, decision_hint.
Reason and context: The report explicitly says could represent PMMA and could steadily burn. This is a material inference from emulation, with no atmospheric numbers inside this quotation.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "An emulation with a heat of combustion of about 24 kJ/g and a heat of gasification of about 3 kJ/g, which could represent PMMA, indicates that a common plastic could burn steadily under the NASA proposed atmospheric conditions tested." -> "The BRE report interprets an emulation with heat of combustion about 24 kJ/g and heat of gasification about 3 kJ/g as potentially representing PMMA, suggesting that a common plastic could burn steadily under the proposed atmospheres discussed there.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "50% mixtures of nitrogen and ethylene (emulating PMMA)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "26.5 and 34" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "0.7 atm (10.2 psia) and 0.56 atm (8.2 psia)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "model or analysis".
- `decision_hint`: "In a habitat at these atmospheres, treat PMMA-like plastics as able to sustain a fire without forced air; limit or shield them." -> "The reported material implication is an inference from emulation, not a direct PMMA burning test.".

### ACME-010: BRE, material property range that burns

Fields changed: claim, conditions, evidence_level, decision_hint.
Reason and context: The quoted material-property range is an inference based on the BRE study; the actual study uses gas-burner emulation rather than directly testing all solids in the range.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "Solid materials with heats of combustion from 23.6 to 47.2 kJ/g and heats of gasification from about 1 to 10 kJ/g can burn in microgravity, according to the BRE findings." -> "From its emulation findings, the BRE report infers that solid materials with heats of combustion from 23.6 to 47.2 kJ/g and heats of gasification from about 1 to 10 kJ/g can burn in microgravity.".
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "emulated solid materials (heat of combustion 23.6 to 47.2 kJ/g, heat of gasification about 1 to 10 kJ/g)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "model or analysis".
- `decision_hint`: "Screen cabin materials by heat of combustion and heat of gasification (cone calorimeter, NASA Test 2), not only by the upward flame spread pass-fail test." -> "The material-property ranges are a BRE emulation inference, not direct burning measurements for every solid in those ranges.".

### ACME-011: BRE, burning rates of named plastics

Fields changed: conditions, evidence_level, decision_hint.
Reason and context: The report says Figure 14 would suggest these material mass fluxes. The conditional language is retained and the evidence is classified as analysis.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "emulated PE, PP, Nylon, PMMA and phenolic glass fiber composite" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "model or analysis".
- `decision_hint`: "Use these mass fluxes as first-order inputs when modeling a still-air fire on common plastics; they are inferred from a gas-burner emulation, not from burning the plastics." -> "The quoted mass fluxes are tentative material inferences from the BRE map, not measured plastic burning rates.".

### ACME-012: BRE, fuel chemistry and burn time

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.3 reports methane/nitrogen self-extinction within a minute for the ambient conditions tested, with fuel chemistry offered as the interpretation.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not generalize one fuel's self-extinction to other materials; ethylene-based emulations burned for minutes in the same atmospheres." -> "The reported methane/nitrogen flames self-extinguished within a minute; that result is specific to the tested fuel chemistry and conditions.".

### ACME-013: BRE, flame size and self-extinction

Fields changed: conditions, decision_hint.
Reason and context: The BRE results section compares smaller and larger flames at elevated oxygen; the quote gives no numerical oxygen setting, fuel species or imposed airflow.
Evidence: `raw/pdf/20210021781.txt`; https://ntrs.nasa.gov/citations/20210021781.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "pure or nitrogen-diluted ethylene and methane" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "elevated" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "absence of an air flow" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A small, weak flame in still air may be the persistent one; do not dismiss small flames." -> "In these BRE results, smaller flames could persist longer than larger flames at elevated oxygen.".

### ACME-014: BRE, two extinction limits

Fields changed: conditions.
Reason and context: Section 4.E.3 reports radiative extinction for large BRE flames and a second quenching limit for small flames; it gives no specific test settings here.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "CH4/N2 and C2H4/N2 mixtures" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-015: BRE, extinction temperature

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.6 reports thin-filament-pyrometry measurements of four flames and confirmation by simulation, not a universal thermal threshold.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene (BRE flames)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A modeling input: a low-momentum microgravity flame cooled below roughly 1100 to 1200 K goes out." -> "The quoted 1100 to 1200 K extinction range comes from four BRE flames and supporting simulations.".

### ACME-016: BRE, radiative heat loss

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.5 directly compares radiative loss fractions of about 60% and 30%. It says nothing about heat direction, detector placement or shielding.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Expect a larger share of the heat as radiation in all directions; radiant-heat sensing and shielding of nearby items matter more than on Earth." -> "BRE reports a larger radiative loss fraction in its microgravity flames than in its normal-gravity comparison.".

### ACME-017: BRE, soot-free dim flames

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.4 reports ethylene soot at ignition followed by rapid disappearance under microgravity conditions.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not rely on a yellow flame or visible soot to spot a still-air fire; add heat and gas-product sensing." -> "These BRE ethylene flames lost their ignition soot quickly in microgravity; persistent visible soot was not observed.".

### ACME-018: BRE, dim blue flame

Fields changed: quote, conditions, decision_hint.
Reason and context: The full video-description sentences explicitly identify sooty ethylene ignition followed by a dim blue flame; no low-light inspection protocol is given.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Check a suspected fire location with low light or sensors; the flame may be dim and blue." -> "The described BRE flame became dim and blue after the ignition soot faded.".

### ACME-019: BRE, flame hole and re-establishment

Fields changed: claim, quote, conditions, decision_hint.
Reason and context: The widened video-description quote includes inhibited oxygen diffusion, radiative opening of a hole and subsequent flame reestablishment.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "In a high-flow BRE test the flame weakened under a thickening cloud of carbon dioxide and water vapor, radiative heat loss left a hole in it, and oxygen mixing with the fuel then made the flame quickly reestablish." -> "In the described BRE test, a thickening cloud of carbon dioxide and water vapor inhibited oxygen diffusion; radiative heat loss opened a hole in the weakened flame, after which oxygen mixed with fuel and the flame reestablished.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A flame that opens a hole or partly vanishes can come back; keep the response going until extinction is confirmed." -> "The described BRE flame reestablished after a hole formed; partial disappearance did not establish complete extinction.".

### ACME-020: BRE, pressure effect

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.2 reports the weak burning-quality effect of pressure and its effect on radiating-species partial pressures; no cabin-pressure safety rule follows.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "varied (weak effect)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Lowering cabin pressure is not a fire-safety measure by itself; oxygen fraction matters more." -> "In BRE, pressure affected radiative heat loss even though its effect on burning quality was described as weak.".

### ACME-021: BRE, pressure and oxygen in the theoretical map

Fields changed: conditions, decision_hint.
Reason and context: The text explicitly calls Figure 17 a flammability map based on theoretical analysis; lower pressure and higher oxygen are trends in that model.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "1 atm and 0.56 atm (map)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Exploration atmospheres (lower pressure, more oxygen) move toward the conditions that favor long burning; mark them as higher risk in design trades." -> "The BRE theoretical map favors longer burning at lower pressure and higher oxygen; this is a model result for that configuration.".

### ACME-022: BRE, carbon dioxide atmospheres not tested

Fields changed: conditions, decision_hint.
Reason and context: The Follow-On Experiments section proposes O2/CO2 work rather than reporting completed CO2 suppression testing.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Treat the effect of CO2 on these still-air flames as not tested in BRE; do not cite BRE for CO2 suppression." -> "The report proposes O2/CO2 ambient testing as follow-on work, rather than reporting BRE CO2 suppression results.".

### ACME-023: BRE, flammability test methods

Fields changed: conditions, evidence_level, decision_hint.
Reason and context: The Impacts section is a preliminary recommendation about flammability Test 2, not a new measured flame result.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "review or summary".
- `decision_hint`: "Ask for cone calorimeter data (heat of combustion, heat of gasification) for candidate cabin materials." -> "The preliminary BRE interpretation suggests additional use of Test 2 to measure relevant material properties.".

### ACME-024: BRE, limits of current material tests

Fields changed: claim, quote, earth_instinct, decision_hint.
Reason and context: The complete contrast includes the immediate However sentence: Test 2 cannot directly predict the hazard but can measure named material properties.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "The BRE science requirements state that NASA Test 1 and Test 2 cannot directly analyze material fire hazards in spacecraft and that there is no predictive method to extrapolate from them." -> "The BRE science requirements say Test 1 and Test 2 cannot directly predict spacecraft material fire hazards, while also stating that Test 2 can measure heats of combustion and gasification and surface reradiation.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `earth_instinct`: "A material that passes the ground flammability test is safe in flight." -> null.
- `decision_hint`: "Show ground pass-fail results as screening only, not as a prediction of behavior in microgravity." -> "The source distinguishes direct hazard prediction from Test 2 measurements of material properties.".

### ACME-025: BRE, time needed to reach quasi-steady burning

Fields changed: claim, conditions, decision_hint.
Reason and context: The science-requirements discussion identifies characteristic response times that preclude quasi-steady conditions in limited drop testing; it is not a flight measurement.
Evidence: `raw/pdf/PSI-20_final-report-20220201.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4.

- `claim`: "Drop facilities cannot show quasi-steady BRE burning because the characteristic times are about 20 s for the gas phase and about 40 s for the burner surface temperature." -> "The cited BRE assessment says limited drop-facility testing cannot establish quasi-steady conditions because characteristic response times are about 20 s for the gas phase and about 40 s for burner surface temperature.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "drop facilities compared with ISS" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Weight seconds-long drop tower results below long-duration ISS results when judging whether a flame sustains." -> "The cited BRE assessment says the stated gas-phase and burner-temperature response times preclude quasi-steady conditions in the limited drop tests.".

### ACME-026: BRE, drop tower flames not steady

Fields changed: claim, conditions, evidence_level.
Reason and context: The 37% statement follows a transient heated-sphere analysis compared with drop-test data. No steady height could be measured during that 5 s drop; this percentage is an analytical comparison.
Evidence: `raw/pdf/20170009141.txt`; https://ntrs.nasa.gov/citations/20170009141.

- `claim`: "In a 5 s drop test with the 25 mm BRE burner, flame height reached only about 37% of its steady-state value." -> "A transient analysis compared with a 5 s BRE drop test estimated the flame height at about 37% of steady state after 5 seconds for the illustrated case.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "NASA Glenn 5-s Zero Gravity Facility" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane, ethylene and nitrogen-diluted ethylene (25 mm burner case)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "21 to 30" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "0.5 to 1.0 atm" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "ground low-gravity (drop tower, aircraft)" -> "model or analysis".

### ACME-027: CLD Flame, soot production in microgravity

Fields changed: conditions, decision_hint.
Reason and context: The CLD Flame Selected Findings section reports soot volume fraction measurements and a five-to-eight comparison. This is concentration, not a smoke emission or detector-response measurement.
Evidence: `raw/nasa/acme.txt`; https://www.nasa.gov/wp-content/uploads/2025/07/advanced-combustion-via-microgravity-experiments-acme.pdf.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "sooty coflow flames (methane and ethylene in air coflow)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "air coflow" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not scale smoke production from normal-gravity tests; a sooty gas-fed flame can carry several times more soot in microgravity." -> "The five-to-eight comparison concerns soot volume fraction in the compared flames, not a measured cabin smoke-production rate.".

### ACME-028: CLD Flame, flame shape and temperature

Fields changed: conditions, decision_hint.
Reason and context: The CLD Flame Selected Findings section gives the quoted sooty-flame comparison; it provides no clearance-distance criterion.
Evidence: `raw/nasa/acme.txt`; https://www.nasa.gov/wp-content/uploads/2025/07/advanced-combustion-via-microgravity-experiments-acme.pdf.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "sooty coflow flames" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "air coflow" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Expect a larger, cooler, sootier flame envelope than the same burner would give on Earth; size the keep-out distance for that." -> "The CLD Flame fact sheet reports larger, cooler and sootier microgravity flames for its sooty-flame comparison.".

### ACME-029: CLD Flame, dilution limits extended

Fields changed: conditions, decision_hint.
Reason and context: The named CLD Flame section reports lower fuel-concentration dilution limits and lifted-flame stability, not measured longer lifetimes.
Evidence: `raw/pdf/20210021781.txt`; https://ntrs.nasa.gov/citations/20210021781.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted methane and ethylene" -> "methane and ethylene". Confined to the quoted setting, without inherited context.
- `conditions.flow`: "air coflow, fuel and air velocities typically matched" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not use normal-gravity dilution or extinction limits as a conservative bound; weak, highly diluted flames last longer in microgravity." -> "CLD Flame reported lifted flames at lower fuel concentrations in microgravity; this is a dilution-stability result, not a measured increase in flame lifetime.".

### ACME-030: CLD Flame, faint diluted flames

Fields changed: conditions, decision_hint.
Reason and context: The full Fuel Dilution paragraph describes nitrogen dilution and explicitly compares the observed microgravity and normal-gravity behavior.
Evidence: `raw/nasa/acme.txt`; https://www.nasa.gov/wp-content/uploads/2025/07/advanced-combustion-via-microgravity-experiments-acme.pdf.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "air coflow" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A weak flame may be faint, blue and detached from where the gas comes out; look away from the source too." -> "The described diluted CLD Flame could be faint, blue and lifted off the burner.".

### ACME-031: CLD Flame, no buoyant rise

Fields changed: conditions, decision_hint.
Reason and context: The CLD Flame overview states the absence of buoyant rise of hot gases; the quote does not specify smoke distribution or ventilation transport.
Evidence: `raw/nasa/acme.txt`; https://www.nasa.gov/wp-content/uploads/2025/07/advanced-combustion-via-microgravity-experiments-acme.pdf.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "pure-fuel coflow flames" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not expect heat or smoke to collect overhead; products follow the ventilation flow or stay around the flame." -> "The cited coflow comparison attributes the absence of rising hot gases in microgravity to the absence of buoyancy.".

### ACME-032: CLD Flame, SLICE precursor: flame length

Fields changed: quote, conditions, decision_hint.
Reason and context: The live NTRS abstract names SLICE and describes computation plus ISS measurements. The complete semicolon-delimited conclusion is quoted; it is precursor evidence, not CLD flight data.
Evidence: `raw/ntrs/20150002322.txt`; https://ntrs.nasa.gov/citations/20150002322.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity compared with normal gravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS (SLICE, precursor to CLD Flame)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted methane, CH4 mole fraction 0.4 to 1.0" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "air" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "average inlet velocity 23 to 90 cm/s" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "For a gas leak fire, expect a longer flame than the same flow would give on Earth." -> "SLICE reported longer nonbuoyant luminous flames than the 1-g comparison; the conclusion is specific to the investigated coflow flames.".

### ACME-033: E-FIELD Flames, weak flames stabilized by small electric fields

Fields changed: quote, conditions, decision_hint.
Reason and context: Section 4.D.4 reports weak-flame stabilization at ignition and calls the zero-gravity effect a surprise; the following proxy suggestion is preserved as a suggestion.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Consider de-energizing high-voltage equipment near a suspected fire: an electric field can keep a marginal flame burning." -> "Small electric fields stabilized the reported weak flames at ignition; this is an experimental observation, not an equipment shutdown procedure.".

### ACME-034: E-FIELD Flames, electric field as a stand-in for partial gravity

Fields changed: conditions, evidence_level, decision_hint.
Reason and context: The quote suggests electric fields as a possible tool to approximate partial-gravity buoyancy. It reports no experiment conducted in lunar or Martian gravity.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `conditions.gravity`: "microgravity (electric body force suggested as a proxy for partial gravity)" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "review or summary".
- `decision_hint`: "Mark lunar and Martian gravity conclusions drawn from E-FIELD Flames as extrapolated: the body force was electric, not gravity." -> "Approximating partial-gravity buoyancy with an electric field is suggested here, not demonstrated by a partial-gravity test.".

- Added `conditions_quote`, a complete sentence from the same E-FIELD report identifying ISS operations. The main quote says zero gravity while mentioning a proposed partial-gravity proxy; without this same-document context the build gravity-word parser would pick partial gravity. The retained condition is microgravity and the evidence remains review or summary. No partial-gravity test is claimed.

### ACME-035: E-FIELD Flames, stabilization at high dilution without coflow

Fields changed: conditions.
Reason and context: The report explicitly states microgravity stabilization at high dilution, especially without coflowing air. Species and platform are not named in this quote.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane/nitrogen mixtures" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "coflow burner, with and without coflowing air" -> "no coflowing air". Confined to the quoted setting, without inherited context.

### ACME-036: E-FIELD Flames, blow out by electric field

Fields changed: conditions, decision_hint.
Reason and context: The Additional Objectives discussion explicitly reports blowout under some conditions; the original hint incorrectly denied that testing had occurred.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "An electric field is not a tested suppression method: the report gives no blow-out conditions." -> "Electric-field blowout was observed under some conditions; the quoted statement does not identify a general suppression setting.".

### ACME-037: E-FIELD Flames, soot in microgravity

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.2 directly gives the microgravity versus 1-g sooting comparison, without specifying fuel species in this sentence.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Expect more soot from a gas-jet or coflow flame than ground tests of the same flame suggest." -> "The E-FIELD Flames report describes more significant sooting in its microgravity comparison than at similar 1-g conditions.".

### ACME-038: E-FIELD Flames, unpredictable sooty flames in a field

Fields changed: claim, conditions, decision_hint.
Reason and context: The source hedges both the mixing explanation and identification of luminous particles; those hedges are retained, without claiming secondary ignition was measured.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `claim`: "When soot is present, electric fields create a wide range of unpredictable behaviors, including elimination of the soot, showers of luminous particles that are likely incandescent soot agglomerates, and unstable dancing flames." -> "In the E-FIELD Flames results, electric fields acting on sooty flames produced unpredictable behavior, including soot elimination apparently through enhanced mixing, luminous particles likely to be incandescent soot agglomerates, and unstable dancing flames.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "sooty methane and ethylene flames" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Near high-voltage hardware, expect a sooty flame to throw glowing particles; treat them as possible ignition sources." -> "The reported electric-field effects included luminous particles and unstable flame motion; the quote does not measure their ability to ignite another item.".

### ACME-039: E-FIELD Flames, corona and arc discharge

Fields changed: quote, conditions.
Reason and context: The high-field jet-flame observation is followed by the source qualification that the behavior was difficult to characterize; both sentences are retained.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "gas-jet flames (methane and ethylene)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-040: E-FIELD Flames, ion current as a flame signal

Fields changed: quote, conditions, decision_hint.
Reason and context: The complete first sentence of Section 4.D.1 includes the V-I comparison and peak ion current. It does not validate ion-current fire detection.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Flame ion current is a possible sensing signal, but its response differs from ground data; calibrate any ion-based detector with microgravity data." -> "E-FIELD Flames found a peak rather than a distinctive saturation plateau in the microgravity voltage-current curve; the quote does not validate a detector.".

### ACME-041: E-FIELD Flames, ion current tracks combustion intensity

Fields changed: claim, conditions, earth_instinct, decision_hint.
Reason and context: The source says the results suggest the relationship between robust burning, ion current and compactness; the claim now retains suggest.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `claim`: "There are clear correlations between flame luminosity, combustion intensity and ion current: the most robust burning also produces the highest ion current, even though the flame is most compact." -> "The E-FIELD Flames report finds correlations between luminosity, combustion intensity and ion current, and suggests that the most robust burning produces the highest ion current even when the flame is most compact.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `earth_instinct`: "The biggest flame is the strongest one." -> null.
- `decision_hint`: "Do not judge fire strength by flame size alone; a compact flame can be the most intense." -> "The report suggests that the most compact flame could correspond to the most robust burning in this experiment.".

### ACME-042: E-FIELD Flames, field strength that removes soot

Fields changed: conditions.
Reason and context: The negative-field gas-jet discussion states that soot disappeared at 0.80 kV/cm after the ion-current peak. No specific fuel or velocity is stated in this sentence.
Evidence: `raw/pdf/PSI-22_e-field-flames-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "methane (gas-jet burner)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "methane jet at 19 cm/s, negative field applied" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-043: Flame Design, critical extinction temperature and mass flux

Fields changed: claim, conditions, decision_hint.
Reason and context: Section 4.D summarizes the ISS extinction analysis. These are critical reactant mass fluxes at the flame, not total burner inlet flow rates or universal extinction thresholds.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `claim`: "All the ISS flames observed by Flame Design extinguished at a critical temperature of 1130 K, at a fuel mass flux of 0.2 g/m2-s for normal flames and an oxygen mass flux of 0.68 g/m2-s for inverse flames." -> "For the ISS flames in its reported extinction analysis, Flame Design gives a critical extinction temperature of 1130 K, with fuel mass flux of 0.2 g/m2-s for normal flames and oxygen mass flux of 0.68 g/m2-s for inverse flames.".
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene with nitrogen diluent" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "normal flames: ambient oxygen mole fraction 0.2 to 0.38; inverse flames: burner supply oxygen mole fraction 0.4 to 0.85" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "atmospheric pressure (1 bar)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber; total mass flow rate 0.6 to 12.2 mg/s (normal flames), 2.3 to 11.3 mg/s (inverse flames)" -> "at extinction: normal-flame fuel mass flux 0.2 g/m2-s; inverse-flame oxygen mass flux 0.68 g/m2-s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "A modeling input for still-air gas flames: below about 1130 K, or below these reactant fluxes, the flame goes out by radiative loss." -> "The quoted extinction temperature and reactant fluxes describe the reported Flame Design analysis, not universal fire cutoff values.".

### ACME-044: Flame Design, steady flames despite radiative loss

Fields changed: conditions, evidence_level, decision_hint.
Reason and context: The quoted existence and size/temperature criteria are analytical conclusions from a combined ISS and transient-model study. They do not demonstrate permanent burning.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene, diluted with nitrogen" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "oxygen diluted with nitrogen" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber; constant reactant flow from the burner" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "model or analysis".
- `decision_hint`: "A small gas-fed flame in still air can be permanent as long as the gas keeps flowing; isolate the gas source." -> "The reported analysis allows steady spherical flames only under its stated flame-size and temperature conditions.".

### ACME-045: Flame Design, longest steady flame

Fields changed: conditions, decision_hint.
Reason and context: The same abstract explicitly distinguishes observed ISS behavior up to 870 s from subsequent numerical simulations over 100,000 s.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene, diluted with nitrogen" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber; constant reactant flow from the burner" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not wait for a small gas-fed flame to burn itself out; it lasted more than 14 minutes in the experiment." -> "Flame Design observed steady-state behavior for up to 870 s within a narrow range of attainable conditions.".

### ACME-046: Flame Design, oscillation before extinction

Fields changed: conditions, decision_hint.
Reason and context: The 2021 study abstract in the report explicitly describes partial extinction and reformation before complete extinction.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene in an oxygen/nitrogen mixture" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "atmospheric pressure" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A flame that partly goes out can reform several times; confirm extinction over time before standing down." -> "The reported Flame Design flames could partially extinguish and reform before complete extinction.".

### ACME-047: Flame Design, radiative extinction mechanism

Fields changed: conditions.
Reason and context: The discovery summary describes radiative extinction at constant reactant flow as heat loss approaches chemical heat release.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene in an oxygen/nitrogen mixture" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber; constant reactant flow rate" -> "constant reactant flow rate". Confined to the quoted setting, without inherited context.

### ACME-048: Flame Design, flame size versus flow and oxygen

Fields changed: conditions, decision_hint.
Reason and context: The named Flame Design section reports this relation for normal-flame ISS tests; flame size alone is not a quoted intensity measurement.
Evidence: `raw/pdf/20210021781.txt`; https://ntrs.nasa.gov/citations/20210021781.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "In an oxygen-enriched cabin a gas-fed flame is smaller for the same fuel flow; a smaller flame does not mean a weaker fire." -> "In the normal-flame ISS tests, increasing ambient oxygen reduced flame size at the compared reactant flows.".

### ACME-049: Flame Design, burn times and flame growth

Fields changed: claim, conditions.
Reason and context: The source is the 2021 normal spherical-flame study abstract, not the separate 870 s study. The quoted 28 to 336 s range and temperature trend are retained.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `claim`: "Burn times of the normal ethylene spherical flames ranged from 28 to 336 s; all flames grew monotonically after ignition and peak gas temperature generally decreased with time." -> "In the reported Flame Design study, burn times ranged from 28 to 336 s, all flames grew monotonically after ignition, and peak gas temperature generally decreased with time.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene in an oxygen/nitrogen mixture" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "atmospheric pressure" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-050: Flame Design, time to reach steady state

Fields changed: conditions, decision_hint.
Reason and context: The quoted 100,000 s is the theoretical infinite-domain characteristic time, not an ISS flame duration.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene, diluted with nitrogen" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A still-air flame keeps changing slowly for a very long time; one short observation does not show its final state." -> "The roughly 100,000 s estimate applies to the idealized spherical, infinite-domain diffusion system.".

### ACME-051: Flame Design, oxygen range tested

Fields changed: conditions, evidence_level, decision_hint.
Reason and context: The Follow-On Experiments discussion gives safety-imposed test concentration limits. It is classified as operations, not evidence that those limits are safe cabin settings.
Evidence: `raw/pdf/PSI-10_flame-design-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "ethylene" -> "ethylene (inverse-flame mole fraction limit 65%)". Confined to the quoted setting, without inherited context.
- `conditions.o2_percent`: "up to 40 (normal flames)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `evidence_level`: "flight experiment" -> "operations".
- `decision_hint`: "Mark normal-flame behavior in ambient oxygen above 40% as not tested by Flame Design." -> "The 40% oxygen value was a safety limit on normal-flame testing, not a demonstrated safe cabin atmosphere.".

### ACME-052: Flame Design, soot and flame structure (drop tower precursor)

Fields changed: claim, quote, conditions.
Reason and context: The NASA report identifies the experiments as DESI drop-tower precursor work. The widened quote includes the actual ethylene rate, pressure, still ambient and smaller convection-direction effect.
Evidence: `raw/pdf/20050195844.txt`; https://ntrs.nasa.gov/citations/20050195844.

- `claim`: "In 2.2-second drop tower tests of spherical ethylene flames, flame structure had a defining influence on soot production: soot was suppressed entirely when nitrogen was supplied with the fuel." -> "In the DESI precursor tests described in the source, four spherical ethylene flames burned at 1.5 mg/sec in a still ambient at 1 atm; soot was suppressed entirely when nitrogen was supplied with the fuel, with convection direction having a smaller influence.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "2.2-Second Drop Tower, NASA Glenn" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "still ambient" -> "still ambient; ethylene flow 1.5 mg/sec". Confined to the quoted setting, without inherited context.

### ACME-053: s-Flame, two extinction modes

Fields changed: quote, conditions, decision_hint.
Reason and context: The source says seem and immediately requires computational comparison to assess extinction behavior; both limitations are retained.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "air" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere; fuel flow rate varied" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A still-air gas flame survives only in a window of fuel flow; both a falling and a rising leak rate can end it." -> "The s-Flame report tentatively identifies low-flow kinetic and high-flow radiative extinction and calls for computational comparison.".

### ACME-054: s-Flame, flow window for a spherical ethylene flame

Fields changed: claim, conditions.
Reason and context: The direct test discussion reports the 20-30% C2H4 mixtures and the three flow settings. Nitrogen balance, oxygen and quiescence are not in this quote.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `claim`: "For 20-30% ethylene in nitrogen, spherical non-sooty flames established at 3 cc/s went to kinetic extinction on ramp down before reaching 1 cc/s and to radiative extinction on ramp up before reaching 8 cc/s." -> "For mixtures with 20-30% ethylene, spherical non-sooty flames established at 3 cc/s underwent kinetic extinction on ramp down before reaching 1 cc/s and radiative extinction on ramp up before reaching 8 cc/s.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted C2H4, 20-30%" -> "mixtures with 20-30% C2H4". Confined to the quoted setting, without inherited context.
- `conditions.o2_percent`: "21 (21% O2 / 79% N2)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere; fuel-mixture flow ramped between 1 and 8 cc/s" -> "established at 3 cc/s; ramped down toward 1 cc/s or up toward 8 cc/s". Confined to the quoted setting, without inherited context.

### ACME-055: s-Flame, radiative extinction is common

Fields changed: conditions, decision_hint.
Reason and context: The source explicitly names ISS testing and radiative extinction; it does not claim that all ground low-gravity experiments are too short.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Ground low-gravity tests are too short to show radiative extinction; prefer long-duration data when judging whether a still-air flame sustains." -> "Radiative extinction was common in the s-Flame ISS tests despite not being observed previously for those flame conditions.".

### ACME-056: s-Flame, no soot from ethylene flames

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.2 reports microgravity ethylene soot only during hotwire ignition followed by dissipation, without measuring smoke-detector performance.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `conditions.gravity`: "microgravity compared with normal gravity" -> "microgravity". Confined to the quoted setting, without inherited context.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "A still-air gas flame may give little or no soot; do not rely on smoke particles alone to detect it." -> "Soot in these s-Flame ethylene tests appeared during forced ignition and then dissipated.".

### ACME-057: s-Flame, brightness is not strength

Fields changed: conditions, decision_hint.
Reason and context: Section 4.D.8 directly states that luminosity need not correspond to combustion intensity, without recommending a sensing technology.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not judge severity by how bright the flame looks; use temperature or radiation readings." -> "The s-Flame report says flame brightness did not necessarily indicate combustion intensity.".

### ACME-058: s-Flame, barely visible hydrogen flames

Fields changed: conditions, decision_hint.
Reason and context: The operational account names nitrogen-diluted hydrogen and the three instrument types that revealed the faint flames; no ultraviolet detector recommendation is quoted.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "For hydrogen systems, rely on thermal, radiometric or UV sensing; a crew member may not see the flame." -> "The faint nitrogen-diluted hydrogen flames were evident in thermocouple, radiometer and photomultiplier-tube measurements.".

### ACME-059: s-Flame, hydrogen flames missed by cameras

Fields changed: conditions, decision_hint.
Reason and context: Hardware Shortcomings names the DataCam and analog operations camera and their poor hydrogen-flame visibility.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "pure hydrogen and diluted hydrogen" -> "pure and diluted hydrogen". Confined to the quoted setting, without inherited context.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Do not rely on ordinary video to confirm or rule out a hydrogen fire." -> "The reported hydrogen flames were difficult to image with the named s-Flame cameras.".

### ACME-060: s-Flame, hydrogen flames did not self-extinguish

Fields changed: claim, quote, conditions, decision_hint.
Reason and context: The immediate However sentence reports apparent kinetic extinction during ramp down. It is included so absence of observed radiative extinction is not misread as absence of all extinction.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `claim`: "Nitrogen-diluted hydrogen flames seem to need very large sizes to self-extinguish: radiative extinction was not observed in the cases run, even with lower hydrogen concentration." -> "Nitrogen-diluted hydrogen flames seemed to require very large sizes to self-extinguish; radiative extinction was not observed in the cases run despite lower hydrogen concentration, although kinetic extinction appeared during ramp down.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "nitrogen-diluted hydrogen (45%-15% H2)" -> "nitrogen-diluted hydrogen". Confined to the quoted setting, without inherited context.
- `conditions.o2_percent`: "air" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere; e.g. 10 cc/s" -> "ramp down for apparent kinetic extinction". Confined to the quoted setting, without inherited context.
- `decision_hint`: "Do not expect a hydrogen leak flame to go out by radiative loss as hydrocarbon flames did; stop the hydrogen supply." -> "Radiative extinction was not observed for the tested nitrogen-diluted hydrogen flames; kinetic extinction appeared possible during ramp down.".

### ACME-061: s-Flame, flash and re-ignition before extinction

Fields changed: claim, quote, conditions, earth_instinct, decision_hint.
Reason and context: The complete day-20132 paragraph states fuel, oxidizer, flow range, apparent flashes and ongoing investigation. Re-ignition remains an interpretation, not an unqualified finding.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `claim`: "At 5-10 cc/s, flames seemed to disappear and re-ignite with a flash before final extinction." -> "In s-Flame test day 20132, with 25% hydrogen / 20% methane / 55% helium issuing into 21% oxygen / 79% helium, flames at 5-10 cc/s seemed to disappear and re-ignite with a flash before final extinction; the phenomenon was still under investigation.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "21 (21% O2 / 79% He)" -> "21". Confined to the quoted setting, without inherited context.
- `conditions.flow`: "quiescent atmosphere; 5-10 cc/s" -> "5-10 cc/s for the reported flashes". Confined to the quoted setting, without inherited context.
- `earth_instinct`: "Once the flame disappears, the fire is out." -> null.
- `decision_hint`: "After a flame vanishes, keep watching: it re-ignited with a flash in these tests." -> "The reported flashes only seemed to be re-ignition and remained under investigation.".

### ACME-062: s-Flame, elevated oxygen and ignition

Fields changed: claim, quote, conditions, decision_hint.
Reason and context: The full day-20142 paragraph ties the oxygen/ignition statement to a particular helium-diluted mixture and reports the subsequent radiative extinction.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `claim`: "An elevated oxygen ambient facilitates ignition and results in a smaller characteristic flame size." -> "For the reported 30% hydrogen / 15% methane / 55% helium blend issuing into 30% oxygen / 70% helium, elevated oxygen facilitated ignition and reduced characteristic flame size; the 5-16.5 cc/s flames expanded to oscillatory radiative extinction.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "30 (30% O2 / 70% He)" -> "30". Confined to the quoted setting, without inherited context.
- `conditions.flow`: "quiescent atmosphere" -> "5-16.5 cc/s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "In an oxygen-enriched cabin, expect easier ignition and a more compact flame." -> "The ignition and flame-size observation applies to the reported helium-diluted fuel and oxidizer case.".

### ACME-063: s-Flame, dilution limit for methane at 30% oxygen

Fields changed: conditions.
Reason and context: The sentence reports prompt extinction of the 15% CH4 / 85% N2 mixture. The 30% oxygen condition is outside this quotation and is not carried into conditions.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "30 (30% O2 / 70% N2)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-064: s-Flame, helium dilution

Fields changed: quote, conditions, decision_hint.
Reason and context: The complete summary retains difficulty observing kinetic extinction and the need for further instability analysis.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "helium-diluted hydrogen, methane, hydrogen/methane and ethylene" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "21 and 30 (helium balance)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Helium changes ignition and extinction limits compared with nitrogen; do not swap inert gases in a model without data for that gas." -> "The reported helium cases differed from nitrogen cases, but kinetic extinction remained difficult to observe.".

### ACME-065: s-Flame, no ignition in 21% oxygen with helium

Fields changed: claim, conditions.
Reason and context: This sentence occurs in the test-day-20164 discussion of 20% C2H4 / 80% He. Its ignition-parameter restriction is preserved; the unquoted fuel is not carried into conditions.
Evidence: `raw/pdf/PSI-23_s-flame-final-report-20210729.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e.

- `claim`: "Ignition was not achieved in tests in a 21% O2 / 79% He atmosphere, for the ignition parameters used." -> "In the reported s-Flame test-day-20164 case, ignition was not achieved in the 21% oxygen / 79% helium atmosphere for the ignition parameters used.".
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "20% C2H4 / 80% He" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "21 (21% O2 / 79% He)" -> "21". Confined to the quoted setting, without inherited context.
- `conditions.flow`: "quiescent atmosphere" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-066: CFI-G, first spherical cool flames of gaseous fuel

Fields changed: quote, conditions.
Reason and context: The widened NASA account names CFI-G, distinguishes earlier liquid-fuel FLEX work from the new gaseous-fuel result, and locates the new work aboard the station.
Evidence: `raw/nasa/cool-flames-first.txt`; https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-067: CFI-G, conditions that gave cool flames

Fields changed: conditions, decision_hint.
Reason and context: The CFI-G result is specifically restricted to normal n-butane flames at 2 bar and ambient oxygen mole fraction 0.39. Multiplication by 100 gives 39%; this is not an inverse-flame oxidizer condition.
Evidence: `raw/pdf/PSI-159_cfi-g-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=691f7ea117f78b371b26f6f8.

- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "39" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "In CFI-G, cool flames of gaseous fuel appeared only at raised pressure and oxygen; the data do not show them at cabin-like conditions." -> "The cited CFI-G result was obtained only for the specified normal n-butane flames at 2 bar and oxygen mole fraction 0.39.".

### ACME-068: CFI-G, cool flames too faint to see

Fields changed: conditions, decision_hint.
Reason and context: NASA explicitly reports three cool flames discovered retrospectively through radiation and burner-temperature data after hot-flame quenching.
Evidence: `raw/nasa/cool-flames-first.txt`; https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/.

- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "gaseous fuels" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "After the visible flame is gone, check radiation and temperature readings before declaring the fire out." -> "In these CFI-G tests, thermal-radiation and burner-temperature data revealed cool flames that were not visible in real time.".

### ACME-069: CFI-G, cool flame after hot flame quenches

Fields changed: quote, conditions, decision_hint.
Reason and context: The complete caption context identifies intensified filtered imaging and then the dark interval and cool-flame appearance; it is not an ordinary-camera visibility result.
Evidence: `raw/nasa/cool-flames-first.txt`; https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "gaseous fuels" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `decision_hint`: "Treat the moment a hot flame goes dark as unconfirmed: low-temperature burning can continue unseen." -> "The intensified CFI-G images showed a cool flame after the hot flame quenched and a roughly one-second dark interval.".

### ACME-070: CFI-G, cool flame size

Fields changed: quote, conditions.
Reason and context: The preceding However sentence now accompanies the size ratio, identifying the same normal n-butane, 2 bar, 0.39 oxygen-mole-fraction cases.
Evidence: `raw/pdf/PSI-159_cfi-g-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=691f7ea117f78b371b26f6f8.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "39" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

### ACME-071: CFI-G, cool flame temperature

Fields changed: decision_hint.
Reason and context: The 500 to 1000 K range is background in the report Impacts section, not a CFI-G temperature measurement or validated detector setting.
Evidence: `raw/pdf/PSI-159_cfi-g-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=691f7ea117f78b371b26f6f8.

- `decision_hint`: "Set thermal detection thresholds knowing that a cool flame can burn at 500 to 1000 K." -> "The cited summary gives cool-flame peak temperatures of 500 to 1000 K; it provides no validated detector threshold.".

### ACME-072: CFI-G, hot-flame reignition from a cool flame

Fields changed: claim, quote, conditions, earth_instinct, decision_hint.
Reason and context: The Hardware Shortcomings account attributes the observed hot-flame reignition to platinum catalysis in the closest exposed type-B thermocouple; it does not imply all extinguished fires reignite. The following sentence restricts the cool flames on that day to short-lived events and is included.
Evidence: `raw/pdf/PSI-159_cfi-g-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=691f7ea117f78b371b26f6f8.

- `claim`: "On an added test day, cool flames reignited as hot flames because of catalysis from the platinum in an exposed type-B thermocouple close to the burner." -> "In the reported CFI-G tests, hot-flame reignition from cool flames was attributed to catalysis by platinum in the exposed type-B thermocouple closest to the burner.".
- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "n-butane (normal flames)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `earth_instinct`: "A fire that has gone out cannot come back without a new spark." -> null.
- `decision_hint`: "A cool flame can turn back into a hot flame on a catalytic surface such as platinum; keep suppression ready after the visible flame is gone." -> "CFI-G attributed the reported hot-flame reignition to platinum catalysis in a particular thermocouple.".

### ACME-073: CFI-G, repeated hot-to-cool transitions in one test

Fields changed: source, conditions, decision_hint.
Reason and context: Complete CSV row 21291 C1 was checked against headers: Fuel, XO2 before/after test, approx p (bar), mHC (mg/s), burn time (sec), and Comments. Oxygen percentages are the two mole fractions multiplied by 100. The raw table row is a structured citation, not prose.
Evidence: `raw/psi/tables/PSI-159_Experimental table_CFI-G_Normal Flames.csv`; https://psi.nasa.gov/physci/repo/data/investigations/PSI-159.

- `source`: raw/psi/tables/PSI-159_Experimental table_CFI-G_Normal Flames.csv (https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=PSI-159_Experimental%20table_CFI-G_Normal%20Flames.csv) -> raw/psi/tables/PSI-159_Experimental table_CFI-G_Normal Flames.csv (https://psi.nasa.gov/physci/repo/data/investigations/PSI-159). Use the canonical PSI investigation page; the old download-by-filename URL was not a verified file endpoint.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.o2_percent`: "39.4 before test, 38.9 after test" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "2.0266 bar (approximate)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "quiescent chamber; hydrocarbon flow 1 mg/s" -> "hydrocarbon mass flow 1 mg/s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "A fire can alternate between visible hot burning and dim cool burning; one look is not enough to call it out." -> "The cited CFI-G row records repeated hot-to-cool transitions in one test; it does not validate a fire-clearance procedure.".

### ACME-074: CFI-G, highest-oxygen tests (inverse flames)

Fields changed: claim, source, conditions, decision_hint.
Reason and context: Complete inverse-flame CSV row 21222 A3 was checked against Fuel, Xf before test, approx p (bar), XO2, HC burnrate (mg/s), O2 flow rate (mg/s), burn time (sec) and Self-ext or flow term. SE denotes self-extinction in the source table. XO2 refers to burner oxidizer for inverse flames.
Evidence: `raw/psi/tables/PSI-159_Experimental table_CFI-G_Inverse Flames.csv`; https://psi.nasa.gov/physci/repo/data/investigations/PSI-159.

- `claim`: "CFI-G inverse flames were run with an oxidizer oxygen mole fraction of 0.85; in test 21222 A3 (propane, about 3.3 bar) the flame burned 18 s and self-extinguished." -> "In CFI-G inverse-flame test 21222 A3, the table records propane, approximate pressure 3.3099 bar, burner oxidizer oxygen mole fraction 0.85, burn time 18 s and self-extinction (SE).".
- `source`: raw/psi/tables/PSI-159_Experimental table_CFI-G_Inverse Flames.csv (https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=PSI-159_Experimental%20table_CFI-G_Inverse%20Flames.csv) -> raw/psi/tables/PSI-159_Experimental table_CFI-G_Inverse Flames.csv (https://psi.nasa.gov/physci/repo/data/investigations/PSI-159). Use the canonical PSI investigation page; the old download-by-filename URL was not a verified file endpoint.
- `conditions.gravity`: "microgravity" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.fuel`: "propane (inverse flame; fuel mole fraction 0.0799 before test)" -> "propane (inverse flame; fuel mole fraction 0.079906404 before test)". Confined to the quoted setting, without inherited context.
- `conditions.o2_percent`: "85 (XO2 0.85)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.pressure`: "3.3099 bar (approximate)" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.
- `conditions.flow`: "O2 flow rate 9.07 mg/s; HC burn rate 2.5 mg/s" -> "O2 flow rate 9.069954649 mg/s; HC burn rate 2.5 mg/s". Confined to the quoted setting, without inherited context.
- `decision_hint`: "These are inside-out flames (oxidizer injected into fuel); use them as the highest-oxygen microgravity data in PSI, not as a cabin atmosphere at 85% oxygen." -> "The 0.85 oxygen mole fraction belongs to the inverse-flame burner oxidizer, not the chamber atmosphere.".

### ACME-075: CFI-G, inverse flames are inside out

Fields changed: quote, conditions.
Reason and context: The widened overview names ISS operations and the inverse configuration: nitrogen/fuel in the chamber and oxygen/nitrogen from the burner. It makes no claim that chamber oxygen is 85%.
Evidence: `raw/pdf/PSI-159_cfi-g-final-report.txt`; https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=691f7ea117f78b371b26f6f8.

- `quote`: widened to complete contextual sentences or the complete semicolon-delimited conclusion; the final quotation was checked against its saved source.
- `conditions.platform`: "ISS Combustion Integrated Rack (CIR), ACME chamber insert" -> null. The original setting was not inside this result quote or could not survive the literal numeric/units gate.

## Changed investigation records

### BRE

Removed the unquoted dome-shape detail from sample_geometry; confined the flow example to the quoted 2.3 g/m2s instead of adding 4.95. The objectives now have the full approved-objectives passage, and hardware has its insert/burner citations. Variables were narrowed to the two quoted round-comparison statements. Measurements distinguish quoted radiometer measurements and second-round TFP data from an unquoted array claim.

- `sample_geometry`: "Flat porous circular gas burners of 25 mm and 50 mm diameter that emulate a flat condensed-fuel surface; a dome-shaped flame forms over the burner." -> "Flat porous circular gas burners of 25 and 50 mm diameter, used to emulate burning of solid and liquid fuels.".
- `conditions`: {"o2_percent": "approximately 21, 25, 26.5, 34 and 40 (by volume, nitrogen balance)", "pressure": "14.7 psia, 10.2 psia and 8.2 psia atmospheres examined; more tests at roughly atmospheric pressure", "flow": "quiescent chamber, no forced air flow; fuel fed through the burner (examples: 2.3 to 4.95 g/m2s)", "gravity": "microgravity (ISS)"} -> {"o2_percent": "approximately 21, 25, 26.5, 34 and 40 (by volume, nitrogen balance)", "pressure": "14.7 psia, 10.2 psia and 8.2 psia atmospheres examined; more tests at roughly atmospheric pressure", "flow": "quiescent ambient; quoted example fuel mass flux 2.3 g/m2s", "gravity": "microgravity (ISS)"}.
- `variables`: "Varied: fuel (ethylene, nitrogen-diluted ethylene, methane), burner diameter (25 or 50 mm), fuel flow rate, ambient oxygen concentration and chamber pressure. Held: O2/N2 atmosphere with no air flow. Round one used ethylene and the 25 mm burner; round two added methane and the 50 mm burner. Desired O2/CO2 atmospheres were not tested." -> "The first round was limited to ethylene and the 25 mm burner; the second added methane and the 50 mm burner, although not together. Desired carbon-dioxide-diluted atmosphere testing was not conducted.".
- `measurements`: ["heat flux to the burner (two heat flux transducers per burner)", "burner surface temperature", "color video", "thermal radiation (radiometer array)", "flame temperature by thin filament pyrometry"] -> ["burner heat flux (two heat flux transducers per burner)", "burner surface temperature", "color video", "thermal radiation (radiometer measurements)", "thin-filament pyrometry data (second round)"].
- `sources`: 29 -> 34 entries, all final quotes checked verbatim.

### CLD Flame

Removed unsupported pure-fuel qualifiers and unquoted tube-role assignments; objectives and variables now repeat only their cited content. PSI future-tense OH*/CH* and thin-filament-pyrometry methods are labelled planned, not claimed as completed measurements.

- `objectives`: "Characterize weak coflow diffusion flames of methane and ethylene as a function of velocity and fuel dilution (flame shape, lift-off heights, temperatures, extinction limits), and the sooting tendencies of flames with long residence times, to extend the range of flame conditions that models predict accurately." -> "Characterize weak coflow methane and ethylene flames as functions of velocity and fuel dilution through flame shape, lift-off height, temperature and extinction-limit measurements; characterize sooting tendencies of long-residence-time flames as functions of velocity and dilution.".
- `fuels`: ["methane (CH4), pure and diluted with nitrogen", "ethylene (C2H4), pure and diluted with nitrogen"] -> ["methane (CH4), with nitrogen dilution", "ethylene (C2H4), with nitrogen dilution"].
- `sample_geometry`: "Coaxial coflow burner: central fuel tube of 2.1 mm inner diameter inside a 25 mm tube carrying the air coflow; attached sooty flames and lifted dilute flames." -> "Coflow burner with two concentric tubes of 2.1 and 25 mm inner diameter; lifted flames are studied to avoid dependence on burner heat loss.".
- `variables`: "Varied: fuel (methane or ethylene), nitrogen dilution of the fuel (down to extinction) and the matched fuel and coflow velocity. Held: air coflow and the coflow burner." -> "Injection velocity and fuel dilution, spanning very dilute and highly sooting flame conditions.".
- `measurements`: ["flame temperature", "CH* concentration", "soot temperature", "soot volume fraction", "OH* and CH* chemiluminescence for lift-off height and flame shape", "thin-filament pyrometry in non-sooting regions"] -> ["flame temperature", "CH* concentration", "soot temperature", "soot volume fraction", "planned OH* and CH* chemiluminescence for lift-off height and flame shape (PSI approach)", "planned thin-filament pyrometry in non-sooting regions (PSI approach)"].
- `sources`: 25 -> 26 entries, all final quotes checked verbatim.

### E-FIELD Flames

Removed unsupported pure-fuel qualifiers. The flow field lists the cited 15, 19 and 27 cm/s examples rather than implying an entire continuous range; it separately identifies 3.1 cm/s coflow and the cited no-coflow route. Removed the assumption that one quoted 21/79 case established a held atmosphere for every test. Added method and hardware citations.

- `fuels`: ["methane (CH4), pure and diluted with nitrogen", "ethylene (C2H4), pure and diluted with nitrogen"] -> ["methane (CH4), diluted with nitrogen", "ethylene (C2H4), diluted with nitrogen"].
- `conditions`: {"o2_percent": "21 (21/79 oxygen/nitrogen by volume)", "pressure": null, "flow": "fuel velocity of about 15 to 27 cm/s in the reported cases; weak coflow of 3.1 cm/s or no coflow", "gravity": "microgravity (ISS), compared with 1-g laboratory flames"} -> {"o2_percent": "21 (21/79 oxygen/nitrogen by volume)", "pressure": null, "flow": "reported fuel-velocity examples: 15, 19 and 27 cm/s; reported coflow example: 3.1 cm/s; tests also conducted without air coflow", "gravity": "microgravity (ISS), compared with 1-g laboratory flames"}.
- `variables`: "Varied: electric field strength and polarity, burner type (gas-jet or coflow), fuel (methane or ethylene), nitrogen dilution of the fuel, fuel flow rate and coflow velocity. Held: 21/79 oxygen/nitrogen atmosphere." -> "Fuel flow rate, coflow velocity and field polarity were varied; gas-fueled flames were studied with and without a coflow of air.".
- `sources`: 22 -> 30 entries, all final quotes checked verbatim.

### Flame Design

Removed unquoted quiescent-chamber wording from the flow field; retained the explicitly cited constant reactant feed and separate normal/inverse mass-flow ranges. Added direct citations for detailed/extinction objectives, fuel composition, normal/inverse geometry, variable conditions and the CSV pressure-unit header.

- `conditions`: {"o2_percent": "normal flames: ambient oxygen mole fraction 0.2 to 0.38 (limit 40%); inverse flames: burner supply oxygen mole fraction 0.4 to 0.85", "pressure": "published extinction results at 1 bar; chamber pressure was also varied (the PSI inverse-flame table lists an initial pressure of 3.0 atm in some tests)", "flow": "quiescent chamber; constant reactant flow from the burner, total mass flow 0.6 to 12.2 mg/s (normal) and 2.3 to 11.3 mg/s (inverse)", "gravity": "microgravity (ISS)"} -> {"o2_percent": "normal flames: ambient oxygen mole fraction 0.2 to 0.38 (limit 40%); inverse flames: burner supply oxygen mole fraction 0.4 to 0.85", "pressure": "published extinction results at 1 bar; chamber pressure was also varied (the PSI inverse-flame table lists an initial pressure of 3.0 atm in some tests)", "flow": "constant reactant flow from the burner; normal-flame total mass flow 0.6 to 12.2 mg/s and inverse-flame total mass flow 2.3 to 11.3 mg/s in the published extinction analysis", "gravity": "microgravity (ISS)"}.
- `sources`: 29 -> 54 entries, all final quotes checked verbatim.

### s-Flame

Flow is now labelled as reported examples, not the complete test range. Variables are narrowed to the cited inert replacement and mixture/flow variations. Measurements taken only from future-tense PSI metadata are labelled planned. Added direct objective and one-dimensional-geometry support.

- `conditions`: {"o2_percent": "about 21 and 30 (nitrogen or helium balance); 17.5 in helium in some tests", "pressure": "about 1 atm; pressure rises and oxygen drops with vitiation", "flow": "quiescent chamber; fuel-mixture flow from about 1 to 17.5 cc/s, constant or ramped", "gravity": "microgravity (ISS)"} -> {"o2_percent": "about 21 and 30 (nitrogen or helium balance); 17.5 in helium in some tests", "pressure": "about 1 atm; pressure rises and oxygen drops with vitiation", "flow": "quiescent ambient; examples include ramp-down extinction before reaching 1 cc/s and mixture tests at 10 to 17.5 cc/s", "gravity": "microgravity (ISS)"}.
- `variables`: "Varied: fuel and its dilution, the inert (nitrogen in round one, helium in round two), ambient oxygen concentration, and fuel flow rate (constant, ramp up, ramp down). Held: spherical burner in a still atmosphere at about 1 atm." -> "The second round replaced nitrogen diluent with helium; different fuel mixtures and flow rates were investigated.".
- `measurements`: ["spectrally resolved images", "flame and burner temperatures (thin filament pyrometry, thermocouples)", "radiative flux (radiometers)", "OH* and CH* chemiluminescence (photomultiplier tubes)", "reactant flow rates, pressures and acceleration levels"] -> ["spectrally resolved images (planned in PSI approach)", "flame and burner temperatures (thin-filament pyrometry, thermocouples)", "radiative flux (radiometers)", "OH* and CH* chemiluminescence; photomultiplier tubes", "reactant flow rates, pressures and acceleration levels (planned in PSI approach)"].
- `sources`: 27 -> 33 entries, all final quotes checked verbatim.

### CFI-G

Corrected the unsupported 0.75 to 2 mg/s cool-flame range to the explicitly reported 0.75 to 1.5 mg/s cases. Removed unquoted quiescence. Oxygen is now identified as exact quoted normal-chamber and inverse-burner examples rather than an over-rounded blanket range. Added CSV headers, nitrogen-diluent, simulation-objective and geometry/variables citations.

- `conditions`: {"o2_percent": "normal flames: ambient oxygen mole fraction about 0.18 to 0.40; inverse flames: burner oxidizer up to 0.85 oxygen mole fraction", "pressure": "about 0.5, 1, 2 and 3 bar (PSI tables)", "flow": "quiescent chamber; hydrocarbon or oxygen flow from the burner set in mg/s (0.75 to 2 mg/s of fuel in the cool-flame tests)", "gravity": "microgravity (ISS)"} -> {"o2_percent": "quoted normal-flame examples: oxygen mole fractions before test 0.3939 and 0.1802; quoted inverse-flame example: burner oxidizer oxygen mole fraction 0.85", "pressure": "about 0.5, 1, 2 and 3 bar (PSI tables)", "flow": "reported normal cool-flame cases: fuel mass flow 0.75 to 1.5 mg/s", "gravity": "microgravity (ISS)"}.
- `sources`: 30 -> 47 entries, all final quotes checked verbatim.

## Live source checks, 2026-11-14

All requests were serial with a one-second pause. Eleven cached PDFs matched the live NASA downloads byte for byte; their cached text also matched local pdftotext -layout after quotecheck normalisation. The ACME PDF text body matched its live PDF; the cool-flame page retained all cited text although HTML bytes differed.

fuente: https://ntrs.nasa.gov/api/citations/20140009169/downloads/20140009169.pdf | consultado: 2026-11-14 | 510998 bytes; sha256 7e6ca0acc5947a49493d6a8c50494acbfa43f08cf4a854b3544233f003e39d7d

fuente: https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d73c1b4820d736cec3a4 | consultado: 2026-11-14 | 5957884 bytes; sha256 c2f22c914b38d9e6742709688a2d1d81d8306e3c901b47314faf3b6ab43cec60

fuente: https://ntrs.nasa.gov/api/citations/20210021781/downloads/JASMAC%20ACME%20paper%2020210921.pdf | consultado: 2026-11-14 | 1336135 bytes; sha256 ee2b103565143c225042c52f9ca3c4938b16f61aec90035f054d9b13ef00df60

fuente: https://psi.nasa.gov/geode-py/ws/studies/PSI-20/download?file=6841d8171b4820d736cecc26 | consultado: 2026-11-14 | 731659 bytes; sha256 1858d5f0952b9e0fb81850dcdb3db04e7634ecfc9877adbd95fb9191461cb22b

fuente: https://ntrs.nasa.gov/api/citations/20210022542/downloads/ACME%20JASMAC-33%2020211007.pdf | consultado: 2026-11-14 | 2753389 bytes; sha256 6524faf4675134d7d7ca9be629ff95284d5b9acd38a4e230ede39c6a092e8ccf

fuente: https://psi.nasa.gov/geode-py/ws/studies/PSI-22/download?file=6851e75e0eb4c08676005585 | consultado: 2026-11-14 | 3529827 bytes; sha256 9be4013278966e85d99dc0ce05db9f3376d37724bf5ea9072ce7b2c48bc8e5a1

fuente: https://psi.nasa.gov/geode-py/ws/studies/PSI-10/download?file=691f7eef17f78b371b2705e0 | consultado: 2026-11-14 | 4152310 bytes; sha256 1d64b7f42f079579671624da5356cfe6d867ad014dd1d6932e9fcc6d3a1706fd

fuente: https://psi.nasa.gov/geode-py/ws/studies/PSI-23/download?file=6841ce426daf91e274cecd4e | consultado: 2026-11-14 | 3182281 bytes; sha256 2056f8f85291f49c1446981541e4689dc6df8ad02ef7ac0fddbd84e956968a3b

fuente: https://psi.nasa.gov/geode-py/ws/studies/PSI-159/download?file=691f7ea117f78b371b26f6f8 | consultado: 2026-11-14 | 3894907 bytes; sha256 f6cce7cc08ca69c155994d7a8898e21cd4aba122f4e46d5e00708e4889a1ebab

fuente: https://ntrs.nasa.gov/api/citations/20170009141/downloads/20170009141.pdf | consultado: 2026-11-14 | 547577 bytes; sha256 cf5715277583d0a75c7a07f1ec29e0d377ab691fd3c2409f40dc4eb32658ebd2

fuente: https://ntrs.nasa.gov/api/citations/20050195844/downloads/20050195844.pdf | consultado: 2026-11-14 | 120633 bytes; sha256 23ed67b1562789ddccaa0b4cb7d5f61a54318b86395957f233535abe52dede61

fuente: https://www.nasa.gov/wp-content/uploads/2025/07/advanced-combustion-via-microgravity-experiments-acme.pdf | consultado: 2026-11-14 | 850625 bytes; sha256 21d226540a4764db3f55a686daeecdb1d4fb7458502a0f8d2175a0e85ddad853

fuente: https://www.nasa.gov/missions/station/cool-flames-created-during-a-first-for-international-space-station-research/ | consultado: 2026-11-14 | 295528 bytes; sha256 27564c63da237606651222d650cd1f0cc6323b05c78cf0ad6548845bcc5fa59a

The guessed NTRS paths ending /20210021781.pdf and /20210022542.pdf returned HTTP 404. Reading each saved NTRS downloads[].links.pdf supplied the correct filename; those downloads matched the cached PDFs. No citation uses either guessed URL.

## Validation and limits

Initial command: `python3 tools/quotecheck.py evidence/acme.json --refetch --report evidence/acme.quotecheck.json`.
Observed: exit 0; `total: 75, passed: 75, failed: 0`.

Negative control: invoked the same quotecheck.py with a one-finding JSON on /dev/stdin, appending `INDEPENDENT_QUOTECHECK_NEGATIVE_CONTROL_7e912b.` to ACME-001. Observed: exit 1; `FAIL ACME-001 <- quote not found verbatim in cached text`, `total: 1, passed: 0, failed: 1`. The saved output was never mutated for this test.

Final command: `python3 tools/quotecheck.py evidence/acme.verified.json`. Final command and the real sentence/conditions gates are re-run after writing this report; their observed result is recorded below.

Weakest remaining point: PSI metadata JSON and CSV endpoints were not re-fetched in this pass. Their local files and all PSI mappings were checked; live byte identity for those endpoints is not verified. The table headers establish claim units and meanings, but absent numeric-unit text inside the finding quotes causes those conditions to remain null.

No full build, publication or browser run was performed. The current UI was not verified. The six code-regression traps are outside this data-only change; no product logic or storage was edited. The relevant protections were exact-quote rejection, literal units, field/source pairing, source-context scope and evidence-level classification.

Final observed validation: exact requested command returned exit 0; `{"file":"research/evidence/acme.verified.json","total":75,"passed":75,"failed":0}`. Every retained finding has `verified.quote: "exact match"` and a context-specific support note.

Read-only calls to the actual `gateSentences`, `conditionsGate` and `reviewed` functions returned: 75 reviewed findings, 76 quote rows including the additional conditions quote, no sentence rejection, no dropped condition and no partial-gravity finding. ACME-034 resolved to `gclass: "micro"`. The extra conditions quote separately passed quotecheck on stdin with exit 0.

The original acme.json is unchanged (`git diff --exit-code -- research/evidence/acme.json` returned 0). Product files changed by other sessions were not modified by this evidence pass. The only delivery files written by this pass are acme.quotecheck.json, acme.verified.json and acme.rejects.md.
