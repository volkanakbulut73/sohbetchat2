console.log("🔥 AI CHAT HOOK YÜKLENDİ");

onRecordAfterCreateRequest((e) => {
    if (e.collection.name !== "messages") return;

    const record = e.record;

    const text = record.get("text");
    const isUser = record.get("isUser");
    const room = record.get("room");

    console.log("🔥 MESSAGE CREATE TETİKLENDİ");
    console.log("📩 TEXT:", text);
    console.log("👤 isUser:", isUser);

    // sadece kullanıcı mesajıysa cevapla
    if (!isUser) return;
    if (!text) return;

    const reply = "Merhaba 👋 Ben Workigom AI 🤖";

    const col = $app.dao().findCollectionByNameOrId("messages");
    const aiMsg = new Record(col);

    aiMsg.set("text", reply);
    aiMsg.set("room", room);
    aiMsg.set("senderName", "Workigom AI");
    aiMsg.set("isUser", false);
    aiMsg.set("type", "text");

    $app.dao().saveRecord(aiMsg);

    console.log("🤖 AI CEVAP YAZDI");
});
