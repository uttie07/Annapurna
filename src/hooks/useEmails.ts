import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 💡 モック環境でテスト・画面改善を行う場合は true、実サーバーに繋ぐ場合は false
const USE_MOCK = true;
const PAGE_SIZE = 50;

type Email = {
  id: string; subject: string; from: string; to?: string; email_address: string; date: string; snippet: string;
  body: string; aiCategories: string[]; account: string;
  isRead: boolean; isFlagged: boolean; isAnswered: boolean; isDraft: boolean; isDeleted: boolean;
  attachmentsList?: string[];
};

type SortConfig = { key: keyof Email; direction: 'asc' | 'desc'; } | null;

// 外部から現在選択中のアカウント名とフォルダ名をもらう
interface UseEmailsProps {
  activeAccount: string;
  activeFolder: string;
}

export function useEmails({ activeAccount, activeFolder }: UseEmailsProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

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
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockData: Email[] = [
        { id: "1", account: "work", subject: "ダミーのメール", from: "管理者", email_address: "admin@example.com", date: formatEmailDate(new Date().toISOString()), snippet: "", body: "", aiCategories: ["重要"], isRead: false, isFlagged: true, isAnswered: false, isDraft: false, isDeleted: false },
      ];
      setEmails(mockData.filter(m => m.account === activeAccount));
      setCurrentPage(targetPage);
      setHasMore(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchEmails(0); }, [activeAccount, activeFolder]);

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

  const deleteEmail = async (id: string, e: React.MouseEvent, isReading: boolean, setReadingNull: () => void) => {
    e.stopPropagation();
    setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: true } : em));
    if (isReading) setReadingNull();

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

  return {
    emails,
    setEmails,
    sortConfig,
    setSortConfig,
    selectedIds,
    setSelectedIds,
    isRefreshing,
    searchQuery,
    setSearchQuery,
    filterUnread,
    setFilterUnread,
    currentPage,
    setCurrentPage,
    hasMore,
    setHasMore,
    PAGE_SIZE,
    filteredAndSortedEmails,
    currentDisplayCount,
    getServerFolder,
    fetchEmails,
    toggleReadStatus,
    toggleFlagStatus,
    deleteEmail,
    handleBulkAction,
    formatSenderName,
    extractEmailAddress,
    formatEmailDate,
  };
}