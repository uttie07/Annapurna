import React from 'react';
import { Users, RefreshCw } from 'lucide-react';

/**
 * AddAccountModal コンポーネントの Props 型定義
 */
interface AddAccountModalProps {
  /** モーダル（ダイアログ）の開閉状態 */
  isAddAccountOpen: boolean;

  /** アカウント情報保存中のローディング（オーバーレイ表示）状態 */
  isAccountSaving: boolean;
  
  /** 新規追加するアカウントの識別名 (State) */
  newAccName: string;
  
  /** 新規追加するアカウントのメールアドレス (State) */
  newAccEmail: string;
  
  /** IMAPサーバーのホスト名 (State) */
  newAccImapHost: string;
  
  /** IMAPサーバーのポート番号 (State) */
  newAccImapPort: number;
  
  /** SMTPサーバーのホスト名 (State) */
  newAccSmtpHost: string;
  
  /** SMTPサーバーのポート番号 (State) */
  newAccSmtpPort: number;
  
  /** メールアカウントのパスワードまたはアプリパスワード (State) */
  newAccPassword: string;
  
  /** アカウントの識別名を更新するセッター関数 */
  setNewAccName: (name: string) => void;
  
  /** アカウントのメールアドレスを更新するセッター関数 */
  setNewAccEmail: (email: string) => void;
  
  /** IMAPサーバーのホスト名を更新するセッター関数 */
  setNewAccImapHost: (host: string) => void;
  
  /** IMAPサーバーのポート番号を更新するセッター関数 */
  setNewAccImapPort: (port: number) => void;
  
  /** SMTPサーバーのホスト名を更新するセッター関数 */
  setNewAccSmtpHost: (host: string) => void;
  
  /** SMTPサーバーのポート番号を更新するセッター番号 */
  setNewAccSmtpPort: (port: number) => void;
  
  /** パスワードを更新するセッター関数 */
  setNewAccPassword: (password: string) => void;
  
  /** モーダルの開閉状態を切り替えるセッター関数 */
  setIsAddAccountOpen: (open: boolean) => void;
  
  /**
   * フォーム送信（連携開始）時に実行されるサブミットハンドラー関数
   * ✨ 親側の汎用 FormEvent と 100% 適合するよう、特定のElementに依存しない型として定義
   * @param e フォーム送信イベントオブジェクト
   */
  handleAddAccountSubmit: (e: React.FormEvent<any>) => void | Promise<void>;
}

/**
 * 新しいIMAP/SMTPメールアカウントをアプリケーションに紐付けるためのモーダルダイアログ。
 * 保存処理中は二重送信を防ぐためのローディングオーバーレイを展開します。
 * @component
 */
export function AddAccountModal({
  isAddAccountOpen,
  isAccountSaving,
  newAccName,
  newAccEmail,
  newAccImapHost,
  newAccImapPort,
  newAccSmtpHost,
  newAccSmtpPort,
  newAccPassword,
  setNewAccName,
  setNewAccEmail,
  setNewAccImapHost,
  setNewAccImapPort,
  setNewAccSmtpHost,
  setNewAccSmtpPort,
  setNewAccPassword,
  setIsAddAccountOpen,
  handleAddAccountSubmit,
}: AddAccountModalProps) {
  
  // ダイアログが開いていないときは何もレンダリングしない (Early Return)
  if (!isAddAccountOpen) return null;

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      onClick={() => {
        // 保存中でなければ背景クリックでモーダルを閉じる
        if (!isAccountSaving) setIsAddAccountOpen(false);
      }}
    >
      <form 
        onSubmit={handleAddAccountSubmit} 
        onClick={(e) => e.stopPropagation()} // モーダル内クリックでの閉じるイベント伝播を抑止
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ width: '480px', maxWidth: '95%', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}
      >

        {/* アカウント情報保存中のローディングスクリーン */}
        {isAccountSaving && (
          <div 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-main)', opacity: 0.7, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '12px' }}
            aria-live="assertive"
            aria-label="アカウント情報を検証および保存中"
          >
            <RefreshCw size={32} className="spin" color="#2563eb" />
          </div>
        )}

        <h3 id="modal-title" style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <Users size={20} /> 新しいメールアカウントを追加
        </h3>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
            アカウントの識別名 <span style={{ color: 'red' }} aria-hidden="true">*</span>
          </label>
          <input type="text" placeholder="例: personal, sub-work" value={newAccName} onChange={e => setNewAccName(e.target.value.trim())} required disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
            メールアドレス <span style={{ color: 'red' }} aria-hidden="true">*</span>
          </label>
          <input type="email" placeholder="example@gmail.com" value={newAccEmail} onChange={e => setNewAccEmail(e.target.value.trim())} required disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>IMAPホスト</label>
            <input type="text" value={newAccImapHost} onChange={e => setNewAccImapHost(e.target.value.trim())} disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>ポート</label>
            <input type="number" value={newAccImapPort} onChange={e => setNewAccImapPort(Number(e.target.value))} disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>SMTPホスト</label>
            <input type="text" value={newAccSmtpHost} onChange={e => setNewAccSmtpHost(e.target.value.trim())} disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>ポート</label>
            <input type="number" value={newAccSmtpPort} onChange={e => setNewAccSmtpPort(Number(e.target.value))} disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
            パスワード / アプリパスワード <span style={{ color: 'red' }} aria-hidden="true">*</span>
          </label>
          <input type="password" placeholder="••••••••••••" value={newAccPassword} onChange={e => setNewAccPassword(e.target.value)} required disabled={isAccountSaving} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gmailの場合は、Googleアカウント設定で生成した16桁の「アプリパスワード」を入力してください。</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button 
            type="button" 
            onClick={() => setIsAddAccountOpen(false)} 
            disabled={isAccountSaving}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
          >
            キャンセル
          </button>
          <button 
            type="submit" 
            className="send-btn" 
            disabled={isAccountSaving}
            style={{ padding: '8px 16px', borderRadius: '6px' }}
          >
            連携を開始する
          </button>
        </div>
      </form>
    </div>
  );
}