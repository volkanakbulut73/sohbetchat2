console.log("AI_API_URL:", process.env.AI_API_URL);
onRecordAfterCreateRequest((e) => {
  const msg = e.record;
  
  // 1. Basic Filters: Only process real user messages, ignore commands
  if (!msg.get("isUser") || msg.getString("text").startsWith("!")) {
    return;
  }

  // 2. Room specific context
  const room = msg.getString("room");
  
  // Optionally filter rooms. Currently active for all rooms.
  let systemContext = "You are a helpful, witty, and concise AI assistant in a group chat.";
  if (room === "room_china") {
    systemContext = "You are an expert consultant on China trade, logistics, and Alibaba. Keep answers professional but concise.";
  } else if (room === "room_chaos") {
    systemContext = "You are a fun, slightly chaotic chatbot who loves emojis.";
  }

  // 3. Create Placeholder AI Message (UI shows 'Thinking...')
  const collection = $app.dao().findCollectionByNameOrId("messages");
  const aiRecord = new Record(collection);
  
  aiRecord.set("text", "✍️ ..."); // Loading indicator
  aiRecord.set("senderName", "Workigom AI");
  aiRecord.set("senderId", "ai_assistant"); 
  aiRecord.set("senderAvatar", "https://api.dicebear.com/7.x/bottts/svg?seed=workigom&backgroundColor=00ff9d");
  aiRecord.set("isUser", false);
  aiRecord.set("room", room);
  
  $app.dao().saveRecord(aiRecord);

  // 4. Call External API (Next.js Route)
  // Note: Replace with your actual production URL in deployment.
  const AI_API_URL = process.env.AI_API_URL || "http://localhost:3000/api/ai/chat";

  try {
    const response = $http.send({
      url: AI_API_URL,
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: msg.getString("text") }
        ]
      }),
      headers: { "Content-Type": "application/json" },
      timeout: 30
    });

    if (response.statusCode === 200) {
      // 5. Parse JSON Response
      // PocketBase response.json automatically parses the body if content-type is json
      const result = response.json;
      
      if (result && result.text) {
        aiRecord.set("text", result.text);
        $app.dao().saveRecord(aiRecord);
      } else {
        // If empty response
        aiRecord.set("text", "Hmm, I couldn't think of a response.");
        $app.dao().saveRecord(aiRecord);
      }
    } else {
        throw new Error("API returned status " + response.statusCode);
    }

  } catch (error) {
    // Error Handling: Update message to show error
    aiRecord.set("text", "⚠️ AI Error: " + error.message);
    $app.dao().saveRecord(aiRecord);
  }

}, "messages");
