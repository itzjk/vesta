# VESTA

**What does NASA's combustion evidence actually cover for your spacecraft cabin?**

VESTA lets you set oxygen, pressure and gravity, inspect nearby evidence, and carry the answer back to its original source. Built by **Team Zerack** for NASA Space Apps Challenge 2026, “Flame in Freefall”.

[Enter VESTA](https://itzjk.github.io/vesta/#/brief) · [Watch one question answered in 26 seconds](https://itzjk.github.io/vesta/?question=1#/brief?station=transit) (wide screens) · [Watch the 60-second tour](https://itzjk.github.io/vesta/#/brief?tour=1) · [Open the instrument view](https://itzjk.github.io/vesta/#/design?view=details) · [JSON receipt format](docs/evidence-receipt.md)

## Start with one question

1. Choose a mission cabin in Transit. The opening answer reports coverage for 45 material-and-concern questions, with the matching limits beside it. Enter the cabin when ready.
2. Open [Evidence](https://itzjk.github.io/vesta/#/design). Use **Coverage**, **Cabin**, **Search**, **Compare** and **Research gaps** to inspect the result, its source rows and the missing measurements. Export a research brief as Markdown or JSON.
3. Choose **Save JSON** to keep an evidence receipt. Reopen it with **Recheck JSON** to compare the saved method, evidence fingerprint and result with the loaded collection. Only an exact match enables **Apply checked cabin**. Files are checked locally.
4. Open [Drill](https://itzjk.github.io/vesta/#/incident), start the exercise and step through eight source-linked decisions. The progress thread stays visible; the debrief exports the scripted decision log as one self-contained JSON, and **Recheck decision JSON** runs the same rules on the saved inputs and reports whether the decisions match ([format](docs/decision-replay.md)). Open [Trust](https://itzjk.github.io/vesta/#/engine) to run the ten published cases, including questions that must return no source.

The default experience is one continuous 3D world with named station tabs and visible action buttons. Object markers also open their controls or evidence. The eye button or **H** hides the controls for presenting. The instrument view exposes the tables and technical detail, and remains available without WebGL.

## Six stations, one evidence trail

| Station | What you can do | What the result means |
| --- | --- | --- |
| Transit | Select a mission cabin and read its opening coverage answer. | Coverage in this collection, with explicit atmosphere limits. |
| Flame | Compare the Earth and low-momentum space flame illustrations and read NASA's observation. | An illustration, not a combustion simulation. |
| Evidence | Inspect 45 coverage questions, each with its nearest source row and a strip of what was compared with your cabin and what is never compared; configure a cabin, search verified findings, compare investigations, and export receipts or research gaps. | Coverage under explicit matching rules, with source provenance. |
| Drill | Step through eight decisions, inspect their support, replay the exercise and export its debrief. | A bounded teaching exercise, not operational flight guidance. |
| Trust | Execute ten reviewed cases and inspect the build's evidence checks. | Reproducible software checks, not independent scientific certification. |
| Robotics | Follow a digital inspection robot from a scripted observation to a human-approved inspection, and save the record. | A concept simulation of a workflow. No physical robot, telemetry or autonomous controller is connected. |

**Mission**, available from every station, explains the problem, the software roles behind each station (they are not live language-model conversations) and the robotics concept, with links to NASA references. Its **Method & limits** topic exposes the matching tolerances, relevance weights, excluded variables and the distinction between reproducibility and scientific validation, with direct routes to evidence, JSON receipts and reviewed cases.

**Video cases**, available from every station, pairs original NASA FLEX and Saffire-V footage with the problem, recorded observation, VESTA response and limits. Each case opens an evidence search or the scripted drill. See [video sources and behavior](docs/video-cases.md). Playback starts only on request; source credits remain with the footage.

The 60-second tour travels through the first five stations. It can be paused, resumed or skipped. NASA photographs carry their own attribution and remain distinct from the illustrated world.

## Read the coverage correctly

VESTA's collection contains 24 PSI investigations. Source-table records may describe days, series or measurement sessions; they are not a count of independent burns. Findings and table rows are different units of evidence.

| Display label | Stable data ID | Meaning within VESTA |
| --- | --- | --- |
| Nearby evidence | `PROVEN` | At least one source-table row meets the implemented matching rules for the selected material and concern. It does not establish equivalent experiments or cabin safety. |
| Other conditions | `EXTRAPOLATED` | Evidence exists, but different or incomplete conditions, or finding-only support, do not establish that same match. |
| No source found | `NEVER_TESTED` | No row or verified finding for that material and concern exists in this collection. It is not a claim about all NASA research. |

These display labels leave the data IDs, API contracts and saved evidence receipts unchanged.

The current atmosphere match requires the same gravity class, oxygen within **one percentage point** and pressure within **five kPa**. Missing measurements do not silently become matches. Inferred facility pressure is identified. Flow, geometry, sample thickness and ignition are not matched, so a nearby atmosphere is not an equivalent fire experiment.

**Quote verified** means an excerpt matched the cached source text. It does not certify VESTA's interpretation. Try [this ventilation citation](https://itzjk.github.io/vesta/#/design?src=S-VENT-01), read its surrounding sentence and follow the original source.

## Keep and reproduce an answer

A [portable evidence receipt](docs/evidence-receipt.md) records the cabin with explicit units, matching method, collection fingerprint, calculated coverage and referenced row snapshots. Rechecking distinguishes a matching result from changes to the method, evidence base or result. A SHA-256 fingerprint detects content differences; it is not an author's signature or an endorsement.

The browser, static API and MCP server use the same pure modules in `web/js/core/`. No runtime language model generates the coverage, findings search or scripted drill advice.

- [Static API manifest](https://itzjk.github.io/vesta/api/v1/index.json), [source rows CSV](https://itzjk.github.io/vesta/api/v1/tests.csv), [findings CSV](https://itzjk.github.io/vesta/api/v1/findings.csv).
- [API contracts and scoring](docs/API.md), [receipt schema and recheck example](docs/evidence-receipt.md), [telemetry format](docs/TELEMETRY.md).
- [Four-tool stdio MCP server](mcp/README.md), with client configuration and a recorded exchange.

With Node 24 and a repository clone, a stdio MCP client can run:

```sh
node mcp/server.mjs
```

It reads committed evidence without network access. To use the published data through the same local server:

```sh
node mcp/server.mjs --base https://itzjk.github.io/vesta/
```

The tools are `search_evidence`, `rank_evidence`, `check_design` and `get_finding`. A website URL alone cannot launch a stdio server.

## Run locally

The runnable artifact is `web/`: static HTML, CSS, ES modules and committed JSON/CSV. No package installation or bundler is needed to serve it. From the repository root, use Python 3:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
```

Open `http://127.0.0.1:8080/`. Hash routes and relative assets also work under `/vesta/`. GitHub Pages publishes `web/` through `.github/workflows/pages.yml` after the release gate.

With Node 24, run the core checks against the committed evidence:

```sh
node --test "tests/core/*.test.mjs"
node tools/check.mjs
```

Rebuilding the evidence requires the delivered `data/`, reviewed `research/evidence/` and cached NASA text under `research/raw/`, plus Python 3.9 or newer. The challenge page cache is deliberately not redistributed. A public clone can use committed `web/data/` and `web/api/v1/` without these inputs.

```sh
node tools/build.mjs
node tools/ntrs-feed.mjs --offline
node mcp/record.mjs
node --test "tests/**/*.test.mjs"
node tools/check.mjs
```

The build checks quote matching, sentence context, table cells, conditions and references before writing outputs. Missing research inputs cannot be recreated by inventing records. The NTRS snapshot at `web/feed/ntrs.json` is a separate discovery feed; its entries do not become verified evidence automatically. Scheduled refresh is disabled.

Browser acceptance also requires opening actual captures and checking the source drawers, controls, mobile layout, reduced motion and no-WebGL fallback. The private `tests/shots.sh` harness exits with an explicit message when its browser machine is unavailable. Unit tests alone do not establish visual quality or frame rate.

## SI use and limits

Code and authored documentation: MIT, copyright 2026 Team Zerack. NASA PSI tables: CC0-1.0, with row-level provenance retained. NASA text is quoted with source attribution and is not relicensed as MIT. Fonts retain their own license. See [LICENSE](LICENSE).

SI agents assisted source extraction, proposed claims and rules, and helped author code and SVG artwork. Deterministic gates verify quote matching, sentence context, table cells and reported conditions. Statuses, relevance scores and the scripted officer use deterministic code, with no runtime model or generated advice. These checks do not establish independent scientific approval of every interpretation. Claims and recommendations remain labelled VESTA interpretations.

Evidence coverage concerns a material and a concern in VESTA’s evidence base (24 PSI investigations), never the safety of a whole cabin. Source rows include days, series and measurement sessions; they cannot be summed as independent burns. NTRS records are a dated snapshot, not automatically admitted evidence. The ISS fallback was written for low Earth orbit with ground support and a return vehicle; it is not validated for the drill’s exploration vehicle. VESTA is a decision-support prototype, not certified flight software, and is not endorsed by NASA. No NASA logos or insignia are used.

<!-- COMPLY START -->
## SI provenance and third-party resources

Claude (Anthropic) and Codex (OpenAI) assisted code, documentation, source extraction, proposed interpretations and visual rendering code. The demo video is a recording of the live app: no image or clip in it was generated, and its captions and original music were produced by SI-assisted code. The [human-readable SI provenance](SI-PROVENANCE.md) distinguishes NASA quotations and original PSI cells from VESTA processing and interpretation; the build publishes the [machine-readable manifest](web/data/si-provenance.json), JSON metadata and CSV/JSONL provenance companions. See the [third-party resource and license inventory](docs/THIRD-PARTY.md) and [NASA image credits](web/assets/nasa/CREDITS.md).

NASA has not reviewed or endorsed VESTA's SI-assisted interpretations and is not responsible for their accuracy.
<!-- COMPLY END -->
