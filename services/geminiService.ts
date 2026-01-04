import { GoogleGenAI, Type } from "@google/genai";
import { Message, User, BotResponseItem } from "../types";

export const generateGroupResponse = async (
  messages: Message[],
  participants: User[],
  topic: string,
  userName: string
): Promise<BotResponseItem[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key (process.env.API_KEY) bulunamadı. Lütfen kontrol edin.");
    return [];
  }

  // Her çağrıda yeni bir instance oluşturulması önerilir
  const ai = new GoogleGenAI({ apiKey });

  const bots = participants.filter((p) => p.isBot);
  if (bots.length === 0) return [];

  const botDescriptions = bots
    .map((b) => `- ${b.name} (ID: ${b.id}): ${b.role}`)
    .join("\n");

  const recentMessages = messages.slice(-15);
  const historyText = recentMessages
    .map((m) => `${m.senderName}: ${m.text}${m.image ? " [RESİM]" : ""}`)
    .join("\n");

  const systemInstruction = `
    Sen "WORKIGOM CHAT" platformunda bir grup sohbeti yöneticisisin.
    Oda Konusu: "${topic}"
    
    Aktif Karakterler (Botlar):
    ${botDescriptions}
    
    KURALLAR:
    1. Botlar CANLI ve ETKİLEŞİMLİ olmalıdır. 
    2. Kullanıcı "Selam", "Merhaba" gibi giriş mesajları yazarsa, botlar (özellikle Atlas veya Cem) samimi bir şekilde karşılık vermelidir.
    3. Eğer kullanıcı bir botun ismini doğrudan söylerse, o bot kesinlikle cevap vermelidir.
    4. Eğer genel bir soru sorulursa veya konu bir botun uzmanlığına giriyorsa, bot sohbete katılmalıdır.
    5. Cevaplar kısa (max 2-3 cümle), Türkçe ve karakterin kişiliğine uygun olmalıdır.
    6. Aynı anda en fazla 2 bot cevap verebilir (kaos olmaması için).
    
    ÇIKTI FORMATI:
    Yalnızca saf JSON dizisi döndür. Başka metin ekleme.
    Örnek:
    [
      { "botId": "bot_atlas", "message": "Merhaba ${userName}, hoş geldin! Konumuz olan ${topic} hakkında ne düşünüyorsun?" }
    ]
  `;

  try {
    const lastMessage = messages[messages.length - 1];
    let contents: any = { parts: [{ text: `Sohbet Geçmişi:\n${historyText}\n\nAnaliz et ve uygun botların (varsa) cevaplarını JSON olarak üret.` }] };

    if (lastMessage && lastMessage.image) {
        const base64Data = lastMessage.image.split(',')[1];
        if (base64Data) {
            contents.parts.push({
                inlineData: {
                    mimeType: 'image/jpeg', 
                    data: base64Data
                }
            });
        }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.8, // Daha yaratıcı ve katılımcı cevaplar için
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
      },
    });

    if (response.text) {
        // Markdown bloklarını temizle
        const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson) as BotResponseItem[];
        return parsed.filter(item => bots.some(b => b.id === item.botId));
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error Detail:", error);
    return [];
  }
};