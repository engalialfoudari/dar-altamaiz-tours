import { Router } from "express";

const router = Router();

const WIDGET_JS = `(function () {
  "use strict";

  var API_BASE = "https://d7b44d10-cfb5-4168-8f9f-8b2a418e4057-00-3rf50yqp3upmp.sisko.replit.dev/api";

  var COLORS = {
    black: "#000000",
    gold: "#D4AF37",
    white: "#FFFFFF",
    offWhite: "#F9F6EF",
    gray: "#888888",
    shadow: "rgba(0,0,0,0.22)",
  };

  var messages = [];
  var isOpen = false;
  var isTyping = false;
  var hasGreeted = false;

  var GREETING_AR = "هلا والله! \\u{1F44B} أنا تميز، مستشارك السياحي من دار التميز.\\n\\nوين تبي تسافر؟ قولي وأساعدك تلقى أحسن الباقات والعروض! \\u{2708}\\uFE0F";
  var GREETING_EN = "Welcome! \\u{1F44B} I'm Tamaiz, your personal travel advisor from Dar AlTamaiz Tours.\\n\\nWhere would you like to travel? Tell me and I'll help you find the perfect package! \\u{2708}\\uFE0F";

  function injectStyles() {
    var s = document.createElement("style");
    s.textContent = "#dt-chat-btn{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:#000;border:2.5px solid #D4AF37;box-shadow:0 4px 20px rgba(0,0,0,.22);cursor:pointer;z-index:999998;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;}"
      + "#dt-chat-btn:hover{transform:scale(1.08);}"
      + "#dt-chat-btn svg{width:28px;height:28px;}"
      + "#dt-chat-badge{position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#D4AF37;border-radius:50%;border:2px solid #000;display:none;animation:dt-pulse 1.8s infinite;}"
      + "@keyframes dt-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}"
      + "#dt-chat-window{position:fixed;bottom:96px;right:24px;width:370px;max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 110px);background:#fff;border-radius:20px;box-shadow:0 8px 48px rgba(0,0,0,.22);z-index:999999;display:flex;flex-direction:column;overflow:hidden;transform:scale(0.85) translateY(24px);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s;}"
      + "#dt-chat-window.dt-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}"
      + "#dt-chat-header{background:#000;padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;}"
      + "#dt-chat-header-avatar{width:40px;height:40px;border-radius:50%;background:#D4AF37;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}"
      + "#dt-chat-header-info{flex:1;}"
      + "#dt-chat-header-name{color:#D4AF37;font-weight:700;font-size:15px;}"
      + "#dt-chat-header-sub{color:#aaa;font-size:12px;margin-top:1px;}"
      + "#dt-chat-close{background:none;border:none;cursor:pointer;color:#aaa;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:color .15s;}"
      + "#dt-chat-close:hover{color:#D4AF37;}"
      + "#dt-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#F9F6EF;}"
      + "#dt-chat-messages::-webkit-scrollbar{width:4px;}"
      + "#dt-chat-messages::-webkit-scrollbar-thumb{background:#D4AF37;border-radius:4px;}"
      + ".dt-msg{max-width:82%;display:flex;flex-direction:column;gap:3px;}"
      + ".dt-msg.dt-user{align-self:flex-end;align-items:flex-end;}"
      + ".dt-msg.dt-bot{align-self:flex-start;align-items:flex-start;}"
      + ".dt-bubble{padding:11px 14px;border-radius:16px;font-size:14px;line-height:1.55;word-break:break-word;white-space:pre-wrap;}"
      + ".dt-msg.dt-user .dt-bubble{background:#D4AF37;color:#000;border-bottom-right-radius:4px;font-weight:500;}"
      + ".dt-msg.dt-bot .dt-bubble{background:#fff;color:#1a1a1a;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.07);}"
      + ".dt-msg-time{font-size:10px;color:#888;margin:0 4px;}"
      + "#dt-typing{align-self:flex-start;display:none;padding:11px 14px;background:#fff;border-radius:16px;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.07);}"
      + "#dt-typing span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#D4AF37;margin:0 2px;animation:dt-bounce .9s infinite;}"
      + "#dt-typing span:nth-child(2){animation-delay:.15s;}"
      + "#dt-typing span:nth-child(3){animation-delay:.3s;}"
      + "@keyframes dt-bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-6px);}}"
      + "#dt-chat-footer{padding:12px 14px;background:#fff;border-top:1px solid #eee;display:flex;align-items:flex-end;gap:8px;flex-shrink:0;}"
      + "#dt-chat-input{flex:1;border:1.5px solid #ddd;border-radius:12px;padding:10px 14px;font-size:14px;resize:none;outline:none;font-family:inherit;max-height:100px;min-height:42px;line-height:1.4;transition:border-color .2s;background:#fff;}"
      + "#dt-chat-input:focus{border-color:#D4AF37;}"
      + "#dt-chat-input::placeholder{color:#bbb;}"
      + "#dt-chat-send{width:42px;height:42px;border-radius:50%;background:#000;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .1s;}"
      + "#dt-chat-send:hover{background:#222;transform:scale(1.06);}"
      + "#dt-chat-send:disabled{background:#ccc;cursor:not-allowed;transform:none;}"
      + "#dt-chat-send svg{width:18px;height:18px;}"
      + "@media(max-width:480px){#dt-chat-window{bottom:0;right:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0;}#dt-chat-btn{bottom:20px;right:16px;}}";
    document.head.appendChild(s);
  }

  function buildDOM() {
    var btn = document.createElement("div");
    btn.id = "dt-chat-btn";
    btn.setAttribute("role","button");
    btn.setAttribute("aria-label","Open chat with Tamaiz");
    btn.innerHTML = '<div id="dt-chat-badge"></div><svg viewBox="0 0 24 24" fill="none"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="#D4AF37"/><circle cx="8" cy="11" r="1.2" fill="#000"/><circle cx="12" cy="11" r="1.2" fill="#000"/><circle cx="16" cy="11" r="1.2" fill="#000"/></svg>';

    var win = document.createElement("div");
    win.id = "dt-chat-window";
    win.setAttribute("role","dialog");
    win.setAttribute("aria-label","Tamaiz Chat");
    win.innerHTML = '<div id="dt-chat-header"><div id="dt-chat-header-avatar">\\u2708\\uFE0F</div><div id="dt-chat-header-info"><div id="dt-chat-header-name">Tamaiz \\u00B7 \\u062A\\u0645\\u064A\\u0632</div><div id="dt-chat-header-sub">Dar AlTamaiz Tours \\u00B7 \\u062F\\u0627\\u0631 \\u0627\\u0644\\u062A\\u0645\\u064A\\u0632</div></div><button id="dt-chat-close" aria-label="Close chat"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div><div id="dt-chat-messages"><div id="dt-typing"><span></span><span></span><span></span></div></div><div id="dt-chat-footer"><textarea id="dt-chat-input" placeholder="\\u0627\\u0643\\u062A\\u0628 \\u0631\\u0633\\u0627\\u0644\\u062A\\u0643... / Type your message..." rows="1"></textarea><button id="dt-chat-send" aria-label="Send message" disabled><svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';

    document.body.appendChild(btn);
    document.body.appendChild(win);

    btn.addEventListener("click", toggleChat);
    document.getElementById("dt-chat-close").addEventListener("click", closeChat);
    document.getElementById("dt-chat-send").addEventListener("click", sendMessage);

    var input = document.getElementById("dt-chat-input");
    input.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 100) + "px";
      document.getElementById("dt-chat-send").disabled = !this.value.trim();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!this.value.trim()) return;
        sendMessage();
      }
    });

    setTimeout(function () {
      var badge = document.getElementById("dt-chat-badge");
      if (badge) badge.style.display = "block";
    }, 2500);
  }

  function toggleChat() { isOpen ? closeChat() : openChat(); }

  function openChat() {
    isOpen = true;
    document.getElementById("dt-chat-window").classList.add("dt-open");
    var badge = document.getElementById("dt-chat-badge");
    if (badge) badge.style.display = "none";
    if (!hasGreeted) {
      hasGreeted = true;
      setTimeout(showGreeting, 400);
    }
    setTimeout(function () { document.getElementById("dt-chat-input").focus(); }, 300);
  }

  function closeChat() {
    isOpen = false;
    document.getElementById("dt-chat-window").classList.remove("dt-open");
  }

  function showGreeting() {
    var lang = (document.documentElement.lang || navigator.language || "").toLowerCase();
    var isAr = lang.startsWith("ar") || /[\\u0600-\\u06FF]/.test(document.body.textContent || "");
    appendBotMessage(isAr ? GREETING_AR : GREETING_EN, true);
  }

  function formatTime() {
    var d = new Date();
    return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
  }

  function appendUserMessage(text) {
    var c = document.getElementById("dt-chat-messages");
    var div = document.createElement("div");
    div.className = "dt-msg dt-user";
    div.innerHTML = '<div class="dt-bubble">' + esc(text) + '</div><span class="dt-msg-time">' + formatTime() + '</span>';
    c.insertBefore(div, document.getElementById("dt-typing"));
    scrollBottom();
  }

  function appendBotMessage(text, animate) {
    var c = document.getElementById("dt-chat-messages");
    var div = document.createElement("div");
    div.className = "dt-msg dt-bot";
    var bubble = document.createElement("div");
    bubble.className = "dt-bubble";
    var t = document.createElement("span");
    t.className = "dt-msg-time";
    t.textContent = formatTime();
    div.appendChild(bubble);
    div.appendChild(t);
    c.insertBefore(div, document.getElementById("dt-typing"));
    if (animate) {
      var i = 0;
      (function type() {
        if (i < text.length) { bubble.textContent += text.charAt(i++); scrollBottom(); setTimeout(type, 12); }
      })();
    } else {
      bubble.textContent = text;
    }
    scrollBottom();
    return bubble;
  }

  function showTyping() { isTyping = true; document.getElementById("dt-typing").style.display = "flex"; scrollBottom(); }
  function hideTyping() { isTyping = false; document.getElementById("dt-typing").style.display = "none"; }
  function scrollBottom() { var c = document.getElementById("dt-chat-messages"); c.scrollTop = c.scrollHeight; }
  function esc(t) { return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function sendMessage() {
    var input = document.getElementById("dt-chat-input");
    var text = input.value.trim();
    if (!text || isTyping) return;
    input.value = "";
    input.style.height = "auto";
    document.getElementById("dt-chat-send").disabled = true;
    messages.push({ role: "user", content: text });
    appendUserMessage(text);
    showTyping();
    var bubble = null;
    var accumulated = "";
    fetch(API_BASE + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      function read() {
        return reader.read().then(function (r) {
          if (r.done) { hideTyping(); if (accumulated) messages.push({ role: "assistant", content: accumulated }); return; }
          buf += decoder.decode(r.value, { stream: true });
          var lines = buf.split("\\n");
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith("data: ")) continue;
            try {
              var d = JSON.parse(line.slice(6));
              if (d.done) { hideTyping(); if (accumulated) messages.push({ role: "assistant", content: accumulated }); return; }
              if (d.error) { hideTyping(); appendBotMessage(d.error, false); return; }
              if (d.content) {
                if (!bubble) { hideTyping(); bubble = appendBotMessage("", false); }
                accumulated += d.content;
                bubble.textContent = accumulated;
                scrollBottom();
              }
            } catch(e) {}
          }
          return read();
        });
      }
      return read();
    }).catch(function (err) {
      hideTyping();
      var isAr = (document.documentElement.lang || "").startsWith("ar");
      appendBotMessage(isAr ? "\\u0639\\u0630\\u0631\\u0627\\u064B\\u060C \\u0635\\u0627\\u0631 \\u062E\\u0637\\u0623. \\u062D\\u0627\\u0648\\u0644 \\u0645\\u0631\\u0629 \\u062B\\u0627\\u0646\\u064A\\u0629! \\uD83D\\uDE4F" : "Sorry, something went wrong. Please try again! \\uD83D\\uDE4F", false);
      console.error("[Tamaiz Chat]", err);
    });
  }

  function init() {
    if (document.getElementById("dt-chat-btn")) return;
    injectStyles();
    buildDOM();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();`;

router.get("/chat-widget.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(WIDGET_JS);
});

export default router;
