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

  const botNames = bots.map(b => b.name).join(", ");

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
    
    ÖNEMLİ KURAL - SESSİZLİK MODU:
    Botlar varsayılan olarak "PASİF GÖZLEMCİ" modundadır.
    Botlar SADECE ve SADECE şu durumlarda cevap vermelidir:
    1. Kullanıcının mesajında botun ismi (${botNames}) geçiyorsa (büyük/küçük harf duyarlılığı olmadan).
    2. Kullanıcı genel bir soru sorduysa VE konu botun uzmanlık alanına (role) ÇOK SPESİFİK olarak giriyorsa (örneğin sadece "Gölge"nin cevap verebileceği bir eleştiri sorusu gibi).
    
    Eğer yukarıdaki şartlar sağlanmıyorsa, boş bir dizi ([]) döndür. Asla gereksiz yere sohbete atlama ("Merhaba", "Nasılsın" gibi genel mesajlara cevap verme).
    
    Cevap Kuralları:
    1. Cevaplar kısa, samimi ve sohbet balonu formatına uygun olsun.
    2. Botun karakterine uygun konuş.
    
    ÇIKTI FORMATI:
    Sadece JSON döndür. Markdown yok.
    Örnek:
    [
      { "botId": "bot_atlas", "message": "Buyur, beni mi çağırdın?" }
    ]
  `;

  try {
    const lastMessage = messages[messages.length - 1];
    let contents: any = { parts: [] };
    
    // Add text part (includes history as context)
    contents.parts.push({
        text: `Sohbet Geçmişi:\n${historyText}\n\nAnaliz et: Son mesajda ismi geçen bot var mı? Varsa JSON döndür, yoksa boş array döndür.`
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