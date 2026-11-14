# others.json: rejected and changed items

Verifier pass of 2026-11-14 over `evidence/others.json` (85 findings, 10 investigation records). Result file: `evidence/others.verified.json`.

## Summary

- quotecheck with `--refetch`: 85 of 85 passed, none relabelled.
- Findings kept unchanged: 46. Findings kept with changes: 39. Findings rejected: 0.
- Investigation records kept: 10 of 10; 24 fields narrowed to their cited quotes.
- Live re-download: 3 sources byte-identical to cache (NTRS PDF 20140017780, nasa.gov SPICE fact sheet, nasa.gov SLICE fact sheet). psi.nasa.gov returned 504 / 500 on every try, so no PSI-hosted source could be re-downloaded.

## Rejected findings

None. Every quote was found verbatim and, read in context, supports its claim once the changes below are applied.

## Changed findings

- **OTHERS-001** (decision_hint, conditions.pressure): decision_hint said 'gas or vapour flame'; SPICE tested gas-jet flames only. Hint narrowed to gas-jet flames; pressure marked as the assumed value, as the source states it.
- **OTHERS-002** (decision_hint): decision_hint said the flame leaks fuel 'before it goes out'; the source reports local extinction and reactant leakage in the fourth image, not that the flame went out. Hint rewritten without that step.
- **OTHERS-005** (decision_hint): decision_hint added 'at the same fuel flow' as a test condition and dropped the co-flow condition; the same paragraph says the trend reverses in still air. Hint narrowed to co-flowing flames.
- **OTHERS-006** (decision_hint): decision_hint added visual cues ('dimmer or redder') that this quote does not contain. Hint narrowed to the two cited temperatures.
- **OTHERS-008** (decision_hint): decision_hint presented the radiative fractions as established; the source lists them as one 'surmise'. Hint now says so.
- **OTHERS-009** (evidence_level, conditions.platform): evidence_level was 'flight experiment', but the sentence is a general statement the report cites to its reference 4, not a SPICE result. Relabelled 'review or summary'; platform set to null.
- **OTHERS-012** (claim): claim attributed the statement to Laminar Soot Processes results; the quoted sentences do not name LSP (only the sentence before does, about a different point). Attribution removed.
- **OTHERS-013** (claim, decision_hint): The ethylene/propane order is not settled in NASA's own text: the report body gives propane below ethylene with one exception, the closing remarks give the opposite, and the 2012 retest (OTHERS-015) did not observe the propane anomaly. Claim narrowed to 'closing remarks rank...' with the caveat; hint rewritten.
- **OTHERS-014** (decision_hint): decision_hint reworded so it does not depend on another finding's wording: the result is from the 2009 tests and the 2012 retest did not observe it.
- **OTHERS-015** (claim, conditions.fuel): Source marks this as a preliminary finding ('Thus far'); claim now says so. Fuel condition narrowed to what the sentence names.
- **OTHERS-019** (decision_hint): decision_hint added a response step ('breathing protection belongs in the first response steps') that the source does not state. Hint narrowed.
- **OTHERS-024** (decision_hint): decision_hint told the crew to 'keep ventilation shutdown as an early step'; the source describes why experiments use fans, not a fire-response test, and OTHERS-002 shows reduced airflow can first make a flame smoke. Hint narrowed.
- **OTHERS-025** (claim, decision_hint): decision_hint said 'fuel-vapour flame'; SLICE burned gas jets. Wording fixed; claim marked preliminary as the source section is 'Preliminary Research Findings'.
- **OTHERS-026** (conditions.fuel): conditions.fuel said 'nitrogen-diluted fuel'; the sentence says only 'diluted flames' (SLICE's diluent was nitrogen, the pair's fuel is not given). Fuel reworded.
- **OTHERS-027** (claim, decision_hint): The 200 K figure is a soot temperature from pyrometry and the comparison is one pair of flames; claim and hint narrowed to that. Hint no longer tells designers how to size detectors.
- **OTHERS-028** (decision_hint): decision_hint spoke of 'soot yield'; the source measured peak soot volume fraction in methane flames. Hint narrowed.
- **OTHERS-031** (decision_hint): decision_hint generalised to any gas leak and to 'setting clearances'; the result is for nitrogen-diluted methane coflow flames. Hint narrowed.
- **OTHERS-032** (decision_hint, conditions.fuel): decision_hint concluded that 'airflow alone is an unreliable way to put it out'; the source says lifted flames were much less stable, which does not support that. Hint narrowed; fuel condition limited to what the note states.
- **OTHERS-035** (decision_hint): decision_hint said the fuel 'does not smoke on Earth'; the source says the dilution 'wasn't expected' to reach smoking conditions. Hint narrowed.
- **OTHERS-036** (decision_hint): decision_hint generalised to any 'screened or filtered duct' and prescribed filter replacement; the source reports one small experiment duct. Hint narrowed.
- **OTHERS-045** (decision_hint): decision_hint said the record 'shows' the images can be turned into soot fields; the record states the objective and approach, not results. Hint softened.
- **OTHERS-048** (decision_hint): decision_hint named Saffire, which this source does not mention. Reference removed.
- **OTHERS-052** (conditions.flow, decision_hint): conditions.flow listed both simulated velocities; the 10 micrometre mode is reported for the 0.08 m/s rotated-source case (1MG-R). Hint now names the surrogate and geometry limit.
- **OTHERS-053** (decision_hint): decision_hint said what detectors and filters 'should cope with'; the source is a simulation of one surrogate. Hint narrowed.
- **OTHERS-054** (decision_hint, environment_relevance): decision_hint asserted that settling is weaker in partial gravity, which the source does not state, and environment_relevance listed lunar and Mars bases on that basis. Sentence and those two environments removed.
- **OTHERS-055** (decision_hint): decision_hint spoke of a 'stagnant pocket behind an overheated part'; the source describes recirculation behind the heated vapor source in a simulation. Hint narrowed.
- **OTHERS-058** (decision_hint): decision_hint said what a detector 'must' do; softened to what the cited measurement implies.
- **OTHERS-061** (decision_hint, conditions.gravity): decision_hint described the visible flame disappearing and told the crew to confirm extinction by other means; the quote states only the mechanism of the hot-to-cool transition. Hint narrowed; gravity reworded because the slide does not print it.
- **OTHERS-063** (decision_hint): decision_hint said heat or light sensors 'may miss' cool flames; the source has no detector data. Hint narrowed to the temperatures.
- **OTHERS-064** (decision_hint): decision_hint dropped the pressure condition ('a cool flame can re-ignite a hot flame') and added 'keep suppression ready'; the source ties reignition to increasing pressure. Hint narrowed.
- **OTHERS-067** (decision_hint): decision_hint added 'a liquid fuel exposed to a hot spot deserves checking'; the source is a model result for an n-decane droplet. Hint narrowed.
- **OTHERS-068** (decision_hint, conditions.gravity): decision_hint called helium a 'diluent'; the slide keeps oxygen at 21% and exchanges helium for nitrogen at 3 atm. Hint and gravity condition reworded to what the slide prints.
- **OTHERS-072** (conditions.gravity): conditions.gravity reworded to what the PSI record states (project type Ground Investigation; simulations and ground-based counterflow experiments).
- **OTHERS-077** (decision_hint): decision_hint called the spread 'opposed-type' and spoke of 'air'; neither word is in the source (quiescent oxidizer of 35% or 50% oxygen). Hint reworded; the 3.9 ratio is arithmetic on the two quoted values.
- **OTHERS-078** (decision_hint): decision_hint said 'still microgravity air' although the tests were at 35% and 50% oxygen; reworded and limited to the tested range.
- **OTHERS-079** (decision_hint): decision_hint said 'still microgravity air at 35% oxygen' and 'confirm or rule out'; reworded to the tested atmosphere and to ruling out only.
- **OTHERS-080** (decision_hint): decision_hint added 're-ignition risk until cooled', which the source does not state. Hint narrowed.
- **OTHERS-082** (decision_hint): decision_hint said 'still microgravity air'; reworded to 'low-flow microgravity conditions', the source's term.
- **OTHERS-084** (evidence_level, earth_instinct, decision_hint, conditions.fuel, conditions.platform): evidence_level was 'flight experiment', but the quote is an introduction statement citing Ostrach (1982), not an STDCE result. Relabelled 'review or summary'. The fuel and platform conditions do not belong to this general statement and were set to null. earth_instinct ('a heated liquid just sits in its container unless it boils') is not a fair Earth belief and was set to null; the hint's speculation about spilled liquids near a heat source was removed.

## Changed investigation fields

- **SPICE**, `hardware`: 'fan-driven' is not in any of the three quotes cited for this field; wording narrowed to the quotes.
- **SPICE**, `sample_geometry`: 'on the centerline of the flow duct' is not in the cited quotes; removed.
- **SPICE**, `variables`: 'until the smoke point was reached' is not in the cited quotes, and the source says 'most tests'; narrowed.
- **SPICE**, `measurements`: 'Nikon D100' and 'qualitative flame radiation' are not in the quotes cited for this field (both are elsewhere in the report); narrowed to the cited quotes.
- **SLICE**, `hardware`: 'fan-driven flow duct' is not in the quotes cited for this field; removed.
- **SLICE**, `years`: '13 test sessions' is not in the cited quotes (it is in the 30-day report inside the same file); removed.
- **SLICE**, `objectives`: 'provide data to test numerical models' and 'ACME' are not in the cited quotes; removed.
- **SLICE**, `fuels`: '(limited tests)' after ethane is not in the cited table row; removed.
- **SLICE**, `conditions.flow`: 'fan-driven', 'set by fan voltage', 'maximum fan voltage' and 'soot-induced' are not in the quote cited for this field; narrowed.
- **SLICE**, `variables`: 'typically the fuel flow was held fixed' is not in the cited quotes; narrowed.
- **SPICE data analysis (PSI-60)**, `sample_geometry`: 'Coflow laminar diffusion flames' and 'SPICE flight images (analyzed)' are not in the quote cited for this field; narrowed.
- **SAME smoke simulation (PSI-115)**, `fuels`: '(not burned)' is not in the cited quote; removed.
- **Cool flame CFD (PSI-117)**, `objectives`: 'Use FLEX flight data from PSI to' is not in the quotes cited for this field; removed.
- **Cool flame CFD (PSI-117)**, `conditions.pressure`: '1 atm to 3 atm (pressure swept)' restated as the three pressure levels the cited slide prints.
- **Cool flame CFD (PSI-117)**, `variables`: 'droplet size' is not in the quotes cited for this field; removed.
- **Cool flame CFD (PSI-117)**, `measurements`: The slide prints 'FSR, Kb and Tmax'; the expansions 'burning rate, flame standoff ratio, maximum temperature' are not in the cited quote. Slide labels kept.
- **Cool flame transitions (PSI-142)**, `objectives`: 'Using FLEX data from PSI' and 'link the limits of hot and cool flames' are not in the cited quotes; removed.
- **Cool flame transitions (PSI-142)**, `fuels`: 'large n-alkanes' comes from a cited publication title, not from the record's own description; labelled.
- **Cool flame transitions (PSI-142)**, `variables`: The cited quote is the hypothesis, not a test matrix; field now says so.
- **STDCE-1**, `objectives`: 'temperature distributions' and 'free-surface shape' are not in the quotes cited for this field; removed.
- **SSCE (report archived in PSI-108)**, `sample_geometry`: 'nichrome ignitor wire at one end' is not in the cited quote (the quote stops before that sentence); removed.
- **SSCE (report archived in PSI-108)**, `conditions.flow`: '(no forced flow)' is a gloss not in the cited quote; source wording kept.
- **SSCE (report archived in PSI-108)**, `measurements`: 'Type R', 'top and side views' and 'digitized film' are not in the quotes cited for this field; narrowed.
- **ISS solder study (PSI-181)**, `platform`: 'samples from the In-Space Soldering Investigation' is not in the cited quotes; narrowed to the two record fields quoted.

## Not verified

- PSI-hosted sources could not be compared with the live site: `https://psi.nasa.gov/geode-py/ws/studies/PSI-107/download?file=683da125b8656d2315bf448a`, `.../PSI-108/download?file=6843212d9e44646b74024d65` and `.../PSI-115/download?file=683da39ef91ab4427dbf4511` returned 504 three times each; `https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-142` returned 500 six times. Their findings rest on the cached text only.
- OTHERS-077: the five SSCE spread rates come from OCR text of a scanned report; each appears once and has no second source in this project.
- OTHERS-061 to OTHERS-071: slide decks. Conditions are those printed on the slide or the caption next to the bullet; the 2022 deck never prints the gravity level.
- earth_instinct was not checked against sources (it is the extractor's interpretation), except OTHERS-084 where it was removed.
