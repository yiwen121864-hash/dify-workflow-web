/* ============================================
   学术关键词翻译扩增助手 - Frontend Logic
   Dify Workflow API SSE streaming
   ============================================ */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const messagesEl = $("#messages");
  const welcomeEl = $("#welcome");
  const inputEl = $("#messageInput");
  const sendBtn = $("#sendBtn");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");
  const menuBtn = $("#menuBtn");
  const sidebarToggle = $("#sidebarToggle");
  const newChatBtn = $("#newChatBtn");
  const clearBtn = $("#clearBtn");
  const conversationList = $("#conversationList");
  const chatTitle = $("#chatTitle");
  const chatSub = $("#chatSub");
  const toastContainer = $("#toastContainer");

  // ---------- State ----------
  let userId = localStorage.getItem("dify_user") || `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("dify_user", userId);

  let isStreaming = false;
  let abortController = null;

  let history = [];
  try { history = JSON.parse(localStorage.getItem("dify_history") || "[]"); } catch { history = []; }
  let currentHistoryId = null;

  // ---------- Markdown config ----------
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; } catch {}
      }
      try { return hljs.highlightAuto(code).value; } catch { return code; }
    },
  });

  function renderMarkdown(text) {
    return DOMPurify.sanitize(marked.parse(text));
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------- Toast ----------
  function toast(message, type = "info") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    el.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.3s, transform 0.3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function scrollToBottom(smooth = true) {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + "px";
  }

  const AI_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  const USER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

  // ---------- Message rendering ----------
  function addMessage(role, content, opts = {}) {
    if (welcomeEl) welcomeEl.style.display = "none";
    const row = document.createElement("div");
    row.className = `msg-row ${role}`;
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.innerHTML = role === "user" ? USER_SVG : AI_SVG;
    const body = document.createElement("div");
    body.className = "msg-body";
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    if (role === "user") { bubble.textContent = content; }
    else { bubble.classList.add("markdown"); bubble.innerHTML = renderMarkdown(content); }
    body.appendChild(bubble);
    row.appendChild(avatar);
    row.appendChild(body);
    messagesEl.appendChild(row);
    scrollToBottom();
    return { row, bubble, body };
  }

  function showProcessing() {
    const row = document.createElement("div");
    row.className = "msg-row ai";
    row.id = "processing-row";
    row.innerHTML = `
      <div class="msg-avatar">${AI_SVG}</div>
      <div class="msg-body">
        <div class="msg-bubble">
          <div class="processing-status">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
            <span class="processing-text" id="processingText">正在分析关键词…</span>
          </div>
        </div>
      </div>`;
    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  function updateProcessingText(text) {
    const el = $("#processingText");
    if (el) el.textContent = text;
  }

  function addCopyAction(body, content) {
    const actions = document.createElement("div");
    actions.className = "msg-actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn";
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制';
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(content).then(() => toast("已复制到剪贴板", "success"));
    });
    actions.appendChild(copyBtn);
    body.appendChild(actions);
  }

  const NODE_STATUS_MAP = {
    "用户输入": "已接收关键词",
    "LLM": "AI 正在翻译扩增关键词…",
    "代码执行": "正在整理检索结果…",
    "迭代": "正在检索相关文献…",
    "输出": "即将输出结果…",
    "start": "已接收关键词",
    "end": "结果生成完成",
  };

  // ---------- Send query (workflow streaming) ----------
  async function sendQuery(text) {
    if (!text.trim() || isStreaming) return;

    isStreaming = true;
    setSending(true);
    addMessage("user", text);
    const processingRow = showProcessing();

    abortController = new AbortController();
    let accumulated = "";
    let aiBubble = null;
    let aiBody = null;
    let firstChunk = true;
    let finalOutput = "";

    try {
      const resp = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, user: userId }),
        signal: abortController.signal,
      });

      const newUid = resp.headers.get("X-User-Id");
      if (newUid) { userId = newUid; localStorage.setItem("dify_user", userId); }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `请求失败 (${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          let event;
          try { event = JSON.parse(dataStr); } catch { continue; }

          switch (event.event) {
            case "workflow_started":
              updateProcessingText("工作流已启动…");
              break;
            case "node_started":
              if (event.data && event.data.title) {
                updateProcessingText(NODE_STATUS_MAP[event.data.title] || `正在执行：${event.data.title}`);
              }
              break;
            case "iteration_started":
              if (event.data && event.data.metadata) {
                updateProcessingText(`正在检索 ${event.data.metadata.iteration_length} 组关键词的文献…`);
              }
              break;
            case "iteration_next":
              if (event.data && typeof event.data.index === "number") {
                updateProcessingText(`正在检索第 ${event.data.index + 1} 组关键词…`);
              }
              break;
            case "text_chunk":
              if (firstChunk) {
                processingRow.remove();
                const ref = addMessage("ai", "", { streaming: true });
                aiBubble = ref.bubble;
                aiBody = ref.body;
                aiBubble.classList.add("stream-cursor");
                firstChunk = false;
              }
              if (event.data && event.data.text) {
                accumulated += event.data.text;
                if (aiBubble) aiBubble.innerHTML = renderMarkdown(accumulated);
                scrollToBottom(false);
              }
              break;
            case "workflow_finished":
              if (event.data && event.data.outputs) {
                const outputs = event.data.outputs;
                if (typeof outputs.output === "string") finalOutput = outputs.output;
                else if (Array.isArray(outputs.output)) finalOutput = outputs.output.join("\n\n");
                else if (outputs.text) finalOutput = outputs.text;
              }
              if (firstChunk && finalOutput) {
                processingRow.remove();
                const ref = addMessage("ai", finalOutput);
                aiBubble = ref.bubble;
                aiBody = ref.body;
                firstChunk = false;
              } else if (firstChunk && !finalOutput) {
                processingRow.remove();
                addMessage("ai", "未获取到有效结果，请尝试更换关键词后重试。");
              } else if (aiBubble) {
                aiBubble.classList.remove("stream-cursor");
                if (!accumulated && finalOutput) {
                  accumulated = finalOutput;
                  aiBubble.innerHTML = renderMarkdown(finalOutput);
                }
              }
              break;
            case "error":
              throw new Error(event.message || event.error || "工作流执行出错");
            case "ping":
              break;
          }
        }
      }

      if (aiBody && (accumulated || finalOutput)) {
        addCopyAction(aiBody, accumulated || finalOutput);
      }
      const resultText = accumulated || finalOutput || "";
      if (resultText) saveToHistory(text, resultText);
      chatSub.textContent = "扩增完成";
    } catch (err) {
      processingRow.remove();
      if (err.name === "AbortError") {
        if (aiBubble && accumulated) { aiBubble.classList.remove("stream-cursor"); }
        else { addMessage("ai", "已停止生成。"); }
      } else {
        console.error(err);
        addMessage("ai", `⚠️ 出错了：${err.message}`);
        toast(err.message, "error");
      }
    } finally {
      isStreaming = false;
      setSending(false);
      abortController = null;
    }
  }

  // ---------- History management (client-side) ----------
  function saveToHistory(query, result) {
    const item = {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      query, result, timestamp: Date.now(),
    };
    history.unshift(item);
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem("dify_history", JSON.stringify(history));
    renderHistoryList();
  }

  function renderHistoryList() {
    if (history.length === 0) {
      conversationList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <p>暂无查询记录</p>
        </div>`;
      return;
    }
    conversationList.innerHTML = "";
    history.forEach((item) => {
      const el = document.createElement("div");
      el.className = `conv-item ${item.id === currentHistoryId ? "active" : ""}`;
      el.dataset.id = item.id;
      const title = item.query.length > 24 ? item.query.slice(0, 24) + "…" : item.query;
      el.innerHTML = `
        <svg class="conv-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="conv-item-text">${escapeHtml(title)}</span>
        <button class="conv-item-del" title="删除记录"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
      el.addEventListener("click", (e) => {
        if (e.target.closest(".conv-item-del")) return;
        loadHistoryItem(item.id);
      });
      el.querySelector(".conv-item-del").addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
      });
      conversationList.appendChild(el);
    });
  }

  function loadHistoryItem(id) {
    if (isStreaming) return;
    const item = history.find((h) => h.id === id);
    if (!item) return;
    currentHistoryId = id;
    chatTitle.textContent = item.query.length > 20 ? item.query.slice(0, 20) + "…" : item.query;
    chatSub.textContent = "历史查询记录";
    messagesEl.innerHTML = "";
    messagesEl.appendChild(welcomeEl);
    welcomeEl.style.display = "none";
    addMessage("user", item.query);
    addMessage("ai", item.result);
    renderHistoryList();
  }

  function deleteHistoryItem(id) {
    history = history.filter((h) => h.id !== id);
    localStorage.setItem("dify_history", JSON.stringify(history));
    if (currentHistoryId === id) startNewQuery();
    renderHistoryList();
    toast("记录已删除", "success");
  }

  function startNewQuery() {
    if (isStreaming) abortController?.abort();
    currentHistoryId = null;
    messagesEl.innerHTML = "";
    messagesEl.appendChild(welcomeEl);
    welcomeEl.style.display = "flex";
    chatTitle.textContent = "学术关键词翻译扩增";
    chatSub.textContent = "输入关键词开始扩增";
    renderHistoryList();
    inputEl.focus();
  }

  // ---------- Send button states ----------
  function setSending(sending) {
    if (sending) {
      sendBtn.classList.add("stop");
      sendBtn.disabled = false;
      sendBtn.title = "停止生成";
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    } else {
      sendBtn.classList.remove("stop");
      sendBtn.title = "执行";
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
      updateSendBtnState();
    }
  }

  function updateSendBtnState() {
    sendBtn.disabled = inputEl.value.trim().length === 0 || isStreaming;
  }

  function openSidebar() { sidebar.classList.add("open"); overlay.classList.add("show"); }
  function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }

  // ---------- Init ----------
  function init() {
    inputEl.addEventListener("input", () => { autoResize(); updateSendBtnState(); });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) { abortController?.abort(); }
        else if (inputEl.value.trim()) {
          const text = inputEl.value.trim();
          inputEl.value = "";
          autoResize();
          updateSendBtnState();
          sendQuery(text);
        }
      }
    });

    sendBtn.addEventListener("click", () => {
      if (isStreaming) { abortController?.abort(); }
      else if (inputEl.value.trim()) {
        const text = inputEl.value.trim();
        inputEl.value = "";
        autoResize();
        updateSendBtnState();
        sendQuery(text);
      }
    });

    newChatBtn.addEventListener("click", startNewQuery);

    clearBtn.addEventListener("click", () => {
      if (currentHistoryId || messagesEl.querySelector(".msg-row")) {
        startNewQuery();
      }
    });

    document.querySelectorAll(".suggestion-card").forEach((card) => {
      card.addEventListener("click", () => {
        const prompt = card.dataset.prompt;
        if (prompt && !isStreaming) sendQuery(prompt);
      });
    });

    menuBtn.addEventListener("click", openSidebar);
    sidebarToggle.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);

    renderHistoryList();
    updateSendBtnState();
    inputEl.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
