import { MountainSnow, Inbox, Send, Zap, Star, FileEdit, Sun, Moon, Settings } from 'lucide-react';

/**
 * Sidebar コンポーネントの Props 型定義
 */
interface SidebarProps {
  /** 現在選択されているアクティブなフォルダ名 (例: 'inbox', 'sent', 'urgent', 'flagged', 'drafts') */
  activeFolder: string;
  
  /** 現在のフォルダ一覧に表示されているメールの件数 */
  currentDisplayCount: number;
  
  /** アプリケーションのダークモード状態 */
  isDarkMode: boolean;
  
  /**
   * フォルダ（サイドバーアイテム）が選択された際に発火するコールバック関数
   * @param folderName 選択されたフォルダの識別名
   */
  onSelectFolder: (folderName: string) => void;
  
  /** ダークモードとライトモードを切り替える際に発発火するコールバック関数 */
  onToggleDarkMode: () => void;
  
  /** 設定モーダルを開く際に発火するコールバック関数 */
  onOpenSettings: () => void;
}

/**
 * アプリケーションの左側に配置されるメインナビゲーションサイドバー。
 * 各メールフォルダへの遷移、AI連携フォルダの操作、テーマ切り替え、設定モーダルの展開を担当します。
 * @component
 * @example
 * ```tsx
 * <Sidebar
 * activeFolder="inbox"
 * currentDisplayCount={12}
 * isDarkMode={false}
 * onSelectFolder={(folder) => console.log(folder)}
 * onToggleDarkMode={() => handleTheme()}
 * onOpenSettings={() => handleSettings()}
 * />
 * ```
 */
export function Sidebar({
  activeFolder,
  currentDisplayCount,
  isDarkMode,
  onSelectFolder,
  onToggleDarkMode,
  onOpenSettings,
}: SidebarProps) {
  
  /**
   * 各フォルダアイテムをレンダリングする共通ヘルパー関数。
   * アクセシビリティ対応とキーボード操作を内包しています。
   */
  const renderSidebarItem = (folderName: string, icon: React.ReactNode, label: string) => {
    const isSelected = activeFolder === folderName;
    
    return (
      <div 
        className={`sidebar-item ${isSelected ? 'active' : ''}`} 
        onClick={() => onSelectFolder(folderName)}
        role="button"
        aria-pressed={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectFolder(folderName);
          }
        }}
      >
        {icon}
        {label}
        {isSelected && currentDisplayCount > 0 && (
          <span className="sidebar-unread-count">{currentDisplayCount}</span>
        )}
      </div>
    );
  };

  return (
    <div className="sidebar" role="navigation" aria-label="メインナビゲーション">
      {/* アプリケーションロゴ領域 */}
      <div className="sidebar-title">
        <MountainSnow size={24} color="#60a5fa" /> Annapurna
      </div>
      
      <div className="sidebar-label">メイン</div>
      {renderSidebarItem('inbox', <Inbox size={18} />, '受信トレイ')}
      {renderSidebarItem('sent', <Send size={18} />, '送信済み')}

      <div className="sidebar-label">AI Smart</div>
      {renderSidebarItem('urgent', <Zap size={18} color="#f59e0b" />, '至急対応')}

      <div className="sidebar-label">フォルダ</div>
      {renderSidebarItem('flagged', (
        <Star size={18} color={activeFolder === 'flagged' ? "#eab308" : "currentColor"} />
      ), '星付き')}
      {renderSidebarItem('drafts', <FileEdit size={18} />, '下書き')}

      {/* ツールバー（テーマ切り替え & 設定ボタン）領域 */}
      <div className="theme-toggle-container" style={{ display: 'flex', gap: '8px' }}>
        <button 
          className="theme-toggle-btn" 
          style={{ flex: 1 }} 
          onClick={onToggleDarkMode}
          aria-label={`テーマを${isDarkMode ? 'ライト' : 'ダーク'}モードに切り替え`}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />} {isDarkMode ? 'ライト' : 'ダーク'}
        </button>
        <button 
          className="theme-toggle-btn" 
          style={{ width: 'auto', padding: '0 12px' }} 
          onClick={onOpenSettings} 
          title="設定"
          aria-label="設定を開く"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}