const TITLES = {
  'SOLIDS-110': 'Few thin sheets are rated for exploration air.',
  'OPERATIONS-242': 'FM2 plans to test lunar flame spread.',
  'S-EXPL-01': 'Saffire samples burned in exploration air.',
  'SAFFIRE-095': 'The smoke threshold missed early warning in some tests.',
  'SAFFIRE-100': 'Low airflow cooled the sample before flow stopped.',
  'SOLIDS-036': 'The tested rods ignited more slowly near the oxygen limit.'
};

export function findingTitle(f) {
  const sentence = String(f.title ?? TITLES[f.id] ?? f.claim ?? '').trim();
  if (!sentence) throw new Error(`Finding ${f.id} has no human title or claim`);
  return /[.!?]$/.test(sentence) ? sentence : sentence + '.';
}
