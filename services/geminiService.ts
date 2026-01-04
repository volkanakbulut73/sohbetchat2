import { GoogleGenAI, Type } from "@google/genai";
import { Message, User, BotResponseItem } from "../types";

export const generateGroupResponse = async (
  messages: Message[],
  participants: User[],
  topic: string,
  userName: string
): Promise<BotResponseItem[]> => {
  // API Key kontrolü ve başlatma işlemini fonksiyon içine taşıdık
  // Böylece uygulama açılışında key yoksa bile uygulama çökmez.
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key process.env.API_KEY içinde bulunamadı. Botlar cevap veremeyecek.");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });

  // Filter out the bots from participants to map IDs later
  const bots = participants.filter((p) => p.isBot);
  
  if (bots.length === 0) return [];

  // Create a context string describing the bots
  const botDescriptions = bots
    .map((b) => `- ${b.name} (ID: ${b.id}): ${b.role}`)
    .join("\n");

  // Format recent history for context (last 15 messages for better context)
  const recentMessages = messages.slice(-15);
  const historyText = recentMessages
    .map((m) => {
        const attachInfo = m.image ? " [RESİM GÖNDERDİ]" : "";
        return `${m.senderName}: ${m.text}${attachInfo}`;
    })
    .join("\n");

  const systemInstruction = `
    Sen sanal bir Türkçe grup sohbeti motorusun.
    Bu sohbet odasının konusu: "${topic}".
    
    Şu anki aktif bot karakterleri:
    ${botDescriptions}
    
    Son mesajı yazan kullanıcı: ${userName}
    
    GÖREV:
    Sohbet geçmişini incele ve bu botlardan birinin veya birkaçının sohbete dahil olup olmaması gerektiğine karar ver.
    
    KURALLAR:
    1. Sadece gerekliyse cevap ver. Her mesaja cevap vermek zorunda değilsin.
    2. Eğer cevap vereceksen, botun karakterine (${botDescriptions}) tam uygun bir ton kullan.
    3. Cevaplar kısa, öz ve sohbet dilinde (samimi, Türkçe) olsun.
    4. Kullanıcı bir resim gönderdiyse, resim hakkında yorum yap.
    5. Botlar kendi aralarında da konuşabilir veya atışabilir.
    
    ÇIKTI FORMATI:
    Cevabı saf JSON formatında döndür. Markdown bloğu kullanma.
    Örnek:
    [
      { "botId": "bot_id", "message": "Merhaba!" }
    ]
  `;

  try {
    const lastMessage = messages[messages.length - 1];
    let contents: any = { parts: [] };
    
    // Add text part (includes history as context)
    contents.parts.push({
        text: `Sohbet Geçmişi:\n${historyText}\n\nLütfen uygun bot cevaplarını (JSON array) üret.`
    });

    // Check if the last message has an image
    if (lastMessage && lastMessage.image) {
        try {
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64Data = lastMessage.image.split(',')[1];
            if (base64Data) {
                contents.parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg', 
                        data: base64Data
                    }
                });
            }
        } catch (e) {
            console.error("Image parsing failed", e);
        }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              botId: { type: Type.STRING, description: "Cevabı veren botun ID'si" },
              message: { type: Type.STRING, description: "Botun söylediği mesaj" },
            },
            required: ["botId", "message"],
          },
        },
      },
    });

    if (response.text) {
        // Clean up markdown if model adds it despite instructions
        const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText) as BotResponseItem[];
        return parsed.filter(item => bots.some(b => b.id === item.botId));
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};