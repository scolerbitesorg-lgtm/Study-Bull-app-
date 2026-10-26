// Keep an open page in step with fresh data (Oct 26 2026).
// App.tsx keeps the open folder/page as a node object (activeCustomNode) plus its parents (folderStack).
// When a tile's content is downloaded again (admin saved, or a stale localStorage copy got replaced),
// adminNodes holds NEW objects — so every time data arrives we look the open page up again by id.
// If the page no longer exists, we fall back to its nearest parent that still exists.

const idOf = (n: any): string | null => (n && n.id != null && n.id !== '' ? String(n.id) : null);

/** path [root, …, node] from `root` to the node with this id (depth-first), or null */
function pathIn(root: any, id: string, seen = new Set<any>()): any[] | null {
  if (!root || typeof root !== 'object' || seen.has(root)) return null;
  seen.add(root);
  if (idOf(root) === id) return [root];
  const kids = Array.isArray(root.children) ? root.children : null;
  if (!kids) return null;
  for (const k of kids) {
    const p = pathIn(k, id, seen);
    if (p) return [root, ...p];
  }
  return null;
}

/** path from a top-level node down to the node with this id, or null */
function pathInForest(nodes: any[], id: string): any[] | null {
  for (const top of nodes || []) {
    if (idOf(top) === id) return [top];
  }
  for (const top of nodes || []) {
    const p = pathIn(top, id);
    if (p) return p;
  }
  return null;
}

export type NavFix = { node: any; folders: any[]; changed: boolean };

/**
 * Re-resolve an open page (node + its parent folders) against fresh data.
 * - The base of the trail (the home tile the user opened first) is found by id at any depth.
 * - The open page is looked up inside that base; if it moved, the trail follows its new place.
 * - If it is gone, the deepest parent that still exists becomes the open page.
 * Returns null when nothing can be resolved yet (tile not downloaded, or ids missing) — keep the old view.
 */
export function refreshNav(adminNodes: any[], node: any, folders: any[]): NavFix | null {
  if (!node || !Array.isArray(adminNodes) || adminNodes.length === 0) return null;
  if (!idOf(node) || node._virtual || node._pyq) return null; // a page built in code has nothing to look up
  const trail = [...(Array.isArray(folders) ? folders : []), node];
  const baseId = idOf(trail[0]);
  if (!baseId) return null;
  const basePath = pathInForest(adminNodes, baseId);
  if (!basePath) return null;
  const base = basePath[basePath.length - 1];
  // the tile's content is still downloading → the snapshot is the best we have for now
  if (!base || base._splitPending) return null;

  for (let i = trail.length - 1; i >= 0; i--) {
    const id = idOf(trail[i]);
    if (!id) continue; // virtual/id-less entry → try its parent
    const p = i === 0 ? [base] : pathIn(base, id);
    if (!p) continue;
    const fresh = p[p.length - 1];
    const freshFolders = p.slice(0, -1);
    const changed =
      fresh !== node ||
      freshFolders.length !== (folders || []).length ||
      freshFolders.some((f, k) => f !== folders[k]);
    return { node: fresh, folders: freshFolders, changed };
  }
  return null;
}
