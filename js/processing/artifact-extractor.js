// js/processing/artifact-extractor.js
// Extracts in-chat artifacts (the "artifacts" tool and legacy <antArtifact> tags) from
// parsed conversations, replaying create/update/rewrite commands to get final content.
// Depends on: artifact-file-naming.js
// Called by: ui/steps/step-a2.js, zip-writer.js (buildArtifactIndex)
// IMPORTANT: "update" commands carry only old_str/new_str — never treat them as full content.

import { getExtension, buildArtifactFileName } from './artifact-file-naming.js';

/**
 * @param {object[]} conversations - output of parseConversations()
 * @returns {object[]} artifacts with id, title, type, content, fileName, extractionMethod
 */
export function extractArtifacts(conversations) {
  const artifactMap = new Map();

  for (const conv of conversations) {
    for (const msg of conv.chat_messages) {
      if (msg.sender !== 'assistant') continue;
      extractFromContent(msg, conv, artifactMap);
      extractFromText(msg, conv, artifactMap);
    }
  }

  for (const artifact of artifactMap.values()) {
    artifact.extension = getExtension(artifact.type, artifact.language);
    artifact.fileName = buildArtifactFileName(artifact.title, artifact.id, artifact.extension);
  }
  return Array.from(artifactMap.values());
}

// WHY: messages are already sorted oldest-first, so applying commands in order
// reproduces the artifact as the user last saw it.
function extractFromContent(msg, conv, artifactMap) {
  if (!msg.content) return;

  for (const item of msg.content) {
    if (item.type !== 'tool_use' || item.name !== 'artifacts' || !item.input) continue;
    const input = item.input;
    const id = input.id || input.version_uuid || `gen-${Math.random().toString(36).slice(2, 10)}`;
    const existing = artifactMap.get(id);

    if (input.command === 'update' && existing) {
      existing.content = existing.content.replace(input.old_str || '', input.new_str || '');
      existing.timestamp = msg.created_at;
      continue;
    }

    artifactMap.set(id, {
      id,
      title: input.title || existing?.title || 'Untitled',
      type: input.type || existing?.type || 'text/plain',
      language: input.language || existing?.language || null,
      content: input.content || '',
      sourceConversationId: conv.uuid,
      sourceConversationName: conv.name,
      timestamp: msg.created_at,
      extractionMethod: 'structured'
    });
  }
}

function extractFromText(msg, conv, artifactMap) {
  if (!msg.text || !msg.text.includes('<antArtifact')) return;

  // Regex with lookaheads for attribute-order independence
  const regex = /<antArtifact\s+([^>]*)>([\s\S]*?)<\/antArtifact>/g;
  let match;

  while ((match = regex.exec(msg.text)) !== null) {
    const attrString = match[1];
    const identifier = extractAttr(attrString, 'identifier');

    // Only add if not already found via structured path
    if (!identifier || artifactMap.has(identifier)) continue;

    artifactMap.set(identifier, {
      id: identifier,
      title: extractAttr(attrString, 'title') || 'Untitled',
      type: extractAttr(attrString, 'type') || 'text/plain',
      language: extractAttr(attrString, 'language') || null,
      content: match[2].trim(),
      sourceConversationId: conv.uuid,
      sourceConversationName: conv.name,
      timestamp: msg.created_at,
      extractionMethod: 'regex'
    });
  }
}

function extractAttr(attrString, name) {
  const regex = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = attrString.match(regex);
  return match ? match[1] : null;
}

/**
 * @param {object[]} artifacts
 * @returns {object[]} metadata-only index (no content) for index.json
 */
export function buildArtifactIndex(artifacts) {
  return artifacts.map(a => ({
    id: a.id,
    title: a.title,
    type: a.type,
    language: a.language,
    fileName: a.fileName,
    sourceConversationId: a.sourceConversationId,
    sourceConversationName: a.sourceConversationName,
    extractionMethod: a.extractionMethod,
    contentLength: a.content.length
  }));
}
