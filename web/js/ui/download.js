// Client-side exports: a Blob built from the same objects the screen shows (DESIGN.md 4.4).
/** download('pmma-prevention.csv', csvText, 'text/csv') */
export function download(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}
export const downloadJson = (filename, obj) => download(filename, JSON.stringify(obj, null, 2) + '\n', 'application/json');
export const downloadCsv = (filename, text) => download(filename, text, 'text/csv;charset=utf-8');
export const downloadText = (filename, text) => download(filename, text, 'text/plain;charset=utf-8');
