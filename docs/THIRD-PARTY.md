# Third-party resources and licenses

Inventory inspected on 2026-11-14 for the static app and for the demo video `web/demo/vesta-demo.mp4`, a recording of the live app made on 2026-11-14. A version marked **not recorded** has not been inferred from a family name. A missing license file is stated explicitly. This inventory does not relicense NASA, partner, font, SI-service or tool content under VESTA's MIT license.

## Redistributed app code and typefaces

| Resource and actual use | Version or distribution | Applicable license | License text in this repository | Primary URL |
|---|---|---|---|---|
| Three.js, WebGL renderer and CSS3DRenderer in `web/vendor/three/` | 0.186.1; `REVISION` 186 | MIT | `web/vendor/three/LICENSE`, opened and read | [Three.js](https://threejs.org/), [upstream license](https://github.com/mrdoob/three.js/blob/r186/LICENSE) |
| Barlow Condensed, app display, SemiBold and Bold WOFF2 | 1.408 from the WOFF2 name table; Google Fonts distribution v13, downloaded 2026-11-14 | SIL OFL 1.1 | `web/assets/fonts/BarlowCondensed-OFL.txt`, opened and read | [Family](https://fonts.google.com/specimen/Barlow+Condensed), [source license](https://github.com/google/fonts/blob/main/ofl/barlowcondensed/OFL.txt) |
| Source Sans 3, app body WOFF2 | 3.052 from the WOFF2 name table; Google Fonts distribution v20, downloaded 2026-11-14 | SIL OFL 1.1 | `web/assets/fonts/SourceSans3-OFL.txt`, opened and read | [Family](https://fonts.google.com/specimen/Source+Sans+3), [source license](https://github.com/google/fonts/blob/main/ofl/sourcesans3/OFL.txt) |
| IBM Plex Mono, app data, Regular and SemiBold WOFF2 | 2.3 from the WOFF2 name table; Google Fonts distribution v23, downloaded 2026-11-14 | SIL OFL 1.1 | `web/assets/fonts/IBMPlexMono-OFL.txt`, opened and read | [Family](https://fonts.google.com/specimen/IBM+Plex+Mono), [source license](https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt) |
| Space Grotesk WOFF2, retained in `web/assets/fonts/` from an earlier interface; no page, stylesheet or video of the current product uses it | 2.000 from the WOFF2 name table | SIL OFL 1.1 | `web/assets/fonts/OFL.txt`, opened and read | [Family and license](https://github.com/floriankarsten/space-grotesk) |

All four family versions above were read from the actual WOFF2 OpenType name tables without modifying the font files.

Exact app font download URLs are retained in `web/assets/fonts/SOURCES.json`. Distribution versions v13/v20/v23 are Google Fonts URL versions, not claims about internal OpenType revisions.

## NASA data and source text

| Resource and actual use | Version / record register | License or usage basis | License text / provenance in the repository | Primary URL |
|---|---|---|---|---|
| PSI investigations and original source-table cells; factual basis of the dashboard | Per-record `psi_version` where available in `research/psi-investigations.json`; table/file/row identity retained in `web/data/tests.json`, `web/data/tests-raw.json` and `web/data/tables.json` | CC0-1.0 where documented by the source records; live PSI license confirmation returned 403 in the rules audit, **not verified** | License identifiers in the research register and `web/data/meta.json`; **full CC0 legal text is not bundled** | [PSI](https://psi.nasa.gov/physci/repo/search?q=combustion), [CC0 legal text](https://creativecommons.org/publicdomain/zero/1.0/legalcode) |
| Quoted NASA pages, NTRS papers, reports and PSI reports, including combustion findings and the ISS operations fallback | The complete source register is `web/data/sources.json`: 182 source entries at inspection, with original URL, ID, year when reported, source kind and finding IDs. `web/data/investigations.json` links the selected studies. These registers are the per-source inventory, not a claim that all entries have the same rights | NASA factual/informational use guidance; third-party authors and rights can differ by record. **No blanket MIT or CC0 license for all papers is claimed** | Source citations and text caches under `research/raw/`; **per-record reuse licenses are not bundled or independently verified for every report** | [NTRS API](https://ntrs.nasa.gov/api/citations/search), [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) |
| NTRS recent-publication catalog | `web/feed/ntrs.json`, dated snapshot and original citation URLs; not automatically verified evidence | NASA/NTRS source metadata, with record-specific rights where applicable | Original URLs and dates in the feed; **no separate license text bundled** | [NTRS](https://ntrs.nasa.gov/) |
| Flame in Freefall challenge text used as context | Challenge-page source entry in `web/data/sources.json`, 2026 | Space Apps page terms; a citation is not a NASA endorsement | Source URL in the register; **no separate license text bundled** | [Challenge](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/) |

Verbatim quotations and original source cells are NASA material. SI-assisted extraction, catalog selection, normalization, inferred conditions, summaries and decisions are VESTA processing or interpretation. [SI provenance](../SI-PROVENANCE.md) records that distinction. NASA has not reviewed or endorsed VESTA's SI-assisted interpretations and is not responsible for their accuracy.

## NASA imagery actually used by the app

All eleven files below are identified in [`web/assets/nasa/CREDITS.md`](../web/assets/nasa/CREDITS.md), opened and read, with acquisition and transformation notes. Record metadata is in `web/assets/nasa/tex/*-metadata.json` and `web/assets/nasa/media/media.json`. These are source images, not SI-generated observations. The seven experiment photographs are resized; the candle comparison plate is cropped as documented in its credits; the scenic textures are projected/dimmed and also used in artistic light reconstruction. No SI-generation mark was burned into the original NASA files.

For every row, the usage basis is [NASA's media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/), checked 2026-11-14, with the exact credit below. This is not a transferable MIT/CC0 license or proof of partner rights. The repository contains the credits and original record metadata, **not a full standalone license grant for each image**. Partner/copyright exceptions require record-level review.

| File | Stable record / version | Required credit | Original URL |
|---|---|---|---|
| `tex/mars.jpg` | PIA04304, “The Target”; downloaded 2026-11-14 | NASA/USGS | [PIA04304](https://images.nasa.gov/details/PIA04304) |
| `tex/earth.jpg` | GSFC_20171208_Archive_e001386, “Blue Marble 2012”; downloaded 2026-11-14 | NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring | [Earth record](https://images.nasa.gov/details/GSFC_20171208_Archive_e001386) |
| `tex/stars.jpg` | PIA12066, Cepheus composite, exposures 2007-12-03; downloaded 2026-11-14 | NASA/JPL/MPS/DLR/IDA | [PIA12066](https://images.nasa.gov/details/PIA12066) |
| `tex/candle-pair.jpg` | GRC-1998-C-00485, normal-gravity/microgravity candle pair; catalog date 2004-05-01, downloaded 2026-11-14 | NASA Glenn Research Center | [Original record](https://images.nasa.gov/details/GRC-1998-C-00485) |
| `media/iss059e103188.jpg` | iss059e103188, ACME/Flame Design hardware; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss059e103188) |
| `media/iss040e086481.jpg` | iss040e086481, BASS-II; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss040e086481) |
| `media/iss040e088023.jpg` | iss040e088023, BASS-II; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss040e088023) |
| `media/iss040e072900.jpg` | iss040e072900, BASS-II operations; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss040e072900) |
| `media/iss035e015900.jpg` | iss035e015900, BASS; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss035e015900) |
| `media/iss035e015679.jpg` | iss035e015679, BASS; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss035e015679) |
| `media/iss035e015827.jpg` | iss035e015827, BASS; downloaded 2026-11-14 | NASA | [Original record](https://images.nasa.gov/details/iss035e015827) |

Paths in this table are relative to `web/assets/nasa/`. The demo video is a recording of the app, so the NASA photographs visible in it are the app's own, among them the Mars and Earth textures.

## NASA video footage

The app's **Video cases** player streams two NASA videos from NASA's servers when playback is requested; the files are not redistributed in this repository (see [video cases](video-cases.md)). The demo video contains a short excerpt of the first one, as the row states.

| Video and actual use | Stable record | Required credit | Original URL |
|---|---|---|---|
| FLEX fuel-droplet combustion on the International Space Station; streamed by the app, and about three seconds of it (90 frames, without its soundtrack) appear in the demo video between 12.2 and 15.2 s, with the credit shown in the frame | Scientific Visualization Studio record 11318 | Science@NASA / NASA's Goddard Space Flight Center | [SVS 11318](https://svs.gsfc.nasa.gov/11318/) |
| Saffire-V, a ribbed Plexiglas sample burning; streamed by the app only | GRC-2021-CN-00008 | NASA Glenn Research Center | [Original record](https://images.nasa.gov/details/GRC-2021-CN-00008) |

The usage basis is the same NASA media guidance as for the photographs above. A credit is a source acknowledgement, not an endorsement.

## NASA visual references used during creation

The procedural ship's design bench cites two NASA Cygnus photographs as visual references, not as delivered vehicle textures: [iss058e011816](https://images.nasa.gov/details/iss058e011816), dated 2019-02-08, and [iss071e416851](https://images.nasa.gov/details/iss071e416851), dated 2024-08-06. The original NASA/JSC records were opened on 2026-11-14. Their use still belongs in the References field even though those image files are not redistributed. NASA media guidance applies; no separate per-record license text is bundled in this product repository.

## Video, build, validation and hosting tools

Tool executables are not redistributed as app runtime dependencies. Their licenses do not automatically become the license of rendered pixels or encoded audio. Unless a row says otherwise, versions are those of the machine that recorded and encoded the demo video on 2026-11-14.

| Resource and actual use | Observed version / limit | License or terms | License text in the public product repository | Primary URL |
|---|---|---|---|---|
| FFmpeg, encoding of the demo video and its audio, and loudness measurement | n9.0.2 on the recording machine | This installed build reports GPL-3.0-or-later via `ffmpeg -L`; upstream licensing depends on build options | **Not bundled** | [FFmpeg legal](https://ffmpeg.org/legal.html) |
| Playwright, recording of the live app for the demo video, and browser checks | 1.62.1 on the recording machine | Apache-2.0 | **Not bundled** | [Playwright license](https://github.com/microsoft/playwright/blob/main/LICENSE) |
| Google Chrome, the browser that ran the live app for the recording, driven through Playwright; Playwright's own Chrome for Testing build runs the other browser checks | Google Chrome 157.0.8103.50 for the recording; Chrome for Testing 151.0.7922.34 for the checks | Google Chrome terms for the browser binary; BSD-style Chromium license plus third-party notices for Chromium | **Not bundled** | [Chrome terms](https://www.google.com/chrome/terms/), [Chromium license](https://chromium.googlesource.com/chromium/src/+/main/LICENSE) |
| Node.js, source build, tests, custom JSON-RPC/MCP server and the demo recording script | Local build v24.16.0; v26.13.0 on the recording machine | MIT plus bundled dependency notices | **Not bundled** | [Node.js license](https://github.com/nodejs/node/blob/main/LICENSE) |
| Python, table normalization, quote checks, and the soundtrack synthesis and edit of the demo video | Local 3.9.6; 3.14.10 on the recording machine | PSF license and included historical licenses | **Not bundled** | [Python license](https://docs.python.org/3/license.html) |
| NumPy, synthesis of the demo video's original soundtrack | 2.5.4 on the recording machine | BSD-3-Clause and bundled notices | **Not bundled** | [NumPy license](https://github.com/numpy/numpy/blob/main/LICENSE.txt) |
| Pillow, deterministic watermark in the four scene JPEGs, and the captions of the demo video | Local 11.3.0 used for the watermark; 13.0.0 on the recording machine for the captions | MIT-CMU, verified in the Pillow 11.3.0 license; bundled font has its own terms | **Not bundled** | [Pillow license](https://github.com/python-pillow/Pillow/blob/main/LICENSE) |
| Aileron, Pillow's scalable default font used by the JPEG watermark | Bundled Aileron Regular 1.102 in local Pillow 11.3.0, read from its OpenType name table | No Rights Reserved, as stated by the font publisher; exact bundled-font metadata inspected | **Not bundled**; publisher terms are linked here | [Pillow font source](https://github.com/python-pillow/Pillow/blob/11.3.0/src/PIL/ImageFont.py), [publisher terms](https://dotcolon.net/fonts/aileron/) |
| Nimbus Sans, Regular and Bold, typeface of the demo video's captions; the letters are drawn into the frames and the font files are not redistributed | URW++ base 35 fonts as packaged in `gsfonts` 20200910 on the recording machine | AGPL-3.0-only with the PostScript/PDF font exception, as declared by that package | **Not bundled** | [URW++ base 35 fonts](https://github.com/ArtifexSoftware/urw-base35-fonts) |
| Model Context Protocol, interface specification; server is custom code, no MCP SDK dependency | Protocol fallback 2024-11-05 in `mcp/server.mjs`; no third-party SDK version | Current upstream license is transitioning from MIT to Apache-2.0; documentation excluding specifications is CC-BY-4.0. No SDK is redistributed; custom implementation covered by VESTA LICENSE | **No copied specification license text bundled** | [MCP specification](https://modelcontextprotocol.io/), [license](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/LICENSE) |
| GitHub Pages and Actions, static hosting and release workflow | `actions/checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`; service versions not exposed | GitHub service terms; the five referenced action repositories identify MIT licenses | **Not bundled** | [Pages](https://pages.github.com/), [GitHub terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), [Actions source](https://github.com/actions) |
| Claude by Anthropic, SI development/evidence/text assistance | Exact model versions not recorded for every session | Service terms applicable to the account; **account-specific output rights not independently verified** | **Not bundled** | [Claude](https://www.anthropic.com/claude), [terms](https://www.anthropic.com/legal/consumer-terms) |
| Codex by OpenAI, SI code/evidence/review assistance | Exact model versions not recorded for every session | Service terms applicable to the account; **account-specific output rights not independently verified** | **Not bundled** | [Codex](https://openai.com/codex/), [terms](https://openai.com/policies/terms-of-use/) |

The soundtrack source imports NumPy and synthesizes oscillators, seeded noise and delays; it uses no external music recording, voice or sample library. Procedural ships, robot geometry, flames and shaders are VESTA artwork made with SI-assisted code, not NASA vehicle photographs. Private visual reference records are not claimed as delivered textures. No new runtime dependency was added for the provenance manifest or live app watermark.

An earlier demo film, public until 2026-11-14, used the Clash Display typeface, GSAP, SciPy and background clips generated with Grok Imagine (xAI). The recording described in this inventory replaced it, and none of those resources is part of the current product.

## Remaining resource gaps

- NASA and partner rights are not universally established by an image credit. PSI CC0 labels are retained from the local records, with the live-check limitation above. NASA report/source licenses require record-specific review where third-party material is present.
- Most build-only tool licenses are identified here by name and primary URL but their full text is not bundled. No tool or service is described as OSI licensed unless that applies to it.
- The reference fields of the project form hold at most 25 links each. This inventory, the [NASA image credits](../web/assets/nasa/CREDITS.md) and the source register `web/data/sources.json` are the complete lists.
