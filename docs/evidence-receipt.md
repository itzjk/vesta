# Portable evidence receipts

A cabin chosen in VESTA can be saved as `vesta.evidence-receipt/1` JSON and rechecked against the currently loaded evidence collection. The result is a reproducible coverage calculation, not a fire simulation, certification, signature or independent scientific validation.

The receipt contains:

- `query`: oxygen percent, pressure in kPa, gravity and gravity class, selected material and concern. Missing measurements remain `null`. No preset silently fills them in.
- `method`: the versioned matching method, tolerances, scope and unmatched conditions. The current rules use oxygen within one percentage point and pressure within five kPa on the same row, at the same gravity class.
- `basis`: a SHA-256 fingerprint and collection counts. The fingerprint covers normalized source rows, findings, investigation records, materials and the partial-gravity row count. It excludes rendering settings, timestamps and animation.
- `result`: the nearby cabin-row IDs, all material/concern coverage cells, their tally and the selected cell. These rows are source-table records, not a count of independent experiments.
- `evidence`: exact snapshots of nearby and nearest referenced rows, source URLs, row matching reasons, reported/inferred pressure labels and referenced findings.

The stable receipt IDs are unchanged: `PROVEN` is displayed as **Nearby evidence**, `EXTRAPOLATED` as **Other conditions**, and `NEVER_TESTED` as **No source found**. `PROVEN` only means nearby evidence under the listed matching rules; `EXTRAPOLATED` includes different or incomplete conditions and finding-only support. `NEVER_TESTED` is a gap in this collection for that material and concern. Flow, geometry, sample thickness, ignition and suppressant configuration are not matched. Facility pressure can be inferred. Findings and table rows have different units of evidence. Display wording does not change the receipt method or recheck contract.

## Browser integration

```js
import { receiptControls } from '../ui/receipt.js';

consoleBody.append(receiptControls({
  db,
  getQuery: () => currentQ,
  onReplay: q => applyCabinThroughExistingControls(q)
}));
```

Mount inside the station's on-demand console. It adds Save evidence JSON, Recheck JSON and a local file input. Apply checked cabin only appears after an exact match with complete oxygen, pressure and gravity. It uses the existing download helper and no network upload. Importing a file never applies its values automatically. `onReplay` is optional; without it the controls still save and recheck.

The internal query shape is the existing `core/index.js` shape: `o2`, `p`, `g`, `gclass`, `material`, `concern`. Exported query keys include units to avoid ambiguity. Replayed queries use `preset: 'custom'`; the exact saved numbers are authoritative. A label such as Moon is not allowed to contradict its gravity class.

## Programmatic recheck

```js
import { createReceipt, recheckReceipt } from '../web/js/core/receipt.js';

const saved = await createReceipt(db, query);
const checked = await recheckReceipt(JSON.stringify(saved), db);
console.log(checked.status, checked.changed);
```

| Status | Meaning |
| --- | --- |
| `MATCH` | Method, collection fingerprint, calculated result and evidence snapshots match. |
| `METHOD_CHANGED` | The matching method or its declared limits differ. |
| `BASIS_CHANGED` | Collection content or collection counts differ. |
| `RESULT_CHANGED` | The saved result or evidence snapshots differ from recomputation. |
| `INVALID` | Unsupported version, malformed structure, invalid query or file over 2 MB. |

For valid inputs, `current` contains the recomputed receipt; `changed` names every differing section. Changed receipts are never labelled a match. Unsupported or extra top-level sections are rejected. The query is strictly checked instead of coerced from strings or silently converted between units. SHA-256 requires HTTPS or localhost in browsers and is available in Node 24.

The fingerprint detects differences from the loaded collection; it is not an author's signature. Someone who changes a query and recomputes a consistent receipt has created another reproducible calculation. Rechecking does not establish authorship or determine whether NASA's source interpretation is correct. Original spreadsheet cells remain accessible through the existing source drawer; row snapshots contain the normalized application records.

## Verification

`node --test tests/core/receipt.test.mjs` checks real station and Moon coverage, JSON round trips, inferred pressure, missing measurements, unlisted materials, changed rows with unchanged counts, modified evidence, modified tolerances and limits, malformed/oversized files and strict query handling.
