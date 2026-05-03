/**
 * Mind map tree → chat context: parent lineage + prior siblings on the path.
 */

/**
 * @param {object} root
 * @param {string} pathStr - e.g. "0", "0-1", "0-1-2" (root is always "0")
 * @returns {{ label: string, prompt: string, parentPath: Array<{label: string, prompt: string}>, priorSiblingTopics: Array<{label: string, prompt: string}> } | null}
 */
export function buildMindMapClickPayload(root, pathStr) {
  if (!root || typeof pathStr !== 'string') return null;

  const parts = pathStr.split('-').map(Number);
  const childIndices = parts.slice(1);

  if (childIndices.length === 0) {
    return {
      label: root.label,
      prompt:
        root.prompt ||
        `Explain the central topic "${root.label}" in depth using the sources. Connect major themes.`,
      parentPath: [],
      priorSiblingTopics: [],
    };
  }

  const parentPath = [{ label: root.label, prompt: root.prompt || root.label }];
  let cur = root;
  const priorSiblingTopics = [];

  for (let i = 0; i < childIndices.length; i++) {
    const idx = childIndices[i];
    const siblings = cur.children || [];
    for (let s = 0; s < idx; s++) {
      const sib = siblings[s];
      priorSiblingTopics.push({
        label: sib.label,
        prompt: sib.prompt || sib.label,
      });
    }
    const next = siblings[idx];
    if (!next) return null;
    cur = next;
    if (i < childIndices.length - 1) {
      parentPath.push({ label: cur.label, prompt: cur.prompt || cur.label });
    }
  }

  return {
    label: cur.label,
    prompt:
      cur.prompt ||
      `Define and explain "${cur.label}" using the sources, in light of the topic path above.`,
    parentPath,
    priorSiblingTopics,
  };
}

/**
 * User message sent when a mind map node is clicked.
 */
export function formatMindMapUserMessage(payload) {
  if (!payload) return '';

  const sections = [];

  if (payload.parentPath.length > 0) {
    const pathLine = payload.parentPath.map((p) => p.label).join(' → ');
    const pathDetail = payload.parentPath
      .map((p) => `- **${p.label}:** ${p.prompt}`)
      .join('\n');
    sections.push(
      `## Topic path (hierarchical context — build on these parents)\n${pathLine}\n\n${pathDetail}`
    );
  }

  if (payload.priorSiblingTopics.length > 0) {
    const earlier = payload.priorSiblingTopics
      .map((p) => `- **${p.label}:** ${p.prompt}`)
      .join('\n');
    sections.push(
      `## Earlier subtopics on this branch (covered before this node — stay consistent)\n${earlier}`
    );
  }

  sections.push(`## Focus for this node\n**${payload.label}**\n\n${payload.prompt}`);

  return sections.join('\n\n');
}
