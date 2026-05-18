import React from 'react';
import { Plus } from 'lucide-react';

// 親（App.tsx）から受け取るデータの型定義（Props）
interface AccountBarProps {
  accounts: string[];
  activeAccount: string;
  onSelectAccount: (accName: string) => void;
  onOpenAddAccount: () => void;
}

export function AccountBar({
  accounts,
  activeAccount,
  onSelectAccount,
  onOpenAddAccount,
}: AccountBarProps) {
  return (
    <div className="account-bar">
      {accounts.map((accName) => {
        const isSelected = activeAccount === accName;
        const displayChar = accName.charAt(0).toUpperCase();
        return (
          <div
            key={accName}
            className={`account-icon ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectAccount(accName)}
            title={accName}
          >
            {displayChar}
          </div>
        );
      })}
      <div style={{ width: '32px', height: '2px', backgroundColor: '#1f2937', margin: '4px 0' }}></div>
      <div
        className="account-icon"
        style={{ border: '1px dashed #4b5563', backgroundColor: 'transparent', cursor: 'pointer' }}
        onClick={onOpenAddAccount}
        title="アカウントを追加"
      >
        <Plus size={20} />
      </div>
    </div>
  );
}