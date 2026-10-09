// js/ui/steps/step-a2-processing.js
// Runs one user's selection through parsing, artifact extraction and document generation,
// then stores the results in app state. Shared by personal and admin upload flows.
// Depends on: processing/* modules, state.js
// Called by: ui/steps/step-a2.js
// IMPORTANT: writes to state — call only after the user has picked whose data to process.

import { updateStep, setExportData } from '../../state.js';
import { parseConversations, buildConversationIndex } from '../../processing/conversation-parser.js';
import { extractArtifacts, buildArtifactIndex } from '../../processing/artifact-extractor.js';
import { extractCreatedFiles } from '../../processing/created-file-extractor.js';
import { convertPublishedArtifacts } from '../../processing/published-artifact-converter.js';
import { generateContextDocument } from '../../processing/context-generator.js';
import { generateMemoryScript } from '../../processing/memory-generator.js';
import { buildMemoryDocument } from '../../processing/memory-document-builder.js';

/**
 * @param {import('../../processing/admin-reader.js').UserSelection} selection
 * @param {{ update: (phase: string, percent: number) => void }} progressIndicator
 * @returns {Promise<void>}
 */
export async function processAndStoreUserSelection(selection, progressIndicator) {
  progressIndicator.update('Parsing conversations...', 40);
  await yieldToBrowser();
  const conversations = parseConversations(selection.conversations);

  progressIndicator.update('Extracting artifacts and files...', 55);
  await yieldToBrowser();
  const artifacts = [
    ...extractArtifacts(conversations),
    ...extractCreatedFiles(conversations),
    ...convertPublishedArtifacts(selection.publishedArtifacts)
  ];

  progressIndicator.update('Generating context document...', 70);
  await yieldToBrowser();
  const contextDocument = generateContextDocument(conversations);

  progressIndicator.update('Generating memory documents...', 85);
  await yieldToBrowser();
  const memoryScript = generateMemoryScript(conversations);
  const memoryDocument = buildMemoryDocument(selection.memoryRecord, selection.projects);

  setExportData('conversations', conversations);
  setExportData('conversationIndex', buildConversationIndex(conversations));
  setExportData('artifacts', artifacts);
  setExportData('artifactIndex', buildArtifactIndex(artifacts));
  setExportData('contextDocument', contextDocument);
  setExportData('memoryScript', memoryScript);
  setExportData('userMemory', memoryDocument);
  setExportData('userProjects', selection.projects);

  updateStep('a2', {
    completed: true,
    stats: {
      conversationCount: conversations.length,
      messageCount: conversations.reduce((count, conversation) => count + conversation.chat_messages.length, 0),
      artifactCount: artifacts.length
    }
  });
}

// WHY: lets the progress bar repaint between heavy synchronous steps.
function yieldToBrowser() {
  return new Promise(resolve => setTimeout(resolve, 10));
}
