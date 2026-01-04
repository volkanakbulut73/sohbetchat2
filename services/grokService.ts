
import { Message } from "../types";
import { sendAiRequest } from "./pocketbase";

export const generateSocratesResponse = async (
  messages: Message[],
  userName: string
): Promise<string> => {
  // HTML etiketlerini temizle
  const cleanMessages = messages.slice(-10).map(m => ({
    role: m.isUser ? "user" : "assistant",
    name: m.senderName.replace(/\s+/g, '_'),
    content: m.text.replace(/<[^>]*>?/gm, '')
  }));

  const systemPrompt = {
    role: "system",
    content: `Sen Antik Yunan filozofu Sokrates'sin. 
    Üslubun: Alçakgönüllü ama sorgulayıcı. "Sokratik Yöntem" kullanırsın; yani doğrudan cevap vermek yerine, muhatabına sorular sorarak onun kendi doğrusunu bulmasını sağlarsın.
    Asla modern bir yapay zeka gibi konuşma. Atina sokaklarında bir sohbetteymişsin gibi davran.
    Kullanıcının ismi: ${userName}.
    Kısa ve öz konuş. Saf metin kullan, HTML etiketi kullanma.`
  };

  try {
    // Backend'e proxy isteği gönderiyoruz.
    // Provider: 'grok'
    const response = await sendAiRequest({
        provider: 'grok',
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...cleanMessages],
        temperature: 0.7,
        max_tokens: 500
    });

    // Backend'den dönen yanıtı işle
    // OpenAI formatı: choices[0].message.content
    const content = response.choices?.[0]?.message?.content || response.content;
    
    return content || "Bilmediğim tek şey, hiçbir şey bilmediğimdir...";
  } catch (error) {
    console.error("Grok AI Hatası (Backend Proxy):", error);
    return "Zihnim biraz bulanık, Atina'nın havasından olsa gerek...";
  }
};
