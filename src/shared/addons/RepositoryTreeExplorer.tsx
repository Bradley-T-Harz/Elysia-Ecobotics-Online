import { useEffect, useMemo, useState } from "react";

export type RepositoryTreeEntry = {
  path: string;
  meta?: string;
};

type RepositoryTreeNode = {
  kind: "file" | "folder";
  name: string;
  path: string;
  entry?: RepositoryTreeEntry;
  children: RepositoryTreeNode[];
  fileCount: number;
};

type RepositoryTreeRow = {
  node: RepositoryTreeNode;
  depth: number;
};

const DEFAULT_VISIBLE_TREE_ROWS = 240;

function compareTreeNodes(left: RepositoryTreeNode, right: RepositoryTreeNode) {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
}

function buildRepositoryTree(entries: RepositoryTreeEntry[]) {
  const root: RepositoryTreeNode = { kind: "folder", name: "repository", path: "", children: [], fileCount: 0 };
  for (const entry of entries) {
    const normalized = entry.path.replace(/\\/g, "/").replace(/^\.\//, "");
    const parts = normalized.split("/").filter(Boolean);
    if (!parts.length) continue;
    let parent = root;
    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index];
      const nodePath = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;
      let node = parent.children.find((candidate) => candidate.name === name && candidate.kind === (isFile ? "file" : "folder"));
      if (!node) {
        node = { kind: isFile ? "file" : "folder", name, path: nodePath, entry: isFile ? entry : undefined, children: [], fileCount: isFile ? 1 : 0 };
        parent.children.push(node);
      }
      parent = node;
    }
  }

  function finalize(node: RepositoryTreeNode): number {
    node.children.sort(compareTreeNodes);
    if (node.kind === "file") return 1;
    node.fileCount = node.children.reduce((total, child) => total + finalize(child), 0);
    return node.fileCount;
  }
  finalize(root);
  return root.children;
}

function filterRepositoryTree(nodes: RepositoryTreeNode[], query: string): RepositoryTreeNode[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    if (node.kind === "file") return node.path.toLowerCase().includes(query) ? [node] : [];
    const children = filterRepositoryTree(node.children, query);
    if (!children.length && !node.path.toLowerCase().includes(query)) return [];
    return [{ ...node, children: children.length ? children : node.children }];
  });
}

function flattenRepositoryTree(nodes: RepositoryTreeNode[], expanded: Set<string>, expandAll: boolean, maximum: number) {
  const rows: RepositoryTreeRow[] = [];
  function visit(children: RepositoryTreeNode[], depth: number) {
    for (const node of children) {
      if (rows.length >= maximum) return;
      rows.push({ node, depth });
      if (node.kind === "folder" && (expandAll || expanded.has(node.path))) visit(node.children, depth + 1);
    }
  }
  visit(nodes, 1);
  return rows;
}

function ancestorPaths(path: string) {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

export default function RepositoryTreeExplorer({
  entries,
  activePath,
  onSelect,
  ariaLabel = "Repository explorer",
  maximumRows = DEFAULT_VISIBLE_TREE_ROWS
}: {
  entries: RepositoryTreeEntry[];
  activePath?: string;
  onSelect?: (path: string) => void;
  ariaLabel?: string;
  maximumRows?: number;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ancestorPaths(activePath ?? "")));
  const tree = useMemo(() => buildRepositoryTree(entries), [entries]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTree = useMemo(() => filterRepositoryTree(tree, normalizedQuery), [normalizedQuery, tree]);
  const rows = useMemo(() => flattenRepositoryTree(filteredTree, expanded, Boolean(normalizedQuery), maximumRows), [expanded, filteredTree, maximumRows, normalizedQuery]);

  useEffect(() => {
    if (!activePath) return;
    setExpanded((current) => new Set([...current, ...ancestorPaths(activePath)]));
  }, [activePath]);

  function toggleFolder(path: string) {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  return <div className="repository-tree-explorer">
    <label className="repository-tree-filter"><span>Filter repository</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="src/, README, schema..." /></label>
    <div className="repository-tree" role="tree" aria-label={ariaLabel}>
      {rows.map(({ node, depth }) => node.kind === "folder" ? <button
        type="button"
        role="treeitem"
        aria-level={depth}
        aria-expanded={normalizedQuery ? true : expanded.has(node.path)}
        className="repository-tree-row repository-tree-row--folder"
        key={`folder:${node.path}`}
        title={node.path}
        style={{ paddingInlineStart: `${0.45 + (depth - 1) * 0.9}rem` }}
        onClick={() => toggleFolder(node.path)}
      >
        <span className="repository-tree-row__disclosure" aria-hidden="true">{normalizedQuery || expanded.has(node.path) ? "▾" : "▸"}</span>
        <span className="repository-tree-row__name">{node.name}</span>
        <small>{node.fileCount}</small>
      </button> : onSelect ? <button
        type="button"
        role="treeitem"
        aria-level={depth}
        aria-selected={node.path === activePath}
        className={`repository-tree-row repository-tree-row--file${node.path === activePath ? " active" : ""}`}
        key={`file:${node.path}`}
        title={node.path}
        style={{ paddingInlineStart: `${0.45 + (depth - 1) * 0.9}rem` }}
        onClick={() => onSelect(node.path)}
      >
        <span className="repository-tree-row__file-mark" aria-hidden="true">·</span>
        <span className="repository-tree-row__name">{node.name}</span>
        {node.entry?.meta && <small>{node.entry.meta}</small>}
      </button> : <div
        role="treeitem"
        aria-level={depth}
        className="repository-tree-row repository-tree-row--file"
        key={`file:${node.path}`}
        title={node.path}
        style={{ paddingInlineStart: `${0.45 + (depth - 1) * 0.9}rem` }}
      >
        <span className="repository-tree-row__file-mark" aria-hidden="true">·</span>
        <span className="repository-tree-row__name">{node.name}</span>
        {node.entry?.meta && <small>{node.entry.meta}</small>}
      </div>)}
      {!rows.length && <p className="repository-tree-empty">No repository files match this filter.</p>}
    </div>
    {rows.length >= maximumRows && <p className="repository-tree-cap">Showing the first {maximumRows} visible tree rows. Collapse folders or refine the filter to inspect deeper.</p>}
  </div>;
}
