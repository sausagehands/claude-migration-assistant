// tests/unit/export-reader.test.js
// Behavior tests for reading both the legacy and the sharded (2026) Claude export layouts.
// Run with: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyExportPath, readClaudeExport } from '../../js/processing/export-reader.js';

const ACCOUNT_ID = 'acct-1';

function entry(path, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return { path, readText: async () => text };
}

const conversation = {
  uuid: 'conv-1', name: 'Hello', created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', account: { uuid: ACCOUNT_ID }, chat_messages: []
};

test('classifies sharded export paths by the kind of record they hold', () => {
  assert.equal(classifyExportPath('conversations.json'), 'conversations');
  assert.equal(classifyExportPath('light_metadata-000/users.json'), 'users');
  assert.equal(classifyExportPath('memories/acct-1.json'), 'memories');
  assert.equal(classifyExportPath('projects/proj-1.json'), 'projects');
  assert.equal(classifyExportPath('artifacts/art-1/artifact.json'), 'artifactMeta');
  assert.equal(classifyExportPath('artifacts/art-1/versions/v1.html'), 'artifactVersion');
});

test('ignores login history so IP addresses never enter the app', () => {
  assert.equal(classifyExportPath('light_metadata-000/login_history.json'), null);
});

test('reads per-file memories and projects from the sharded layout', async () => {
  const result = await readClaudeExport([
    entry('conversations.json', [conversation]),
    entry('users.json', [{ uuid: ACCOUNT_ID, full_name: 'Test User' }]),
    entry('memories/acct-1.json', { account_uuid: ACCOUNT_ID, conversations_memory: 'likes tea' }),
    entry('projects/proj-1.json', { uuid: 'proj-1', name: 'Alpha', docs: [] }),
    entry('projects/proj-2.json', { uuid: 'proj-2', name: 'Beta', docs: [] })
  ]);
  assert.equal(result.conversations.length, 1);
  assert.equal(result.users.length, 1);
  assert.equal(result.memories[0].conversations_memory, 'likes tea');
  assert.deepEqual(result.projects.map(p => p.name).sort(), ['Alpha', 'Beta']);
});

test('still reads the legacy layout where memories and projects are arrays', async () => {
  const result = await readClaudeExport([
    entry('conversations.json', [conversation]),
    entry('memories.json', [{ account_uuid: ACCOUNT_ID, conversations_memory: 'old memory' }]),
    entry('projects.json', [{ uuid: 'proj-1', name: 'Legacy', docs: [] }])
  ]);
  assert.equal(result.memories[0].conversations_memory, 'old memory');
  assert.equal(result.projects[0].name, 'Legacy');
});

test('keeps one copy of records that appear in both a zip and its unzipped folder', async () => {
  const result = await readClaudeExport([
    entry('conversations.json', [conversation]),
    entry('claude/conversations.json', [conversation]),
    entry('projects/proj-1.json', { uuid: 'proj-1', name: 'Alpha' }),
    entry('claude/projects/proj-1.json', { uuid: 'proj-1', name: 'Alpha' })
  ]);
  assert.equal(result.conversations.length, 1);
  assert.equal(result.projects.length, 1);
});

test('loads the active version of each published artifact', async () => {
  const meta = {
    id: 'art-1', owner_account: ACCOUNT_ID, active_version: 'v2', updated_at: '2026-02-01T00:00:00Z',
    versions: [
      { id: 'v2', title: 'Newest', created_at: '2026-02-01T00:00:00Z' },
      { id: 'v1', title: 'Oldest', created_at: '2026-01-01T00:00:00Z' }
    ]
  };
  const result = await readClaudeExport([
    entry('conversations.json', [conversation]),
    entry('artifacts/art-1/artifact.json', meta),
    entry('artifacts/art-1/versions/v1.html', '<p>old</p>'),
    entry('artifacts/art-1/versions/v2.html', '<p>new</p>')
  ]);
  assert.equal(result.publishedArtifacts.length, 1);
  assert.equal(result.publishedArtifacts[0].title, 'Newest');
  assert.equal(result.publishedArtifacts[0].content, '<p>new</p>');
  assert.equal(result.publishedArtifacts[0].ownerUuid, ACCOUNT_ID);
});

test('rejects an upload that has no conversations file', async () => {
  await assert.rejects(
    readClaudeExport([entry('users.json', [])]),
    { name: 'ExportFormatError' }
  );
});

test('names the broken file when a JSON file cannot be parsed', async () => {
  await assert.rejects(
    readClaudeExport([entry('conversations.json', '{not json')]),
    (error) => error.name === 'ExportFormatError' && error.message.includes('conversations.json')
  );
});
