// AI Chat Hook - Workigom
// Bu hook, veritabanına mesaj yazıldıktan sonra (after create) tetiklenir.

onRecordAfterCreate((e) => {
  const msg = e.record;

  // --- LOG: Başlangıç ---
  console.log(`🔥 [WORKIGOM_AI] Yeni Kayıt ID: ${msg.id}`);

  // 1. KONTROLLER
  // Sadece 'messages' koleksiyonu için çalışır (parametre olarak sonda belirtildi ama çift kontrol iyidir)
  if (msg.collection().name !== "messages") return;

  // Sadece gerçek kullanıcı mesajlarını işle
  if (!msg.getBool("isUser")) {
    return; // AI kendi mesajına cevap vermesin
  }

  // Mesaj metnini al (DB alanı 'text')
  const text = msg.getString("text");
  
  // Metin boşsa işlem yapma
  if (!text || text.trim() === "") {
    console.log(`⚠️ [WORKIGOM_AI] Metin boş, atlanıyor. ID: ${msg.id}`);
    return;
  }

  // Komutları filtrele
  if (text.startsWith("!")) {
    console.log(`ℹ️ [WORKIGOM_AI] Komut algılandı, atlanıyor: ${text}`);
    return;
  }

  // 2. VERİ HAZIRLIĞI
  const room = msg.getString("room");
  console.log(`📝 [WORKIGOM_AI] Oda: '${room}' | Mesaj: '${text}'`);

  // Sistem talimatını belirle
  let systemContext = "You are a helpful, witty, and concise AI assistant in a group chat.";
  if (room === "room_china") {
    systemContext = "You are an expert consultant on China trade, logistics, and Alibaba. Keep answers professional but concise.";
  } else if (room === "room_chaos") {
    systemContext = "You are a fun, slightly chaotic chatbot who loves emojis.";
  } else if (room === "room_life") {
    systemContext = "You are a philosopher. Discuss the meaning of life, existence, and psychology deeply but clearly.";
  }

  // API URL
  // Canlı ortam için domain: workigomchat.online
  const AI_API_URL = $os.getenv("AI_API_URL") || "https://workigomchat.online/api/ai/chat";

  console.log(`🌐 [WORKIGOM_AI] İstek gönderiliyor: ${AI_API_URL}`);

  try {
    const res = $http.send({
      url: AI_API_URL,
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: text } // ÖNEMLİ: 'text' değişkeni 'content' alanına atanıyor
        ]
      }),
      headers: { "Content-Type": "application/json" },
      timeout: 20 // saniye
    });

    if (res.statusCode === 200) {
      const data = res.json;
      const answer = data.text;

      if (!answer) {
        console.log("❌ [WORKIGOM_AI] API yanıtı başarılı ama 'text' alanı boş.");
        return;
      }

      console.log(`✅ [WORKIGOM_AI] Cevap alındı (${answer.length} karakter). Kaydediliyor...`);

      // Cevabı kaydet
      const messagesCol = $app.dao().findCollectionByNameOrId("messages");
      const aiReply = new Record(messagesCol);

      aiReply.set("text", answer);
      aiReply.set("senderName", "Workigom AI");
      aiReply.set("senderId", "ai_bot");
      aiReply.set("senderAvatar", "https://api.dicebear.com/7.x/bottts/svg?seed=workigom&backgroundColor=00ff9d");
      aiReply.set("isUser", false);
      aiReply.set("room", room); // Kullanıcının odasına yaz

      $app.dao().saveRecord(aiReply);
      console.log("💾 [WORKIGOM_AI] Veritabanına yazıldı.");

    } else {
      console.log(`❌ [WORKIGOM_AI] API Hatası: Status ${res.statusCode}`);
      console.log(`❌ [WORKIGOM_AI] Response: ${res.raw}`);
    }

  } catch (err) {
    console.log(`🔥 [WORKIGOM_AI] Exception: ${err}`);
  }

}, "messages");