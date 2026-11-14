# droplets.json: rejected and changed items

Verifier pass of 2026-11-14 over `evidence/droplets.json` (64 findings, 3 investigation records). Output: `evidence/droplets.verified.json`.

- Findings kept: 62 (26 unchanged, 36 changed).
- Findings rejected: 2.
- Investigation records: 3 kept, 15 edits (listed at the end).
- quotecheck on the original: 64 PASS, 0 FAIL (with `--refetch`), so no finding was rejected or relabelled at step 1.
- Live re-download: nasa.gov article `cir-eight-years`, NTRS 20140006750 PDF and the Researcher's Guide PDF match their cached text. PSI downloads (PSI-69 table, PSI-39 final report) answered HTTP 504 three times each and could not be compared live.

## Rejected findings

### DROPLETS-009: Methanol burned with 75% carbon dioxide present when oxygen stayed at 20%

The source contradicts itself and the PSI table sides against the claim. Slide 8 of NTRS 20130010979 (the quote) gives test point FLEX-145 as "20% O2 / 75% CO2 / 5% N2", but slide 9 of the same file gives "FLEX-145 : Pressure = 1 atm , O2 20% / N2 75% / CO2 5%", and the PSI-69 test table row 145 (C01M201, methanol, 763.5 mmHg) records O 0.2, N 0.75, CO 0.05. The quoted slide swaps nitrogen and carbon dioxide, so the claim "burned with 75% CO2 present" is not supported. The initial and extinction diameters also differ between the slide (3.38 / 1.66) and the PSI row (3.33 / 1.61).

### DROPLETS-034: Precursor tests: carbon dioxide at fixed 21% oxygen barely changed methanol extinction

evidence_level cannot be traced to saved text. The finding is labelled "ground low-gravity (drop tower, aircraft)", but the abstract (the only saved text; the NTRS record is metadata only, downloadsAvailable false) says only "a quiescent microgravity environment" and "precursors to those which are beginning to be performed on the International Space Station". No saved source names the facility (the author notes this too). The quote itself is verbatim and matches the live NTRS abstract; the finding can return once a saved full text states where the tests were run.

## Changed findings

The quote of every finding below is unchanged and verbatim; what changed is the text built on it.

### DROPLETS-001: Limiting oxygen index of methanol droplets

- decision_hint: "Treat every breathable cabin oxygen level as able to support a liquid-fuel flame; use the 12-13% figure only as the target when inerting a sealed, uncrewed volume." -> "Normal cabin oxygen (21%) is far above this limit, so do not count on the cabin atmosphere to prevent a liquid-fuel flame. The 12-13% figure is for methanol droplets in the diluents tested; it is not a general inerting target."
  - Reason: The old hint offered 12-13% as "the target when inerting"; the same family records ignition at 13% (DROPLETS-002) and burning at 12% (DROPLETS-003), and the figure holds only for methanol in the diluents tested.

### DROPLETS-003: Burning at 12% oxygen (single PSI test record)

- decision_hint: "Data point for flammability models: at 12% oxygen a 3 mm methanol droplet still held a visible flame for seconds before going out with most of the fuel left." -> "Data point for flammability models: at 12% oxygen a 3.07 mm methanol droplet has a recorded burn time of 9 s and its flame went out at 2.56 mm, before the droplet was consumed."
  - Reason: "Most of the fuel left" was the author's own volume estimate; the hint now restates the recorded numbers only.

### DROPLETS-004: Small heptane droplet burned to completion at 14% oxygen (single PSI test record)

- decision_hint: "A 1 mm droplet burned out completely at an oxygen level where 4 mm droplets in the same table went out with nearly all their fuel left (test 213); the limit depends on the size of the fuel element, so do not apply a large-droplet limit to fine droplets." -> "A 1.1 mm heptane droplet is recorded as burning to completion at 14% oxygen, while a 4.16 mm heptane droplet at 14% oxygen in the same table (test 213) is recorded as extinguishing at 4.15 mm after 1.6 s. The outcome depended on droplet size, so do not apply a large-droplet limit to fine droplets."
  - Reason: The old hint said "4 mm droplets" (plural) "with nearly all their fuel left"; the table has one such record at 14% oxygen (test 213, read and confirmed in the same file).

### DROPLETS-005: Heptane at 13% oxygen: probably below the flammability limit

- decision_hint: "For heptane the quasi-steady limit sits near 13% oxygen at 1 atm in this data set; a flame can still flash briefly at ignition below the limit." -> "This test places 13% oxygen at 1 atm probably below the quasi-steady limit for heptane; a brief transient flame can still appear at ignition below that limit."
  - Reason: The old hint said the limit "sits near 13%"; the caption only says 13% was probably below it.

### DROPLETS-007: Oxygen limit lower in microgravity than in normal gravity

- decision_hint: "Add margin to oxygen limits taken from normal-gravity tests; for these liquid fuels the microgravity limit was lower. Partial gravity lies between the two and is not measured here." -> "Add margin to oxygen limits taken from normal-gravity tests; for these liquid fuels the microgravity limit was lower. Partial gravity is not measured in this source."
  - Reason: Removed "Partial gravity lies between the two": the source does not say so and no saved source measures it.

### DROPLETS-010: Heptane burned in 70% carbon dioxide with 21% oxygen (single PSI test record)

- decision_hint: "Same lesson as FLEX-145 for a sooting fuel: 70% CO2 did not prevent burning while oxygen remained at 21% (this record is at about twice sea-level pressure)." -> "70% CO2 did not prevent burning in this record while oxygen remained at 21%: judge a CO2 discharge by the oxygen fraction it leaves. The record is at about twice sea-level pressure (1553.8 mmHg)."
  - Reason: The old hint leaned on FLEX-145 (DROPLETS-009, rejected) and added "a sooting fuel", which the quoted row does not state.

### DROPLETS-012: Heptane in 17% oxygen with 45% carbon dioxide: quick extinction, no cool flame

- decision_hint: "A reference atmosphere in which both the visible flame and the cool flame failed for heptane: 17% oxygen with 45% CO2 at 0.7 atm." -> "A reference atmosphere for heptane: in 17% oxygen with 45% CO2 at 0.7 atm the visible flame went out very quickly and the report judges cool-flame burning probably absent or only very brief."
  - Reason: The old hint said both flames "failed"; the report says "probably no, or only very brief, cool flame burning".

### DROPLETS-015: More agent needed in microgravity: cup-burner minimum extinction concentrations (background cited in the FLEX test plan)

- conditions.gravity: "1-g and microgravity" -> "normal gravity tests and microgravity simulations"
  - Reason: The quote says the microgravity values come from simulations, not from microgravity tests.
- conditions.fuel: null -> "methane (cup-burner flames)"
  - Reason: The quote names the fuel; the field was null.
- decision_hint: "For all three inert gases listed the microgravity figure is higher than the 1-g figure; budget more agent than a ground test suggests, most of all for nitrogen." -> "For all three inert gases listed the microgravity figure is higher than the 1-g figure, most of all for nitrogen. These are methane cup-burner values with the microgravity side taken from simulations, so read them as a direction (more agent than a ground test suggests), not as design numbers."
  - Reason: The old hint read simulated cup-burner values as a sizing rule.

### DROPLETS-016: Carbon dioxide threshold higher in microgravity (background cited in the FLEX test plan)

- decision_hint: "Plan for a higher CO2 concentration in microgravity than the normal-gravity value; a lunar or Martian habitat lies between the two figures and has no direct data in this source." -> "Plan for a higher CO2 concentration in microgravity than the normal-gravity value (methane cup-burner flame: above 19.1% against 16.4%). This source has no partial-gravity data."
  - Reason: Removed "a lunar or Martian habitat lies between the two figures": not stated by the source.

### DROPLETS-022: Cool flame temperature range

- conditions.fuel: "n-alkane fuels" -> null
  - Reason: The quoted sentence about the FLEX result names no fuel; "n-alkane fuels" came from the sentence before, which is about cool flames in general.

### DROPLETS-026: Cool flames give carbon monoxide and formaldehyde

- decision_hint: "Include carbon monoxide in the post-fire check: CO rising with no visible flame is consistent with cool-flame burning, and both products are toxic." -> "Include carbon monoxide in the post-fire check: CO rising with no visible flame is consistent with cool-flame burning."
  - Reason: Removed "both products are toxic": true or not, the source does not say it.

### DROPLETS-027: Cool flames can re-ignite to hot flames

- decision_hint: "Keep suppression ready and the area isolated after flame-out; a hot flame can return without a new ignition source." -> "Keep suppression ready and the area isolated after flame-out; the FLEX team says these cool flames can potentially re-ignite to hot flames."
  - Reason: The old hint stated re-ignition "without a new ignition source" as fact; the slide says "potentially re-ignite".

### DROPLETS-029: Model: adding carbon dioxide triggered the cool-flame mode

- decision_hint: "After a CO2 discharge knocks down the visible flame of a liquid-fuel fire, expect that a cool flame may follow; confirm with non-visual sensing before re-entering or restoring airflow." -> "Model result for n-heptane droplets: added CO2 triggered the cool-flame stage. After a CO2 discharge knocks down the visible flame of a liquid-fuel fire a cool flame may follow; confirm with non-visual sensing before treating the fire as out."
  - Reason: The hint now says it rests on a simulation and drops "before re-entering or restoring airflow", which the source does not address.

### DROPLETS-030: Cool flame followed radiative extinction with 15% carbon dioxide present

- decision_hint: "Lower oxygen (18%) and 15% CO2 did not stop the invisible second stage; treat partial dilution as a way to lose sight of the fire, not to end it." -> "With 18% oxygen and 15% CO2 the hot flame still gave way to a cool-flame stage before final extinction; under partial dilution, do not take loss of the visible flame as the end of burning."
  - Reason: The old hint said dilution is "a way to lose sight of the fire, not to end it"; the quote says all three cases did end in second-stage extinction and pure vaporization.

### DROPLETS-031: Model: flash re-ignition after about 18 s of cool flame

- claim: "A two-dimensional simulation of the FLEX observations with a gaseous n-heptane source in zero gravity found that in near-quiescent air (2 mm/s or less) the growing spherical flame extinguishes at about 1200 K from radiative heat loss, moves to a cool-flame regime with a reaction zone at about 700 K close to the fuel source, and after about 18 s of cool flame a flash re-ignition occurs." -> "A two-dimensional simulation of flame behavior observed in single-droplet combustion tests on the ISS, using a gaseous n-heptane source in zero gravity, found that in near-quiescent air (2 mm/s or less) with a fuel injection velocity of 1 cm/s the growing spherical flame extinguishes at about 1200 K from radiative heat losses, typically moves to a cool-flame regime with a reaction zone at about 700 K close to the fuel source, and after about 18 s of cool flame a flash re-ignition occurs, followed by extinction of the re-ignited flame."
  - Reason: The abstract does not name FLEX ("single-fuel-droplet combustion tests performed on the International Space Station"); the claim also left out the 1 cm/s injection velocity and that the re-ignited flame then extinguishes.
- decision_hint: "Expect a possible flash back to a hot flame some tens of seconds after flame-out in still air; keep crew and extinguisher positioned for it." -> "Model result: a flash back to a hot flame is possible well after flame-out in near-still air (about 18 s in this simulation); keep crew and extinguisher positioned for it."
  - Reason: The old hint turned one simulated 18 s into "some tens of seconds" without saying it is a model.

### DROPLETS-032: Model: millimetre-per-second airflow changes whether the flame survives

- decision_hint: "After fans are shut off, residual air motion of a few mm/s can be enough to hold a flame on its upstream side; allow the flow to decay and check where the residual flow comes from." -> "Model result: air motion of a few mm/s was enough to keep a locally extinguished flame steady on its upstream side. After fans are shut off, allow residual flow to decay and check where it comes from."
  - Reason: The hint now says it rests on a simulation.

### DROPLETS-033: Flame went out when a 3 mm/s flow stopped (single test)

- decision_hint: "Stopping the airflow ended the visible flame in this single test at 18% oxygen, which supports fan shutdown as a first step, but fuel kept reacting afterwards: follow fan shutdown with a non-visual check." -> "In this single test at 18% oxygen the visible flame went out after the 3 mm/s motion stopped, which is consistent with removing forced flow as a first step, but the droplet kept vaporizing in a way the report attributes to a cool flame: follow fan shutdown with a non-visual check."
  - Reason: "Supports fan shutdown" softened to "is consistent with": one translating-droplet test.

### DROPLETS-036: Two neighbouring droplets extinguished earlier than one in nitrogen-diluted 15% oxygen

- decision_hint: "Near the oxygen limit in nitrogen-diluted air, a merged flame around neighbouring fuel elements loses more heat by radiation and can go out sooner; do not extrapolate single-item limits to clustered fuel in either direction." -> "Near the oxygen limit in a nitrogen-diluted ambient, the flame around two neighbouring droplets went out at a larger droplet size than the flame around one (the opposite held in helium, DROPLETS-037); do not extrapolate single-item limits to clustered fuel in either direction."
  - Reason: Removed "loses more heat by radiation": the document offers that only as speculation ("one could speculate").

### DROPLETS-038: Paired droplets produced a cool flame where single droplets had only a hot flame

- decision_hint: "Clustered fuel can enter the invisible cool-flame mode under conditions where an isolated item does not; assume the less visible outcome when several fuel sources are close together." -> "In this comparison a droplet pair entered the cool-flame mode where single droplets of similar size showed only a hot flame; do not assume neighbouring fuel sources behave like an isolated one."
  - Reason: The old hint generalised two slide lines to "clustered fuel" and told the reader to "assume the less visible outcome".

### DROPLETS-039: Cameras saw nothing during the cool flame; radiometers did

- decision_hint: "Pair optical flame detection with infrared radiometry or gas sensing; in this test only the radiometers showed that reaction was continuing." -> "Pair optical flame detection with radiometry or gas sensing; in this test the color and UV cameras registered no flame while both radiometers still registered heat loss from the droplet."
  - Reason: "Only the radiometers showed" was too strong (the droplet-size record also kept falling) and "infrared" is not in the quote.

### DROPLETS-041: Lower oxygen brought earlier hot-flame and cool-flame extinction

- decision_hint: "Lowering oxygen shortens both stages; an oxygen draw-down is still a valid response, provided the invisible stage is monitored." -> "Lower oxygen brought earlier extinction of both stages in these n-decane tests, which is consistent with an oxygen draw-down shortening the event; the invisible stage still has to be monitored."
  - Reason: "Still a valid response" read as a recommendation the source does not make.

### DROPLETS-042: Higher oxygen removed radiative self-extinction

- conditions.fuel: "n-alkane droplets" -> "n-decane"
  - Reason: The quoted sentence closes the n-decane section (the summary of Fig. 1, n-decane at 0.5 atm); it is not a statement about all n-alkanes.
- conditions.pressure: null -> "0.5 atm"
  - Reason: Fig. 1, which the sentence summarises, is at 0.5 atm.

### DROPLETS-044: After extinction, n-octane still lost mass faster than by evaporation alone

- decision_hint: "Fuel loss faster than plain evaporation after flame-out is a usable sign that reaction continues; a mass-loss or vapor measurement can stand in for a flame sensor." -> "Fuel loss faster than plain evaporation after flame-out is a sign that reaction may be continuing; a mass-loss or vapor measurement can complement a flame sensor."
  - Reason: "Can stand in for a flame sensor" promised more than one burning-rate curve shows.

### DROPLETS-045: Larger droplets burned dimmer and with less soot

- decision_hint: "Larger, radiatively cooled flames in these tests gave less light and less soot; a detector that depends on soot particles or brightness has less to work with as the fuel source grows." -> "Above 1.5 mm the droplet flames in these tests appeared less luminous and less sooty; a detector that depends on soot particles or brightness may have less to work with for larger liquid-fuel sources."
  - Reason: Removed "radiatively cooled": the paper offers radiative loss as a conjecture.

### DROPLETS-046: Fire sensing in microgravity relies on particle scattering

- decision_hint: "A scattering smoke detector needs particles: weigh FLEX-2 soot data, and the low-soot regimes it found, when judging detector coverage for liquid-fuel fires." -> "A scattering smoke detector needs particles: weigh droplet soot data, including low-soot regimes, when judging detector coverage for liquid-fuel fires."
  - Reason: Removed "the low-soot regimes it found": this 2010 requirements document predates the FLEX-2 flight results.

### DROPLETS-048: Fuel mixture at elevated pressure: very weak visible flame, high burning rate

- evidence_level: "flight experiment" -> "review or summary"
  - Reason: The abstract belongs to a theoretical analysis that restates an experimental observation ("Recent experiments ... show") without naming the experiment, so it is a summary, not the flight report.

### DROPLETS-049: Repeated re-ignition cycles above 2 atm

- conditions.fuel: "n-dodecane" -> "not named in the quoted passage (CFI burned n-dodecane, n-dodecane/iso-dodecane mixtures and farnesane)"
  - Reason: The quoted passage does not say which CFI fuel the observation was made with.

### DROPLETS-050: Warm flames were not visible in the color camera

- conditions.fuel: "n-dodecane" -> "not named in the quoted passage (CFI burned n-dodecane, n-dodecane/iso-dodecane mixtures and farnesane)"
  - Reason: The quoted passage does not say which CFI fuel the observation was made with.

### DROPLETS-054: No soot from the cool flame at low pressure; residual soot at higher pressure

- conditions.fuel: "n-dodecane" -> "not named in the quoted passage (CFI burned n-dodecane, n-dodecane/iso-dodecane mixtures and farnesane)"
  - Reason: The quoted passage does not say which CFI fuel the observation was made with.

### DROPLETS-051: Helium dilution ended the cool flame earlier

- decision_hint: "Helium is the diluent in these tests that shortens the invisible stage; where a cool flame is the concern, a high-conductivity inert gas works on it more than nitrogen does." -> "In these n-dodecane tests more helium ended the cool flame earlier (at a larger droplet size); this is a droplet result, not a qualified suppression method."
  - Reason: Removed the comparison with nitrogen and "high-conductivity inert gas": neither is in the quoted passage.

### DROPLETS-052: Most of the fuel burned after the visible flame went out (test FLEX-1250)

- topic: "Most of the fuel burned after the visible flame went out (test FLEX-1250)" -> "Most of the droplet was consumed during the cool-flame stage (test FLEX-1250)"
  - Reason: "Most of the fuel burned" overstated: the slide gives diameters and burning-rate constants, not how much fuel was oxidised.
- decision_hint: "In this test the visible flame took the droplet only from 4 to 3.55 mm; the invisible cool flame, burning at the same rate, took it from 3.55 to 0.40 mm. Size the post-flame watch on the fuel still present, not on the flame seen." -> "In this test the hot flame took the droplet only from 4 to 3.55 mm; the cool flame, at about the same burning-rate constant, took it from 3.55 to 0.40 mm. Size the post-flame watch on the fuel still present, not on the flame seen."
  - Reason: Wording aligned with the slide (hot flame, cool flame, 0.383 against 0.387 mm2/s is "about the same").

### DROPLETS-053: Branched fuel component reduced the tendency to form cool flames

- decision_hint: "Cool-flame tendency depends on fuel structure: straight-chain hydrocarbons are the worst case in this data, so fluids rich in normal alkanes deserve the most caution." -> "Cool-flame tendency depends on fuel structure: the straight-chain fuel showed the stronger tendency in this data, so fluids rich in normal alkanes deserve the most caution."
  - Reason: "Worst case" softened to what the two sentences say.

### DROPLETS-055: Cool flames cannot be reproduced with droplets in normal gravity

- decision_hint: "Ground flammability testing cannot screen for this mode; label it "not testable in 1-g" in a hazard analysis and "never tested" for lunar and Martian gravity." -> "With droplet flames this mode cannot be observed in normal gravity, so a 1-g droplet test cannot screen for it; mark it "not testable in 1-g" in a hazard analysis. These sources hold no lunar- or Martian-gravity data on it."
  - Reason: The source limits the statement to droplet flames; the old hint extended it to all ground flammability testing.

### DROPLETS-056: A vapor cloud of condensed, partly oxidized fuel marks the end of the cool flame

- investigation: "CFI" -> "FLEX"
  - Reason: The quoted sentence reports what the "(FLEX, FLEX-2)" experiments revealed; the CFI report only restates it (same treatment as DROPLETS-022).
- decision_hint: "A fog appearing around a liquid-fuel source after flame-out is a sign that a cool flame has just ended and that unburned, partly oxidized fuel is now in the air: ventilate through filters before declaring the area clear." -> "A vapor cloud appearing around a liquid-fuel source after flame-out is consistent with a cool flame having just ended, leaving condensed, partly oxidized fuel in the air; treat the atmosphere as contaminated until it is checked."
  - Reason: Removed "ventilate through filters": a response step the source does not give.

### DROPLETS-060: Xenon sustained cool flames at much lower oxygen than helium

- decision_hint: "A low-conductivity diluent widens the range of oxygen levels where a cool flame survives; check the diluent before reusing an oxygen limit." -> "Xenon let cool flames persist at much lower oxygen than helium did; check the diluent before reusing an oxygen limit."
  - Reason: The old hint generalised xenon to "a low-conductivity diluent".

### DROPLETS-062: Model: hot, warm and cool flame temperatures at elevated pressure

- decision_hint: "Three temperature bands to design sensing around: about 1500 K, 970 K and 765 K; the lower two gave no visible flame in the CFI tests." -> "Three simulated temperature bands to design sensing around: about 1500 K, 970 K and 765 K. In the ISS droplet tests the warm and cool modes were not visible to the cameras (DROPLETS-039, DROPLETS-050)."
  - Reason: The hint now says the temperatures are simulated and points to the findings that carry the "not visible" statements.

## Changed investigation records

psi_id and psi_url of FLEX (PSI-69), FLEX-2 (PSI-68) and CFI (PSI-39) match `psi-investigations.json`. All original source quotes are verbatim in their text files. Edits:

### FLEX

- `variables`: "Varied from test to test: fuel (methanol or heptane), ambient oxygen mole fraction, diluent or suppressant gas and its mole fraction (nitrogen, carbon dioxide up to 0.70, helium up to 0.45 in the PSI test table), ambient pressure, initial droplet diameter, free or fiber-supported droplet, quiescent or slowly translated. Held the same: single droplet geometry, hot-wire ignition, ambient temperature, the CIR/MDCA hardware and cameras." -> "Varied from test to test: fuel (methanol or heptane), ambient oxygen mole fraction, diluent or suppressant gas and its mole fraction (nitrogen, carbon dioxide up to 0.70, helium up to 0.45 in the PSI test table), ambient pressure, initial droplet diameter, free or fiber-supported droplet, quiescent or slowly translated. Held the same: single droplet geometry, hot-wire ignition, ambient temperature, the CIR/MDCA hardware."
  - Reason: Dropped "and cameras" (no quote says the camera setup stayed the same) and added quotes for hot-wire ignition and ambient temperature, which had none.
- `variables`: added supporting quote from raw/pdf/20150023456.txt: "two opposed hot-wire igniters for initiating combustion"
  - Reason: "hot-wire ignition" had no quote.
- `variables`: added supporting quote from raw/pdf/20150023456.txt: "they were burned in oxidizing atmospheres at ambient temperature"
  - Reason: "ambient temperature" had no quote.
- `measurements`: added supporting quote from raw/pdf/20150023456.txt: "The image system for the backlit view was the High-Bit-Depth Multispectral (HiBMs) imaging package."
  - Reason: The first measurement names HiBMs; no quote did.

### FLEX-2

- `pi`: added supporting quote from raw/psi/investigations/PSI-68.json: ""affiliation":"University of California, San Diego","comments":[{"name":"Study Person REF","value":""}],"email":"fwilliams@eng.ucsd.edu","fa..."
  - Reason: The only quote for "pi" called Williams "Research Team Lead"; the PSI-68 record gives him the role Principal Investigator (PI).
- `objectives`: added supporting quote from raw/psi/investigations/PSI-68.json: "Investigate the role of liquid-phase mixing on the burning characteristics of bi-component fuel droplets."
  - Reason: The objectives text lists liquid-phase mixing, steady and unsteady burning, extinction boundaries, soot and droplet interactions; the two original quotes did not cover them. These are the itemized objectives of the PSI-68 record.
- `objectives`: added supporting quote from raw/psi/investigations/PSI-68.json: "Examine the steady and unsteady liquid and gas-phase phenomena in pure fuel combustion."
  - Reason: The objectives text lists liquid-phase mixing, steady and unsteady burning, extinction boundaries, soot and droplet interactions; the two original quotes did not cover them. These are the itemized objectives of the PSI-68 record.
- `objectives`: added supporting quote from raw/psi/investigations/PSI-68.json: "Study flame extinction mechanisms and their boundaries."
  - Reason: The objectives text lists liquid-phase mixing, steady and unsteady burning, extinction boundaries, soot and droplet interactions; the two original quotes did not cover them. These are the itemized objectives of the PSI-68 record.
- `objectives`: added supporting quote from raw/psi/investigations/PSI-68.json: "Analyze the soot formation process, including soot volume fraction soot-shell dynamics."
  - Reason: The objectives text lists liquid-phase mixing, steady and unsteady burning, extinction boundaries, soot and droplet interactions; the two original quotes did not cover them. These are the itemized objectives of the PSI-68 record.
- `objectives`: added supporting quote from raw/psi/investigations/PSI-68.json: "Determine the influence of droplet interactions on the flammability limits and extinction behavior of droplet arrays."
  - Reason: The objectives text lists liquid-phase mixing, steady and unsteady burning, extinction boundaries, soot and droplet interactions; the two original quotes did not cover them. These are the itemized objectives of the PSI-68 record.
- `sample_geometry`: "A single droplet or a pair of droplets (binary linear array) on a support fiber, initial diameter 1.5 to 5 mm; in flow tests a tethered droplet is moved through the quiescent gas" -> "A single droplet or a pair of droplets (binary linear array), initial diameter 1.5 to 5 mm; in convective flow tests the droplet is tethered at the intersection of two fiber crosshairs that are moved through the quiescent atmosphere"
  - Reason: Removed "on a support fiber" for all tests: the quotes say single droplet or pair, and name the tether only for the convective flow tests (the PSI record also mentions freely deployed droplets).
- `measurements`: first two entries now end with "(as specified in the 2010 science requirements document)"
  - Reason: Their quotes come from the pre-flight requirements document, which says what is to be measured, not what was obtained.

### CFI

- `pi`: added supporting quote from raw/psi/investigations/PSI-39.json: ""affiliation":"University of California, San Diego","comments":[{"name":"Study Person REF","value":""}],"email":"fwilliams@ucsd.edu","fax":"..."
  - Reason: The original quotes say "Science Definition Team" and "principal investigator for three of the investigations conducted within the MDCA" without naming CFI; the PSI-39 record gives Williams the role Principal Investigator (PI).
- `years`: added supporting quote from raw/psi/tables/PSI-39_Experimental table_CFI.csv: "1387,21-Aug-17,12:48:15 pm est,f233d05,1 atm,0.21,0.2,0.59,,[.60]/[.40] C12H26/iso-dodecane"
  - Reason: The "years" text gives 21-Aug-17 as the last table date; only the first row (9-Mar-17) was quoted.
- `conditions.flow`: "None imposed: droplets are deployed free floating without residual momentum in a quiescent chamber" -> "None imposed: the operational requirement is that droplets are deployed free floating without any residual momentum"
  - Reason: Removed "in a quiescent chamber": the word quiescent is in neither CFI document saved here.

## Left as written, with a remark

- DROPLETS-015 keeps "model or analysis": the microgravity values in the cited table come from simulations, and the label does not overstate them.
- DROPLETS-020, -022, -023, -056 keep "flight experiment" although the source is a summary: each names the experiment (FLEX, or FLEX and FLEX-2) and states its result.
- DROPLETS-035, -036, -037 keep "ground low-gravity (drop tower, aircraft)": section 3.5 of the FLEX-2 requirements document says the droplet-array data "were limited by the time available in the microgravity facilities" and goes on to ground-based drop towers and aircraft. The fuel of these tests is not named in the passage and stays null.
- DROPLETS-042: the source figure caption next to this passage prints "14%O2 and 96%N2" for test R383 (a typo in the paper); no finding uses that value.
- DROPLETS-053: the report writes "n-dodecanol" and "iso-dodecanol"; the claim says so and reads them as n-dodecane and iso-dodecane, which the figure caption beside it ("FLEX-1223: N-dodecane") and the test list support.
- PSI-69 table row 114 records an ambient pressure of 0 mmHg (a data-entry gap); no finding or investigation field uses it.
- earth_instinct texts are the author's framing and were not edited.
