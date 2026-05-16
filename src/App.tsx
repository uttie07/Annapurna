import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState, useMemo } from 'react';
import {
  MountainSnow, Mail, Inbox, Sparkles, Paperclip, Download,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  RefreshCw, ArrowLeft, Plus, Search,
  CheckCircle, Trash2, X, Eye, Zap, MessageSquare, Calendar, CreditCard,
  Sun, Moon, CornerUpLeft, Send, Star, Reply, FileEdit, ReplyAll, Users
} from 'lucide-react';
import './App.css';

const USE_MOCK = false;

type Email = {
  id: string; subject: string; from: string; to?: string; email_address: string; date: string; snippet: string;
  body: string; aiCategories: string[]; account: string;
  isRead: boolean; isFlagged: boolean; isAnswered: boolean; isDraft: boolean; isDeleted: boolean;
  attachmentsList?: string[];
};

type EmailDetailResponse = {
  body: string;
  attachments: string[];
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showComposeCcBcc, setShowComposeCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isComposeSending, setIsComposeSending] = useState(false);
  const [composingDraftId, setComposingDraftId] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'reply' | 'replyAll'>('reply');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [showReplyCcBcc, setShowReplyCcBcc] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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
          { id: "1", account: "work", subject: "ダミーのメール", from: "管理者", email_address: "admin@example.com", date: formatEmailDate("2026-05-13T10:00:00"), snippet: "", body: "", aiCategories: ["重要"], isRead: false, isFlagged: true, isAnswered: false, isDraft: false, isDeleted: false },
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

    if (activeFolder === 'drafts') {
      setIsComposeOpen(true);
      setComposeTo(email.to || email.from || '');
      setComposeCc('');
      setComposeBcc('');
      setShowComposeCcBcc(false);
      setComposeSubject(email.subject === '(件名なし)' ? '' : email.subject);
      setComposeBody('');
      setComposingDraftId(email.id);
      setIsLoadingDraft(true);

      const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
      if (isTauri) {
        try {
          const serverFolder = getServerFolder();
          const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { folder: serverFolder, id: email.id });

          let rawBody = contentResponse.body;
          if (rawBody.includes('<html') || rawBody.includes('<div')) {
            const div = document.createElement('div');
            div.innerHTML = rawBody;
            rawBody = div.innerText || div.textContent || '';
          }
          setComposeBody(rawBody.trim());
        } catch(e) {
          console.error(e);
          alert("下書きの読み込みに失敗しました");
        } finally {
          setIsLoadingDraft(false);
        }
      } else {
        setTimeout(() => {
          setComposeBody("ダミーの下書き本文");
          setIsLoadingDraft(false);
        }, 500);
      }
      return;
    }

    setReadingEmail(email);
    setIsReadingContent(true);

    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      try {
        const serverFolder = getServerFolder();
        const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { folder: serverFolder, id: email.id });

        let formattedBody = contentResponse.body;
        // 💡 追加: プレーンテキスト（HTMLタグが含まれない）の場合は、見やすいフォントと改行を適用
        if (!/<[a-z][\s\S]*>/i.test(formattedBody)) {
          formattedBody = `<div style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px; padding: 16px; color: #333;">${formattedBody}</div>`;
        }

        setReadingEmail(prev => prev ? { ...prev, body: formattedBody, attachmentsList: contentResponse.attachments } : null);

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
        setReadingEmail(prev => prev ? { ...prev, body: "ダミー本文", attachmentsList: ["report.pdf", "image.png"] } : null);
        setIsReadingContent(false);
      }, 800);
    }
  };

  const handleDownloadAttachment = async (filename: string) => {
    if (!readingEmail) return;
    setIsDownloading(true);
    try {
      const serverFolder = getServerFolder();
      const bytes = await invoke<number[]>('download_attachment', {
        folder: serverFolder,
        id: readingEmail.id,
        filename
      });

      const uint8Array = new Uint8Array(bytes);
      const blob = new Blob([uint8Array]);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(`ダウンロードに失敗しました: ${e}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // 💡 修正: 「返信」「全員に返信」ボタンを押したタイミングで引用文を挿入する
  const handleSetReplyType = (type: 'reply' | 'replyAll') => {
    setReplyType(type);

    // まだテキストが入力されていない（空の）場合のみ、引用文を生成して挿入
    if (!replyText.trim() && readingEmail) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = readingEmail.body;
      const plainText = tempDiv.innerText || tempDiv.textContent || "";
      const quote = `\n\n\n--- 引用 ---\n${readingEmail.date} ${readingEmail.from} wrote:\n> ${plainText.split(/\r?\n/).join('\n> ')}`;
      setReplyText(quote);
    }

    if (type === 'replyAll' && readingEmail?.to) {
      setReplyCc(readingEmail.to);
      setShowReplyCcBcc(true);
    } else {
      setReplyCc('');
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
        cc: replyCc || null,
        bcc: replyBcc || null,
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

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return;
    setIsComposeSending(true);

    try {
      await invoke('send_email', {
        to: composeTo,
        cc: composeCc || null,
        bcc: composeBcc || null,
        subject: composeSubject || '(件名なし)',
        body: composeBody
      });

      if (composingDraftId) {
        await invoke('delete_emails', { folder: 'drafts', ids: [composingDraftId] });
      }

      setIsComposeSending(false);
      setIsComposeOpen(false);
      setSuccessMessage("メールを送信しました！");

      setTimeout(() => {
        setSuccessMessage(null);
        setComposeTo('');
        setComposeCc('');
        setComposeBcc('');
        setShowComposeCcBcc(false);
        setComposeSubject('');
        setComposeBody('');
        setComposingDraftId(null);
        if (activeFolder === 'drafts') fetchEmails(0);
      }, 1500);

    } catch (e) {
      setIsComposeSending(false);
      setErrorMessage(`送信に失敗しました: ${e}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleCloseCompose = async () => {
    if (composeTo.trim() || composeBody.trim() || composeSubject.trim()) {
      if (window.confirm("書きかけのメールを下書きに保存しますか？")) {
        setIsComposeSending(true);
        try {
          await invoke('save_draft', {
            to: composeTo,
            cc: composeCc || null,
            bcc: composeBcc || null,
            subject: composeSubject,
            body: composeBody
          });

          if (composingDraftId) {
            await invoke('delete_emails', { folder: 'drafts', ids: [composingDraftId] });
          }

          setSuccessMessage("下書きを保存しました");
          if (activeFolder === 'drafts') fetchEmails(0);
          setTimeout(() => setSuccessMessage(null), 1500);
        } catch (e) {
          alert(`保存に失敗しました: ${e}`);
        }
        setIsComposeSending(false);
      }
    }
    setIsComposeOpen(false);
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowComposeCcBcc(false);
    setComposeSubject('');
    setComposeBody('');
    setComposingDraftId(null);
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

  // 💡 修正: 詳細画面を開いた直後はフォームを完全に空にする
  useEffect(() => {
    if (readingEmail && !isReadingContent) {
      setIsAnalyzing(true); setAiDraft(null);
      setReplyText(''); // 意図的に空白にしておく
      setReplyCc('');
      setReplyBcc('');
      setShowReplyCcBcc(false);
      setReplyType('reply');

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
    else if (activeFolder === 'drafts') result = result.filter(e => !e.isDeleted);
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

        <div className="main-content" style={{ position: 'relative' }}>
          {readingEmail ? (
              <div className="email-detail-split" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="email-detail-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="detail-toolbar" style={{ flexShrink: 0 }}>
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
                        <div className="detail-body-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                          <div className="detail-header" style={{ flexShrink: 0 }}>
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

                          {readingEmail.attachmentsList && readingEmail.attachmentsList.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 32px 16px 32px', flexShrink: 0 }}>
                                {readingEmail.attachmentsList.map((filename, idx) => (
                                    <div
                                        key={`${filename}-${idx}`}
                                        onClick={() => handleDownloadAttachment(filename)}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: '8px',
                                          padding: '8px 14px',
                                          backgroundColor: 'var(--bg-app)',
                                          border: '1px solid var(--border-color)',
                                          borderRadius: '8px',
                                          fontSize: '0.85rem',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          color: 'var(--text-main)',
                                          fontWeight: 500
                                        }}
                                        onMouseOver={(e) => {
                                          e.currentTarget.style.backgroundColor = '#e0f2fe';
                                          e.currentTarget.style.borderColor = '#93c5fd';
                                        }}
                                        onMouseOut={(e) => {
                                          e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                                          e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }}
                                        title="クリックしてダウンロード"
                                    >
                                      <Paperclip size={16} color="#3b82f6" />
                                      {filename}
                                      <Download size={14} style={{ marginLeft: '4px', opacity: 0.5 }} />
                                    </div>
                                ))}
                              </div>
                          )}

                          <div className="detail-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 32px 16px 32px' }}>
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
                                      height: '100%',
                                      flex: 1,
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '8px',
                                      backgroundColor: '#ffffff',
                                      minHeight: '50vh'
                                    }}
                                    sandbox="allow-same-origin allow-popups"
                                />
                            )}
                          </div>
                        </div>

                        <div style={{ flexShrink: 0, padding: '12px 32px 16px 32px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-header)' }}>
                          <div className="inline-reply-editor" style={{ margin: 0, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>

                            {/* 💡 修正: ここをクリックしたタイミングで引用文が挿入されます */}
                            <div className="reply-to-info" style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => handleSetReplyType('reply')}
                                    style={{ display: 'flex', alignItems: 'center', fontWeight: replyType === 'reply' ? 'bold' : 'normal', color: replyType === 'reply' ? 'var(--text-main)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                  <CornerUpLeft size={14} style={{ marginRight: '4px' }} /> 返信
                                </button>
                                <button
                                    onClick={() => handleSetReplyType('replyAll')}
                                    style={{ display: 'flex', alignItems: 'center', fontWeight: replyType === 'replyAll' ? 'bold' : 'normal', color: replyType === 'replyAll' ? 'var(--text-main)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                    title="元の宛先(To)全員を含める"
                                >
                                  <ReplyAll size={14} style={{ marginRight: '4px' }} /> 全員に返信
                                </button>
                              </div>
                              <button
                                  onClick={() => setShowReplyCcBcc(!showReplyCcBcc)}
                                  style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                {showReplyCcBcc ? 'Cc/Bccを隠す' : 'Cc/Bccを追加'}
                              </button>
                            </div>

                            {showReplyCcBcc && (
                                <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', padding: '6px 12px', gap: '6px', backgroundColor: 'var(--bg-header)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '30px' }}>Cc:</span>
                                    <input type="text" value={replyCc} onChange={e => setReplyCc(e.target.value)} disabled={isSending} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-main)' }} placeholder="追加の宛先..." />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '30px' }}>Bcc:</span>
                                    <input type="text" value={replyBcc} onChange={e => setReplyBcc(e.target.value)} disabled={isSending} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-main)' }} placeholder="追加の宛先..." />
                                  </div>
                                </div>
                            )}

                            <textarea
                                className="reply-textarea"
                                placeholder="返信内容を入力..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                disabled={isSending}
                                style={{ minHeight: '120px', border: 'none', backgroundColor: 'transparent' }}
                            />
                            <div className="reply-toolbar" style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-header)' }}>
                              <button className="send-btn" onClick={handleSendReply} disabled={isSending || !replyText.trim()} style={{ height: '32px', fontSize: '0.85rem' }}>
                                {isSending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
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

                  <div className="header-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {selectedIds.length > 0 ? (
                          <div className="action-bar animate-in" style={{ margin: 0 }}>
                            <span className="action-text">{selectedIds.length} 件選択中</span>
                            <div style={{ width: '1px', height: '20px', backgroundColor: '#bfdbfe', margin: '0 4px' }}></div>
                            <button className="icon-button" onClick={() => handleBulkAction('read')} title="既読にする"><CheckCircle size={20} color="#1e40af" /></button>
                            <button className="icon-button" onClick={() => handleBulkAction('delete')} title="削除する"><Trash2 size={20} color="#b91c1c" /></button>
                            <button className="icon-button" onClick={() => setSelectedIds([])} title="選択を解除"><X size={20} /></button>
                          </div>
                      ) : (
                          <div className="search-filter-group" style={{ margin: 0 }}>
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
                                  <button className="search-clear-btn" onClick={() => { setSearchQuery(''); fetchEmails(0); }} title="検索をクリア">
                                    <X size={16} />
                                  </button>
                              )}
                            </div>
                            <button className={`filter-button ${filterUnread ? 'active' : ''}`} onClick={() => setFilterUnread(!filterUnread)}>
                              {filterUnread && <CheckCircle size={14} />} 未読のみ
                            </button>
                          </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>
                    {filteredAndSortedEmails.length > 0
                        ? `${currentPage * PAGE_SIZE + 1} - ${currentDisplayCount} 件`
                        : "0 件"}
                  </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            className="icon-button"
                            style={{ padding: '4px', width: '28px', height: '28px' }}
                            disabled={currentPage === 0 || isRefreshing}
                            onClick={() => fetchEmails(currentPage - 1)}
                            title="前のページ"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                            className="icon-button"
                            style={{ padding: '4px', width: '28px', height: '28px' }}
                            disabled={!hasMore || isRefreshing}
                            onClick={() => fetchEmails(currentPage + 1)}
                            title="次のページ"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
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

                          <div className="cell-actions-container">
                            <div className="cell-reply" title="返信済み" style={{ marginRight: '8px' }}>{email.isAnswered && <Reply size={16} />}</div>
                            <div className="hover-actions" onClick={(e) => e.stopPropagation()}>
                              <button className="hover-btn" onClick={(e) => toggleReadStatus(email.id, e)} title={email.isRead ? "未読にする" : "既読にする"}><Eye size={18} /></button>
                              <button className="hover-btn" onClick={(e) => deleteEmail(email.id, e)} title="削除"><Trash2 size={18} /></button>
                            </div>
                          </div>
                        </div>
                    ))}
                    {filteredAndSortedEmails.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>メールが見つかりません</div>}
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

          {!readingEmail && (
              <button
                  onClick={() => {
                    setIsComposeOpen(true);
                    setComposeTo('');
                    setComposeCc('');
                    setComposeBcc('');
                    setShowComposeCcBcc(false);
                    setComposeSubject('');
                    setComposeBody('');
                    setComposingDraftId(null);
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '32px',
                    right: '32px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '30px',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                    border: 'none',
                    cursor: 'pointer',
                    zIndex: 50,
                    transition: 'transform 0.2s'
                  }}
                  title="新規メール作成"
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Plus size={28} />
              </button>
          )}

          {isComposeOpen && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
                display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}>
                <div style={{
                  width: '600px', maxWidth: '90%', height: '500px',
                  backgroundColor: 'var(--bg-main)', borderRadius: '12px',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
                      {composingDraftId ? '下書きを編集' : '新規メッセージ'}
                    </h3>
                    <button className="icon-button" onClick={handleCloseCompose}><X size={20} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 20px', gap: '12px', position: 'relative' }}>

                    {isLoadingDraft && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-main)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, opacity: 0.8 }}>
                          <RefreshCw size={32} className="spin" color="#3b82f6" />
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                      <input
                          type="text"
                          placeholder="宛先 (例: test@example.com)"
                          value={composeTo}
                          onChange={e => setComposeTo(e.target.value)}
                          disabled={isComposeSending}
                          style={{ flex: 1, padding: '10px 0', border: 'none', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem' }}
                      />
                      {!showComposeCcBcc && (
                          <button onClick={() => setShowComposeCcBcc(true)} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Cc/Bcc
                          </button>
                      )}
                    </div>

                    {showComposeCcBcc && (
                        <>
                          <input type="text" placeholder="Cc" value={composeCc} onChange={e => setComposeCc(e.target.value)} disabled={isComposeSending} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem' }} />
                          <input type="text" placeholder="Bcc" value={composeBcc} onChange={e => setComposeBcc(e.target.value)} disabled={isComposeSending} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem' }} />
                        </>
                    )}

                    <input
                        type="text"
                        placeholder="件名"
                        value={composeSubject}
                        onChange={e => setComposeSubject(e.target.value)}
                        disabled={isComposeSending}
                        style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem', fontWeight: 'bold' }}
                    />
                    <textarea
                        placeholder="本文を入力..."
                        value={composeBody}
                        onChange={e => setComposeBody(e.target.value)}
                        disabled={isComposeSending}
                        style={{ width: '100%', flex: 1, padding: '12px 0', border: 'none', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', resize: 'none', fontSize: '0.95rem', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', backgroundColor: 'var(--bg-header)', borderTop: '1px solid var(--border-color)' }}>
                    <button className="icon-button" style={{ color: 'var(--text-muted)' }} title="添付ファイル（準備中）"><Paperclip size={18} /></button>
                    <button
                        className="send-btn"
                        onClick={handleComposeSend}
                        disabled={isComposeSending || !composeTo.trim() || !composeBody.trim()}
                        style={{ padding: '8px 24px' }}
                    >
                      {isComposeSending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
                      {isComposeSending ? '送信中...' : '送信する'}
                    </button>
                  </div>
                </div>
              </div>
          )}

          {(isRefreshing || isSending || isComposeSending || isDownloading || successMessage || errorMessage) && (
              <div className="global-loading-overlay" style={{ zIndex: 1100 }}>
                <div
                    className="global-loading-content"
                    style={{
                      borderColor: successMessage ? '#10b981' : (errorMessage ? '#ef4444' : 'var(--border-color)')
                    }}
                >
                  {(isRefreshing || isSending || isComposeSending || isDownloading) && <RefreshCw size={48} className="spin global-loading-spinner" />}
                  {successMessage && <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px' }} />}
                  {errorMessage && <X size={48} color="#ef4444" style={{ marginBottom: '16px' }} />}

                  <div
                      className="global-loading-text"
                      style={{
                        color: successMessage ? '#10b981' : (errorMessage ? '#ef4444' : 'var(--text-main)')
                      }}
                  >
                    {isRefreshing && '読み込み中...'}
                    {(isSending || isComposeSending) && '処理中...'}
                    {isDownloading && 'ダウンロード中...'}
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