import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 💡 モック環境でテスト・画面改善を行う場合は true、実サーバーに繋ぐ場合は false
const USE_MOCK = false;
const PAGE_SIZE = 200;

/**
 * メールデータのオブジェクト構造定義
 */
export type Email = {
  id: string;
  subject: string;
  from: string;
  to?: string;
  email_address: string;
  date: string;
  snippet: string;
  body: string;
  aiCategories: string[];
  aiScore: number;       // ✨ 追加: ローカルAI不要判定スコア (0-100)
  aiReason: string;      // ✨ 追加: スコア判定理由
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
    aiScore?: number;    // ✨ Rust側の camelCase 出力を反映
    aiReason?: string;
  }>;
  totalCount: number;
}

/**
 * useEmails カスタムフックの戻り値（外部へ公開するインターフェース）型定義
 */
interface UseEmailsReturn {
  /** フェッチされたメールデータの全配列（フィルタ前のマスタ） */
  emails: Email[];
  /** メールデータマスタを更新するセッター関数 */
  setEmails: React.Dispatch<React.SetStateAction<Email[]>>;
  /** 現在適用されているソートの設定情報 */
  sortConfig: SortConfig;
  /** ソート設定を更新するセッター関数 */
  setSortConfig: (config: SortConfig) => void;
  /** チェックボックスで一括選択されているメールIDの配列 */
  selectedIds: string[];
  /** 一括選択のID配列を更新するセッター関数 */
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** 同期・再取得が実行中かどうかのローディングフラグ */
  isRefreshing: boolean;
  /** 検索バーに入力されている文字列のState */
  searchQuery: string;
  /** 検索文字列を更新するセッター関数 */
  setSearchQuery: (query: string) => void;
  /** 未読メールのみに絞り込むかどうかのフラグState */
  filterUnread: boolean;
  /** 未読フィルタの状態を反転・更新するセッター関数 */
  setFilterUnread: (filter: boolean) => void;
  /** ページネーションの現在ページ番号（0スタート） */
  currentPage: number;
  /** 現在ページ番号を更新するセッター関数 */
  setCurrentPage: (page: number) => void;
  /** 次のページのデータがサーバー側に存在するかどうかのフラグ */
  hasMore: boolean;
  /** hasMore の状態を更新するセッター関数 */
  setHasMore: (more: boolean) => void;
  /** 1ページあたりの最大表示レコード定数（50固定） */
  PAGE_SIZE: number;
  /** 現在の検索・フォルダ・未読フィルタ・ソートをすべて適用した、画面にループ描画すべきメール配列 */
  filteredAndSortedEmails: Email[];
  /** 画面下部のフッターに表示する、現在の累積表示件数 */
  currentDisplayCount: number;
  /** 現在のアクティブフォルダに対応する、サーバー（IMAP）側の物理フォルダ名（"INBOX" 等）を返す関数 */
  getServerFolder: () => string;
  /**
   * サーバーまたはモックから指定されたページのメール一覧を非同期フェッチする関数
   * @param page 取得対象のページ番号（0スタート）
   */
  fetchEmails: (page?: number) => Promise<void>;
  /**
   * 特定のメールの既読 / 未読状態を反転させ、サーバーの "Seen" フラグを同期する関数
   * @param id 対象のメールID
   * @param e イベント伝播を抑制するためのマウスイベント
   */
  toggleReadStatus: (id: string, e: React.MouseEvent) => Promise<void>;
  /**
   * 特定のメールの星付き（フラグ）状態を反転させ、サーバーの "Flagged" フラグを同期する関数
   * @param id 対象のメールID
   * @param e イベント伝播を抑制するためのマウスイベント
   */
  toggleFlagStatus: (id: string, e: React.MouseEvent) => Promise<void>;
  /**
   * 特定のメールをゴミ箱へ移動（または削除）し、詳細画面の選択をクリアする関数
   * @param id 対象のメールID
   * @param e イベント伝播を抑制するためのマウスイベント
   * @param isReading 現在削除対象のメールを開いているかどうかのフラグ
   * @param setReadingNull 開いている詳細表示を閉じるためのコールバック関数
   */
  deleteEmail: (id: string, e: React.MouseEvent, isReading: boolean, setReadingNull: () => void) => Promise<void>;
  /**
   * チェックボックスで選択された全メールに対して、一括既読化または一括削除をバッチ実行する関数
   * @param action 実行したい操作の識別子 ('read' | 'delete')
   */
  handleBulkAction: (action: 'read' | 'delete') => Promise<void>;
  /** From等の複雑なRFC文字列から、表示用の純粋な「差出人氏名」のみをパースする関数 */
  formatSenderName: (fromStr: string) => string;
  /** From等の複雑なRFC文字列から、`<...>` に囲まれた純粋な「メールアドレス」のみをパースする関数 */
  extractEmailAddress: (fromStr: string) => string;
  /** ISO 8601等形式の時刻文字列を、画面表示用に 「YYYY-MM-DD HH:mm」へ成形する関数 */
  formatEmailDate: (dateStr: string) => string;
  /** ✨ 新設: 検索クエリを完全に空にして、サーバーから通常の一覧を再取得する関数 */
  clearSearchAndRefresh: () => Promise<void>;
}

/**
 * メール一覧の取得・状態管理・検索・フィルタリング、およびバックエンドへのフラグ更新の
 * すべてのインフラストラクチャロジックを統括する、アプリケーションのコア・カスタムフック。
 * @returns 画面コンポーネント（EmailList, EmailDetail等）へ受け渡す全データとコールバック
 */
export function useEmails({ activeAccount, activeFolder }: UseEmailsProps): UseEmailsReturn {
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
    await Promise.resolve();
    setIsRefreshing(true);
    const isTauri = USE_MOCK ? false : ('__TAURI_INTERNALS__' in window);

    if (isTauri) {
      try {
        const response = await invoke<GetEmailsResponse>('get_emails', {
          account: activeAccount,
          folder: getServerFolder(),
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
            snippet: '',
            body: '',
            aiCategories: [],
            aiScore: e.aiScore ?? 0,      // ✨ スコアを格納
            aiReason: e.aiReason ?? '',  // ✨ 理由を格納
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
    let ignore = false;
    const load = async () => {
      if (!ignore) {
        await fetchEmails(0);
      }
    };
    void load();

    return () => {
      ignore = true;
    };
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
   * 単一メールの削除（学習用メタデータをバックエンドに送る）
   */
  const deleteEmail = async (id: string, e: React.MouseEvent, isReading: boolean, setReadingNull: () => void): Promise<void> => {
    e.stopPropagation();
    const target = emails.find(em => em.id === id);
    setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: true } : em));
    if (isReading) setReadingNull();

    if (!USE_MOCK) {
      try {
        await invoke('delete_emails', {
          account: activeAccount,
          folder: getServerFolder(),
          ids: [id],
          froms: [target?.from || ''],
          fromAddresses: [target?.email_address || ''],
          subjects: [target?.subject || '']
        });
      } catch (error) {
        console.error("Delete failed", error);
        alert(`削除に失敗しました: ${error}`);
        setEmails(prev => prev.map(em => em.id === id ? { ...em, isDeleted: false } : em));
      }
    }
  };

  /**
   * 一括削除（選択された全メールのメタデータをまとめて学習用に送る）
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
      const targets = emails.filter(em => idsToUpdate.includes(em.id));
      setEmails(prev => prev.map(em => idsToUpdate.includes(em.id) ? { ...em, isDeleted: true } : em));
      setSelectedIds([]);
      if (!USE_MOCK) {
        try {
          await invoke('delete_emails', {
            account: activeAccount,
            folder: getServerFolder(),
            ids: idsToUpdate,
            froms: targets.map(t => t.from),
            fromAddresses: targets.map(t => t.email_address),
            subjects: targets.map(t => t.subject)
          });
        } catch (error) {
          console.error("Bulk delete failed", error);
          alert(`削除に失敗しました: ${error}`);
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
    clearSearchAndRefresh
  };
}