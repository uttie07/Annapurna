import { MountainSnow, Inbox, Send, Zap, Star, FileEdit, Folder, Sun, Moon, Settings } from 'lucide-react';

/**
 * Sidebar コンポーネントの Props 型定義
 */
interface SidebarProps {
    /** ✨ 変更: メールサーバーから一律取得したアカウント固有のフォルダ配列 */
    folders: string[];

    /** 現在選択されているアクティブなフォルダ名 */
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
 * アカウント別の動的フォルダ構造の一律レンダリングに完全対応しています。
 * @component
 */
export function Sidebar({
                            folders,
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
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                {isSelected && currentDisplayCount > 0 && (
                    <span className="sidebar-unread-count">{currentDisplayCount}</span>
                )}
            </div>
        );
    };

    /**
     * ✨ 追加: サーバーから取得した様々なフォルダ文字列から、適切なLucideアイコンを動的に選択するマッパー
     */
    const getFolderIcon = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName === 'inbox') return <Inbox size={18} />;
        if (lowerName.includes('sent')) return <Send size={18} />;
        if (lowerName.includes('draft')) return <FileEdit size={18} />;
        if (lowerName.includes('flagged') || lowerName.includes('star')) {
            return <Star size={18} color={activeFolder === name ? "#eab308" : "currentColor"} />;
        }
        // 標準的な名前にヒットしないカスタムフォルダ、送信済みトレイの亜種は汎用フォルダアイコンにマッピング
        return <Folder size={18} />;
    };

    /**
     * ✨ 追加: フォルダのシステム用識別子から、画面表示用の日本語ラベルを安全に生成する関数
     */
    const getFolderLabel = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName === 'inbox') return '受信トレイ';
        if (lowerName === 'sent' || lowerName === 'sent items') return '送信済み';
        if (lowerName === 'drafts' || lowerName === 'draft') return '下書き';
        if (lowerName === 'flagged') return '星付き';
        // [Gmail]/送信済みトレイ などの特殊なIMAPフルパスから純粋なフォルダ名のみを美しく切り出す
        if (name.includes('/')) {
            return name.split('/').pop() || name;
        }
        return name;
    };

    return (
        <div className="sidebar" role="navigation" aria-label="メインナビゲーション">
            {/* アプリケーションロゴ領域 */}
            <div className="sidebar-title">
                <MountainSnow size={24} color="#60a5fa" /> Annapurna
            </div>

            {/* 固定配置の AI スマート判定エリア */}
            <div className="sidebar-label">AI Smart</div>
            {renderSidebarItem('urgent', <Zap size={18} color="#f59e0b" />, '至急対応')}

            {/* ✨ サーバー・アカウントごとのフォルダ群を一律で動的にレンダリングするセクション */}
            <div className="sidebar-label">メールボックス</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {folders.map((folderName) =>
                    renderSidebarItem(
                        folderName,
                        getFolderIcon(folderName),
                        getFolderLabel(folderName)
                    )
                )}
            </div>

            {/* ツールバー（テーマ切り替え & 設定ボタン）領域 */}
            <div className="theme-toggle-container" style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
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