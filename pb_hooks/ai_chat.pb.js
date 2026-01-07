onRecordAfterCreate((e) => {
  const record = e.record

  if (record.collection().name !== "messages") return

  console.log("🔥 MESSAGE CREATE")

  const text = record.get("text")
  const isUser = record.get("isUser")

  console.log("📩 text:", text)
  console.log("👤 isUser:", isUser)

  if (isUser !== true) {
    console.log("🤖 AI mesajı, atlandı")
    return
  }

  if (!text || text.trim() === "") {
    console.log("⚠️ Boş mesaj")
    return
  }

  const col = $app.dao().findCollectionByNameOrId("messages")
  const ai = new Record(col)

  ai.set("text", "Merhaba 👋 Ben Workigom AI 🤖")
  ai.set("isUser", false)
  ai.set("room_id", record.get("room_id"))

  $app.dao().saveRecord(ai)

  console.log("✅ AI CEVAP YAZDI")
})
