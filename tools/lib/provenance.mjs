import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const SI_TOOLS = [
  { product: 'Claude', provider: 'Anthropic', use: ['SI-assisted code and documentation', 'source extraction and proposed evidence summaries, claims and rules', 'review and visual rendering code'], version: 'Model versions were not recorded for every session.' },
  { product: 'Codex', provider: 'OpenAI', use: ['SI-assisted code and documentation', 'source extraction, review and product implementation', 'compliance metadata and visual watermark code'], version: 'Model versions were not recorded for every session.' }
];

export const NASA_NOTICE = "NASA has not reviewed or endorsed VESTA's SI-assisted interpretations and is not responsible for their accuracy.";

const codePaths = ['web/js/**', 'web/css/**', 'web/index.html', 'web/demo/index.html', 'web/ui-demo.html', 'web/assets/favicon.svg', 'tools/**', 'mcp/**', 'pipeline/**', 'tests/**'];
const dataPaths = ['config/**', 'seed/**', 'data/**', 'research/evidence/**', 'web/data/**', 'web/api/v1/**', 'web/feed/ntrs.json'];
const sourceBoundary = {
  nasa: 'Verbatim NASA quote fields and original PSI raw table cells are NASA source content, not SI-generated evidence. Table transcriptions retain source-file and row references; this is not a claim that every exported file is byte-identical to a NASA download.',
  vesta: 'Claims, summaries, rules, titles, normalizations, inferred conditions, rankings, coverage labels and scripted telemetry/decisions are VESTA interpretations or processing authored with SI assistance. Quote gates verify text matching, not scientific correctness. Deterministic runtime computation does not call an SI model.',
  imagery: 'Original NASA photographs and mosaics retain their NASA/partner credits, not an SI-generation watermark. Shader flames, smoke, geometry and reconstructed lighting are SI-assisted VESTA illustrations, not NASA observations.',
  nasa_notice: NASA_NOTICE
};

const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const isSidecar = rel => /\.provenance\.json$/.test(rel);
const metadata = rel => ({
  schema: 'vesta.si-provenance/1', si_assisted: true,
  tools: SI_TOOLS.map(({ product, provider }) => ({ product, provider })),
  activity: /(?:tests|tables|sources|investigations|ntrs)/.test(rel) ? 'SI-assisted extraction, transcription, organization and deterministic normalization of attributed NASA sources; source values are not SI inventions.' : 'SI-assisted VESTA authorship and deterministic processing; attributed NASA quotations remain source text.',
  source_boundary: sourceBoundary,
  manifest: 'https://itzjk.github.io/vesta/data/si-provenance.json',
  descriptive_text: 'https://github.com/itzjk/vesta/blob/main/SI-PROVENANCE.md'
});

export function writeProvenance({ root, writer, generated_at }) {
  const web = path.join(root, 'web');
  const payloads = ['data', 'api/v1'].flatMap(dir => walk(path.join(web, dir)))
    .map(p => path.relative(web, p).split(path.sep).join('/'))
    .filter(rel => /\.(json|jsonl|csv)$/.test(rel) && !isSidecar(rel) && rel !== 'data/si-provenance.json');
  const files = [];
  for (const rel of payloads) {
    const provenance = metadata(rel);
    const unchangedShape = ['data/tests-raw.json', 'data/proof-cases.json'].includes(rel) || rel.startsWith('api/v1/officer/') || /\.(csv|jsonl)$/.test(rel);
    if (unchangedShape) {
      const sidecar = `${rel}.provenance.json`;
      writer.json(sidecar, { schema: 'vesta.data-sidecar/1', describes: path.posix.basename(rel), si_provenance: provenance });
      files.push({ path: rel, metadata: sidecar, embedded: false });
    } else {
      const value = JSON.parse(fs.readFileSync(path.join(web, rel), 'utf8'));
      if (Array.isArray(value)) throw new Error(`Provenance requires a sidecar for array: ${rel}`);
      writer.json(rel, { ...value, si_provenance: provenance });
      files.push({ path: rel, metadata: rel, embedded: true });
    }
  }
  const feed = 'feed/ntrs.json';
  if (fs.existsSync(path.join(web, feed))) {
    writer.json(`${feed}.provenance.json`, { schema: 'vesta.data-sidecar/1', describes: 'ntrs.json', si_provenance: metadata(feed) });
    files.push({ path: feed, metadata: `${feed}.provenance.json`, embedded: false });
  }
  const manifest = {
    schema: 'vesta.si-provenance/1', generated_at,
    declaration: 'VESTA code, authored text, data processing and original rendered visuals were created with Synthetic Intelligence (SI) assistance. NASA source quotations, raw PSI values and original NASA imagery are attributed source material, not SI-generated observations.',
    tools: SI_TOOLS, code_paths: codePaths, data_paths: dataPaths,
    path_scope: 'Repository-relative patterns describe SI-assisted work, not exclusive model authorship of every line. Third-party libraries and fonts retain their own authorship and licenses.',
    preserved_source_paths: ['research/raw/**', 'web/data/tests-raw.json', 'web/assets/nasa/**'],
    visual_paths: ['web/assets/scene/*.jpg', 'web/js/world/**', 'web/demo/vesta-demo.mp4'],
    source_boundary: sourceBoundary,
    descriptive_text: 'https://github.com/itzjk/vesta/blob/main/SI-PROVENANCE.md',
    third_party: 'https://github.com/itzjk/vesta/blob/main/docs/THIRD-PARTY.md',
    files
  };
  writer.json('data/si-provenance.json', manifest, true);
  const indexRel = 'api/v1/index.json';
  const indexPath = path.join(web, indexRel);
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  index.provenance = { manifest: '../../data/si-provenance.json', descriptive_text: manifest.descriptive_text, files };
  for (const entry of index.files ?? []) {
    const record = files.find(f => f.path === `api/v1/${entry.path}`);
    if (record) entry.si_provenance = record.embedded ? { field: 'si_provenance' } : { metadata: path.posix.relative('api/v1', record.metadata) };
  }
  writer.json(indexRel, index);
  console.log(`provenance: ${files.length} published payloads acknowledged (${files.filter(f => f.embedded).length} embedded, ${files.filter(f => !f.embedded).length} sidecars); NASA source values preserved`);
}

export function watermarkScene(root) {
  const script = `from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys
for p in sorted((Path(sys.argv[1]) / 'web/assets/scene').glob('*.jpg')):
    with Image.open(p) as source:
        exif = source.getexif()
        if exif.get(270) == 'VESTA: SI-assisted visuals':
            print(str(p.name) + ': already marked')
            continue
        image = source.convert('RGB')
    width, height = image.size
    size = max(14, min(22, round(width / 64)))
    font = ImageFont.load_default(size=size)
    text = 'SI-assisted visuals'
    draw = ImageDraw.Draw(image)
    box = draw.textbbox((0, 0), text, font=font)
    pad, margin = 8, 10
    label_width, label_height = box[2] - box[0], box[3] - box[1]
    x, y = width - margin - label_width - 2 * pad, height - margin - label_height - 2 * pad
    draw.rectangle((x, y, width - margin, height - margin), fill=(8, 10, 12))
    draw.text((x + pad - box[0], y + pad - box[1]), text, font=font, fill=(237, 228, 212))
    exif[270] = 'VESTA: SI-assisted visuals'
    image.save(p, quality=95, subsampling=0, exif=exif)
    print(str(p.name) + ': visible pixels marked, ' + str(width) + 'x' + str(height))
`;
  const result = spawnSync('python3', ['-c', script, root], { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--watermark-scene') throw new Error('Usage: node tools/lib/provenance.mjs --watermark-scene');
  watermarkScene(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
}
