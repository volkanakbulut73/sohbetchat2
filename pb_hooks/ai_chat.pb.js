onRecordAfterCreateRequest((e) => {
  const msg = e.record;

  // 1. Loglama: İşlem başladığını görelim
  console.log("🔥 [AI Hook] Yeni mesaj algılandı: " + msg.id);

  // 2. Temel Filtreler: Sadece kullanıcı mesajlarını işle (isUser=true)
  // Ayrıca "!"" ile başlayan komutları ve boş mesajları yoksay
  if (!msg.getBool("isUser") || msg.getString("text").startsWith("!")) {
    console.log("🚫 [AI Hook] Mesaj AI için uygun değil (isUser=false veya komut).");
    return;
  }

  // 3. Veri Çekme
  // DİKKAT: Veritabanındaki alan adı 'room', 'room_id' değil!
  const room = msg.getString("room"); 
  const text = msg.getString("text");
  
  console.log(`📩 [AI Hook] Oda: ${room}, Mesaj: ${text}`);

  // 4. Oda Bağlamına Göre Kişilik Belirleme
  let systemContext = "You are a helpful, witty, and concise AI assistant in a group chat.";
  if (room === "room_china") {
    systemContext = "You are an expert consultant on China trade, logistics, and Alibaba. Keep answers professional but concise.";
  } else if (room === "room_chaos") {
    systemContext = "You are a fun, slightly chaotic chatbot who loves emojis.";
  }

  // 5. API URL Yapılandırması
  // PocketBase sunucusu ile Next.js uygulamanız farklı yerlerde barınıyorsa (örn: PB sunucuda, Next.js Vercel'de)
  // localhost çalışmaz. Mutlaka tam alan adı (https://...) gereklidir.
  // Ortam değişkeni (AI_API_URL) yoksa varsayılan placeholder kullanılır.
  const AI_API_URL = $os.getenv("AI_API_URL");

  if (!AI_API_URL) {
    console.log("❌ [AI Hook] HATA: AI_API_URL ortam değişkeni tanımlanmamış! Lütfen PocketBase panelinde veya .env dosyasında tanımlayın.");
    // Geçici olarak return etmiyoruz, belki hardcoded bir URL vardır diye deniyoruz ama log düşüyoruz.
    return;
  }

  console.log(`🌐 [AI Hook] API İsteği gönderiliyor: ${AI_API_URL}`);

  try {
    const response = $http.send({
      url: AI_API_URL,
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: text }
        ]
      }),
      headers: { "Content-Type": "application/json" },
      timeout: 30 // saniye
    });

    if (response.statusCode === 200) {
      // Başarılı yanıt
      const result = response.json;
      const answer = result.text || "Hmm, cevap üretemedim.";
      
      console.log("✅ [AI Hook] API Başarılı. Cevap uzunluğu: " + answer.length);

      // 6. AI Cevabını Yeni Kayıt Olarak Ekleme
      const collection = $app.dao().findCollectionByNameOrId("messages");
      const aiRecord = new Record(collection);
      
      aiRecord.set("text", answer);
      aiRecord.set("senderName", "Workigom AI");
      aiRecord.set("senderId", "ai_assistant"); 
      aiRecord.set("senderAvatar", "https://api.dicebear.com/7.x/bottts/svg?seed=workigom&backgroundColor=00ff9d");
      aiRecord.set("isUser", false); // Döngüye girmemesi için çok önemli
      aiRecord.set("room", room);    // Kullanıcının mesajının olduğu odaya yanıt ver
      
      $app.dao().saveRecord(aiRecord);
      console.log("💾 [AI Hook] Cevap veritabanına kaydedildi.");

    } else {
        // API hatası
        console.log(`❌ [AI Hook] API Hatası: Status ${response.statusCode}, Body: ${response.raw}`);
    }

  } catch (error) {
    // Bağlantı hatası vb.
    console.log(`❌ [AI Hook] Kritik Hata: ${error}`);
  }

}, "messages");