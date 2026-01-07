onRecordAfterCreateRequest((e) => {
    if (e.collection.name !== "messages") return;

    const record = e.record;

    console.log("🔥 MESSAGE CREATE TETİKLENDİ");
    console.log("📩 TEXT:", record.get("text"));
    console.log("👤 isUser:", record.get("isUser"));

    // sadece kullanıcı mesajıysa AI cevap versin
    if (!record.get("isUser")) return;

    const text = record.get("text");
    const room = record.get("room");

    if (!text) return;

    // AI cevabı (şimdilik sabit cevap test için)
    const aiReply = "Merhaba 👋 Ben Workigom AI 🤖";

    const collection = $app.dao().findCollectionByNameOrId("messages");

    const aiRecord = new Record(collection);
    aiRecord.set("text", aiReply);
    aiRecord.set("room", room);
    aiRecord.set("senderName", "Workigom AI");
    aiRecord.set("isUser", false);
    aiRecord.set("type", "text");

    $app.dao().saveRecord(aiRecord);
});
