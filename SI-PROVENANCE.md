# Synthetic Intelligence provenance

VESTA was developed with Synthetic Intelligence (SI) assistance. This declaration describes assistance, not exclusive model authorship of every line, scientific validation, or a claim that NASA generated VESTA's interpretations. It does not establish the origin of the team's idea or resolve hackathon timing eligibility.

## Tools and uses

| SI product | Provider | Actual use | Scope and version limits |
|---|---|---|---|
| Claude | Anthropic | Assisted code, documentation, source extraction, proposed claims, summaries and rules, review and visual rendering code | Development and evidence preparation; exact model versions were not recorded for every session |
| Codex | OpenAI | Assisted code, documentation, source extraction, review, product implementation, compliance metadata and watermark code | Development and evidence preparation; exact model versions were not recorded for every session |
| Grok Imagine | xAI | Generated background clips | Current `web/demo/vesta-demo.mp4` only; service model version not recorded; not a generator of NASA evidence or app datasets |

The current demo's music and sound effects were synthesized from code authored with SI assistance, not from a NASA recording. The app includes real app screens and illustrations rendered through SI-assisted code. No model is called to generate decisions at runtime.

## Repository paths and authorship boundary

These repository-relative patterns cover SI-assisted work. Third-party libraries, fonts and source material keep their own authorship and licenses, listed in [THIRD-PARTY](docs/THIRD-PARTY.md).

- Code and interface: `web/js/**`, `web/css/**`, `web/index.html`, `web/demo/index.html`, `web/ui-demo.html`, `web/assets/favicon.svg`.
- Build, data preparation and interfaces: `tools/**`, `pipeline/**`, `mcp/**`, `tests/**`.
- Authored configuration, proposed interpretations and prepared data: `config/**`, `seed/**`, `data/**`, `research/evidence/**`.
- Published datasets and computed results: `web/data/**`, `web/api/v1/**`; the catalog in `web/feed/ntrs.json` is selected and organized from NASA NTRS records by SI-assisted code.
- Rendered artwork: `web/assets/scene/*.jpg`, procedural geometry, flames, smoke and lighting in `web/js/world/**`; the current demo's rendered visuals, background clips and synthesized soundtrack are also SI-assisted.

NASA quotations (`quote` and source quote fields), retained source texts in `research/raw/**`, and original PSI table cells in `web/data/tests-raw.json` are attributed NASA source content, not invented observations. PSI rows were transcribed into structured records with source file and row references. Raw cell values remain source values; normalization, classification, unit conversion, inferred conditions and other `n` fields are VESTA processing. This declaration does not claim that a normalized export is byte-identical to the NASA original.

Claims, titles, summaries, rules, coverage labels, scores, scripted scenarios and decisions are VESTA interpretations or deterministic computations authored with SI assistance. Quote matching checks copied text, not scientific validity. `si_written` and `si_summary` remain useful field-level labels but do not replace this whole-file declaration.

Original NASA/partner photographs and mosaics in `web/assets/nasa/**` are not SI-generated and have no SI-generation watermark added to their pixels. Their credits, original records, transformations and limitations remain in [NASA imagery credits](web/assets/nasa/CREDITS.md). Projecting those sources onto geometry or using them for reconstructed lighting does not turn VESTA's rendered scene into a NASA observation.

NASA has not reviewed or endorsed VESTA's SI-assisted interpretations and is not responsible for their accuracy.

## Published metadata and reproduction

`node tools/build.mjs` invokes `tools/lib/provenance.mjs` once after the evidence outputs are written. It publishes [the machine-readable manifest](web/data/si-provenance.json), `si_provenance` metadata on JSON document envelopes, and same-directory `.provenance.json` companions for CSV, JSONL, the raw-cell map and decision-log contracts. The API index links the manifest and each file's metadata. Existing CSV bytes, row values, quotation fields, schema identifiers, numeric thresholds and raw-cell map shape are preserved. Decision logs keep their exact computation contract; metadata is in a companion rather than adding a field that would break equality checks. The build return object is unchanged.

The feed has a provenance companion; refreshes of the feed should be followed by the source build. The app and demo HTML declare SI assistance in their `meta` tags. Original NASA asset metadata remains unchanged rather than being relabeled as SI-generated.

The visible app label reads **SI-assisted visuals**, including cinema and instrument views. Open it to read the NASA interpretation notice and the machine-readable manifest. The four JPEG scene exports have the same label burned into their pixels. After regenerating any of those images, run:

```sh
node tools/lib/provenance.mjs --watermark-scene
```

This lightweight watermark command requires Python 3 and Pillow with scalable default-font support. It touches only `web/assets/scene/*.jpg`; it never marks original NASA images. Existing marked JPEGs are skipped using their image-description metadata. New renders must not copy that marker metadata from a previous file without its marked pixels.
