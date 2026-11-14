# saffire.json: rejected and changed items

Input: 117 findings, 6 investigation records. Kept unchanged: 74. Kept with changes: 43. Rejected: 0. Investigation records: 6 kept, 6 with changes.

quotecheck --refetch on the input: 117 of 117 passed (15 NTRS-abstract quotes also found in the live NTRS record). No finding had to be relabeled between "ntrs" and "pdf".

## Rejected findings

None. Every quote is verbatim in its cached text and every claim could be tied to its quote in context; the faults found were in decision hints, conditions and evidence levels, and were fixed by narrowing.

## Changed findings (kept, narrowed or corrected)

- **SAFFIRE-006** (ventilation stop: thin fabric in air) [fields: decision_hint]: decision_hint called ventilation stop "a valid first move", a recommendation the slide does not make; reworded to what the test showed.
- **SAFFIRE-012** (silicone: flammability in microgravity vs 1-g) [fields: decision_hint]: decision_hint said the same flight family shows other materials "behaving the opposite way", which this source does not state; that clause was removed.
- **SAFFIRE-017** (Nomex oxygen threshold on Earth) [fields: evidence_level]: evidence_level was "normal-gravity test", but the slide restates a known material property as background and names no test; relabeled "review or summary".
- **SAFFIRE-023** (average flame power of small samples) [fields: claim, conditions.flow, quote]: Claim said "Estimated", a word this slide does not use for the Saffire-2 values; flow condition was given as 20 cm/s although one SIBAL sample ran at 25 cm/s. Quote extended backwards to include the heading "Average flame power:", without which the two wattages had no label.
- **SAFFIRE-026** (dim blue flames at low pressure) [fields: conditions.pressure, conditions.o2_percent, conditions.flow, decision_hint]: Conditions did not carry the tested pressures, air and flow speed stated in the paper; decision_hint applied a normal-gravity result to cabins without saying so.
- **SAFFIRE-028** (silicone ground test: removing forced flow) [fields: claim, conditions.gravity]: Claim said "normal-gravity pre-flight tests"; the abstract does not use those words, so the claim now uses the abstract's own description.
- **SAFFIRE-029** (flame spread rate at higher flow (table row)) [fields: decision_hint]: decision_hint concluded that "lower cabin flow buys time for thin fuels"; the source compares two flow speeds and gives no such advice.
- **SAFFIRE-031** (flame speed scales with air flow velocity) [fields: decision_hint]: decision_hint added "cut airflow early", an instruction the slide does not give, and treated a two-point comparison as a general law.
- **SAFFIRE-040** (deflagration from accumulated fuel vapor) [fields: decision_hint]: decision_hint warned against "a sudden airflow"; the passage ties the deflagrations to ignition of accumulated vapor, not to airflow, so that clause was removed.
- **SAFFIRE-041** (why fuel vapor accumulates in low gravity) [fields: evidence_level]: evidence_level was "flight experiment", but the sentence is the authors' general explanation of a mechanism, not a measured result; relabeled "model or analysis".
- **SAFFIRE-043** (duct height effect on thin-fuel spread rate) [fields: decision_hint]: decision_hint extended the duct result to spaces "behind panels, between racks", which the paper does not test; reworded to the two duct heights compared.
- **SAFFIRE-044** (thick PMMA maximum flame length across atmospheres (table row)) [fields: decision_hint]: decision_hint called the values "a measured flame-size bound"; the same paper says the 2-sided samples were still growing at the end of the test and may not have reached a limiting size.
- **SAFFIRE-046** (heat release and whole-vehicle conditions) [fields: decision_hint]: decision_hint said to plan the response around smoke and toxic gases first; this abstract does not compare hazards, it only says the average conditions stayed acceptable.
- **SAFFIRE-047** (thin fabric fire: heat and gas increase (table row)) [fields: claim]: Claim gave the 25 C as "at the far-field unit"; the column header reads "Max Temp at FFD or nearest location". The heat release columns are the fuel-consumption ones.
- **SAFFIRE-049** (mixing time depends on cargo packing) [fields: decision_hint]: decision_hint said packing "alters the paths smoke takes" and advised re-evaluating detector placement; the slide only speaks of mixing times.
- **SAFFIRE-050** (smoke particle size from large flaming fires) [fields: decision_hint]: decision_hint left out the deck's own caveat that the far-field measurements likely missed a significant fraction of larger particles.
- **SAFFIRE-052** (acid gas (HCl) lost before reaching the far sensor) [fields: decision_hint]: decision_hint stated surface contamination near the source as fact and told the crew to wipe surfaces; the deck offers adsorption only as a possible explanation.
- **SAFFIRE-054** (post-fire cleanup: smoke eater and CO) [fields: decision_hint]: decision_hint called the unit "a prototype catalytic filter" and added "before unmasking"; reworded to what the bullet says.
- **SAFFIRE-056** (model of the vehicle response) [fields: decision_hint]: decision_hint called free volume "a first-order input"; reworded to what the authors say.
- **SAFFIRE-057** (ventilation stop: thin cotton re-ignited after 70 s) [fields: decision_hint]: decision_hint advised keeping airflow off "much longer"; the source does not show that a longer stop would have worked, so that advice was removed.
- **SAFFIRE-064** (flow obstructions and low flow let vapor build up) [fields: decision_hint]: decision_hint said debris from an earlier fire "can create" a dead-air pocket; the paper only says the curled ash "may have provided enough recirculation".
- **SAFFIRE-066** (flames reach a limiting length, unlike 1-g) [fields: claim]: Claim said "thick-fuel cases"; the source says "all these cases" right after also mentioning the thin samples, so the claim now lists what the passage covers.
- **SAFFIRE-067** (oxygen shadow of an upstream flame) [fields: decision_hint]: decision_hint told the user to "approach from upstream" and called the downstream air "product-rich"; neither is in the source.
- **SAFFIRE-073** (shutting down air circulation as primary control measure) [fields: evidence_level, decision_hint]: evidence_level was "flight experiment" for an authors' suggestion; decision_hint turned "it is obvious to alternatively consider" into the instruction "Stop air circulation first" and added a claim about extinguisher discharge that the paper does not make.
- **SAFFIRE-074** (reduce flow rather than cut it, to avoid flashover) [fields: evidence_level]: evidence_level was "flight experiment" for a lesson the authors draw ("may be a better way"), not a measured result; relabeled "model or analysis".
- **SAFFIRE-078** (cotton fire: heat and gas increase (table row)) [fields: claim]: Claim gave the 23 C as "at the far-field unit"; the column header reads "Max Temp at FFD or nearest location". The heat release columns are the fuel-consumption ones.
- **SAFFIRE-081** (fire size and where the temperature rose) [fields: conditions.fuel, conditions.o2_percent, conditions.pressure, conditions.platform]: Conditions listed only the Saffire VI atmosphere; the quoted sentence covers all the tests of the paper (Table 1: IV-1, V-2, VI-2, VI-3, VI-4), whose free volumes span 16.7 to 19.0 m3.
- **SAFFIRE-082** (CO and CO2 exceeded exposure limits) [fields: decision_hint]: decision_hint opened with "Mask up on alarm", an instruction the paper does not give, and said "past NASA limits" without naming which.
- **SAFFIRE-085** (alarm timing summary) [fields: decision_hint]: decision_hint advised pairing particle detectors with CO sensing and placing them near sources; the paper does not make that recommendation.
- **SAFFIRE-086** (smoke and gas, not heat, are the main hazard) [fields: conditions.fuel, conditions.o2_percent, conditions.pressure, decision_hint]: Conditions listed only the Saffire VI atmosphere although "these results" covers all tests of the paper; decision_hint prescribed a response order ("then the flame") that the paper does not give.
- **SAFFIRE-088** (thick PMMA: flame anchored, linear growth rate) [fields: decision_hint]: decision_hint generalised to "thick-plastic flame growth" and to a modelling rule; narrowed to the material, flow and range the paper reports.
- **SAFFIRE-090** (oxygen raises growth rate despite lower pressure) [fields: decision_hint]: decision_hint generalised to "plastics" in any exploration atmosphere; the next sentence of the paper reports no change for the 1-sided samples.
- **SAFFIRE-092** (one-sided panels plateau; back-side heat loss) [fields: conditions.fuel, conditions.o2_percent, conditions.pressure, decision_hint]: Conditions listed only the 1-sided samples although the claim covers all four PMMA tests; decision_hint stated as fact ("burns more slowly") what the authors give as a plausible explanation.
- **SAFFIRE-093** (two-sided burn as conservative bound) [fields: evidence_level, decision_hint]: evidence_level was "flight experiment" for what is an authors' recommendation; decision_hint said "the design value for panels", wider than the 1-sided applications the authors name.
- **SAFFIRE-095** (detection threshold of 2 mg/m3 was not low enough) [fields: decision_hint]: decision_hint was written as a general design rule; the paper limits the statement to this spacecraft and these design fires.
- **SAFFIRE-096** (time to alarm by fuel (table row)) [fields: claim, decision_hint]: decision_hint converted the seconds into "17 to 27 minutes to trip a far detector"; the paper does not state the time zero of this row and says its timelines start about 10 minutes before ignition.
- **SAFFIRE-099** (dim blue leading edge of the flame) [fields: decision_hint]: decision_hint told the user to "aim the response upstream of the bright zone" and called the dim edge "the advancing edge"; the paper says neither.
- **SAFFIRE-101** (Nomex did not ignite) [fields: conditions.flow]: Flow was given as 20 cm/s, but the figure caption with that value covers the three ignited tests and Table 1 leaves the Nomex test out; set to null.
- **SAFFIRE-103** (acid gas (HCl): stopping ventilation keeps it airborne (model)) [fields: claim, decision_hint]: Claim said the model was "validated on Saffire VI data"; the abstract says it was validated by data from the Saffire campaign. decision_hint added that shutdown "starves the flame", which this source does not say.
- **SAFFIRE-108** (smoke does not rise to a ceiling detector) [fields: decision_hint]: decision_hint prescribed where to place detectors (return path, near sources); the slide only states the problem.
- **SAFFIRE-115** (cabin pressure and temperature rise per test (table rows)) [fields: decision_hint]: decision_hint gave an instruction ("do not use them as fire indicators"); softened to what the two rows show.
- **SAFFIRE-116** (higher oxygen linked to higher gas levels) [fields: decision_hint]: decision_hint said an enriched cabin reaches hazardous levels "sooner"; the paper speaks of higher levels, not of timing.
- **SAFFIRE-117** (backed (1-sided) panel gave worse CO at alarm) [fields: claim]: Claim did not say which samples were compared; the sentence is about the two SAFFIRE VI PMMA samples.

## Investigation records

All six records kept. psi_id and psi_url of Saffire-I, -II and -III match psi-investigations.json (PSI-98, PSI-99, PSI-100, same URLs, titles and short names). Saffire-IV, -V and -VI have no record in psi-investigations.json nor in the saved PSI search dump (raw/psi/search_all_from0_size200.json), so their null psi_id and psi_url stand.
Every quote of every record is verbatim in its cached text. Changes:

- **Saffire-I** [platform, years]: No quote carried "OA-6" or the year 2016; added the operations-table line of NTRS slides 20180005168, which gives both.
- **Saffire-I** [hardware]: No quote carried the avionics bay; added the sentence of NTRS 20170000230 that states it.
- **Saffire-I** [pi]: No quote carried the affiliation "NASA GRC"; added the PSI contact field that states it.
- **Saffire-II** [platform]: No quote carried "Orbital ATK" or "after departing the ISS"; added the PSI-99 sentence and the NASA page sentence that state them.
- **Saffire-II** [hardware]: Field said "same flow duct and avionics bay as Saffire-I"; no saved PSI-99 text says that. Narrowed to what PSI-99 states and added its sentence on the flight unit.
- **Saffire-II** [fuels]: No quote carried the 0.8 mm PMMA thickness or "one grooved, one flat"; added the two slide sentences that state them.
- **Saffire-II** [sample_geometry]: Field ended with "burned one after another", which no quote states; removed. "at one end" changed to the source wording "at the bottom".
- **Saffire-II** [pi]: No quote carried the affiliation "NASA GRC"; added the PSI contact field that states it.
- **Saffire-III** [platform]: No platform quote carried "after departing the ISS"; added the PSI-100 sentence that states it.
- **Saffire-III** [hardware]: Field added "same flow duct and avionics bay as Saffire-I"; the only hardware quote is the PSI hardware name and PSI-100 does not describe the duct. Narrowed to the quote.
- **Saffire-III** [sample_geometry]: Field said the opposed burn used "the remaining fuel"; the quoted PSI rows do not say that. Narrowed to the two table rows.
- **Saffire-III** [pi]: No quote carried the affiliation "NASA GRC"; added the PSI contact field that states it.
- **Saffire-IV** [fuels]: Entry "Nomex fabric (on the sample card)" had no quote: the only trace is a figure label whose flight cannot be told from the extracted text. Removed.
- **Saffire-IV** [fuels]: No quote carried the SIBAL composition or the PMMA thicknesses; added the sentence of NTRS 20240002981 and the Figure 2 labels of NTRS 20210011521 that state them.
- **Saffire-IV** [measurements]: No quote carried "four cameras: top and edge views" or the Combustion Product Monitor; added the sentence of NTRS 20260001992 ("On each flight ...") and the FFD slide line of NTRS 20210017343.
- **Saffire-V** [fuels]: No quote carried the PMMA thickness; added the Figure 2 labels of NTRS 20210011521.
- **Saffire-V** [measurements]: No quote carried "four cameras: top and edge views" or the Combustion Product Monitor; added the sentence of NTRS 20260001992 ("On each flight ...") and the FFD slide line of NTRS 20210017343.
- **Saffire-VI** [platform]: Field said "after departing the ISS"; the quote says "at the end of the NG-19 resupply mission". Narrowed to the quote.
- **Saffire-VI** [measurements]: List was copied from Saffire IV-V; for Saffire VI no quote carried flame temperatures, HF and HCl concentrations or the Combustion Product Monitor. Narrowed to what the Saffire VI quotes state, and added quotes for radiometers, spread rate, free volume and the DustTrak.

## Live re-download check (step 2e)

- NTRS PDF 20210011521, https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf (SAFFIRE-037 and the 25 other findings on raw/pdf/20210011521.txt): downloaded again (6,518,291 bytes); SHA-256 equal to raw/pdf/20210011521.pdf; pdftotext -layout output byte-identical to the cached text_file
- NASA page https://www.nasa.gov/centers-and-facilities/glenn/flame-burns-out-on-nasas-long-running-spacecraft-fire-experiment/ (SAFFIRE-107): downloaded again (HTTP 200); all 17 cached text lines of 40+ characters and the quote are present in the live page text
- NASA page (WordPress API) https://www.nasa.gov/wp-json/wp/v2/migration/309559 (SAFFIRE-077): downloaded again (HTTP 200); all 22 cached text lines of 40+ characters and the quote are present in the live content
- PSI web service https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-100 and the PSI-99 table download (SAFFIRE-036, SAFFIRE-014, SAFFIRE-020, SAFFIRE-021): NOT confirmed live: PSI answered HTTP 500 four times for PSI-100 (and 500 for PSI-98, 504 for the PSI-99 table) on 2026-11-14; these findings rest on the cached PSI files only

## Notes for the next stage

- decision_hint and earth_instinct remain VESTA interpretation, not NASA statements; 32 hints were reworded where they gave an instruction or a generalisation the source does not make.
- Evidence level 'flight experiment' was kept for results and conclusions the flight papers state about their own named tests; authors' recommendations and general mechanism statements were moved to 'model or analysis' (SAFFIRE-041, -073, -074, -093) and one background property to 'review or summary' (SAFFIRE-017).
- Time-to-alarm values (SAFFIRE-085, -096, -097) have no stated time zero in the source tables; the 2026 paper says its timelines start about 10 minutes before ignition. Do not display them as minutes from ignition.
- The 2024 paper (20240002981) never writes 'low gravity' or 'microgravity' for its tests (it says 'orbiting' and 'unmanned spacecraft'); findings from it keep the extractor's gravity value ('low gravity' or null) as written.
- The source conflicts listed in the notes of saffire.json (Saffire-III flow speed, Saffire-V atmosphere, 2024 vs 2026 values, flow direction in the 2026 table caption) were checked against the saved texts and stand as described.
- SAFFIRE-046 quotes 'heat release rates up to 10 kW' from the 2021 abstract; the 2024 and 2026 papers give 1.5 to 3.2 kW for the measured fires. Both are verbatim; do not merge them into one number.
