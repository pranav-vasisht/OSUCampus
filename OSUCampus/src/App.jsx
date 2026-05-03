import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import './index.css';

function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Active view: 'chat' | 'study-guide' | 'audio' | 'quiz' | 'mindmap'
  const [activeView, setActiveView] = useState('chat');
  const [isGenerating, setIsGenerating] = useState(false);

  // Per-mode cache so generated content persists across view switches
  const [cache, setCache] = useState({
    'study-guide': null,
    'audio': null,
    'quiz': null,
    'mindmap': null,
  });

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      initGemini(storedKey);
    } else {
      setIsSettingsOpen(true);
    }
  }, []);

  const handleSaveKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    initGemini(key);
  };

  const handleAddDocument = (doc) => {
    setDocuments(prev => [...prev, doc]);
  };

  const handleRemoveDocument = (id) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleSendMessage = async (text) => {
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    const newUserMsg = { role: 'user', text };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const response = await generateStudyResponse(text, documents, messages);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: `**Error:** ${error.message}\n\nPlease check your API key in the settings.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Output Mode Handlers ──────────────────────────────────────────

  const handleViewSwitch = async (mode, generatorFn) => {
    // If we already have cached data for this mode, just switch to it
    if (cache[mode]) {
      setActiveView(mode);
      return;
    }

    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    if (documents.length === 0) {
      alert('Please upload at least one source document first.');
      return;
    }

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

  const handleBack = () => {
    setActiveView('chat');
  };

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

    switch (activeView) {
      case 'study-guide':
        return cache['study-guide'] ? <StudyGuide content={cache['study-guide']} onBack={handleBack} /> : null;
      case 'audio':
        return cache['audio'] ? <AudioOverview content={cache['audio']} onBack={handleBack} /> : null;
      case 'quiz':
        return cache['quiz'] ? <Quiz data={cache['quiz']} onBack={handleBack} /> : null;
      case 'mindmap':
        return cache['mindmap'] ? (
          <div className="split-view">
            <div className="split-left">
              <Chat messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
            </div>
            <div className="split-right">
              <MindMap data={cache['mindmap']} onNodeClick={handleNodeClick} sourceCount={documents.length} />
            </div>
          </div>
        ) : null;
      default:
        return (
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        documents={documents}
        onAddDocument={handleAddDocument}
        onRemoveDocument={handleRemoveDocument}
        hasApiKey={!!apiKey}
      />

      <main className="main-content">
        <header className="top-nav">
          {/* Action Bar */}
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
              title="Generate Study Guide"
            >
              <BookOpen size={16} />
              <span>Study Guide</span>
            </button>
            <button
              className={`action-btn ${activeView === 'audio' ? 'active' : ''} ${cache['audio'] ? 'cached' : ''}`}
              onClick={() => handleViewSwitch('audio', generateAudioOverview)}
              disabled={isGenerating}
              title="Generate Audio Overview"
            >
              <Headphones size={16} />
              <span>Audio Overview</span>
            </button>
            <button
              className={`action-btn ${activeView === 'quiz' ? 'active' : ''} ${cache['quiz'] ? 'cached' : ''}`}
              onClick={() => handleViewSwitch('quiz', generateQuiz)}
              disabled={isGenerating}
              title="Generate Quiz"
            >
              <ClipboardList size={16} />
              <span>Quiz</span>
            </button>
            <button
              className={`action-btn ${activeView === 'mindmap' ? 'active' : ''} ${cache['mindmap'] ? 'cached' : ''}`}
              onClick={() => handleViewSwitch('mindmap', generateMindMap)}
              disabled={isGenerating}
              title="Generate Mind Map"
            >
              <Network size={16} />
              <span>Mind Map</span>
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
      />
    </div>
  );
}

export default App;
