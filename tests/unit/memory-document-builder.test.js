// tests/unit/memory-document-builder.test.js
// Behavior tests for turning an exported memory record into one readable markdown document.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemoryDocument } from '../../js/processing/memory-document-builder.js';

const projects = [{ uuid: 'proj-1', name: 'Website Rebuild' }];

test('returns null when the user has no exported memory', () => {
  assert.equal(buildMemoryDocument(null, projects), null);
});

test('includes the general conversation memory', () => {
  const doc = buildMemoryDocument({ conversations_memory: 'Works as a developer.' }, projects);
  assert.match(doc, /Works as a developer\./);
});

test('labels project memories with the project name instead of its ID', () => {
  const doc = buildMemoryDocument({ project_memories: { 'proj-1': 'Uses Astro.' } }, projects);
  assert.match(doc, /### Website Rebuild/);
  assert.match(doc, /Uses Astro\./);
});

test('falls back to the project ID when the project is not in the export', () => {
  const doc = buildMemoryDocument({ project_memories: { 'proj-9': 'Orphan note.' } }, projects);
  assert.match(doc, /proj-9/);
});

test('includes every memory file with its original path', () => {
  const doc = buildMemoryDocument({
    memory_files: [{ path: '/profile.md', content: 'Profile body' }]
  }, projects);
  assert.match(doc, /\/profile\.md/);
  assert.match(doc, /Profile body/);
});

test('accepts project memories stored as a JSON string', () => {
  const doc = buildMemoryDocument({ project_memories: JSON.stringify({ 'proj-1': 'Stringified.' }) }, projects);
  assert.match(doc, /Stringified\./);
});
