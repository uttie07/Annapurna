import React from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, Trash2, ShieldAlert, Star } from 'lucide-react';

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
 * EmailList コンポーネントの Props 型定義
 */
interface EmailListProps {
  /** 現在アクティブなフォルダ識別名 ('inbox', 'sent', 'urgent', 'flagged', 'drafts') */
  activeFolder: string;

  /** バックエンドからのメール同期・更新中のローディング状態 */
  isRefreshing: boolean;

  /** クライアント側（またはサーバー側）の検索クエリ文字列 */
  searchQuery: string;

  /** 未読メールのみに絞り込むフィルタフラグ */
  filterUnread: boolean;

  /** 一括操作用にチェックボックスで選択されているメールIDの配列 */
  selectedIds: string[];

  /** フィルタおよびソートが適用済みの、画面に描画すべきメール配列 */
  filteredAndSortedEmails: Email[];

  /** 詳細表示で現在閲覧中のメールオブジェクト（未選択時は null） */
  readingEmail: Email | null;

  /** ページネーションの現在ページ番号（0スタート） */
  currentPage: number;

  /** 1ページあたりの最大表示件数 */
  PAGE_SIZE: number;

  /** 画面下部に表示する、現在の累積表示件数 */
  currentDisplayCount: number;

  /** 次のページのデータが存在するかどうかのフラグ */
  hasMore: boolean;

  /** 現在適用されているソートの設定状態 */
  sortConfig: SortConfig;

  /** フォルダ識別名を画面表示用の日本語ラベルに変換する関数 */
  getFolderDisplayLabel: (folderName: string) => string;

  /** メールデータを再取得またはページング取得する関数 */
  fetchEmails: (page: number) => Promise<void>;

  /** 検索クエリを更新するセッター関数 */
  setSearchQuery: (query: string) => void;

  /** 未読フィルタの状態を反転・更新するセッター関数 */
  setFilterUnread: (filter: boolean) => void;

  /** 選択中メールID配列を更新するセッター関数 */
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;

  /** 既読化または削除を一括で実行するハンドラー関数 */
  handleBulkAction: (action: 'read' | 'delete') => Promise<void>;

  /** ソート設定を更新するセッター関数 */
  setSortConfig: (config: SortConfig) => void;

  /** テーブルヘッダーに現在のソート状態を示すアイコンをレンダリングする関数 */
  renderSortIcon: (key: keyof Email) => React.ReactNode;

  /** メール一覧から特定のメールが選択（クリック）された際に詳細を開くハンドラー関数 */
  handleSelectEmail: (email: Email) => Promise<void>;

  /** 特定のメールの星付き（フラグ）状態を反転させる関数 */
  toggleFlagStatus: (id: string, e: React.MouseEvent) => Promise<void>;

  /** リスト右端の「目」アイコンなどから、AIインサイトのサイドドロワーを展開する関数 */
  handlePreviewEmail: (email: Email) => Promise<void>;

  /** 特定のメールの既読/未読状態を反転させる関数 */
  toggleReadStatus: (id: string, e: React.MouseEvent) => Promise<void>;

  /** 特定のメールを削除（ゴミ箱へ移動）する関数 */
  deleteEmail: (id: string, e: React.MouseEvent) => Promise<void>;
}

/**
 * アプリケーションの中央メインエリアに描画される、メール一覧コンポーネント。
 * @component
 */
export function EmailList({
                            activeFolder,
                            isRefreshing,
                            searchQuery,
                            filterUnread,
                            selectedIds,
                            filteredAndSortedEmails,
                            readingEmail,
                            currentPage,
                            PAGE_SIZE,
                            currentDisplayCount,
                            hasMore,
                            sortConfig,
                            getFolderDisplayLabel,
                            fetchEmails,
                            setSearchQuery,
                            setFilterUnread,
                            setSelectedIds,
                            handleBulkAction,
                            setSortConfig,
                            renderSortIcon,
                            handleSelectEmail,
                            toggleFlagStatus,
                            handlePreviewEmail,
                            toggleReadStatus,
                            deleteEmail,
                          }: EmailListProps) {

  const handleSortClick = (key: keyof Email) => {
    if (sortConfig?.key === key) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ key, direction: 'desc' });
      } else {
        setSortConfig(null);
      }
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === filteredAndSortedEmails.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedEmails.map(e => e.id));
    }
  };

  /**
   * 個別のメールのチェックボックスが切り替わった際のハンドラー
   * ✨ ESLintエラー回避のため、MouseEvent の型引数を厳密に指定
   */
  const handleSelectRowToggle = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    // ※ onChange 内ではイベントの伝播（バブリング）が起きないため、stopPropagation は消して大丈夫です
    setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
      <div className="email-list-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* 1. 上部ツールバーエリア (検索 & フィルタ) */}
        <div className="email-list-header-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{getFolderDisplayLabel(activeFolder)}</h2>
            {isRefreshing && <RefreshCw size={16} className="spin" style={{ color: 'var(--text-muted)' }} />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                  type="text"
                  placeholder="メールを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.875rem' }}
                  aria-label="メールを検索"
              />
            </div>

            <button
                onClick={() => setFilterUnread(!filterUnread)}
                className={`filter-btn ${filterUnread ? 'active' : ''}`}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: filterUnread ? 'var(--bg-selected)' : 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: filterUnread ? 'bold' : 'normal' }}
                aria-pressed={filterUnread}
            >
              未読のみ
            </button>
          </div>
        </div>

        {/* 2. 一括操作ツールバー */}
        {selectedIds.length > 0 && (
            <div className="bulk-actions-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px', backgroundColor: 'var(--bg-selected)', borderBottom: '1px solid var(--border-color)' }} aria-label="一括操作ツールバー">
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{selectedIds.length} 件選択中</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleBulkAction('read')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <CheckCircle size={14} color="#10b981" /> 既読にする
                </button>
                <button onClick={() => handleBulkAction('delete')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}>
                  <Trash2 size={14} /> 削除する
                </button>
              </div>
            </div>
        )}

        {/* 3. メインテーブルコンテナ */}
        <div className="email-table-container" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {filteredAndSortedEmails.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', color: 'var(--text-muted)', gap: '8px' }}>
                <ShieldAlert size={32} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: '0.95rem' }}>メールが見つかりません</span>
              </div>
          ) : (
              <table className="email-list-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-th)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', width: '40px' }}>
                    <input
                        type="checkbox"
                        checked={filteredAndSortedEmails.length > 0 && selectedIds.length === filteredAndSortedEmails.length}
                        onChange={handleSelectAllToggle}
                        aria-label="すべてのメールを選択"
                    />
                  </th>
                  <th onClick={() => handleSortClick('date')} style={{ padding: '12px 16px', cursor: 'pointer', width: '160px' }} role="columnheader" aria-sort={sortConfig?.key === 'date' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>日時 {renderSortIcon('date')}</div>
                  </th>
                  <th onClick={() => handleSortClick('subject')} style={{ padding: '12px 16px', cursor: 'pointer' }} role="columnheader" aria-sort={sortConfig?.key === 'subject' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>件名 {renderSortIcon('subject')}</div>
                  </th>
                  <th onClick={() => handleSortClick('from')} style={{ padding: '12px 16px', cursor: 'pointer', width: '200px' }} role="columnheader" aria-sort={sortConfig?.key === 'from' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>送信元 {renderSortIcon('from')}</div>
                  </th>
                  <th style={{ padding: '12px 16px', width: '100px', textAlign: 'right' }}>操作</th>
                </tr>
                </thead>
                <tbody>
                {filteredAndSortedEmails.map((email) => {
                  const isMenuSelected = readingEmail?.id === email.id;
                  const isRowChecked = selectedIds.includes(email.id);

                  return (
                      <tr
                          key={email.id}
                          onClick={() => handleSelectEmail(email)}
                          className={`email-row ${!email.isRead ? 'unread' : ''} ${isMenuSelected ? 'selected' : ''}`}
                          style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: isMenuSelected ? 'var(--bg-selected)' : (isRowChecked ? 'var(--bg-app)' : 'transparent'), fontSize: '0.9rem', fontWeight: !email.isRead ? '600' : 'normal' }}
                      >
                        {/* チェックボックス列 */}
                        <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                          <input
                              type="checkbox"
                              checked={isRowChecked}
                              onChange={(e) => handleSelectRowToggle(email.id, e)} // ✨ 型安全な直接呼び出しに修正
                              aria-label={`${email.subject} を選択`}
                          />
                        </td>

                        {/* 日時列 */}
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{email.date}</td>

                        {/* 件名列 */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: 'var(--text-main)' }}>{email.subject}</span>
                            {email.snippet && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{email.snippet}</span>}
                          </div>
                        </td>

                        {/* 送信元列 */}
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email.from}</td>

                        {/* ✨ 個別インライン操作列：Lucideアイコンに全面刷新して洗練 */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>

                            {/* 🌟 星付き（フラグ）切り替えボタン */}
                            <button
                                onClick={(e) => toggleFlagStatus(email.id, e)}
                                className="action-icon-btn"
                                title={email.isFlagged ? "星を外す" : "星を付ける"}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: email.isFlagged ? '#eab308' : 'var(--text-muted)', transition: 'background-color 0.2s, color 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Star size={16} fill={email.isFlagged ? '#eab308' : 'none'} strokeWidth={2} />
                            </button>

                            {/* 👁️ AIクイックインサイト用プレビューボタン */}
                            <button
                                onClick={() => handlePreviewEmail(email)}
                                className="action-icon-btn"
                                title="AI解析プレビュー"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'background-color 0.2s, color 0.2s' }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                                  e.currentTarget.style.color = '#8b5cf6'; // AIのテーマカラー（パープル）にほんのりハイライト
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = 'var(--text-muted)';
                                }}
                            >
                              {/* import に Eye を追加してください（入っていなければ最上部で補填します） */}
                              {/* もし Lucide に Eye が無ければ、元々あったSparkles等に変えてもカッコいいです */}
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>

                            {/* ✉️ 既読/未読切り替えボタン */}
                            <button
                                onClick={(e) => toggleReadStatus(email.id, e)}
                                className="action-icon-btn"
                                title={email.isRead ? "未読にする" : "既読にする"}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'background-color 0.2s, color 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {email.isRead ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                              ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M19 16v6"/><path d="m16 19 3 3 3-3"/></svg>
                              )}
                            </button>

                            {/* 🗑️ 削除ボタン */}
                            <button
                                onClick={(e) => deleteEmail(email.id, e)}
                                className="action-icon-btn"
                                title="削除"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', transition: 'background-color 0.2s, color 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffeeef'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Trash2 size={16} strokeWidth={2} />
                            </button>

                          </div>
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
          )}
        </div>

        {/* 4. フッターエリア */}
        <div className="email-list-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-th)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div>
            {currentDisplayCount > 0 ? (
                <span>{currentPage * PAGE_SIZE + 1} - {currentDisplayCount} 件目を表示中</span>
            ) : (
                <span>0 件</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
                onClick={() => fetchEmails(currentPage - 1)}
                disabled={currentPage === 0 || isRefreshing}
                style={{ display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', opacity: currentPage === 0 ? 0.5 : 1 }}
                aria-label="前のページへ"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 500 }}>ページ {currentPage + 1}</span>
            <button
                onClick={() => fetchEmails(currentPage + 1)}
                disabled={!hasMore || isRefreshing}
                style={{ display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', cursor: !hasMore ? 'not-allowed' : 'pointer', opacity: !hasMore ? 0.5 : 1 }}
                aria-label="次のページへ"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>
  );
}