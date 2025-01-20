const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000", // 프론트엔드 URL
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true, // 쿠키 인증 정보 허용
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 대화 상태 저장
let conversations = {}; // key: conversationId, value: message history

// GPT 말투와 성격 데이터 로드
let gptProfiles = [];
const loadGptProfiles = async () => {
  try {
    const data = await fs.readFile("tones.json", "utf8");
    gptProfiles = JSON.parse(data);
    console.log("GPT Profiles loaded:", gptProfiles);
  } catch (error) {
    console.error("Error loading GPT Profiles:", error.message);
  }
};

// 대화 시작 API
app.post("/api/startConversation", async (req, res) => {
  const { gpt1Id, gpt2Id } = req.body;

  const gpt1 = gptProfiles.find((g) => g.id === gpt1Id);
  const gpt2 = gptProfiles.find((g) => g.id === gpt2Id);

  if (!gpt1 || !gpt2) {
    return res.status(400).json({ error: "Invalid GPT IDs" });
  }

  const conversationId = `${gpt1Id}-${gpt2Id}-${Date.now()}`;
  conversations[conversationId] = []; // 대화 초기화 (시스템 메시지 미포함)

  console.log(`Conversation started: ${conversationId}`);
  res.json({ conversationId, gpt1: gpt1.name, gpt2: gpt2.name });
});

// 대화 진행 API
// 대화 진행 API
app.post("/api/continueConversation", async (req, res) => {
  const { conversationId, userMessage, speakerId } = req.body;

  if (!conversations[conversationId]) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  const messageHistory = conversations[conversationId];

  // 대화 ID에서 GPT 프로필 가져오기
  const [gpt1Id, gpt2Id] = conversationId.split("-");
  const gpt1 = gptProfiles.find((g) => g.id === gpt1Id);
  const gpt2 = gptProfiles.find((g) => g.id === gpt2Id);

  // 시스템 메시지는 대화 시작 시 한 번만 추가
  if (messageHistory.length === 0) {
    if (gpt1) {
      messageHistory.push({ role: "system", content: gpt1.systemMessage });
    }
    if (gpt2) {
      messageHistory.push({ role: "system", content: gpt2.systemMessage });
    }
  }

  // OpenAI API 요청 메시지 생성
  const openAIRequest = [
    ...messageHistory, // 이전 대화 기록
    { role: "user", content: userMessage }, // 새 사용자 메시지
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: openAIRequest,
        max_tokens: 100,
        stop: [".", "!", "?"], // 명확한 문장 종료 설정
      }),
    });

    const data = await response.json();
    const gptReply = data.choices[0]?.message?.content.trim() || "응답이 없습니다.";

    // 메시지 기록에 추가
    messageHistory.push({ role: "user", content: userMessage });
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

// GPT Profiles 로드
loadGptProfiles().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
  });
});