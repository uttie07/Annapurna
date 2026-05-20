import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import {
  Sparkles, RefreshCw, Plus, X, Zap, ChevronUp, ChevronDown
} from 'lucide-react';
import { AccountBar } from './components/AccountBar';
import { Sidebar } from './components/Sidebar';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';
import { ComposeModal } from './components/ComposeModal';
import { AddAccountModal } from './components/AddAccountModal';
import { useGemini } from './hooks/useGemini';
import { useEmails } from './hooks/useEmails';
import './App.css';

// 💡 モック環境でテスト・画面改善を行う場合は true、実サーバーに繋ぐ場合は false
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

function App() {
  const gemini = useGemini();
  const [readingEmail, setReadingEmail] = useState<Email | null>(null);
  const [isReadingContent, setIsReadingContent] = useState<boolean>(false);

  const [accounts, setAccounts] = useState<string[]>([]);
  const [activeAccount, setActiveAccount] = useState<string>('');

  // ✨ 固定からシフト: アカウントごとにサーバーから一律取得するフォルダ一覧State
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const emailHook = useEmails({ activeAccount, activeFolder });

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isComposeSending, setIsComposeSending] = useState(false);
  const [composingDraftId, setComposingDraftId] = useState<string | null>(null);

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyType, setReplyType] = useState<'reply' | 'replyAll'>('reply');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [showReplyCcBcc, setShowReplyCcBcc] = useState(false);

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

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // 初期ロード用の非同期関数を定義
  useEffect(() => {
    const loadConfigAccounts = async () => {
      const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
      if (isTauri) {
        try {
          const loadedAccounts = await invoke('get_accounts') as string[];
          setAccounts(loadedAccounts);
          if (loadedAccounts.length > 0 && !activeAccount) {
            setActiveAccount(loadedAccounts[0]);
          }
        } catch (error) {
          console.error("Failed to load accounts:", error);
          alert(`設定ファイルの読み込みに失敗しました。\n\n詳細:\n${error}`);
        }
      } else {
        setAccounts(['work', 'personal']);
        if (!activeAccount) setActiveAccount('work');
      }
    };

    loadConfigAccounts().catch(err => console.error("Account load unhandled:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✨ 追加: アクティブアカウント変更時に、そのサーバーのフォルダ構成を一律動的にフェッチする
  useEffect(() => {
    const loadFoldersForAccount = async () => {
      if (!activeAccount) return;

      const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
      if (isTauri) {
        try {
          // Rust側からString配列でフォルダ一覧（例: ["INBOX", "Sent", "Drafts", "Junk", "CustomFolder"])を取得
          const fetchedFolders = await invoke('get_folders', { account: activeAccount }) as string[];
          setFolders(fetchedFolders);

          // 現在選択中のフォルダが新しい一覧にない場合、先頭のフォルダに安全にフォールバック
          if (fetchedFolders.length > 0 && !fetchedFolders.includes(activeFolder)) {
            setActiveFolder(fetchedFolders[0]);
          }
        } catch (error) {
          console.error("Failed to fetch folders:", error);
          // 失敗時は最低限の基本フォルダー構造を確保してフォールバック
          setFolders(['inbox', 'sent', 'drafts']);
        }
      } else {
        // モック環境下でのアカウント別フォルダのダミー切り替え挙動
        if (activeAccount === 'work') {
          setFolders(['inbox', 'Sent Items', 'drafts', 'プログラミング', '重要案件']);
        } else {
          setFolders(['inbox', '[Gmail]/送信済みトレイ', 'drafts', 'メルマガ', 'プライベート']);
        }
      }
    };

    loadFoldersForAccount().catch(err => console.error("Folder load error:", err));
  }, [activeAccount]);

  const handlePreviewEmail = async (email: Email) => {
    setPreviewEmail(email);
    gemini.setInsightData(null);
    setIsDrawerOpen(true);

    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      gemini.setIsAnalyzingInsight(true);
      try {
        const serverFolder = emailHook.getServerFolder();
        const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { account: activeAccount, folder: serverFolder, id: email.id });
        await gemini.analyzeEmailWithGemini(email, contentResponse.body);
      } catch (error) {
        console.error(error);
        gemini.setIsAnalyzingInsight(false);
        gemini.setInsightData({ aiScore: 0, summary: "本文の取得に失敗したため解析できませんでした。", actions: [] });
      }
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setIsDrawerOpen(false);

    if (readingEmail?.id !== email.id && previewEmail?.id !== email.id) {
      gemini.setInsightData(null);
    }

    if (activeFolder.toLowerCase().includes('draft')) {
      setIsComposeOpen(true);
      setComposeTo(email.to || email.from || '');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject(email.subject === '(件名なし)' ? '' : email.subject);
      setComposeBody('');
      setComposingDraftId(email.id);

      const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
      if (isTauri) {
        try {
          const serverFolder = emailHook.getServerFolder();
          const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { account: activeAccount, folder: serverFolder, id: email.id });

          let rawBody = contentResponse.body;
          if (rawBody.includes('<html') || rawBody.includes('<div')) {
            const div = document.createElement('div');
            div.innerHTML = rawBody;
            rawBody = div.innerText || div.textContent || '';
          }
          setComposeBody(rawBody.trim());
        } catch (error) {
          console.error(error);
          alert("下書きの読み込みに失敗しました");
        } finally {
          // 必要に応じたクリーンアップ処理をここに記述
        }
      } else {
        setTimeout(() => {
          setComposeBody("ダミーの下書き本文");
        }, 500);
      }
      return;
    }

    setReadingEmail(email);
    setIsReadingContent(true);
    gemini.setReplyText('');
    setReplyCc('');
    setReplyBcc('');
    setShowReplyCcBcc(false);
    setReplyType('reply');
    setShowReplyForm(false);

    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    if (isTauri) {
      try {
        const serverFolder = emailHook.getServerFolder();
        const contentResponse = await invoke<EmailDetailResponse>('get_email_content', { account: activeAccount, folder: serverFolder, id: email.id });

        let formattedBody = contentResponse.body;
        if (!/<[a-z][\s\S]*>/i.test(formattedBody)) {
          formattedBody = `<div style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px; padding: 16px; color: #333;">${formattedBody}</div>`;
        }

        setReadingEmail(prev => prev ? { ...prev, body: formattedBody, attachmentsList: contentResponse.attachments } : null);

        if (!email.isRead) {
          emailHook.setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
          await invoke('add_email_flags', { account: activeAccount, folder: serverFolder, ids: [email.id], flags: ["Seen"] });
        }
      } catch (error) {
        console.error("Content fetch error:", error);
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
      const serverFolder = emailHook.getServerFolder();
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
    } catch (error) {
      console.error(error);
      alert(`ダウンロードに失敗しました: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSetReplyType = (type: 'reply' | 'replyAll') => {
    setReplyType(type);
    setShowReplyForm(true);

    if (!gemini.replyText.trim() && readingEmail) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = readingEmail.body;
      const plainText = tempDiv.innerText || tempDiv.textContent || "";
      const quote = `\n\n\n--- 引用 ---\n${readingEmail.date} ${readingEmail.from} wrote:\n> ${plainText.split(/\r?\n/).join('\n> ')}`;
      gemini.setReplyText(quote);
    }

    if (type === 'replyAll' && readingEmail?.to) {
      setReplyCc(readingEmail.to);
      setShowReplyCcBcc(true);
    } else {
      setReplyCc('');
    }
  };

  const handleSendReply = async () => {
    if (!readingEmail || !gemini.replyText.trim()) return;
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
        body: gemini.replyText
      });

      setIsSending(false);
      setSuccessMessage("メールを送信しました！");

      setTimeout(() => {
        setSuccessMessage(null);
        gemini.setReplyText('');
        setShowReplyForm(false);
        setReadingEmail(null);
      }, 1500);

    } catch (error) {
      setIsSending(false);
      setErrorMessage(`送信に失敗しました: ${error}`);
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
        setComposeSubject('');
        setComposeBody('');
        setComposingDraftId(null);
        if (activeFolder.toLowerCase().includes('draft')) {
          emailHook.fetchEmails(0).catch(err => console.error(err));
        }
      }, 1500);

    } catch (error) {
      setIsComposeSending(false);
      setErrorMessage(`送信に失敗しました: ${error}`);
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
          if (activeFolder.toLowerCase().includes('draft')) {
            emailHook.fetchEmails(0).catch(err => console.error(err));
          }
          setTimeout(() => setSuccessMessage(null), 1500);
        } catch (error) {
          alert(`保存に失敗しました: ${error}`);
        }
        setIsComposeSending(false);
      }
    }
    setIsComposeOpen(false);
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setComposeSubject('');
    setComposeBody('');
    setComposingDraftId(null);
  };

  const handleServerSearch = async (address: string, page: number = 0) => {
    setIsSearchingServer(true);
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);

    if (isTauri) {
      try {
        const serverFolder = emailHook.getServerFolder();
        const response = await invoke('search_emails_on_server', { account: activeAccount, folder: serverFolder, address, page, pageSize: emailHook.PAGE_SIZE }) as { emails: Array<{ id: number | string, subject?: string, from: string, to?: string, date: string, flags?: string[] }>, totalCount: number };

        const searchResults: Email[] = response.emails.map((e) => {
          const flags: string[] = e.flags || [];
          return {
            id: String(e.id),
            subject: e.subject || '(件名なし)',
            from: emailHook.formatSenderName(e.from),
            to: e.to ? emailHook.formatSenderName(e.to) : undefined,
            email_address: emailHook.extractEmailAddress(e.from),
            date: emailHook.formatEmailDate(e.date),
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

        emailHook.setEmails(searchResults);
        emailHook.setCurrentPage(page);
        emailHook.setHasMore(searchResults.length === emailHook.PAGE_SIZE);
        emailHook.setSearchQuery(address);
        setReadingEmail(null);
      } catch (error) {
        console.error("Server search error:", error);
        alert("サーバー検索に失敗しました。");
      } finally {
        setIsSearchingServer(false);
      }
    } else {
      setTimeout(() => {
        setIsSearchingServer(false);
        emailHook.setSearchQuery(address);
        setReadingEmail(null);
      }, 1000);
    }
  };

  const getFolderDisplayLabel = (folderName: string): string => {
    // サーバー固有のフォルダ名表記を考慮し、部分一致または判定ロジックを最適化
    const normalized = folderName.toLowerCase();
    if (normalized === 'inbox') return '受信トレイ';
    if (normalized.includes('sent')) return '送信済み';
    if (normalized.includes('draft')) return '下書き';
    if (normalized.includes('flagged') || normalized.includes('star')) return '星付き';
    if (normalized === 'urgent') return '至急対応';
    return folderName; // ユーザーカスタムフォルダ名はそのまま返却
  };

  const handleAddAccountSubmit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
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

      const updatedList = await invoke('get_accounts') as string[];
      setAccounts(updatedList);
      if (updatedList.includes(newAccName)) {
        setActiveAccount(newAccName);
      }
      setTimeout(() => setSuccessMessage(null), 1500);
    } catch (error) {
      alert(`アカウントの追加に失敗しました: ${error}`);
    } finally {
      setIsAccountSaving(false);
    }
  };

  const renderSortIcon = (k: keyof Email) => {
    if (emailHook.sortConfig?.key !== k) return <ChevronDown size={14} color="#ccc" />;
    return emailHook.sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const currentEmailId = readingEmail ? readingEmail.id : null;

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
            folders={folders} // ✨ 新設した動的フォルダ一覧配列をバインド
            activeFolder={activeFolder}
            currentDisplayCount={emailHook.currentDisplayCount}
            isDarkMode={isDarkMode}
            onSelectFolder={(folderName) => {
              setActiveFolder(folderName);
              emailHook.setCurrentPage(0);
              setReadingEmail(null);
              setIsDrawerOpen(false);
            }}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            onOpenSettings={() => gemini.setShowSettings(true)}
        />

        <div className="main-content" style={{ position: 'relative' }}>
          {readingEmail ? (
              <EmailDetail
                  readingEmail={readingEmail}
                  isSearchingServer={isSearchingServer}
                  insightData={gemini.insightData}
                  isAnalyzingInsight={gemini.isAnalyzingInsight}
                  isReadingContent={isReadingContent}
                  showReplyForm={showReplyForm}
                  replyType={replyType}
                  showReplyCcBcc={showReplyCcBcc}
                  replyCc={replyCc}
                  replyBcc={replyBcc}
                  replyText={gemini.replyText}
                  isSending={isSending}
                  isGeneratingReply={gemini.isGeneratingReply}
                  setReadingEmail={setReadingEmail}
                  analyzeEmailWithGemini={gemini.analyzeEmailWithGemini}
                  handleServerSearch={handleServerSearch}
                  handleDownloadAttachment={handleDownloadAttachment}
                  setShowReplyForm={setShowReplyForm}
                  handleSetReplyType={handleSetReplyType}
                  setShowReplyCcBcc={setShowReplyCcBcc}
                  setReplyCc={setReplyCc}
                  setReplyBcc={setReplyBcc}
                  generateAiReply={(intent) => gemini.generateAiReply(readingEmail, intent)}
                  setReplyText={gemini.setReplyText}
                  handleSendReply={handleSendReply}
              />
          ) : (
              <div className="main-layout-container">
                <EmailList
                    activeFolder={activeFolder}
                    isRefreshing={emailHook.isRefreshing}
                    searchQuery={emailHook.searchQuery}
                    filterUnread={emailHook.filterUnread}
                    selectedIds={emailHook.selectedIds}
                    filteredAndSortedEmails={emailHook.filteredAndSortedEmails}
                    readingEmail={readingEmail}
                    currentPage={emailHook.currentPage}
                    PAGE_SIZE={emailHook.PAGE_SIZE}
                    currentDisplayCount={emailHook.currentDisplayCount}
                    hasMore={emailHook.hasMore}
                    sortConfig={emailHook.sortConfig}
                    getFolderDisplayLabel={getFolderDisplayLabel}
                    fetchEmails={emailHook.fetchEmails}
                    setSearchQuery={emailHook.setSearchQuery}
                    setFilterUnread={emailHook.setFilterUnread}
                    setSelectedIds={emailHook.setSelectedIds}
                    handleBulkAction={emailHook.handleBulkAction}
                    setSortConfig={emailHook.setSortConfig}
                    renderSortIcon={renderSortIcon}
                    handleSelectEmail={handleSelectEmail}
                    toggleFlagStatus={emailHook.toggleFlagStatus}
                    handlePreviewEmail={handlePreviewEmail}
                    toggleReadStatus={emailHook.toggleReadStatus}
                    deleteEmail={(id, e) => emailHook.deleteEmail(id, e, currentEmailId === id, () => setReadingEmail(null))}
                />

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

                          {gemini.isAnalyzingInsight ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: '#8b5cf6' }}>
                                <RefreshCw size={32} className="spin" style={{ marginBottom: '16px' }} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Gemini がメールを解析中...</span>
                              </div>
                          ) : gemini.insightData ? (
                              <>
                                <div className="insight-card">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: gemini.insightData.aiScore > 70 ? '#ef4444' : '#2563eb', marginBottom: 8 }}>
                                    <Zap size={16} /> <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>重要度スコア: {gemini.insightData.aiScore}点</span>
                                  </div>
                                  <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {gemini.insightData.summary}
                                  </p>
                                </div>

                                {gemini.insightData.actions && gemini.insightData.actions.length > 0 && (
                                    <div className="ai-section" style={{ marginBottom: 24 }}>
                                      <div className="ai-section-title" style={{ marginBottom: 12 }}>予測されるアクション</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {gemini.insightData.actions.map((action, idx) => (
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

          {!readingEmail && (
              <button
                  onClick={() => setIsComposeOpen(true)}
                  style={{
                    position: 'absolute',
                    bottom: '80px',
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

          {(emailHook.isRefreshing || isSending || isComposeSending || isDownloading || successMessage || errorMessage) && (
              <div className="global-loading-overlay" style={{ zIndex: 1100 }}>
                <div className="global-loading-content">
                  {(emailHook.isRefreshing || isSending || isComposeSending || isDownloading) && <RefreshCw size={48} className="spin global-loading-spinner" />}
                  <div className="global-loading-text">{successMessage || errorMessage || '処理中...'}</div>
                </div>
              </div>
          )}
        </div>
      </div>
  );
}

export default App;