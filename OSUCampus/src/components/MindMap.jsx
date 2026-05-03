import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, ZoomIn, ZoomOut, Maximize2, Network, ChevronsDown, ChevronsUp } from 'lucide-react';
import { buildMindMapClickPayload } from '../lib/mindMapContext';

// Collect paths up to a depth for initial expansion
function getInitialExpanded(node, maxDepth, path = '0', depth = 0) {
  const s = new Set();
  if (depth < maxDepth) {
    s.add(path);
    (node.children || []).forEach((c, i) => {
      getInitialExpanded(c, maxDepth, `${path}-${i}`, depth + 1).forEach(p => s.add(p));
    });
  }
  return s;
}

const COLORS = ['#D73F09','#e8652f','#f59e0b','#f5f5f5','#fb923c','#fbbf24'];

function TreeNode({ node, depth, expanded, onToggle, onNodeClickByPath, path }) {
  const id = path;
  const open = expanded.has(id);
  const has = node.children && node.children.length > 0;
  const color = COLORS[depth % COLORS.length];

  return (
    <div className="ht-wrap">
      <div
        className={`ht-label ${has ? 'has-children' : ''} ${has && open ? 'is-open' : ''}`}
        style={{ '--nc': color }}
      >
        {has && (
          <button
            className={`ht-toggle ${open ? 'open' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggle(id); }}
          >
            <ChevronRight size={14} />
          </button>
        )}
        <span
          className="ht-text"
          onClick={() => onNodeClickByPath && onNodeClickByPath(path)}
          title={`Click to ask about "${node.label}"`}
        >
          {node.label}
        </span>
      </div>

      {has && open && (
        <div className="ht-sub">
          {node.children.map((child, i) => (
            <TreeNode
              key={i}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onNodeClickByPath={onNodeClickByPath}
              path={`${id}-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MindMap({ data, onNodeClick, sourceCount }) {
  const onNodeClickByPath = useCallback(
    (pathStr) => {
      if (!onNodeClick) return;
      const payload = buildMindMapClickPayload(data, pathStr);
      if (payload) onNodeClick(payload);
    },
    [data, onNodeClick]
  );
  const [expanded, setExpanded] = useState(() => getInitialExpanded(data, 2));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const onToggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Collapse this and all descendants
        for (const key of prev) {
          if (key === id || key.startsWith(id + '-')) next.delete(key);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + scroll = zoom
      setZoom(z => Math.min(Math.max(z + (e.deltaY > 0 ? -0.08 : 0.08), 0.25), 2.5));
    } else {
      // Regular scroll = pan
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const move = (e) => {
      if (!dragging.current) return;
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const up = () => {
      dragging.current = false;
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const handleExpandAll = () => {
    const all = new Set();
    const walk = (n, p) => {
      all.add(p);
      (n.children || []).forEach((c, i) => walk(c, `${p}-${i}`));
    };
    walk(data, '0');
    setExpanded(all);
  };

  const handleCollapseAll = () => setExpanded(new Set(['0']));

  return (
    <div className="mm-panel">
      <div className="mm-panel-header">
        <Network size={18} />
        <h3>Mind Map</h3>
        {sourceCount > 0 && (
          <span className="mm-source-badge">Based on {sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div
        className="mm-canvas"
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: 'grab' }}
      >
        <div
          className="mm-canvas-inner"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <TreeNode
            node={data}
            depth={0}
            expanded={expanded}
            onToggle={onToggle}
            onNodeClickByPath={onNodeClickByPath}
            path="0"
          />
        </div>
      </div>

      <div className="mm-zoom-controls">
        <button onClick={handleExpandAll} title="Expand All"><ChevronsDown size={16} /></button>
        <button onClick={handleCollapseAll} title="Collapse All"><ChevronsUp size={16} /></button>
        <button onClick={() => setZoom(z => Math.min(z + 0.15, 2.5))} title="Zoom In"><ZoomIn size={16} /></button>
        <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.25))} title="Zoom Out"><ZoomOut size={16} /></button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Fit to Screen"><Maximize2 size={16} /></button>
      </div>
    </div>
  );
}
