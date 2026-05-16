import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState, useMemo } from 'react';
import {
  MountainSnow, Mail, Inbox, Sparkles, Paperclip,
  ChevronUp, ChevronDown, RefreshCw, ArrowLeft, Plus, Search,
  CheckCircle, Trash2, X, Eye, Zap, MessageSquare, Calendar, CreditCard,
  Sun, Moon, CornerUpLeft, Send, Star, Reply, FileEdit
} from 'lucide-react';
import './App.css';

const USE_MOCK = false;

type Email = {
  id: string; subject: string; from: string; to?: string; email_address: string; date: string; snippet: string;
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

  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<Email | null>(null);

  const [isSearchingServer, setIsSearchingServer] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // 💡 共通化: 現在のUI上のフォルダからサーバー用のフォルダ名を取得するヘルパー
  const getServerFolder = () => {
    if (activeFolder === "sent") return "sent";
    if (activeFolder === "drafts") return "drafts";
    return "INBOX";
  };

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
    } catch (e) { return dateStr; }
  };

  const formatSenderName = (fromStr: string) => {
    if (!fromStr) return '不明な宛先/送信元';
    const match = fromStr.match(/^"?([^"<]+)"?\s*<.*>$/) || fromStr.match(/^([^<]+)/);
    return match && match[1] ? match[1].trim() : fromStr;
  };

  const extractEmailAddress = (fromStr: string) => {
    if (!fromStr) return '';
    const match = fromStr.match(/<([^>]+)>/);
    return match ? match[1] : fromStr;
  };

  const fetchEmails = async (page: number = 0) => {
    const targetPage = Math.max(0, page);
    setIsRefreshing(true);
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);

    const serverFolder = getServerFolder();

    if (isTauri) {
      try {
        const response = await invoke('get_emails', { folder: serverFolder, page: targetPage, pageSize: PAGE_SIZE }) as { emails: any[], totalCount: number };

        const realEmails: Email[] = response.emails.map((e) => {
          const flags: string[] = e.flags || [];
          return {
            id: String(e.id),
            subject: e.subject || '(件名なし)',
            from: formatSenderName(e.from),
            to: e.to ? formatSenderName(e.to) : undefined,
            email_address: extractEmailAddress(e.from),
            date: formatEmailDate(e.date),
            snippet: '',
            body: '',
            aiCategories: [],
            isRead: flags.some(f => f.toLowerCase().includes('seen')),
            isFlagged: flags.some(f => f.toLowerCase().includes('flagged')),
            isAnswered: flags.some(f => f.toLowerCase().includes('answered')),
            isDraft: flags.some(f => f.toLowerCase().includes('draft')),
            isDeleted: flags.some(f => f.toLowerCase().includes('deleted')),
            hasAttachment: false,
            account: activeAccount
          };
        });

        setEmails(realEmails);
        setCurrentPage(targetPage);
        setHasMore(realEmails.length === PAGE_SIZE);
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setTimeout(() => {
        const mockData: Email[] = [
          { id: "1", account: "work", subject: "【重要】サーバーメンテナンスのお知らせ", from: "管理者", email_address: "admin@example.com", date: formatEmailDate("2026-05-13T10:00:00"), snippet: "", body: "", aiCategories: ["重要"], hasAttachment: true, isRead: false, isFlagged: true, isAnswered: false, isDraft: false, isDeleted: false },
        ];
        setEmails(mockData.filter(m => m.account === activeAccount));
        setCurrentPage(targetPage);
        setHasMore(false);
        setIsRefreshing(false);
      }, 500);
    }
  };

  useEffect(() => { fetchEmails(0); }, [activeAccount, activeFolder]);

  const handlePreviewEmail = (email: Email) => {
    setPreviewEmail(email);
    setIsDrawerOpen(true);
  };

  const handleSelectEmail = async (email: Email) => {
    setIsDrawerOpen(false);
    setReadingEmail(email);
    setIsReadingContent(true);

    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      try {
        const serverFolder = getServerFolder();
        // 💡 本文取得時に対象フォルダを指定
        const content = await invoke<string>('get_email_content', { folder: serverFolder, id: email.id });
        setReadingEmail(prev => prev ? { ...prev, body: content } : null);

        if (!email.isRead) {
          setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
          invoke('add_email_flags', { folder: serverFolder, ids: [email.id], flags: ["Seen"] }).catch(err => console.error("Failed to mark as read:", err));
        }
      } catch (e) {
        console.error("Content fetch error:", e);
        setReadingEmail(prev => prev ? { ...prev, body: "メール本文の取得に失敗しました。接続を確認してください。" } : null);
      } finally {
        setIsReadingContent(false);
      }
    } else {
      setTimeout(() => {
        setReadingEmail(prev => prev ? { ...prev, body: "ダミー本文" } : null);
        setIsReadingContent(false);
      }, 800);
    }
  };

  const handleSendReply = async () => {
    if (!readingEmail || !replyText.trim()) return;
    setIsSending(true);

    try {
      const subject = readingEmail.subject.startsWith('Re:')
          ? readingEmail.subject
          : `Re: ${readingEmail.subject}`;

      await invoke('send_email', {
        to: readingEmail.email_address,
        subject: subject,
        body: replyText
      });

      setIsSending(false);
      setSuccessMessage("メールを送信しました！");

      setTimeout(() => {
        setSuccessMessage(null);
        setReplyText('');
        setReadingEmail(null);
      }, 1500);

    } catch (e) {
      setIsSending(false);
      setErrorMessage(`送信に失敗しました: ${e}`);

      setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
    }
  };

  const handleServerSearch = async (address: string, page: number = 0) => {
    setIsSearchingServer(true);
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);

    if (isTauri) {
      try {
        const serverFolder = getServerFolder();
        const response = await invoke('search_emails_on_server', { folder: serverFolder, address, page, pageSize: PAGE_SIZE }) as { emails: any[], totalCount: number };
        const searchResults: Email[] = response.emails.map((e) => {
          const flags: string[] = e.flags || [];
          return {
            id: String(e.id),
            subject: e.subject || '(件名なし)',
            from: formatSenderName(e.from),
            to: e.to ? formatSenderName(e.to) : undefined,
            email_address: extractEmailAddress(e.from),
            date: formatEmailDate(e.date),
            snippet: '',
            body: '',
            aiCategories: [],
            isRead: flags.some(f => f.toLowerCase().includes('seen')),
            isFlagged: flags.some(f => f.toLowerCase().includes('flagged')),
            isAnswered: flags.some(f => f.toLowerCase().includes('answered')),
            isDraft: flags.some(f => f.toLowerCase().includes('draft')),
            isDeleted: flags.some(f => f.toLowerCase().includes('deleted')),
            hasAttachment: false,
            account: activeAccount
          };
        });

        setEmails(searchResults);
        setCurrentPage(page);
        setHasMore(searchResults.length === PAGE_SIZE);
        setSearchQuery(address);
        setReadingEmail(null);
      } catch (e) {
        console.error("Server search error:", e);
        alert("サーバー検索に失敗しました。");
      } finally {
        setIsSearchingServer(false);
      }
    } else {
      setTimeout(() => {
        setIsSearchingServer(false);
        setSearchQuery(address);
        setReadingEmail(null);
      }, 3000);
    }
  };

  useEffect(() => {
    if (readingEmail && !isReadingContent) {
      setIsAnalyzing(true); setAiDraft(null); setReplyText('');
      const timer = setTimeout(() => setIsAnalyzing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [readingEmail, isReadingContent]);

  const counts = useMemo(() => {
    const accEmails = emails.filter(e => e.account === activeAccount);
    return {
      workHasUnread: emails.some(e => e.account === 'work' && !e.isRead),
      personalHasUnread: emails.some(e => e.account === 'personal' && !e.isRead),
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
      result = result.filter(e =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          (e.email_address && e.email_address.toLowerCase().includes(q))
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = String(a[sortConfig.key]); const bVal = String(b[sortConfig.key]);
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return result.filter(e => !e.isDeleted);
  }, [emails, activeAccount, activeFolder, searchQuery, filterUnread, sortConfig]);

  const currentDisplayCount = useMemo(() => {
    return filteredAndSortedEmails.length > 0
        ? currentPage * PAGE_SIZE + filteredAndSortedEmails.length
        : 0;
  }, [currentPage, filteredAndSortedEmails.length]);

  const renderSortIcon = (k: keyof Email) => {
    if (sortConfig?.key !== k) return <ChevronDown size={14} color="#ccc" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const toggleReadStatus = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const email = emails.find(em => em.id === id);
    if (!email) return;

    const isCurrentlyRead = email.isRead;
    setEmails(prev => prev.map(em => em.id === id ? { ...em, isRead: !isCurrentlyRead } : em));

    if (!USE_MOCK) {
      try {
        const serverFolder = getServerFolder();
        // 💡 操作時にも対象フォルダを指定
        if (isCurrentlyRead) {
          await invoke('remove_email_flags', { folder: serverFolder, ids: [id], flags: ["Seen"] });
        } else {
          await invoke('add_email_flags', { folder: serverFolder, ids: [id], flags: ["Seen"] });
        }
      } catch (err) {
        console.error("Flag update failed", err);
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isRead: isCurrentlyRead } : em));
      }
    }
  };

  const toggleFlagStatus = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const email = emails.find(em => em.id === id);
    if (!email) return;

    const isCurrentlyFlagged = email.isFlagged;
    setEmails(prev => prev.map(em => em.id === id ? { ...em, isFlagged: !isCurrentlyFlagged } : em));

    if (!USE_MOCK) {
      try {
        const serverFolder = getServerFolder();
        if (isCurrentlyFlagged) {
          await invoke('remove_email_flags', { folder: serverFolder, ids: [id], flags: ["Flagged"] });
        } else {
          await invoke('add_email_flags', { folder: serverFolder, ids: [id], flags: ["Flagged"] });
        }
      } catch (err) {
        console.error("Flag update failed", err);
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isFlagged: isCurrentlyFlagged } : em));
      }
    }
  };

  const deleteEmail = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: true } : em));
    if (readingEmail?.id === id) setReadingEmail(null);

    if (!USE_MOCK) {
      try {
        await invoke('delete_emails', { folder: getServerFolder(), ids: [id] });
      } catch (err) {
        console.error("Delete failed", err);
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: false } : em));
      }
    }
  };

  const handleBulkAction = async (action: 'read' | 'delete') => {
    const idsToUpdate = [...selectedIds];
    if (idsToUpdate.length === 0) return;

    if (action === 'read') {
      setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isRead: true } : em));
      setSelectedIds([]);
      if (!USE_MOCK) {
        try {
          await invoke('add_email_flags', { folder: getServerFolder(), ids: idsToUpdate, flags: ["Seen"] });
        } catch(e) { console.error("Bulk read failed", e); }
      }
    } else {
      setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isDeleted: true } : em));
      setSelectedIds([]);
      if (!USE_MOCK) {
        try {
          await invoke('delete_emails', { folder: getServerFolder(), ids: idsToUpdate });
        } catch(e) { console.error("Bulk delete failed", e); }
      }
    }
  };

  return (
      <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
        <div className="account-bar">
          <div className={`account-icon ${activeAccount === 'work' ? 'active' : ''}`} onClick={() => { setActiveAccount('work'); setReadingEmail(null); setIsDrawerOpen(false); }}>W{counts.workHasUnread && <div className="account-dot"></div>}</div>
          <div className={`account-icon ${activeAccount === 'personal' ? 'active' : ''}`} onClick={() => { setActiveAccount('personal'); setReadingEmail(null); setIsDrawerOpen(false); }}>P{counts.personalHasUnread && <div className="account-dot"></div>}</div>
          <div style={{ width: '32px', height: '2px', backgroundColor: '#1f2937', margin: '4px 0' }}></div>
          <div className="account-icon" style={{ border: '1px dashed #4b5563', backgroundColor: 'transparent' }}><Plus size={20} /></div>
        </div>

        <div className="sidebar">
          <div className="sidebar-title"><MountainSnow size={24} color="#60a5fa" /> Annapurna</div>
          <div className="sidebar-label">メイン</div>
          <div className={`sidebar-item ${activeFolder === 'inbox' ? 'active' : ''}`} onClick={() => { setActiveFolder('inbox'); setCurrentPage(0); setReadingEmail(null); setIsDrawerOpen(false); }}>
            <Inbox size={18} /> 受信トレイ {activeFolder === 'inbox' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
          </div>
          <div className={`sidebar-item ${activeFolder === 'sent' ? 'active' : ''}`} onClick={() => { setActiveFolder('sent'); setCurrentPage(0); setReadingEmail(null); setIsDrawerOpen(false); }}>
            <Send size={18} /> 送信済み {activeFolder === 'sent' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
          </div>

          <div className="sidebar-label">AI Smart</div>
          <div className={`sidebar-item ${activeFolder === 'urgent' ? 'active' : ''}`} onClick={() => { setActiveFolder('urgent'); setCurrentPage(0); setReadingEmail(null); setIsDrawerOpen(false); }}><Zap size={18} color="#f59e0b" /> 至急対応 {activeFolder === 'urgent' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}</div>

          <div className="sidebar-label">フォルダ</div>
          <div className={`sidebar-item ${activeFolder === 'flagged' ? 'active' : ''}`} onClick={() => { setActiveFolder('flagged'); setCurrentPage(0); setReadingEmail(null); setIsDrawerOpen(false); }}>
            <Star size={18} color={activeFolder === 'flagged' ? "#eab308" : "currentColor"} /> 星付き {activeFolder === 'flagged' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
          </div>
          <div className={`sidebar-item ${activeFolder === 'drafts' ? 'active' : ''}`} onClick={() => { setActiveFolder('drafts'); setCurrentPage(0); setReadingEmail(null); setIsDrawerOpen(false); }}>
            <FileEdit size={18} /> 下書き {activeFolder === 'drafts' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
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
                    <button className="icon-button" onClick={() => setReadingEmail(null)} disabled={isSearchingServer}><ArrowLeft size={20} /> 戻る</button>
                  </div>

                  {isSearchingServer ? (
                      <div className="server-loading-container">
                        <div className="loading-content">
                          <div className="loading-animation">
                            <div className="pulse-circle"></div>
                            <Search size={48} className="floating-search" />
                          </div>
                          <h3>サーバー内を探索中...</h3>
                          <p className="loading-subtext">過去のメールから "{readingEmail.email_address}" を掘り起こしています</p>
                          <div className="skeleton-lines">
                            <div className="skeleton-line shadow"></div>
                            <div className="skeleton-line shadow"></div>
                            <div className="skeleton-line shadow"></div>
                          </div>
                        </div>
                      </div>
                  ) : (
                      <>
                        <div className="detail-body-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                          <div className="detail-header">
                            <h2 className="detail-subject">
                              {readingEmail.isFlagged && <Star size={20} fill="#eab308" color="#eab308" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />}
                              {readingEmail.subject}
                            </h2>
                            <div className="detail-meta">
                              <div className="sender-info">
                                <span className="sender-name">{readingEmail.from}</span>
                                <span className="sender-address">{`<${readingEmail.email_address}>`}</span>
                                <button
                                    className={`inline-search-btn ${isSearchingServer ? 'loading' : ''}`}
                                    onClick={() => handleServerSearch(readingEmail.email_address, 0)}
                                    disabled={isSearchingServer}
                                    title="サーバーからこのアドレスを検索"
                                >
                                  <Search size={14} />
                                </button>
                              </div>
                              <span>{readingEmail.date}</span>
                            </div>
                          </div>
                          <div className="detail-body" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            {isReadingContent ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#9ca3af' }}>
                                  <RefreshCw size={24} className="spin" style={{ marginRight: '8px' }} /> 読み込み中...
                                </div>
                            ) : (
                                <iframe
                                    title="Email Content"
                                    srcDoc={readingEmail.body}
                                    style={{
                                      width: '100%',
                                      flexGrow: 1,
                                      border: 'none',
                                      backgroundColor: '#ffffff',
                                      minHeight: '400px',
                                    }}
                                    sandbox="allow-same-origin allow-popups"
                                />
                            )}
                          </div>
                        </div>

                        <div style={{ flexShrink: 0, padding: '16px 40px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-header)' }}>
                          <div className="inline-reply-editor" style={{ margin: 0 }}>
                            <div className="reply-to-info"><CornerUpLeft size={16} /> {readingEmail.from} への返信</div>
                            <textarea
                                className="reply-textarea"
                                placeholder="返信内容を入力..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                disabled={isSending}
                                style={{ minHeight: '80px' }}
                            />
                            <div className="reply-toolbar" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)' }}>
                              <button className="send-btn" onClick={handleSendReply} disabled={isSending}>
                                {isSending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                                {isSending ? '送信中...' : '送信する'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                  )}
                </div>
              </div>
          ) : (
              <div className="main-layout-container">
                <div className="email-list-container">
                  <div className="header">
                    <h2>
                      {activeFolder === 'inbox' && <Inbox size={24} />}
                      {activeFolder === 'sent' && <Send size={24} />}
                      {activeFolder === 'urgent' && <Zap size={24} color="#f59e0b" />}
                      {activeFolder === 'flagged' && <Star size={24} />}
                      {activeFolder === 'drafts' && <FileEdit size={24} />}
                      <span style={{ marginLeft: '8px' }}>
                    {activeFolder === 'inbox' && '受信トレイ'}
                        {activeFolder === 'sent' && '送信済み'}
                        {activeFolder === 'urgent' && '至急対応'}
                        {activeFolder === 'flagged' && '星付き'}
                        {activeFolder === 'drafts' && '下書き'}
                  </span>
                    </h2>
                    <button className="icon-button" onClick={() => fetchEmails(currentPage)} disabled={isRefreshing}>
                      <RefreshCw size={20} className={isRefreshing ? "spin" : ""} />
                    </button>
                  </div>

                  <div className="header-controls">
                    {selectedIds.length > 0 ? (
                        <div className="action-bar animate-in">
                          <span className="action-text">{selectedIds.length} 件選択中</span>
                          <div style={{ width: '1px', height: '20px', backgroundColor: '#bfdbfe', margin: '0 4px' }}></div>
                          <button className="icon-button" onClick={() => handleBulkAction('read')} title="既読にする"><CheckCircle size={20} color="#1e40af" /></button>
                          <button className="icon-button" onClick={() => handleBulkAction('delete')} title="削除する"><Trash2 size={20} color="#b91c1c" /></button>
                          <button className="icon-button" onClick={() => setSelectedIds([])} title="選択を解除"><X size={20} /></button>
                        </div>
                    ) : (
                        <div className="search-filter-group">
                          <div className="search-container">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="メールを検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="search-clear-btn"
                                    onClick={() => {
                                      setSearchQuery('');
                                      fetchEmails(0);
                                    }}
                                    title="検索をクリア"
                                >
                                  <X size={16} />
                                </button>
                            )}
                          </div>
                          <button
                              className={`filter-button ${filterUnread ? 'active' : ''}`}
                              onClick={() => setFilterUnread(!filterUnread)}
                          >
                            {filterUnread && <CheckCircle size={14} />}
                            未読のみ
                          </button>
                        </div>
                    )}
                  </div>

                  <div className="list-header list-grid-layout">
                    <div className="header-cell">
                      <input
                          type="checkbox"
                          checked={filteredAndSortedEmails.length > 0 && selectedIds.length === filteredAndSortedEmails.length}
                          onChange={(e) => setSelectedIds(e.target.checked ? filteredAndSortedEmails.map(m => m.id) : [])}
                      />
                    </div>
                    <div className="header-cell"></div>
                    <div className="header-cell" style={{ cursor: 'pointer' }} onClick={() => setSortConfig({ key: 'date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}>
                      日時 {renderSortIcon('date')}
                    </div>
                    <div className="header-cell">件名</div>
                    <div className="header-cell">
                      {activeFolder === 'sent' || activeFolder === 'drafts' ? '送信先' : '送信元'}
                    </div>
                    <div className="header-cell"></div>
                    <div className="header-cell" style={{ justifyContent: 'center' }}>操作</div>
                  </div>

                  <div className="email-list">
                    {filteredAndSortedEmails.map((email) => (
                        <div
                            key={email.id}
                            className={`email-list-item list-grid-layout ${!email.isRead ? 'unread' : ''} ${selectedIds.includes(email.id) ? 'selected' : ''} ${readingEmail?.id === email.id ? 'active' : ''}`}
                            onClick={() => handleSelectEmail(email)}
                        >
                          <div className="cell-checkbox" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(email.id)}
                                onChange={(prev) => setSelectedIds(prev => prev.includes(email.id) ? prev.filter(i => i !== email.id) : [...prev, email.id])}
                            />
                          </div>
                          <div className="cell-flag" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => toggleFlagStatus(email.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              <Star size={16} fill={email.isFlagged ? "#eab308" : "none"} color={email.isFlagged ? "#eab308" : "#9ca3af"} />
                            </button>
                          </div>
                          <div className="cell-date">{email.date}</div>

                          <div className="cell-subject">
                            {!email.isRead && <span className="unread-dot"></span>}
                            <span className="subject-text">{email.subject}</span>
                            <button
                                className="ai-insight-trigger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewEmail(email);
                                }}
                                title="AIインサイトを表示"
                            >
                              <Sparkles size={14} color="#8b5cf6" fill="#f5f3ff" />
                            </button>
                          </div>

                          <div className="cell-from">
                            {activeFolder === 'sent' || activeFolder === 'drafts'
                                ? (email.to || email.from)
                                : email.from}
                          </div>

                          <div className="cell-reply" title="返信済み">{email.isAnswered && <Reply size={16} />}</div>

                          <div className="cell-actions-container">
                            <div className="item-attachment">{email.hasAttachment && <Paperclip size={18} />}</div>
                            <div className="hover-actions" onClick={(e) => e.stopPropagation()}>
                              <button className="hover-btn" onClick={(e) => toggleReadStatus(email.id, e)} title={email.isRead ? "未読にする" : "既読にする"}><Eye size={18} /></button>
                              <button className="hover-btn" onClick={(e) => deleteEmail(email.id, e)} title="削除"><Trash2 size={18} /></button>
                            </div>
                          </div>
                        </div>
                    ))}
                    {filteredAndSortedEmails.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>メールが見つかりません</div>}
                  </div>

                  <div className="pagination-bar">
                    <div className="total-count-info">
                      {filteredAndSortedEmails.length > 0
                          ? `${currentPage * PAGE_SIZE + 1} - ${currentDisplayCount} 件表示`
                          : "0 件表示"}
                    </div>
                    <div className="pager-controls">
                      <button
                          className="pager-btn"
                          disabled={currentPage === 0 || isRefreshing}
                          onClick={() => fetchEmails(currentPage - 1)}
                      >
                        前へ
                      </button>
                      <span className="page-number">{currentPage + 1}</span>
                      <button
                          className="pager-btn"
                          disabled={!hasMore || isRefreshing}
                          onClick={() => fetchEmails(currentPage + 1)}
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                </div>

                <aside className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
                  <div className="drawer-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={18} color="#8b5cf6" />
                      <span style={{ fontWeight: 700 }}>AI インサイト</span>
                    </div>
                    <button className="icon-button" onClick={() => setIsDrawerOpen(false)}><X size={20} /></button>
                  </div>
                  <div className="drawer-content">
                    {previewEmail && (
                        <>
                          <div className="insight-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', marginBottom: 8 }}>
                              <Zap size={16} /> <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>AIスコア: 85点</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                              このメールはプロジェクトの進捗に関する重要な確認事項を含んでいる可能性があります。
                            </p>
                          </div>

                          <h3 style={{ fontSize: '1.1rem', marginBottom: 8, lineHeight: 1.4 }}>{previewEmail.subject}</h3>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
                            From: {previewEmail.from}
                          </div>

                          <div className="ai-section" style={{ marginBottom: 24 }}>
                            <div className="ai-section-title" style={{ marginBottom: 12 }}>予測されるアクション</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <span className="badge badge-update" style={{ padding: '6px 12px', borderRadius: '6px' }}>返信が必要</span>
                              <span className="badge" style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)' }}>後で読む</span>
                            </div>
                          </div>

                          <div className="ai-section">
                            <div className="ai-section-title" style={{ marginBottom: 12 }}>クイックサマリー</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', opacity: 0.8 }}>
                              本文を読み込んでAIがここに短い要約を表示します。
                            </div>
                          </div>

                          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                            <button
                                className="send-btn"
                                style={{ width: '100%', justifyContent: 'center', height: '44px' }}
                                onClick={() => handleSelectEmail(previewEmail)}
                            >
                              本文を開く
                            </button>
                          </div>
                        </>
                    )}
                  </div>
                </aside>
              </div>
          )}

          {(isRefreshing || isSending || successMessage || errorMessage) && (
              <div className="global-loading-overlay">
                <div
                    className="global-loading-content"
                    style={{
                      borderColor: successMessage ? '#10b981' : (errorMessage ? '#ef4444' : 'var(--border-color)')
                    }}
                >
                  {(isRefreshing || isSending) && <RefreshCw size={48} className="spin global-loading-spinner" />}
                  {successMessage && <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px' }} />}
                  {errorMessage && <X size={48} color="#ef4444" style={{ marginBottom: '16px' }} />}

                  <div
                      className="global-loading-text"
                      style={{
                        color: successMessage ? '#10b981' : (errorMessage ? '#ef4444' : 'var(--text-main)')
                      }}
                  >
                    {isRefreshing && '読み込み中...'}
                    {isSending && '送信中...'}
                    {successMessage}
                    {errorMessage}
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
  );
}

export default App;