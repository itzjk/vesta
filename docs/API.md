# VESTA static API

By **Team Zerack**. Base URL: `https://itzjk.github.io/vesta/api/v1/`. All endpoints are plain committed files, read with GET. No key or account is needed. Relative links work on any static host. Read `index.json` for the paths actually included, their counts, generation time, schema identifiers and published constants. A missing endpoint is unavailable, not an empty scientific result.

## Files

| Path | Content |
|---|---|
| `index.json` | Manifest, counts, constants, reason codes and license note |
| `investigations.json` | PSI combustion records, excluded records with reasons, related NASA studies separately |
| `findings.json`, `findings.csv` | Verified quote or table findings, gated conditions and sentence context |
| `tests.json`, `tests.csv` | Delivered PSI rows; the CSV is the input CSV byte for byte |
| `tests/<psi_id>.csv` | Normalized test columns followed by `raw.<column>` cells |
| `rules.json`, `sources.json`, `presets.json`, `protocol.json` | Shipped interpretations and their source references |
| `coverage/<preset>.json` | Axis counts, every material × concern cell and coverage totals |
| `rank/<preset>.<concern>.json` | Top findings with score parts, coverage status and reasons |
| `officer/transit-avionics-01.json` | Deterministic `vesta.decision-log/1` scripted scenario log |
| `scenarios/transit-avionics-01.jsonl`, `scenarios/transit-avionics-01.meta.json` | Scripted telemetry and metadata |
| `telemetry.schema.json` | Frame schema for `vesta.telemetry/1` |
| `engine.json` | Counts derived by the evidence build, rejects, dropped conditions and warnings |

Presets: `station`, `spacecraft`, `lunar-base`, `rover`, `mars-base`. Concerns: `prevention`, `detection`, `suppression`. For example: [lunar prevention rank](https://itzjk.github.io/vesta/api/v1/rank/lunar-base.prevention.json), [lunar coverage](https://itzjk.github.io/vesta/api/v1/coverage/lunar-base.json), [FLEX CSV](https://itzjk.github.io/vesta/api/v1/tests/PSI-69.csv).

The independent NTRS snapshot is `../../feed/ntrs.json` relative to this API base. It carries `schema: vesta.ntrs-feed/1`, `fetched_at`, `origin`, `terms` and up to 20 citation records. `origin: ntrs-index` means the cached index was used; its timestamp is the index file time. IN EVIDENCE BASE means the citation already backs a shipped source. Other records remain NOT VERIFIED. Feed updates never bypass the evidence gate.

## Records and units

Test rows retain `id`, `psi_id`, `table_file`, `row`, raw values and recorded outcomes. Added `n` fields hold `material_id`, `fuel_class`, `cabin`, `pillars`, `gclass`, ambient `o2`, reported `p`, facility-only `p_inferred`, and `counts`. Burner-stream oxygen is never treated as ambient oxygen. Inferred pressure remains distinguishable from reported pressure.

Findings retain `claim`, `quote` or `cells`, `source`, `verified`, `gate`, `context` and `n`. Normalized finding fields include `work`, `read_in`, `support`, `psi_id`, gated conditions, material IDs, habitats, fuel class and dropped condition names. Claims and decision hints are SI-written interpretations; quotes are attributed NASA text. Challenge-page quotes are identified separately and carry no redistributed surrounding page text.

Internal units: oxygen percent by volume, pressure kPa, flow cm/s. Display conversion: 1 psi = 6.89476 kPa. Gravity labels: `0 g`, `1/6 g`, `3/8 g`, `1 g`; matching classes are micro, partial and normal. Null means unknown, never zero. Ranges remain ranges. CSV is UTF-8 with RFC 4180 quoting and a header row; units appear in column names.

## Published ranking formula

Scores rank relevance; they do not measure fire probability or safety. Each factor is multiplied by its maximum weight, summed and rounded. Partial quote support multiplies the sum by 0.85 before rounding.

| Term | Max | Factor |
|---|---:|---|
| Pillar | 30 | Same concern 1; design/response 0.5; another concern 0.2 |
| Atmosphere | 25 | 70% oxygen closeness + 30% pressure closeness; closeness is `max(0, 1 - abs(gap)/span)`, unknown 0.3; spans 15 oxygen points and 50 kPa |
| Gravity | 15 | Same class 1; different class 0.4; unknown 0.3 |
| Level | 15 | Flight 1; ground low-gravity 0.8; normal-gravity test 0.6; summary/operations 0.5; model 0.4 |
| Material | 10 | Exact material 1; same fuel class 0.5; no material selected 0.5; general statement with neither material nor class 0.3; otherwise 0 |
| Habitat | 5 | Habitat appears in the Extractor's SI-assigned tags 1; otherwise 0 |

`gap` is zero inside a range; outside it is the signed distance to the nearest endpoint. Ties sort by evidence level, source year descending, then ID. Investigation relevance is the rounded mean of its best three finding scores, with matching rows breaking ties. Weights, spans and tolerances are VESTA's choices, not NASA's.

## Coverage is separate from ranking

A material × concern cell is PROVEN when a single counting row of that material and concern matches gravity, oxygen within 1 percentage point, and pressure within 5 kPa. Pressure inferred from a verified facility sentence yields `qualifier: pressure_inferred`. The cell reports the outcomes actually recorded, without a safety verdict.

EXTRAPOLATED means rows or verified findings exist but at least one requirement fails. NEVER_TESTED means neither a row nor a verified finding answers that material and concern in VESTA's evidence base. An axis gap means zero cabin rows at that axis value. A finding itself is never labeled NEVER_TESTED. A finding is PROVEN only for experimental work with all three gated conditions matching. No partial-gravity result can be PROVEN while the base has zero partial-gravity rows.

Reason identifiers include `gravity_not_reported`, `gravity_never_tested`, `gravity_differs`, `o2_not_reported`, `o2_outside`, `pressure_not_reported`, `pressure_outside`, `not_an_experiment`, `different_fuel_class`, `finding_without_rows`, `no_row_no_finding`. The manifest publishes their display sentences. `pressure_inferred` is a qualifier, not a failed condition.

STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION.

## MCP and telemetry

[MCP instructions](../mcp/README.md) expose search, rank, design coverage and record lookup using the same core code. [Telemetry documentation](TELEMETRY.md) describes JSON Lines, unknown fields and the deterministic officer. The incident is simulated, scripted and not a physics model. A NO_SOURCE result never supplies an invented action; a verified ISS fallback carries its applicability limit.

Code: MIT, Team Zerack. PSI tables: CC0-1.0. NASA text: quoted with attribution. Decision-support prototype, not certified flight software; not endorsed by NASA.
