import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Sparkles, Brain, FileText, Upload, Plus, Trash2, Zap, LayoutDashboard, MessageCircle, LogOut, UserCircle, Key, Mail } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function App() {
  // Auth State
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('myai_user')) || null);
  const [isAuthView, setIsAuthView] = useState(!user);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('Senior Software Engineer');

  // App State
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeSession, setActiveSession] = useState(`sess-${Math.random().toString(36).substr(2, 9)}`);
  const [viewingFile, setViewingFile] = useState(null); // { name, content }

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.token}`;
      fetchHistory();
      fetchKnowledge();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setConversations(res.data);
    } catch (e) {
      console.error("Failed to fetch history");
    }
  };

  const fetchKnowledge = async () => {
    try {
      const res = await axios.get(`${API_BASE}/knowledge`);
      setUploadedFiles(res.data);
    } catch (e) {
      console.error("Failed to fetch knowledge");
    }
  };

  const deleteFile = async (filename) => {
    if (!confirm(`Permanently remove ${filename} from your brain?`)) return;
    try {
      await axios.delete(`${API_BASE}/knowledge/${encodeURIComponent(filename)}`);
      setUploadedFiles(prev => prev.filter(f => f.name !== filename));
    } catch (e) {
      alert("Removal failed.");
    }
  };

  const openFile = async (filename) => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_BASE}/knowledge/${encodeURIComponent(filename)}`);
      setViewingFile({ name: filename, content: res.data.content });
    } catch (e) {
      alert("Retrieval failed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup';
      const res = await axios.post(`${API_BASE}${endpoint}`, {
        email,
        password,
        persona: selectedPersona
      });
      const userData = { email, token: res.data.token, persona: res.data.persona };
      localStorage.setItem('myai_user', JSON.stringify(userData));
      setUser(userData);
      setIsAuthView(false);
    } catch (err) {
      alert(err.response?.data?.error || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('myai_user');
    setUser(null);
    setIsAuthView(true);
    setEmail('');
    setPassword('');
    setMessages([]);
    setUploadedFiles([]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        message: input,
        sessionId: activeSession,
        domainContext: user.persona
      });
      setMessages(prev => [...prev, { role: 'agent', content: res.data }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'agent', content: { answer: "Cognitive sync failed." } }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsIngesting(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      await axios.post(`${API_BASE}/ingest`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newFiles = files.map(f => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB',
        date: new Date().toLocaleDateString()
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      alert("Indexing failed.");
    } finally {
      setIsIngesting(false);
      event.target.value = null;
    }
  };

  if (isAuthView) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="auth-card" style={{
          background: 'var(--surface-color)',
          padding: '40px',
          borderRadius: '24px',
          width: '450px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <Brain size={48} color="var(--accent-color)" style={{ marginBottom: '16px' }} />
            <h1 style={{ fontFamily: 'var(--font-header)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MyAi</h1>
            <p style={{ color: 'var(--text-muted)' }}>{authMode === 'login' ? 'Access your private brain' : 'Create your decentralized AI'}</p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="input-container" style={{ padding: '4px 16px' }}>
              <Mail size={18} color="var(--text-muted)" />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="input-container" style={{ padding: '4px 16px' }}>
              <Key size={18} color="var(--text-muted)" />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {authMode === 'signup' && (
              <div className="persona-selector" style={{ marginTop: 0 }}>
                <label>CHOOSE YOUR SPECIALTY</label>
                <select value={selectedPersona} onChange={e => setSelectedPersona(e.target.value)}>
                  <option>Senior Software Engineer</option>
                  <option>Michelin-level Chef</option>
                  <option>Medical Practitioner</option>
                  <option>Legal Expert</option>
                </select>
              </div>
            )}

            <button type="submit" className="send-button" style={{ width: '100%', borderRadius: '14px', height: '52px', fontSize: '1rem' }} disabled={isLoading}>
              {isLoading ? <Zap className="spinning" /> : (authMode === 'login' ? 'Sign In' : 'Construct Brain')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {authMode === 'login' ? "New here? " : "Already have a brain? "}
            <span
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setEmail('');
                setPassword('');
              }}
              style={{ color: 'var(--accent-color)', cursor: 'pointer', fontWeight: 600 }}
            >
              {authMode === 'login' ? 'Sign Up' : 'Log In'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Background Stickers */}
      <Sparkles className="bg-sticker" style={{ top: '10%', right: '5%' }} size={120} />
      <Brain className="bg-sticker" style={{ bottom: '15%', left: '20%' }} size={180} />
      <Zap className="bg-sticker" style={{ top: '40%', left: '40%' }} size={100} />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Brain size={24} color="var(--accent-color)" />
          </div>
          <span>MyAi</span>
        </div>

        <nav>
          <button className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            <MessageCircle size={20} />
            Private Chat
          </button>
          <button className={`nav-item ${activeTab === 'knowledge' ? 'active' : ''}`} onClick={() => setActiveTab('knowledge')}>
            <LayoutDashboard size={20} />
            My Knowledge
          </button>
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px 0', borderTop: '1px solid var(--border-color)', opacity: 0.6 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1px' }}>SYSTEM OWNER</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>Ankur Kaushik</p>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>ankurkaushik672@gmail.com</p>
        </div>

        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <UserCircle size={32} color="var(--accent-color)" />
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.persona}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ color: '#ef4444' }}>
            <LogOut size={18} />
            Disconnect
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'chat' ? (
          <>
            <header>
              <div className="header-info">
                <h1>Neural Interface</h1>
                <p>Personalized as: {user.persona}</p>
              </div>
              <div className="active-pill">
                <div className="pulse"></div>
                ACID Isolation Active
              </div>
            </header>

            <div className="chat-container">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <Sparkles size={40} color="var(--accent-color)" />
                  <p>Welcome back, {user.email.split('@')[0]}.<br />Your private knowledge is encrypted and ready.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="bubble">
                    {msg.role === 'user' ? msg.content : (
                      <div className="answer-content" dangerouslySetInnerHTML={{
                        __html: (() => {
                          const raw = msg.content?.answer || "Cognitive error";
                          const content = typeof raw === 'string' ? raw : JSON.stringify(raw);
                          return window.marked ? window.marked.parse(content) : content;
                        })()
                      }} />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message agent">
                  <div className="bubble" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                    <Zap size={16} className="spinning" /> Scanning Private Matrix...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="input-wrapper">
              <div className="input-container">
                <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Ask your private brain..." />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} className="send-button">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="kb-container">
            <div className="kb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2>My Knowledge Base</h2>
                <p>Your private documents used for Expert Reasoning.</p>
              </div>
              {uploadedFiles.length > 0 && <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{uploadedFiles.length} Documents Indexed</span>}
            </div>

            <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
              {isIngesting ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                  <Zap size={60} className="spinning" color="var(--accent-color)" />
                  <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Isolating Expert Data...</p>
                </div>
              ) : (
                <>
                  <Upload size={60} color="var(--accent-color)" style={{ marginBottom: '24px' }} />
                  <h3 style={{ fontSize: '1.8rem' }}>Upload Expert Files</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Multiple Files Supported (PDF, Docx, Excel, Text)</p>
                </>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.docx,.xlsx,.xls,.txt" multiple />
            </div>

            {uploadedFiles.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '60px', opacity: 0.5 }}>
                <Sparkles size={40} style={{ marginBottom: '16px' }} />
                <p>No documents found in your private archive.<br />Upload files to begin expert training.</p>
              </div>
            ) : (
              <div className="file-list">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="file-card">
                    <div className="file-icon"><FileText size={24} /></div>
                    <div className="file-info" style={{ flex: 1 }}>
                      <h4>{f.name}</h4>
                      <span>{f.size} • {f.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={(e) => { e.stopPropagation(); openFile(f.name); }} className="nav-item" style={{ width: 'auto', padding: '8px', color: 'var(--accent-color)' }} title="Open Index">
                        <Plus size={18} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteFile(f.name); }} className="nav-item" style={{ width: 'auto', padding: '8px', color: '#ef4444' }} title="Erase Memory">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewingFile && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px'
              }}>
                <div style={{
                  background: 'var(--surface-color)', width: '100%', maxWidth: '900px',
                  maxHeight: '80vh', borderRadius: '24px', border: '1px solid var(--border-color)',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  boxShadow: '0 0 100px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontFamily: 'var(--font-header)' }}>{viewingFile.name}</h3>
                    <button onClick={() => setViewingFile(null)} className="nav-item" style={{ width: 'auto' }}><Trash2 size={18} /> Close</button>
                  </div>
                  <div style={{ padding: '32px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.8' }}>
                    {viewingFile.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
