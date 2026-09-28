import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  MessageSquare, 
  Network, 
  FolderOpen, 
  Users, 
  Code, 
  Layers, 
  FileText, 
  ChevronRight, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  ArrowRight,
  Database,
  GitBranch,
  Cpu,
  CornerDownRight,
  Info,
  Mail,
  LockKeyhole,
  Upload,
  LogOut
} from 'lucide-react';
import { mockCodebase, sampleQuestions } from './data/mockCodebase';

// Simple regex syntax highlighter helper
const highlightCode = (code, lang) => {
  if (!code) return '';
  // Escape HTML
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'python' || lang === 'py') {
    // Keywords
    escaped = escaped.replace(/\b(def|class|return|import|from|as|async|await|try|except|raise|if|elif|else|for|in|while|is|not|and|or|None|True|False)\b/g, '<span class="code-keyword">$1</span>');
    // Self
    escaped = escaped.replace(/\b(self)\b/g, '<span class="code-self">$1</span>');
    // Decorators
    escaped = escaped.replace(/(@\w+)/g, '<span class="code-decorator">$1</span>');
    // Function names
    escaped = escaped.replace(/\bdef\s+(\w+)/g, 'def <span class="code-function">$1</span>');
    // Class names
    escaped = escaped.replace(/\bclass\s+(\w+)/g, 'class <span class="code-class">$1</span>');
    // Strings (double quotes)
    escaped = escaped.replace(/(".*?")/g, '<span class="code-string">$1</span>');
    // Strings (single quotes)
    escaped = escaped.replace(/('.*?')/g, '<span class="code-string">$1</span>');
    // Comments
    escaped = escaped.replace(/(#.*)$/gm, '<span class="code-comment">$1</span>');
    // Numbers
    escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');
  } else if (lang === 'javascript' || lang === 'js' || lang === 'jsx') {
    escaped = escaped.replace(/\b(const|let|var|function|return|import|from|export|default|as|async|await|try|catch|if|else|for|of|in|while|class|extends|new|this|true|false|null)\b/g, '<span class="code-keyword">$1</span>');
    escaped = escaped.replace(/\bfunction\s+(\w+)/g, 'function <span class="code-function">$1</span>');
    escaped = escaped.replace(/\bclass\s+(\w+)/g, 'class <span class="code-class">$1</span>');
    escaped = escaped.replace(/(".*?")/g, '<span class="code-string">$1</span>');
    escaped = escaped.replace(/('.*?')/g, '<span class="code-string">$1</span>');
    escaped = escaped.replace(/(`.*?`)/g, '<span class="code-string">$1</span>');
    escaped = escaped.replace(/(\/\/.*)$/gm, '<span class="code-comment">$1</span>');
    escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');
  }
  return escaped;
};

export default function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('codementor-session') || 'null'));
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!session?.token) {
      setAuthLoading(false);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Session expired')))
      .then((result) => setSession((current) => ({ ...current, user: result.user })))
      .catch(() => {
        localStorage.removeItem('codementor-session');
        setSession(null);
      })
      .finally(() => setAuthLoading(false));
  }, [session?.token]);

  if (authLoading) return <div className="auth-loading">Loading CodeMentor AI...</div>;
  if (!session?.token) return <LoginPage onLogin={(nextSession) => {
    localStorage.setItem('codementor-session', JSON.stringify(nextSession));
    setSession(nextSession);
  }} />;

  return <Workspace session={session} onLogout={() => {
    localStorage.removeItem('codementor-session');
    setSession(null);
  }} />;
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in');
      onLogin(result);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-card glass-panel">
      <div className="brand-icon auth-brand-icon"><Sparkles size={22} /></div>
      <p className="eyebrow">CODEMENTOR AI</p>
      <h1>Understand any codebase faster.</h1>
      <p className="auth-copy">Sign in to upload a repository and explore its architecture with an AI onboarding guide.</p>
      <form onSubmit={submit} className="auth-form">
        <label><span>Email address</span><div className="auth-input"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gmail.com" required /></div></label>
        <label><span>Password</span><div className="auth-input"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength="8" required /></div></label>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in to workspace'} <ArrowRight size={17} /></button>
      </form>
      <p className="auth-note">Your password is hashed by the local API and is never stored in the browser.</p>
    </section>
  </main>;
}

function Workspace({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'explorer', 'chat', 'graph', 'team'
  const [selectedFile, setSelectedFile] = useState('backend/rag_agent.py');
  const [fileContent, setFileContent] = useState('');
  const [fileLang, setFileLang] = useState('python');
  const [apiStatus, setApiStatus] = useState('connecting');
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const [repositoryFiles, setRepositoryFiles] = useState([]);
  
  // Chat States
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am **CodeMentor AI**. I have indexed this repository and extracted its core structure. Ask me anything about how the modules, classes, and functions are linked, or choose a sample question below to start!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Parse markdown code blocks in bot replies
  const renderBotMessage = (text) => {
    const parts = text.split(/(```python[\s\S]*?```|```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```python')) {
        const rawCode = part.replace(/```python\n|```/g, '');
        return (
          <pre key={idx} className="code-container" style={{ margin: '12px 0', fontSize: '13px' }}>
            <code dangerouslySetInnerHTML={{ __html: highlightCode(rawCode, 'python') }} />
          </pre>
        );
      } else if (part.startsWith('```')) {
        const rawCode = part.replace(/```\n|```/g, '');
        return (
          <pre key={idx} className="code-container" style={{ margin: '12px 0', fontSize: '13px' }}>
            <code>{rawCode}</code>
          </pre>
        );
      }
      
      // Inline code rendering and bold rendering
      let formattedText = part;
      // Bold text **text**
      formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code `code`
      formattedText = formattedText.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
      
      return <p key={idx} dangerouslySetInnerHTML={{ __html: formattedText }} style={{ marginBottom: '8px', lineHeight: '1.6' }} />;
    });
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // Navigate files
  const getFileByPath = (path) => {
    const parts = path.split('/');
    if (parts.length === 1) {
      return mockCodebase.files[parts[0]];
    } else {
      let currentDir = mockCodebase.files[parts[0]];
      for (let i = 1; i < parts.length - 1; i++) {
        currentDir = currentDir.children[parts[i]];
      }
      return currentDir.children[parts[parts.length - 1]];
    }
  };

  useEffect(() => {
    fetch(`/api/files/content?path=${encodeURIComponent(selectedFile)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('File unavailable')))
      .then((file) => {
        setFileContent(file.content);
        setFileLang(file.type);
      })
      .catch(() => {
        const file = getFileByPath(selectedFile);
        if (file?.content) {
          setFileContent(file.content);
          setFileLang(file.type);
        }
      });
  }, [selectedFile]);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then(() => setApiStatus('connected'))
      .catch(() => setApiStatus('offline'));
  }, []);

  const refreshRepositoryFiles = () => fetch('/api/files')
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('Files unavailable')))
    .then((result) => setRepositoryFiles(result.files))
    .catch(() => setRepositoryFiles([]));

  useEffect(() => {
    refreshRepositoryFiles();
  }, []);

  const uploadRepository = async (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter((file) => !file.webkitRelativePath.includes('node_modules'));
    if (!selectedFiles.length) return;
    setUploadState({ status: 'uploading', message: `Reading ${selectedFiles.length} files...` });
    try {
      const files = await Promise.all(selectedFiles.map(async (file) => ({ path: file.webkitRelativePath || file.name, content: await file.text() })));
      const response = await fetch('/api/repositories/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: files[0].path.split('/')[0], files }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      await refreshRepositoryFiles();
      setUploadState({ status: 'success', message: `${result.files} files indexed. Refresh the explorer to browse them.` });
    } catch (uploadError) {
      setUploadState({ status: 'error', message: uploadError.message });
    } finally {
      event.target.value = '';
    }
  };

  const handleSend = async (textToSend = chatInput) => {
    if (!textToSend.trim()) return;

    // Add User Message
    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    if (textToSend === chatInput) {
      setChatInput('');
    }

    setIsTyping(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });
      if (!response.ok) throw new Error('Query failed');
      const result = await response.json();
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: result.answer,
        sources: result.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch {
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: 'The CodeMentor API is unavailable. Start the backend with `npm run server` and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar-nav">
        <div className="brand-header">
          <div className="brand-icon">
            <Sparkles size={20} className="glow-icon" />
          </div>
          <div>
            <h1>CodeMentor AI</h1>
            <span className="brand-subtitle">Onboarding Portal v{mockCodebase.version}</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Layers size={18} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            <FolderOpen size={18} />
            <span>Code Explorer</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} />
            <span>AI Onboarding Chat</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <Network size={18} />
            <span>Visual Architecture</span>
          </button>
          
        </nav>

        <div className="sidebar-footer">
          <div className="info-badge">
            <Database size={14} />
            <span>API: {apiStatus === 'connected' ? 'Connected' : apiStatus === 'offline' ? 'Offline' : 'Connecting'}</span>
          </div>
          <div className="info-badge">
            <GitBranch size={14} />
            <span>Repo: active-branch/main</span>
          </div>
          <button className="logout-button" onClick={onLogout}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="workspace-main">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="tab-pane animate-fade-in">
            <header className="pane-header">
              <div>
                <h2>Codebase Overview</h2>
                <p>Retrieval-Augmented index metrics and health status.</p>
              </div>
              <div className="system-status">
                <span className="status-dot green"></span>
                <span>All Modules Indexed</span>
              </div>
            </header>

            {/* Metrics Grid */}
            <div className="metrics-grid">
              <div className="metric-card glass-panel">
                <div className="metric-header">
                  <span className="metric-title">Lines of Code</span>
                  <Code size={20} className="metric-icon purple" />
                </div>
                <div className="metric-value">{mockCodebase.stats.loc}</div>
                <div className="metric-sub text-secondary">Parsed across 5 main files</div>
              </div>

              <div className="metric-card glass-panel">
                <div className="metric-header">
                  <span className="metric-title">Classes Extracted</span>
                  <Layers size={20} className="metric-icon blue" />
                </div>
                <div className="metric-value">{mockCodebase.stats.classesCount}</div>
                <div className="metric-sub text-secondary">AST nodes mapped inside vector store</div>
              </div>

              <div className="metric-card glass-panel">
                <div className="metric-header">
                  <span className="metric-title">Functions Mapped</span>
                  <Terminal size={20} className="metric-icon green" />
                </div>
                <div className="metric-value">{mockCodebase.stats.functionsCount}</div>
                <div className="metric-sub text-secondary">Individually searchable embedding chunks</div>
              </div>
            </div>

            {/* Ingestion & Languages */}
            <div className="dashboard-row">
              <div className="dashboard-card glass-panel flex-2">
                <h3>Repository Ingestion Flow</h3>
                <div className="ingestion-flow-map">
                  <div className="flow-step">
                    <FolderOpen size={24} className="purple" />
                    <h4>1. Parse Files</h4>
                    <p>AST extracts Python classes & functions</p>
                  </div>
                  <div className="flow-arrow"><ArrowRight size={20} /></div>
                  <div className="flow-step">
                    <Cpu size={24} className="blue" />
                    <h4>2. Generate Chunk</h4>
                    <p>Segments code with structured docstrings</p>
                  </div>
                  <div className="flow-arrow"><ArrowRight size={20} /></div>
                  <div className="flow-step">
                    <Database size={24} className="green" />
                    <h4>3. Vector Search</h4>
                    <p>Indices code blocks in ChromaDB</p>
                  </div>
                </div>
              </div>

              <div className="dashboard-card glass-panel flex-1">
                <h3>Language Distribution</h3>
                <div className="languages-list">
                  {mockCodebase.stats.languages.map((lang, index) => (
                    <div key={index} className="language-bar-item">
                      <div className="lang-info">
                        <span className="lang-dot" style={{ backgroundColor: lang.color }}></span>
                        <span className="lang-name">{lang.name}</span>
                        <span className="lang-pct">{lang.percentage}%</span>
                      </div>
                      <div className="lang-bar-bg">
                        <div className="lang-bar-fill" style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="dashboard-card glass-panel repository-upload-card">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h3>Upload a repository</h3>
                <p>Select a project folder to replace the demo index with your own source files.</p>
              </div>
              <label className="upload-button"><Upload size={18} /> Choose folder<input type="file" webkitdirectory="true" directory="true" multiple onChange={uploadRepository} /></label>
              {uploadState.message && <span className={`upload-status ${uploadState.status}`}>{uploadState.message}</span>}
            </div>
            
            {/* Quickstart Onboarding Suggestions */}
            <div className="dashboard-card glass-panel" style={{ marginTop: '24px' }}>
              <h3>Suggested Onboarding Actions</h3>
              <div className="action-suggestions">
                <div className="action-card" onClick={() => setActiveTab('chat')}>
                  <div className="action-icon-wrapper"><MessageSquare size={20} /></div>
                  <div>
                    <h4>Ask AI a Question</h4>
                    <p>Ask details like "How does the similarity search work?" or "Where are endpoints defined?"</p>
                  </div>
                  <ChevronRight size={18} />
                </div>
                <div className="action-card" onClick={() => setActiveTab('explorer')}>
                  <div className="action-icon-wrapper"><FolderOpen size={20} /></div>
                  <div>
                    <h4>Browse Source Files</h4>
                    <p>Navigate backend scripts with syntax highlighting and docstring breakdown</p>
                  </div>
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CODE EXPLORER TAB */}
        {activeTab === 'explorer' && (
          <div className="tab-pane explorer-pane animate-fade-in">
            <div className="explorer-sidebar glass-panel">
              <h3 className="section-header">File Explorer</h3>
              <div className="tree-list">
                {repositoryFiles.map((file) => <div key={file.path} className={`tree-item file ${selectedFile === file.path ? 'selected' : ''}`} onClick={() => setSelectedFile(file.path)}><FileText size={14} className="file-icon" /><span>{file.path}</span></div>)}
              </div>
            </div>

            {/* Right Code Viewer */}
            <div className="code-viewer-container glass-panel">
              <div className="code-viewer-header">
                <div className="file-tab">
                  <Code size={16} className="purple" />
                  <span>{selectedFile}</span>
                </div>
                <div className="file-meta">
                  <span>Language: {fileLang.toUpperCase()}</span>
                </div>
              </div>
              <div className="code-editor-body">
                <pre className="code-container">
                  <code dangerouslySetInnerHTML={{ __html: highlightCode(fileContent, fileLang) }} />
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* AI CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="tab-pane chat-pane animate-fade-in">
            {/* Chat Box */}
            <div className="chat-interface glass-panel">
              <div className="chat-messages-container">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
                    <div className="avatar-wrapper">
                      {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className="message-bubble">
                      <div className="message-content">
                        {msg.sender === 'user' ? <p>{msg.text}</p> : renderBotMessage(msg.text)}
                      </div>
                      
                      {msg.sources && (
                        <div className="sources-container">
                          <span className="sources-title"><CornerDownRight size={12} /> Grounded Sources:</span>
                          <div className="sources-list">
                            {msg.sources.map((src, sIdx) => (
                              <button 
                                key={sIdx} 
                                className="source-tag"
                                onClick={() => {
                                  setSelectedFile(src.file);
                                  setActiveTab('explorer');
                                }}
                              >
                                <Code size={12} />
                                <span>{src.file} &rarr; {src.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <span className="msg-time">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="chat-message bot-msg typing">
                    <div className="avatar-wrapper"><Bot size={16} /></div>
                    <div className="message-bubble">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Suggestions Panel */}
              <div className="chat-suggestions-bar">
                <span>Try asking:</span>
                {sampleQuestions.map((q) => (
                  <button 
                    key={q.id} 
                    className="suggestion-pill"
                    onClick={() => handleSend(q.question)}
                  >
                    {q.question}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form 
                className="chat-input-wrapper"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about the CodeMentor AI codebase..." 
                />
                <button type="submit" className="send-btn" disabled={!chatInput.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VISUAL ARCHITECTURE TAB */}
        {activeTab === 'graph' && (
          <div className="tab-pane animate-fade-in">
            <header className="pane-header">
              <div>
                <h2>Interactive Codebase Graph</h2>
                <p>A visual representation of the CodeMentor AI architecture components and dependencies.</p>
              </div>
            </header>

            <div className="visualizer-container glass-panel">
              <svg className="architecture-svg" viewBox="0 0 800 500">
                {/* Connections */}
                <line x1="120" y1="250" x2="300" y2="150" stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="120" y1="250" x2="300" y2="250" stroke="#6366f1" strokeWidth="2" />
                <line x1="300" y1="150" x2="520" y2="250" stroke="#a855f7" strokeWidth="2" />
                <line x1="300" y1="250" x2="520" y2="250" stroke="#a855f7" strokeWidth="2" />
                <line x1="520" y1="250" x2="700" y2="250" stroke="#10b981" strokeWidth="3" />
                <line x1="520" y1="250" x2="520" y2="380" stroke="#f59e0b" strokeWidth="2" />

                {/* Nodes */}
                {/* Node 1: Request client */}
                <g className="svg-node">
                  <circle cx="120" cy="250" r="40" fill="var(--bg-tertiary)" stroke="var(--primary)" strokeWidth="2" />
                  <foreignObject x="90" y="230" width="60" height="40">
                    <div className="svg-node-content">
                      <Users size={18} className="purple" />
                      <span style={{ fontSize: '10px' }}>Developer / Client</span>
                    </div>
                  </foreignObject>
                </g>

                {/* Node 2: FastAPI routes */}
                <g className="svg-node" onClick={() => { setSelectedFile('backend/app.py'); setActiveTab('explorer'); }}>
                  <rect x="250" y="110" width="100" height="80" rx="10" fill="var(--bg-tertiary)" stroke="var(--primary)" strokeWidth="2" />
                  <foreignObject x="255" y="115" width="90" height="70">
                    <div className="svg-node-content">
                      <Terminal size={18} className="purple" />
                      <strong style={{ fontSize: '11px' }}>app.py</strong>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Endpoints</span>
                    </div>
                  </foreignObject>
                </g>

                {/* Node 3: CodeParser */}
                <g className="svg-node" onClick={() => { setSelectedFile('backend/parser.py'); setActiveTab('explorer'); }}>
                  <rect x="250" y="210" width="100" height="80" rx="10" fill="var(--bg-tertiary)" stroke="var(--primary)" strokeWidth="2" />
                  <foreignObject x="255" y="215" width="90" height="70">
                    <div className="svg-node-content">
                      <Code size={18} className="purple" />
                      <strong style={{ fontSize: '11px' }}>parser.py</strong>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>AST Parser</span>
                    </div>
                  </foreignObject>
                </g>

                {/* Node 4: RAGAgent */}
                <g className="svg-node" onClick={() => { setSelectedFile('backend/rag_agent.py'); setActiveTab('explorer'); }}>
                  <circle cx="520" cy="250" r="55" fill="var(--bg-tertiary)" stroke="var(--accent)" strokeWidth="3" />
                  <foreignObject x="480" y="210" width="80" height="80">
                    <div className="svg-node-content">
                      <Cpu size={24} className="accent animate-pulse" />
                      <strong style={{ fontSize: '11px' }}>rag_agent.py</strong>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>RAG Pipeline</span>
                    </div>
                  </foreignObject>
                </g>

                {/* Node 5: VectorStore */}
                <g className="svg-node" onClick={() => { setSelectedFile('backend/vector_store.py'); setActiveTab('explorer'); }}>
                  <rect x="470" y="340" width="100" height="80" rx="10" fill="var(--bg-tertiary)" stroke="var(--warning)" strokeWidth="2" />
                  <foreignObject x="475" y="345" width="90" height="70">
                    <div className="svg-node-content">
                      <Database size={18} className="warning" />
                      <strong style={{ fontSize: '11px' }}>vector_store.py</strong>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>ChromaDB DB</span>
                    </div>
                  </foreignObject>
                </g>

                {/* Node 6: LLM Client */}
                <g className="svg-node">
                  <circle cx="700" cy="250" r="45" fill="var(--bg-tertiary)" stroke="var(--secondary)" strokeWidth="2" />
                  <foreignObject x="670" y="225" width="60" height="50">
                    <div className="svg-node-content">
                      <Sparkles size={20} className="green" />
                      <strong style={{ fontSize: '11px' }}>OpenAI</strong>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>GPT-4o</span>
                    </div>
                  </foreignObject>
                </g>
              </svg>
              <div className="graph-hint">
                <Info size={14} />
                <span>Tip: Click on any file node inside the graph to open it directly in the Code Explorer!</span>
              </div>
            </div>
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <div className="tab-pane animate-fade-in">
            <header className="pane-header">
              <div>
                <h2>Project Information & Team</h2>
                <p>Academic details and developers responsible for CodeMentor AI.</p>
              </div>
            </header>

            <div className="team-container">
              {/* Institution Card */}
              <div className="glass-panel institution-card">
                <div className="inst-header">
                  <div className="inst-badge">CVR</div>
                  <div>
                    <h3>CVR College of Engineering</h3>
                    <p className="subtitle">Accredited by National Board of Accreditation, NAAC</p>
                    <p className="sub-detail">Approved by AICTE & Govt. of Telangana, Affiliated to JNTU Hyderabad</p>
                  </div>
                </div>
                <hr className="divider" />
                <div className="inst-body">
                  <div className="meta-info-item">
                    <strong>Department:</strong>
                    <span>Computer Science & Engineering</span>
                  </div>
                  <div className="meta-info-item">
                    <strong>Academic Year:</strong>
                    <span>2026-2027</span>
                  </div>
                  <div className="meta-info-item">
                    <strong>Class & Section:</strong>
                    <span>IV Year CSE - G</span>
                  </div>
                </div>
              </div>

              {/* Project Intro */}
              <div className="glass-panel project-desc-card">
                <h3>About CodeMentor AI</h3>
                <p>
                  Onboarding new developers into large and complex software projects is a time-consuming and challenging process. 
                  CodeMentor AI provides an intelligent, natural-language agent interface that parses software repositories, 
                  extracts functional modules, chunks code blocks with custom AST rules, and embeds them into ChromaDB.
                </p>
                <p>
                  Developers can query the codebase in natural language, retrieving pinpoint accurate answers grounded directly 
                  in the project's source code with full citations, reducing reliance on senior engineering reviews.
                </p>
              </div>

              {/* Members Grid */}
              <h3 className="section-title">Development Team</h3>
              <div className="members-grid">
                <div className="member-card glass-panel">
                  <div className="member-avatar">CL</div>
                  <h4>C LATHA</h4>
                  <span className="roll-number">23B81A05CV</span>
                  <span className="role-tag">Team Lead / AI Architect</span>
                </div>

                <div className="member-card glass-panel">
                  <div className="member-avatar">MK</div>
                  <h4>M KAVYA SRI</h4>
                  <span className="roll-number">23B81A05CU</span>
                  <span className="role-tag">Backend Engineer</span>
                </div>

                <div className="member-card glass-panel">
                  <div className="member-avatar">KV</div>
                  <h4>K VARSHITHA</h4>
                  <span className="roll-number">23B81A05EH</span>
                  <span className="role-tag">Frontend & Integration</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
