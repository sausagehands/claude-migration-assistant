/**
 * Builds the output migration-package ZIP from processed data.
 */

import { formatConversationAsMarkdown, formatSummary } from './markdown-formatter.js';
import { categorizeByAge, buildConversationIndex } from './conversation-parser.js';
import { buildArtifactIndex } from './artifact-extractor.js';
import { createNameDeduper } from './unique-file-names.js';

export async function buildMigrationPackage(state) {
  if (!window.JSZip) {
    throw new Error('JSZip not loaded');
  }

  const zip = new JSZip();
  const root = zip.folder('migration-package');
  const { conversations, artifacts, contextDocument, memoryScript, userProjects, userMemory } = state.exportData;

  if (!conversations || conversations.length === 0) {
    throw new Error('No conversations to package');
  }

  // 1. Summary
  const summary = formatSummary(conversations, artifacts || [], contextDocument || '');
  root.file('summary.md', summary);

  // 2. Conversations
  const convsFolder = root.folder('conversations');
  const convIndex = buildConversationIndex(conversations);
  convsFolder.file('index.json', JSON.stringify(convIndex, null, 2));

  const { recent, archive } = categorizeByAge(conversations);

  const recentFolder = convsFolder.folder('recent');
  const recentNames = createNameDeduper();
  for (const conv of recent) {
    const md = formatConversationAsMarkdown(conv);
    recentFolder.file(recentNames(safeFileName(conv.name), '.md'), md);
  }

  const archiveFolder = convsFolder.folder('archive');
  const archiveNames = createNameDeduper();
  for (const conv of archive) {
    const md = formatConversationAsMarkdown(conv);
    archiveFolder.file(archiveNames(safeFileName(conv.name), '.md'), md);
  }

  // 3. Artifacts
  if (artifacts && artifacts.length > 0) {
    const artFolder = root.folder('artifacts');
    const artNames = allocateArtifactNames(artifacts);
    const artIndex = buildDedupedArtifactIndex(artifacts);
    artFolder.file('index.json', JSON.stringify(artIndex, null, 2));

    artifacts.forEach((art, index) => {
      artFolder.file(artNames[index], art.content);
    });
  }

  // 4. Projects
  if (userProjects && userProjects.length > 0) {
    const projFolder = root.folder('projects');
    const projIndex = userProjects.map(p => ({
      name: p.name,
      description: p.description || '',
      docsCount: (p.docs || []).length
    }));
    projFolder.file('index.json', JSON.stringify(projIndex, null, 2));

    const projDirNames = createNameDeduper();
    for (const proj of userProjects) {
      const projDir = projFolder.folder(projDirNames(safeFileName(proj.name)));

      // Write project metadata as a readable markdown file
      let readme = `# ${proj.name}\n\n`;
      if (proj.description) readme += `${proj.description}\n\n`;
      if (proj.prompt_template) readme += `## Custom Instructions\n\n${proj.prompt_template}\n`;
      projDir.file('README.md', readme);

      // Write project docs
      const docNames = createNameDeduper();
      docNames('README', '.md');
      for (const doc of (proj.docs || [])) {
        const [rawBase, rawExt] = splitExtension(doc.filename || 'untitled');
        const docBase = safeFileName(rawBase);
        const docExt = safeExtension(rawExt);
        projDir.file(docNames(docBase, docExt), doc.content);
      }
    }
  }

  // 5. Context document
  if (contextDocument) {
    root.file('context-document.md', contextDocument);
  }

  // 6. Memory import script
  if (memoryScript) {
    root.file('memory-import-script.txt', memoryScript);
  }

  // 7. Claude's own memory, when the export included it
  if (userMemory) {
    root.file('memory-capture.md', userMemory);
  }

  // Generate ZIP blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return blob;
}

export function downloadBlob(blob, filename) {
  if (window.saveAs) {
    saveAs(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// WHY: index.json must name the file actually written, so the index is built from the
// allocated names rather than the raw fileName.
export function buildDedupedArtifactIndex(artifacts) {
  const names = allocateArtifactNames(artifacts);
  return buildArtifactIndex(artifacts.map((art, index) => ({ ...art, fileName: names[index] })));
}

// WHY: JSZip overwrites same-named entries silently, so every artifact name goes
// through a deduper. "index" is claimed first so an artifact cannot clobber index.json.
export function allocateArtifactNames(artifacts) {
  const artNames = createNameDeduper();
  artNames('index', '.json');
  return artifacts.map(art => {
    const [artBase, artExt] = splitExtension(art.fileName);
    return artNames(artBase, artExt);
  });
}

// Splits "notes.txt" into ["notes", ".txt"] so a dedupe suffix lands before the
// extension ("notes-2.txt") rather than after it.
function splitExtension(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0
    ? [fileName.slice(0, dotIndex), fileName.slice(dotIndex)]
    : [fileName, ''];
}

export function safeFileName(name) {
  return (name || 'untitled')
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'untitled';
}

// WHY: an extension from the export can carry path characters too ("x./../y").
export function safeExtension(extension) {
  const cleaned = extension.replace(/[^a-zA-Z0-9.]/g, '');
  return /^\.[a-zA-Z0-9]+$/.test(cleaned) ? cleaned.toLowerCase() : '';
}
