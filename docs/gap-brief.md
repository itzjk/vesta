# Cabin research-gap brief

`web/js/core/gapbrief.js` turns the existing material-by-concern coverage calculation into a deterministic research agenda. `web/js/ui/gapbrief.js` renders the same document with clickable phrases and downloads it as Markdown or JSON. This is the readable sibling of the [evidence receipt](evidence-receipt.md); it does not replace that receipt.

The document says: **Coverage within the loaded VESTA collection, not a safety verdict or a NASA review. Prepared with SI assistance.** There is no model call at runtime.

## API

```js
import { createGapBrief, gapBriefJson, gapBriefMarkdown, recheckGapBrief } from '../web/js/core/gapbrief.js';

const brief = await createGapBrief(db, q);
const json = gapBriefJson(brief);
const markdown = gapBriefMarkdown(brief);
const checked = await recheckGapBrief(json, db);
```

Inputs use the existing indexed `db` and cabin query (`o2`, `p`, `g`, `gclass`, `material`, `concern`). Query validation and the collection fingerprint come from `createReceipt`. Missing oxygen, pressure or gravity stays `null`; a preset does not silently fill it. Unknown, invalid or contradictory values fail explicitly. HTTPS or localhost is needed for SHA-256 in browsers.

The material universe is the indexed cabin-material set crossed with the core concern list. On the current collection that produces 45 questions. Selecting one material or concern does not hide other research gaps or change the report bytes. The exported receipt-compatible query fixes `material_id` to `null` and `concern` to the first core concern, since the brief always covers all questions. An unlisted selected material is outside this indexed agenda; the receipt can still report its selected-cell gap. An empty collection produces an empty agenda, never a claim about unindexed materials.

## Schema `vesta.gap-brief/1`

The schema name and major version are in `schema`. A change to field semantics or the priority method requires a new version. `gapBriefJson` emits recursively sorted object keys, two-space indentation and one final newline. Array order is intentional. There is no generation timestamp, random ID or locale-dependent text formatting.

| Field | Content |
| --- | --- |
| `schema` | `vesta.gap-brief/1` |
| `scope`, `disclosure` | Collection-only limit, safety/NASA disclaimer and SI assistance |
| `query` | Receipt query with units in keys: `oxygen_percent`, `pressure_kpa`, `gravity`, `gravity_class`, `material_id`, `concern` |
| `basis` | Receipt SHA-256 fingerprint, investigation count, source-table row count and finding count |
| `method` | Receipt matching method and limits, priority ID/rule, difference convention, count universe and priority limitation |
| `coverage` | Counts for `NEVER_TESTED`, `EXTRAPOLATED`, `PROVEN`, directly from the coverage core |
| `agenda` | At most three `{question_id, status, related_findings, related_rows}` records |
| `questions` | Every indexed material/concern question, sorted by status group, then question ID in code-point order |

Each question has:

| Field | Meaning |
| --- | --- |
| `id`, `material_id`, `material`, `concern` | Stable `material/concern` ID and the label from `db` |
| `status`, `reasons` | Existing coverage-core result, without reinterpretation |
| `coverage_source` | `design-coverage`, the existing collection-coverage citation |
| `row_count`, `nearby_row_ids`, `finding_ids` | Complete counts/IDs for the exact material and concern, not a count of independent experiments |
| `nearest_row_id` | Existing core's nearest material/concern row, including for nearby coverage; `null` when there is none |
| `comparison` | Conditions of the nearest row; otherwise the highest-ranked finding for the exact question; otherwise `null` |
| `related_findings`, `related_rows` | Loaded findings mentioning that exact material ID, and counted rows indexed under that material, across concerns |
| `lead_finding` | Existing core's highest-ranked finding for the question, with its claim and relevance. For absent questions only, a same-material finding is marked `related_only: true` |
| `sources` | Representative row and lead-finding provenance, with `role`, `finding_id`, `row_id`, `investigation_id`, `investigation`, `table_file`, `row`, `source_url` |

`row_ids` and cell row references of a lead finding are expanded into provenance records. Bibliographic findings can lack PSI, table and row, which remain `null`. A row-only question can lack a finding ID. No missing source identifier is fabricated. The JSON keeps all matching finding and nearby row IDs, while the readable document expands representative sources rather than reproducing every row. Full finding text stays in JSON and the source drawer to keep the Markdown and on-screen brief short.

A missing question has no direct finding or row to cite. Its absence is supported by the coverage calculation over the fingerprinted collection. Any material-row or finding references alongside it have role `related_only` and do **not** answer that concern. In the UI the absence phrase opens `design-coverage`; related phrases open their actual record. Exports include the collection digest and explicit PSI/table/row/finding identifiers where they exist.

## Matching and exact differences

The data IDs remain stable. The display labels are **Nearby evidence** (`PROVEN`), **Other conditions** (`EXTRAPOLATED`), and **No source found** (`NEVER_TESTED`). `PROVEN` is the existing technical name for nearby evidence, not a safety result. It requires oxygen within the core's tolerance and pressure within its tolerance on the same row at the same gravity class. `EXTRAPOLATED` includes finding-only evidence, unknown conditions and mismatched conditions. `NEVER_TESTED` means no exact material/concern row or finding in the collection. Previously exported documents retain these IDs and their original wording; a display-label change does not change the matching method.

The nearest row is chosen by `nearestRow` in `core/status.js`, preserving its failure-count, oxygen-distance, pressure-distance and row-ID tie breaks. Finding relevance uses `rank` in `core/rank.js`; relevance is not probability and does not govern agenda priority. No coverage threshold is changed or duplicated.

`comparison` contains `origin` (`row` or `finding`), `id`, `oxygen`, `pressure`, and `gravity`:

- Oxygen stores source value or interval, cabin value, and `delta_percentage_points`.
- Pressure stores source value or interval, cabin value, `delta_kpa`, `basis` (`reported`, `inferred`, `unknown`), and the original `inference_source` when present.
- Differences are cabin minus source, retaining the normalized source precision rather than the coverage matcher's one-decimal display rounding. For an interval, use the nearest boundary, or zero inside it. Missing data yields `null`, never zero. Decimal subtraction removes binary floating-point display residue up to 15 decimal places.
- Gravity stores the reported description, source class, cabin gravity key/class/label, `delta_g: null` and an explicit explanation. The normalized records provide categorical gravity, not a measured acceleration magnitude from which a numeric difference could honestly be calculated. Moon and Mars retain their distinct cabin labels even though the matcher groups both as partial gravity.

Flow, geometry, thickness and ignition remain unmatched. Inferred facility pressure is an assumption, shown beside its comparison. Nearby evidence can still differ from the cabin within the published tolerances.

## Published priority rule

Method ID: `vesta.research-agenda/1`.

Sort lexicographically by `(status_order, -related_findings, -related_rows, question_id)`, where `status_order` is missing evidence before extrapolated evidence. Exclude nearby questions and take the first three. There are no weighted components. Status dominates completely; the related counts only break ties within a status group. IDs use ascending code-point order.

This chooses unanswered questions first, favouring materials with source context from which to start a study. The same related context can support multiple concerns, so more than one agenda entry may concern the same material. Counts do not establish independent studies, severity, research cost, safety or scientific importance. The strongest objection is collection bias: a frequently studied material can outrank an important but neglected one. The rule is published as a reproducible starting agenda, not an optimum allocation of research.

## UI mounting

```js
import { build as buildGapBrief } from '../ui/gapbrief.js';
const gapBrief = buildGapBrief(world);
consoleBody.append(gapBrief.element);
```

Call `gapBrief.update(q)` whenever the cabin changes and `gapBrief.dispose()` when the act is disposed. `build` returns synchronously and starts its initial calculation; `update` returns a promise. `getDocument()` returns the currently rendered document, or `null` during calculation or after an error. Concurrent updates cannot let an older cabin overwrite the newest one. Downloads stay disabled until a current document has been rendered successfully. The component owns only its scoped styles and DOM. It starts no timers, routes, camera or global event handlers. Its panel scrolls internally.

Mount behind the explicit **Research gaps** action in the Evidence station, inside the existing on-demand console. The host owns open/close, Escape, panel positioning and cabin controls. Every factual source phrase uses `world.cite(text, id)`; IDs remain in the source drawer and exported document. The module does not change the world, receipt controls, source drawer or existing web files.

## Re-reading and verification

`parseGapBrief` validates the named version, required list sections and strict cabin query, with a 2 MB input cap. It is a document reader, not an authorship check. `recheckGapBrief(input, db)` recomputes the entire document and returns `MATCH`, `CHANGED` or `INVALID`. Any modified content, method, order, unsupported extra content or collection difference cannot pass as a match. This checks reproducibility, not scientific correctness or NASA review. Markdown is a human-readable export; its bytes can be compared to `gapBriefMarkdown` of the JSON document.

`tests/core/gapbrief.test.mjs` covers all five presets and a custom cabin, lexicographic priority including count and ID ties, group order, byte stability under reordered data and query fields, precision, inferred pressure, finding-only evidence, source provenance, ranges, unknown measurements, empty collections and modified/invalid files.

The DOM-only bench in `build/agentes/W4-GAP/` loads real `web/data` with no 3D imports. Its browser driver runs on the Lenovo with GPU and WebGL disabled at 1440×900 and 390×844, clicks the disclosures and citations, downloads both formats for every cabin, reads them back, rechecks JSON, compares Markdown bytes, checks keyboard export and verifies update/dispose behaviour. This isolated bench does not establish integrated-world layout or performance.
