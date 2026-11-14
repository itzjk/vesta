# VESTA MCP server

By **Team Zerack**. Node 24, no dependencies. Newline-delimited JSON-RPC 2.0 over stdio; stdout contains protocol replies and stderr contains diagnostics. The server imports the dashboard's pure core modules.

From a repository clone:

```sh
node mcp/server.mjs
node mcp/server.mjs --base https://itzjk.github.io/vesta/
node mcp/server.mjs --data ./web/data
```

The default reads committed `web/data/`. `--base` reads the same files from a static host while running the local server code. A URL alone cannot start a stdio process. Run clients from the clone directory or replace the script argument with its location in your clone.

```json
{
  "mcpServers": {
    "vesta": {
      "command": "node",
      "args": ["mcp/server.mjs", "--base", "https://itzjk.github.io/vesta/"]
    }
  }
}
```

## Four v1 tools

| Tool | Arguments | Result |
|---|---|---|
| `search_evidence` | Optional query, pillar, topic, investigation, limit (10) | Matching verified findings; every query word must occur in claim or quote |
| `rank_evidence` | habitat, concern; optional o2_percent, pressure_kpa, gravity, material, limit (10) | Cabin query, weights, ranked findings with score parts, status, reasons and source URL |
| `check_design` | o2_percent, pressure_kpa, gravity; optional materials and concern | Axis coverage, material cells, legend and scope note |
| `get_finding` | id | Finding with context and normalized conditions, or PSI row with raw cells |

Gravity values: `0g`, `moon`, `mars`, `1g`. Habitat presets: station, spacecraft, lunar-base, rover, mars-base. Concerns: prevention, detection, suppression. Pressure is kPa; oxygen is percent by volume. Missing rank conditions default to the habitat preset. Limits are integers from 1 through 100. Tools for incident execution and arbitrary test filtering are outside v1.

`initialize` echoes the requested protocol version and advertises tools; `tools/list` gives JSON schemas. `tools/call` returns JSON inside `content[0].text`. Empty lookup or search returns `no_source: true`; tool errors set `isError: true`. Every tool result includes `scope: decision-support prototype, not certified flight software`.

## Recorded exchange

Run `node mcp/record.mjs` after an evidence build. It captures initialize, tools/list and the rank call below over the real stdio transport, writes `mcp/recorded.json`, embeds the same recording in the Open data view, and refreshes this block. `node mcp/record.mjs --check` detects stale recordings.

<!-- recorded:start -->
Request (one line on stdin):

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"rank_evidence","arguments":{"habitat":"lunar-base","concern":"prevention","limit":3}}}
```

Answer (the `text` of `result.content[0]`, parsed and indented):

```json
{
 "query": {
  "preset": "lunar-base",
  "habitat": "lunar-base",
  "concern": "prevention",
  "o2": 34,
  "p_kpa": 56.5,
  "gclass": "partial",
  "g_display": "1/6 g",
  "material": null
 },
 "weights": {
  "pillar": 30,
  "atmosphere": 25,
  "gravity": 15,
  "level": 15,
  "material": 10,
  "habitat": 5
 },
 "results": [
  {
   "rank": 1,
   "id": "SOLIDS-110",
   "total": 77,
   "parts": {
    "pillar": 30,
    "atmosphere": 25,
    "gravity": 4.5,
    "level": 7.5,
    "material": 5,
    "habitat": 5
   },
   "status": "EXTRAPOLATED",
   "reasons": [
    "not_an_experiment",
    "gravity_not_reported"
   ],
   "work": "summary",
   "read_in": "nasa_report",
   "claim": "The SoFIE project slides state that few thin fuel sheet materials are rated even in 1 g at 34% O2 and 8.2 psia, the exploration atmosphere.",
   "quote": "Thin fuel sheets: few materials rated even in 1g at 34% O2, 8.2 psia (exploration atmosphere).",
   "url": "https://ntrs.nasa.gov/api/citations/20200000361/downloads/20200000361.pdf"
  },
  {
   "rank": 2,
   "id": "OPERATIONS-242",
   "total": 73,
   "parts": {
    "pillar": 15,
    "atmosphere": 25,
    "gravity": 15,
    "level": 7.5,
    "material": 5,
    "habitat": 5
   },
   "status": "EXTRAPOLATED",
   "reasons": [
    "not_an_experiment"
   ],
   "work": "summary",
   "read_in": "nasa_report",
   "claim": "One planned FM2 mode investigates flame spread on the Moon in a normoxic environment, for example 34% oxygen at 0.558 atm.",
   "quote": "Mode 3: To investigate a planned normoxic environment (for example 34% O2 at 0.558 atm) on flame spread on the Moon compared to Earth.",
   "url": "https://ntrs.nasa.gov/citations/20210020516"
  },
  {
   "rank": 3,
   "id": "S-EXPL-01",
   "total": 70,
   "parts": {
    "pillar": 15,
    "atmosphere": 25,
    "gravity": 4.5,
    "level": 15,
    "material": 5,
    "habitat": 5
   },
   "status": "EXTRAPOLATED",
   "reasons": [
    "gravity_not_reported"
   ],
   "work": "flight",
   "read_in": "nasa_page",
   "claim": "Saffire samples were also burned at 8.2 psia and 34% oxygen to simulate the atmosphere of deep space exploration vehicles.",
   "quote": "In addition, the samples were burned at 8.2 psia and 34% oxygen levels to simulate atmosphere conditions for deep space exploration vehicles.",
   "url": "https://www.nasa.gov/wp-json/wp/v2/migration/309559"
  }
 ],
 "scope": "decision-support prototype, not certified flight software"
}
```
<!-- recorded:end -->

## Verification and attribution

```sh
node --test "tests/mcp/*.test.mjs"
node mcp/record.mjs --check
```

Transport and fixture checks run without built data. Real-evidence integration checks skip with an explicit reason until the evidence files exist. Scores and coverage are VESTA interpretations, not NASA safety certifications. PSI tables are CC0-1.0; NASA text is quoted with attribution. Code is MIT, copyright 2026 Team Zerack. See [API](../docs/API.md) and [LICENSE](../LICENSE).
