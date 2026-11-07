// tests/unit/artifact-extraction.test.js
// Behavior tests for pulling artifacts and created files out of parsed conversations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArtifacts } from '../../js/processing/artifact-extractor.js';
import { extractCreatedFiles } from '../../js/processing/created-file-extractor.js';
import { convertPublishedArtifacts } from '../../js/processing/published-artifact-converter.js';

function conversationWith(toolCalls) {
  return {
    uuid: 'conv-abc123', name: 'Build things',
    chat_messages: toolCalls.map((input, index) => ({
      sender: 'assistant',
      created_at: `2026-01-01T00:00:0${index}Z`,
      text: '',
      content: [{ type: 'tool_use', name: input.toolName, input: input.toolInput }]
    }))
  };
}

test('applies artifact update commands to the earlier content instead of blanking it', () => {
  const conversation = conversationWith([
    { toolName: 'artifacts', toolInput: { command: 'create', id: 'a1', title: 'Page', type: 'text/html', content: '<h1>Hi</h1>' } },
    { toolName: 'artifacts', toolInput: { command: 'update', id: 'a1', old_str: 'Hi', new_str: 'Hello' } }
  ]);
  const [artifact] = extractArtifacts([conversation]);
  assert.equal(artifact.content, '<h1>Hello</h1>');
});

test('replaces artifact content on a rewrite command', () => {
  const conversation = conversationWith([
    { toolName: 'artifacts', toolInput: { command: 'create', id: 'a1', title: 'Page', type: 'text/html', content: 'one' } },
    { toolName: 'artifacts', toolInput: { command: 'rewrite', id: 'a1', content: 'two' } }
  ]);
  assert.equal(extractArtifacts([conversation])[0].content, 'two');
});

test('captures files Claude created with the create_file tool', () => {
  const conversation = conversationWith([
    { toolName: 'create_file', toolInput: { path: '/mnt/user-data/outputs/guide.md', file_text: '# Guide' } }
  ]);
  const [file] = extractCreatedFiles([conversation]);
  assert.equal(file.title, 'guide.md');
  assert.equal(file.content, '# Guide');
  assert.match(file.fileName, /\.md$/);
});

test('applies later str_replace edits to a created file', () => {
  const conversation = conversationWith([
    { toolName: 'create_file', toolInput: { path: '/home/claude/app.js', file_text: 'let a = 1;' } },
    { toolName: 'str_replace', toolInput: { path: '/home/claude/app.js', old_str: '1', new_str: '2' } }
  ]);
  assert.equal(extractCreatedFiles([conversation])[0].content, 'let a = 2;');
});

test('skips scratch files written to /tmp', () => {
  const conversation = conversationWith([
    { toolName: 'create_file', toolInput: { path: '/tmp/scratch.txt', file_text: 'x' } }
  ]);
  assert.equal(extractCreatedFiles([conversation]).length, 0);
});

test('gives same-named files in different folders different output names', () => {
  const conversation = conversationWith([
    { toolName: 'create_file', toolInput: { path: '/home/claude/site/index.js', file_text: 'a' } },
    { toolName: 'create_file', toolInput: { path: '/home/claude/site/src/index.js', file_text: 'b' } }
  ]);
  const names = extractCreatedFiles([conversation]).map(f => f.fileName);
  assert.equal(new Set(names).size, 2);
});

test('converts published artifacts into downloadable html files', () => {
  const [artifact] = convertPublishedArtifacts([
    { id: 'pub-1234', title: 'Design Directions', content: '<html></html>', updatedAt: '2026-02-01T00:00:00Z' }
  ]);
  assert.equal(artifact.extension, 'html');
  assert.equal(artifact.extractionMethod, 'published');
  assert.match(artifact.fileName, /^design-directions-.*\.html$/);
});

test('an update inserts dollar sequences literally', () => {
  const conversation = conversationWith([
    { toolName: 'artifacts', toolInput: { command: 'create', id: 'a1', title: 'T', type: 'text/plain', content: 'const b = 2;' } },
    { toolName: 'artifacts', toolInput: { command: 'update', id: 'a1', old_str: 'const b = 2;', new_str: 'x = `$&` $` $\' $1 $$' } }
  ]);
  const [artifact] = extractArtifacts([conversation]);
  assert.equal(artifact.content, 'x = `$&` $` $\' $1 $$');
});

test('a str_replace inserts dollar sequences literally', () => {
  const conversation = conversationWith([
    { toolName: 'create_file', toolInput: { path: '/home/claude/a.js', file_text: 'const a = 1;\nconst b = 2;' } },
    { toolName: 'str_replace', toolInput: { path: '/home/claude/a.js', old_str: 'const b = 2;', new_str: '$(\'.x\'); // $& $` $\'' } }
  ]);
  assert.equal(extractCreatedFiles([conversation])[0].content, 'const a = 1;\n$(\'.x\'); // $& $` $\'');
});

test('an update with no old_str is ignored', () => {
  const conversation = conversationWith([
    { toolName: 'artifacts', toolInput: { command: 'create', id: 'a1', title: 'T', type: 'text/plain', content: 'body' } },
    { toolName: 'artifacts', toolInput: { command: 'update', id: 'a1', new_str: 'PREFIX' } }
  ]);
  assert.equal(extractArtifacts([conversation])[0].content, 'body');
});

test('an update with an empty old_str is ignored', () => {
  const conversation = conversationWith([
    { toolName: 'artifacts', toolInput: { command: 'create', id: 'a1', title: 'T', type: 'text/plain', content: 'body' } },
    { toolName: 'artifacts', toolInput: { command: 'update', id: 'a1', old_str: '', new_str: 'PREFIX' } }
  ]);
  assert.equal(extractArtifacts([conversation])[0].content, 'body');
});

test('a str_replace with an empty old_str is ignored', () => {
  const conversation = conversationWith([
    { toolName: 'create_file', toolInput: { path: '/home/claude/a.txt', file_text: 'body' } },
    { toolName: 'str_replace', toolInput: { path: '/home/claude/a.txt', old_str: '', new_str: 'PREFIX' } }
  ]);
  assert.equal(extractCreatedFiles([conversation])[0].content, 'body');
});

const idlessCreate = (content) => ({ toolName: 'artifacts', toolInput: { command: 'create', title: 'Same', type: 'text/plain', content } });

test('artifact file names are stable across runs', () => {
  const build = () => conversationWith([idlessCreate('one'), idlessCreate('two')]);
  const first = extractArtifacts([build()]).map(a => a.fileName);
  const second = extractArtifacts([build()]).map(a => a.fileName);
  assert.deepEqual(first, second);
});

test('two artifacts without ids in one conversation do not collide', () => {
  const records = extractArtifacts([conversationWith([idlessCreate('one'), idlessCreate('two')])]);
  assert.equal(records.length, 2);
  assert.notEqual(records[0].fileName, records[1].fileName);
  assert.notEqual(records[0].id, records[1].id);
});

test('an id-less artifact in a message without a uuid still gets a stable, distinct id', () => {
  const conv = conversationWith([idlessCreate('one'), idlessCreate('two')]);
  conv.chat_messages.forEach(m => { m.uuid = ''; });
  const ids = extractArtifacts([conv]).map(a => a.id);
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(ids, extractArtifacts([conv]).map(a => a.id));
});

test('an id in the record still wins', () => {
  const [artifact] = extractArtifacts([conversationWith([
    { toolName: 'artifacts', toolInput: { command: 'create', id: 'my-id', title: 'Same', type: 'text/plain', content: 'x' } }
  ])]);
  assert.equal(artifact.id, 'my-id');
  assert.match(artifact.fileName, /^same-[0-9a-f]{6}\.txt$/);
});
