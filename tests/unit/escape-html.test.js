import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../../js/utils.js';

test('escapes the five HTML characters', () => {
  const out = escapeHtml(`<a href="x" title='y'>&</a>`);
  assert.equal(out, '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(/[<>"']/.test(out), false);
  assert.equal(/&(?!amp;|lt;|gt;|quot;|#39;)/.test(out), false);
});

test('does not double-escape', () => {
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('returns empty string for null and undefined', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('stringifies numbers', () => {
  assert.equal(escapeHtml(42), '42');
});

test('leaves ordinary text unchanged', () => {
  assert.equal(escapeHtml('Plain text 123'), 'Plain text 123');
});
