import { useState, useEffect, useRef, useMemo } from 'react';

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

  return (
    <div className={`tree-node-wrapper ${isTrunk ? 'is-trunk-node' : ''}`}>
      <div className={`tree-node-item ${isTrunk ? 'is-trunk-row' : ''}`}>
        {isTrunk ? (
          <div className="tree-trunk-stack">
            <span className="tree-trunk-badge">Initial prompt</span>
            <button
              type="button"
              className={`tree-trunk-card ${inActivePath ? 'in-path' : ''} ${isActiveNode ? 'is-active-node' : ''} ${isUser ? 'trunk-user' : 'trunk-model'}${colorClass}`}
              onClick={() => onSelect(nodeId)}
              title={tooltip}
              data-node-id={nodeId}
            >
              {shortLabel || '(empty)'}
            </button>
          </div>
        ) : (
          <>
            <div
              className={`tree-dot ${inActivePath ? 'in-path' : ''} ${isActiveNode ? 'is-active-node' : ''} ${isUser ? 'user-dot' : 'model-dot'}${colorClass}`}
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
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-children">
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
  const [svgPaths, setSvgPaths] = useState([]);

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
    const calculatePaths = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;

      const linkPaths = [];
      const branchPaths = [];

      const anchor = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - containerRect.left + scrollLeft,
          y: r.top + r.height / 2 - containerRect.top + scrollTop,
        };
      };

      Object.values(nodes).forEach((node) => {
        if (node.links && node.links.length > 0) {
          const targetEl = containerRef.current.querySelector(`[data-node-id="${node.id}"]`);
          if (!targetEl) return;
          const t = anchor(targetEl);

          node.links.forEach((linkId) => {
            const sourceEl = containerRef.current.querySelector(`[data-node-id="${linkId}"]`);
            if (!sourceEl) return;
            const s = anchor(sourceEl);
            linkPaths.push({
              id: `link-${node.id}-${linkId}`,
              d: curveBetween(s.x, s.y, t.x, t.y),
              dashed: true,
            });
          });
        }
      });

      Object.values(nodes).forEach((node) => {
        if (!node.parentId || !nodes[node.parentId]) return;
        const parentEl = containerRef.current.querySelector(`[data-node-id="${node.parentId}"]`);
        const childEl = containerRef.current.querySelector(`[data-node-id="${node.id}"]`);
        if (!parentEl || !childEl) return;
        const p = anchor(parentEl);
        const c = anchor(childEl);
        branchPaths.push({
          id: `branch-${node.parentId}-${node.id}`,
          d: curveBetween(p.x, p.y, c.x, c.y),
          dashed: false,
        });
      });

      setSvgPaths([...branchPaths, ...linkPaths]);
    };

    calculatePaths();
    const timer = setTimeout(calculatePaths, 50);
    window.addEventListener('resize', calculatePaths);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePaths);
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
      <div className="chat-tree-scroll" ref={containerRef}>
        <svg className="chat-tree-svg" style={{ width: '100%', height: '100%' }}>
          {svgPaths.map((pathItem) => (
            <path
              key={pathItem.id}
              d={pathItem.d}
              fill="none"
              stroke={pathItem.dashed ? '#3b82f6' : 'rgba(255,255,255,0.28)'}
              strokeWidth={pathItem.dashed ? 2 : 1.75}
              strokeDasharray={pathItem.dashed ? '4 4' : '0'}
              className={pathItem.dashed ? 'chat-tree-link-path' : 'chat-tree-branch-path'}
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
