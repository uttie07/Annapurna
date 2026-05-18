import { useState } from 'react';

// 型定義のインポート（元の定義に合わせる）
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

export function useGemini() {
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isAnalyzingInsight, setIsAnalyzingInsight] = useState(false);
  const [insightData, setInsightData] = useState<InsightData | null>(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  const saveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('geminiApiKey', key);
  };

  const analyzeEmailWithGemini = async (email: Email, bodyContent: string) => {
    if (!geminiApiKey) {
      setInsightData({ aiScore: 0, summary: "APIキーが設定されていません。左下の歯車アイコンからGemini APIキーを登録してください。", actions: [] });
      return;
    }

    setIsAnalyzingInsight(true);
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = bodyContent;
      const plainText = (tempDiv.innerText || tempDiv.textContent || "").substring(0, 3000);

      const prompt = `以下のメールを解析し、JSON形式で結果を返してください。\nフォーマット:\n{\n  "aiScore": number (0-100で、対応の緊急度や重要度を示すスコア),\n  "summary": string (メールの要旨を3行程度の箇条書き、または短いテキストで),\n  "actions": string[] (受信者が次にとるべき具体的なアクションのリスト。無ければ空配列)\n}\n\n差出人: ${email.from}\n件名: ${email.subject}\n本文:\n${plainText}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `API Error: ${res.status}`);

      const text = data.candidates[0].content.parts[0].text;
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const parsed: InsightData = JSON.parse(cleanText);
        setInsightData(parsed);
      } catch (parseError) {
        console.error("JSON parse failed. Raw response from Gemini:", text);
        throw new Error("解析結果の読み取りに失敗しました。");
      }

    } catch (e: any) {
      console.error("Gemini API Error:", e);
      setInsightData({ aiScore: 0, summary: `エラーが発生しました: ${e.message}`, actions: [] });
    } finally {
      setIsAnalyzingInsight(false);
    }
  };

  const generateAiReply = async (readingEmail: Email | null, intent: string) => {
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
    } catch (e: any) {
      console.error("AI Reply Generation Error:", e);
      alert(`AIによる返信文の生成に失敗しました。\n詳細: ${e.message}`);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // App.tsx側で使いたい状態と関数をすべてオブジェクトにして返却する
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