import React, { useState, useEffect, useRef } from 'react';

const TreeNode = ({ nodeId, nodes, activePathIds, activeNodeId, onSelect }) => {
  const node = nodes[nodeId];
  if (!node) return null;
  
  const inActivePath = activePathIds.has(nodeId);
  const isActiveNode = nodeId === activeNodeId;
  const isUser = node.role === 'user';
  
  // Extract a short "topic" or snippet
  const tooltip = `${isUser ? 'User' : 'Campus'}: ${node.text.substring(0, 60)}${node.text.length > 60 ? '...' : ''}`;

  return (
    <div className="tree-node-wrapper">
      <div className="tree-node-item">
        <div 
          className={`tree-dot ${inActivePath ? 'in-path' : ''} ${isActiveNode ? 'is-active-node' : ''} ${isUser ? 'user-dot' : 'model-dot'}`}
          onClick={() => onSelect(nodeId)}
          title={tooltip}
          data-node-id={nodeId}
        />
      </div>
      {node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map(childId => (
            <TreeNode 
              key={childId} 
              nodeId={childId} 
              nodes={nodes} 
              activePathIds={activePathIds} 
              activeNodeId={activeNodeId}
              onSelect={onSelect} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function ChatTree({ nodes, activePath, activeNodeId, onSelectNode }) {
  const containerRef = useRef(null);
  const [svgPaths, setSvgPaths] = useState([]);

  // Find all root nodes (nodes with no parent)
  const rootNodeIds = Object.values(nodes)
    .filter(n => !n.parentId)
    .map(n => n.id);

  const activePathIds = new Set(activePath.map(n => n.id));

  useEffect(() => {
    const calculatePaths = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;
      
      const newPaths = [];

      Object.values(nodes).forEach(node => {
        if (node.links && node.links.length > 0) {
          const targetEl = containerRef.current.querySelector(`[data-node-id="${node.id}"]`);
          if (!targetEl) return;
          const targetRect = targetEl.getBoundingClientRect();
          
          node.links.forEach(linkId => {
            const sourceEl = containerRef.current.querySelector(`[data-node-id="${linkId}"]`);
            if (sourceEl) {
              const sourceRect = sourceEl.getBoundingClientRect();
              
              const x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left + scrollLeft;
              const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top + scrollTop;
              const x2 = targetRect.left + targetRect.width / 2 - containerRect.left + scrollLeft;
              const y2 = targetRect.top + targetRect.height / 2 - containerRect.top + scrollTop;

              // Add a slight bezier curve to make it look nicer than a straight line
              const dx = Math.abs(x2 - x1);
              const pathD = `M ${x1} ${y1} C ${x1 + dx/1.5} ${y1}, ${x2 - dx/1.5} ${y2}, ${x2} ${y2}`;

              newPaths.push({ id: `${node.id}-${linkId}`, d: pathD });
            }
          });
        }
      });
      setSvgPaths(newPaths);
    };

    // Calculate immediately, and on any resize
    calculatePaths();
    
    // Sometimes DOM renders slightly after, a small delay helps guarantee layout is done
    const timer = setTimeout(calculatePaths, 50);
    window.addEventListener('resize', calculatePaths);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePaths);
    };
  }, [nodes]);

  if (rootNodeIds.length === 0) return null;

  return (
    <div className="chat-tree-container">
      <div className="chat-tree-header">
        <span className="text-xs text-muted">Conversation Tree</span>
      </div>
      <div className="chat-tree-scroll" ref={containerRef}>
        <svg className="chat-tree-svg" style={{ width: '100%', height: '100%' }}>
          {svgPaths.map(path => (
            <path 
              key={path.id} 
              d={path.d} 
              fill="none" 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeDasharray="4,4" 
              className="chat-tree-link-path"
            />
          ))}
        </svg>
        {rootNodeIds.map(rootId => (
          <TreeNode 
            key={rootId} 
            nodeId={rootId} 
            nodes={nodes} 
            activePathIds={activePathIds} 
            activeNodeId={activeNodeId}
            onSelect={onSelectNode} 
          />
        ))}
      </div>
    </div>
  );
}
