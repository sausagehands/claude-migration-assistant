// js/processing/published-artifact-converter.js
// Converts published artifacts (the export's artifacts/<id>/ folders) into the same record
// shape as in-chat artifacts so the rest of the app can list and package them.
// Depends on: artifact-file-naming.js
// Called by: ui/steps/step-a2.js

import { buildArtifactFileName } from './artifact-file-naming.js';

/**
 * @param {{ id: string, title: string, description?: string, content: string,
 *   updatedAt?: string }[]} publishedArtifacts - from readClaudeExport()
 * @returns {object[]} artifact-shaped records with extractionMethod "published"
 */
export function convertPublishedArtifacts(publishedArtifacts) {
  return publishedArtifacts.map(published => ({
    id: published.id,
    title: published.title || 'Untitled',
    type: 'text/html',
    language: null,
    content: published.content || '',
    sourceConversationId: null,
    sourceConversationName: published.description || 'Published artifact',
    timestamp: published.updatedAt || '',
    extractionMethod: 'published',
    extension: 'html',
    fileName: buildArtifactFileName(published.title || 'untitled', published.id, 'html')
  }));
}
