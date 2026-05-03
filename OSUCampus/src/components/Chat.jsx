import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Send, Bot, User, ChevronLeft, ChevronRight, Edit2, Link, X } from 'lucide-react';
import { NODE_COLORS } from '../lib/nodeColors';

export default function Chat({ nodes, activePath, activeNodeId, setActiveNodeId, onSendMessage, onAddLink, onRemoveLink, onSetNodeTreeColor, isLoading }) {
  const [input, setInput] = useState('');
  const [replyParentId, setReplyParentId] = useState(null);
  const [linkingSourceId, setLinkingSourceId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activePath, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim(), replyParentId || activeNodeId);
      setInput('');
      setReplyParentId(null);
    }
  };

  const getDeepestLeaf = (nodeId) => {
    let curr = nodes[nodeId];
    while (curr && curr.children && curr.children.length > 0) {
      curr = nodes[curr.children[curr.children.length - 1]];
    }
    return curr ? curr.id : nodeId;
  };

  const handleBranchChange = (nodeId, direction) => {
    const node = nodes[nodeId];
    if (!node || !node.parentId) return;
    const parent = nodes[node.parentId];
    if (!parent || !parent.children) return;
    
    const currentIndex = parent.children.indexOf(nodeId);
    let nextIndex = currentIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < parent.children.length) {
      const siblingId = parent.children[nextIndex];
      setActiveNodeId(getDeepestLeaf(siblingId));
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Campus</h1>
        <p>Ask questions based on your uploaded sources.</p>
      </div>

      <div className="messages-area">
        {(!activePath || activePath.length === 0) ? (
          <div className="welcome-message">
            <Bot size={48} className="welcome-icon" />
            <h2>Welcome to Campus!</h2>
            <p>Upload some sources in the sidebar and start asking questions.</p>
          </div>
        ) : (
          activePath.map((msg) => {
            const parent = msg.parentId ? nodes[msg.parentId] : null;
            const hasSiblings = parent && parent.children && parent.children.length > 1;
            const siblingIndex = parent ? parent.children.indexOf(msg.id) : 0;
            const totalSiblings = parent ? parent.children.length : 1;
            const tag = msg.treeColor;

            return (
              <div key={msg.id} className={`message-bubble ${msg.role}${tag ? ` message-tag-${tag}` : ''}`}>
                <div className="message-avatar">
                  {msg.role === 'model' ? <Bot size={20} /> : <User size={20} />}
                </div>
                <div className="message-content">
                  {msg.role === 'model' ? (
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                  
                  {msg.links && msg.links.length > 0 && (
                    <div className="message-links">
                      {msg.links.map(linkId => (
                        <span key={linkId} className="link-badge">
                          <span className="link-badge-label">
                            Reference: {nodes[linkId] ? nodes[linkId].text.substring(0, 20) + '...' : linkId}
                          </span>
                          <button
                            type="button"
                            className="link-badge-unlink"
                            title="Remove reference"
                            disabled={isLoading}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveLink(msg.id, linkId);
                            }}
                            aria-label="Remove reference link"
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="message-actions">
                    {hasSiblings && (
                      <div className="branch-controls">
                        <button 
                          disabled={siblingIndex === 0} 
                          onClick={() => handleBranchChange(msg.id, -1)}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span>{siblingIndex + 1} / {totalSiblings}</span>
                        <button 
                          disabled={siblingIndex === totalSiblings - 1} 
                          onClick={() => handleBranchChange(msg.id, 1)}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                    <div className="message-actions-right">
                      <div className="message-node-colors" role="group" aria-label="Color for tree">
                        {NODE_COLORS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`message-color-swatch swatch-${opt.id} ${tag === opt.id ? 'selected' : ''}`}
                            title={`${opt.label} in tree${tag === opt.id ? ' — click to clear' : ''}`}
                            aria-label={tag === opt.id ? `Clear ${opt.label} tag` : `Tag node ${opt.label}`}
                            aria-pressed={tag === opt.id}
                            disabled={isLoading}
                            onClick={() => onSetNodeTreeColor(msg.id, tag === opt.id ? null : opt.id)}
                          />
                        ))}
                      </div>
                      <button 
                        className="branch-btn"
                        onClick={() => {
                          if (linkingSourceId && linkingSourceId !== msg.id) {
                            onAddLink(linkingSourceId, msg.id);
                            setLinkingSourceId(null);
                          } else if (linkingSourceId === msg.id) {
                            setLinkingSourceId(null);
                          } else {
                            setLinkingSourceId(msg.id);
                          }
                        }}
                        title={linkingSourceId ? (linkingSourceId === msg.id ? "Cancel Linking" : "Inject Context") : "Link to another message"}
                      >
                        <Link size={12} /> {linkingSourceId ? (linkingSourceId === msg.id ? "Cancel" : "Inject Context") : "Link"}
                      </button>

                      {!linkingSourceId && (
                        <button 
                          className="branch-btn"
                          onClick={() => setReplyParentId(msg.id)}
                          title="Branch/Reply from here"
                        >
                          <Edit2 size={12} /> Branch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {isLoading && (
          <div className="message-bubble model">
            <div className="message-avatar">
              <Bot size={20} />
            </div>
            <div className="message-content loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-area-container" onSubmit={handleSubmit}>
        {linkingSourceId && (
          <div className="reply-indicator linking-banner">
            <span>Select a message above to inject as context into the selected message.</span>
            <button type="button" onClick={() => setLinkingSourceId(null)}>Cancel</button>
          </div>
        )}
        {replyParentId && (
          <div className="reply-indicator">
            <span>Branching from previous message</span>
            <button type="button" onClick={() => setReplyParentId(null)}>Cancel</button>
          </div>
        )}
        <div className="input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your sources..."
            disabled={isLoading}
          />
          <button type="submit" disabled={!input.trim() || isLoading}>
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
