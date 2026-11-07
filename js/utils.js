// WHY: callers pass raw export JSON values, which can be null or a number; a throw here
// takes down a whole step render. Single quotes are escaped so the helper is safe in
// both attribute quoting styles.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
