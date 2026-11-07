// js/processing/unique-file-names.js
// Hands out file names that stay unique inside one folder.
// Depends on: nothing (pure)
// Called by: processing/zip-writer.js
// WHY: JSZip silently overwrites an existing entry, so two conversations called
// "Untitled" used to collapse into one file and the rest were lost from the package.

/**
 * Makes a per-folder name allocator. Call the returned function once per file.
 * The first claim on a name keeps it; later ones get "-2", "-3", ... before the
 * extension, so unique names stay clean and readable.
 *
 * @returns {(baseName: string, extension?: string) => string}
 */
export function createNameDeduper() {
  const takenNames = new Set();
  return function uniqueName(baseName, extension = '') {
    let candidate = `${baseName}${extension}`;
    // WHY: a suffixed name can clash with a real file of that name ("untitled-2"),
    // so keep counting until the candidate is genuinely free.
    let suffix = 1;
    while (takenNames.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${baseName}-${suffix}${extension}`;
    }
    takenNames.add(candidate.toLowerCase());
    return candidate;
  };
}
