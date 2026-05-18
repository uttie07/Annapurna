import { Mail, Send, RefreshCw, X } from 'lucide-react';

/**
 * ComposeModal コンポーネントの Props 型定義
 */
interface ComposeModalProps {
  /** モーダル（新規作成画面）の開閉状態 */
  isComposeOpen: boolean;

  /** 送信先メールアドレス (State) */
  composeTo: string;

  /** メールの件名 (State) */
  composeSubject: string;

  /** メールの本文 (State) */
  composeBody: string;

  /** メール送信処理（Rustバックエンド経由）が実行中かどうかのフラグ */
  isComposeSending: boolean;

  /** 送信先アドレスを更新するセッター関数 */
  setComposeTo: (to: string) => void;

  /** 件名を更新するセッター関数 */
  setComposeSubject: (subject: string) => void;

  /** 本文を更新するセッター関数 */
  setComposeBody: (body: string) => void;

  /**
   * モーダルを閉じる際のハンドラー。
   * 未送信の内容がある場合、下書き保存の確認ダイアログを表示するロジックを内包します。
   */
  handleCloseCompose: () => Promise<void>;

  /** 構成されたメールを実際に送信するハンドラー関数 */
  handleComposeSend: () => Promise<void>;
}

/**
 * メールの新規作成および下書き編集を行うためのモーダルダイアログ。
 * 送信実行中はすべての入力をロックし、二重送信や誤操作を防止します。
 * @component
 */
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

  // モーダルが開いていないときは何も描画しない (Early Return)
  if (!isComposeOpen) return null;

  return (
      <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onClick={() => {
            // 背景クリックで閉じる（保存確認ロジックを通すため handleCloseCompose を呼ぶ）
            if (!isComposeSending) handleCloseCompose();
          }}
      >
        <div
            className="compose-modal-container"
            onClick={(e) => e.stopPropagation()} // モーダル内クリックでの閉じるイベント伝播を抑止
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-title"
            style={{ width: '600px', maxWidth: '95%', backgroundColor: 'var(--bg-main)', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
        >

          {/* 送信中のローディングオーバーレイ */}
          {isComposeSending && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-main)', opacity: 0.7, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <RefreshCw size={40} className="spin" color="#2563eb" />
                <span style={{ fontWeight: 600, color: '#2563eb' }}>送信中...</span>
              </div>
          )}

          {/* 1. モーダルヘッダー */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-th)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div id="compose-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
              <Mail size={18} /> 新規メッセージ
            </div>
            <button
                onClick={handleCloseCompose}
                disabled={isComposeSending}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                title="閉じる"
            >
              <X size={20} />
            </button>
          </div>

          {/* 2. 入力フィールド領域（宛先・件名） */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ width: '60px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>宛先:</span>
              <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="example@mail.com"
                  disabled={isComposeSending}
                  required
                  style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ width: '60px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>件名:</span>
              <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="件名を入力"
                  disabled={isComposeSending}
                  style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* 3. 本文入力領域 */}
          <div style={{ flex: 1, padding: '20px' }}>
          <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="ここにメッセージを入力..."
              disabled={isComposeSending}
              style={{ width: '100%', height: '350px', border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem', lineHeight: 1.6, resize: 'none', fontFamily: 'inherit' }}
          />
          </div>

          {/* 4. モーダルフッター（アクションボタン） */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-th)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
                type="button"
                onClick={handleCloseCompose}
                disabled={isComposeSending}
                style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              キャンセル
            </button>
            <button
                type="button"
                className="send-btn"
                onClick={handleComposeSend}
                disabled={isComposeSending || !composeTo.trim() || !composeBody.trim()}
                style={{ padding: '10px 24px', borderRadius: '6px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Send size={16} /> 送信
            </button>
          </div>
        </div>
      </div>
  );
}