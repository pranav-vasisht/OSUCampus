import { useRef, useMemo, useState, useEffect } from 'react';

function curveBetween(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  return `M ${x1} ${y1} C ${x1 + dx / 1.5} ${y1}, ${x2 - dx / 1.5} ${y2}, ${x2} ${y2}`;
}

const TreeNode = ({ nodeId, nodes, activePathIds, activeNodeId, onSelect, depth = 0 }) => {
  const node = nodes[nodeId];
  if (!node) return null;

  const inActivePath = activePathIds.has(nodeId);
  const isActiveNode = nodeId === activeNodeId;
  const isUser = node.role === 'user';
  const isTrunk = !node.parentId;
  const treeColor = node.treeColor;
  const colorClass = treeColor ? ` tree-color-${treeColor}` : '';

  const tooltip = `${isTrunk ? 'Initial prompt' : isUser ? 'User' : 'Campus'}: ${node.text.substring(0, 120)}${node.text.length > 120 ? '…' : ''}`;
  const snippet = node.text.replace(/\s+/g, ' ').trim();
  const shortLabel =
    snippet.length > 56 ? `${snippet.slice(0, 56)}…` : snippet;

  const promptDotClass = isUser ? 'tree-dot-prompt' : '';
  const trunkPromptDotClass = isTrunk && isUser ? 'tree-dot-prompt--trunk' : '';

  const promptRow = (
    <>
      <div
        className={`tree-dot ${promptDotClass} ${trunkPromptDotClass} ${inActivePath ? 'in-path' : ''} ${isActiveNode ? 'is-active-node' : ''} ${isUser ? 'user-dot' : 'model-dot'}${colorClass}`}
        onClick={() => onSelect(nodeId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(nodeId);
          }
        }}
        role="button"
        tabIndex={0}
        title={tooltip}
        data-node-id={nodeId}
      />
      <span
        className={`tree-node-label ${inActivePath ? 'in-path' : ''} ${isActiveNode ? 'is-active-node' : ''}`}
        onClick={() => onSelect(nodeId)}
        title={tooltip}
      >
        {shortLabel || '(empty)'}
      </span>
    </>
  );

  return (
    <div className={`tree-node-wrapper ${isTrunk ? 'is-trunk-node' : ''}`}>
      <div className={`tree-node-item ${isTrunk && !isUser ? 'is-trunk-row' : ''}`}>
        {isTrunk && !isUser ? (
          <div className="tree-trunk-stack">
            <span className="tree-trunk-badge">Initial prompt</span>
            <button
              type="button"
              className={`tree-trunk-card ${inActivePath ? 'in-path' : ''} ${isActiveNode ? 'is-active-node' : ''} trunk-model${colorClass}`}
              onClick={() => onSelect(nodeId)}
              title={tooltip}
              data-node-id={nodeId}
            >
              {shortLabel || '(empty)'}
            </button>
          </div>
        ) : (
          promptRow
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-children" data-tree-depth={depth + 1}>
          {node.children.map((childId) => (
            <TreeNode
              key={childId}
              nodeId={childId}
              nodes={nodes}
              activePathIds={activePathIds}
              activeNodeId={activeNodeId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function ChatTree({ nodes, activeNodeId, onSelectNode }) {
  const containerRef = useRef(null);
  const [linkPaths, setLinkPaths] = useState([]);

  const activePathIds = useMemo(() => {
    const ids = new Set();
    let cur = activeNodeId;
    while (cur && nodes[cur]) {
      ids.add(cur);
      cur = nodes[cur].parentId;
    }
    return ids;
  }, [nodes, activeNodeId]);

  const rootNodeIds = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n && !n.parentId)
        .map((n) => n.id),
    [nodes]
  );

  useEffect(() => {
    const calculateLinks = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const scrollTop = container.scrollTop;

      const anchor = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - containerRect.left + scrollLeft,
          y: r.top + r.height / 2 - containerRect.top + scrollTop,
        };
      };

      const paths = [];
      Object.values(nodes).forEach((node) => {
        if (!node.links || node.links.length === 0) return;
        const targetEl = container.querySelector(`[data-node-id="${node.id}"]`);
        if (!targetEl) return;
        const t = anchor(targetEl);
        node.links.forEach((linkId) => {
          const sourceEl = container.querySelector(`[data-node-id="${linkId}"]`);
          if (!sourceEl) return;
          const s = anchor(sourceEl);
          paths.push({
            id: `link-${node.id}-${linkId}`,
            d: curveBetween(s.x, s.y, t.x, t.y),
          });
        });
      });
      setLinkPaths(paths);
      const svg = container.querySelector('.chat-tree-svg');
      if (svg) {
        const w = Math.max(container.scrollWidth, container.clientWidth);
        const h = Math.max(container.scrollHeight, container.clientHeight);
        svg.setAttribute('width', String(w));
        svg.setAttribute('height', String(h));
      }
    };

    calculateLinks();
    const timer = setTimeout(calculateLinks, 50);
    window.addEventListener('resize', calculateLinks);
    const container = containerRef.current;
    container?.addEventListener('scroll', calculateLinks, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateLinks);
      container?.removeEventListener('scroll', calculateLinks);
    };
  }, [nodes]);

  const nodeCount = Object.keys(nodes).length;

  if (nodeCount === 0) {
    return (
      <div className="chat-tree-container">
        <div className="chat-tree-header">
          <span className="text-xs text-muted">Conversation Tree</span>
        </div>
        <div className="chat-tree-empty">
          <p>Send your first question in chat to create the trunk of this tree.</p>
          <p className="chat-tree-empty-sub">Later turns branch from whichever node you select.</p>
        </div>
      </div>
    );
  }

  if (rootNodeIds.length === 0) {
    return (
      <div className="chat-tree-container">
        <div className="chat-tree-header">
          <span className="text-xs text-muted">Conversation Tree</span>
        </div>
        <div className="chat-tree-empty">
          <p>No root messages found. Try reloading the page or starting a new chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-tree-container">
      <div className="chat-tree-header">
        <span className="text-xs text-muted">Conversation Tree</span>
        <p className="chat-tree-hint">
          The <strong>initial prompt</strong> is the parent. Select any node, then reply or use <strong>Branch</strong> to grow outward.
        </p>
      </div>
      <div className="chat-tree-scroll chat-tree-scroll--vertical-only" ref={containerRef}>
        <svg className="chat-tree-svg" aria-hidden="true">
          {linkPaths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="chat-tree-link-path"
            />
          ))}
        </svg>
        <div className="tree-forest">
          {rootNodeIds.map((rootId) => (
            <TreeNode
              key={rootId}
              nodeId={rootId}
              nodes={nodes}
              activePathIds={activePathIds}
              activeNodeId={activeNodeId}
              onSelect={onSelectNode}
              depth={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
