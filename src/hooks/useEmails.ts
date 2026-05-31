import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 💡 モック環境でテスト・画面改善を行う場合は true、実サーバーに繋ぐ場合は false
const USE_MOCK = false;
const PAGE_SIZE = 50;

/**
 * メールデータのオブジェクト構造定義
 */
type Email = {
  id: string;
  subject: string;
  from: string;
  to?: string;
  email_address: string;
  date: string;
  snippet: string;
  body: string;
  aiCategories: string[];
  account: string;
  isRead: boolean;
  isFlagged: boolean;
  isAnswered: boolean;
  isDraft: boolean;
  isDeleted: boolean;
  attachmentsList?: string[];
};

/**
 * ソート設定の型定義
 */
type SortConfig = {
  key: keyof Email;
  direction: 'asc' | 'desc';
} | null;

/**
 * useEmails カスタムフックへの入力引数の型定義
 */
interface UseEmailsProps {
  activeAccount: string;
  activeFolder: string;
  onProgressUpdate?: (progress: { current: number; total: number } | null) => void;
}

/**
 * Tauri バックエンドからの get_emails レスポンスの型定義
 */
interface GetEmailsResponse {
  emails: Array<{
    id: number | string;
    subject?: string;
    from: string;
    to?: string;
    date: string;
    flags?: string[];
  }>;
  totalCount: number;
}
/**
 * メール一覧の取得・状態管理・検索・フィルタリング、およびバックエンドへのフラグ更新の
 * すべてのインフラストラクチャロジックを統括する、アプリケーションのコア・カスタムフック。
 * @returns 画面コンポーネント（EmailList, EmailDetail等）へ受け渡す全データとコールバック
 */
export const useEmails = ({
                            activeAccount,
                            activeFolder,
                            onProgressUpdate
                          }: UseEmailsProps) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  /**
   * アクティブなフォルダ名をIMAPの物理フォルダ名にマッピング
   */
  const getServerFolder = (): string => {
    if (!activeFolder || activeFolder.toLowerCase() === "inbox" || activeFolder.trim() === "") {
      return "INBOX";
    }
    return activeFolder;
  };

  /**
   * 時刻のフォーマット成形処理
   */
  const formatEmailDate = (dateStr: string): string => {
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
    } catch { return dateStr; }
  };

  /**
   * 送信元氏名の切り出しパース
   */
  const formatSenderName = (fromStr: string): string => {
    if (!fromStr) return '不明な宛先/送信元';
    const match = fromStr.match(/^"?([^"<]+)"?\s*<.*>$/) || fromStr.match(/^([^<]+)/);
    return match && match[1] ? match[1].trim() : fromStr;
  };

  /**
   * メールアドレスの抽出パース
   */
  const extractEmailAddress = (fromStr: string): string => {
    if (!fromStr) return '';
    const match = fromStr.match(/<([^>]+)>/);
    return match ? match[1] : fromStr;
  };

  /**
   * 指定されたページのメール一覧をフェッチする非同期コア関数
   * ✨ useCallback で囲むことで関数の再生成を防ぎ、無限ループを完璧に防止します
   */
  const fetchEmails = useCallback(async (page: number = 0): Promise<void> => {
    if (!activeAccount) return;
    const targetPage = Math.max(0, page);
    setIsRefreshing(true);
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);
    const serverFolder = getServerFolder();

    if (isTauri) {
      try {
        const response = await invoke<GetEmailsResponse>('get_emails', {
          account: activeAccount,
          folder: serverFolder,
          page: targetPage,
          pageSize: PAGE_SIZE
        });

        const realEmails: Email[] = response.emails.map((e) => {
          const flags: string[] = e.flags || [];
          return {
            id: String(e.id),
            subject: e.subject || '(件名なし)',
            from: formatSenderName(e.from),
            to: e.to ? formatSenderName(e.to) : undefined,
            email_address: extractEmailAddress(e.from),
            date: formatEmailDate(e.date),
            snippet: '', body: '', aiCategories: [],
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
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsRefreshing(false);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
      setEmails([]);
      setCurrentPage(targetPage);
      setHasMore(false);
      setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount, activeFolder]);

  useEffect(() => {
    fetchEmails(0);
  }, [fetchEmails]);

  /**
   * メモリ上で検索クエリ、フォルダ分類、未読チェック、ソートを高速適用する算出プロパティ
   */
  const clearSearchAndRefresh = async (): Promise<void> => {
    setSearchQuery('');
    await fetchEmails(0);
  };

  const filteredAndSortedEmails = useMemo(() => {
    let result = emails.filter(e => e.account === activeAccount);

    if (activeFolder === 'urgent') {
      result = result.filter(e => e.aiCategories.includes("重要") || e.aiCategories.includes("至急"));
    } else if (activeFolder === 'flagged') {
      result = result.filter(e => e.isFlagged && !e.isDeleted);
    } else if (activeFolder === 'drafts') {
      result = result.filter(e => !e.isDeleted);
    }

    if (filterUnread) {
      result = result.filter(e => !e.isRead);
    }

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
        const aVal = String(a[sortConfig.key]);
        const bVal = String(b[sortConfig.key]);
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return result.filter(e => !e.isDeleted);
  }, [emails, activeAccount, activeFolder, searchQuery, filterUnread, sortConfig]);

  /**
   * フッター用の表示レコード件数の算出
   */
  const currentDisplayCount = useMemo(() => {
    return filteredAndSortedEmails.length > 0
        ? currentPage * PAGE_SIZE + filteredAndSortedEmails.length
        : 0;
  }, [currentPage, filteredAndSortedEmails.length]);

  /**
   * 既読・未読フラグのトグル処理
   */
  const toggleReadStatus = async (id: string, e: React.MouseEvent): Promise<void> => {
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
      } catch (error) {
        console.error("Flag update failed", error);
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isRead: isCurrentlyRead } : em));
      }
    }
  };

  /**
   * 星付きフラグのトグル処理
   */
  const toggleFlagStatus = async (id: string, e: React.MouseEvent): Promise<void> => {
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
      } catch (error) {
        console.error("Flag update failed", error);
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isFlagged: isCurrentlyFlagged } : em));
      }
    }
  };

  /**
   * 単一メールの削除（ゴミ箱移動）処理
   * **AIへの指示 / 開発者への注意**:
   * 削除進捗（onProgressUpdate）を更新する際は、Reactの同期レンダリング連鎖（cascading renders）を防ぐため、
   * 必ず `setTimeout` を使用して非同期マクロタスクとしてスケジュールしてください。
   */
  const deleteEmail = async (id: string, e: React.MouseEvent, isReading: boolean, setReadingNull: () => void): Promise<void> => {
    e.stopPropagation();
    if (isReading) setReadingNull();

    if (!USE_MOCK) {
      // 💡 1件削除時のゲージ初期状態を安全に非同期スケジュール
      if (onProgressUpdate) {
        setTimeout(() => {
          if (onProgressUpdate) onProgressUpdate({ current: 0, total: 1 });
        }, 0);
      }

      try {
        await invoke('delete_emails', { account: activeAccount, folder: getServerFolder(), ids: [id] });
        // サーバー通信が無事完了してからリストから消去（同期ズレ防止）
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: true } : em));
      } catch (error) {
        console.error("Delete failed", error);
        alert(`削除に失敗しました: ${error}`);
      } finally {
        // 💡 クローズ処理も非同期の枠組みで行う
        setTimeout(() => {
          if (onProgressUpdate) onProgressUpdate(null);
        }, 0);
      }
    } else {
      setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: true } : em));
    }
  };

  /**
   * チェックボックス選択された複数アイテムの一括バッチ処理
   * **AIへの指示 / 開発者への注意**:
   * 削除進捗（onProgressUpdate）を更新する際は、Reactの同期レンダリング連鎖（cascading renders）を防ぐため、
   * 必ず `setTimeout` を使用して非同期マクロタスクとしてスケジュールしてください。
   */
  const handleBulkAction = async (action: 'read' | 'delete'): Promise<void> => {
    const idsToUpdate = [...selectedIds];
    if (idsToUpdate.length === 0) return;

    if (action === 'read') {
      setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isRead: true } : em));
      setSelectedIds([]);
      if (!USE_MOCK) {
        try {
          await invoke('add_email_flags', { account: activeAccount, folder: getServerFolder(), ids: idsToUpdate, flags: ["Seen"] });
        } catch (error) {
          console.error("Bulk read failed", error);
        }
      }
    } else {
      // 🗑️ 一括削除の実行
      setSelectedIds([]);

      if (!USE_MOCK) {
        let unlistenProgress: (() => void) | null = null;

        // ゲージの初期状態を設定してリスナーを登録
        if (onProgressUpdate) {
          // 💡 レンダリング連鎖を防ぐため、マクロタスクへ逃がす
          setTimeout(() => {
            if (onProgressUpdate) onProgressUpdate({ current: 0, total: idsToUpdate.length });
          }, 0);

          // Rust側から1件消すごとに飛んでくるイベントをキャッチ
          unlistenProgress = await listen<[number, number]>('delete-progress', (event) => {
            const [current, total] = event.payload;
            // 💡 ESLint (set-state-in-effect) 回避策:
            // 効果割り込み中の同期処理を避け、イベントループの次のサイクルで安全にステートを更新する
            setTimeout(() => {
              if (onProgressUpdate) onProgressUpdate({ current, total });
            }, 0);
          });
        }

        try {
          // バックエンドの一括削除が100%完了するまで待機（同期保証）
          await invoke('delete_emails', { account: activeAccount, folder: getServerFolder(), ids: idsToUpdate });

          // 通信完了後、対象のメールを一括で削除表示にする
          setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isDeleted: true } : em));
        } catch (error) {
          console.error("Bulk delete failed", error);
          alert(`一括削除中にエラーが発生しました: ${error}`);
        } finally {
          // イベント監視の解除とゲージ終了通知
          if (unlistenProgress) unlistenProgress();

          // 💡 クローズ処理も非同期の枠組みで行う
          setTimeout(() => {
            if (onProgressUpdate) onProgressUpdate(null);
          }, 0);
        }
      } else {
        setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isDeleted: true } : em));
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
    clearSearchAndRefresh
  };
}