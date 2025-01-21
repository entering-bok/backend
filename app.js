const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
require("dotenv").config();

const apiRoutes = require("./src/api/routes/apiRoutes")

const app = express();

app.use(cors({
  origin: "http://localhost:3000", // 프론트엔드 URL
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true, // 쿠키 인증 정보 허용
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

// GPT Profiles 로드
app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
