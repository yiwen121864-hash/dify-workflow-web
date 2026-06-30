import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Dify API Configuration ---
// 请在 .env 文件中配置 DIFY_API_KEY（在 Dify 应用「访问 API」页面获取，以 app- 开头）
const DIFY_BASE_URL = process.env.DIFY_BASE_URL || "https://api.dify.ai/v1";
const DIFY_API_KEY = process.env.DIFY_API_KEY;

if (!DIFY_API_KEY || DIFY_API_KEY === "请输入自己的api") {
  console.error("\n  ❌ 错误: 请先配置 DIFY_API_KEY 环境变量！\n");
  console.error("  方式一：创建 .env 文件并添加 DIFY_API_KEY=你的API密钥");
  console.error("  方式二：export DIFY_API_KEY=你的API密钥 后启动\n");
  process.exit(1);
}

app.use(express.json({ limit: "10mb" }));
app.use(express.static(join(__dirname, "public")));

/**
 * Generic helper to pipe a streaming SSE response from Dify to the client.
 * Workflow events are forwarded transparently.
 */
async function pipeDifyStream(difyRes, clientRes) {
  clientRes.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  clientRes.setHeader("Cache-Control", "no-cache");
  clientRes.setHeader("Connection", "keep-alive");
  clientRes.setHeader("X-Accel-Buffering", "no");
  clientRes.flushHeaders?.();

  try {
    for await (const chunk of difyRes.body) {
      clientRes.write(chunk);
    }
  } catch (err) {
    console.error("Stream pipe error:", err.message);
  } finally {
    clientRes.end();
  }
}

/**
 * POST /api/run
 * Body: { input, user }
 * Proxies to Dify /workflows/run with streaming.
 * The workflow expects a single input variable named "input".
 */
app.post("/api/run", async (req, res) => {
  const { input, user } = req.body;

  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "input is required" });
  }

  const userId = user || `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const payload = {
    inputs: { input },
    response_mode: "streaming",
    user: userId,
  };

  let difyRes;
  try {
    difyRes = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Dify connection error:", err.message);
    return res.status(502).json({ error: "Failed to connect to Dify API" });
  }

  if (!difyRes.ok) {
    const errText = await difyRes.text();
    console.error("Dify API error:", difyRes.status, errText);
    return res.status(difyRes.status).json({
      error: "Dify API error",
      status: difyRes.status,
      detail: errText,
    });
  }

  res.setHeader("X-User-Id", userId);
  await pipeDifyStream(difyRes, res);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "dify-workflow-web" });
});

const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  ✅ 学术关键词翻译扩增助手 已启动！\n`);
  console.log(`  ➜  本地访问:  http://localhost:${PORT}`);
  console.log(`  ➜  公网访问:  http://<your-ip>:${PORT}`);
  console.log(`  ➜  API 端点:  ${DIFY_BASE_URL}/workflows/run\n`);
});
