# VESTA

NASA combustion evidence, turned into traceable questions about spacecraft fire safety. Built by **Team Zerack** for NASA Space Apps Challenge 2026, “Flame in Freefall”.

[Dashboard](https://itzjk.github.io/vesta/) · [Repository](https://github.com/itzjk/vesta) · [API](docs/API.md) · [MCP](mcp/README.md)

VESTA summarizes PSI investigations, ranks verified findings for a cabin atmosphere, and interprets a scripted fire drill. Every finding opens its NASA quote; every test row keeps its PSI investigation, table and row reference. Engine shows the counts and the rejected candidates from the actual build.

PROVEN means tested at these conditions. EXTRAPOLATED means evidence exists but a condition or evidence type differs. NEVER TESTED describes a question with no matching evidence in VESTA's evidence base. Status is evidence coverage, not a safety certification.

The Incident screen is simulated telemetry, scripted, not a physics model. Its thresholds are scenario parameters, not NASA limits. A missing source leads to a published ISS protocol with an explicit applicability limit, or hands the decision to the crew.

## Run and reproduce

The deployed artifact is `web/`: static HTML, CSS, ES modules and committed JSON/CSV files. Serve that directory with any static HTTP host; hash routes and relative asset URLs also work under `/vesta/`. No packages or bundler are required. GitHub Pages publishes `web/` through `.github/workflows/pages.yml` after the release gate.

Use Node 24 and Python 3.9 or newer for a source build:

```sh
node tools/build.mjs
node tools/ntrs-feed.mjs --offline
node mcp/record.mjs
node --test "tests/**/*.test.mjs"
node tools/check.mjs
```

Rebuilding evidence requires the delivered `data/`, reviewed `research/evidence/`, and cached NASA text under `research/raw/`. The challenge page cache is deliberately not redistributed. A public clone can use the committed `web/data/` and `web/api/v1/` without rebuilding. Missing research inputs cannot be recreated by inventing records.

The source build checks quotes, sentence context, table cells, conditions and references before writing outputs. The same pure modules in `web/js/core/` compute browser, API and MCP scores and coverage. SI assistants propose claims and rules at build time; deterministic code checks and executes them. Nothing is generated at runtime.

With the private browser harness available, `VESTA_NS=wp7 ./tests/shots.sh` runs the full route and interaction list at 1920×1080 and the six routes at 1366×768 on the browser machine. Without that harness, the script exits with an explicit message. Captures require visual inspection in addition to automatic checks.

## Open interfaces

- [Static API manifest](https://itzjk.github.io/vesta/api/v1/index.json), [tests CSV](https://itzjk.github.io/vesta/api/v1/tests.csv), [findings CSV](https://itzjk.github.io/vesta/api/v1/findings.csv).
- [API contracts and score](docs/API.md), [four-tool stdio MCP server](mcp/README.md), [telemetry format](docs/TELEMETRY.md).
- NTRS snapshot: `web/feed/ntrs.json`. `node tools/ntrs-feed.mjs` requests newest citations and falls back to the cached index without network. `--offline` uses only that index. Feed items do not become verified evidence automatically. Scheduled refresh is disabled; manual refresh is available.
- Routes: `#/brief`, `#/investigations`, `#/design`, `#/incident`, `#/engine`, `#/open`. `#/open?feed=off` demonstrates the feed-unavailable state.

## Attribution and scope

Code and authored documentation: MIT, copyright 2026 Team Zerack. NASA PSI tables: CC0-1.0, with row-level provenance retained. NASA text is quoted with source attribution and is not relicensed as MIT. Fonts retain their own license. See [LICENSE](LICENSE).

Claims, rules, weights, tolerances, decisions and SVG artwork are VESTA interpretations made with SI assistance. VESTA is a decision-support prototype, not certified flight software, and is not endorsed by NASA. No NASA logos or insignia are used.
