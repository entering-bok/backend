const express = require('express');
require('dotenv').config();
const fs = require("fs").promises;
const router = express.Router();

router.use(express.json());

// 대화 상태 저장
let conversations = {}; // key: conversationId, value: message history

// GPT 말투와 성격 데이터 로드
let gptProfiles = [];
const loadGptProfiles = async () => {
  try {
    const data = await fs.readFile("src/tones.json", "utf8");
    gptProfiles = JSON.parse(data);
    console.log("GPT Profiles loaded:", gptProfiles);
  } catch (error) {
    console.error("Error loading GPT Profiles:", error.message);
  }
};

loadGptProfiles()

// 대화 시작 API
router.post("/startConversation", async (req, res) => {
    const { gpt1Id, gpt2Id } = req.body;
  
    const gpt1 = gptProfiles.find((g) => g.id === gpt1Id);
    const gpt2 = gptProfiles.find((g) => g.id === gpt2Id);
  
    if (!gpt1 || !gpt2) {
      return res.status(400).json({ error: "Invalid GPT IDs" });
    }
  
    const conversationId = `${gpt1Id}-${gpt2Id}-${Date.now()}`;
    conversations[conversationId] = [
      { role: "system", content: gpt1.systemMessage },
      { role: "system", content: gpt2.systemMessage },
    ]; // 시스템 메시지 추가
  
    console.log(`Conversation started: ${conversationId}`);
    res.json({ conversationId, gpt1: gpt1.name, gpt2: gpt2.name });
  });
  
  // 사용자와 GPT 간 대화 API
  router.post("/startSingleConversation", async (req, res) => {
    const { gptId } = req.body;
  
    const gpt = gptProfiles.find((g) => g.id === gptId);
  
    if (!gpt) {
      return res.status(400).json({ error: "Invalid GPT ID" });
    }
  
    const conversationId = `${gptId}-${Date.now()}`;
    conversations[conversationId] = [
      { role: "system", content: gpt.systemMessage },
    ]; // 초기화 (시스템 메시지 포함)
  
    console.log(`Single conversation started: ${conversationId}`);
    res.json({ conversationId, gpt: gpt.name });
  });
  
  const generateUserMessage = (messageHistory, currentSpeaker) => {
    // 대화 히스토리에서 마지막 대화 메시지 추출
    const lastDialogueMessage = messageHistory
      .slice()
      .reverse()
      .find((msg) => msg.role !== "system");
  
    const lastMessageContent = lastDialogueMessage
      ? lastDialogueMessage.content
      : "지금까지의 대화가 없습니다. 역할에 맞게 대화를 처음 시작합니다.";
  
    // 역할에 따른 응답 생성
    if (currentSpeaker === "student") {
      return `손주는 지금까지의 대화를 참고하여 적절히 반응하며 이어가주세요: "${lastMessageContent}"`;
    } else if (currentSpeaker === "grandma") {
      return `할머니는 지금까지의 대화를 참고하여 적절히 반응하며 이어가주세요: "${lastMessageContent}"`;
    } else if (currentSpeaker === "grandfa") {
      return `할아버지는 지금까지의 대화를 참고하여 적절히 반응하며 이어가주세요: "${lastMessageContent}"`;
    } else if (currentSpeaker === "aunt") {
      return `고모는 지금까지의 대화를 참고하여 적절히 반응하며 이어가주세요: "${lastMessageContent}"`;
    }
    return "대화를 이어가주세요.";
  };
  
  // 대화 진행 API
  router.post("/continueConversation", async (req, res) => {
    const { conversationId, userMessage, speakerId } = req.body;
  
    if (!conversations[conversationId]) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
  
    const messageHistory = conversations[conversationId];

    const nextUserMessage = userMessage || generateUserMessage(messageHistory, speakerId);
  
    // OpenAI API 요청 메시지 생성
    const openAIRequest = [
      ...messageHistory, // 이전 대화 기록
      { role: "user", content: nextUserMessage }, // 새 사용자 메시지
    ];
  
    console.log('nextUserMessage', nextUserMessage, speakerId)
  
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openAIRequest,
          max_tokens: 100,
          temperature: 0.8, // 응답 다양성 증가
          stop: [".", "!", "?"], // 명확한 문장 종료 설정
        }),
      });
  
      const data = await response.json();
      const gptReply = data.choices[0]?.message?.content.trim() || "응답이 없습니다.";
  
      // 메시지 기록에 추가
      messageHistory.push({ role: "user", content: nextUserMessage });
      messageHistory.push({ role: "assistant", content: gptReply });
  
      conversations[conversationId] = messageHistory;
  
      console.log("Updated message history:", messageHistory);
  
      // 클라이언트에 반환
      res.json({ messages: messageHistory.filter((msg) => msg.role !== "system") });
    } catch (error) {
      console.error("Error in OpenAI API call:", error.message);
      res.status(500).json({ error: "OpenAI API call failed" });
    }
  });

  module.exports = router;