import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNameDeduper } from '../../js/processing/unique-file-names.js';

test('keeps the first claim on a name unchanged', () => {
  const name = createNameDeduper();
  assert.equal(name('my-chat', '.md'), 'my-chat.md');
});

test('gives every duplicate its own file name', () => {
  const name = createNameDeduper();
  const names = Array.from({ length: 16 }, () => name('untitled', '.md'));
  assert.equal(new Set(names).size, 16, 'all 16 "Untitled" conversations must survive');
  assert.deepEqual(names.slice(0, 3), ['untitled.md', 'untitled-2.md', 'untitled-3.md']);
});

test('does not hand out a suffixed name that a real file already took', () => {
  const name = createNameDeduper();
  assert.equal(name('notes', '.md'), 'notes.md');
  assert.equal(name('notes-2', '.md'), 'notes-2.md');
  assert.equal(name('notes', '.md'), 'notes-3.md');
});

test('ignores case when deciding what collides', () => {
  const name = createNameDeduper();
  assert.equal(name('Readme', '.md'), 'Readme.md');
  assert.equal(name('readme', '.md'), 'readme-2.md');
});

test('works without an extension, for folder names', () => {
  const name = createNameDeduper();
  assert.equal(name('project'), 'project');
  assert.equal(name('project'), 'project-2');
});

test('each deduper is independent, so sibling folders reuse names', () => {
  const recent = createNameDeduper();
  const archive = createNameDeduper();
  assert.equal(recent('untitled', '.md'), 'untitled.md');
  assert.equal(archive('untitled', '.md'), 'untitled.md');
});
