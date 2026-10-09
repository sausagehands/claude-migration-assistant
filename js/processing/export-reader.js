// js/processing/export-reader.js
// Turns a flat list of export file entries into users, conversations, memories, projects
// and published artifacts. Understands both the legacy single-file layout and the sharded
// 2026 layout (conversations-000.zip, memories/<account>.json, projects/<uuid>.json, ...).
// Depends on: nothing (pure; entries come from export-file-collector.js)
// Called by: ui/steps/step-a2.js
// IMPORTANT: login_history.json is deliberately ignored — it holds IP addresses we never need.

/** Thrown when the uploaded files are not a usable Claude export. */
export class ExportFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExportFormatError';
  }
}

/**
 * @typedef {{ path: string, readText: () => Promise<string> }} ExportEntry
 * @typedef {{ id: string, ownerUuid: string|null, title: string, description: string,
 *   createdAt: string, updatedAt: string, content: string }} PublishedArtifact
 * @typedef {{ users: object[], conversations: object[], memories: object[], projects: object[],
 *   publishedArtifacts: PublishedArtifact[], warnings: string[] }} ClaudeExport
 */

const JSON_RECORD_KINDS = ['conversations', 'users', 'memories', 'projects'];

// WHY: each kind has a different identity field; dedupe on it so a folder holding both
// the zips and their unzipped copies does not double every record.
const IDENTITY_FIELD = {
  conversations: 'uuid',
  users: 'uuid',
  memories: 'account_uuid',
  projects: 'uuid'
};

/**
 * Decides what kind of record a path holds, using only its trailing segments so any
 * enclosing folder name (e.g. "claude/" or "light_metadata-000/") is irrelevant.
 * @param {string} path
 * @returns {'conversations'|'users'|'memories'|'projects'|'artifactMeta'|'artifactVersion'|null}
 */
export function classifyExportPath(path) {
  const segments = path.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] || '';
  const parentName = segments[segments.length - 2] || '';

  if (segments[segments.length - 4] === 'artifacts' && parentName === 'versions' && fileName.endsWith('.html')) {
    return 'artifactVersion';
  }
  if (segments[segments.length - 3] === 'artifacts' && fileName === 'artifact.json') return 'artifactMeta';
  if (!fileName.endsWith('.json')) return null;

  const baseName = fileName.slice(0, -'.json'.length);
  if (JSON_RECORD_KINDS.includes(baseName)) return baseName;
  if (parentName === 'memories' || parentName === 'projects') return parentName;
  return null;
}

/**
 * @param {ExportEntry[]} entries
 * @param {(phase: string, percent: number) => void} [onProgress]
 * @returns {Promise<ClaudeExport>}
 */
export async function readClaudeExport(entries, onProgress = () => {}) {
  const grouped = groupEntriesByKind(entries);
  if (grouped.conversations.length === 0) {
    throw new ExportFormatError(
      'Could not find conversations.json. Drop the whole export folder, or all of the export ZIP files.'
    );
  }

  const result = { users: [], conversations: [], memories: [], projects: [], publishedArtifacts: [], warnings: [] };
  for (const [index, kind] of JSON_RECORD_KINDS.entries()) {
    onProgress(`Reading ${kind}...`, Math.round((index / JSON_RECORD_KINDS.length) * 60));
    const records = await readJsonRecords(grouped[kind]);
    result[kind] = dedupeByField(records, IDENTITY_FIELD[kind]);
  }

  onProgress('Reading published artifacts...', 65);
  result.publishedArtifacts = await readPublishedArtifacts(grouped.artifactMeta, grouped.artifactVersion);

  for (const kind of ['users', 'memories', 'projects']) {
    if (grouped[kind].length === 0) result.warnings.push(`No ${kind} found in the export.`);
  }
  onProgress('Done', 100);
  return result;
}

function groupEntriesByKind(entries) {
  const grouped = { conversations: [], users: [], memories: [], projects: [], artifactMeta: [], artifactVersion: [] };
  for (const exportEntry of entries) {
    const kind = classifyExportPath(exportEntry.path);
    if (kind) grouped[kind].push(exportEntry);
  }
  return grouped;
}

// CONTRACT: legacy files hold arrays; sharded per-record files hold a single object.
// Both are flattened into one array of records.
async function readJsonRecords(entries) {
  const records = [];
  for (const exportEntry of entries) {
    const parsed = await parseJsonEntry(exportEntry);
    if (Array.isArray(parsed)) records.push(...parsed);
    else if (parsed && typeof parsed === 'object') records.push(parsed);
  }
  return records;
}

async function parseJsonEntry(exportEntry) {
  const text = await exportEntry.readText();
  try {
    return JSON.parse(text);
  } catch (parseError) {
    throw new ExportFormatError(`Failed to parse ${exportEntry.path}: ${parseError.message}`);
  }
}

function dedupeByField(records, field) {
  const seen = new Map();
  const withoutIdentity = [];
  for (const record of records) {
    const identity = record && record[field];
    if (!identity) withoutIdentity.push(record);
    else if (!seen.has(identity)) seen.set(identity, record);
  }
  return [...seen.values(), ...withoutIdentity];
}

async function readPublishedArtifacts(metaEntries, versionEntries) {
  const versionsByKey = new Map(versionEntries.map(versionEntry => [artifactVersionKey(versionEntry.path), versionEntry]));
  const artifactsById = new Map();
  for (const metaEntry of metaEntries) {
    const meta = await parseJsonEntry(metaEntry);
    if (!meta || !meta.id || artifactsById.has(meta.id)) continue;
    const activeVersion = pickActiveVersion(meta);
    if (!activeVersion) continue;
    const versionEntry = versionsByKey.get(`${meta.id}/${activeVersion.id}`);
    artifactsById.set(meta.id, {
      id: meta.id,
      ownerUuid: meta.owner_account || null,
      title: activeVersion.title || 'Untitled',
      description: activeVersion.description || '',
      createdAt: activeVersion.created_at || '',
      updatedAt: meta.updated_at || activeVersion.created_at || '',
      content: versionEntry ? await versionEntry.readText() : ''
    });
  }
  return [...artifactsById.values()];
}

function artifactVersionKey(path) {
  const segments = path.split('/').filter(Boolean);
  const artifactId = segments[segments.length - 3];
  const versionId = segments[segments.length - 1].replace(/\.html$/, '');
  return `${artifactId}/${versionId}`;
}

function pickActiveVersion(meta) {
  const versions = Array.isArray(meta.versions) ? meta.versions : [];
  return versions.find(version => version.id === meta.active_version) || versions[0] || null;
}
