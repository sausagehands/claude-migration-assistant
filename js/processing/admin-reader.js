// js/processing/admin-reader.js
// Picks out one person's data from a read export: a user list for the admin picker,
// per-user filtering for team exports, and an "everything" selection for personal exports.
// Depends on: nothing (pure; input comes from export-reader.js readClaudeExport())
// Called by: ui/steps/step-a2.js

/**
 * @typedef {{ conversations: object[], memoryRecord: object|null, projects: object[],
 *   publishedArtifacts: object[] }} UserSelection
 */

/**
 * Builds a user list cross-referenced with conversation counts.
 * Creates [Departed User] entries for UUIDs found in conversations but not in users.json.
 * @param {object[]} users
 * @param {object[]} conversations
 * @returns {{ uuid: string, full_name: string, email_address: string, conversationCount: number }[]}
 */
export function buildUserList(users, conversations) {
  const countByUuid = new Map();
  for (const c of conversations) {
    const uuid = c.account?.uuid;
    if (!uuid) continue;
    countByUuid.set(uuid, (countByUuid.get(uuid) || 0) + 1);
  }

  const knownUuids = new Set(users.map(u => u.uuid));
  const result = [];

  for (const u of users) {
    result.push({
      uuid: u.uuid,
      full_name: u.full_name || 'Unknown',
      email_address: u.email_address || '',
      conversationCount: countByUuid.get(u.uuid) || 0
    });
  }

  for (const uuid of countByUuid.keys()) {
    if (!knownUuids.has(uuid)) {
      result.push({
        uuid,
        full_name: '[Departed User]',
        email_address: '',
        conversationCount: countByUuid.get(uuid)
      });
    }
  }

  result.sort((a, b) => b.conversationCount - a.conversationCount);
  return result;
}

/**
 * Filters a team export down to one user.
 * @param {import('./export-reader.js').ClaudeExport} exportData
 * @param {string} userUuid
 * @returns {UserSelection}
 */
export function filterByUser(exportData, userUuid) {
  return {
    conversations: exportData.conversations.filter(c => c.account?.uuid === userUuid),
    memoryRecord: exportData.memories.find(m => m.account_uuid === userUuid) || null,
    projects: exportData.projects.filter(p => p.creator && p.creator.uuid === userUuid),
    publishedArtifacts: exportData.publishedArtifacts.filter(a => a.ownerUuid === userUuid)
  };
}

/**
 * Takes everything in a personal export — it only ever holds one account.
 * @param {import('./export-reader.js').ClaudeExport} exportData
 * @returns {UserSelection}
 */
export function selectEntireExport(exportData) {
  return {
    conversations: exportData.conversations,
    memoryRecord: exportData.memories[0] || null,
    projects: exportData.projects,
    publishedArtifacts: exportData.publishedArtifacts
  };
}
