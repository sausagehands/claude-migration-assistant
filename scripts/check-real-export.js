// scripts/check-real-export.js
// Runs an unzipped Claude export folder through the processing pipeline in Node (no browser,
// no JSZip) and prints counts, so format changes can be checked against real data quickly.
// Usage: node scripts/check-real-export.js /path/to/unzipped-export-folder
// IMPORTANT: prints only counts and headings — never conversation or memory contents.

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.argv[2];
if (!dataDir) { console.error("Usage: node scripts/check-real-export.js <export-folder>"); process.exit(1); }
const { readClaudeExport } = await import(join(repo, 'js/processing/export-reader.js'));
const { selectEntireExport, buildUserList } = await import(join(repo, 'js/processing/admin-reader.js'));
const { parseConversations } = await import(join(repo, 'js/processing/conversation-parser.js'));
const { extractArtifacts } = await import(join(repo, 'js/processing/artifact-extractor.js'));
const { extractCreatedFiles } = await import(join(repo, 'js/processing/created-file-extractor.js'));
const { convertPublishedArtifacts } = await import(join(repo, 'js/processing/published-artifact-converter.js'));
const { buildMemoryDocument } = await import(join(repo, 'js/processing/memory-document-builder.js'));
const { generateContextDocument } = await import(join(repo, 'js/processing/context-generator.js'));
const { generateMemoryScript } = await import(join(repo, 'js/processing/memory-generator.js'));
async function walk(dir) { const out = []; for (const d of await readdir(dir, { withFileTypes: true })) { const p = join(dir, d.name); if (d.isDirectory()) out.push(...await walk(p)); else out.push(p); } return out; }
const entries = (await walk(dataDir)).filter(p => /\.(json|html)$/.test(p)).map(p => ({ path: relative(dataDir, p), readText: () => readFile(p, 'utf8') }));
const data = await readClaudeExport(entries);
console.log('warnings', data.warnings);
console.log('counts', { users: data.users.length, conv: data.conversations.length, mem: data.memories.length, proj: data.projects.length, pub: data.publishedArtifacts.length, pubWithContent: data.publishedArtifacts.filter(a => a.content).length });
console.log('userList', buildUserList(data.users, data.conversations).map(u => u.conversationCount));
const sel = selectEntireExport(data);
const convs = parseConversations(sel.conversations);
const arts = extractArtifacts(convs), files = extractCreatedFiles(convs), pubs = convertPublishedArtifacts(sel.publishedArtifacts);
const all = [...arts, ...files, ...pubs];
console.log('artifacts', arts.length, 'emptyArtifacts', arts.filter(a => !a.content).length, 'createdFiles', files.length, 'published', pubs.length);
console.log('duplicate fileNames', all.length - new Set(all.map(a => a.fileName)).size);
const doc = buildMemoryDocument(sel.memoryRecord, sel.projects);
console.log('memoryDoc chars', doc?.length, 'unnamed projects', (doc?.match(/### Project /g) || []).length);
console.log('context chars', generateContextDocument(convs).length, 'memoryScript chars', generateMemoryScript(convs).length);
