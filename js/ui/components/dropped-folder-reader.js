// js/ui/components/dropped-folder-reader.js
// Expands a drag-and-drop payload that may contain folders into a flat list of Files,
// tagging each with `relativePath` so callers can tell "projects/x.json" from "x.json".
// Depends on: the browser File and Directory Entries API (webkitGetAsEntry)
// Called by: dropzone.js when created with { allowFolders: true }

/**
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<(File & { relativePath: string })[]>}
 */
export async function readDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  const rootEntries = items
    .map(item => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter(Boolean);

  // WHY: browsers without the entries API still give us plain files.
  if (rootEntries.length === 0) return Array.from(dataTransfer.files);

  const files = [];
  for (const entry of rootEntries) {
    await collectFilesFromEntry(entry, files);
  }
  return files;
}

async function collectFilesFromEntry(entry, files) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    file.relativePath = entry.fullPath.replace(/^\//, '');
    files.push(file);
    return;
  }
  if (entry.isDirectory) {
    for (const childEntry of await readAllDirectoryEntries(entry)) {
      await collectFilesFromEntry(childEntry, files);
    }
  }
}

// CONSTRAINT: readEntries() returns at most ~100 entries per call; keep calling until empty.
async function readAllDirectoryEntries(directoryEntry) {
  const reader = directoryEntry.createReader();
  const allEntries = [];
  let batch;
  do {
    batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    allEntries.push(...batch);
  } while (batch.length > 0);
  return allEntries;
}
