import React from 'react';
import { Inbox, Send, Zap, Star, FileEdit, Folder, RefreshCw, Search, X, CheckCircle, Trash2, ChevronLeft, ChevronRight, Paperclip, Sparkles, Eye, Reply } from 'lucide-react';

// メールの型定義（App.tsxと合わせる）
type Email = {
  id: string; subject: string; from: string; to?: string; email_address: string; date: string; snippet: string;
  body: string; aiCategories: string[]; account: string;
  isRead: boolean; isFlagged: boolean; isAnswered: boolean; isDraft: boolean; isDeleted: boolean;
  attachmentsList?: string[];
};

type SortConfig = { key: keyof Email; direction: 'asc' | 'desc'; } | null;

interface EmailListProps {
  activeFolder: string;
  isRefreshing: boolean;
  searchQuery: string;
  filterUnread: boolean;
  selectedIds: string[];
  filteredAndSortedEmails: Email[];
  readingEmail: Email | null;
  currentPage: number;
  PAGE_SIZE: number;
  currentDisplayCount: number;
  hasMore: boolean;
  sortConfig: SortConfig;
  getFolderDisplayLabel: (folderName: string) => string;
  fetchEmails: (page: number) => void;
  setSearchQuery: (query: string) => void;
  setFilterUnread: (unread: boolean) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBulkAction: (action: 'read' | 'delete') => void;
  setSortConfig: (config: SortConfig) => void;
  renderSortIcon: (k: keyof Email) => React.ReactNode;
  handleSelectEmail: (email: Email) => void;
  toggleFlagStatus: (id: string, e: React.MouseEvent) => void;
  handlePreviewEmail: (email: Email) => void;
  toggleReadStatus: (id: string, e: React.MouseEvent) => void;
  deleteEmail: (id: string, e: React.MouseEvent) => void;
}

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
  return (
    <div className="email-list-container">
      <div className="header">
        <h2>
          {activeFolder === 'inbox' && <Inbox size={24} />}
          {activeFolder === 'sent' && <Send size={24} />}
          {activeFolder === 'urgent' && <Zap size={24} color="#f59e0b" />}
          {activeFolder === 'flagged' && <Star size={24} />}
          {activeFolder === 'drafts' && <FileEdit size={24} />}
          {!['urgent', 'inbox', 'sent', 'flagged', 'drafts'].includes(activeFolder) && <Folder size={24} color="#60a5fa" />}
          <span style={{ marginLeft: '8px' }}>{getFolderDisplayLabel(activeFolder)}</span>
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
                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 4px' }}></div>
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
                    onChange={() => setSelectedIds(prev => prev.includes(email.id) ? prev.filter(i => i !== email.id) : [...prev, email.id])}
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
                    title="AIで内容を解析"
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
  );
}