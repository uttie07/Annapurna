import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState, useMemo } from 'react';
import {
  MountainSnow, Mail, Inbox, Sparkles, Paperclip,
  ChevronUp, ChevronDown, RefreshCw, ArrowLeft, Plus, Search,
  CheckCircle, Trash2, X, Eye, Zap, MessageSquare, Calendar, CreditCard,
  Sun, Moon, CornerUpLeft, Send, Star, Reply, FileEdit
} from 'lucide-react';
import './App.css';

type Email = {
  id: string; subject: string; from: string; date: string; snippet: string;
  body: string; aiCategories: string[]; account: string; hasAttachment: boolean;
  isRead: boolean; isFlagged: boolean; isAnswered: boolean; isDraft: boolean; isDeleted: boolean;
};

type SortConfig = { key: keyof Email; direction: 'asc' | 'desc'; } | null;

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [readingEmail, setReadingEmail] = useState<Email | null>(null);
  const [isReadingContent, setIsReadingContent] = useState<boolean>(false);

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

  // 日時の整形用ヘルパー関数
  const formatEmailDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch (e) {
      return dateStr;
    }
  };

  // 送信元から名前だけを抽出するヘルパー関数
  const formatSenderName = (fromStr: string) => {
    if (!fromStr) return '不明な送信元';
    const match = fromStr.match(/^"?([^"<]+)"?\s*<.*>$/) || fromStr.match(/^([^<]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return fromStr;
  };

  const fetchEmails = async () => {
    setIsRefreshing(true);
    const isTauri = '__TAURI_INTERNALS__' in window;

    if (isTauri) {
      try {
        const data = await invoke('get_emails') as any[];
        const realEmails: Email[] = data.map((e) => {
          const flags = e.flags || [];
          return {
            id: String(e.id),
            subject: e.subject || '(件名なし)',
            from: formatSenderName(e.from),
            date: formatEmailDate(e.date),
            snippet: '',
            body: '',
            aiCategories: [],
            // email-libの標準フラグ 'Seen' があれば既読
            isRead: flags.includes('Seen'),
            isFlagged: flags.includes('Flagged'),
            isAnswered: flags.includes('Answered'),
            isDraft: flags.includes('Draft'),
            isDeleted: flags.includes('Deleted'),
            hasAttachment: false, // 添付ファイル判定は今後の拡張
            account: activeAccount
          };
        });
        setEmails(realEmails);
      } catch (e) {
        console.error("Rust呼び出しエラー:", e);
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // ブラウザ用モック
      setTimeout(() => {
        const mockData: Email[] = [
          { id: "1", account: "work", subject: "【重要】サーバーメンテナンスのお知らせ", from: "管理者", date: "2026-05-13 10:00", snippet: "", body: "", aiCategories: ["重要"], hasAttachment: true, isRead: false, isFlagged: true, isAnswered: false, isDraft: false, isDeleted: false },
          { id: "2", account: "work", subject: "Re: 今週のプロジェクト進捗ミーティング", from: "プロジェクトリーダー", date: "2026-05-12 14:30", snippet: "", body: "", aiCategories: ["会議"], hasAttachment: false, isRead: true, isFlagged: false, isAnswered: true, isDraft: false, isDeleted: false },
          { id: "3", account: "personal", subject: "GitHub: 5 new notifications", from: "GitHub", date: "2026-05-11 08:15", snippet: "", body: "", aiCategories: ["通知"], hasAttachment: false, isRead: false, isFlagged: false, isAnswered: false, isDraft: false, isDeleted: false },
        ];
        setEmails(mockData.filter(m => m.account === activeAccount));
        setIsRefreshing(false);
      }, 500);
    }
  };

  useEffect(() => { fetchEmails(); }, [activeAccount]);

  const handleSelectEmail = async (email: Email) => {
    setReadingEmail(email);
    setIsReadingContent(true);
    const isTauri = '__TAURI_INTERNALS__' in window;

    if (isTauri) {
      try {
        const content = await invoke<string>('get_email_content', { id: email.id });
        setReadingEmail(prev => prev ? { ...prev, body: content } : null);
        // 読んだら既読にする（UI上の即時反映）
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
      } catch (e) {
        console.error(e);
        setReadingEmail(prev => prev ? { ...prev, body: "本文の取得に失敗しました。" } : null);
      } finally {
        setIsReadingContent(false);
      }
    } else {
      setTimeout(() => {
        setReadingEmail(prev => prev ? { ...prev, body: "これはブラウザ用のダミー本文です。" } : null);
        setIsReadingContent(false);
      }, 800);
    }
  };

  // AI解析シミュレーション
  useEffect(() => {
    if (readingEmail && !isReadingContent) {
      setIsAnalyzing(true);
      setAiDraft(null);
      setReplyText('');
      const timer = setTimeout(() => setIsAnalyzing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [readingEmail, isReadingContent]);

  const counts = useMemo(() => {
    const accEmails = emails.filter(e => e.account === activeAccount);
    return {
      workHasUnread: emails.some(e => e.account === 'work' && !e.isRead),
      personalHasUnread: emails.some(e => e.account === 'personal' && !e.isRead),
      inboxCount: accEmails.filter(e => !e.isRead && !e.isDeleted && !e.isDraft).length,
      urgentCount: accEmails.filter(e => e.aiCategories.includes("重要") || e.aiCategories.includes("至急")).length,
      flaggedCount: accEmails.filter(e => e.isFlagged && !e.isDeleted).length,
    };
  }, [emails, activeAccount]);

  const filteredAndSortedEmails = useMemo(() => {
    let result = emails.filter(e => e.account === activeAccount);
    if (activeFolder === 'urgent') result = result.filter(e => e.aiCategories.includes("重要") || e.aiCategories.includes("至急"));
    else if (activeFolder === 'flagged') result = result.filter(e => e.isFlagged && !e.isDeleted);
    else if (activeFolder === 'drafts') result = result.filter(e => e.isDraft && !e.isDeleted);

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
      setAiDraft(tone === '承諾' ? "お疲れ様です。内村です。内容承知いたしました。" : "お疲れ様です。内村です。一点確認させてください。");
      setIsDrafting(false);
    }, 600);
  };

  const toggleReadStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isRead: !e.isRead } : e));
  };

  const toggleFlagStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isFlagged: !e.isFlagged } : e));
  };

  const deleteEmail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isDeleted: true } : e));
    if (readingEmail?.id === id) setReadingEmail(null);
  };

  const handleBulkAction = (action: 'read' | 'delete') => {
    if (action === 'read') {
      setEmails(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, isRead: true } : e));
    } else {
      setEmails(prev => prev.map(e => selectedIds.includes(e.id) ? { ...e, isDeleted: true } : e));
    }
    setSelectedIds([]);
  };

  return (
      <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
        <div className="account-bar">
          <div className={`account-icon ${activeAccount === 'work' ? 'active' : ''}`} onClick={() => { setActiveAccount('work'); setReadingEmail(null); }}>W{counts.workHasUnread && <div className="account-dot"></div>}</div>
          <div className={`account-icon ${activeAccount === 'personal' ? 'active' : ''}`} onClick={() => { setActiveAccount('personal'); setReadingEmail(null); }}>P{counts.personalHasUnread && <div className="account-dot"></div>}</div>
          <div style={{ width: '32px', height: '2px', backgroundColor: '#1f2937', margin: '4px 0' }}></div>
          <div className="account-icon" style={{ border: '1px dashed #4b5563', backgroundColor: 'transparent' }}><Plus size={20} /></div>
        </div>

        <div className="sidebar">
          <div className="sidebar-title"><MountainSnow size={24} color="#60a5fa" /> Annapurna</div>
          <div className="sidebar-label">メイン</div>
          <div className={`sidebar-item ${activeFolder === 'inbox' ? 'active' : ''}`} onClick={() => { setActiveFolder('inbox'); setReadingEmail(null); }}>
            <Inbox size={18} /> 受信トレイ {counts.inboxCount > 0 && <span className="sidebar-unread-count">{counts.inboxCount}</span>}
          </div>
          <div className="sidebar-label">AI Smart</div>
          <div className={`sidebar-item ${activeFolder === 'urgent' ? 'active' : ''}`} onClick={() => { setActiveFolder('urgent'); setReadingEmail(null); }}><Zap size={18} color="#f59e0b" /> 至急対応 {counts.urgentCount > 0 && <span className="sidebar-unread-count">{counts.urgentCount}</span>}</div>
          <div className="sidebar-label">フォルダ</div>
          <div className={`sidebar-item ${activeFolder === 'flagged' ? 'active' : ''}`} onClick={() => { setActiveFolder('flagged'); setReadingEmail(null); }}>
            <Star size={18} color={activeFolder === 'flagged' ? "#eab308" : "currentColor"} /> 星付き {counts.flaggedCount > 0 && <span className="sidebar-unread-count">{counts.flaggedCount}</span>}
          </div>
          <div className={`sidebar-item ${activeFolder === 'drafts' ? 'active' : ''}`} onClick={() => { setActiveFolder('drafts'); setReadingEmail(null); }}>
            <FileEdit size={18} /> 下書き
          </div>
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
                      <h2 className="detail-subject">
                        {readingEmail.isFlagged && <Star size={20} fill="#eab308" color="#eab308" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />}
                        {readingEmail.subject}
                      </h2>
                      <div className="detail-meta"><span>{readingEmail.from}</span><span>{readingEmail.date}</span></div>
                    </div>
                    <div className="detail-body">
                      {isReadingContent ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#9ca3af' }}>
                            <RefreshCw size={24} className="spin" style={{ marginRight: '8px' }} /> 読み込み中...
                          </div>
                      ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{readingEmail.body}</div>
                      )}
                    </div>
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
                  <div className="ai-panel-title"><Sparkles size={20} color="#8b5cf6" /> Annapurna AI</div>
                  {isAnalyzing ? (
                      <div className="ai-loading"><RefreshCw size={24} className="spin" color="#8b5cf6" /><span>解析中...</span></div>
                  ) : (
                      <>
                        <div className="ai-section"><div className="ai-section-title"><Zap size={14} /> 3行要約</div><div className="ai-summary-text">・AI要約がここに表示されます。</div></div>
                        <div className="ai-section">
                          <div className="ai-section-title"><MessageSquare size={14} /> 返信提案</div>
                          <div className="ai-draft-options">
                            <button className="draft-suggest-btn" onClick={() => generateDraft('承諾')}>承知した</button>
                          </div>
                          {isDrafting ? (
                              <div className="ai-loading" style={{ height: '60px' }}><RefreshCw size={16} className="spin" /><span>生成中...</span></div>
                          ) : aiDraft && (
                              <div className="ai-draft-result">
                                <div className="ai-draft-content">{aiDraft}</div>
                                <button className="icon-button" onClick={() => setReplyText(aiDraft)}><CheckCircle size={14} /> 反映</button>
                              </div>
                          )}
                        </div>
                      </>
                  )}
                </aside>
              </div>
          ) : (
              <>
                <div className="header"><h2><Inbox size={24} /> {activeFolder === 'inbox' ? '受信トレイ' : 'フォルダ'}</h2><button className="icon-button" onClick={fetchEmails} disabled={isRefreshing}><RefreshCw size={20} className={isRefreshing ? "spin" : ""} /></button></div>
                <div className="header-controls">
                  {selectedIds.length > 0 ? (
                      <div className="action-bar"><span className="action-text">{selectedIds.length} 件選択</span><button className="icon-button" onClick={() => handleBulkAction('read')} title="既読"><CheckCircle size={20} /></button><button className="icon-button" onClick={() => handleBulkAction('delete')} title="削除"><Trash2 size={20} /></button></div>
                  ) : (
                      <div className="search-container"><Search size={18} className="search-icon" /><input type="text" className="search-input" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                  )}
                  {selectedIds.length === 0 && <div className="filter-group"><button className={`filter-button ${filterUnread ? 'active' : ''}`} onClick={() => setFilterUnread(!filterUnread)}>未読のみ</button></div>}
                </div>
                <div className="list-header list-grid-layout">
                  <div className="header-cell"><input type="checkbox" checked={filteredAndSortedEmails.length > 0 && selectedIds.length === filteredAndSortedEmails.length} onChange={(e) => setSelectedIds(e.target.checked ? filteredAndSortedEmails.map(m => m.id) : [])} /></div>
                  <div className="header-cell" onClick={() => setSortConfig({ key: 'date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>日時 {renderSortIcon('date')}</div>
                  <div className="header-cell" onClick={() => setSortConfig({ key: 'subject', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>件名 {renderSortIcon('subject')}</div>
                  <div className="header-cell">ステータス</div>
                  <div className="header-cell" onClick={() => setSortConfig({ key: 'from', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>送信元 {renderSortIcon('from')}</div>
                  <div className="header-cell" style={{ justifyContent: 'center' }}>操作</div>
                </div>
                <div className="email-list">
                  {filteredAndSortedEmails.map((email) => (
                      <div key={email.id} className={`email-list-item list-grid-layout ${!email.isRead ? 'unread' : ''} ${selectedIds.includes(email.id) ? 'selected' : ''}`}>
                        <div className="cell-checkbox"><input type="checkbox" checked={selectedIds.includes(email.id)} onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, email.id] : prev.filter(i => i !== email.id))} /></div>
                        <div className="cell-date">{email.date}</div>
                        <div className="cell-subject">
                          {!email.isRead && <span className="unread-dot"></span>}
                          <span className="subject-text clickable-subject" onClick={() => handleSelectEmail(email)}>{email.subject}</span>
                        </div>
                        <div className="cell-category" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button onClick={(e) => toggleFlagStatus(email.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            <Star size={16} fill={email.isFlagged ? "#eab308" : "none"} color={email.isFlagged ? "#eab308" : "#9ca3af"} />
                          </button>
                          {email.isAnswered && <Reply size={16} color="#10b981" />}
                          {email.aiCategories.map((tag, idx) => (<span key={idx} className={getBadgeClass(tag)}><Sparkles size={12} /> {tag}</span>))}
                        </div>
                        <div className="cell-from">{email.from}</div>
                        <div className="cell-actions-container">
                          <div className="item-attachment">{email.hasAttachment && <Paperclip size={18} />}</div>
                          <div className="hover-actions">
                            <button className="hover-btn" onClick={(e) => toggleReadStatus(email.id, e)} title={email.isRead ? "未読にする" : "既読にする"}><Eye size={18} /></button>
                            <button className="hover-btn" onClick={(e) => deleteEmail(email.id, e)} title="削除"><Trash2 size={18} /></button>
                          </div>
                        </div>
                      </div>
                  ))}
                  {filteredAndSortedEmails.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>メールが見つかりません</div>}
                </div>
              </>
          )}
        </div>
      </div>
  );
}

export default App;