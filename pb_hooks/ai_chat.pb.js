onRecordAfterCreateRequest((e) => {
  const record = e.record

  if (record.collection().name !== "messages") return

  console.log("🔥 MESSAGE CREATE TETİKLENDİ")

  const text = record.get("text")
  const isUser = record.get("isUser")

  console.log("📩 TEXT:", text)
  console.log("👤 isUser:", isUser)

  if (!isUser) {
    console.log("🤖 AI mesajı, atlandı")
    return
  }

  if (!text || text.trim() === "") {
    console.log("⚠️ Boş mesaj")
    return
  }

  $app.dao().saveRecord(
    new Record($app.dao().findCollectionByNameOrId("messages"), {
      text: "Merhaba 👋 Ben Workigom AI 🤖",
      room: record.get("room"),
      senderName: "Workigom AI",
      isUser: false,
      type: "ai"
    })
  )

  console.log("✅ AI CEVAP YAZDI")
})
