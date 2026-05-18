import {
  ArrowLeft, RefreshCw, Sparkles, Zap, MessageSquare,
  CornerUpLeft, Reply, ReplyAll, Send, Paperclip, Download
} from 'lucide-react';

/**
 * メールデータのオブジェクト構造定義
 */
type Email = {
  id: string;
  subject: string;
  from: string;
  to?: string;
  email_address: string;
  date: string;
  snippet: string;
  body: string;
  aiCategories: string[];
  account: string;
  isRead: boolean;
  isFlagged: boolean;
  isAnswered: boolean;
  isDraft: boolean;
  isDeleted: boolean;
  attachmentsList?: string[];
};

/**
 * Gemini API から返却されるインサイトデータの構造定義
 */
type InsightData = {
  aiScore: number;
  summary: string;
  actions: string[];
};

/**
 * EmailDetail コンポーネントの Props 型定義
 */
interface EmailDetailProps {
  /** 現在閲覧中のメールオブジェクト */
  readingEmail: Email;

  /** サーバー検索が実行中かどうかのフラグ */
  isSearchingServer: boolean;

  /** Geminiによる解析結果データ（未解析時は null） */
  insightData: InsightData | null;

  /** Geminiによる解析が実行中かどうかのフラグ */
  isAnalyzingInsight: boolean;

  /** メール本文のロード（非同期取得）中かどうかのフラグ */
  isReadingContent: boolean;

  /** 返信フォーム（インライン）が開いているかどうかのフラグ */
  showReplyForm: boolean;

  /** 返信の種別 ('reply': 差出人に返信, 'replyAll': 全員に返信) */
  replyType: 'reply' | 'replyAll';

  /** 返信フォーム内の CC/BCC 入力欄を表示するかどうかのトグルフラグ */
  showReplyCcBcc: boolean;

  /** 返信フォームに入力された CC アドレス */
  replyCc: string;

  /** 返信フォームに入力された BCC アドレス */
  replyBcc: string;

  /** 返信フォームに入力中の本文テキスト（AI生成文もここに挿入される） */
  replyText: string;

  /** メールの送信（Rustバックエンド経由）処理中かどうかのフラグ */
  isSending: boolean;

  /** Geminiによる返信自動生成（草案作成）中かどうかのフラグ */
  isGeneratingReply: boolean;

  /** 閲覧中のメールオブジェクトを更新（または閉じるために null に）するセッター関数 */
  setReadingEmail: (email: Email | null) => void;

  /**
   * 特定のメールに対して Gemini API を呼び出し、解析を実行する関数
   * @param email 対象のメールオブジェクト
   * @param bodyContent 解析対象となる平文またはHTML本文
   */
  analyzeEmailWithGemini: (email: Email, bodyContent: string) => Promise<void>;

  /**
   * 送信元のメールアドレスをベースに、過去のメール履歴をサーバー検索する関数
   * @param address 検索対象のメールアドレス
   */
  handleServerSearch: (address: string) => Promise<void>;

  /**
   * 添付ファイルをダウンロード（Rust側からバイト配列を取得）する関数
   * @param filename ダウンロード対象のファイル名
   */
  handleDownloadAttachment: (filename: string) => Promise<void>;

  /** 返信フォームの開閉状態を切り替えるセッター関数 */
  setShowReplyForm: (show: boolean) => void;

  /**
   * 返信タイプ（返信 / 全員に返信）を切り替え、自動的に引用文を構成する関数
   * @param type 'reply' または 'replyAll'
   */
  handleSetReplyType: (type: 'reply' | 'replyAll') => void;

  /** CC/BCC入力欄の表示トグルを更新するセッター関数 */
  setShowReplyCcBcc: (show: boolean) => void;

  /** CCアドレスを更新するセッター関数 */
  setReplyCc: (cc: string) => void;

  /** BCCアドレスを更新するセッター関数 */
  setReplyBcc: (bcc: string) => void;

  /**
   * 指定された意図（「承諾」「辞退」など）をもとに、Geminiで返信草案を自動生成する関数
   * @param intent 生成の方向性を示す文字列
   */
  generateAiReply: (intent: string) => Promise<void>;

  /** 返信本文を更新するセッター関数 */
  setReplyText: (text: string) => void;

  /** 構成された返信メールを送信するハンドラー関数 */
  handleSendReply: () => Promise<void>;
}

/**
 * アプリケーションの右側メインエリアに描画される、メール詳細表示およびAIアシスタントコンポーネント。
 * 本文表示、添付ファイル操作、Geminiインサイト、およびAIアシスト付き返信フォームを一元管理します。
 * @component
 */
export function EmailDetail({
                              readingEmail,
                              isSearchingServer,
                              insightData,
                              isAnalyzingInsight,
                              isReadingContent,
                              showReplyForm,
                              replyType,
                              showReplyCcBcc,
                              replyCc,
                              replyBcc,
                              replyText,
                              isSending,
                              isGeneratingReply,
                              setReadingEmail,
                              analyzeEmailWithGemini,
                              handleServerSearch,
                              handleDownloadAttachment,
                              setShowReplyForm,
                              handleSetReplyType,
                              setShowReplyCcBcc,
                              setReplyCc,
                              setReplyBcc,
                              generateAiReply,
                              setReplyText,
                              handleSendReply,
                            }: EmailDetailProps) {
  return (
      <div className="email-detail-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>

        {/* 1. 上部コントロールツールバー */}
        <div className="detail-header-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-th)' }}>
          <button
              className="icon-button"
              onClick={() => setReadingEmail(null)}
              title="一覧に戻る"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.9rem' }}
          >
            <ArrowLeft size={18} /> 一覧へ戻る
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* 🔍 過去の送信履歴を一発検索するボタン */}
            <button
                onClick={() => handleServerSearch(readingEmail.email_address)}
                disabled={isSearchingServer}
                className="filter-btn"
                style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {isSearchingServer ? <RefreshCw size={14} className="spin" /> : '🔍'} この差出人を検索
            </button>

            {/* ✨ Gemini解析トリガーボタン */}
            <button
                onClick={() => analyzeEmailWithGemini(readingEmail, readingEmail.body)}
                disabled={isAnalyzingInsight}
                className="ai-analyze-btn"
                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#8b5cf6', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
            >
              <Sparkles size={14} /> AIで解析
            </button>
          </div>
        </div>

        {/* 2. メール基本情報（メタデータ）領域 */}
        <div className="detail-meta-area" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.3, color: 'var(--text-main)' }}>{readingEmail.subject}</h2>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.9rem', marginTop: '4px' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{readingEmail.from}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>&lt;{readingEmail.email_address}&gt;</div>
              {readingEmail.to && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>To: {readingEmail.to}</div>}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{readingEmail.date}</div>
          </div>
        </div>

        {/* 3. メインコンテンツ（AIインサイト ＆ メール本文） */}
        <div className="detail-main-content-scroll" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>

          {/* 🤖 Gemini AI インサイトパネル */}
          {(isAnalyzingInsight || insightData) && (
              <div className="insight-card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e9d5ff', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f3e8ff', paddingBottom: '8px' }}>
                  <Sparkles size={18} color="#8b5cf6" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Gemini AI 解析レポート</span>
                </div>

                {isAnalyzingInsight ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', color: '#8b5cf6', fontSize: '0.9rem' }}>
                      <RefreshCw size={18} className="spin" />
                      <span>メールの意図と言外の文脈を解析中...</span>
                    </div>
                ) : insightData ? (
                    <>
                      {/* 緊急度・重要度スコア */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: insightData.aiScore > 70 ? '#ef4444' : '#2563eb', fontWeight: 700, fontSize: '0.85rem' }}>
                        <Zap size={14} fill="currentColor" />
                        <span>重要度判定: {insightData.aiScore}点 / 100</span>
                      </div>
                      {/* 要約テキスト */}
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{insightData.summary}</p>
                      {/* 次の予測アクションバッジ */}
                      {insightData.actions && insightData.actions.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>推奨される対応アクション:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {insightData.actions.map((act, i) => (
                                  <span key={i} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '4px', backgroundColor: '#f3e8ff', color: '#6b21a8', fontWeight: 500 }}>{act}</span>
                              ))}
                            </div>
                          </div>
                      )}
                    </>
                ) : null}
              </div>
          )}

          {/* ✉️ メール本文レンダリング領域 */}
          <div className="email-body-wrapper" style={{ position: 'relative', minHeight: '150px' }}>
            {isReadingContent ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)', gap: '12px' }}>
                  <RefreshCw size={28} className="spin" />
                  <span style={{ fontSize: '0.85rem' }}>安全なサンドボックスに本文をロード中...</span>
                </div>
            ) : (
                /* HTMLマークアップを安全にインジェクション。CSSはApp.css側のスタイルシートを適用 */
                <div
                    className="email-html-body"
                    dangerouslySetInnerHTML={{ __html: readingEmail.body }}
                    style={{ color: 'var(--text-main)', lineHeight: 1.6 }}
                />
            )}
          </div>

          {/* 📎 添付ファイルセクション */}
          {readingEmail.attachmentsList && readingEmail.attachmentsList.length > 0 && (
              <div className="attachments-section" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>
                  <Paperclip size={14} /> 添付ファイル ({readingEmail.attachmentsList.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {readingEmail.attachmentsList.map((filename, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', maxWidth: '400px' }}>
                        <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{filename}</span>
                        <button
                            onClick={() => handleDownloadAttachment(filename)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '4px', display: 'flex', alignItems: 'center' }}
                            title="ダウンロード"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                  ))}
                </div>
              </div>
          )}
        </div>

        {/* 4. インライン返信フォームエリア */}
        <div className="detail-reply-footer-zone" style={{ padding: '24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-th)' }}>
          {!showReplyForm ? (
              /* 初期の「返信」開始トリガーボタン */
              <button
                  className="send-btn"
                  style={{ width: '120px', gap: '6px' }}
                  onClick={() => handleSetReplyType('reply')}
              >
                <CornerUpLeft size={16} /> 返信する
              </button>
          ) : (
              /* アクティブな返信エディタ領域 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>

                {/* 返信ヘッダー（宛先タイプと各種トグル制御） */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => handleSetReplyType('reply')} style={{ padding: '6px 12px', borderRadius: '4px 0 0 4px', border: '1px solid var(--border-color)', borderRight: 'none', backgroundColor: replyType === 'reply' ? 'var(--bg-selected)' : 'transparent', fontWeight: replyType === 'reply' ? 700 : 'normal', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                      <Reply size={12} style={{ marginRight: '4px' }} /> 返信
                    </button>
                    <button onClick={() => handleSetReplyType('replyAll')} style={{ padding: '6px 12px', borderRadius: '0 4px 4px 0', border: '1px solid var(--border-color)', backgroundColor: replyType === 'replyAll' ? 'var(--bg-selected)' : 'transparent', fontWeight: replyType === 'replyAll' ? 700 : 'normal', fontSize: '0.8 scholarly', cursor: 'pointer', color: 'var(--text-main)' }}>
                      <ReplyAll size={12} style={{ marginRight: '4px' }} /> 全員に返信
                    </button>
                  </div>

                  <button onClick={() => setShowReplyCcBcc(!showReplyCcBcc)} style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer' }}>
                    {showReplyCcBcc ? 'CC/BCCを隠す' : 'CC/BCCを追加'}
                  </button>
                </div>

                {/* CC / BCC 入力サブフォーム */}
                {showReplyCcBcc && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.15s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', width: '36px', color: 'var(--text-muted)', fontWeight: 'bold' }}>CC:</span>
                        <input type="text" value={replyCc} onChange={e => setReplyCc(e.target.value)} style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', width: '36px', color: 'var(--text-muted)', fontWeight: 'bold' }}>BCC:</span>
                        <input type="text" value={replyBcc} onChange={e => setReplyBcc(e.target.value)} style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                      </div>
                    </div>
                )}

                {/* ✨ 🌟 AIスマート返信草案作成ツールバー */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-th)', padding: '8px 12px', borderRadius: '6px', border: '1px dashed #c084fc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed' }}>
                    <MessageSquare size={14} /> AIワンクリック草案:
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {['承諾する（丁寧）', '辞退する（お詫び）', '日程を調整したい', '詳細を質問したい'].map((intent) => (
                        <button
                            key={intent}
                            disabled={isGeneratingReply}
                            onClick={() => generateAiReply(intent)}
                            style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #d8b4fe', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3e8ff'; e.currentTarget.style.borderColor = '#a855f7'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-main)'; e.currentTarget.style.borderColor = '#d8b4fe'; }}
                        >
                          {intent}
                        </button>
                    ))}
                  </div>
                  {isGeneratingReply && <RefreshCw size={14} className="spin" style={{ color: '#7c3aed', marginLeft: 'auto' }} />}
                </div>

                {/* メインの返信テキストエリア */}
                <div style={{ position: 'relative' }}>
              <textarea
                  rows={8}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="ここに返信メッセージを入力、または上のAIボタンで文面を自動生成してください..."
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical', fontFamily: 'sans-serif' }}
              />
                </div>

                {/* フォームフッター（キャンセル ＆ 送信） */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                  <button
                      type="button"
                      onClick={() => {
                        setShowReplyForm(false);
                        setReplyText('');
                      }}
                      disabled={isSending}
                      style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    キャンセル
                  </button>
                  <button
                      type="button"
                      className="send-btn"
                      onClick={handleSendReply}
                      disabled={isSending || !replyText.trim()}
                      style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '0.85rem', gap: '6px' }}
                  >
                    {isSending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                    送信
                  </button>
                </div>

              </div>
          )}
        </div>

      </div>
  );
}