# 学术关键词翻译扩增助手

基于 [Dify](https://dify.ai) Workflow API 构建的高级 Web 应用，输入中英文学术检索关键词，自动翻译并扩增同义术语，适配知网、WOS、IEEE 等学术数据库。

## ✨ 特性

- **工作流驱动** — 基于 Dify Workflow API，支持 LLM 翻译扩增 + 代码处理多节点
- **流式响应** — SSE 实时流式输出，打字机效果，实时显示工作流节点进度
- **Markdown 渲染** — 支持代码高亮、列表、加粗等富文本
- **安全代理** — API Key 保存在后端，前端不暴露密钥
- **查询历史** — 客户端 localStorage 本地存储历史查询记录
- **精美 UI** — 毛玻璃质感、渐变光效动画、响应式布局

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js + Express（API 代理 + SSE 流式转发） |
| 前端 | 原生 HTML / CSS / JS |
| 渲染 | marked.js + highlight.js + DOMPurify |
| API | Dify Workflow API (`/v1/workflows/run`) |

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

打开浏览器访问 **http://localhost:3000**

## ⚙️ 配置

API 配置位于 `server.js` 顶部：

```js
const DIFY_BASE_URL = "https://api.dify.ai/v1";
const DIFY_API_KEY = "app-xxxxxxxx";
```

## 📁 项目结构

```
.
├── server.js            # Express 后端代理（workflow 端点）
├── package.json
├── public/
│   ├── index.html       # 页面结构
│   ├── css/style.css    # 高级美化样式
│   └── js/app.js        # 前端交互逻辑（SSE 解析）
└── README.md
```

## 📡 后端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/run` | 执行工作流（流式 SSE） |
| GET | `/api/health` | 健康检查 |

## 🔄 工作流事件

前端解析以下 SSE 事件：

| 事件 | 说明 |
|------|------|
| `workflow_started` | 工作流启动 |
| `node_started` | 节点开始执行（显示进度状态） |
| `node_finished` | 节点执行完成 |
| `text_chunk` | 流式文本输出（主要结果） |
| `workflow_finished` | 工作流完成（最终结构化输出） |

## 📝 使用示例

- 输入 `锂电池` → 输出中文扩增关键词 + 英文检索关键词
- 输入 `machine learning` → 输出英文扩增关键词 + 中文检索关键词
- 输入 `深度学习`、`natural language processing` 等
