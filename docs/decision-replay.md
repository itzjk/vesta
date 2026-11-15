# Portable decision logs

Incident and the Drill debrief export `vesta.decision-log/2` JSON. Recheck decision JSON loads that same file, reruns the deterministic officer over its saved telemetry and compares the result with both the saved evidence snapshot and the currently loaded collection. No upload or network request is made by these controls.

The record contains:

- `input`: every ordered `vesta.telemetry/1` frame and exact scenario metadata, including cabin, gravity and communication-delay assumptions. Export includes the full loaded drill, even when playback is paused earlier.
- `method`: versioned officer, coverage and ranking methods; playbook predicates, dependencies, rules, conditional protocols, matching tolerances, ranking weights, work levels, proximity spans, support multiplier, scoring formula and tie order. This is data, never executable JavaScript from a file.
- `collection`: complete normalized source-table rows, findings, investigation records, source records and table metadata. The complete snapshot includes unused candidates so rankings and negative evidence can be recalculated without fetching anything.
- `basis`: SHA-256 over the canonical collection, with row, finding and investigation counts. These are source-table rows, not independent experiments. Object keys and collection order are canonicalized; timestamps and animation are excluded.
- `steps`, `cabin`, `clock`: the existing decision output, unchanged. Eight scripted decisions retain their exact actions, states and citation IDs.
- `evidence`: each triggering frame, query, matched predicates and dependencies, selected rule, all candidate ranking terms and scores, selected sources, full finding snapshots, referenced row snapshots, source URLs, matching reasons, reported/inferred pressure, coverage and conditional fallback.

The UI uses the evidence receipt's status vocabulary and messages:

| Status | Meaning |
|---|---|
| `MATCH` | Same cabin, evidence and result in the loaded collection. All decisions, coverage states, reasons, sources and clock match. |
| `METHOD_CHANGED` | The matching method differs. Review the current result. Includes officer version, thresholds, ranking constants, rules and protocols. |
| `BASIS_CHANGED` | The collection fingerprint differs. Review the current result. |
| `RESULT_CHANGED` | The saved result or evidence differs from the current calculation. |
| `INVALID` | Invalid JSON, unsupported/incomplete sections, invalid telemetry or predicates, duplicates, broken embedded collection fingerprint or size/count limits. Nothing is applied. |
| `LEGACY` | An old `vesta.decision-log/1` is readable as a saved log. It lacks inputs, method and collection, so reproducibility cannot be checked; export a new record. |

If several categories differ, the first three change statuses take priority in table order and the UI lists all changed categories. Review recalculated decisions shows the new local result, never silently replaces the running drill. Legacy review is labelled as unverified saved output by its LEGACY notice. Method snapshots are compared with the supported implementation; a different method never earns MATCH. The snapshot can be indexed with `buildIndex({ ...record.collection, ...record.method })` and run with `run(record.input.frames, index, record.input.meta)` using the supported VESTA engine.

`Load telemetry frames` remains a separate input for JSONL or JSON arrays of `vesta.telemetry/1` frames. It replaces the drill input, using the current scenario gravity and playbook. It never imports a decision log. RESET restarts the loaded input at standby; RUN starts or pauses scripted playback; STEP advances to the next decision. The time slider seeks without running. Export decision log saves the full input and its computed decisions. Recheck decision JSON opens an exported log and displays the comparison. Button titles and accessible names explain short labels.

Limits: 16 MiB UTF-8 per decision file, 10,000 ordered frames, 256 playbook steps and decisions, 64 predicates per step, 20,000 records per collection section. The file picker checks size before reading; the pure parser independently checks it. Saved collection edits with a stale fingerprint are rejected. SHA-256 is an integrity comparison, not authentication: someone who rewrites a coherent package and its digest can create a different reproducible drill. No signature, scientific validation or NASA endorsement is claimed.

Telemetry is scripted, rules were written with SI assistance, and there is no live language model. Reproducing a record proves a repeatable calculation, not that the science or flight software is validated. Status words remain SOURCED / NO SOURCE and NEARBY EVIDENCE / OTHER CONDITIONS / NO SOURCE FOUND. Stable internal coverage enums are unchanged. Per-decision evidence is kept separate for the later matched/unmatched strip integration.

No generated dataset or MCP recording changes are needed. The legacy synchronous `officer.decisionLog()` and Incident's legacy adapter remain available; new UI downloads use async `createDecisionRecord()`. Run `node --test "tests/core/*.test.mjs" "tests/mcp/*.test.mjs"` and `node mcp/record.mjs --check`.
