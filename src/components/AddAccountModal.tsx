import React from 'react';
import { Users, RefreshCw } from 'lucide-react';

interface AddAccountModalProps {
  isAddAccountOpen: boolean;
  isAccountSaving: boolean;
  newAccName: string;
  newAccEmail: string;
  newAccImapHost: string;
  newAccImapPort: number;
  newAccSmtpHost: string;
  newAccSmtpPort: number;
  newAccPassword: string;
  setNewAccName: (name: string) => void;
  setNewAccEmail: (email: string) => void;
  setNewAccImapHost: (host: string) => void;
  setNewAccImapPort: (port: number) => void;
  setNewAccSmtpHost: (host: string) => void;
  setNewAccSmtpPort: (port: number) => void;
  setNewAccPassword: (password: string) => void;
  setIsAddAccountOpen: (open: boolean) => void;
  handleAddAccountSubmit: (e: React.FormEvent) => void;
}

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
  // ダイアログが開いていないときは何もレンダリングしない
  if (!isAddAccountOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <form onSubmit={handleAddAccountSubmit} style={{ width: '480px', maxWidth: '95%', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>

        {isAccountSaving && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-main)', opacity: 0.7, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '12px' }}>
            <RefreshCw size={32} className="spin" color="#2563eb" />
          </div>
        )}

        <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <Users size={20} /> 新しいメールアカウントを追加
        </h3>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>アカウントの識別名 <span style={{ color: 'red' }}>*</span></label>
          <input type="text" placeholder="例: personal, sub-work" value={newAccName} onChange={e => setNewAccName(e.target.value.trim())} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>メールアドレス <span style={{ color: 'red' }}>*</span></label>
          <input type="email" placeholder="example@gmail.com" value={newAccEmail} onChange={e => setNewAccEmail(e.target.value.trim())} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>IMAPホスト</label>
            <input type="text" value={newAccImapHost} onChange={e => setNewAccImapHost(e.target.value.trim())} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>ポート</label>
            <input type="number" value={newAccImapPort} onChange={e => setNewAccImapPort(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>SMTPホスト</label>
            <input type="text" value={newAccSmtpHost} onChange={e => setNewAccSmtpHost(e.target.value.trim())} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>ポート</label>
            <input type="number" value={newAccSmtpPort} onChange={e => setNewAccSmtpPort(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>パスワード / アプリパスワード <span style={{ color: 'red' }}>*</span></label>
          <input type="password" placeholder="••••••••••••" value={newAccPassword} onChange={e => setNewAccPassword(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gmailの場合は、Googleアカウント設定で生成した16桁の「アプリパスワード」を入力してください。</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button type="button" onClick={() => setIsAddAccountOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>キャンセル</button>
          <button type="submit" className="send-btn" style={{ padding: '8px 16px', borderRadius: '6px' }}>連携を開始する</button>
        </div>
      </form>
    </div>
  );
}