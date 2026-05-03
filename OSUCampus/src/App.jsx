import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import SettingsModal from './components/SettingsModal';
import StudyGuide from './components/StudyGuide';
import Quiz from './components/Quiz';
import MindMap from './components/MindMap';
import AuthLanding from './components/AuthLanding';
import {
  initGemini,
  generateStudyResponse,
  generateStudyGuide,
  generateQuiz,
  generateMindMap,
  uploadFileToGemini,
} from './lib/gemini';
import { isOregonStateEmail, getSessionUserEmail } from './lib/auth';
import {
  supabase,
  isSupabaseConfigured,
  signOut,
  fetchUserDocuments,
  insertUserDocument,
  deleteUserDocumentRow,
  uploadSourceBlob,
  downloadSourceFile,
  deleteSourceFile,
} from './lib/supabase';
import {
  Settings,
  BookOpen,
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

/** Remove legacy synthetic "Conversation" root so the first user message is the tree trunk. */
function stripSyntheticRootNodes(raw) {
  if (!raw || typeof raw !== 'object') return {};
  let next = { ...raw };
  const syntheticIds = Object.values(next)
    .filter((n) => n && n.role === 'root' && !n.parentId)
    .map((n) => n.id);

  for (const rid of syntheticIds) {
    const meta = next[rid];
    if (!meta) continue;
    const children = meta.children || [];
    delete next[rid];
    children.forEach((cid) => {
      if (next[cid]) {
        next[cid] = { ...next[cid], parentId: null };
      }
    });
  }
  return next;
}

function normalizeChatTree(raw) {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return {};
  }
  return stripSyntheticRootNodes(raw);
}

/** Stable key so MindMap remounts when the graph content changes (resets expansion without an effect). */
function mindMapFingerprint(node) {
  if (!node) return '';
  let s = String(node.label ?? '');
  const kids = node.children || [];
  for (let i = 0; i < kids.length; i++) {
    s += '\0' + mindMapFingerprint(kids[i]);
  }
  return s.slice(0, 400);
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  const [documents, setDocuments] = useState([]);
  const [mindMapRefreshNonce, setMindMapRefreshNonce] = useState(0);
  const [mindMapRefreshing, setMindMapRefreshing] = useState(false);
  const [nodes, setNodes] = useState({});
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const [activeView, setActiveView] = useState('chat');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cache, setCache] = useState({
    'study-guide': null, quiz: null, mindmap: null,
  });

  /** When sources change, cached Study Guide / Audio / Quiz / Mind Map are stale. */
  const sourcesSignature = useMemo(
    () => documents.map((d) => d.id).slice().sort().join('|'),
    [documents]
  );

  const mindMapRemountKey = useMemo(() => {
    const mm = cache['mindmap'];
    const base = mm ? `${sourcesSignature}:${mindMapFingerprint(mm)}` : sourcesSignature;
    return `${base}:r${mindMapRefreshNonce}`;
  }, [sourcesSignature, cache, mindMapRefreshNonce]);

  useEffect(() => {
    queueMicrotask(() => {
      setCache({
        'study-guide': null,
        quiz: null,
        mindmap: null,
      });
    });
  }, [sourcesSignature]);

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [splitChatWidth, setSplitChatWidth] = useState(380);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  const resizing = useRef(null);
  const appRef = useRef(null);
  const regenInFlightRef = useRef(new Set());
  const skipChatSaveRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      queueMicrotask(() => setAuthReady(true));
      return;
    }

    const syncSession = async (nextSession) => {
      if (!nextSession?.user) {
        setSession(null);
        setDocuments([]);
        return;
      }
      const email = getSessionUserEmail(nextSession.user);
      if (!isOregonStateEmail(email)) {
        await signOut();
        setSession(null);
        setDocuments([]);
        setAuthError('Invalid school email');
        return;
      }
      setAuthError('');
      setSession(nextSession);
    };

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      syncSession(s).finally(() => setAuthReady(true));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      syncSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    skipChatSaveRef.current = true;
    const saved = localStorage.getItem(`chat_nodes_${uid}`);
    const parsed = saved ? JSON.parse(saved) : {};
    const active = localStorage.getItem(`chat_active_node_id_${uid}`) || null;
    queueMicrotask(() => {
      setNodes(normalizeChatTree(parsed));
      setActiveNodeId(active);
      queueMicrotask(() => {
        skipChatSaveRef.current = false;
      });
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (skipChatSaveRef.current) return;
    const uid = session.user.id;
    localStorage.setItem(`chat_nodes_${uid}`, JSON.stringify(nodes));
    if (activeNodeId) localStorage.setItem(`chat_active_node_id_${uid}`, activeNodeId);
    else localStorage.removeItem(`chat_active_node_id_${uid}`);
  }, [nodes, activeNodeId, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    const storedKey = localStorage.getItem(`gemini_api_key_${uid}`);
    queueMicrotask(() => {
      if (storedKey) {
        setApiKey(storedKey);
        initGemini(storedKey);
      } else {
        setApiKey('');
        initGemini('');
        setIsSettingsOpen(true);
      }
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    let cancelled = false;

    (async () => {
      try {
        const rows = await fetchUserDocuments(uid);
        const out = [];
        for (const row of rows) {
          if (row.source_type === 'text') {
            out.push({
              id: row.id,
              name: row.name,
              sourceType: 'text',
              content: row.text_content || '',
            });
          } else if (row.source_type === 'youtube') {
            out.push({
              id: row.id,
              name: row.name,
              sourceType: 'youtube',
              url: row.youtube_url,
            });
          } else if (row.source_type === 'file') {
            if (!apiKey) {
              out.push({
                id: row.id,
                name: row.name,
                sourceType: 'file',
                storage_path: row.storage_path,
                geminiFile: null,
              });
              continue;
            }
            initGemini(apiKey);
            const blob = await downloadSourceFile(row.storage_path);
            const file = new File([blob], row.name, {
              type: row.mime_type || 'application/octet-stream',
            });
            const geminiFile = await uploadFileToGemini(file);
            out.push({
              id: row.id,
              name: row.name,
              sourceType: 'file',
              geminiFile,
              storage_path: row.storage_path,
            });
          }
        }
        if (!cancelled) setDocuments(out);
      } catch (e) {
        console.error(e);
        if (!cancelled) alert(`Could not load your sources: ${e.message}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, apiKey]);

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

  const handleResizeStart = useCallback((which) => (e) => {
    e.preventDefault();
    resizing.current = which;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleSaveKey = (key) => {
    if (!session?.user?.id) return;
    localStorage.setItem(`gemini_api_key_${session.user.id}`, key);
    setApiKey(key);
    initGemini(key);
  };

  const handlePersistSource = useCallback(
    async (payload) => {
      if (!session?.user?.id) throw new Error('Not signed in');
      const uid = session.user.id;
      if (payload.sourceType === 'text') {
        const id = crypto.randomUUID();
        await insertUserDocument({
          id,
          user_id: uid,
          name: payload.name,
          source_type: 'text',
          text_content: payload.content,
          youtube_url: null,
          storage_path: null,
          mime_type: null,
        });
        setDocuments((prev) => [
          ...prev,
          { id, name: payload.name, sourceType: 'text', content: payload.content },
        ]);
      } else if (payload.sourceType === 'youtube') {
        const id = crypto.randomUUID();
        await insertUserDocument({
          id,
          user_id: uid,
          name: payload.name,
          source_type: 'youtube',
          text_content: null,
          youtube_url: payload.url,
          storage_path: null,
          mime_type: null,
        });
        setDocuments((prev) => [
          ...prev,
          { id, name: payload.name, sourceType: 'youtube', url: payload.url },
        ]);
      } else if (payload.sourceType === 'file') {
        const file = payload.file;
        const id = crypto.randomUUID();
        const storagePath = await uploadSourceBlob(uid, id, file.name, file, file.type);
        await insertUserDocument({
          id,
          user_id: uid,
          name: file.name,
          source_type: 'file',
          text_content: null,
          youtube_url: null,
          storage_path: storagePath,
          mime_type: file.type || null,
        });
        const geminiFile = await uploadFileToGemini(file);
        setDocuments((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            sourceType: 'file',
            geminiFile,
            storage_path: storagePath,
          },
        ]);
      }
    },
    [session]
  );

  const handleRemoveDocument = async (id) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc || !session?.user?.id) return;
    try {
      if (doc.storage_path) await deleteSourceFile(doc.storage_path);
      await deleteUserDocumentRow(id, session.user.id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error(e);
      alert(`Could not remove source: ${e.message}`);
    }
  };

  const handleAddLink = (targetId, sourceId) => {
    setNodes((prev) => {
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
    setNodes((prev) => {
      const next = { ...prev };
      if (!next[targetId]) return next;
      const existingLinks = next[targetId].links || [];
      next[targetId] = { ...next[targetId], links: existingLinks.filter((i) => i !== sourceId) };
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

  const documentsForGemini = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.sourceType !== 'file' ||
          (d.geminiFile && d.geminiFile.uri)
      ),
    [documents]
  );

  const handleSendMessage = async (text, parentId = activeNodeId, linkedNodeIds = []) => {
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const resolvedParent = parentId ?? activeNodeId ?? null;

    const userNodeId = crypto.randomUUID();
    const userNode = {
      id: userNodeId,
      parentId: resolvedParent,
      children: [],
      links: linkedNodeIds,
      role: 'user',
      text,
    };

    setNodes((prev) => {
      const next = { ...prev, [userNodeId]: userNode };
      if (resolvedParent && next[resolvedParent]) {
        next[resolvedParent] = {
          ...next[resolvedParent],
          children: [...next[resolvedParent].children, userNodeId],
        };
      }
      return next;
    });

    setActiveNodeId(userNodeId);
    setIsLoading(true);

    try {
      const path = [];
      let current = userNodeId;
      const tempNodes = { ...nodes, [userNodeId]: userNode };
      while (current && tempNodes[current]) {
        path.push(tempNodes[current]);
        current = tempNodes[current].parentId;
      }
      path.reverse();
      const apiPath = path.filter((p) => p.role !== 'root');

      const response = await generateStudyResponse(apiPath, documentsForGemini, tempNodes);

      const modelNodeId = crypto.randomUUID();
      const modelNode = {
        id: modelNodeId,
        parentId: userNodeId,
        children: [],
        links: [],
        role: 'model',
        text: response,
      };

      setNodes((prev) => {
        const next = { ...prev, [modelNodeId]: modelNode };
        if (next[userNodeId]) {
          next[userNodeId] = {
            ...next[userNodeId],
            children: [...next[userNodeId].children, modelNodeId],
          };
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
        text: `**Error:** ${error.message}\n\nPlease check your API key in the settings.`,
      };
      setNodes((prev) => {
        const next = { ...prev, [errorNodeId]: errorNode };
        if (next[userNodeId]) {
          next[userNodeId] = {
            ...next[userNodeId],
            children: [...next[userNodeId].children, errorNodeId],
          };
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
    if (cache[mode]) {
      setActiveView(mode);
      return;
    }
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    if (documentsForGemini.length === 0) {
      alert('Please upload at least one source document first.');
      return;
    }
    setIsGenerating(true);
    setActiveView(mode);
    try {
      const result = await generatorFn(documentsForGemini);
      setCache((prev) => ({ ...prev, [mode]: result }));
    } catch (error) {
      console.error(error);
      alert(`Generation failed: ${error.message}`);
      setActiveView('chat');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeCached =
    ['study-guide', 'quiz', 'mindmap'].includes(activeView) ? cache[activeView] : null;

  useEffect(() => {
    const mode = activeView;
    if (!['study-guide', 'quiz', 'mindmap'].includes(mode)) return;
    if (documentsForGemini.length === 0 || !apiKey) return;
    if (activeCached) return;
    if (regenInFlightRef.current.has(mode)) return;

    const generators = {
      'study-guide': generateStudyGuide,
      quiz: generateQuiz,
      mindmap: generateMindMap,
    };
    const generatorFn = generators[mode];
    let cancelled = false;

    regenInFlightRef.current.add(mode);
    (async () => {
      try {
        const result = await generatorFn(documentsForGemini);
        if (!cancelled) setCache((prev) => ({ ...prev, [mode]: result }));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          alert(`Generation failed: ${error.message}`);
          setActiveView('chat');
        }
      } finally {
        regenInFlightRef.current.delete(mode);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeView, activeCached, documentsForGemini, apiKey, sourcesSignature]);

  const handleBack = () => setActiveView('chat');
  const handleNodeClick = (label) => handleSendMessage(`Define and explain the concept: "${label}"`);

  const handleMindMapRefresh = useCallback(async () => {
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    if (documentsForGemini.length === 0) {
      alert('Please upload at least one source document first.');
      return;
    }
    setMindMapRefreshing(true);
    try {
      const result = await generateMindMap(documentsForGemini);
      setCache((prev) => ({ ...prev, mindmap: result }));
      setMindMapRefreshNonce((n) => n + 1);
    } catch (error) {
      console.error(error);
      alert(`Mind map refresh failed: ${error.message}`);
    } finally {
      setMindMapRefreshing(false);
    }
  }, [apiKey, documentsForGemini]);

  const activePath = React.useMemo(() => {
    const path = [];
    let current = activeNodeId;
    while (current && nodes[current]) {
      path.push(nodes[current]);
      current = nodes[current].parentId;
    }
    return path.reverse().filter((n) => n.role !== 'root');
  }, [nodes, activeNodeId]);

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
      return (
        <Chat
          nodes={nodes}
          activePath={activePath}
          activeNodeId={activeNodeId}
          setActiveNodeId={setActiveNodeId}
          onSendMessage={handleSendMessage}
          onAddLink={handleAddLink}
          onRemoveLink={handleRemoveLink}
          onSetNodeTreeColor={handleSetNodeTreeColor}
          isLoading={isLoading}
        />
      );
    }

    const artifactWait = (message) => (
      <div className="artifact-panel-loading">
        <Loader2 size={32} className="spinning" />
        <p>{message}</p>
      </div>
    );

    let rightContent = null;
    switch (activeView) {
      case 'study-guide':
        rightContent = cache['study-guide'] ? (
          <StudyGuide content={cache['study-guide']} onBack={handleBack} />
        ) : documentsForGemini.length > 0 ? (
          artifactWait('Updating study guide for your sources…')
        ) : null;
        break;
      case 'quiz':
        rightContent = cache['quiz'] ? (
          <Quiz data={cache['quiz']} onBack={handleBack} />
        ) : documentsForGemini.length > 0 ? (
          artifactWait('Updating quiz for your sources…')
        ) : null;
        break;
      case 'mindmap':
        rightContent = cache['mindmap'] ? (
          <MindMap
            key={mindMapRemountKey}
            data={cache['mindmap']}
            onNodeClick={handleNodeClick}
            sourceCount={documentsForGemini.length}
            onRefresh={handleMindMapRefresh}
            isRefreshing={mindMapRefreshing}
          />
        ) : documentsForGemini.length > 0 ? (
          artifactWait('Updating mind map for your sources…')
        ) : null;
        break;
      case 'chat-tree':
        rightContent = (
          <ChatTree
            nodes={nodes}
            activeNodeId={activeNodeId}
            onSelectNode={setActiveNodeId}
          />
        );
        break;
      default:
        break;
    }

    if (!rightContent) {
      return (
        <Chat
          nodes={nodes}
          activePath={activePath}
          activeNodeId={activeNodeId}
          setActiveNodeId={setActiveNodeId}
          onSendMessage={handleSendMessage}
          onAddLink={handleAddLink}
          onRemoveLink={handleRemoveLink}
          onSetNodeTreeColor={handleSetNodeTreeColor}
          isLoading={isLoading}
        />
      );
    }

    return (
      <div className="split-view">
        <div className="split-left" style={{ width: splitChatWidth }}>
          <Chat
            nodes={nodes}
            activePath={activePath}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
            onSendMessage={handleSendMessage}
            onAddLink={handleAddLink}
            onRemoveLink={handleRemoveLink}
            onSetNodeTreeColor={handleSetNodeTreeColor}
            isLoading={isLoading}
          />
        </div>
        <div className="resize-handle" onMouseDown={handleResizeStart('split')} />
        <div className="split-right">{rightContent}</div>
      </div>
    );
  };

  if (!authReady) {
    return (
      <div className="auth-loading-screen">
        <Loader2 size={36} className="spinning" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthLanding
        authError={authError}
        onClearAuthError={() => setAuthError('')}
      />
    );
  }

  return (
    <div className="app-layout" ref={appRef}>
      {!sidebarHidden && (
        <>
          <div className="sidebar-wrapper" style={{ width: sidebarWidth }}>
            <Sidebar
              documents={documents}
              onPersistSource={handlePersistSource}
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
            <button
              className={`action-btn ${activeView === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveView('chat')}
              disabled={isGenerating}
              title="Chat"
            >
              <MessageSquare size={16} />
              <span>Chat</span>
            </button>
            <button
              className={`action-btn ${activeView === 'study-guide' ? 'active' : ''} ${cache['study-guide'] ? 'cached' : ''}`}
              onClick={() => handleViewSwitch('study-guide', generateStudyGuide)}
              disabled={isGenerating}
              title="Study Guide"
            >
              <BookOpen size={16} />
              <span>Study Guide</span>
            </button>
            <button
              className={`action-btn ${activeView === 'quiz' ? 'active' : ''} ${cache['quiz'] ? 'cached' : ''}`}
              onClick={() => handleViewSwitch('quiz', generateQuiz)}
              disabled={isGenerating}
              title="Quiz"
            >
              <ClipboardList size={16} />
              <span>Quiz</span>
            </button>
            <button
              className={`action-btn ${activeView === 'mindmap' ? 'active' : ''} ${cache['mindmap'] ? 'cached' : ''}`}
              onClick={() => handleViewSwitch('mindmap', generateMindMap)}
              disabled={isGenerating}
              title="Mind Map"
            >
              <Network size={16} />
              <span>Mind Map</span>
            </button>
            <button
              className={`action-btn ${activeView === 'chat-tree' ? 'active' : ''}`}
              onClick={() => setActiveView(activeView === 'chat-tree' ? 'chat' : 'chat-tree')}
              title="Chat Tree"
            >
              <GitBranch size={16} />
              <span>Chat Tree</span>
            </button>

            <button
              className="action-btn"
              onClick={() => setSidebarHidden((h) => !h)}
              title={sidebarHidden ? 'Show Sources' : 'Hide Sources'}
            >
              {sidebarHidden ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              <span>Sources</span>
            </button>
          </div>

          <button
            className="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </header>

        {renderActiveView()}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveKey}
        currentKey={apiKey}
        userEmail={getSessionUserEmail(session?.user)}
        onSignOut={async () => {
          try {
            await signOut();
          } catch (e) {
            console.error(e);
          }
          setIsSettingsOpen(false);
        }}
      />
    </div>
  );
}

export default App;
