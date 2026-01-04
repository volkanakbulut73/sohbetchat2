
import { GoogleGenAI, Type } from "@google/genai";
import { Message, User, BotResponseItem } from '../types.ts';

export const generateGroupResponse = async (
  messages: Message[],
  participants: User[],
  topic: string,
  user_name: string
): Promise<BotResponseItem[]> => {
  // BAŞLATMA İŞLEMİ BURAYA TAŞINDI
  // Eğer process.env.API_KEY yoksa uygulama çökmez, sadece bu fonksiyon erken döner.
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Google GenAI API Key bulunamadı. Botlar cevap veremeyecek.");
    return [];
  }
  
  const ai = new GoogleGenAI({ apiKey });

  // Sadece botları filtrele
  const bots = participants.filter(p => p.isBot);
  
  if (bots.length === 0) return [];

  // Son 10 mesajı al
  const recentMessages = messages.slice(-10);
  const historyText = recentMessages.map(m => `${m.senderName}: ${m.text}`).join('\n');
  
  const botList = bots.map(b => `- ${b.name} (ID: ${b.id}, Rol: ${b.role})`).join('\n');

  const prompt = `
    Sen bir grup sohbeti yöneticisisin. Aşağıdaki senaryoya göre hangi botların cevap vereceğine karar ver.
    
    Konu: ${topic}
    
    Mevcut Botlar:
    ${botList}
    
    Konuşma Geçmişi:
    ${historyText}
    
    Kurallar:
    1. Her mesaja herkes cevap vermemeli. Sadece karakterine uygunsa ve söz sırası geldiyse cevap ver.
    2. Cevaplar kısa, doğal ve karakterin rolüne uygun olmalı.
    3. Eğer kimsenin cevap vermesi gerekmiyorsa boş bir liste döndür.
    4. "Sokrates" (bot_socrates) seçilirse, mesaj kısmına sadece "..." koy, içeriği başka bir servis üretecek.
    
    JSON formatında çıktı ver:
    [ { "botId": "bot_id", "message": "cevap metni" } ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              botId: { type: Type.STRING },
              message: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as BotResponseItem[];
  } catch (error) {
    console.error("Gemini Group AI Error:", error);
    return [];
  }
};
