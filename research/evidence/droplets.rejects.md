# droplets.json: rejected and changed items

Input: 64 findings, 3 investigation records. Kept unchanged: 0. Kept with changes: 63. Rejected: 1.

Verification date: 2026-11-14. Verifier: Nemesis.

## Rejected findings

- **DROPLETS-053**: The quote says n-dodecanol and iso-dodecanol, but the report fuel list, figure captions and PSI-39 identify n-dodecane and iso-dodecane. Applying this result to the alkanes requires an unverified editorial correction of chemical identity. No corrected literal source was found in the supplied evidence; the fuel-specific result and its design inference are rejected.
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt, section 5.1, contrasted with sections 1/4 and the Figure 1 caption.

## Changed findings

### DROPLETS-001 (conditions, decision_hint)
Source: raw/ntrs/20130014061.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "International Space Station, Combustion Integrated Rack", "fuel": "methanol", "o2_percent": "12 to 13 (limiting oxygen index)", "pressure": "0.7 and 1 atmospheric pressures", "flow": "quiescent"}
- conditions after: {"gravity": null, "platform": null, "fuel": "methanol", "o2_percent": "12 to 13 (limiting oxygen index)", "pressure": null, "flow": null}
- decision_hint before: "Treat every breathable cabin oxygen level as able to support a liquid-fuel flame; use the 12-13% figure only as the target when inerting a sealed, uncrewed volume."
- decision_hint after: "For methanol in the tested diluent gases, the reported limiting oxygen index was around 12% to 13%. This is not a compartment inerting target."

### DROPLETS-002 (conditions, decision_hint)
Source: raw/ntrs/20120016855.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "International Space Station, Combustion Integrated Rack Facility", "fuel": "methanol", "o2_percent": "13", "pressure": "one atmosphere", "flow": "quiescent"}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": "13", "pressure": "one atmosphere", "flow": null}
- decision_hint before: "An ignition source can still start a liquid-fuel flame at 13% oxygen; keep ignition control in place even in a reduced-oxygen compartment."
- decision_hint after: "Ignition and some burning occurred at 13% oxygen in this test; this oxygen level did not prevent ignition."

### DROPLETS-003 (conditions, decision_hint)
Source: raw/psi/tables/PSI-69_Experimental table_FLEX.csv.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "Methanol", "o2_percent": "12", "pressure": "770 mmHg", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "Methanol", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Data point for flammability models: at 12% oxygen a 3 mm methanol droplet still held a visible flame for seconds before going out with most of the fuel left."
- decision_hint after: "This row records a 9 s burn and extinction at a nonzero droplet diameter; it is one test, not a general oxygen limit."

### DROPLETS-004 (conditions, decision_hint)
Source: raw/psi/tables/PSI-69_Experimental table_FLEX.csv.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "Heptane", "o2_percent": "14", "pressure": "767.1 mmHg", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "Heptane", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "A 1 mm droplet burned out completely at an oxygen level where 4 mm droplets in the same table went out with nearly all their fuel left (test 213); the limit depends on the size of the fuel element, so do not apply a large-droplet limit to fine droplets."
- decision_hint after: "This row records completion for one small heptane droplet; it does not establish a size-independent oxygen limit."

### DROPLETS-005 (claim, quote, conditions, decision_hint)
Source: raw/pdf/20150023456.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- claim: Retained probability and the adjacent possible cool-flame outcome.
- claim before: "In FLEX test 079 a free-floating heptane droplet in 0.13/0.85 O2/N2 at 1.0 atm gave only a very short, entirely transient burn; the report judges this atmosphere probably below the quasi-steady flammability limit."
- claim after: "In FLEX test 079 a free-floating heptane droplet in 0.13/0.85 O2/N2 at 1.0 atm gave only a very short, entirely transient burn; the report judges this atmosphere probably below the quasi-steady flammability limit. It also notes a vapor cloud that may indicate subsequent cool-flame burning and extinction."
- quote before: "Figure 83.—Test FLEX−079. Free-floating heptane droplet burning in a 0.13/0.85 O2/N2, 1.0-atm ambient environment. This very short burn was entirely transient. The ambient environment was probably below the quasi-steady flammability limit."
- quote after: "Figure 83.-Test FLEX-079. Free-floating heptane droplet burning in a 0.13/0.85 O2/N2, 1.0-atm ambient environment. This very short burn was entirely transient. The ambient environment was probably below the quasi-steady flammability limit. A small vapor cloud formed shortly after the visible flame extinguished, which may be indicative of cool flame burning and extinction following hot flame extinction."
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "heptane", "o2_percent": "13", "pressure": "1.0 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "heptane", "o2_percent": "0.13 O2 mole fraction (13%)", "pressure": "1.0 atm", "flow": null}
- decision_hint before: "For heptane the quasi-steady limit sits near 13% oxygen at 1 atm in this data set; a flame can still flash briefly at ignition below the limit."
- decision_hint after: "Keep the qualification: this transient test was probably below the quasi-steady flammability limit, not proof of a universal 13% cutoff."

### DROPLETS-006 (conditions, decision_hint)
Source: raw/pdf/20150023456.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "methanol and n-heptane", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Use measured microgravity limits, not pre-flight estimates, when setting an inerting target."
- decision_hint after: "The report found LOI values slightly below its initial expectations; those expectations are not measured limits."

### DROPLETS-007 (conditions, decision_hint)
Source: raw/nasa/researchers-guide-combustion.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity compared with normal gravity", "platform": null, "fuel": "heptane and methanol", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "heptane and methanol", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Add margin to oxygen limits taken from normal-gravity tests; for these liquid fuels the microgravity limit was lower. Partial gravity lies between the two and is not measured here."
- decision_hint after: "For these droplets the reported oxygen limit was lower than in normal gravity. No partial-gravity limit is established."

### DROPLETS-008 (conditions, decision_hint)
Source: raw/nasa/researchers-guide-combustion.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "reduced gravity compared with normal gravity", "platform": null, "fuel": "heptane and methanol", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": "reduced gravity compared with normal gravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Do not carry a ground-qualified inert-gas design concentration into a spacecraft or habitat unchanged; require microgravity extinction data or added margin."
- decision_hint after: "The reduced-gravity results call into question transferring the same terrestrial suppressant margin to low gravity; no replacement concentration is given."

### DROPLETS-009 (claim, conditions, decision_hint)
Source: raw/pdf/20130010979.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: Made the unprinted unit explicit.
- claim before: "FLEX test point FLEX-145: a methanol droplet of 3.38 mm burned at 1.0 atm in 20% O2 / 75% CO2 / 5% N2, with visible flame extinction at a droplet size of 1.66."
- claim after: "FLEX test point FLEX-145 lists a methanol droplet with initial diameter 3.38 mm at 1.0 atm in 20% O2 / 75% CO2 / 5% N2, and Dext = 1.66 at visible flame extinction; this excerpt prints no unit for Dext."
- conditions before: {"gravity": "microgravity", "platform": "ISS (FLEX)", "fuel": "methanol", "o2_percent": "20", "pressure": "1.0 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "Methanol", "o2_percent": "20", "pressure": "1.0 atm", "flow": null}
- decision_hint before: "Judge a CO2 discharge by the oxygen fraction it leaves, not by how much CO2 was released: this droplet burned with 75% CO2 around it because oxygen was still 20%."
- decision_hint after: "This test demonstrates burning in 75% CO2 and 20% O2 at 1 atm. It does not establish an effective suppressant concentration."

### DROPLETS-010 (conditions, decision_hint)
Source: raw/psi/tables/PSI-69_Experimental table_FLEX.csv.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "Heptane", "o2_percent": "21", "pressure": "1553.8 mmHg", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "Heptane", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Same lesson as FLEX-145 for a sooting fuel: 70% CO2 did not prevent burning while oxygen remained at 21% (this record is at about twice sea-level pressure)."
- decision_hint after: "This row records heptane burning in the listed mixture and pressure; the CO2 fraction alone did not prevent burning in this test."

### DROPLETS-011 (conditions, decision_hint)
Source: raw/psi/tables/PSI-69_Experimental table_FLEX.csv.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "Methanol", "o2_percent": "15", "pressure": "533.5 mmHg", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "Methanol", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "A quantitative extinction point for suppression models: at about 0.7 atm, 15% oxygen with 50% CO2 let a large methanol droplet flame survive only about a second."
- decision_hint after: "This is one recorded extinction point: 1.3 s burn time and a 3.95 mm extinction diameter from a 3.98 mm initial droplet."

### DROPLETS-012 (topic, conditions, decision_hint)
Source: raw/pdf/20150023456.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- topic: The report does not establish absence of cool flame.
- topic before: "Heptane in 17% oxygen with 45% carbon dioxide: quick extinction, no cool flame"
- topic after: "Heptane in 17% oxygen with 45% carbon dioxide: quick extinction, probably no or only brief cool flame"
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "heptane", "o2_percent": "17", "pressure": "0.7 atm", "flow": "3 mm/s (droplet translated on a fiber)"}
- conditions after: {"gravity": null, "platform": null, "fuel": "heptane", "o2_percent": "0.17 O2 mole fraction (17%)", "pressure": "0.7 atm", "flow": "droplet translating 3 mm/s"}
- decision_hint before: "A reference atmosphere in which both the visible flame and the cool flame failed for heptane: 17% oxygen with 45% CO2 at 0.7 atm."
- decision_hint after: "The report infers probably no, or only very brief, cool-flame burning in this test. It does not demonstrate complete absence of that mode."

### DROPLETS-013 (conditions, decision_hint)
Source: raw/pdf/20150023456.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "methanol and heptane", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "When reading FLEX tables, the last CO2 fraction with quasi-steady burning brackets the minimum extinguishing concentration for that pressure and oxygen level."
- decision_hint after: "The test endpoint was absence of quasi-steady burning; that criterion is distinct from complete absence of transient combustion."

### DROPLETS-014 (quote, decision_hint)
Source: raw/pdf/PSI-69_FLEX-Test-Plan.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- quote before: "The LOI is a critical concept in fire safety, and also important in developing, refining and ultimately validating detailed chemical kinetic mechanisms. For fire safety, the goal of the agent in a total flooding application is to reduce the oxygen concentration below the LOI"
- quote after: "The LOI is a critical concept in fire safety, and also important in developing, refining and ultimately validating detailed chemical kinetic mechanisms. For fire safety, the goal of the agent in a total flooding application is to reduce the oxygen concentration below the LOI ."
- decision_hint before: "Size a total-flooding discharge so the compartment ends below the limiting oxygen index of the worst-case fuel, and confirm with an oxygen reading."
- decision_hint after: "The plan describes reducing oxygen below the LOI as the total-flooding objective; this passage supplies no dose or crew procedure."

### DROPLETS-015 (conditions, evidence_level, decision_hint)
Source: raw/pdf/PSI-69_FLEX-Test-Plan.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- evidence_level: The test plan repeats Takahashi et al. background tests and simulations, not a FLEX model result.
- conditions before: {"gravity": "1-g and microgravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": "1-g and microgravity", "platform": null, "fuel": "methane", "o2_percent": null, "pressure": null, "flow": null}
- evidence_level before: "model or analysis"
- evidence_level after: "review or summary"
- decision_hint before: "For all three inert gases listed the microgravity figure is higher than the 1-g figure; budget more agent than a ground test suggests, most of all for nitrogen."
- decision_hint after: "All three microgravity MEC values exceed their 1-g values in this cited cup-burner comparison. These are background tests and simulations, not FLEX droplet measurements."

### DROPLETS-016 (decision_hint)
Source: raw/pdf/PSI-69_FLEX-Test-Plan.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "Plan for a higher CO2 concentration in microgravity than the normal-gravity value; a lunar or Martian habitat lies between the two figures and has no direct data in this source."
- decision_hint after: "The cited cup-burner study reports a higher CO2 fraction for flame-base destabilization in microgravity; no lunar or Martian value follows."

### DROPLETS-017 (conditions, decision_hint)
Source: raw/pdf/PSI-69_FLEX-Test-Plan.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "thin solid fuels", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": "microgravity", "platform": null, "fuel": "thin solid fuels", "o2_percent": null, "pressure": null, "flow": "opposed-flow"}
- decision_hint before: "Do not assume the ground ranking of inert agents carries over; compare agents with microgravity data before selecting one."
- decision_hint after: "The cited thin-solid study suggests different CO2 and helium effectiveness; it does not establish their ranking for every fuel and geometry."

### DROPLETS-018 (conditions, decision_hint)
Source: raw/pdf/PSI-69_FLEX-Test-Plan.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "reduced gravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": "absence of buoyantly-driven convective flows"}
- decision_hint before: "Treat CO2 as a radiatively active gas when modeling suppression in microgravity; its effect is not only dilution."
- decision_hint after: "The passage describes radiative interaction with CO2, not just oxygen displacement; that interaction belongs in interpreting this result."

### DROPLETS-019 (conditions, decision_hint)
Source: raw/pdf/20090014812.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": "0.5 to 1.0 atm (planned test range)", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "If depressurizing a module is part of the fire response, base the plan on extinction data taken at reduced pressure, since burning rate barely drops as pressure falls."
- decision_hint after: "The fact sheet motivates low-pressure suppressant data; it specifies neither a depressurization endpoint nor a qualified response procedure."

### DROPLETS-020 (conditions, decision_hint)
Source: raw/nasa/researchers-guide-combustion.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "spaceflight (FLEX)", "fuel": "alkane droplets", "o2_percent": null, "pressure": null, "flow": "quiescent"}
- conditions after: {"gravity": "spaceflight", "platform": "spaceflight (FLEX)", "fuel": "alkane droplets", "o2_percent": null, "pressure": null, "flow": "quiescent"}
- decision_hint before: "After a liquid hydrocarbon flame disappears, keep treating the source as burning until a non-visual signal (radiant heat, combustion gases, fuel no longer being consumed) says otherwise."
- decision_hint after: "For the FLEX droplets described here, visible-flame extinction preceded sustained cool-flame-supported vaporization."

### DROPLETS-021 (conditions, decision_hint)
Source: raw/pdf/20150023456.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "heptane", "o2_percent": "21 (cabin air, 0.21/0.79 O2/N2)", "pressure": "1.0 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "heptane", "o2_percent": "0.21 O2 mole fraction (21%)", "pressure": "1.0 atm", "flow": null}
- decision_hint before: "In ordinary cabin air the invisible stage consumed fuel almost as fast as the visible flame; do not count the fuel as saved when the flame disappears."
- decision_hint after: "For FLEX-035 the report calls the vigorous post-visible-flame vaporization indicative of cool-flame burning and extinction, not direct measurement of remaining fuel mass."

### DROPLETS-022 (conditions, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "n-alkane fuels", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": "microgravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Detection logic keyed to hot-flame temperature or visible light can miss a 700 to 900 K cool flame; add sensing that does not depend on either."
- decision_hint after: "Stable flames without visible emission were reported at 700 to 900 K; this passage does not validate a detector or a sensing threshold."

### DROPLETS-023 (conditions, decision_hint)
Source: raw/nasa/iss-passes-torch-flame-studies.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "International Space Station", "fuel": "heptane", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "heptane", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Write the response procedure with two end points: visible flame out, then confirmed end of reaction."
- decision_hint after: "The FLEX observation distinguishes visible-flame extinction from a later, invisible combustion endpoint."

### DROPLETS-024 (decision_hint)
Source: raw/nasa/cir-eight-years.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "Hold the post-fire watch for minutes, not seconds, after the visible flame is gone."
- decision_hint after: "The reported minute or two of microgravity observation is not a validated post-fire watch time."

### DROPLETS-025 (decision_hint)
Source: raw/nasa/cir-eight-years.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "Buoyant flow is what removes this hazard on Earth. Whether lunar or Martian gravity gives enough buoyant flow is not tested in these sources; treat partial gravity as unknown for cool flames."
- decision_hint after: "This explanation concerns buoyant flow on Earth; it supplies no lunar or Martian cool-flame limit."

### DROPLETS-026 (decision_hint)
Source: raw/nasa/iss-combustion-fire-safety.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "Include carbon monoxide in the post-fire check: CO rising with no visible flame is consistent with cool-flame burning, and both products are toxic."
- decision_hint after: "NASA names CO and formaldehyde as products here; it gives no thresholds or way to diagnose cool flames from either gas alone."

### DROPLETS-027 (conditions, evidence_level, decision_hint)
Source: raw/pdf/20210022617.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- evidence_level: This conclusion is a potential-hazard summary, not a named observed reignition test.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- evidence_level before: "flight experiment"
- evidence_level after: "review or summary"
- decision_hint before: "Keep suppression ready and the area isolated after flame-out; a hot flame can return without a new ignition source."
- decision_hint after: "The team flags potential re-ignition as a safety concern; the passage does not prescribe isolation or suppression procedures."

### DROPLETS-028 (decision_hint)
Source: raw/pdf/PSI-69_Cool-Flames-in-Space-a-Hot-Prospect-on-Earth.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "Handle an extinguished liquid-fuel fire like a smoldering one: assume combustible vapor is still being produced until shown otherwise."
- decision_hint after: "The presentation reports decane re-ignition and gives a smoldering analogy; it does not establish a response protocol for all liquid fuels."

### DROPLETS-029 (conditions, decision_hint)
Source: raw/pdf/PSI-69_Presentation-1G17-070HE-0166.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "n-heptane", "o2_percent": "21 (0.21 XO2)", "pressure": "one atmosphere", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "After a CO2 discharge knocks down the visible flame of a liquid-fuel fire, expect that a cool flame may follow; confirm with non-visual sensing before re-entering or restoring airflow."
- decision_hint after: "In this simulation enhanced heat loss could trigger cool-flame burning; it does not predict the outcome of a cabin CO2 discharge."

### DROPLETS-030 (quote, conditions, decision_hint)
Source: raw/pdf/20140006750.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- quote before: "shows three typical free-ﬂoated cases, corresponding to ambient gas mixtures of 21% oxygen 79% nitrogen, 18% oxygen 82% nitrogen, and 18% oxygen 67% nitrogen 15% carbon dioxide, all by volume, at one atmospheric pressure. The initial diameters for these cases respectively were 3.91, 3.48, and 2.49 mm. All three cases exhibit radiative extinction followed by cool ﬂame combustion and the second stage extinction leading to pure vaporization."
- quote after: "Detailed results for n-heptane droplets burning in oxygen/carbon dioxide/nitrogen mixtures were presented earlier [3]. We summarize those results here for the sake of completeness. Figure 6 3 shows three typical free-floated cases, corresponding to ambient gas mixtures of 21% oxygen 79% nitrogen, 18% oxygen 82% nitrogen, and 18% oxygen 67% nitrogen 15% carbon dioxide, all by volume, at one atmospheric pressure. The initial diameters for these cases respectively were 3.91, 3.48, and 2.49 mm. All three cases exhibit radiative extinction followed by cool flame combustion and the second stage extinction leading to pure vaporization."
- conditions before: {"gravity": "microgravity", "platform": "ISS, Combustion Integrated Rack", "fuel": "n-heptane", "o2_percent": "21 and 18", "pressure": "one atmospheric pressure", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "n-heptane", "o2_percent": "21 and 18", "pressure": "one atmospheric pressure", "flow": null}
- decision_hint before: "Lower oxygen (18%) and 15% CO2 did not stop the invisible second stage; treat partial dilution as a way to lose sight of the fire, not to end it."
- decision_hint after: "All three reported cases included cool-flame burning after radiative extinction; this is not a general dilution or suppression rule."

### DROPLETS-031 (claim, conditions, decision_hint)
Source: raw/pdf/20150018397.abstract.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: Restored the injection condition and final extinction.
- claim before: "A two-dimensional simulation of the FLEX observations with a gaseous n-heptane source in zero gravity found that in near-quiescent air (2 mm/s or less) the growing spherical flame extinguishes at about 1200 K from radiative heat loss, moves to a cool-flame regime with a reaction zone at about 700 K close to the fuel source, and after about 18 s of cool flame a flash re-ignition occurs."
- claim after: "A two-dimensional simulation using a gaseous n-heptane source in zero gravity predicts that in air at <=2 mm/s, with fuel injection velocity 1 cm/s, a growing spherical flame radiatively extinguishes at about 1200 K, transitions to a roughly 700 K cool-flame regime, and after about 18 s undergoes flash re-ignition followed by extinction of the re-ignited flame."
- conditions before: {"gravity": "zero gravity", "platform": null, "fuel": "n-heptane (gaseous fuel source)", "o2_percent": null, "pressure": null, "flow": "2 mm/s or less"}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": "air speed <=2 mm/s; fuel injection velocity 1 cm/s"}
- decision_hint before: "Expect a possible flash back to a hot flame some tens of seconds after flame-out in still air; keep crew and extinguisher positioned for it."
- decision_hint after: "The roughly 18 s interval is a simulation result for the stated flow and injection conditions, not a crew-response countdown."

### DROPLETS-032 (conditions, decision_hint)
Source: raw/pdf/20150018397.abstract.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "zero gravity", "platform": null, "fuel": "n-heptane (gaseous fuel source)", "o2_percent": null, "pressure": null, "flow": "about 3 mm/s; 4 to 10 mm/s"}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": "about 3 mm/s; 4 to 10 mm/s"}
- decision_hint before: "After fans are shut off, residual air motion of a few mm/s can be enough to hold a flame on its upstream side; allow the flow to decay and check where the residual flow comes from."
- decision_hint after: "The model changed from pulsating to steady local extinction with airflow changes of a few mm/s; this is not a tested fan-shutdown procedure."

### DROPLETS-033 (conditions, decision_hint)
Source: raw/pdf/20150023456.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "heptane", "o2_percent": "18", "pressure": "1.0 atm", "flow": "3 mm/s for approximately 4 s, then none"}
- conditions after: {"gravity": null, "platform": null, "fuel": "heptane", "o2_percent": "0.18 O2 mole fraction (18%)", "pressure": "1.0 atm", "flow": "droplet translating 3 mm/s for approximately 4 s, then translation stopped"}
- decision_hint before: "Stopping the airflow ended the visible flame in this single test at 18% oxygen, which supports fan shutdown as a first step, but fuel kept reacting afterwards: follow fan shutdown with a non-visual check."
- decision_hint after: "Visible extinction followed stopping droplet translation, with later behavior indicative of cool-flame burning. Droplet translation is not cabin ventilation."

### DROPLETS-034 (evidence_level, decision_hint)
Source: raw/ntrs/20110020695.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- evidence_level: The abstract names no drop tower or aircraft.
- evidence_level before: "ground low-gravity (drop tower, aircraft)"
- evidence_level after: "ground low-gravity"
- decision_hint before: "Adding CO2 without lowering the oxygen fraction did not make these small flames go out sooner; a suppressant plan has to displace oxygen."
- decision_hint after: "At fixed 21% oxygen, added CO2 gave only a slight decrease in extinction diameter in these precursor tests; this does not show that all suppression must displace oxygen."

### DROPLETS-035 (conditions, evidence_level, decision_hint)
Source: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- evidence_level: A requirements document recounts precursor work; the quoted passage is not a FLEX-2 flight result or an identified ground-facility record.
- conditions before: {"gravity": "microgravity compared with normal gravity", "platform": null, "fuel": null, "o2_percent": "15", "pressure": "190 mmHg", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": "0.15 oxygen mole fraction (15%)", "pressure": "190 mmHg", "flow": null}
- evidence_level before: "ground low-gravity (drop tower, aircraft)"
- evidence_level after: "review or summary"
- decision_hint before: "A low-pressure, low-oxygen atmosphere that passes a normal-gravity flammability test can still burn in microgravity; qualify exploration atmospheres with low-gravity data."
- decision_hint after: "The precursor comparison demonstrates a difference in normal-gravity and microgravity flammability for these droplets and conditions, not a qualified habitat atmosphere."

### DROPLETS-036 (claim, conditions, evidence_level, decision_hint)
Source: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: Removed nitrogen from the claim because it is outside this quote.
- evidence_level: A requirements document recounts precursor work; the quoted passage is not a FLEX-2 flight result or an identified ground-facility record.
- claim before: "In the 0.15 oxygen mole fraction ambient, over a range of inter-droplet spacings and ambient pressures, the flame surrounding a binary droplet array always extinguished at a finite droplet size larger than the single droplet extinction diameter."
- claim after: "The FLEX-2 science requirements recount precursor observations over a range of droplet spacings and pressures: at oxygen mole fraction 0.15, the binary-array flame always extinguished at a finite droplet size larger than the single-droplet extinction diameter."
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": null, "o2_percent": "15", "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": "0.15 oxygen mole fraction (15%)", "pressure": null, "flow": null}
- evidence_level before: "ground low-gravity (drop tower, aircraft)"
- evidence_level after: "review or summary"
- decision_hint before: "Near the oxygen limit in nitrogen-diluted air, a merged flame around neighbouring fuel elements loses more heat by radiation and can go out sooner; do not extrapolate single-item limits to clustered fuel in either direction."
- decision_hint after: "The precursor observations show different extinction diameters for paired and isolated droplets; this quote does not identify a heat-loss mechanism."

### DROPLETS-037 (claim, conditions, evidence_level, decision_hint)
Source: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: Identified the precursor summary as such.
- evidence_level: A requirements document recounts precursor work; the quoted passage is not a FLEX-2 flight result or an identified ground-facility record.
- claim before: "In an oxygen/helium ambient the flame around a single droplet extinguished quickly after ignition (extinction diameter about 1.4 mm) while the flame around the binary array burned much longer to a smaller extinction diameter (about 1.1 mm), a trend opposite to the O2/N2 experiments but in agreement with normal gravity experiments."
- claim after: "The FLEX-2 requirements recount precursor oxygen/helium observations: the single-droplet flame extinguished quickly at about 1.4 mm while the binary-array flame burned longer to about 1.1 mm. The document states that this trend is opposite to the O2/N2 experiments and agrees with normal-gravity experiments."
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": null, "o2_percent": "25 (0.25 oxygen mole fraction, balance helium)", "pressure": "190 mm Hg", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- evidence_level before: "ground low-gravity (drop tower, aircraft)"
- evidence_level after: "review or summary"
- decision_hint before: "The effect of neighbouring fuel on extinction depends on the diluent gas; a habitat using a helium-bearing atmosphere needs its own data."
- decision_hint after: "The precursor comparison reversed the single-versus-pair extinction trend in oxygen/helium; it does not establish a habitat safety limit."

### DROPLETS-038 (conditions, decision_hint)
Source: raw/pdf/PSI-39_Aspects-of-Cool-Flame-Supported-Droplet-Combustion.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "International Space Station", "fuel": "n-decane", "o2_percent": "17", "pressure": "1 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "N-decane", "o2_percent": "17", "pressure": "1 atm", "flow": null}
- decision_hint before: "Clustered fuel can enter the invisible cool-flame mode under conditions where an isolated item does not; assume the less visible outcome when several fuel sources are close together."
- decision_hint after: "For these n-decane droplets the pair showed cool-flame burning where the single showed only a hot flame; the result is specific to the stated atmosphere."

### DROPLETS-039 (quote, conditions, decision_hint)
Source: raw/pdf/20140006750.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- quote before: "Both the color camera and the UV-camera are not sensitive enough to register any ﬂame images during this period. Both the broadband and narrowband radiometers, however, register continued radiative heat loss from the droplet indicating active chemical heat release."
- quote after: "The second-stage combustion termed \"cool flame\" zone starts immediately following hot-flame extinction. As in the hot-flame region the square of the droplet diameter decreases linearly with time in the cool-flame region, but at a slightly slower rate. Both the color camera and the UV-camera are not sensitive enough to register any flame images during this period. Both the broadband and narrowband radiometers, however, register continued radiative heat loss from the droplet indicating active chemical heat release. The end of \"cool flame\" combustion is clearly marked by the rapid drop in the narrowband radiometer output. Following cool flame extinction the droplet simply evaporates in the hot environment and the radiative loss measurements decay to zero values without any further abrupt changes."
- conditions before: {"gravity": "microgravity", "platform": "ISS, Combustion Integrated Rack", "fuel": "n-decane", "o2_percent": "21", "pressure": "0.5 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Pair optical flame detection with infrared radiometry or gas sensing; in this test only the radiometers showed that reaction was continuing."
- decision_hint after: "Radiometers registered continued heat release when these cameras showed no flame image; that is an instrument observation in this test, not a validated detector design."

### DROPLETS-040 (claim, conditions, decision_hint)
Source: raw/pdf/20140006750.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: Distinguished diameter-squared burning constants from mass-loss rates.
- claim before: "ISS test R298 (n-octane series, droplet of 3.6 mm burning in air): both hot-flame and cool-flame burning modes existed, with burning rates of 0.48 and 0.38 mm2/s respectively."
- claim after: "Test R298 in the paper's n-octane series used a droplet with initial diameter 3.6 mm in O2:N2 = 0.21:0.79, without helium dilution. The reported hot/cool burning-rate constants were 0.48 and 0.38 mm2/s, respectively."
- conditions before: {"gravity": "microgravity", "platform": "ISS, Combustion Integrated Rack", "fuel": "n-octane", "o2_percent": "21 (air, O2:N2 = 0.21:0.79)", "pressure": "one atmospheric pressure", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": "O2:N2 = 0.21:0.79 (21% oxygen)", "pressure": null, "flow": null}
- decision_hint before: "Fuel was consumed in the cool-flame stage at 0.38 against 0.48 mm2/s for the hot flame; absence of a visible flame is not evidence that fuel consumption has stopped."
- decision_hint after: "The reported hot/cool burning constants were 0.48 and 0.38 mm2/s; these are diameter-squared regression rates, not mass-loss rates."

### DROPLETS-041 (conditions, decision_hint)
Source: raw/pdf/20140006750.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "ISS, Combustion Integrated Rack", "fuel": "n-decane", "o2_percent": "14 to 25", "pressure": "0.5 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Lowering oxygen shortens both stages; an oxygen draw-down is still a valid response, provided the invisible stage is monitored."
- decision_hint after: "Reduced oxygen led to earlier extinction in the compared n-decane cases; this does not demonstrate a general oxygen draw-down procedure."

### DROPLETS-042 (conditions, decision_hint)
Source: raw/pdf/20140006750.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "ISS, Combustion Integrated Rack", "fuel": "n-alkane droplets", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "In oxygen-enriched exploration atmospheres do not count on a large fuel source putting itself out by radiative loss; the same paper reports a 25% oxygen, 0.5 atm case that burned until the droplet micro-exploded 26 seconds after ignition."
- decision_hint after: "The paper reports that sufficiently high oxygen avoided radiative extinction in these cases; it gives no universal oxygen threshold."

### DROPLETS-043 (claim, quote, conditions, decision_hint)
Source: raw/pdf/20140006750.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- claim: Removed the oxygen value from elsewhere and retained the transient qualification.
- claim before: "In ISS test R707 (n-octane series, oxygen mole fraction 0.21, helium dilution 75% by volume, droplet of 2.49 mm) first-stage burning was almost eliminated: the hot flame formed at ignition died within a fraction of a second, cool flame burning began immediately and also ended quickly, leaving the droplet to evaporate."
- claim after: "In test R707 of the paper's n-octane series, at 75% helium dilution and initial diameter 2.49 mm, the hot flame died within a fraction of a second and a short cool flame followed. The entire process was transient and quasi-steady burning was not achieved."
- quote before: "When helium dilution was increased to 75% by volume in test R707 for D0 of 2.49 mm ﬁrst stage burning is almost eliminated (see, Fig. (2d)). The hot ﬂame that formed during the ignition dies within a fraction of a second and the cool ﬂame burning commences immediately which also ends quickly leaving the droplet to evaporate."
- quote after: "When helium dilution was increased to 75% by volume in test R707 for D0 of 2.49 mm first stage burning is almost eliminated (see, Fig. (2d)). The hot flame that formed during the ignition dies within a fraction of a second and the cool flame burning commences immediately which also ends quickly leaving the droplet to evaporate. The high thermal conductivity of helium leads to large heat loss from the flame zone and as a consequence the flame temperature rapidly decreases leading to cool flame extinction. The entire process was transient and quasi- steady burning was not achieved."
- conditions before: {"gravity": "microgravity", "platform": "ISS, Combustion Integrated Rack", "fuel": "n-octane", "o2_percent": "21", "pressure": "one atmospheric pressure", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Heavy helium dilution removed the hot flame almost at once in this test, yet a short cool flame still occurred; 75% helium with 21% oxygen is a test atmosphere, not a cabin setting."
- decision_hint after: "At 75% helium this test still briefly entered cool-flame burning; the authors say the process was transient and not quasi-steady."

### DROPLETS-044 (topic, claim, conditions, decision_hint)
Source: raw/pdf/PSI-69_Presentation-2G11-070HE-0310.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- topic: The source reports burning constants, not direct mass-loss measurements.
- claim: Clarified the visible-extinction endpoint.
- topic before: "After extinction, n-octane still lost mass faster than by evaporation alone"
- topic after: "Post-visible-flame diameter regression exceeded the pure-evaporation comparison"
- claim before: "For an n-octane droplet of 3.61 mm initial diameter, the burning rate dropped at extinction, but the post-extinction burning rate was still higher than the rate of pure evaporation."
- claim after: "For an n-octane droplet with initial diameter 3.61 mm, the paper reports a decrease in burning rate at visible-flame extinction, while the post-extinction rate remained above the pure-evaporation comparison."
- conditions before: {"gravity": "low gravity", "platform": "International Space Station, MDCA", "fuel": "n-octane", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "n-octane", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Fuel loss faster than plain evaporation after flame-out is a usable sign that reaction continues; a mass-loss or vapor measurement can stand in for a flame sensor."
- decision_hint after: "The comparison with pure evaporation supports continuing post-visible-flame burning; it does not validate a mass-loss or vapor sensor."

### DROPLETS-045 (claim, quote, conditions, decision_hint)
Source: raw/pdf/PSI-69_Presentation-2G11-070HE-0310.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- claim: Separated observation, inference and conjecture.
- claim before: "For initial droplet diameters above 1.5 mm, n-octane and n-decane droplet flames appeared less luminous and therefore less sooty, yet the droplets burned progressively slower as initial diameter increased."
- claim after: "For initial diameters above 1.5 mm the flames appeared less luminous, which the authors interpreted as less sooty, and burning slowed as initial diameter increased. They conjecture a competition between radiative losses and residence-time effects."
- quote before: "For Do > 1.5 mm the droplet flames appeared less luminous and therefore less sooty, yet the droplets continued to burn progressively slower as Do increased."
- quote after: "For Do > 1.5 mm the droplet flames appeared less luminous and therefore less sooty, yet the droplets continued to burn progressively slower as Do increased. This effect is conjectured to be the result of increased radiative losses that would tend to reduce sooting that outweigh the longer residence times of the larger droplets that would tend to increase sooting."
- conditions before: {"gravity": "low gravity", "platform": "International Space Station, MDCA", "fuel": "n-octane and n-decane", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Larger, radiatively cooled flames in these tests gave less light and less soot; a detector that depends on soot particles or brightness has less to work with as the fuel source grows."
- decision_hint after: "Lower luminosity was observed and less soot inferred; the radiative explanation is explicitly a conjecture, not detector-performance data."

### DROPLETS-046 (decision_hint)
Source: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "A scattering smoke detector needs particles: weigh FLEX-2 soot data, and the low-soot regimes it found, when judging detector coverage for liquid-fuel fires."
- decision_hint after: "The requirements document explains why particle-scattering detection motivates soot studies; it is background, not a measured FLEX-2 detector result."

### DROPLETS-047 (decision_hint)
Source: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "Rank FLEX above FLEX-2 for suppressant and oxygen-limit questions; use FLEX-2 for fuel mixtures, soot, slow flow and droplet-pair effects."
- decision_hint after: "This passage distinguishes program objectives; it does not establish a numerical relevance ranking."

### DROPLETS-048 (claim, conditions, decision_hint)
Source: raw/pdf/20170000666.abstract.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: Restored the proposed dual structure as a possibility.
- claim before: "Experiments with large bi-component droplets (n-decane and hexanol, 50/50 by volume) at elevated pressures showed the visible hot flame becoming extremely weak while the burning rate remained relatively high, with radiant output too high to be accounted for by a visible hot flame alone."
- claim after: "Experiments with large n-decane/hexanol droplets (50/50 by volume) at elevated pressures showed very weak visible hot flames while burning rates remained relatively high. The authors say this suggests possible simultaneous cool and hot flames; radiant output could not be accounted for by a visible hot flame alone."
- conditions before: {"gravity": "microgravity", "platform": "International Space Station", "fuel": "n-decane and hexanol, 50/50 by volume", "o2_percent": null, "pressure": "elevated pressures", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "n-decane and hexanol, 50/50 by volume", "o2_percent": null, "pressure": "elevated pressures", "flow": null}
- decision_hint before: "Flame brightness did not track burning rate for this fuel mixture; size the response from heat or fuel-loss signals rather than from how the flame looks."
- decision_hint after: "The observations suggest possible simultaneous hot and cool flames for this mixture; this excerpt demonstrates neither a dual structure nor a response-sizing method."

### DROPLETS-049 (conditions, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "ISS", "fuel": "n-dodecane", "o2_percent": null, "pressure": "above 2 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": "above 2 atm", "flow": null}
- decision_hint before: "Direct evidence that a liquid-fuel flame can relight itself several times with no new ignition source. The cycles were seen above 2 atm, higher than cabin pressures, so treat it as proof of mechanism rather than a prediction for a 1 atm or lower habitat."
- decision_hint after: "Repeated cycles were observed above 2 atm; this does not predict reignition behavior at lower habitat pressures."

### DROPLETS-050 (conditions, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "ISS", "fuel": "n-dodecane", "o2_percent": null, "pressure": "higher pressures", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": "higher pressures", "flow": null}
- decision_hint before: "There is more than one invisible burning mode; a visible-light camera is not sufficient confirmation that a liquid-fuel fire is over."
- decision_hint after: "The CFI report describes warm flames not visible in its color camera; it gives no quantitative camera-sensitivity or coverage limit here."

### DROPLETS-051 (conditions, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "ISS", "fuel": "n-dodecane", "o2_percent": "21 (helium dilution tests held O2 mole fraction at 0.21)", "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "n-dodecane", "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Helium is the diluent in these tests that shortens the invisible stage; where a cool flame is the concern, a high-conductivity inert gas works on it more than nitrogen does."
- decision_hint after: "Increasing helium dilution led to earlier cool-flame extinction for n-dodecane; this passage makes no nitrogen comparison."

### DROPLETS-052 (topic, claim, conditions, decision_hint)
Source: raw/pdf/20210022617.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- topic: Removed unquoted stage fuel-mass inference.
- claim: Reported slide values without inferring fuel masses.
- topic before: "Most of the fuel burned after the visible flame went out (test FLEX-1250)"
- topic after: "Reported hot- and cool-flame constants in CFI test FLEX-1250"
- claim before: "CFI test FLEX-1250 (n-dodecane, air, 1 atm, initial diameter 4 mm): the hot flame extinguished at a droplet diameter of 3.55 mm with a burning rate of 0.383 mm2/s, and the cool flame then burned at 0.387 mm2/s down to 0.40 mm."
- claim after: "The FLEX-1250 slide lists n-dodecane in air at 1 atm, initial diameter 4 mm, hot-flame constant 0.383 mm2/s and extinction diameter 3.55 mm, and cool-flame constant 0.387 mm2/s and extinction diameter 0.40 mm."
- conditions before: {"gravity": "microgravity", "platform": "ISS", "fuel": "n-dodecane", "o2_percent": "21 (air)", "pressure": "1 atm", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": "N-dodecane", "o2_percent": null, "pressure": "1 atm", "flow": null}
- decision_hint before: "In this test the visible flame took the droplet only from 4 to 3.55 mm; the invisible cool flame, burning at the same rate, took it from 3.55 to 0.40 mm. Size the post-flame watch on the fuel still present, not on the flame seen."
- decision_hint after: "The slide reports similar hot/cool burning constants and different extinction diameters; it does not determine a post-fire watch duration."

### DROPLETS-054 (quote, conditions, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- quote before: "At low pressures, due to the low flame temperature of the cool flame, soot is not formed. The soot that is formed during the hot flame combustion is simply convected away from the droplet surface. But, when the pressure increases, residual soot is seen surrounding the droplet even after the hot flame extinction."
- quote after: "At low pressures, due to the low flame temperature of the cool flame, soot is not formed. The soot that is formed during the hot flame combustion is simply convected away from the droplet surface. But, when the pressure increases, residual soot is seen surrounding the droplet even after the hot flame extinction. The mechanisms behind this process has not been fully understood, and further analysis and research is needed."
- conditions before: {"gravity": "microgravity", "platform": "ISS", "fuel": "n-dodecane", "o2_percent": null, "pressure": "low pressures compared with higher pressures", "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": "low pressures compared with higher pressures", "flow": null}
- decision_hint before: "At the lower pressures tested the cool flame made no soot of its own, so a particle-scattering smoke detector should not be the only watch after flame-out."
- decision_hint after: "The report distinguishes newly formed soot from residual hot-flame soot and says the mechanism is not fully understood; it measures no detector performance."

### DROPLETS-055 (conditions, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity compared with normal gravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": "normal gravity", "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Ground flammability testing cannot screen for this mode; label it \"not testable in 1-g\" in a hazard analysis and \"never tested\" for lunar and Martian gravity."
- decision_hint after: "The rationale concerns cool droplet flames under normal gravity; it is not a statement about every possible ground test."

### DROPLETS-056 (claim, conditions, evidence_level, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- claim: This is earlier-work background on report page 4, not CFI results.
- evidence_level: The sentence is background from earlier experiments and does not itself identify the experiment.
- claim before: "When the cool-flame stage ended, a vapor cloud formed around the droplet as partially oxidized fuel condensed immediately following cool-flame extinction."
- claim after: "In its background discussion of earlier FLEX/FLEX-2 droplet experiments, the CFI report recounts a vapor cloud forming as partially oxidized fuel condensed immediately after cool-flame extinction."
- conditions before: {"gravity": "microgravity", "platform": "ISS", "fuel": "n-alkane droplets", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- evidence_level before: "flight experiment"
- evidence_level after: "review or summary"
- decision_hint before: "A fog appearing around a liquid-fuel source after flame-out is a sign that a cool flame has just ended and that unburned, partly oxidized fuel is now in the air: ventilate through filters before declaring the area clear."
- decision_hint after: "The report recounts a vapor cloud after cool-flame extinction in earlier droplet experiments; it establishes neither a diagnostic rule nor a ventilation/filtering procedure."

### DROPLETS-057 (claim, decision_hint)
Source: raw/pdf/PSI-39_CFI-Science-Final-Report.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- claim: The report cover dates this maturity statement.
- claim before: "The CFI final report states that all the CFI data is yet to be fully analyzed and interpreted using theoretical and numerical models."
- claim after: "The CFI science final report dated July 23, 2020 states that the data had yet to be fully analyzed and interpreted using theoretical and numerical models."
- decision_hint before: "Mark CFI-based conclusions as preliminary observations; the raw data in PSI-39 is open for the modeling the report asks for."
- decision_hint after: "This is the report's analysis-maturity statement in July 2020, not evidence that no analysis has occurred since."

### DROPLETS-058 (topic, claim, decision_hint)
Source: raw/pdf/20210022617.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- topic: Avoided an unsupported present-day model assessment.
- claim: Limited the conclusion to the historical assessment.
- topic before: "Limits of current predictive models"
- topic after: "Predictive-model limitation reported in the 2021 presentation"
- claim before: "The FLEX team concludes that existing, widely used detailed chemical kinetic models do not accurately predict the second-stage cool flame extinction (and warm flame) and need further improvement."
- claim after: "The 2021 FLEX presentation concludes that the detailed chemical-kinetic models it discusses did not accurately predict second-stage cool-flame extinction and warm flames and needed improvement."
- decision_hint before: "Do not let a simulation decide when a liquid-fuel fire has ended; the low-temperature stage is where today's models are weakest."
- decision_hint after: "The 2021 presentation identifies a model limitation; it does not assess every model available today or establish an operational fire endpoint."

### DROPLETS-059 (conditions, decision_hint)
Source: raw/pdf/20205008449.abstract.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "International Space Station, Combustion Integrated Rack", "fuel": "n-heptane, n-octane, n-decane, and n-dodecane", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": "ISS", "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Against the invisible stage the diluents are not equivalent: helium cut the cool flame short far more than nitrogen, CO2 or xenon did, and xenon let it burn longer."
- decision_hint after: "Keep the reported extinction-diameter and burning-duration distinctions among these diluents; they are not interchangeable suppressant choices."

### DROPLETS-060 (conditions, decision_hint)
Source: raw/pdf/20205008449.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": "ISS (FLEX/FLEX-2/CFI data)", "fuel": "n-alkane fuels", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "A low-conductivity diluent widens the range of oxygen levels where a cool flame survives; check the diluent before reusing an oxygen limit."
- decision_hint after: "The presentation compares xenon with helium; it does not establish the same effect for every low-conductivity diluent."

### DROPLETS-061 (decision_hint)
Source: raw/pdf/20205008449.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- decision_hint before: "A flammability limit defined by the visible flame understates the conditions under which fuel keeps reacting; state which limit (hot flame or cool flame) a requirement uses."
- decision_hint after: "The authors say cool flames can extend microgravity flammability; this is not a measured cutoff or a universal extension."

### DROPLETS-062 (claim, quote, decision_hint)
Source: raw/pdf/20190002838.abstract.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- claim: Restored model provenance, helium restrictions and the above-60% exception.
- claim before: "Simulations of n-alkane droplets at elevated pressure with helium substituted for nitrogen show a hot flame (about 1500 K) that radiatively extinguishes into a warm flame mode (about 970 K maximum reaction zone temperature), followed by a transition to a quasi-steady cool flame at about 765 K."
- claim after: "The abstract reports simulations of isolated n-alkane droplets at elevated pressure in helium-substituted air. It predicts roughly 1500 K hot, 970 K warm and 765 K cool stages, with all three first appearing near 20% helium substitution and their duration strongly dependent on substitution from 20% to 60%. Above 60%, hot-flame extinction is followed only by the lower-temperature cool stage."
- quote before: "The classical “Hot flame ” ( ∼1500 K) radiatively extinguishes into a “Warm flame ” burning mode at a moderate maximum reaction zone temperature ( ∼ 970 K), followed by a transition to a lower temperature ( ∼765 K), quasi-steady “Cool flame ” burning condition."
- quote after: "Transient, isolated n-alkane droplet combustion is simulated at elevated pressure for helium-diluent substituted-air mixtures. We report the presence of unique quasi-steady, three-stage burning behavior of large sphero-symmetric n-alkane droplets at these elevated pressures and helium substituted ambient fractions. Upon initiation of reaction, hot-flame diffusive burning of large droplets is initiated that radiatively extinguishes to establish cool flame burning conditions in nitrogen/oxygen \"air\" at atmospheric and elevated pressures. However, at elevated pressure and moderate helium substitution for nitrogen ( X He > 20%), the initiated cool flame burning proceeds through two distinct, quasi-steady-state, cool flame burning conditions. The classical \"Hot flame \" ( ∼1500 K) radiatively extinguishes into a \"Warm flame \" burning mode at a moderate maximum reaction zone temperature ( ∼ 970 K), followed by a transition to a lower temperature ( ∼765 K), quasi-steady \"Cool flame \" burning condition. The reaction zone (\"flame\") temperatures are associated with distinctly different yields in intermediate reaction products within the reaction zones and surrounding near-field, and the flame-standoff ratios characterizing each burning mode progressively decrease. The presence of all three stages first appears with helium substitution near 20%, and the duration of each stage is observed to be strongly dependent on helium substitutions level between 20-60%. For helium substitution greater than 60%, the hot flame extinction is followed by only the lower temperature cool flame burning mode."
- decision_hint before: "Three temperature bands to design sensing around: about 1500 K, 970 K and 765 K; the lower two gave no visible flame in the CFI tests."
- decision_hint after: "These are simulated reaction-zone temperatures under the specified pressure and helium conditions, not measured CFI temperatures or validated detector bands."

### DROPLETS-063 (quote, decision_hint)
Source: raw/nasa/researchers-guide-combustion.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- quote: Expanded to complete sentences/blocks and retained the relevant neighboring qualification.
- quote before: "persistent flames, invisible to the unaided eye, that will spontaneously re-ignite long after the visible flame has been extinguished. The necessary pre-conditions, the combustion chemistry, and the mechanisms for spontaneous re-ignition are poorly understood."
- quote after: "This research also has significant impact on spacecraft fire safety concerns; reduced-gravity environments have been shown to be particularly conducive to a low-temperature combustion regime marked by very weak but 41 persistent flames, invisible to the unaided eye, that will spontaneously re-ignite long after the visible flame has been extinguished. The necessary pre-conditions, the combustion chemistry, and the mechanisms for spontaneous re-ignition are poorly understood."
- decision_hint before: "With the trigger conditions for re-ignition not established, use the conservative protocol after any liquid-fuel fire: keep the area isolated and monitored instead of predicting when it is safe."
- decision_hint after: "The 2015 Guide identifies poorly understood re-ignition conditions; it does not supply a validated isolation or monitoring protocol."

### DROPLETS-064 (conditions, decision_hint)
Source: raw/nasa/cir-eight-years.txt.
- decision_hint: Restricted to the reported result, uncertainty and scope; removed unsupported operational advice or generalization.
- conditions: Kept only conditions in this finding quote. Bare CSV numbers without their header units are not standalone finding conditions; the table claims retain the documented values.
- conditions before: {"gravity": "microgravity", "platform": null, "fuel": "pure hydrocarbons, biofuels and mixtures of pure hydrocarbons", "o2_percent": null, "pressure": null, "flow": null}
- conditions after: {"gravity": null, "platform": null, "fuel": null, "o2_percent": null, "pressure": null, "flow": null}
- decision_hint before: "Plain-language rule for crew training: \"looks out\" is not \"is out\" for liquid fuels in microgravity."
- decision_hint after: "NASA describes continued low-temperature burning after apparent flame-out for some fuels; this is not an all-fuel safety rule."

## Investigation records

### FLEX (variables, measurements, sources)

- Completed nine cut prose quotations, including the diagnostic downlink sentence and its LLUV filter qualification.
- Replaced the unsupported held-the-same list with sourced parameters and explicit table labels. Attached fuel, geometry, pressure and translation citations to variables.
- The chamber temperature/pressure entry came from a shall-be-required statement; it now explicitly describes a planned requirement.
- Added each relevant table header to every field interpreting that CSV; split identity and URL sources and checked the canonical URL in the local PSI catalog.
- variables before: "Varied from test to test: fuel (methanol or heptane), ambient oxygen mole fraction, diluent or suppressant gas and its mole fraction (nitrogen, carbon dioxide up to 0.70, helium up to 0.45 in the PSI test table), ambient pressure, initial droplet diameter, free or fiber-supported droplet, quiescent or slowly translated. Held the same: single droplet geometry, hot-wire ignition, ambient temperature, the CIR/MDCA hardware and cameras."
- variables after: "The cited record/report describe fuel (methanol or n-heptane), oxygen fraction, nitrogen/carbon-dioxide/helium dilution, ambient pressure, initial droplet diameter, free or fiber-supported deployment, and quiescent or slowly translated droplets. The PSI table lists CO dilution up to 0.70 and He up to 0.45 (column labels as printed). Ambient temperature is specified for the report burns; the geometry is a single droplet."
- measurements before: ["Droplet diameter history from a backlit camera (HiBMs)", "Flame diameter history from a low-light UV camera filtered for OH chemiluminescence at 310 nm (LLUV) and from a color camera", "Average burning-rate constant and extinction droplet diameter for each burn", "Flame size, shape and color overview from the MDCA color camera (downlinked during operations)", "Broadband and water-vapor-band radiometers (not sensitive enough to give reliable quantitative data in the tests of the 2015 report)", "Chamber gas pressure and temperature"]
- measurements after: ["Droplet diameter history from a backlit camera (HiBMs)", "Flame diameter history from a low-light UV camera filtered for OH chemiluminescence at 310 nm (LLUV) and from a color camera", "Average burning-rate constant and extinction droplet diameter for each burn", "Flame size, shape and color overview from the MDCA color camera (downlinked during operations)", "Broadband and water-vapor-band radiometers (not sensitive enough to give reliable quantitative data in the tests of the 2015 report)", "Chamber gas temperature and pressure measurements required by the FLEX test plan (a requirement, not evidence that this report supplies those data)"]
- All 45 source quotations match their text files exactly after quotecheck normalization. Non-null fields were reviewed against those citations; table interpretations carry headers, and planned requirements are distinguished from measurements. See droplets.rejects.md for corrections.

### FLEX-2 (years, objectives, variables, sources)

- Removed the unsupported absence-of-flight-dates assertion and kept the differing source labels explicit.
- Completed hardware and sample-geometry prose citations and attached the complete PSI objective list.
- Qualified the 25 C table value rather than calling it a verified invariant across all tests.
- Added the PSI contact object explicitly assigning the Principal Investigator role; a team-lead or team-member heading alone did not establish it.
- Added each relevant table header to every field interpreting that CSV; split identity and URL sources and checked the canonical URL in the local PSI catalog.
- years before: "The PSI record lists investigation dates 08-12-2016 to 09-30-2019; the science requirements document is dated March 15, 2010. The NASA sources saved here give no FLEX-2 flight dates (a 2021 NASA presentation places the FLEX series, FLEX-2 included, on the ISS in 2008-2016)."
- years after: "PSI investigation dates 08-12-2016 to 09-30-2019; science requirements dated March 15, 2010. The 2021 presentation groups FLEX and FLEX-2 under ISS 2008-2016; these are source-specific labels, not reconciled flight dates."
- objectives before: "Extend FLEX to fuels and conditions that mimic real combustors and provide benchmark data on bi-component droplet combustion: liquid-phase mixing in fuel mixtures, steady and unsteady burning of pure fuels, flame extinction mechanisms and boundaries, soot formation, slow sub-buoyant convective flow, and the effect of a second droplet on flammability limits and extinction."
- objectives after: "Extend FLEX-1 to fuels and conditions that mimic real combustors and provide benchmark bi-component droplet data for models. The PSI objectives list liquid-phase mixing, steady/unsteady pure-fuel behavior, extinction mechanisms, soot formation and droplet interactions. The NASA fact sheet also describes sub-buoyant flow studies."
- variables before: "Varied from test to test: fuel type, ambient gas composition (O2/N2 or O2/He), ambient pressure, initial droplet diameter, droplet translation velocity (and acceleration), droplet spacing and initial size in a binary linear array. Four groups of tests: pure fuel, fuel mixture, convective flow and binary droplet array. Held the same: ambient temperature (25 C in the PSI table), the CIR/MDCA hardware."
- variables after: "The PSI record lists fuel type, ambient gas composition/pressure, initial droplet diameter, translation velocity/acceleration and binary-array droplet spacing/size as independently varied. The fact sheet groups tests as pure fuel, fuel mixtures, convective flow and binary arrays. The PSI table lists 25 C for its fuel rows; this table value is not independent proof that temperature was constant throughout every test."
- All 45 source quotations match their text files exactly after quotecheck normalization. Non-null fields were reviewed against those citations; table interpretations carry headers, and planned requirements are distinguished from measurements. See droplets.rejects.md for corrections.

### CFI (pi, conditions, variables, sources)

- Replaced unmeasured no-flow/quiescent claims with the literal operational deployment requirement.
- Completed fuel, initial-size and deployment prose citations; added citations for the initial-size and tethering statements under variables.
- Added the 0.21 oxygen table row and last dated row (21-Aug-17), after parsing all test dates; kept report operation dates distinct from PSI investigation dates.
- Added the PSI contact object explicitly assigning the Principal Investigator role; a team-lead or team-member heading alone did not establish it.
- Added each relevant table header to every field interpreting that CSV; split identity and URL sources and checked the canonical URL in the local PSI catalog.
- pi before: "Forman A. Williams, University of California, San Diego"
- pi after: "Forman Williams, University of California, San Diego (PSI principal investigator; the report lists Forman A. Williams on its Science Definition Team)"
- conditions before: {"o2_percent": "21 and 17 (oxygen 0.21 and 0.17 in the PSI test table); helium-diluted tests held the O2 mole fraction at 0.21", "pressure": "0.5, 0.75, 1, 1.25, 2, 3 and 5 atm", "flow": "None imposed: droplets are deployed free floating without residual momentum in a quiescent chamber", "gravity": "microgravity (ISS)"}
- conditions after: {"o2_percent": "21 and 17 (oxygen 0.21 and 0.17 in the PSI test table); helium-diluted tests held the O2 mole fraction at 0.21", "pressure": "0.5, 0.75, 1, 1.25, 2, 3 and 5 atm", "flow": "Operational requirement: deploy droplets free floating without residual momentum at the center of the diagnostic field of view; not a measurement of zero gas flow.", "gravity": "microgravity (ISS)"}
- variables before: "Varied from test to test: fuel (pure n-dodecane, two n-dodecane/iso-dodecane mixtures, farnesane), ambient pressure, helium dilution (29% and 59%), fiber-tethered or free droplet. Held the same: initial droplet size around 4 mm, the FLEX hardware and procedure."
- variables after: "The report lists pure n-dodecane, n-dodecane/iso-dodecane mixtures (75/25 and 60/40 by mass), farnesane, pressure and helium dilution (29% and 59% at oxygen mole fraction 0.21). Its procedures allow a 40 micron tethering fiber. Initial size was kept around 4 mm; the report says the procedure matched FLEX."
- All 36 source quotations match their text files exactly after quotecheck normalization. Non-null fields were reviewed against those citations; table interpretations carry headers, and planned requirements are distinguished from measurements. See droplets.rejects.md for corrections.

## Observed checks, limits and weakest point

- Input quotecheck --refetch: 64 PASS, 0 FAIL, exit 0. The report has no why/error messages; 8 finding quotes were also verified against live NTRS title/abstract records. That command serializes its requests and pauses one second after each successful fetch.
- All 64 input quotes were read with surrounding text; 63 survive with corrections and one is rejected. A green literal-match check did not validate the original safety advice, hidden conditions or inconsistent chemical names.
- All three PSI identifiers and URLs match research/psi-investigations.json. Every investigation source quotation matches the cited cache after the same normalization as quotecheck. JSON metadata and table headers/rows are non-prose citations.
- Whole-row findings 003, 004, 010 and 011 were checked against the real PSI-69 CSV header and row. Atomic rows have row boundaries rather than prose sentence boundaries; the numeric finding conditions were removed rather than inventing units in the quote.
- The weakest point is cached provenance: live byte identity of supplied non-NTRS-abstract PDF/PSI/NASA-page texts remains not verified. These caches were not re-downloaded in this pass. The task's requested refetch only revalidates NTRS abstracts.
- No partial-gravity limits, safe concentrations, validated detector thresholds, crew procedures or post-fire clearance times are demonstrated. Relevance tags do not claim tests in those habitats.
- DESIGN.md section 3.2 was read. The product build, shipped screen and browser behavior are not verified in this evidence-only task. Later build gates may drop additional conditions.
- No input, catalog, product code or unrelated family was edited; no files were deleted.

## Commands and observed output

Input command:
python3 tools/quotecheck.py evidence/droplets.json --refetch --report evidence/droplets.quotecheck.json

Observed: total 64, passed 64, failed 0; exit 0. Final post-write checks are recorded below after execution.

## Final wording corrections

Titles were checked against the same restrictions as claims: translation is not ventilation, extinction diameter is not elapsed time, inferred soot is not a measurement, and an observed cloud is not a general diagnostic rule. Record instrument names and support geometry were restricted to their attached quotations; requirements are labeled as requirements.

- DROPLETS-033.topic before: "Flame went out when a 3 mm/s flow stopped (single test)"
- DROPLETS-033.topic after: "Visible flame extinguished after 3 mm/s droplet translation stopped"
- DROPLETS-036.topic before: "Two neighbouring droplets extinguished earlier than one in nitrogen-diluted 15% oxygen"
- DROPLETS-036.topic after: "Paired-droplet extinction diameter exceeded the single-droplet value at 15% oxygen"
- DROPLETS-045.topic before: "Larger droplets burned dimmer and with less soot"
- DROPLETS-045.topic after: "Larger droplets appeared dimmer; less soot was inferred"
- DROPLETS-056.topic before: "A vapor cloud of condensed, partly oxidized fuel marks the end of the cool flame"
- DROPLETS-056.topic after: "Vapor cloud observed after cool-flame extinction in earlier FLEX/FLEX-2 work"
- DROPLETS-060.topic before: "Xenon sustained cool flames at much lower oxygen than helium"
- DROPLETS-060.topic after: "Xenon can sustain cool flames at lower oxygen than helium"
- FLEX.measurements[0] before: "Droplet diameter history from a backlit camera (HiBMs)"
- FLEX.measurements[0] after: "Droplet diameter histories obtained from the backlit camera"
- FLEX-2.sample_geometry before: "A single droplet or a pair of droplets (binary linear array) on a support fiber, initial diameter 1.5 to 5 mm; in flow tests a tethered droplet is moved through the quiescent gas"
- FLEX-2.sample_geometry after: "Single or paired droplets with initial diameter 1.5 to 5 mm; in convective-flow tests a droplet tethered at fiber crosshairs is moved through the quiescent gas"
- FLEX-2.measurements[0] before: "Droplet burning rate, flame dimensions, radiative emissions and soot volume fraction as functions of time"
- FLEX-2.measurements[0] after: "Science-requirements diagnostic description: Droplet burning rate, flame dimensions, radiative emissions and soot volume fraction as functions of time"
- FLEX-2.measurements[1] before: "Extinction droplet diameter when the flame extinguishes"
- FLEX-2.measurements[1] after: "Science-requirements diagnostic description: Extinction droplet diameter when the flame extinguishes"

## Exact source locations after final edits

- DROPLETS-001 PASA: raw/ntrs/20130014061.txt:3
- DROPLETS-002 PASA: raw/ntrs/20120016855.txt:3
- DROPLETS-003 PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:87
- DROPLETS-004 PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:70
- DROPLETS-005 PASA: raw/pdf/20150023456.txt:11210
- DROPLETS-006 PASA: raw/pdf/20150023456.txt:290
- DROPLETS-007 PASA: raw/nasa/researchers-guide-combustion.txt:1148
- DROPLETS-008 PASA: raw/nasa/researchers-guide-combustion.txt:297
- DROPLETS-009 PASA: raw/pdf/20130010979.txt:202
- DROPLETS-010 PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:19
- DROPLETS-011 PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:141
- DROPLETS-012 PASA: raw/pdf/20150023456.txt:11772
- DROPLETS-013 PASA: raw/pdf/20150023456.txt:1828
- DROPLETS-014 PASA: raw/pdf/PSI-69_FLEX-Test-Plan.txt:81
- DROPLETS-015 PASA: raw/pdf/PSI-69_FLEX-Test-Plan.txt:93
- DROPLETS-016 PASA: raw/pdf/PSI-69_FLEX-Test-Plan.txt:118
- DROPLETS-017 PASA: raw/pdf/PSI-69_FLEX-Test-Plan.txt:114
- DROPLETS-018 PASA: raw/pdf/PSI-69_FLEX-Test-Plan.txt:130
- DROPLETS-019 PASA: raw/pdf/20090014812.txt:90
- DROPLETS-020 PASA: raw/nasa/researchers-guide-combustion.txt:1041
- DROPLETS-021 PASA: raw/pdf/20150023456.txt:10707
- DROPLETS-022 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:64
- DROPLETS-023 PASA: raw/nasa/iss-passes-torch-flame-studies.txt:29
- DROPLETS-024 PASA: raw/nasa/cir-eight-years.txt:19
- DROPLETS-025 PASA: raw/nasa/cir-eight-years.txt:21
- DROPLETS-026 PASA: raw/nasa/iss-combustion-fire-safety.txt:25
- DROPLETS-027 PASA: raw/pdf/20210022617.txt:299
- DROPLETS-028 PASA: raw/pdf/PSI-69_Cool-Flames-in-Space-a-Hot-Prospect-on-Earth.txt:279
- DROPLETS-029 PASA: raw/pdf/PSI-69_Presentation-1G17-070HE-0166.txt:298
- DROPLETS-030 PASA: raw/pdf/20140006750.txt:390
- DROPLETS-031 PASA: raw/pdf/20150018397.abstract.txt:3
- DROPLETS-032 PASA: raw/pdf/20150018397.abstract.txt:3
- DROPLETS-033 PASA: raw/pdf/20150023456.txt:11050
- DROPLETS-034 PASA: raw/ntrs/20110020695.txt:3
- DROPLETS-035 PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:888
- DROPLETS-036 PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:898
- DROPLETS-037 PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:921
- DROPLETS-038 PASA: raw/pdf/PSI-39_Aspects-of-Cool-Flame-Supported-Droplet-Combustion.txt:69
- DROPLETS-039 PASA: raw/pdf/20140006750.txt:210
- DROPLETS-040 PASA: raw/pdf/20140006750.txt:333
- DROPLETS-041 PASA: raw/pdf/20140006750.txt:246
- DROPLETS-042 PASA: raw/pdf/20140006750.txt:326
- DROPLETS-043 PASA: raw/pdf/20140006750.txt:382
- DROPLETS-044 PASA: raw/pdf/PSI-69_Presentation-2G11-070HE-0310.txt:270
- DROPLETS-045 PASA: raw/pdf/PSI-69_Presentation-2G11-070HE-0310.txt:36
- DROPLETS-046 PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:678
- DROPLETS-047 PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:268
- DROPLETS-048 PASA: raw/pdf/20170000666.abstract.txt:3
- DROPLETS-049 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:227
- DROPLETS-050 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:280
- DROPLETS-051 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:303
- DROPLETS-052 PASA: raw/pdf/20210022617.txt:271
- DROPLETS-054 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:320
- DROPLETS-055 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:186
- DROPLETS-056 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:157
- DROPLETS-057 PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:247
- DROPLETS-058 PASA: raw/pdf/20210022617.txt:302
- DROPLETS-059 PASA: raw/pdf/20205008449.abstract.txt:3
- DROPLETS-060 PASA: raw/pdf/20205008449.txt:154
- DROPLETS-061 PASA: raw/pdf/20205008449.txt:20
- DROPLETS-062 PASA: raw/pdf/20190002838.abstract.txt:3
- DROPLETS-063 PASA: raw/nasa/researchers-guide-combustion.txt:1353
- DROPLETS-064 PASA: raw/nasa/cir-eight-years.txt:47
- FLEX sources[0] name PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[1] full_name PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[2] psi_id PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[3] platform PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[4] platform PASA: raw/pdf/20150023456.txt:248
- FLEX sources[5] hardware PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[6] hardware PASA: raw/pdf/20150023456.txt:323
- FLEX sources[7] years PASA: raw/pdf/20150023456.txt:329
- FLEX sources[8] years PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[9] years PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[10] years PASA: raw/nasa/iss-passes-torch-flame-studies.txt:27
- FLEX sources[11] pi PASA: raw/pdf/20090014812.txt:5
- FLEX sources[12] objectives PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[13] objectives PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[14] fuels PASA: raw/pdf/20150023456.txt:283
- FLEX sources[15] sample_geometry PASA: raw/pdf/20150023456.txt:284
- FLEX sources[16] sample_geometry PASA: raw/pdf/20150023456.txt:414
- FLEX sources[17] sample_geometry PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:70
- FLEX sources[18] sample_geometry PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:71
- FLEX sources[19] conditions.o2_percent PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:87
- FLEX sources[20] conditions.o2_percent PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:20
- FLEX sources[21] conditions.pressure PASA: raw/pdf/20150023456.txt:284
- FLEX sources[22] conditions.flow PASA: raw/pdf/20150023456.txt:2580
- FLEX sources[23] conditions.flow PASA: raw/pdf/20150023456.txt:10754
- FLEX sources[24] conditions.gravity PASA: raw/psi/investigations/PSI-69.json:1
- FLEX sources[25] variables PASA: raw/pdf/20150023456.txt:284
- FLEX sources[26] variables PASA: raw/ntrs/20130014061.txt:3
- FLEX sources[27] variables PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:271
- FLEX sources[28] variables PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:19
- FLEX sources[29] measurements PASA: raw/pdf/20150023456.txt:273
- FLEX sources[30] measurements PASA: raw/pdf/20150023456.txt:436
- FLEX sources[31] measurements PASA: raw/pdf/20150023456.txt:278
- FLEX sources[32] measurements PASA: raw/pdf/20150023456.txt:446
- FLEX sources[33] measurements PASA: raw/pdf/20150023456.txt:460
- FLEX sources[34] measurements PASA: raw/pdf/PSI-69_FLEX-Test-Plan.txt:144
- FLEX sources[35] variables PASA: raw/pdf/20150023456.txt:283
- FLEX sources[36] variables PASA: raw/pdf/20150023456.txt:284
- FLEX sources[37] variables PASA: raw/pdf/20150023456.txt:414
- FLEX sources[38] variables PASA: raw/pdf/20150023456.txt:284
- FLEX sources[39] variables PASA: raw/pdf/20150023456.txt:2580
- FLEX sources[40] variables PASA: raw/pdf/20150023456.txt:10754
- FLEX sources[41] sample_geometry PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:1
- FLEX sources[42] conditions.o2_percent PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:1
- FLEX sources[43] variables PASA: raw/psi/tables/PSI-69_Experimental table_FLEX.csv:1
- FLEX sources[44] psi_url PASA: raw/psi/investigations/PSI-69.json:1
- FLEX-2 sources[0] name PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[1] full_name PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[2] psi_id PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[3] platform PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[4] hardware PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[5] hardware PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:1201
- FLEX-2 sources[6] years PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[7] years PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[8] years PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:25
- FLEX-2 sources[9] years PASA: raw/pdf/20210022617.txt:37
- FLEX-2 sources[10] pi PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:10
- FLEX-2 sources[11] objectives PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[12] objectives PASA: raw/nasa/flex.txt:101
- FLEX-2 sources[13] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:2
- FLEX-2 sources[14] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:3
- FLEX-2 sources[15] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:4
- FLEX-2 sources[16] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:5
- FLEX-2 sources[17] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:6
- FLEX-2 sources[18] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:7
- FLEX-2 sources[19] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:8
- FLEX-2 sources[20] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:9
- FLEX-2 sources[21] sample_geometry PASA: raw/nasa/flex.txt:116
- FLEX-2 sources[22] sample_geometry PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[23] sample_geometry PASA: raw/nasa/flex.txt:145
- FLEX-2 sources[24] conditions.o2_percent PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:5
- FLEX-2 sources[25] conditions.o2_percent PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[26] conditions.pressure PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:5
- FLEX-2 sources[27] conditions.flow PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[28] conditions.flow PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:1307
- FLEX-2 sources[29] conditions.gravity PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[30] variables PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[31] variables PASA: raw/nasa/flex.txt:151
- FLEX-2 sources[32] variables PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:5
- FLEX-2 sources[33] measurements PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:1232
- FLEX-2 sources[34] measurements PASA: raw/pdf/PSI-68_FLEX-2-SRD-Final.txt:1234
- FLEX-2 sources[35] measurements PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[36] objectives PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[37] pi PASA: raw/psi/investigations/PSI-68.json:1
- FLEX-2 sources[38] fuels PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[39] sample_geometry PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[40] conditions.o2_percent PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[41] conditions.pressure PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[42] conditions.flow PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[43] variables PASA: raw/psi/tables/PSI-68_Experimental table_Flex2.csv:1
- FLEX-2 sources[44] psi_url PASA: raw/psi/investigations/PSI-68.json:1
- CFI sources[0] name PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[1] full_name PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[2] psi_id PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[3] platform PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[4] hardware PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[5] hardware PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:192
- CFI sources[6] years PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:123
- CFI sources[7] years PASA: raw/psi/tables/PSI-39_Experimental table_CFI.csv:2
- CFI sources[8] years PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[9] years PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[10] pi PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:97
- CFI sources[11] pi PASA: raw/nasa/cir-eight-years.txt:11
- CFI sources[12] objectives PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:62
- CFI sources[13] objectives PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:195
- CFI sources[14] objectives PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:71
- CFI sources[15] fuels PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:67
- CFI sources[16] fuels PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:222
- CFI sources[17] sample_geometry PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:217
- CFI sources[18] sample_geometry PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:204
- CFI sources[19] conditions.o2_percent PASA: raw/psi/tables/PSI-39_Experimental table_CFI.csv:8
- CFI sources[20] conditions.o2_percent PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:223
- CFI sources[21] conditions.pressure PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:221
- CFI sources[22] conditions.flow PASA: raw/pdf/PSI-39_CFI-Operational-Requirements-and-Protocols.txt:5
- CFI sources[23] conditions.gravity PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[24] variables PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:221
- CFI sources[25] variables PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:199
- CFI sources[26] measurements PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:209
- CFI sources[27] measurements PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:340
- CFI sources[28] variables PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:204
- CFI sources[29] variables PASA: raw/pdf/PSI-39_CFI-Science-Final-Report.txt:217
- CFI sources[30] conditions.o2_percent PASA: raw/psi/tables/PSI-39_Experimental table_CFI.csv:2
- CFI sources[31] years PASA: raw/psi/tables/PSI-39_Experimental table_CFI.csv:77
- CFI sources[32] pi PASA: raw/psi/investigations/PSI-39.json:1
- CFI sources[33] years PASA: raw/psi/tables/PSI-39_Experimental table_CFI.csv:1
- CFI sources[34] conditions.o2_percent PASA: raw/psi/tables/PSI-39_Experimental table_CFI.csv:1
- CFI sources[35] psi_url PASA: raw/psi/investigations/PSI-39.json:1

Final structural check: PASS. Same root key order and verification keys as solids; 63 distinct findings with verified notes; DROPLETS-053 alone excluded; three canonical PSI pairs; every non-null investigation field cited; 126 exact investigation source quotes.
Changed field counts (categories overlap): {"claim": 15, "conditions": 49, "decision_hint": 63, "evidence_level": 7, "quote": 9, "topic": 9}.

## Final executed quote checks

python3 tools/quotecheck.py evidence/droplets.verified.json

Observed after the final JSON edits: 63 PASS lines, total 63, passed 63, failed 0, process exit 0. Every retained finding carries verified.quote = "exact match" and a support note.

The same verified file was also checked with --refetch: total 63, passed 63, failed 0, process exit 0. The expanded DROPLETS-062 quote was additionally compared directly against a freshly parsed live NTRS API record: exact normalized match, correct record ID, HTTP 200. Only one research request ran at a time, followed by the requested one-second pause.

fuente: https://ntrs.nasa.gov/api/citations/20190002838 | consultado: 2026-11-14 | 1 expanded quote matched live (DROPLETS-062)
fuente: python3 research/tools/quotecheck.py research/evidence/droplets.verified.json | consultado: 2026-11-14 | 63 passed, 0 failed, exit 0

Evidence-file approval: aprobado: true. Product pantalla_actual: not verified; no product build or browser was part of this task. All semantic limits and the cached-provenance limitation remain as stated above.
