import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import StudyGuide from './components/StudyGuide';
import AudioOverview from './components/AudioOverview';
import Quiz from './components/Quiz';
import MindMap from './components/MindMap';
import {
  initGemini,
  generateStudyResponse,
  generateStudyGuide,
  generateAudioOverview,
  generateQuiz,
  generateMindMap,
} from './lib/gemini';
import { formatMindMapUserMessage } from './lib/mindMapContext';
import {
  Settings,
  BookOpen,
  Headphones,
  ClipboardList,
  Network,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  GitBranch,
} from 'lucide-react';
import ChatTree from './components/ChatTree';
import './index.css';

function App() {
  const [documents, setDocuments] = useState([]);
  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem('chat_nodes');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeNodeId, setActiveNodeId] = useState(() => {
    return localStorage.getItem('chat_active_node_id') || null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const [activeView, setActiveView] = useState('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cache, setCache] = useState({
    'study-guide': null, 'audio': null, 'quiz': null, 'mindmap': null,
  });

  // Resizable panel widths
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [splitChatWidth, setSplitChatWidth] = useState(380);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // Resize refs
  const resizing = useRef(null); // 'sidebar' | 'split'
  const appRef = useRef(null);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      initGemini(storedKey);
    } else {
      setIsSettingsOpen(true);
    }
  }, []);

  // Save tree to localStorage
  useEffect(() => {
    localStorage.setItem('chat_nodes', JSON.stringify(nodes));
    if (activeNodeId) localStorage.setItem('chat_active_node_id', activeNodeId);
  }, [nodes, activeNodeId]);

  // Derived active path
  const activePath = React.useMemo(() => {
    const path = [];
    let current = activeNodeId;
    while (current && nodes[current]) {
      path.push(nodes[current]);
      current = nodes[current].parentId;
    }
    return path.reverse();
  }, [nodes, activeNodeId]);

  // ─── Resize handlers ─────────────────────────────────────────────

  const handleResizeStart = useCallback((which) => (e) => {
    e.preventDefault();
    resizing.current = which;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing.current) return;
      if (resizing.current === 'sidebar') {
        setSidebarWidth(Math.min(Math.max(e.clientX, 200), 600));
      } else if (resizing.current === 'split') {
        const mainEl = appRef.current?.querySelector('.main-content');
        if (mainEl) {
          const rect = mainEl.getBoundingClientRect();
          setSplitChatWidth(Math.min(Math.max(e.clientX - rect.left, 200), 800));
        }
      }
    };
    const handleMouseUp = () => {
      if (resizing.current) {
        resizing.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ─── Standard handlers ────────────────────────────────────────────

  const handleSaveKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    initGemini(key);
  };

  const handleAddDocument = (doc) => setDocuments(prev => [...prev, doc]);
  const handleRemoveDocument = (id) => setDocuments(prev => prev.filter(d => d.id !== id));

  const handleAddLink = (targetId, sourceId) => {
    setNodes(prev => {
      const next = { ...prev };
      if (!next[targetId] || !next[sourceId]) return next;
      const existingLinks = next[targetId].links || [];
      if (!existingLinks.includes(sourceId) && targetId !== sourceId) {
        next[targetId] = { ...next[targetId], links: [...existingLinks, sourceId] };
      }
      return next;
    });
  };

  const handleRemoveLink = (targetId, sourceId) => {
    setNodes(prev => {
      const next = { ...prev };
      if (!next[targetId]) return next;
      const existingLinks = next[targetId].links || [];
      next[targetId] = { ...next[targetId], links: existingLinks.filter(id => id !== sourceId) };
      return next;
    });
  };

  const handleSetNodeTreeColor = (nodeId, color) => {
    setNodes((prev) => {
      if (!prev[nodeId]) return prev;
      const next = { ...prev };
      const cur = { ...next[nodeId] };
      if (color == null) {
        delete cur.treeColor;
      } else {
        cur.treeColor = color;
      }
      next[nodeId] = cur;
      return next;
    });
  };

  const handleSendMessage = async (text, parentId = activeNodeId, linkedNodeIds = []) => {
    if (!apiKey) { setIsSettingsOpen(true); return; }
    
    const userNodeId = crypto.randomUUID();
    const userNode = {
      id: userNodeId,
      parentId: parentId || null,
      children: [],
      links: linkedNodeIds,
      role: 'user',
      text
    };

    setNodes(prev => {
      const next = { ...prev, [userNodeId]: userNode };
      if (parentId && next[parentId]) {
        next[parentId] = { ...next[parentId], children: [...next[parentId].children, userNodeId] };
      }
      return next;
    });
    
    setActiveNodeId(userNodeId);
    setIsLoading(true);

    try {
      // Manually construct the path to pass to the API immediately since state updates are async
      const path = [];
      let current = userNodeId;
      const tempNodes = { ...nodes, [userNodeId]: userNode };
      while (current && tempNodes[current]) {
        path.push(tempNodes[current]);
        current = tempNodes[current].parentId;
      }
      path.reverse();

      const response = await generateStudyResponse(path, documents, tempNodes);
      
      const modelNodeId = crypto.randomUUID();
      const modelNode = {
        id: modelNodeId,
        parentId: userNodeId,
        children: [],
        links: [],
        role: 'model',
        text: response
      };
      
      setNodes(prev => {
        const next = { ...prev, [modelNodeId]: modelNode };
        if (next[userNodeId]) {
          next[userNodeId] = { ...next[userNodeId], children: [...next[userNodeId].children, modelNodeId] };
        }
        return next;
      });
      setActiveNodeId(modelNodeId);
    } catch (error) {
      console.error(error);
      const errorNodeId = crypto.randomUUID();
      const errorNode = {
        id: errorNodeId,
        parentId: userNodeId,
        children: [],
        links: [],
        role: 'model',
        text: `**Error:** ${error.message}\n\nPlease check your API key in the settings.`
      };
      setNodes(prev => {
        const next = { ...prev, [errorNodeId]: errorNode };
        if (next[userNodeId]) {
          next[userNodeId] = { ...next[userNodeId], children: [...next[userNodeId].children, errorNodeId] };
        }
        return next;
      });
      setActiveNodeId(errorNodeId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSwitch = async (mode, generatorFn) => {
    if (activeView === mode) {
      setActiveView('chat');
      return;
    }
    if (cache[mode]) { setActiveView(mode); return; }
    if (!apiKey) { setIsSettingsOpen(true); return; }
    if (documents.length === 0) { alert('Please upload at least one source document first.'); return; }
    setIsGenerating(true);
    setActiveView(mode);
    try {
      const result = await generatorFn(documents);
      setCache(prev => ({ ...prev, [mode]: result }));
    } catch (error) {
      console.error(error);
      alert(`Generation failed: ${error.message}`);
      setActiveView('chat');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBack = () => setActiveView('chat');

  const handleNodeClick = (payload) => {
    const text = formatMindMapUserMessage(payload);
    if (text) handleSendMessage(text);
  };

  // ─── Render active view ────────────────────────────────────────────

  const renderActiveView = () => {
    if (isGenerating) {
      return (
        <div className="generating-overlay">
          <Loader2 size={40} className="spinning" />
          <h3>Generating...</h3>
          <p>Analyzing your sources with Gemini</p>
        </div>
      );
    }

    if (activeView === 'chat') {
      return <Chat nodes={nodes} activePath={activePath} activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} onSendMessage={handleSendMessage} onAddLink={handleAddLink} onRemoveLink={handleRemoveLink} onSetNodeTreeColor={handleSetNodeTreeColor} isLoading={isLoading} />;
    }

    let rightContent = null;
    switch (activeView) {
      case 'study-guide':
        rightContent = cache['study-guide'] ? <StudyGuide content={cache['study-guide']} onBack={handleBack} /> : null;
        break;
      case 'audio':
        rightContent = cache['audio'] ? <AudioOverview content={cache['audio']} onBack={handleBack} /> : null;
        break;
      case 'quiz':
        rightContent = cache['quiz'] ? <Quiz data={cache['quiz']} onBack={handleBack} /> : null;
        break;
      case 'mindmap':
        rightContent = cache['mindmap'] ? <MindMap data={cache['mindmap']} onNodeClick={handleNodeClick} sourceCount={documents.length} /> : null;
        break;
      case 'chat-tree':
        rightContent = <ChatTree nodes={nodes} activePath={activePath} activeNodeId={activeNodeId} onSelectNode={setActiveNodeId} />;
        break;
      default:
        break;
    }

    if (!rightContent) {
      return <Chat nodes={nodes} activePath={activePath} activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} onSendMessage={handleSendMessage} onAddLink={handleAddLink} onRemoveLink={handleRemoveLink} onSetNodeTreeColor={handleSetNodeTreeColor} isLoading={isLoading} />;
    }

    return (
      <div className="split-view">
        <div className="split-left" style={{ width: splitChatWidth }}>
          <Chat nodes={nodes} activePath={activePath} activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} onSendMessage={handleSendMessage} onAddLink={handleAddLink} onRemoveLink={handleRemoveLink} onSetNodeTreeColor={handleSetNodeTreeColor} isLoading={isLoading} />
        </div>
        <div className="resize-handle" onMouseDown={handleResizeStart('split')} />
        <div className="split-right">
          {rightContent}
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout" ref={appRef}>
      {!sidebarHidden && (
        <>
          <div className="sidebar-wrapper" style={{ width: sidebarWidth }}>
            <Sidebar
              documents={documents}
              onAddDocument={handleAddDocument}
              onRemoveDocument={handleRemoveDocument}
              hasApiKey={!!apiKey}
            />
          </div>
          <div className="resize-handle" onMouseDown={handleResizeStart('sidebar')} />
        </>
      )}

      <main className="main-content">
        <header className="top-nav">
          <div className="action-bar">
            <button className={`action-btn ${activeView === 'chat' ? 'active' : ''}`} onClick={() => setActiveView('chat')} disabled={isGenerating} title="Chat">
              <MessageSquare size={16} /><span>Chat</span>
            </button>
            <button className={`action-btn ${activeView === 'study-guide' ? 'active' : ''} ${cache['study-guide'] ? 'cached' : ''}`} onClick={() => handleViewSwitch('study-guide', generateStudyGuide)} disabled={isGenerating} title="Study Guide">
              <BookOpen size={16} /><span>Study Guide</span>
            </button>
            <button className={`action-btn ${activeView === 'audio' ? 'active' : ''} ${cache['audio'] ? 'cached' : ''}`} onClick={() => handleViewSwitch('audio', generateAudioOverview)} disabled={isGenerating} title="Audio Overview">
              <Headphones size={16} /><span>Audio Overview</span>
            </button>
            <button className={`action-btn ${activeView === 'quiz' ? 'active' : ''} ${cache['quiz'] ? 'cached' : ''}`} onClick={() => handleViewSwitch('quiz', generateQuiz)} disabled={isGenerating} title="Quiz">
              <ClipboardList size={16} /><span>Quiz</span>
            </button>
            <button className={`action-btn ${activeView === 'mindmap' ? 'active' : ''} ${cache['mindmap'] ? 'cached' : ''}`} onClick={() => handleViewSwitch('mindmap', generateMindMap)} disabled={isGenerating} title="Mind Map">
              <Network size={16} /><span>Mind Map</span>
            </button>
            <button className={`action-btn ${activeView === 'chat-tree' ? 'active' : ''}`} onClick={() => setActiveView(activeView === 'chat-tree' ? 'chat' : 'chat-tree')} title="Chat Tree">
              <GitBranch size={16} /><span>Chat Tree</span>
            </button>

            <button
              className="action-btn"
              onClick={() => setSidebarHidden(h => !h)}
              title={sidebarHidden ? 'Show Sources' : 'Hide Sources'}
            >
              {sidebarHidden ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              <span>{sidebarHidden ? 'Sources' : 'Sources'}</span>
            </button>
          </div>

          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
            <Settings size={20} /><span>Settings</span>
          </button>
        </header>

        {renderActiveView()}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveKey}
        currentKey={apiKey}
      />
    </div>
  );
}

export default App;
