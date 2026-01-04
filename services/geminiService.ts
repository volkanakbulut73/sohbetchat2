
import { Type } from "@google/genai";
import { Message, User, BotResponseItem } from "../types";
import { sendAiRequest } from "./pocketbase";

export const generateGroupResponse = async (
  messages: Message[],
  participants: User[],
  topic: string,
  userName: string
): Promise<BotResponseItem[]> => {
  
  const bots = participants.filter((p) => p.isBot);
  if (bots.length === 0) return [];

  const botDescriptions = bots
    .map((b) => `- ${b.name} (ID: ${b.id}): ${b.role}`)
    .join("\n");

  const recentMessages = messages.slice(-15);
  const historyText = recentMessages
    .map((m) => {
      const cleanText = m.text.replace(/<[^>]*>?/gm, '');
      return `${m.senderName}: ${cleanText}${m.image ? " [RESİM]" : ""}`;
    })
    .join("\n");

  const systemInstruction = `
    Sen "WORKIGOM CHAT" platformunda bir grup sohbeti yöneticisisin.
    Oda Konusu: "${topic}"
    
    Aktif Karakterler (Botlar):
    ${botDescriptions}
    
    ÖNEMLİ KURALLAR:
    1. Botlar CANLI, etkileşimli ve kişiliklerine uygun konuşmalıdır.
    2. Sokrates (bot_socrates) antik bir filozoftur, her şeyi sorgular.
    3. Cevaplar KESİNLİKE saf metin olmalı, HTML etiketi içermemelidir.
    4. Kullanıcıya "${userName}" ismiyle hitap edebilirsin.
    5. En fazla 2 botun cevabını üret.
    
    ÇIKTI FORMATI:
    Sadece JSON dizisi döndür.
  `;

  try {
    const lastMessage = messages[messages.length - 1];
    let parts: any[] = [{ text: `Sohbet Geçmişi:\n${historyText}\n\nLütfen uygun botların cevaplarını JSON olarak üret.` }];

    if (lastMessage && lastMessage.image) {
        const base64Data = lastMessage.image.split(',')[1];
        if (base64Data) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg', 
                    data: base64Data
                }
            });
        }
    }

    // Backend'e proxy isteği gönderiyoruz.
    // Provider: 'gemini'
    const response = await sendAiRequest({
        provider: 'gemini',
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.8,
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                    botId: { type: Type.STRING },
                    message: { type: Type.STRING },
                    },
                    required: ["botId", "message"],
                },
            },
        }
    });

    // Backend'den gelen yanıtı parse et
    // Backend doğrudan Gemini API yanıtını dönüyorsa, text 'candidates' içindedir.
    // Ancak backend metni ayıklayıp { text: "..." } şeklinde de dönebilir.
    // Burada güvenli bir erişim yapıyoruz.
    
    let resultText = "";
    if (response && response.text) {
        resultText = response.text;
    } else if (response && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        resultText = response.candidates[0].content.parts[0].text;
    } else if (typeof response === 'string') {
        resultText = response;
    }

    if (resultText) {
        try {
            const cleanJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson) as BotResponseItem[];
            return parsed.filter(item => bots.some(b => b.id === item.botId));
        } catch (e) {
            console.error("JSON Parse Hatası:", e, resultText);
            return [];
        }
    }
    return [];
  } catch (error) {
    console.error("Gemini AI Hatası (Backend Proxy):", error);
    return [];
  }
};
