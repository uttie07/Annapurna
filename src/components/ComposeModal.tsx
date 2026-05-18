import React from 'react';
import { X, Paperclip, RefreshCw, Send } from 'lucide-react';

interface ComposeModalProps {
  isComposeOpen: boolean;
  composeTo: string;
  composeSubject: string;
  composeBody: string;
  isComposeSending: boolean;
  setComposeTo: (to: string) => void;
  setComposeSubject: (subject: string) => void;
  setComposeBody: (body: string) => void;
  handleCloseCompose: () => void;
  handleComposeSend: () => void;
}

export function ComposeModal({
  isComposeOpen,
  composeTo,
  composeSubject,
  composeBody,
  isComposeSending,
  setComposeTo,
  setComposeSubject,
  setComposeBody,
  handleCloseCompose,
  handleComposeSend,
}: ComposeModalProps) {
  // ダイアログが開いていないときは何もレンダリングしない
  if (!isComposeOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '600px', maxWidth: '90%', height: '500px', backgroundColor: 'var(--bg-main)', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
        
        {/* ヘッダー領域 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>新規メッセージ</h3>
          <button className="icon-button" onClick={handleCloseCompose}><X size={20} /></button>
        </div>
        
        {/* フォーム入力領域 */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 20px', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="宛先 (例: test@example.com)" 
            value={composeTo} 
            onChange={e => setComposeTo(e.target.value)} 
            disabled={isComposeSending} 
            style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem' }} 
          />
          <input 
            type="text" 
            placeholder="件名" 
            value={composeSubject} 
            onChange={e => setComposeSubject(e.target.value)} 
            disabled={isComposeSending} 
            style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem', fontWeight: 'bold' }} 
          />
          <textarea 
            placeholder="本文を入力..." 
            value={composeBody} 
            onChange={e => setComposeBody(e.target.value)} 
            disabled={isComposeSending} 
            style={{ width: '100%', flex: 1, padding: '12px 0', border: 'none', backgroundColor: 'transparent', color: 'var(--text-main)', outline: 'none', resize: 'none', fontSize: '0.95rem', fontFamily: 'inherit' }} 
          />
        </div>
        
        {/* フッターツールバー領域 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', backgroundColor: 'var(--bg-header)', borderTop: '1px solid var(--border-color)' }}>
          <button className="icon-button" style={{ color: 'var(--text-muted)' }} title="添付ファイル（準備中）"><Paperclip size={18} /></button>
          <button 
            className="send-btn" 
            onClick={handleComposeSend} 
            disabled={isComposeSending || !composeTo.trim() || !composeBody.trim()} 
            style={{ padding: '8px 24px' }}
          >
            {isComposeSending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />} 
            {isComposeSending ? '送信中...' : '送信する'}
          </button>
        </div>

      </div>
    </div>
  );
}