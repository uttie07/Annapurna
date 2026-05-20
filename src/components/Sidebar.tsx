import React, { useState } from 'react';
import {
    MountainSnow, Inbox, Send, Star, FileEdit, Trash2,
    Folder, Sun, Moon, Settings, ChevronDown, ChevronRight
} from 'lucide-react';

/**
 * Sidebar コンポーネントの Props 型定義
 */
interface SidebarProps {
    /** メールサーバーから一律取得したアカウント固有のフォルダ配列 */
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
 * サーバー固有の動的フォルダを優先度順に自動ソートし、かつアコーディオン構造でスッキリ収納します。
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

    // ✨ 追加: カスタムフォルダ群を折りたたんで隠すための開閉State (初期状態は開く: true、閉じるなら false)
    const [isFoldersExpanded, setIsFoldersExpanded] = useState<boolean>(false);

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
     * サーバーから取得した様々なフォルダ文字列から、適切なLucideアイコンを動的に選択するマッパー
     */
    const getFolderIcon = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName === 'inbox') return <Inbox size={18} />;
        if (lowerName.includes('sent')) return <Send size={18} />;
        if (lowerName.includes('draft')) return <FileEdit size={18} />;
        if (lowerName.includes('trash') || lowerName.includes('gomi') || lowerName.includes('ゴミ')) return <Trash2 size={18} />;
        if (lowerName.includes('flagged') || lowerName.includes('star')) {
            return <Star size={18} color={activeFolder === name ? "#eab308" : "currentColor"} />;
        }
        return <Folder size={18} />;
    };

    /**
     * フォルダのシステム用識別子から、画面表示用の日本語ラベルを安全に生成する関数
     */
    const getFolderLabel = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName === 'inbox') return '受信トレイ';
        if (lowerName === 'sent' || lowerName === 'sent items' || lowerName.includes('送信済み')) return '送信済み';
        if (lowerName === 'drafts' || lowerName === 'draft' || lowerName.includes('下書き')) return '下書き';
        if (lowerName === 'flagged' || lowerName.includes('スター')) return '星付き';
        if (lowerName === 'trash' || lowerName.includes('ゴミ箱')) return 'ゴミ箱';

        if (name.includes('/')) {
            return name.split('/').pop() || name;
        }
        return name;
    };

    /**
     * フォルダの重要度（並び順）をスコアリングして並び替えるロジック
     */
    const getFolderPriority = (name: string): number => {
        const lowerName = name.toLowerCase();
        if (lowerName === 'inbox') return 1;
        if (lowerName.includes('sent')) return 2;
        if (lowerName.includes('draft')) return 3;
        if (lowerName.includes('flagged') || lowerName.includes('star')) return 4;
        if (lowerName.includes('trash') || lowerName.includes('ゴミ')) return 5;
        return 100; // 最上部固定以外のカスタムフォルダ
    };

    // メインフォルダ（優先度1〜5）と、カスタムフォルダ（優先度100）を分離
    const sortedFolders = [...folders].sort((a, b) => {
        const priorityA = getFolderPriority(a);
        const priorityB = getFolderPriority(b);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    const mainFolders = sortedFolders.filter(f => getFolderPriority(f) < 100);
    const customFolders = sortedFolders.filter(f => getFolderPriority(f) >= 100);

    return (
        <div className="sidebar" role="navigation" aria-label="メインナビゲーション" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* アプリケーションロゴ領域 */}
            <div className="sidebar-title">
                <MountainSnow size={24} color="#60a5fa" /> Annapurna
            </div>

            {/* 2. メインメールボックスエリア（常時表示） */}
            <div className="sidebar-label">メールボックス</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                {mainFolders.map((folderName) =>
                    renderSidebarItem(
                        folderName,
                        getFolderIcon(folderName),
                        getFolderLabel(folderName)
                    )
                )}
            </div>

            {/* 3. ✨ 追加: アコーディオン式のその他フォルダーエリア */}
            {customFolders.length > 0 && (
                <>
                    <div
                        className="sidebar-label"
                        onClick={() => setIsFoldersExpanded(!isFoldersExpanded)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none',
                            paddingRight: '8px',
                            marginTop: '12px'
                        }}
                        role="button"
                        aria-expanded={isFoldersExpanded}
                    >
                        <span>その他フォルダー ({customFolders.length})</span>
                        {isFoldersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>

                    {/* 開閉状態に連動するコンテナ。overflowYを隠してダサいスクロールバーの発生を抑止 */}
                    <div
                        className="sidebar-custom-folders-container"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            maxHeight: isFoldersExpanded ? '300px' : '0px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            transition: 'all 0.25s ease-in-out',
                            opacity: isFoldersExpanded ? 1 : 0,
                            paddingLeft: '4px'
                        }}
                    >
                        {customFolders.map((folderName) =>
                            renderSidebarItem(
                                folderName,
                                getFolderIcon(folderName),
                                getFolderLabel(folderName)
                            )
                        )}
                    </div>
                </>
            )}

            {/* ツールバー（テーマ切り替え & 設定ボタン）領域 */}
            <div className="theme-toggle-container" style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
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