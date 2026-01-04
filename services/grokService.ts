
import { GoogleGenAI } from "@google/genai";
import { Message } from '../types.ts';

export const generateSocratesResponse = async (
  messages: Message[],
  userName: string
): Promise<string> => {
  // BAŞLATMA İŞLEMİ BURAYA TAŞINDI
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Google GenAI API Key bulunamadı. Sokrates cevap veremeyecek.");
    return "Zihnim şu an biraz bulanık...";
  }

  const ai = new GoogleGenAI({ apiKey });

  const recentMessages = messages.slice(-10);
  const historyText = recentMessages.map(m => `${m.senderName}: ${m.text}`).join('\n');

  const prompt = `
    Sen Antik Yunan filozofu Sokrates'sin.
    Görevin: Kullanıcılarla Sokratik yöntem (Elenchus) kullanarak sohbet etmek.
    
    Kurallar:
    1. Asla doğrudan cevap verme. Her zaman sorulan soruya başka bir soruyla veya düşündürücü bir yorumla karşılık ver.
    2. Amacın karşı tarafın kendi çelişkilerini bulmasını sağlamak.
    3. Dilin biraz arkaik ama anlaşılır, nazik ama iğneleyici olabilir.
    4. Kısa paragraflar kullan.
    
    Konuşma Geçmişi:
    ${historyText}
    
    Sokrates olarak cevabın:
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Daha iyi akıl yürütme için Pro model
      contents: prompt,
    });

    return response.text || "Düşünüyorum...";
  } catch (error) {
    console.error("Socrates AI Error:", error);
    return "Zihnim biraz bulanık, ne demiştik?";
  }
};
