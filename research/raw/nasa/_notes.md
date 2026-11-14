
## Status of the URLs listed in the challenge file

| URL | status |
|---|---|
| https://psi.nasa.gov/physci/repo/search?q=combustion | NOT CACHED AS TEXT. HTTP 200, but the page is a JavaScript application: the HTML has no readable text (0 characters after extraction, title "NASA PSI"). No browser allowed on this machine. PSI records need their own fetch route. |
| https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/ | cached: `combustion-science` |
| https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/ | cached: `researchers-guide-page`; PDF saved as `researchers-guide-combustion.pdf` (1.5 MB, 56 pages) and text as `researchers-guide-combustion.txt` |
| https://www.youtube.com/watch?v=W1oXykoz9zg | NOT CACHED. It is a video on youtube.com (not a NASA host, no text). YouTube oEmbed gives the title "NASA ScienceCasts: The Power of Studying Combustion on the ISS", channel "NASA Science". No fact is taken from it. |
| https://sma.nasa.gov/sma-disciplines/accllp/apollo-1 | cached: `apollo-1` |
| https://sma.nasa.gov/sma-disciplines/accllp/apollo-13 | cached: `apollo-13` |
| https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/ | cached: `mir-fire` |
| https://spinoff.nasa.gov/node/9582 | cached: `spinoff-firemans-air-tanks` |
| https://spinoff.nasa.gov/node/9407 | cached: `spinoff-fire-detector` |
| https://spinoff.nasa.gov/node/9918 | cached: `spinoff-fire-attire` |

## What the Combustion Science page links to

- Web pages: FM2, SoFIE, FLARE (cached). The MDCA "Learn More" link (`.../combustion-science/multi-user-droplet-combustion-apparatus-mdca/`) returns HTTP 404 on 3 tries: unreachable. The MDCA paragraph on the hub page itself is cached.
- PDF fact sheets (nasa.gov/wp-content/uploads/2025/07/): ACME, BASS, DAFT, FLEX, Saffire, SAME, SLICE, SPICE. All cached, PDF plus `pdftotext -layout` text. One PDF covers a family: `bass` holds BASS, BASS-II and BASS-M; `flex` holds FLEX, FLEX-2, FLEX-2J and FLEX-ICE-GA; `same` holds SAME and SAME-R; `saffire` holds Saffire-I to VI; `acme` holds BRE, CLD Flame, E-FIELD Flames, Flame Design, s-Flame and CFI-G.
- CFI (the droplet Cool Flames Investigation) has no page of its own on nasa.gov. What exists: CFI-G inside the ACME sheet, the 2021 cool flames feature (`cool-flames-first`) and the MDCA history (`cir-eight-years`).
- The old GIPOC pages for FLEX, FLEX-2, CFI, BRE, ACME, MDCA, BASS-M, Saffire, SoFIE still exist in the nasa.gov WordPress API but hold only "authorized users" data links and no facts. They were fetched, read and not kept.
- Legacy articles that nasa.gov lists only as `?migration=...` links (which redirect to the home page) were read through the public WordPress REST API (`/wp-json/wp/v2/migration/<id>`); that URL is line 1 of those files: `saffire-mission`, `bre-fire-safety`, `same-smoke-particles`, `cir-eight-years`, `msg-facility`, `iss-passes-torch-flame-studies`, `building-on-past-fire-research`.

## Things an extractor should know

- PDF text keeps typographic ligatures (fi, fl, ff as single characters). Unicode NFKC folds them, so quotes written with plain letters pass `quotecheck.py`.
- NTRS abstracts keep the record's own markup (`O<sub>2</sub>`). Quotes from them stop before the markup.
- Fact sheets were written before or during flight and often use the future tense ("will burn", "is expected in 2017"). They state plans, not always what flew. Dates are thin: BASS, BASS-II, FLEX, FLEX-2, SLICE and SPICE sheets give no flight dates.
- Places where NASA pages disagree, recorded as found: (1) ACME sheet says "five independent experiments" and also "six". (2) SAME reflight: the fact sheet says Expedition 24, July to September 2010; the NASA feature says the second run was in 2011. (3) SoFIE launch: the feature says Northrop Grumman's 17th cargo mission (article of Feb 16, 2022); the science.nasa.gov card says "Launch July 5, 2022". (4) Saffire-I: fact sheet says "Mission Completed July 2016"; the news release dates the burn to the Cygnus departure of June 14, 2016.
- Mars delay: the NASA sources found give "up to 20 minutes one way" (HRP), "about four" to "around 24 minutes" one way (Goddard) and "22-minute communication delays" (CHAPEA analog, which does not say one way). No cached NASA page states "22 minutes one way" in those words.
- Atmosphere: the cached NASA sources give 8.2 psia with 34% oxygen as the exploration atmosphere, 10.2 psia with 26.5% as the alternative, and material tests at up to 37 to 40% oxygen. The "30% or more at 10.2 psi or less" wording is the challenge page's own and is not in these files.
- NASA-STD-6001: the full text cached is the 1998 edition (NTRS 19990036744, scanned, some OCR noise). The standards.nasa.gov page (`nasa-std-6001-standards-page`) lists the active version as "B w/CHANGE 3"; its PDF was not fetched.
