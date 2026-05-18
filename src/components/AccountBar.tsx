import { Plus } from 'lucide-react';

/**
 * AccountBar コンポーネントの Props 型定義
 */
interface AccountBarProps {
  /** 連携されているアカウント識別名の配列 (例: ['work', 'personal']) */
  accounts: string[];

  /** 現在アクティブ（選択中）のアカウント識別名 */
  activeAccount: string;

  /**
   * アカウントアイコンがクリックされた際に発ハするコールバック関数
   * @param accName 選択されたアカウントの識別名
   */
  onSelectAccount: (accName: string) => void;

  /** アカウント追加用の点線プラスボタンがクリックされた際に発ハするコールバック関数 */
  onOpenAddAccount: () => void;
}

/**
 * アプリケーションの最左端に配置される、アカウント切り替え用の縦型サイドバー。
 * 各アカウントの頭文字をアイコンとして一覧表示し、クリックで切り替えを可能にします。
 * @component
 * @example
 * ```tsx
 * <AccountBar
 * accounts={['work', 'personal']}
 * activeAccount="work"
 * onSelectAccount={(name) => console.log(name)}
 * onOpenAddAccount={() => setShowModal(true)}
 * />
 * ```
 */
export function AccountBar({
  accounts,
  activeAccount,
  onSelectAccount,
  onOpenAddAccount,
}: AccountBarProps) {
  return (
    <div className="account-bar" role="navigation" aria-label="アカウント切り替えバー">
      {accounts.map((accName) => {
        const isSelected = activeAccount === accName;
        const displayChar = accName.charAt(0).toUpperCase();
        return (
          <div
            key={accName}
            className={`account-icon ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectAccount(accName)}
            title={accName}
            role="button"
            aria-pressed={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectAccount(accName);
              }
            }}
          >
            {displayChar}
          </div>
        );
      })}

      {/* アカウントアイコンと追加ボタンを区切るディバイダーライン */}
      <div className="account-bar-divider" style={{ width: '32px', height: '2px', backgroundColor: '#1f2937', margin: '4px 0' }}></div>

      {/* アカウント追加用フローティングボタン */}
      <div
        className="account-icon account-add-btn"
        style={{ border: '1px dashed #4b5563', backgroundColor: 'transparent', cursor: 'pointer' }}
        onClick={onOpenAddAccount}
        title="アカウントを追加"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenAddAccount();
          }
        }}
      >
        <Plus size={20} />
      </div>
    </div>
  );
}