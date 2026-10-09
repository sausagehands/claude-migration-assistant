// js/processing/memory-document-builder.js
// Builds one markdown document from a user's exported memory record, so it can be
// reviewed in step B1 and pasted or uploaded into the new account.
// Depends on: nothing (pure)
// Called by: ui/steps/step-a2.js
// IMPORTANT: Newer exports split memory into conversations_memory, project_memories
// (keyed by project UUID) and memory_files; older exports only have conversations_memory.

/**
 * @param {{ conversations_memory?: string, project_memories?: object|string,
 *   memory_files?: {path: string, content: string}[] }|null} memoryRecord
 * @param {{ uuid: string, name: string }[]} projects - used to label project memories by name
 * @returns {string|null} markdown, or null when there is nothing to migrate
 */
export function buildMemoryDocument(memoryRecord, projects = []) {
  if (!memoryRecord) return null;

  const sections = [
    formatGeneralMemory(memoryRecord.conversations_memory),
    formatProjectMemories(parseMaybeJson(memoryRecord.project_memories), projects),
    formatMemoryFiles(parseMaybeJson(memoryRecord.memory_files))
  ].filter(Boolean);

  if (sections.length === 0) return null;
  return ['# Claude Memory Export', ...sections].join('\n\n') + '\n';
}

function formatGeneralMemory(text) {
  if (!text || !text.trim()) return null;
  return `## What Claude Remembers About You\n\n${text.trim()}`;
}

function formatProjectMemories(projectMemories, projects) {
  if (!projectMemories || typeof projectMemories !== 'object') return null;
  const projectNames = new Map(projects.map(project => [project.uuid, project.name]));
  const blocks = Object.entries(projectMemories)
    .filter(([, text]) => typeof text === 'string' && text.trim())
    .map(([projectUuid, text]) => `### ${projectNames.get(projectUuid) || `Project ${projectUuid}`}\n\n${text.trim()}`);
  if (blocks.length === 0) return null;
  return `## Project Memories\n\n${blocks.join('\n\n')}`;
}

function formatMemoryFiles(memoryFiles) {
  if (!Array.isArray(memoryFiles) || memoryFiles.length === 0) return null;
  const blocks = memoryFiles
    .filter(memoryFile => memoryFile && memoryFile.content)
    .map(memoryFile => `### \`${memoryFile.path}\`\n\n${memoryFile.content.trim()}`);
  if (blocks.length === 0) return null;
  return `## Memory Files\n\n${blocks.join('\n\n')}`;
}

// WHY: some exports serialize nested memory fields as JSON strings rather than objects.
function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (parseError) {
    console.warn('Skipping memory field that is neither an object nor valid JSON:', parseError.message);
    return null;
  }
}
