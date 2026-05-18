import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState, useMemo } from 'react';
import {
  MountainSnow, Mail, Inbox, Sparkles, Paperclip, Download,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  RefreshCw, ArrowLeft, Plus, Search,
  CheckCircle, Trash2, X, Eye, Zap, MessageSquare, Calendar, CreditCard,
  Sun, Moon, CornerUpLeft, Send, Star, Reply, FileEdit, ReplyAll, Users,
  Settings, Bot
} from 'lucide-react';
import { AccountBar } from './components/AccountBar';
import { Sidebar } from './components/Sidebar';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';
import { ComposeModal } from './components/ComposeModal';
import { AddAccountModal } from './components/AddAccountModal';
import './App.css';

// 💡 モック環境でテスト・画面改善を行う場合は true、実サーバーに繋ぐ場合は false
const USE_MOCK = true;

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

type InsightData = {
  aiScore: number;
  summary: string;
  actions: string[];
};

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [readingEmail, setReadingEmail] = useState<Email | null>(null);
  const [isReadingContent, setIsReadingContent] = useState<boolean>(false);

  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState<string>('');

  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

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

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'reply' | 'replyAll'>('reply');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [showReplyCcBcc, setShowReplyCcBcc] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isAnalyzingInsight, setIsAnalyzingInsight] = useState(false);
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccImapHost, setNewAccImapHost] = useState('imap.gmail.com');
  const [newAccImapPort, setNewAccImapPort] = useState(993);
  const [newAccSmtpHost, setNewAccSmtpHost] = useState('smtp.gmail.com');
  const [newAccSmtpPort, setNewAccSmtpPort] = useState(465);
  const [newAccPassword, setNewAccPassword] = useState('');
  const [isAccountSaving, setIsAccountSaving] = useState(false);

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

  const loadConfigAccounts = async () => {
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      try {
        const loadedAccounts = await invoke('get_accounts') as string[];
        setAccounts(loadedAccounts);
        if (loadedAccounts.length > 0 && !activeAccount) {
          setActiveAccount(loadedAccounts[0]);
        }
        return loadedAccounts;
      } catch (e) {
        console.error("Failed to load accounts:", e);
        alert(`設定ファイルの読み込みに失敗しました。\n\n詳細:\n${e}`);
      }
    } else {
      setAccounts(['work', 'personal']);
      if (!activeAccount) setActiveAccount('work');
    }
    return [];
  };

  useEffect(() => {
    loadConfigAccounts();
  }, []);

  const saveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('geminiApiKey', key);
  };

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
    if (!activeAccount) return;
    const targetPage = Math.max(0, page);
    setIsRefreshing(true);
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);

    const serverFolder = getServerFolder();

    if (isTauri) {
      try {
        const response = await invoke('get_emails', { account: activeAccount, folder: serverFolder, page: targetPage, pageSize: PAGE_SIZE }) as { emails: any[], totalCount: number };

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

  const analyzeEmailWithGemini = async (email: Email, bodyContent: string) => {
    if (!geminiApiKey) {
      setInsightData({ aiScore: 0, summary: "APIキーが設定されていません。左下の歯車アイコンからGemini APIキーを登録してください。", actions: [] });
      return;
    }

    setIsAnalyzingInsight(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = bodyContent;
      const plainText = (tempDiv.innerText || tempDiv.textContent || "").substring(0, 3000);

      const prompt = `以下のメールを解析し、JSON形式で結果を返してください。\nフォーマット:\n{\n  "aiScore": number (0-100で、対応の緊急度や重要度を示すスコア),\n  "summary": string (メールの要旨を3行程度の箇条書き、または短いテキストで),\n  "actions": string[] (受信者が次にとるべき具体的なアクションのリスト。無ければ空配列)\n}\n\n差出人: ${email.from}\n件名: ${email.subject}\n本文:\n${plainText}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `API Error: ${res.status}`);

      const text = data.candidates[0].content.parts[0].text;
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed: InsightData = JSON.parse(cleanText);
        setInsightData(parsed);
      } catch (parseError) {
        console.error("JSON parse failed. Raw response from Gemini:", text);
        throw new Error("解析結果の読み取りに失敗しました。");
      }

    } catch (e: any) {
      console.error("Gemini API Error:", e);
      setInsightData({ aiScore: 0, summary: `エラーが発生しました: ${e.message}`, actions: [] });
    } finally {
      setIsAnalyzingInsight(false);
    }
  };

  const handlePreviewEmail = async (email: Email) => {
    setPreviewEmail(email);
    setInsightData(null);
    setIsDrawerOpen(true);

    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      setIsAnalyzingInsight(true);
      try {
        const serverFolder = getServerFolder();
        const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { account: activeAccount, folder: serverFolder, id: email.id });
        await analyzeEmailWithGemini(email, contentResponse.body);
      } catch (e) {
        setIsAnalyzingInsight(false);
        setInsightData({ aiScore: 0, summary: "本文の取得に失敗したため解析できませんでした。", actions: [] });
      }
    }
  };

  const generateAiReply = async (intent: string) => {
    if (!geminiApiKey) {
      alert("AI機能を使用するには、左下の設定からGemini APIキーを登録してください。");
      setShowSettings(true);
      return;
    }
    if (!readingEmail) return;

    setIsGeneratingReply(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = readingEmail.body;
      const plainText = (tempDiv.innerText || tempDiv.textContent || "").substring(0, 3000);

      const prompt = `以下の受信メールに対して、「${intent}」という意図で返信文（ビジネスメール）の草案を作成してください。\n出力は件名や宛名・署名のプレースホルダーを含めず、**「本文のみのプレーンテキスト」**で出力してください。\n\n差出人: ${readingEmail.from}\n件名: ${readingEmail.subject}\n本文:\n${plainText}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `API Error: ${res.status}`);

      const generatedText = data.candidates[0].content.parts[0].text;
      setReplyText(generatedText.trim() + "\n\n" + replyText);
    } catch (e: any) {
      console.error("AI Reply Generation Error:", e);
      alert(`AIによる返信文の生成に失敗しました。\n詳細: ${e.message}`);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setIsDrawerOpen(false);

    if (readingEmail?.id !== email.id && previewEmail?.id !== email.id) {
      setInsightData(null);
    }

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
          const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { account: activeAccount, folder: serverFolder, id: email.id });

          let rawBody = contentResponse.body;
          if (rawBody.includes('<html') || rawBody.includes('<div')) {
            const div = document.createElement('div');
            div.innerHTML = rawBody;
            rawBody = div.innerText || div.textContent || '';
          }
          setComposeBody(rawBody.trim());
        } catch (e) {
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
    setReplyText('');
    setReplyCc('');
    setReplyBcc('');
    setShowReplyCcBcc(false);
    setReplyType('reply');
    setShowReplyForm(false);

    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      try {
        const serverFolder = getServerFolder();
        const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { account: activeAccount, folder: serverFolder, id: email.id });

        let formattedBody = contentResponse.body;
        if (!/<[a-z][\s\S]*>/i.test(formattedBody)) {
          formattedBody = `<div style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px; padding: 16px; color: #333;">${formattedBody}</div>`;
        }

        setReadingEmail(prev => prev ? { ...prev, body: formattedBody, attachmentsList: contentResponse.attachments } : null);

        if (!email.isRead) {
          setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
          invoke('add_email_flags', { account: activeAccount, folder: serverFolder, ids: [email.id], flags: ["Seen"] }).catch(err => console.error("Failed to mark as read:", err));
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
        account: activeAccount,
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

  const handleSetReplyType = (type: 'reply' | 'replyAll') => {
    setReplyType(type);

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
        account: activeAccount,
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
        setShowReplyForm(false);
        setReadingEmail(null);
      }, 1500);

    } catch (e) {
      setIsSending(false);
      setErrorMessage(`送信に失敗しました: ${e}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return;
    setIsComposeSending(true);

    try {
      await invoke('send_email', {
        account: activeAccount,
        to: composeTo,
        cc: composeCc || null,
        bcc: composeBcc || null,
        subject: composeSubject || '(件名なし)',
        body: composeBody
      });

      if (composingDraftId) {
        await invoke('delete_emails', { account: activeAccount, folder: 'drafts', ids: [composingDraftId] });
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
            account: activeAccount,
            to: composeTo,
            cc: composeCc || null,
            bcc: composeBcc || null,
            subject: composeSubject,
            body: composeBody
          });

          if (composingDraftId) {
            await invoke('delete_emails', { account: activeAccount, folder: 'drafts', ids: [composingDraftId] });
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
        const response = await invoke('search_emails_on_server', { account: activeAccount, folder: serverFolder, address, page, pageSize: PAGE_SIZE }) as { emails: any[], totalCount: number };
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
      }, 1000);
    }
  };

  const getFolderDisplayLabel = (folderName: string): string => {
    switch (folderName) {
      case 'inbox':
        return '受信トレイ';
      case 'sent':
        return '送信済み';
      case 'urgent':
        return '至急対応';
      case 'flagged':
        return '星付き';
      case 'drafts':
        return '下書き';
      default:
        // 動的フォルダなどの場合は、フォルダ名をそのまま（または先頭大文字などにして）返す
        return folderName;
    }
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccEmail || !newAccPassword) {
      alert("必須項目が入力されていません。");
      return;
    }

    setIsAccountSaving(true);
    try {
      await invoke('add_account', {
        name: newAccName,
        email: newAccEmail,
        imapHost: newAccImapHost,
        imapPort: Number(newAccImapPort),
        smtpHost: newAccSmtpHost,
        smtpPort: Number(newAccSmtpPort),
        passwordRaw: newAccPassword,
      });

      setSuccessMessage("アカウントを追加しました！");
      setNewAccName(''); setNewAccEmail(''); setNewAccPassword('');
      setIsAddAccountOpen(false);

      const updatedList = await loadConfigAccounts();
      if (updatedList.includes(newAccName)) {
        setActiveAccount(newAccName);
      }
      setTimeout(() => setSuccessMessage(null), 1500);
    } catch (err) {
      alert(`アカウントの追加に失敗しました: ${err}`);
    } finally {
      setIsAccountSaving(false);
    }
  };

  const counts = useMemo(() => {
    return {
      workHasUnread: emails.some(e => e.account.toLowerCase().includes('work') && !e.isRead),
      personalHasUnread: emails.some(e => e.account.toLowerCase().includes('personal') && !e.isRead),
    };
  }, [emails]);

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
          await invoke('remove_email_flags', { account: activeAccount, folder: serverFolder, ids: [id], flags: ["Seen"] });
        } else {
          await invoke('add_email_flags', { account: activeAccount, folder: serverFolder, ids: [id], flags: ["Seen"] });
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
          await invoke('remove_email_flags', { account: activeAccount, folder: serverFolder, ids: [id], flags: ["Flagged"] });
        } else {
          await invoke('add_email_flags', { account: activeAccount, folder: serverFolder, ids: [id], flags: ["Flagged"] });
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
        await invoke('delete_emails', { account: activeAccount, folder: getServerFolder(), ids: [id] });
      } catch (err) {
        console.error("Delete failed", err);
        alert(`削除に失敗しました: ${err}`);
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
          await invoke('add_email_flags', { account: activeAccount, folder: getServerFolder(), ids: idsToUpdate, flags: ["Seen"] });
        } catch (e) { console.error("Bulk read failed", e); }
      }
    } else {
      setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isDeleted: true } : em));
      setSelectedIds([]);
      if (!USE_MOCK) {
        try {
          await invoke('delete_emails', { account: activeAccount, folder: getServerFolder(), ids: idsToUpdate });
        } catch (e) {
          console.error("Bulk delete failed", e);
          alert(`削除に失敗しました: ${e}`);
          setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isDeleted: false } : em));
        }
      }
    }
  };

  return (
    <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>
      <AccountBar
        accounts={accounts}
        activeAccount={activeAccount}
        onSelectAccount={(accName) => {
          setActiveAccount(accName);
          setReadingEmail(null);
          setIsDrawerOpen(false);
        }}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
      />

      <Sidebar
        activeFolder={activeFolder}
        currentDisplayCount={currentDisplayCount}
        isDarkMode={isDarkMode}
        onSelectFolder={(folderName) => {
          setActiveFolder(folderName);
          setCurrentPage(0);
          setReadingEmail(null);
          setIsDrawerOpen(false);
        }}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="main-content" style={{ position: 'relative' }}>
        {readingEmail ? (
          <EmailDetail
            readingEmail={readingEmail}
            isSearchingServer={isSearchingServer}
            insightData={insightData}
            isAnalyzingInsight={isAnalyzingInsight}
            isReadingContent={isReadingContent}
            showReplyForm={showReplyForm}
            replyType={replyType}
            showReplyCcBcc={showReplyCcBcc}
            replyCc={replyCc}
            replyBcc={replyBcc}
            replyText={replyText}
            isSending={isSending}
            isGeneratingReply={isGeneratingReply}
            setReadingEmail={setReadingEmail}
            setInsightData={setInsightData}
            analyzeEmailWithGemini={analyzeEmailWithGemini}
            handleServerSearch={handleServerSearch}
            handleDownloadAttachment={handleDownloadAttachment}
            setShowReplyForm={setShowReplyForm}
            handleSetReplyType={handleSetReplyType}
            setShowReplyCcBcc={setShowReplyCcBcc}
            setReplyCc={setReplyCc}
            setReplyBcc={setReplyBcc}
            generateAiReply={generateAiReply}
            setReplyText={setReplyText}
            handleSendReply={handleSendReply}
          />
        ) : (
          <div className="main-layout-container">
            {/* ✨ 巨大なベタ書きの代わりに、この1行を身代わりに置きます */}
            <EmailList
              activeFolder={activeFolder}
              isRefreshing={isRefreshing}
              searchQuery={searchQuery}
              filterUnread={filterUnread}
              selectedIds={selectedIds}
              filteredAndSortedEmails={filteredAndSortedEmails}
              readingEmail={readingEmail}
              currentPage={currentPage}
              PAGE_SIZE={PAGE_SIZE}
              currentDisplayCount={currentDisplayCount}
              hasMore={hasMore}
              sortConfig={sortConfig}
              getFolderDisplayLabel={getFolderDisplayLabel}
              fetchEmails={fetchEmails}
              setSearchQuery={setSearchQuery}
              setFilterUnread={setFilterUnread}
              setSelectedIds={setSelectedIds}
              handleBulkAction={handleBulkAction}
              setSortConfig={setSortConfig}
              renderSortIcon={renderSortIcon}
              handleSelectEmail={handleSelectEmail}
              toggleFlagStatus={toggleFlagStatus}
              handlePreviewEmail={handlePreviewEmail}
              toggleReadStatus={toggleReadStatus}
              deleteEmail={deleteEmail}
            />

            {/* ⚠️ aside（ドロワー）のこのブロックだけは、App.tsx側にまだ残しておきます */}
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
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 8, lineHeight: 1.4 }}>{previewEmail.subject}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
                      From: {previewEmail.from}
                    </div>

                    {isAnalyzingInsight ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: '#8b5cf6' }}>
                        <RefreshCw size={32} className="spin" style={{ marginBottom: '16px' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Gemini がメールを解析中...</span>
                      </div>
                    ) : insightData ? (
                      <>
                        <div className="insight-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: insightData.aiScore > 70 ? '#ef4444' : '#2563eb', marginBottom: 8 }}>
                            <Zap size={16} /> <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>重要度スコア: {insightData.aiScore}点</span>
                          </div>
                          <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {insightData.summary}
                          </p>
                        </div>

                        {insightData.actions && insightData.actions.length > 0 && (
                          <div className="ai-section" style={{ marginBottom: 24 }}>
                            <div className="ai-section-title" style={{ marginBottom: 12 }}>予測されるアクション</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {insightData.actions.map((action, idx) => (
                                <span key={idx} className="badge badge-update" style={{ padding: '6px 12px', borderRadius: '6px' }}>{action}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}

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

        {/* 💡 追加：フローティング新規作成ボタン（今朝の断面オリジナル位置の再現） */}
        {!readingEmail && (
          <button
            onClick={() => setIsComposeOpen(true)}
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

        <AddAccountModal
          isAddAccountOpen={isAddAccountOpen}
          isAccountSaving={isAccountSaving}
          newAccName={newAccName}
          newAccEmail={newAccEmail}
          newAccImapHost={newAccImapHost}
          newAccImapPort={newAccImapPort}
          newAccSmtpHost={newAccSmtpHost}
          newAccSmtpPort={newAccSmtpPort}
          newAccPassword={newAccPassword}
          setNewAccName={setNewAccName}
          setNewAccEmail={setNewAccEmail}
          setNewAccImapHost={setNewAccImapHost}
          setNewAccImapPort={setNewAccImapPort}
          setNewAccSmtpHost={setNewAccSmtpHost}
          setNewAccSmtpPort={setNewAccSmtpPort}
          setNewAccPassword={setNewAccPassword}
          setIsAddAccountOpen={setIsAddAccountOpen}
          handleAddAccountSubmit={handleAddAccountSubmit}
        />

        {showSettings && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: '450px', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20} /> 設定</h3>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px' }}>Gemini API キー (Google AI Studio)</label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AI_xxxxxxxxxxxxxxxxxxx..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  AIインサイトや返信自動生成を使用するには、<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>Google AI Studio</a> から無料で取得したAPIキーを入力してください。キーはブラウザのローカル環境にのみ保存されます。
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button onClick={() => setShowSettings(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>キャンセル</button>
                <button onClick={() => { saveApiKey(geminiApiKey); setShowSettings(false); }} className="send-btn" style={{ padding: '8px 16px', borderRadius: '6px' }}>保存して閉じる</button>
              </div>
            </div>
          </div>
        )}

        {/* 💡 内村さんが丁寧に実装された「アイコン付き新規メッセージダイアログ」を100%完全再現 */}
        <ComposeModal
          isComposeOpen={isComposeOpen}
          composeTo={composeTo}
          composeSubject={composeSubject}
          composeBody={composeBody}
          isComposeSending={isComposeSending}
          setComposeTo={setComposeTo}
          setComposeSubject={setComposeSubject}
          setComposeBody={setComposeBody}
          handleCloseCompose={handleCloseCompose}
          handleComposeSend={handleComposeSend}
        />

        {(isRefreshing || isSending || isComposeSending || isDownloading || successMessage || errorMessage) && (
          <div className="global-loading-overlay" style={{ zIndex: 1100 }}>
            <div className="global-loading-content">
              {(isRefreshing || isSending || isComposeSending || isDownloading) && <RefreshCw size={48} className="spin global-loading-spinner" />}
              <div className="global-loading-text">{successMessage || errorMessage || '処理中...'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;