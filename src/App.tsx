import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState, useMemo } from 'react';
import { 
  Mail, Inbox, Sparkles, Paperclip, 
  ChevronUp, ChevronDown, RefreshCw, ArrowLeft, Plus, Search,
  CheckCircle, Trash2, X, Eye, Zap, MessageSquare, Calendar, CreditCard,
  Sun, Moon, CornerUpLeft, Send // ← ここに Send を復帰させました
} from 'lucide-react';
import './App.css';

type Email = { 
  id: string; subject: string; from: string; date: string; snippet: string; 
  body: string; aiCategories: string[]; isRead: boolean; hasAttachment: boolean; account: string;
};

type SortConfig = { key: keyof Email; direction: 'asc' | 'desc'; } | null;

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [readingEmail, setReadingEmail] = useState<Email | null>(null);
  const [activeAccount, setActiveAccount] = useState<string>('work');
  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [replyText, setReplyText] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const fetchEmails = async () => {
    setIsRefreshing(true);
    const isTauri = '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      try {
        const data = await invoke('get_emails', { account: activeAccount });
        if (Array.isArray(data)) setEmails(data as Email[]);
      } catch (e) { console.error(e); }
    }

    setTimeout(() => {
      const mockData = [
        { id: "1", account: "work", subject: "【重要】サーバーメンテナンスのお知らせ", from: "admin@use-inc.co.jp", date: "2026-05-11 10:00", snippet: "", aiCategories: ["重要", "要確認"], isRead: false, hasAttachment: true, body: "社員各位\n\n定期サーバーメンテナンスを実施いたします。" },
        { id: "2", account: "work", subject: "今週のプロジェクト進捗ミーティング", from: "team-lead@example.com", date: "2026-05-10 14:30", snippet: "", aiCategories: ["社内業務", "会議"], isRead: true, hasAttachment: false, body: "明日の14時からです。アジェンダを確認してください。" },
        { id: "3", account: "personal", subject: "GitHub: 5 new notifications", from: "notifications@github.com", date: "2026-05-09 08:15", snippet: "", aiCategories: ["通知"], isRead: false, hasAttachment: false, body: "Check your dashboard for PR status." }
      ];
      setEmails(mockData);
      setIsRefreshing(false);
    }, 500);
  };

  useEffect(() => { fetchEmails(); }, [activeAccount]);

  useEffect(() => {
    if (readingEmail) {
      setIsAnalyzing(true);
      setAiDraft(null);
      setReplyText('');
      const timer = setTimeout(() => setIsAnalyzing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [readingEmail]);

  const counts = useMemo(() => {
    const accEmails = emails.filter(e => e.account === activeAccount);
    return {
      workHasUnread: emails.some(e => e.account === 'work' && !e.isRead),
      personalHasUnread: emails.some(e => e.account === 'personal' && !e.isRead),
      inboxCount: accEmails.filter(e => !e.isRead).length,
      urgentCount: accEmails.filter(e => e.aiCategories.includes("重要") || e.aiCategories.includes("至急")).length,
      scheduleCount: accEmails.filter(e => e.aiCategories.includes("会議")).length,
      financeCount: accEmails.filter(e => e.aiCategories.includes("経理")).length
    };
  }, [emails, activeAccount]);

  const filteredAndSortedEmails = useMemo(() => {
    let result = emails.filter(e => e.account === activeAccount);
    if (activeFolder === 'urgent') result = result.filter(e => e.aiCategories.includes("重要") || e.aiCategories.includes("至急"));
    else if (activeFolder === 'schedule') result = result.filter(e => e.aiCategories.includes("会議"));
    else if (activeFolder === 'finance') result = result.filter(e => e.aiCategories.includes("経理"));
    
    if (filterUnread) result = result.filter(e => !e.isRead);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => e.subject.toLowerCase().includes(q) || e.from.toLowerCase().includes(q));
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = String(a[sortConfig.key]);
        const bVal = String(b[sortConfig.key]);
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return result;
  }, [emails, activeAccount, activeFolder, searchQuery, filterUnread, sortConfig]);

  const getBadgeClass = (t: string) => (t.includes("重要") || t.includes("至急")) ? "badge badge-urgent" : "badge badge-update";
  
  const renderSortIcon = (k: keyof Email) => {
    if (sortConfig?.key !== k) return <ChevronDown size={14} color="#ccc" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const generateDraft = (tone: string) => {
    setIsDrafting(true);
    setTimeout(() => {
      setAiDraft(tone === '承諾' ? "お疲れ様です。内村です。内容承知いたしました。\nよろしくお願いします。" : "お疲れ様です。内村です。一点確認させてください。");
      setIsDrafting(false);
    }, 600);
  };

  const toggleReadStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isRead: !e.isRead } : e));
  };

  const deleteEmail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.filter(e => e.id !== id));
    if (readingEmail?.id === id) setReadingEmail(null);
  };

  const handleBulkAction = (action: 'read' | 'delete') => {
    if (action === 'read') {
      setEmails(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, isRead: true } : e));
    } else {
      setEmails(prev => prev.filter(e => !selectedIds.includes(e.id)));
    }
    setSelectedIds([]);
  };

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      <div className="account-bar">
        <div className={`account-icon ${activeAccount === 'work' ? 'active' : ''}`} onClick={() => {setActiveAccount('work'); setReadingEmail(null);}}>W{counts.workHasUnread && <div className="account-dot"></div>}</div>
        <div className={`account-icon ${activeAccount === 'personal' ? 'active' : ''}`} onClick={() => {setActiveAccount('personal'); setReadingEmail(null);}}>P{counts.personalHasUnread && <div className="account-dot"></div>}</div>
        <div style={{ width: '32px', height: '2px', backgroundColor: '#1f2937', margin: '4px 0' }}></div>
        <div className="account-icon" style={{ border: '1px dashed #4b5563', backgroundColor: 'transparent' }}><Plus size={20} /></div>
      </div>

      <div className="sidebar">
        <div className="sidebar-title"><Mail size={24} color="#60a5fa" /> Himalaya AI</div>
        
        <div className="sidebar-label">メイン</div>
        <div className={`sidebar-item ${activeFolder === 'inbox' ? 'active' : ''}`} onClick={() => {setActiveFolder('inbox'); setReadingEmail(null);}}>
          <Inbox size={18} /> 受信トレイ {counts.inboxCount > 0 && <span className="sidebar-unread-count">{counts.inboxCount}</span>}
        </div>
        
        <div className="sidebar-label">AI Smart</div>
        <div className={`sidebar-item ${activeFolder === 'urgent' ? 'active' : ''}`} onClick={() => {setActiveFolder('urgent'); setReadingEmail(null);}}><Zap size={18} color="#f59e0b" /> 至急対応 {counts.urgentCount > 0 && <span className="sidebar-unread-count">{counts.urgentCount}</span>}</div>
        <div className={`sidebar-item ${activeFolder === 'schedule' ? 'active' : ''}`} onClick={() => {setActiveFolder('schedule'); setReadingEmail(null);}}><Calendar size={18} color="#10b981" /> スケジュール {counts.scheduleCount > 0 && <span className="sidebar-unread-count">{counts.scheduleCount}</span>}</div>
        <div className={`sidebar-item ${activeFolder === 'finance' ? 'active' : ''}`} onClick={() => {setActiveFolder('finance'); setReadingEmail(null);}}><CreditCard size={18} color="#3b82f6" /> 経理・請求 {counts.financeCount > 0 && <span className="sidebar-unread-count">{counts.financeCount}</span>}</div>
        
        <div className="theme-toggle-container">
          <button className="theme-toggle-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />} {isDarkMode ? 'ライトモード' : 'ダークモード'}
          </button>
        </div>
      </div>

      <div className="main-content">
        {readingEmail ? (
          <div className="email-detail-split">
            <div className="email-detail-container">
              <div className="detail-toolbar">
                <button className="icon-button" onClick={() => setReadingEmail(null)}><ArrowLeft size={20} /> 戻る</button>
              </div>
              <div className="detail-body-scroll">
                <div className="detail-header">
                  <h2 className="detail-subject">{readingEmail.subject}</h2>
                  <div className="detail-meta"><span>{readingEmail.from}</span><span>{readingEmail.date}</span></div>
                </div>
                <div className="detail-body">{readingEmail.body}</div>
                <div className="inline-reply-editor">
                  <div className="reply-to-info"><CornerUpLeft size={16} /> {readingEmail.from} への返信</div>
                  <textarea className="reply-textarea" placeholder="返信内容を入力..." value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                  <div className="reply-toolbar">
                    <button className="send-btn" onClick={() => { alert("送信しました"); setReadingEmail(null); }}><Send size={16} /> 送信する</button>
                  </div>
                </div>
              </div>
            </div>
            <aside className="ai-summary-panel">
              <div className="ai-panel-title"><Sparkles size={20} color="#8b5cf6" /> Himalaya AI</div>
              {isAnalyzing ? (
                <div className="ai-loading"><RefreshCw size={24} className="spin" color="#8b5cf6" /><span>解析中...</span></div>
              ) : (
                <>
                  <div className="ai-section"><div className="ai-section-title"><Zap size={14} /> 3行要約</div><div className="ai-summary-text">・AIが解析した要約が表示されます。</div></div>
                  <div className="ai-section">
                    <div className="ai-section-title"><MessageSquare size={14} /> 返信提案</div>
                    <div className="ai-draft-options">
                      <button className="draft-suggest-btn" onClick={() => generateDraft('承諾')}>承知した</button>
                      <button className="draft-suggest-btn" onClick={() => generateDraft('確認')}>確認したい</button>
                    </div>
                    {isDrafting ? (
                      <div className="ai-loading" style={{height: '60px'}}><RefreshCw size={16} className="spin" /><span>生成中...</span></div>
                    ) : aiDraft && (
                      <div className="ai-draft-result">
                        <div className="ai-draft-content">{aiDraft}</div>
                        <button className="icon-button" onClick={() => setReplyText(aiDraft)} style={{marginTop: '8px', fontSize: '0.8rem', width: '100%'}}><CheckCircle size={14} /> エディタに反映</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
        ) : (
          <>
            <div className="header"><h2><Inbox size={24} /> {activeFolder === 'inbox' ? '受信トレイ' : 'スマートフォルダ'}</h2><button className="icon-button" onClick={fetchEmails} disabled={isRefreshing}><RefreshCw size={20} className={isRefreshing ? "spin" : ""} /></button></div>
            <div className="header-controls">
              {selectedIds.length > 0 ? (
                <div className="action-bar"><span className="action-text">{selectedIds.length} 件選択</span><button className="icon-button" onClick={() => handleBulkAction('read')} title="既読"><CheckCircle size={20}/></button><button className="icon-button" onClick={() => handleBulkAction('delete')} title="削除"><Trash2 size={20}/></button><button className="icon-button" onClick={() => setSelectedIds([])} style={{marginLeft: 'auto'}}><X size={18}/></button></div>
              ) : (
                <div className="search-container"><Search size={18} className="search-icon" /><input type="text" className="search-input" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
              )}
              {selectedIds.length === 0 && <div className="filter-group"><button className={`filter-button ${filterUnread ? 'active' : ''}`} onClick={() => setFilterUnread(!filterUnread)}>未読のみ</button></div>}
            </div>
            <div className="list-header list-grid-layout">
              <div className="header-cell"><input type="checkbox" checked={filteredAndSortedEmails.length > 0 && selectedIds.length === filteredAndSortedEmails.length} onChange={(e) => setSelectedIds(e.target.checked ? filteredAndSortedEmails.map(m => m.id) : [])} /></div>
              <div className="header-cell" onClick={() => setSortConfig({ key: 'date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>日時 {renderSortIcon('date')}</div>
              <div className="header-cell" onClick={() => setSortConfig({ key: 'subject', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>件名 {renderSortIcon('subject')}</div>
              <div className="header-cell" onClick={() => setSortConfig({ key: 'aiCategories', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>分類 {renderSortIcon('aiCategories')}</div>
              <div className="header-cell" onClick={() => setSortConfig({ key: 'from', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>送信元 {renderSortIcon('from')}</div>
              <div className="header-cell" style={{ justifyContent: 'center' }}>操作</div>
            </div>
            <div className="email-list">
              {filteredAndSortedEmails.map((email) => (
                <div key={email.id} className={`email-list-item list-grid-layout ${!email.isRead ? 'unread' : ''} ${selectedIds.includes(email.id) ? 'selected' : ''}`}>
                  <div className="cell-checkbox"><input type="checkbox" checked={selectedIds.includes(email.id)} onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, email.id] : prev.filter(i => i !== email.id))} /></div>
                  <div className="cell-date">{email.date}</div>
                  <div className="cell-subject">{!email.isRead && <span className="unread-dot"></span>}<span className="subject-text clickable-subject" onClick={() => setReadingEmail(email)}>{email.subject}</span></div>
                  <div className="cell-category">{email.aiCategories.map((tag, idx) => (<span key={idx} className={getBadgeClass(tag)}><Sparkles size={12} /> {tag}</span>))}</div>
                  <div className="cell-from">{email.from}</div>
                  <div className="cell-actions-container">
                    <div className="item-attachment">{email.hasAttachment && <Paperclip size={18} />}</div>
                    <div className="hover-actions">
                      <button className="hover-btn" onClick={(e) => toggleReadStatus(email.id, e)}><Eye size={18} /></button>
                      <button className="hover-btn" onClick={(e) => deleteEmail(email.id, e)}><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredAndSortedEmails.length === 0 && <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>メールが見つかりません</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;