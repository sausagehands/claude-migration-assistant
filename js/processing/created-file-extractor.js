// js/processing/created-file-extractor.js
// Rebuilds files Claude wrote with the create_file tool (and later edited with str_replace)
// so they can be saved alongside classic artifacts in the migration package.
// Depends on: artifact-file-naming.js
// Called by: ui/steps/step-a2.js
// IMPORTANT: newer chats produce files this way instead of through the "artifacts" tool.

import { buildArtifactFileName, shortHash } from './artifact-file-naming.js';

// WHY: /tmp holds throwaway scratch output; /mnt/user-data/outputs and /home/claude hold real work.
const SKIPPED_PATH_PREFIXES = ['/tmp/'];

/**
 * @param {object[]} conversations - output of parseConversations()
 * @returns {object[]} artifact-shaped records with extractionMethod "created-file"
 */
export function extractCreatedFiles(conversations) {
  const files = [];
  for (const conversation of conversations) {
    files.push(...replayFileToolCalls(conversation));
  }
  return files;
}

function replayFileToolCalls(conversation) {
  const filesByPath = new Map();
  for (const message of conversation.chat_messages) {
    if (message.sender !== 'assistant' || !message.content) continue;
    for (const item of message.content) {
      if (item.type !== 'tool_use' || !item.input) continue;
      if (item.name === 'create_file') recordCreatedFile(filesByPath, item.input, message, conversation);
      if (item.name === 'str_replace') applyStrReplace(filesByPath, item.input, message);
    }
  }
  return [...filesByPath.values()];
}

function recordCreatedFile(filesByPath, input, message, conversation) {
  const path = input.path || `/untitled-${filesByPath.size + 1}.txt`;
  if (SKIPPED_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) return;

  const baseName = path.split('/').pop();
  const extension = baseName.includes('.') ? baseName.split('.').pop().toLowerCase() : 'txt';
  const titleWithoutExtension = baseName.replace(/\.[^.]+$/, '');
  const uniqueKey = `${conversation.uuid}:${path}`;

  filesByPath.set(path, {
    id: `file-${conversation.uuid}-${shortHash(path)}`,
    title: baseName,
    type: 'file',
    language: null,
    content: input.file_text || '',
    sourcePath: path,
    sourceConversationId: conversation.uuid,
    sourceConversationName: conversation.name,
    timestamp: message.created_at,
    extractionMethod: 'created-file',
    extension,
    fileName: buildArtifactFileName(titleWithoutExtension, uniqueKey, extension)
  });
}

function applyStrReplace(filesByPath, input, message) {
  const file = filesByPath.get(input.path);
  if (!file || typeof input.old_str !== 'string' || input.old_str === '') return;
  // WHY: a function replacement is never parsed for $& / $` / $' patterns.
  file.content = file.content.replace(input.old_str, () => input.new_str || '');
  file.timestamp = message.created_at;
}
