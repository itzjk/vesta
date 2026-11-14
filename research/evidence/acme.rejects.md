# acme.json: rejected and changed items

Verifier pass of 2026-11-14 over `evidence/acme.json` (75 findings, 6 investigation records). Output: `evidence/acme.verified.json` (74 findings, 6 investigation records).

## Step 1: quotecheck

`tools/quotecheck.py evidence/acme.json --refetch` passed 75 of 75 (report in `evidence/acme.quotecheck.json`). No finding failed, so nothing was relabeled. The one finding with kind "ntrs" (ACME-032) was also found in the live NTRS title + abstract.

## Rejected findings (1)

- **ACME-032**: Rejected. The quote is the abstract of a SLICE paper (NTRS 20150002322): the result belongs to SLICE, a different PSI investigation, not to CLD Flame, under which it was filed. The claim's link "the ISS precursor to CLD Flame" is not in the quoted source (it comes from another paper, NTRS 20210021781). Narrowing the claim to its quote leaves a SLICE finding labeled CLD Flame, so it cannot stay in this family. The same NTRS record is already used for SLICE in evidence/others.json.

## Changed findings (23)

The quote and the claim are untouched in every case; only the fields named were narrowed or corrected.

- **ACME-006**: decision_hint narrowed: the result is one gas-burner emulation test, and "about 100 s" is when the flame "appears to be steady".
- **ACME-009**: conditions narrowed to the test the quoted emulation belongs to (19070K1: 26.5% O2, 10.2 psia, L = 3.0 kJ/g); the 34% / 8.2 psia test has L = 2.42 kJ/g and is covered by ACME-006. decision_hint aligned with the narrowed conditions.
- **ACME-012**: decision_hint narrowed: the sources say ethylene flames burned for minutes "at elevated oxygen concentrations", not "in the same atmospheres".
- **ACME-015**: conditions.fuel narrowed: the quoted passage does not say the four flames were ethylene. decision_hint narrowed: "a flame cooled below this goes out" was a general rule the source does not state.
- **ACME-026**: conditions narrowed: the paper gives fuel, oxygen and pressure only as ranges for the whole study, not for the Figure 2a test.
- **ACME-027**: conditions.fuel narrowed: the fact sheet does not name the fuel of the sooty flames behind this figure. decision_hint narrowed: the source measures soot inside the flame, not smoke production.
- **ACME-029**: decision_hint narrowed: the source says "more stable", not "last longer".
- **ACME-030**: evidence_level changed from "flight experiment": the sentence is the fact sheet's general description of fuel dilution, not a named flight result. conditions.gravity narrowed: the quoted sentences do not say which gravity level they describe.
- **ACME-031**: decision_hint narrowed: "products follow the ventilation flow or stay around the flame" is not in the source.
- **ACME-033**: decision_hint narrowed: the source tested a high-voltage mesh over a burner, not cabin equipment, so "de-energize equipment" went beyond it.
- **ACME-036**: decision_hint corrected: it said "the report gives no blow-out conditions", but the report gives blow-out field strengths (1.46 and 1.30 kV/cm for 70% and 40% methane; 1.76 kV/cm for the 24 cm/s methane jet).
- **ACME-038**: decision_hint narrowed: "treat them as possible ignition sources" is not in the source.
- **ACME-040**: decision_hint narrowed: the source does not discuss ion current as a fire detector.
- **ACME-041**: decision_hint narrowed: the observation was made under an applied electric field.
- **ACME-043**: decision_hint narrowed to the observation; the general rule "below these values the flame goes out" is not stated in the quote.
- **ACME-044**: decision_hint narrowed: the source says steady state "can exist", not that the flame is "permanent".
- **ACME-048**: decision_hint narrowed: "a smaller flame does not mean a weaker fire" is not in this source.
- **ACME-053**: decision_hint narrowed to the observation and its "seem to" hedge.
- **ACME-055**: decision_hint narrowed: the source speaks of this team's ground-based research, not of all ground tests.
- **ACME-058**: decision_hint narrowed: "UV sensing" and "a crew member may not see the flame" are not in the quote.
- **ACME-061**: decision_hint softened to the source's "seemed to".
- **ACME-062**: environment_relevance narrowed: the test atmosphere was 30% oxygen in helium with a hydrogen/methane/helium fuel, which does not match a lunar, Mars or rover cabin atmosphere. decision_hint narrowed: the result comes from a helium-balance atmosphere, not a cabin atmosphere.
- **ACME-074**: topic narrowed to what the PSI tables show (0.85 is the highest XO2 in the two CFI-G tables). environment_relevance narrowed: an inverse flame (oxidizer injected into a fuel atmosphere) does not match a lunar, Mars or rover cabin atmosphere. decision_hint narrowed: "the highest-oxygen microgravity data in PSI" is not supported by this source (it covers CFI-G only).

## Investigation records (5 changes in 4 of 6 records)

All six records were checked field by field: every source quote is present verbatim in its text_file (the quotecheck tool does not cover these, so they were checked with the same normalisation), every non-null field has at least one quote, and psi_id and psi_url of all six equal the entries in `psi-investigations.json` (PSI-20, PSI-21, PSI-22, PSI-10, PSI-23, PSI-159). CLD Flame and s-Flame are unchanged.

- **BRE**: measurements: "thermal radiation (radiometer array)" narrowed to "thermal radiation (radiometers)"; the quote speaks of "the radiometer's measurements" only.
- **BRE**: conditions.flow: the example range "2.3 to 4.95 g/m2s" narrowed to the one value its quote carries (2.3 g/m2s, test 19070K1); the 4.95 g/m2s test stays in finding ACME-006.
- **E-FIELD Flames**: measurements: "flame response to electric forcing" removed; no measurement quote supports it (the fact sheet lists it as a plan and the final report says only some time response data was obtained).
- **CFI-G**: conditions.flow: "0.75 to 2 mg/s of fuel in the cool-flame tests" corrected to "0.75 to 1.5 mg/s"; the seven rows of the PSI normal-flame table flagged "yes" in "Cool flame?" have mHC of 0.75, 1 and 1.5 mg/s.
- **Flame Design**: objectives: the record names extinction limits but quoted only the soot-inception and steady-flame objectives; the matching sentence of the PSI-10 record (objective C) was added as a third quote. Field text unchanged.

## Notes changed

- The CLD Flame note now says 5 findings and no longer lists the SLICE abstract. Two notes were added at the end (verifier summary and live re-download check).

## Step 2e: live re-download check

- NTRS 20210021781 (ACME-002, -013, -029, -048): PDF downloaded again from `https://ntrs.nasa.gov/api/citations/20210021781/downloads/JASMAC%20ACME%20paper%2020210921.pdf`; sha256 equals the cached PDF and `pdftotext -layout` of it equals the cached text.
- nasa.gov ACME fact sheet (ACME-027, -028, -030, -031): PDF downloaded again from its URL; sha256 equals the cached PDF and its `pdftotext -layout` text is contained in the cached text (the cached file adds a 3-line header).
- nasa.gov article "Cool Flames Created During a First for International Space Station Research" (ACME-066, -068, -069): page downloaded again; all three quotes are in the live page text.
- psi.nasa.gov: not reachable for files during this pass. `geode-py/ws/repo/investigations/PSI-20` answered HTTP 500 on 5 tries; the downloads of the PSI-20 final report, the PSI-23 final report and the CFI-G normal-flame table answered HTTP 504 on 3 tries each (the search endpoint answered 200). In place of a live check, the five cached final-report PDFs were compared with their cached text (`pdftotext -layout` reproduces each .txt) and with `raw/psi/files/PSI-<n>.json` (file id and byte size match for all five). A live PSI re-check is still open.

## Left as is, worth knowing

- ACME-027 and ACME-028 keep "flight experiment": the fact sheet lists them under CLD Flame "Selected Findings" and says "The experiment has provided" the measurements, although other parts of the same fact sheet were written before flight. The 2021 NASA paper (ACME-029 source) reports the same trends from ISS testing ("several times greater" soot, "taller and wider").
- BRE findings keep lunar base, Mars base and pressurized rover in environment_relevance because BRE tested the NASA exploration atmospheres (26.5% O2 at 10.2 psia, 34% O2 at 8.2 psia); all of them are microgravity data, so those uses are extrapolations in gravity, as the file notes say.
- decision_hint and earth_instinct are interpretation written for VESTA, not NASA text; they were judged only for being fair, modest and not against the source.
