#!/bin/bash
# The browser pass of the test plan (DESIGN.md 8.2): every route and every designed state, at 1920x1080,
# then the six routes again at 1366x768. Exits 1 on any console error, page error, 4xx from the local
# server, or failed on-screen assertion.
#
#   ./tests/shots.sh                         run on the browser machine through tools/internal/lenovo.sh; captures land in shots/<namespace>/
#   VESTA_NS=film ./tests/shots.sh           another namespace (default: wp7)
#   VESTA_SHOTS_DIRECT=1 ./tests/shots.sh    run tools/internal/shots.mjs on this machine (it needs Playwright)
#   ./tests/shots.sh engine open             only the named shots
#
# The harness (tools/internal/) is working material and is not part of the public repository; without it
# this script says so and exits 2. Any static server plus a browser shows the same pages: the targets
# below are plain URLs of web/.
set -u
cd "$(dirname "$0")/.." || exit 2
NS="${VESTA_NS:-wp7}"

# --- on-screen assertions, written without single quotes and without "::" (the harness splits steps on it)
# has '["text", ...]'  -> an eval step that throws when a text is not on the page (case-insensitive)
has() { printf '::eval:(()=>{const t=document.body.textContent.toLowerCase();for(const s of %s)if(!t.includes(s.toLowerCase()))throw new Error("not on screen "+s)})()' "$1"; }
FONTS='::eval:document.fonts.ready'
FITS='::eval:(()=>{if(document.documentElement.scrollWidth>innerWidth)throw new Error("the page is wider than the viewport")})()'
# every [data-count] on the Engine screen equals its field in engine.json; the Rejected drawer lists exactly verifier.rejected
ENGINE_COUNTS='::eval:fetch("data/engine.json").then(r=>r.json()).then(E=>{const at=k=>k.split(".").reduce((o,p)=>o==null?undefined:o[p],E);const bad=[];const els=[...document.querySelectorAll("#view [data-count]")];if(els.length<30)bad.push("only "+els.length+" counts on the Engine screen");for(const e of els){const v=at(e.dataset.count);const t=e.textContent.trim();const ok=typeof v==="number"?Number(t.replace(/,/g,""))===v:t==="not reported";if(!ok)bad.push(e.dataset.count+" shows "+t+" and engine.json has "+JSON.stringify(v))}const rj=((E.verifier||{}).rejected||[]).map(r=>String(r.id==null?"":r.id));document.querySelector("[data-drawer=rejected]").click();const rows=[...document.querySelectorAll("[data-drawer-body=rejected] [data-rejected-id]")].map(r=>r.dataset.rejectedId);if(JSON.stringify(rows)!==JSON.stringify(rj))bad.push("the Rejected drawer has "+rows.length+" rows and verifier.rejected has "+rj.length);if(bad.length)throw new Error(bad.join("; "))})'
# every count on any other screen that names an engine.json key shows that value
ANY_COUNTS='::eval:fetch("data/engine.json").then(r=>r.json()).then(E=>{const at=k=>k.split(".").reduce((o,p)=>o==null?undefined:o[p],E);const bad=[];for(const e of document.querySelectorAll("[data-count]")){const v=at(e.dataset.count);const t=e.textContent.trim();if(typeof v==="number"&&Number(t.replace(/,/g,""))!==v)bad.push(e.dataset.count+" shows "+t+" and engine.json has "+v)}if(bad.length)throw new Error(bad.join("; "))})'
# every local link on Open data answers 200 (a 4xx also fails the run on its own)
OPEN_LINKS='::eval:Promise.all([...new Set([...document.querySelectorAll("#view a[href]")].map(a=>a.href).filter(h=>h.startsWith(location.origin)&&!h.includes("#")))].map(h=>fetch(h).then(r=>{if(!r.ok)throw new Error(r.status+" "+h)}))).then(a=>{if(a.length<10)throw new Error("only "+a.length+" local links on Open data")})'
OPEN_TOOLS='::eval:(()=>{const n=document.querySelectorAll("#view [data-tool]").length;if(n!==4)throw new Error(n+" MCP tools on screen, 4 expected")})()'

# --- the list (name=target). The first six are the routes; they run again at 1366x768.
NAMES=(brief summarize design-station design incident engine open incident-nosource incident-end drawer row empty flip drill brief-simple summarize-simple design-simple incident-simple engine-simple open-simple)
target() {
  case "$1" in
    brief)             echo "/#/brief?view=details&capture=1$(has '["RUN FIRE DRILL","1 Summarize","3 Interpret","2 Rank","24","DECISION-SUPPORT PROTOTYPE"]')$ANY_COUNTS" ;;
    summarize)         echo "/#/investigations?cmp=PSI-25,PSI-69&view=details&capture=1$(has '["BASS-II","FLEX","not in the table"]')" ;;
    design-station)    echo "/#/design?preset=station&mat=pmma&view=details&capture=1$(has '["PROVEN","pressure inferred","STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION"]')" ;;
    design)            echo "/#/design?preset=lunar-base&mat=pmma&view=details&capture=1$(has '["NEVER TESTED","EXTRAPOLATED","+11.8","no partial-gravity combustion data available in PSI","STATUS = EVIDENCE COVERAGE, NOT A SAFETY CERTIFICATION"]')" ;;
    incident)          echo "/#/incident?t=250&paused=1&view=details&capture=1$(has '["SIMULATED TELEMETRY","SCRIPTED","NOT A PHYSICS MODEL","up to 20 min","SOURCED","EXTRAPOLATED"]')" ;;
    engine)            echo "/#/engine?view=details&capture=1::wait:300$(has '["Extractor","Verifier","Ranker","Officer","SI reads; code checks.","excluded","Rejected"]')$ENGINE_COUNTS" ;;
    open)              echo "/#/open?view=details&capture=1::wait:1500$(has '["tests.csv","findings.csv","api/v1/index.json","search_evidence","rank_evidence","check_design","get_finding","snapshot of","vesta.telemetry/1"]')$OPEN_TOOLS$OPEN_LINKS" ;;
    incident-nosource) echo "/#/incident?t=490&paused=1&view=details&capture=1$(has '["NO SOURCE","SIMULATED TELEMETRY","ISS procedure for low Earth orbit"]')" ;;
    incident-end)      echo "/#/incident?t=1200&paused=1&view=details&capture=1$(has '["SIMULATED TELEMETRY","Earth hear"]')" ;;
    drawer)            echo "/#/design?preset=lunar-base&src=S-VENT-01&view=details&capture=1$(has '["S-VENT-01","ventilation flow strongly enhances flames","quote verified"]')" ;;
    row)               echo "/#/design?preset=station&src=PSI-25:1&view=details&capture=1$(has '["PSI-25","row 1"]')" ;;
    empty)             echo "/#/open?feed=off&view=details&capture=1::wait:800$(has '["Feed unavailable. The evidence base is unaffected."]')" ;;
    flip)              echo "/#/design?preset=station&mat=pmma&view=details::click:[data-preset=\"lunar-base\"]::wait:600$(has '["NEVER TESTED","+11.8"]')" ;;
    drill)             echo "/#/brief?view=details::click:[data-action=\"drill\"]::wait:6000$(has '["SIMULATED TELEMETRY"]')" ;;
    brief-simple)      echo "/#/brief?capture=1$(has '["Simple","Details"]')" ;;
    summarize-simple)  echo "/#/investigations?capture=1$(has '["Simple","Details"]')" ;;
    design-simple)     echo "/#/design?preset=lunar-base&mat=pmma&capture=1$(has '["Simple","Details"]')" ;;
    incident-simple)   echo "/#/incident?t=250&paused=1&capture=1$(has '["SIMULATED TELEMETRY","SCRIPTED","NOT A PHYSICS MODEL"]')" ;;
    engine-simple)     echo "/#/engine?capture=1$(has '["Can you trust it?","VESTA interpretations","Use the data"]')$ANY_COUNTS" ;;
    open-simple)       echo "/#/open?capture=1$(has '["Can you use the data?","Download data","Query the data","Connect an assistant"]')" ;;
    *) return 1 ;;
  esac
}

WANT=("$@"); [ ${#WANT[@]} -eq 0 ] && WANT=("${NAMES[@]}")
FULL=() ; SMALL=() ; PHONE=()
for n in "${WANT[@]}"; do
  t="$(target "$n")" || { echo "unknown shot: $n (known: ${NAMES[*]})"; exit 2; }
  FULL+=("$n=$t$FONTS")
done
if [ $# -eq 0 ]; then for n in "${NAMES[@]:0:7}"; do [ "$n" = design-station ] && continue; SMALL+=("$n-1366=$(target "$n")$FITS$FONTS"); done; fi
if [ $# -eq 0 ]; then
  for n in brief-simple summarize-simple design-simple incident-simple engine-simple open-simple; do
    SMALL+=("$n-1366=$(target "$n")$FITS$FONTS")
    PHONE+=("$n-390=$(target "$n")$FITS$FONTS")
  done
fi

run() {   # run <width> <height> <targets...>
  local w="$1" h="$2"; shift 2
  if [ -n "${VESTA_SHOTS_DIRECT:-}" ]; then
    [ -f tools/internal/shots.mjs ] || { echo "tests/shots.sh: the screenshot harness (tools/internal/shots.mjs) is not in this copy of the repository."; exit 2; }
    node tools/internal/shots.mjs --root web --w "$w" --h "$h" --fmt png "$@"
  else
    [ -x tools/internal/lenovo.sh ] || { echo "tests/shots.sh: the remote browser harness is unavailable; use the existing browser machine."; exit 2; }
    local quoted=() t                      # the remote shell parses the line again: each target travels inside single quotes
    for t in "$@"; do quoted+=("'$t'"); done
    VESTA_NS="$NS" ./tools/internal/lenovo.sh shots --root web --w "$w" --h "$h" --fmt png "${quoted[@]}"
  fi
}

bad=0
echo "== ${#FULL[@]} shots at 1920x1080"
run 1920 1080 "${FULL[@]}" || bad=1
if [ ${#SMALL[@]} -gt 0 ]; then
  echo "== ${#SMALL[@]} routes at 1366x768"
  run 1366 768 "${SMALL[@]}" || bad=1
fi
if [ ${#PHONE[@]} -gt 0 ]; then
  echo "== ${#PHONE[@]} Simple routes at 390x844"
  run 390 844 "${PHONE[@]}" || bad=1
fi
[ $bad -eq 0 ] && echo "shots: ok" || echo "shots: FAILED"
exit $bad
