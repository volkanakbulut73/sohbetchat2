import { GoogleGenAI, Type } from "@google/genai";
import { Message, User, BotResponseItem } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateGroupResponse = async (
  messages: Message[],
  participants: User[],
  topic: string,
  userName: string
): Promise<BotResponseItem[]> => {
  if (!apiKey) {
    console.error("API Key is missing");
    return [];
  }

  // Filter out the bots from participants to map IDs later
  const bots = participants.filter((p) => p.isBot);
  
  // Create a context string describing the bots
  const botDescriptions = bots
    .map((b) => `- ${b.name} (ID: ${b.id}): ${b.role}`)
    .join("\n");

  // Format recent history for context (last 10 messages)
  // We need to check if the LAST message has an image to send to the API.
  // Although Gemini supports images in history, for this demo we focus on the immediate turn's image.
  const recentMessages = messages.slice(-10);
  const historyText = recentMessages
    .map((m) => {
        const attachInfo = m.image ? " [RESİM GÖNDERDİ]" : "";
        return `${m.senderName}: ${m.text}${attachInfo}`;
    })
    .join("\n");

  const systemInstruction = `
    Sen sanal bir Türkçe grup sohbeti motorusun.
    Bu sohbet odasının konusu: "${topic}".
    
    Aşağıdaki bot karakterlerini yönetiyorsun:
    ${botDescriptions}
    
    Kullanıcı (${userName}) bir mesaj yazdı (veya bir resim gönderdi). 
    Sohbet geçmişine ve varsa gönderilen resme bakarak, hangi botun veya botların cevap vermesi gerektiğine karar ver.
    
    Kurallar:
    1. Konuşmanın doğal akışına göre 1 veya en fazla 2 bot cevap vermelidir.
    2. Her bot kendi kişiliğine (role) uygun konuşmalıdır.
    3. Cevaplar kısa, sohbet havasında ve Türkçe olmalıdır.
    4. Eğer soru spesifik bir bota sorulmadıysa, konuya en uygun bot cevap versin.
    5. Eğer kullanıcı bir resim gönderdiyse, botlar bu resmi görmüş gibi yorum yapmalıdır.
    
    Cevabı JSON formatında döndür.
  `;

  try {
    const lastMessage = messages[messages.length - 1];
    let contents: any = { parts: [] };
    
    // Add text part (includes history as context)
    contents.parts.push({
        text: `Sohbet Geçmişi:\n${historyText}\n\nLütfen uygun bot cevaplarını üret.`
    });

    // Check if the last message has an image
    if (lastMessage && lastMessage.image) {
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = lastMessage.image.split(',')[1];
        if (base64Data) {
            contents.parts.push({
                inlineData: {
                    mimeType: 'image/jpeg', // Assuming jpeg/png, standard base64 often works generic or we can parse it.
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
        const parsed = JSON.parse(response.text) as BotResponseItem[];
        // Filter out any hallucinations where botId doesn't match available bots
        return parsed.filter(item => bots.some(b => b.id === item.botId));
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};