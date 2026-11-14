# VESTA telemetry

Incident mode replays `vesta.telemetry/1` through the same deterministic officer as the static API. This is a decision-support prototype, not certified flight software.

The bundled `transit-avionics-01` drill is fiction. Its sensor values and thresholds are scenario parameters, not NASA measurements or limits. Frames assume the crew follows each decision; there is no physics model or feedback loop.

## File format

Use UTF-8 JSON Lines, one flat object per nonblank line, or a JSON array of those objects. Frames must be in nondecreasing time order. Blank lines and a leading byte order mark are accepted. The first invalid frame rejects the entire file. The previous replay remains on screen and does not run the rejected input.

Only `schema` and `t` are required for format validation. Missing values are unknown, never zero, and a predicate on a missing field does not fire. The player holds the last complete frame until the next timestamp; it does not interpolate or carry individual fields forward.

| Field | Type | Unit or meaning |
|---|---|---|
| `schema` | string, required | Exactly `vesta.telemetry/1` |
| `t` | finite number, required | Seconds, with zero at the first alarm in the authored scenario |
| `simulated` | boolean | The UI labels the file SIMULATED unless every frame explicitly says `false` |
| `zone` | string | Sensor location |
| `smoke_pct_alarm` | finite number | Percentage of the detector alarm threshold |
| `co_ppm` | finite number | Carbon monoxide, ppm |
| `temp_c` | finite number | Temperature, degrees Celsius |
| `airflow_cm_s` | finite number | Airflow, cm/s |
| `o2_percent` | finite number | Cabin oxygen, percent by volume |
| `pressure_kpa` | finite number | Cabin absolute pressure, kPa |
| `fans_on` | boolean | Fan actuator state |
| `zone_power_on` | boolean | Zone power state |
| `flame_visible` | boolean | Reported visible flame |
| `suppressant_discharged` | boolean | Suppression event state |
| `material_reported` | string or null | Crew-reported material, matched to a material id by slug |

A number must be a JSON number; strings such as `"34"`, `NaN` and infinity are invalid. Only `material_reported` accepts null. Unknown extension fields are ignored by the officer.

The Incident UI never substitutes the scenario atmosphere. Missing oxygen or pressure is displayed as unknown and cannot produce a PROVEN coverage match. Other known telemetry fields can still trigger playbook decisions. Gravity, habitat, communications assumptions and the playbook remain those of the selected bundled scenario; loading a file does not infer them from sensor values. This is a replay adapter, not a generic vehicle integration.

## Three-line example

These frames are fictional input. They can fire ALARM, STOP AIRFLOW and LOCATE in the bundled playbook.

```jsonl
{"schema":"vesta.telemetry/1","simulated":true,"t":0,"zone":"avionics-bay-2","smoke_pct_alarm":105,"o2_percent":34,"pressure_kpa":56.5,"fans_on":true,"flame_visible":false}
{"schema":"vesta.telemetry/1","simulated":true,"t":20,"zone":"avionics-bay-2","smoke_pct_alarm":130,"o2_percent":34,"pressure_kpa":56.5,"fans_on":true,"flame_visible":false}
{"schema":"vesta.telemetry/1","simulated":true,"t":60,"zone":"avionics-bay-2","smoke_pct_alarm":150,"o2_percent":34,"pressure_kpa":56.5,"fans_on":false,"flame_visible":false}
```

Choose **Load telemetry .jsonl**, or drop a file onto Incident mode, then press RUN. Files stay in the browser. An invalid third line with `"fans_on":"off"` reports `Line 3 is not vesta.telemetry/1: fans_on.` and nothing from that file runs.

## Playback and audit

RUN and Space toggle playback. STEP and the right arrow jump to the next decision; the left arrow returns to the previous one. RESET returns to standby. Click a fired decision to inspect it. Drag the timeline to seek while paused. Every sourced step keeps its evidence and coverage chips separate. A missing source shows the gap and a verified ISS protocol line with its vehicle limitation; if that line is missing, the decision is handed to the crew.

`#/incident?t=250&paused=1&capture=1` is the deterministic film frame. The bundled playback uses its metadata's speed and reading hold; `?play=1&speed=200&hold=0.3` is the accelerated acceptance run. The clock uses verified delay findings as maximum-delay assumptions. A missing delay finding hides that delay and its countdown.

**Export log** downloads `vesta.decision-log/1`. The bundled scenario uses `core.officer.decisionLog` exactly as `api/v1/officer/transit-avionics-01.json`: `steps` is the ordered StepResult array, `cabin` is the design point, and `clock` contains the counts at the last step. User-file exports add `telemetry` metadata and derive `simulated` from the file. No wall-clock timestamp enters the log.

## Files and checks

- Authoring: `config/playbook.json`, `config/protocol.json`, `config/vesta-lines.json`, `config/scenarios/transit-avionics-01.meta.json` and its `.jsonl`.
- Public copies: `api/v1/scenarios/transit-avionics-01.jsonl`, its `.meta.json`, and `api/v1/telemetry.schema.json`.
- Verification: `node --test "tests/incident/*.test.mjs"` checks schema errors, scenario trigger times, source removal, missing atmosphere, deterministic export and equality with the built officer API. Integration tests skip explicitly until `web/data` is available.
