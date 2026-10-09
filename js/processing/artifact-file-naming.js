// js/processing/artifact-file-naming.js
// Picks file extensions and safe, collision-resistant file names for extracted artifacts.
// Depends on: nothing (pure)
// Called by: artifact-extractor.js, created-file-extractor.js, published-artifact-converter.js

const TYPE_TO_EXT = {
  'application/vnd.ant.react': 'jsx',
  'application/vnd.ant.code': null,  // Use language field
  'text/html': 'html',
  'text/css': 'css',
  'text/javascript': 'js',
  'text/x-python': 'py',
  'text/python': 'py',
  'text/markdown': 'md',
  'text/plain': 'txt',
  'image/svg+xml': 'svg',
  'application/vnd.ant.mermaid': 'mmd',
  'application/json': 'json',
};

const LANG_TO_EXT = {
  'python': 'py',
  'javascript': 'js',
  'typescript': 'ts',
  'jsx': 'jsx',
  'tsx': 'tsx',
  'html': 'html',
  'css': 'css',
  'sql': 'sql',
  'bash': 'sh',
  'shell': 'sh',
  'ruby': 'rb',
  'go': 'go',
  'rust': 'rs',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'c++': 'cpp',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'toml': 'toml',
  'xml': 'xml',
  'markdown': 'md',
  'swift': 'swift',
  'kotlin': 'kt',
};

/**
 * @param {string} type - artifact MIME-like type
 * @param {string|null} language
 * @returns {string} extension without the dot
 */
export function getExtension(type, language) {
  const fromType = TYPE_TO_EXT[type];
  if (fromType) return fromType;

  if (language) {
    const lang = language.toLowerCase();
    if (LANG_TO_EXT[lang]) return LANG_TO_EXT[lang];
    // Language itself might be a valid extension
    if (lang.length <= 5 && /^[a-z]+$/.test(lang)) return lang;
  }

  return 'txt';
}

/**
 * @param {string} title
 * @param {string} uniqueKey - mixed into the name so different artifacts never collide
 * @param {string} extension
 * @returns {string}
 */
export function buildArtifactFileName(title, uniqueKey, extension) {
  return `${slugify(title)}-${shortHash(uniqueKey)}.${extension}`;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'untitled';
}

/**
 * WHY: IDs like "conv-uuid + path" share long prefixes, so slicing them would collide;
 * a djb2 hash spreads them out while staying deterministic across runs.
 * @param {string} key
 * @returns {string} 6 hex characters
 */
export function shortHash(key) {
  let hash = 5381;
  for (let index = 0; index < key.length; index++) {
    hash = ((hash << 5) + hash + key.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(0, 6);
}
