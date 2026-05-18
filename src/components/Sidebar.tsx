import React from 'react';
import { MountainSnow, Inbox, Send, Zap, Star, FileEdit, Trash2, Sun, Moon, Settings } from 'lucide-react';

interface SidebarProps {
  activeFolder: string;
  currentDisplayCount: number;
  isDarkMode: boolean;
  onSelectFolder: (folderName: string) => void;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  activeFolder,
  currentDisplayCount,
  isDarkMode,
  onSelectFolder,
  onToggleDarkMode,
  onOpenSettings,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-title">
        <MountainSnow size={24} color="#60a5fa" /> Annapurna
      </div>
      
      <div className="sidebar-label">メイン</div>
      <div 
        className={`sidebar-item ${activeFolder === 'inbox' ? 'active' : ''}`} 
        onClick={() => onSelectFolder('inbox')}
      >
        <Inbox size={18} /> 受信トレイ {activeFolder === 'inbox' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
      </div>
      <div 
        className={`sidebar-item ${activeFolder === 'sent' ? 'active' : ''}`} 
        onClick={() => onSelectFolder('sent')}
      >
        <Send size={18} /> 送信済み {activeFolder === 'sent' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
      </div>

      <div className="sidebar-label">AI Smart</div>
      <div 
        className={`sidebar-item ${activeFolder === 'urgent' ? 'active' : ''}`} 
        onClick={() => onSelectFolder('urgent')}
      >
        <Zap size={18} color="#f59e0b" /> 至急対応 {activeFolder === 'urgent' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
      </div>

      <div className="sidebar-label">フォルダ</div>
      <div 
        className={`sidebar-item ${activeFolder === 'flagged' ? 'active' : ''}`} 
        onClick={() => onSelectFolder('flagged')}
      >
        <Star size={18} color={activeFolder === 'flagged' ? "#eab308" : "currentColor"} /> 星付き {activeFolder === 'flagged' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
      </div>
      <div 
        className={`sidebar-item ${activeFolder === 'drafts' ? 'active' : ''}`} 
        onClick={() => onSelectFolder('drafts')}
      >
        <FileEdit size={18} /> 下書き {activeFolder === 'drafts' && currentDisplayCount > 0 && <span className="sidebar-unread-count">{currentDisplayCount}</span>}
      </div>

      {/* 💡 今朝の断面に含まれていたテーマ切り替えと設定ボタンのコンテナ */}
      <div className="theme-toggle-container" style={{ display: 'flex', gap: '8px' }}>
        <button className="theme-toggle-btn" style={{ flex: 1 }} onClick={onToggleDarkMode}>
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />} {isDarkMode ? 'ライト' : 'ダーク'}
        </button>
        <button className="theme-toggle-btn" style={{ width: 'auto', padding: '0 12px' }} onClick={onOpenSettings} title="設定">
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}