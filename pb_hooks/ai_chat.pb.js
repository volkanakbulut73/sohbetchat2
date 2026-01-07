onRecordAfterCreateRequest((e) => {
  const record = e.record;

  // sadece user mesajları
  if (record.get("role") !== "user") return;

  const roomId = record.get("room_id");
  const content = record.get("content");

  const AI_USER_ID = "AI_USER_ID_BURAYA";

  const res = $http.send({
    url: process.env.AI_API_URL + "/api/ai/chat",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "user", content }
      ]
    })
  });

  if (!res || res.statusCode !== 200) {
    console.log("AI API error");
    return;
  }

  const text = res.json.text || "Cevap üretilemedi.";

  const aiMsg = new Record("messages");
  aiMsg.set("room_id", roomId);
  aiMsg.set("content", text);
  aiMsg.set("role", "assistant");
  aiMsg.set("user", AI_USER_ID);

  $app.dao().saveRecord(aiMsg);

}, "messages");
