# detection.json: rejected and changed items

Verifier pass of 2026-11-14 over `evidence/detection.json` (82 findings, 5 investigation records). Output: `evidence/detection.verified.json` (81 findings, 5 investigation records).

## Step 1: quotecheck

`tools/quotecheck.py evidence/detection.json --refetch` passed 82 of 82 (report in `evidence/detection.quotecheck.json`). No finding failed, so nothing was relabeled.

## Rejected findings (1)

- **DETECTION-016**: Rejected. The quote says the aged silicone diameter of average mass rose "to over 1 [glyph]m", but (1) the unit glyph is lost in the saved text, and (2) Table 1 of the same report (DETECTION-007) gives the aged silicone diameter of average mass as 606 nm, and the appended conference paper in the same file says "rising to over 500 nm for the aged". The claim "over 1 micrometer" contradicts the report's own table, so it cannot be shown to be right. The aging trend itself survives in DETECTION-007 (table) and DETECTION-015.

## Changed findings (41)

The quote is untouched in every case; only the fields named were narrowed.

- **DETECTION-004**: decision_hint narrowed: the source speaks of the ISS detector being "less sensitive" to small particles, not of every light-scattering cabin detector being "weak".
- **DETECTION-008**: topic narrowed: it said "most smoke particles are below 500 nm"; the source says "a substantial portion".
- **DETECTION-009**: claim narrowed to what the report states and flagged: the sentence calls 189 nm the CMD, while Table 1 of the same report lists 189 nm as the geometric mean and 257 nm as the arithmetic mean.
- **DETECTION-010**: decision_hint narrowed: "wiring insulation" and "add an ionization-type sensor" are not in the quoted source text.
- **DETECTION-015**: decision_hint narrowed: the quote does not say that an ionization detector response weakens; it only reports number count falling and mass staying steady.
- **DETECTION-017**: decision_hint narrowed: "lunar or Mars habitat" and "instead of lowering the alarm threshold" are not in the source.
- **DETECTION-023**: decision_hint narrowed: the simulated source is a propane burner with a soot yield, not a "small smoldering source".
- **DETECTION-025**: decision_hint narrowed: the sentence about using ground tests "for partial-gravity habitats until flight data exist" is not in the source.
- **DETECTION-027**: decision_hint softened to "roughly", as the source says.
- **DETECTION-028**: decision_hint narrowed: "rate of rise" and "lunar and Mars surface habitats" are not in the quoted passage.
- **DETECTION-029**: decision_hint softened to "consider": the paper offers these as potential approaches and says further validation is warranted.
- **DETECTION-030**: decision_hint narrowed: "can leave a slow smolder undetected" is not stated by the source.
- **DETECTION-032**: claim narrowed: the slide attributes this to a model (Brooker et al. 2007), which the claim now says.
- **DETECTION-033**: decision_hint narrowed: "wire insulation" and "other cues (odor, equipment faults, CO)" are not in the source.
- **DETECTION-036**: decision_hint narrowed: "put detectors in the forced-air path" is not in the quoted slide.
- **DETECTION-037**: conditions.gravity set to null: the dust size distribution is a property of returned Apollo samples, not a result obtained at lunar gravity (the "Lunar gravity ~ 1/6 g" line belongs to a different slide). decision_hint narrowed: "combine with gas sensing or particle shape" is not in the source.
- **DETECTION-038**: claim narrowed: the abstract does not use the name "SAME-R"; the link to SAME-R is that PSI-101 lists this publication. decision_hint narrowed from "design around 0.2 to 0.4 micrometer", since other surviving findings report smaller particles for Kapton and Teflon.
- **DETECTION-039**: decision_hint narrowed: "shift detector size sensitivity upward" is an engineering prescription the source does not make.
- **DETECTION-040**: decision_hint narrowed: "roughly doubles ... for most materials" replaced by what the table shows per material.
- **DETECTION-041**: conditions.flow restated in the words of the report ("baseline air flow rate was 8 cm/s with runs conducted at rates down to 2 cm/s with a limited set conducted with no airflow").
- **DETECTION-044**: evidence_level changed from "flight experiment" to "model or analysis": the passage is an order-of-magnitude estimate ("would diffuse", "assuming a cubical geometry", "if the same number of particles"), not a measurement. claim reworded to keep those conditions. decision_hint narrowed: "it may never reach a detector" is not in the source.
- **DETECTION-046**: decision_hint narrowed: "sensors that classify smoke by particle shape" are not mentioned by the source.
- **DETECTION-047**: decision_hint narrowed: "neither single technology covers both" contradicts the quote, which says ionization readily detected all samples.
- **DETECTION-048**: decision_hint softened from "prefer" to "consider", matching the source's "may show".
- **DETECTION-049**: decision_hint narrowed: "lunar, Mars" habitats are not mentioned by the source.
- **DETECTION-052**: decision_hint narrowed: "close to the source" is not stated; the concentrations are those seen by the instruments in the SAME hardware.
- **DETECTION-053**: claim reworded so that the time scale reads as the report's description of the process, not as a measured duration.
- **DETECTION-055**: decision_hint narrowed: the quote covers Kapton, lamp wick and silicone only, not Teflon and Pyrell.
- **DETECTION-056**: topic narrowed: it said "moment method suits spherical smoke only", but the next sentences of the source say silicone counts as spherical and that valid values are obtained for non-spherical Pyrell and Teflon.
- **DETECTION-057**: decision_hint narrowed: "three small instruments can stand in for a laboratory particle sizer" overstated the conclusion.
- **DETECTION-058**: decision_hint narrowed: "even a small rise in sub-micrometer particles is a usable early fire signal" is not in the source and ignores non-fire particle sources (see DETECTION-063).
- **DETECTION-060**: decision_hint narrowed: "needs a higher threshold or better discrimination" is not stated by the source.
- **DETECTION-061**: claim narrowed: the under-2.5-micrometer bin result belongs to the Shuttle (STS) measurement, the ISS result is the low overall count. conditions.gravity uses the source's word ("low-gravity"). decision_hint narrowed: "the cabin is clean and fire smoke is abundant" overstated; the source immediately adds that more complete statistics are needed.
- **DETECTION-063**: decision_hint narrowed: the Velcro debris was made on purpose at the instrument intake, so "ordinary crew actions" and "alarm logic needs size or gas information" go beyond the source.
- **DETECTION-064**: decision_hint narrowed: "reaches detectors; rely on filtration and dust-rejecting detectors" is not in the source.
- **DETECTION-067**: decision_hint narrowed: "in partial gravity re-check the margins" and "settling" are not in the source passage.
- **DETECTION-068**: decision_hint narrowed: "proven option" and "locating a smoke source" overstate a feasibility test whose own report calls part of the results "somewhat suspect".
- **DETECTION-070**: decision_hint narrowed: the cross-reference "modelling agrees in direction with the flight data" is the previous agent's synthesis, not in this source.
- **DETECTION-074**: decision_hint narrowed: "placing sampling points inside equipment bays" extrapolates a DBP simulation to hardware the source does not discuss.
- **DETECTION-077**: decision_hint narrowed: "if ventilation is off, detection by fixed sensors is delayed" is an inference the abstract does not state.
- **DETECTION-079**: decision_hint narrowed: "Mars transit crew without real-time ground support" is not in the source.

## Investigation records

All five records kept. `psi_id` and `psi_url` match `psi-investigations.json` (PSI-102, PSI-101, PSI-47 twice, PSI-115). Every existing source quote is present verbatim in its text file. Changes:

- **SAME**: Two supporting quotes added from the SAME final report: "six sample chambers in the carousel" (for "six samples per carousel"; the existing quote "six samples each of 5 materials" speaks of materials, not carousels) and the thermal precipitator sentence (hardware named it without a quote).
- **SAME-R**: Supporting quotes added: the PI from the PSI-101 record itself (the only PI quote was from the SAME fact sheet); the PSI-101 "test conditions were broadened" sentence for the objectives; "the six carousels" and the six-position carousel table header for the sample geometry; the three post-flight ground tests for the measurements; and one PSI table row for each inlet velocity value (0, 1, 2, 8, 8.1 cm/s), since the only table quote was the column header.
- **DAFT**: variables: "sampling through a common hose" changed to "sampling at a shared sample port" (the saved report says "shared sample port"; "hose" does not appear). Supporting quotes added for the 4-toggle dust loading, the DAFT Fill Assembly and the DAFT Impactor.
- **DAFT-2**: Supporting quote added for the statement that kit DAFT-1 held the modified P-Trak.
- **SAME data modeling (PSI-115)**: no change.

## Live source check (step 2e)

- NTRS 20170000248 (Fire Detection Tradeoffs, full-text PDF): downloaded again, sha256 identical to `raw/nasa/ntrs-fire-detection-tradeoffs.pdf`; the cached text is the fetch header plus the pdftotext output; all 7 quotes present.
- nasa.gov DAFT fact sheet PDF: downloaded again, sha256 identical to `raw/nasa/daft.pdf`; quote of DETECTION-066 present.
- nasa.gov post `wp-json/wp/v2/migration/309159` (Smoke Particles Are Not All the SAME): downloaded again; quote of DETECTION-082 present; 40 of 42 cached sentences found verbatim in the live body (the other two differ only by the title line and tag spacing).
- NTRS abstracts 20040053578, 20050215648, 20070031686, 20140006585, 20170007283: confirmed live by `quotecheck --refetch`.
- **Not confirmed live: psi.nasa.gov.** The PSI web service answered HTTP 504 for the PSI-102 final report and the PSI-47 30 Day Report downloads and HTTP 500 for the PSI-102 record, 3 tries each. The 57 findings whose text_file is a PSI-hosted file (PSI-102, PSI-101, PSI-115, PSI-47) were checked against the cached copies only: each cached .txt equals pdftotext of the cached PDF, and the file ids in the URLs and the PDF byte sizes match `raw/psi/files/PSI-<n>.json`. Re-run the download when PSI answers again.

## Kept as found, with a caution

- DETECTION-042 and DETECTION-043 give different sizes for the zero-flow effect (30% to 40% larger diameter of average mass in the report body; 2 to 3 times larger in the appended paper). Both quotes are exact and each claim names where it comes from. Show them together.
- DETECTION-018 (typically 50% larger, first SAME results), DETECTION-039 (typically twice the size) and DETECTION-025 (gravity not the dominant cause) disagree on how much gravity matters; each is quoted exactly from its own source.
- DETECTION-058 (2 to 5 pt/cc), DETECTION-061 (less than 5 particles/cm3) and DETECTION-059 (fewer than 15 particles/cm3 average) give different ISS background counts from different DAFT documents.
- `earth_instinct` and `environment_relevance` are the first agent's own framing and were not checked against sources; no source states them.
