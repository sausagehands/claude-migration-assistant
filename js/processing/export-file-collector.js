// js/processing/export-file-collector.js
// Turns whatever the user dropped (export ZIPs, loose JSON files, or a whole unzipped
// folder) into a flat list of lazily-readable entries for export-reader.js.
// Depends on: window.JSZip (CDN script in index.html)
// Called by: ui/steps/step-a2.js
// IMPORTANT: entries are read lazily — conversations.json can be 70MB+, so never read
// anything the reader does not ask for.

const READABLE_EXTENSIONS = ['.json', '.html'];

// WHY: a folder that holds both "projects-000.zip" and its unzipped "projects/" copy would
// otherwise make us parse every file twice. Paths differ ("users.json" inside the zip vs
// "light_metadata-000/users.json" on disk), so the key is the meaningful tail + byte size.
// Size is included so separate shards (conversations-000 vs -001) never collapse together.
const ANCHOR_FOLDERS = ['artifacts', 'memories', 'projects'];

/**
 * @param {(File & { relativePath?: string })[]} files - from the dropzone
 * @param {(phase: string, percent: number) => void} [onProgress]
 * @returns {Promise<{ path: string, readText: () => Promise<string> }[]>}
 */
export async function collectExportEntries(files, onProgress = () => {}) {
  const entriesByKey = new Map();
  for (const [index, file] of files.entries()) {
    onProgress(`Opening ${file.name}...`, Math.round((index / files.length) * 20));
    const fileEntries = file.name.toLowerCase().endsWith('.zip')
      ? await listZipEntries(file)
      : listLooseFileEntry(file);
    for (const fileEntry of fileEntries) {
      const key = buildDedupeKey(fileEntry.path, fileEntry.size);
      if (!entriesByKey.has(key)) entriesByKey.set(key, fileEntry);
    }
  }
  return [...entriesByKey.values()];
}

async function listZipEntries(file) {
  if (!window.JSZip) {
    throw new Error('JSZip not loaded. Check your internet connection and reload the page.');
  }
  const zip = await JSZip.loadAsync(file);
  return Object.values(zip.files)
    .filter(zipEntry => !zipEntry.dir && isReadablePath(zipEntry.name))
    .map(zipEntry => ({
      path: zipEntry.name,
      // CONSTRAINT: JSZip exposes no public uncompressed-size getter; _data is the only source.
      size: zipEntry._data ? zipEntry._data.uncompressedSize : -1,
      readText: () => zipEntry.async('string')
    }));
}

function listLooseFileEntry(file) {
  const path = file.relativePath || file.webkitRelativePath || file.name;
  if (!isReadablePath(path)) return [];
  return [{ path, size: file.size, readText: () => file.text() }];
}

function isReadablePath(path) {
  const lowerPath = path.toLowerCase();
  return READABLE_EXTENSIONS.some(extension => lowerPath.endsWith(extension));
}

function buildDedupeKey(path, size) {
  const segments = path.split('/').filter(Boolean);
  const anchorIndex = segments.findLastIndex(segment => ANCHOR_FOLDERS.includes(segment));
  const meaningfulTail = anchorIndex >= 0 ? segments.slice(anchorIndex) : segments.slice(-1);
  return `${meaningfulTail.join('/')}:${size}`;
}
