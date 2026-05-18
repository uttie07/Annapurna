import React from 'react';
import { ArrowLeft, RefreshCw, Sparkles, Star, Search, Paperclip, Download, Reply, ReplyAll, CornerUpLeft, X, Bot, Send } from 'lucide-react';

type Email = {
  id: string; subject: string; from: string; to?: string; email_address: string; date: string; snippet: string;
  body: string; aiCategories: string[]; account: string;
  isRead: boolean; isFlagged: boolean; isAnswered: boolean; isDraft: boolean; isDeleted: boolean;
  attachmentsList?: string[];
};

type InsightData = {
  aiScore: number;
  summary: string;
  actions: string[];
};

interface EmailDetailProps {
  readingEmail: Email;
  isSearchingServer: boolean;
  insightData: InsightData | null;
  isAnalyzingInsight: boolean;
  isReadingContent: boolean;
  showReplyForm: boolean;
  replyType: 'reply' | 'replyAll';
  showReplyCcBcc: boolean;
  replyCc: string;
  replyBcc: string;
  replyText: string;
  isSending: boolean;
  isGeneratingReply: boolean;
  setReadingEmail: (email: Email | null) => void;
  setInsightData: (data: InsightData | null) => void;
  analyzeEmailWithGemini: (email: Email, bodyContent: string) => void;
  handleServerSearch: (address: string, page: number) => void;
  handleDownloadAttachment: (filename: string) => void;
  setShowReplyForm: (show: boolean) => void;
  handleSetReplyType: (type: 'reply' | 'replyAll') => void;
  setShowReplyCcBcc: (show: boolean) => void;
  setReplyCc: (cc: string) => void;
  setReplyBcc: (bcc: string) => void;
  generateAiReply: (intent: string) => void;
  setReplyText: (text: string) => void;
  handleSendReply: () => void;
}

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
  setInsightData,
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
    <div className="email-detail-split" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="email-detail-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="detail-toolbar" style={{ flexShrink: 0 }}>
          <button className="icon-button" onClick={() => { setReadingEmail(null); setInsightData(null); }} disabled={isSearchingServer}>
            <ArrowLeft size={20} /> 戻る
          </button>
        </div>

        {isSearchingServer ? (
          <div className="server-loading-container">
            <div className="loading-content">
              <div className="loading-animation">
                <div className="pulse-circle"></div>
                <Search size={48} className="floating-search" />
              </div>
              <h3>サーバー内を探索中...</h3>
              <p className="loading-subtext">過去のメールから "{readingEmail.email_address}" を掘り起こしています</p>
              <div className="skeleton-lines">
                <div className="skeleton-line shadow"></div>
                <div className="skeleton-line shadow"></div>
                <div className="skeleton-line shadow"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="detail-body-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
              <div className="detail-header" style={{ flexShrink: 0 }}>
                <h2 className="detail-subject">
                  {readingEmail.isFlagged && <Star size={20} fill="#eab308" color="#eab308" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />}
                  {readingEmail.subject}

                  {!insightData && (
                    <button
                      className="ai-insight-trigger"
                      onClick={() => analyzeEmailWithGemini(readingEmail, readingEmail.body)}
                      title="AIで内容を解析"
                      style={{ marginLeft: '12px' }}
                      disabled={isAnalyzingInsight}
                    >
                      {isAnalyzingInsight ? <RefreshCw size={14} className="spin" color="#8b5cf6" /> : <Sparkles size={14} color="#8b5cf6" fill="#f5f3ff" />}
                    </button>
                  )}
                </h2>
                <div className="detail-meta">
                  <div className="sender-info">
                    <span className="sender-name">{readingEmail.from}</span>
                    <span className="sender-address">{`<${readingEmail.email_address}>`}</span>
                    <button
                      className={`inline-search-btn ${isSearchingServer ? 'loading' : ''}`}
                      onClick={() => handleServerSearch(readingEmail.email_address, 0)}
                      disabled={isSearchingServer}
                      title="サーバーからこのアドレスを検索"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                  <span>{readingEmail.date}</span>
                </div>
              </div>

              {isAnalyzingInsight && !insightData && readingEmail && (
                <div style={{ padding: '0 32px 16px 32px', flexShrink: 0 }}>
                  <div style={{ backgroundColor: 'var(--bg-app)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', color: '#8b5cf6' }}>
                    <RefreshCw size={18} className="spin" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Gemini がメールを解析中...</span>
                  </div>
                </div>
              )}

              {insightData && (
                <div style={{ padding: '0 32px 16px 32px', flexShrink: 0 }}>
                  <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: insightData.aiScore > 70 ? '#ef4444' : '#8b5cf6' }}>
                      <Sparkles size={16} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>AI インサイト (重要度スコア: {insightData.aiScore}点)</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{insightData.summary}</p>
                    {insightData.actions && insightData.actions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                        {insightData.actions.map((action, idx) => (
                          <span key={idx} style={{ backgroundColor: 'var(--bg-main)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#8b5cf6', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {readingEmail.attachmentsList && readingEmail.attachmentsList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 32px 16px 32px', flexShrink: 0 }}>
                  {readingEmail.attachmentsList.map((filename, idx) => (
                    <div
                      key={`${filename}-${idx}`}
                      onClick={() => handleDownloadAttachment(filename)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 14px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: 'var(--text-main)',
                        fontWeight: 500
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                      title="クリックしてダウンロード"
                    >
                      <Paperclip size={16} color="#3b82f6" />
                      {filename}
                      <Download size={14} style={{ marginLeft: '4px', opacity: 0.5 }} />
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 32px 16px 32px' }}>
                {isReadingContent ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#9ca3af' }}>
                    <RefreshCw size={24} className="spin" style={{ marginRight: '8px' }} /> 読み込み中...
                  </div>
                ) : (
                  <iframe
                    title="Email Content"
                    srcDoc={readingEmail.body}
                    style={{
                      width: '100%',
                      height: '100%',
                      flex: 1,
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff'
                    }}
                    sandbox="allow-same-origin allow-popups"
                  />
                )}
              </div>
            </div>

            {!showReplyForm ? (
              <div style={{ flexShrink: 0, padding: '16px 32px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => { setShowReplyForm(true); handleSetReplyType('reply'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', borderRadius: '24px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-header)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                >
                  <Reply size={18} /> 返信
                </button>
                <button
                  onClick={() => { setShowReplyForm(true); handleSetReplyType('replyAll'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', borderRadius: '24px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-header)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                >
                  <ReplyAll size={18} /> 全員に返信
                </button>
              </div>
            ) : (
              <div style={{ flexShrink: 0, padding: '12px 32px 16px 32px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-header)' }}>
                <div className="inline-reply-editor" style={{ margin: 0, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div className="reply-to-info" style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button
                        onClick={() => handleSetReplyType('reply')}
                        style={{ display: 'flex', alignItems: 'center', fontWeight: replyType === 'reply' ? 'bold' : 'normal', color: replyType === 'reply' ? 'var(--text-main)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <CornerUpLeft size={14} style={{ marginRight: '4px' }} /> 返信
                      </button>
                      <button
                        onClick={() => handleSetReplyType('replyAll')}
                        style={{ display: 'flex', alignItems: 'center', fontWeight: replyType === 'replyAll' ? 'bold' : 'normal', color: replyType === 'replyAll' ? 'var(--text-main)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title="元の宛先(To)全員を含める"
                      >
                        <ReplyAll size={14} style={{ marginRight: '4px' }} /> 全員に返信
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setShowReplyCcBcc(!showReplyCcBcc)}
                        style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {showReplyCcBcc ? 'Cc/Bccを隠す' : 'Cc/Bccを追加'}
                      </button>
                      <button
                        onClick={() => setShowReplyForm(false)}
                        title="キャンセル"
                        style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {showReplyCcBcc && (
                    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', padding: '6px 12px', gap: '6px', backgroundColor: 'var(--bg-header)' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '30px' }}>Cc:</span>
                        <input type="text" value={replyCc} onChange={e => setReplyCc(e.target.value)} disabled={isSending} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-main)' }} placeholder="追加の宛先..." />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '30px' }}>Bcc:</span>
                        <input type="text" value={replyBcc} onChange={e => setReplyBcc(e.target.value)} disabled={isSending} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-main)' }} placeholder="追加の宛先..." />
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '8px 12px', display: 'flex', gap: '8px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      <Bot size={14} style={{ marginRight: '4px' }} /> AIドラフト:
                    </span>
                    <button onClick={() => generateAiReply('承諾する、進めてほしい旨を伝える')} disabled={isGeneratingReply} className="badge badge-update" style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', whiteSpace: 'nowrap' }}>👍 承諾する</button>
                    <button onClick={() => generateAiReply('丁寧にお断りする')} disabled={isGeneratingReply} className="badge" style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)' }}>👎 丁寧に断る</button>
                    <button onClick={() => generateAiReply('確認したことと、感謝を伝える')} disabled={isGeneratingReply} className="badge" style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', backgroundColor: '#dcfce3', color: '#166534', whiteSpace: 'nowrap' }}>🙏 感謝・確認</button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    {isGeneratingReply && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-main)', opacity: 0.7, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                        <RefreshCw size={24} className="spin" color="#8b5cf6" />
                      </div>
                    )}
                    <textarea
                      className="reply-textarea"
                      placeholder="返信内容を入力..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={isSending || isGeneratingReply}
                      style={{ minHeight: '120px', border: 'none', backgroundColor: 'transparent' }}
                    />
                  </div>

                  <div className="reply-toolbar" style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-header)' }}>
                    <button className="send-btn" onClick={handleSendReply} disabled={isSending || !replyText.trim() || isGeneratingReply} style={{ height: '32px', fontSize: '0.85rem' }}>
                      {isSending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                      {isSending ? '送信中...' : '送信する'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}