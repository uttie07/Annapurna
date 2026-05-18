import { useState } from 'react';

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
interface InsightData {
  /** 0-100で、対応の緊急度や重要度を示すスコア */
  aiScore: number;

  /** メールの内容を簡潔にまとめた平文の要約テキスト */
  summary: string;

  /** 受信者が次にとるべき具体的なアクションのリスト */
  actions: string[];
}

/**
 * useGemini カスタムフックの戻り値（外部へ公開するインターフェース）型定義
 */
interface UseGeminiReturn {
  /** 現在登録されている Gemini API キー */
  geminiApiKey: string;

  /** API キーを設定するセッター関数 */
  setGeminiApiKey: (key: string) => void;

  /** 設定モーダルの表示・非表示フラグ */
  showSettings: boolean;

  /** 設定モーダルの表示状態を切り替えるセッター関数 */
  setShowSettings: (show: boolean) => void;

  /** インサイト解析が現在実行中かどうかのフラグ */
  isAnalyzingInsight: boolean;

  /** インサイト解析の実行状態を切り替えるセッター関数 */
  setIsAnalyzingInsight: (loading: boolean) => void;

  /** Geminiによるメール解析結果データ（未解析時は null） */
  insightData: InsightData | null;

  /** インサイトデータを更新またはリセットするためのセッター関数 */
  setInsightData: (data: InsightData | null) => void;

  /** AI返信草案作成が現在実行中かどうかのフラグ */
  isGeneratingReply: boolean;

  /** 返信フォームに流し込むための本文テキスト (State) */
  replyText: string;

  /** 返信本文テキストを更新するセッター関数 */
  setReplyText: (text: string | ((prev: string) => string)) => void;

  /**
   * API キーをコンポーネントの状態にセットし、同時に `localStorage` へ永続化する関数
   * @param key 登録する Gemini API キー文字列
   */
  saveApiKey: (key: string) => void;

  /**
   * 対象のメール本文からHTMLタグを排出し、Gemini API を用いて重要度、要約、推奨アクションを抽出する関数
   * @param email 解析対象のメールオブジェクト
   * @param bodyContent 解析対象となるHTMLまたはプレーンテキスト本文
   */
  analyzeEmailWithGemini: (email: Email, bodyContent: string) => Promise<void>;

  /**
   * メールコンテキストとユーザーの意図をプロンプトに組み込み、Gemini にビジネス返信文の草案（本文のみ）を作らせる関数
   * @param readingEmail 返信元となる、現在閲覧中のメールオブジェクト
   * @param intent 生成の方向性を示す文字列 (例: '承諾する（丁寧）')
   */
  generateAiReply: (readingEmail: Email | null, intent: string) => Promise<void>;
}

/**
 * Google Gemini API（gemini-2.5-flash）をフロントエンドから直接呼び出し、
 * メールのスマート解析（要約・スコア）および返信文自動生成を行うカスタムフック。
 * API キーの永続化管理や関連する UI 状態（設定画面トグル、返信テキスト）も保持します。
 * @returns UIコンポーネントおよび App.tsx で利用するすべての State とハンドラー
 */
export function useGemini(): UseGeminiReturn {
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('geminiApiKey') || '');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isAnalyzingInsight, setIsAnalyzingInsight] = useState<boolean>(false);
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');

  /**
   * API キーを State と localStorage の両方に保存する関数
   */
  const saveApiKey = (key: string): void => {
    setGeminiApiKey(key);
    localStorage.setItem('geminiApiKey', key);
  };

  /**
   * 対象のメール本文からHTMLタグを排出し、Gemini API を用いて重要度、要約、推奨アクションを抽出する関数
   */
  const analyzeEmailWithGemini = async (email: Email, bodyContent: string): Promise<void> => {
    if (!geminiApiKey) {
      setInsightData({
        aiScore: 0,
        summary: "APIキーが設定されていません。左下の歯車アイコンからGemini APIキーを登録してください。",
        actions: []
      });
      return;
    }

    setIsAnalyzingInsight(true);
    try {
      // 安全な平文テキスト抽出のための DOM パース処理
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = bodyContent;
      const plainText = (tempDiv.innerText || tempDiv.textContent || "").substring(0, 3000);

      // 厳格な構造化出力を求めるための構造指定システムプロンプトの構築
      const prompt = `以下のメールを解析し、JSON形式で結果を返してください。\nフォーマット:\n{\n  "aiScore": number (0-100で、対応の緊急度や重要度を示すスコア),\n  "summary": string (メールの要旨を3行程度の箇条書き、または短いテキストで),\n  "actions": string[] (受信者が次にとるべき具体的なアクションのリスト。無ければ空配列)\n}\n\n差出人: ${email.from}\n件名: ${email.subject}\n本文:\n${plainText}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" } // JSON Mode の有効化
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `API Error: ${res.status}`);

      const text = data.candidates[0].content.parts[0].text;
      // マークダウンのコードブロックシンタックス（```json ... ```）を正規表現でクリーニング
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed: InsightData = JSON.parse(cleanText);
        setInsightData(parsed);
      } catch (parseError) {
        console.error("JSON parse failed. Raw response from Gemini:", text);
        throw new Error("解析結果の読み取りに失敗しました。");
      }

    } catch (error) {
      console.error("Gemini API Error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setInsightData({ aiScore: 0, summary: `エラーが発生しました: ${errorMessage}`, actions: [] });
    } finally {
      setIsAnalyzingInsight(false);
    }
  };

  /**
   * メールコンテキストとユーザーの意図をプロンプトに組み込み、Gemini にビジネス返信文の草案（本文のみ）を作らせる関数
   */
  const generateAiReply = async (readingEmail: Email | null, intent: string): Promise<void> => {
    if (!geminiApiKey) {
      alert("AI機能を使用するには、左下の設定からGemini APIキーを登録してください。");
      setShowSettings(true);
      return;
    }
    if (!readingEmail) return;

    setIsGeneratingReply(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = readingEmail.body;
      const plainText = (tempDiv.innerText || tempDiv.textContent || "").substring(0, 3000);

      const prompt = `以下の受信メールに対して、「${intent}」という意図で返信文（ビジネスメール）の草案を作成してください。\n出力は件名や宛名・署名のプレースホルダーを含めず、**「本文のみのプレーンテキスト」**で出力してください。\n\n差出人: ${readingEmail.from}\n件名: ${readingEmail.subject}\n本文:\n${plainText}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `API Error: ${res.status}`);

      const generatedText = data.candidates[0].content.parts[0].text;
      setReplyText(prev => generatedText.trim() + "\n\n" + prev);
    } catch (error) {
      console.error("AI Reply Generation Error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`AIによる返信文の生成に失敗しました。\n詳細: ${errorMessage}`);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  return {
    geminiApiKey,
    setGeminiApiKey,
    showSettings,
    setShowSettings,
    isAnalyzingInsight,
    setIsAnalyzingInsight,
    insightData,
    setInsightData,
    isGeneratingReply,
    replyText,
    setReplyText,
    saveApiKey,
    analyzeEmailWithGemini,
    generateAiReply,
  };
}