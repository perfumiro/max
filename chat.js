/* ═══════════════════════════════════════════════════════════════════
   IPORDISE AI Assistant — Powered by Google Gemini
   ───────────────────────────────────────────────────────────────────
   SETUP: Replace 'YOUR_GEMINI_API_KEY' below with your free key.
   Get one at: https://aistudio.google.com/app/apikey  (100% free)
   To restrict the key to your domain only, visit Google Cloud Console
   → APIs & Services → Credentials → your key → Application restrictions
   → HTTP referrers → add: www.ipordise.com/*
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. CONFIG ──────────────────────────────────────────────── */
  var GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
  var MODEL          = 'gemini-1.5-flash';
  var API_URL        = 'https://generativelanguage.googleapis.com/v1beta/models/'
                     + MODEL + ':generateContent?key=' + GEMINI_API_KEY;

  var SYSTEM_PROMPT =
    'You are Yasmine, the friendly AI assistant for IPORDISE — a luxury perfume boutique in Tangier, Morocco.\n'
  + 'IPORDISE sells 40+ authentic niche, designer, and Arabian fragrances for men and women.\n'
  + '\n'
  + 'KEY STORE FACTS:\n'
  + '- Delivery: 35 MAD flat-rate anywhere in Morocco, Cash on Delivery (COD)\n'
  + '- WhatsApp: +212 664-318181 (orders & support)\n'
  + '- Website: www.ipordise.com | Physical store in Tangier\n'
  + '- Brands: Valentino, Azzaro, Jean Paul Gaultier, Armani, Xerjoff, and more\n'
  + '- Popular 2026 arrivals: Azzaro Forever Wanted Elixir, JPG Le Male In Blue, Armani Stronger With You Powerfully, Valentino Born in Roma Extradose\n'
  + '\n'
  + 'WHAT YOU HELP WITH:\n'
  + '- Fragrance recommendations (by season, occasion, personality, budget)\n'
  + '- Perfume education (notes, families, longevity, projection, layering)\n'
  + '- Order & delivery questions\n'
  + '- Product details and comparisons\n'
  + '- ANY other question the customer has — be helpful and knowledgeable on all topics\n'
  + '\n'
  + 'LANGUAGE RULES (CRITICAL):\n'
  + '- ALWAYS respond in the EXACT SAME language the customer writes in\n'
  + '- Arabic Darija (Moroccan dialect) → respond in Arabic Darija\n'
  + '- French → respond in French\n'
  + '- English → respond in English\n'
  + '- Standard Arabic → respond in Standard Arabic\n'
  + '- Any other language → match it perfectly\n'
  + '- Never switch languages unless the customer does first\n'
  + '\n'
  + 'TONE: Warm, concise, luxurious yet approachable. Keep answers brief and helpful.';

  /* ── 2. DETECT IF ALREADY INJECTED (multi-page safety) ─────── */
  if (document.getElementById('ipo-chat-widget')) return;

  /* ── 3. INJECT CSS ──────────────────────────────────────────── */
  var styleEl = document.createElement('style');
  styleEl.id  = 'ipo-chat-styles';
  styleEl.textContent = [
    /* === toggle button === */
    '#ipo-chat-btn{',
      'position:fixed;bottom:calc(70px + env(safe-area-inset-bottom,0px));right:1.1rem;',
      'width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;',
      'background:linear-gradient(135deg,#1a1a1a 60%,#333);',
      'box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 2px rgba(201,168,76,.35);',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:9999;transition:transform .18s,box-shadow .18s;',
      'outline:none;',
    '}',
    '#ipo-chat-btn:hover{transform:scale(1.08);box-shadow:0 10px 32px rgba(0,0,0,.55),0 0 0 3px rgba(201,168,76,.55);}',
    '#ipo-chat-btn svg{width:26px;height:26px;fill:none;stroke:#c9a84c;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}',
    /* notif dot */
    '#ipo-chat-dot{',
      'position:absolute;top:4px;right:4px;width:11px;height:11px;',
      'border-radius:50%;background:#e73c3c;border:2px solid #1a1a1a;',
      'animation:ipo-pulse 2s infinite;',
    '}',
    '@keyframes ipo-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}',
    /* === panel === */
    '#ipo-chat-widget{',
      'position:fixed;bottom:calc(140px + env(safe-area-inset-bottom,0px));right:1.1rem;',
      'width:min(370px,calc(100vw - 2rem));',
      'height:min(560px,calc(100vh - 160px));',
      'border-radius:1.2rem;overflow:hidden;',
      'background:#ffffff;',
      'box-shadow:0 20px 60px rgba(0,0,0,.3),0 0 0 1px rgba(201,168,76,.2);',
      'display:flex;flex-direction:column;',
      'z-index:9998;',
      'transform:scale(.92) translateY(16px);opacity:0;pointer-events:none;',
      'transition:transform .22s cubic-bezier(.34,1.56,.64,1),opacity .18s;',
      'transform-origin:bottom right;',
    '}',
    '#ipo-chat-widget.ipo-open{transform:scale(1) translateY(0);opacity:1;pointer-events:auto;}',
    /* header */
    '#ipo-chat-head{',
      'background:linear-gradient(135deg,#1a1a1a,#2d2d2d);',
      'padding:.85rem 1rem;display:flex;align-items:center;gap:.75rem;flex-shrink:0;',
    '}',
    '#ipo-chat-head-avatar{',
      'width:38px;height:38px;border-radius:50%;',
      'background:linear-gradient(135deg,#c9a84c,#e8c96a);',
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
      'font-size:1.1rem;',
    '}',
    '#ipo-chat-head-info{flex:1;min-width:0;}',
    '#ipo-chat-head-name{color:#fff;font-weight:600;font-size:.92rem;font-family:Playfair Display,serif;line-height:1.2;}',
    '#ipo-chat-head-sub{color:rgba(201,168,76,.85);font-size:.72rem;font-family:Inter,sans-serif;}',
    '#ipo-chat-close{',
      'width:30px;height:30px;border:none;background:rgba(255,255,255,.1);',
      'border-radius:50%;cursor:pointer;color:#fff;font-size:1rem;',
      'display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;',
    '}',
    '#ipo-chat-close:hover{background:rgba(255,255,255,.22);}',
    /* messages area */
    '#ipo-chat-msgs{',
      'flex:1;overflow-y:auto;padding:.9rem;display:flex;flex-direction:column;gap:.65rem;',
      'scroll-behavior:smooth;',
    '}',
    '#ipo-chat-msgs::-webkit-scrollbar{width:4px;}',
    '#ipo-chat-msgs::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}',
    /* bubbles */
    '.ipo-msg{max-width:85%;padding:.6rem .85rem;border-radius:1rem;font-size:.85rem;line-height:1.5;font-family:Inter,sans-serif;word-break:break-word;}',
    '.ipo-msg-bot{',
      'background:#f4f4f5;color:#1a1a1a;border-bottom-left-radius:.25rem;align-self:flex-start;',
    '}',
    '.ipo-msg-user{',
      'background:linear-gradient(135deg,#1a1a1a,#333);color:#fff;',
      'border-bottom-right-radius:.25rem;align-self:flex-end;',
    '}',
    '.ipo-msg-err{background:#fef2f2;color:#c0392b;border:1px solid #fecaca;}',
    /* typing indicator */
    '.ipo-typing{display:flex;align-items:center;gap:.35rem;padding:.55rem .85rem;background:#f4f4f5;border-radius:1rem;border-bottom-left-radius:.25rem;align-self:flex-start;width:fit-content;}',
    '.ipo-typing span{width:7px;height:7px;border-radius:50%;background:#1a1a1a;animation:ipo-dot .8s infinite ease-in-out;}',
    '.ipo-typing span:nth-child(1){animation-delay:0s}',
    '.ipo-typing span:nth-child(2){animation-delay:.15s}',
    '.ipo-typing span:nth-child(3){animation-delay:.3s}',
    '@keyframes ipo-dot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}',
    /* quick replies */
    '#ipo-quick{padding:.5rem .9rem .6rem;display:flex;gap:.45rem;flex-wrap:wrap;flex-shrink:0;border-top:1px solid #f0f0f0;background:#fafafa;}',
    '.ipo-qr{',
      'border:1.5px solid rgba(201,168,76,.5);background:#fff;color:#1a1a1a;',
      'border-radius:2rem;padding:.3rem .75rem;font-size:.75rem;cursor:pointer;',
      'font-family:Inter,sans-serif;transition:all .15s;white-space:nowrap;',
    '}',
    '.ipo-qr:hover{background:#1a1a1a;color:#c9a84c;border-color:#1a1a1a;}',
    /* input */
    '#ipo-chat-form{',
      'display:flex;align-items:center;gap:.5rem;padding:.7rem .75rem;',
      'border-top:1px solid #ececec;background:#fff;flex-shrink:0;',
      'padding-bottom:calc(.7rem + env(safe-area-inset-bottom,0px));',
    '}',
    '#ipo-chat-input{',
      'flex:1;border:1.5px solid #e5e7eb;border-radius:2rem;',
      'padding:.5rem .9rem;font-size:.85rem;font-family:Inter,sans-serif;',
      'outline:none;resize:none;line-height:1.4;max-height:80px;overflow-y:auto;',
      'transition:border-color .15s;',
    '}',
    '#ipo-chat-input:focus{border-color:#c9a84c;}',
    '#ipo-chat-send{',
      'width:38px;height:38px;border-radius:50%;border:none;flex-shrink:0;',
      'background:linear-gradient(135deg,#1a1a1a,#333);color:#c9a84c;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'transition:transform .15s,opacity .15s;',
    '}',
    '#ipo-chat-send:hover{transform:scale(1.1);}',
    '#ipo-chat-send:disabled{opacity:.4;cursor:default;transform:none;}',
    '#ipo-chat-send svg{width:16px;height:16px;fill:currentColor;}',
    /* setup banner shown when no key */
    '#ipo-setup{padding:1rem;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:.78rem;font-family:Inter,sans-serif;color:#92400e;line-height:1.5;}',
    '#ipo-setup a{color:#c9a84c;font-weight:600;}',
    /* desktop positioning */
    '@media(min-width:640px){',
      '#ipo-chat-btn{bottom:2rem;}',
      '#ipo-chat-widget{bottom:5.5rem;}',
    '}',
  ].join('');
  document.head.appendChild(styleEl);

  /* ── 4. BUILD DOM ───────────────────────────────────────────── */
  var btn = document.createElement('button');
  btn.id = 'ipo-chat-btn';
  btn.setAttribute('aria-label', 'Open AI Chat');
  btn.innerHTML = '<div id="ipo-chat-dot"></div>'
    + '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
    + '<circle cx="9" cy="10" r="1" fill="#c9a84c" stroke="none"/>'
    + '<circle cx="12" cy="10" r="1" fill="#c9a84c" stroke="none"/>'
    + '<circle cx="15" cy="10" r="1" fill="#c9a84c" stroke="none"/>'
    + '</svg>';

  var panel = document.createElement('div');
  panel.id = 'ipo-chat-widget';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'IPORDISE AI Chat');

  var noKey = (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY');

  panel.innerHTML = ''
    + '<div id="ipo-chat-head">'
    +   '<div id="ipo-chat-head-avatar">✨</div>'
    +   '<div id="ipo-chat-head-info">'
    +     '<div id="ipo-chat-head-name">Yasmine — IPORDISE AI</div>'
    +     '<div id="ipo-chat-head-sub">Ask me anything • أي سؤال • Posez-moi</div>'
    +   '</div>'
    +   '<button id="ipo-chat-close" aria-label="Close chat">✕</button>'
    + '</div>'
    + (noKey
      ? '<div id="ipo-setup">⚙️ <strong>Setup needed:</strong> Add your free Gemini API key in <code>chat.js</code> line 16. '
        + 'Get one free at <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a></div>'
      : '')
    + '<div id="ipo-chat-msgs"></div>'
    + '<div id="ipo-quick">'
    +   '<button class="ipo-qr" data-q="Recommend a perfume for men">🎁 For him</button>'
    +   '<button class="ipo-qr" data-q="Recommend a perfume for women">🌸 For her</button>'
    +   '<button class="ipo-qr" data-q="كيفاش نطلب؟">📦 كيفاش نطلب؟</button>'
    +   '<button class="ipo-qr" data-q="Comment passer une commande?">🇫🇷 Commander</button>'
    +   '<button class="ipo-qr" data-q="What is the delivery price?">🚚 Delivery</button>'
    + '</div>'
    + '<form id="ipo-chat-form" autocomplete="off">'
    +   '<textarea id="ipo-chat-input" rows="1" placeholder="Ask anything... / أي سؤال... / Posez..." aria-label="Message"></textarea>'
    +   '<button id="ipo-chat-send" type="submit" aria-label="Send">'
    +     '<svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    +   '</button>'
    + '</form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  /* ── 5. STATE ───────────────────────────────────────────────── */
  var history  = []; // [{role:'user'|'model', parts:[{text:'...'}]}]
  var isOpen   = false;
  var isLoading= false;
  var greeted  = false;

  var msgsEl  = document.getElementById('ipo-chat-msgs');
  var inputEl = document.getElementById('ipo-chat-input');
  var sendBtn = document.getElementById('ipo-chat-send');

  /* ── 6. HELPERS ─────────────────────────────────────────────── */
  function addBubble(text, role, extra) {
    var div = document.createElement('div');
    div.className = 'ipo-msg ipo-msg-' + (role === 'user' ? 'user' : (extra === 'err' ? 'err' : 'bot'));
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return div;
  }

  function showTyping() {
    var d = document.createElement('div');
    d.className = 'ipo-typing';
    d.id = 'ipo-typing-ind';
    d.innerHTML = '<span></span><span></span><span></span>';
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function hideTyping() {
    var d = document.getElementById('ipo-typing-ind');
    if (d) d.remove();
  }

  function setLoading(v) {
    isLoading = v;
    sendBtn.disabled = v;
    inputEl.disabled = v;
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    var lang = (navigator.language || 'en').toLowerCase();
    var msg;
    if (lang.startsWith('ar'))      msg = 'السلام عليكم! 👋 أنا ياسمين، المساعدة الذكية ديال IPORDISE. فاش نقدر نعاونك؟';
    else if (lang.startsWith('fr')) msg = 'Bonjour ! 👋 Je suis Yasmine, l\'assistante IA d\'IPORDISE. Comment puis-je vous aider ?';
    else                            msg = 'Welcome to IPORDISE! 👋 I\'m Yasmine, your AI fragrance assistant. How can I help you today?';
    addBubble(msg, 'bot');
  }

  /* ── 7. API CALL ────────────────────────────────────────────── */
  function sendMessage(userText) {
    if (!userText.trim() || isLoading) return;

    // hide quick replies after first message
    var quick = document.getElementById('ipo-quick');
    if (quick) quick.style.display = 'none';

    addBubble(userText, 'user');
    history.push({ role: 'user', parts: [{ text: userText }] });

    setLoading(true);
    showTyping();

    var body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history,
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 512,
        topP: 0.9
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    };

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      hideTyping();
      setLoading(false);

      if (data.error) {
        var errMsg = data.error.message || 'API error.';
        if (errMsg.toLowerCase().indexOf('api key') !== -1) {
          addBubble('⚙️ API key issue. Please check the key in chat.js.', 'bot', 'err');
        } else {
          addBubble('⚠️ ' + errMsg, 'bot', 'err');
        }
        history.pop();
        return;
      }

      var reply = '';
      try {
        reply = data.candidates[0].content.parts[0].text;
      } catch (e) {
        reply = 'Sorry, I couldn\'t generate a response. Please try again.';
      }

      history.push({ role: 'model', parts: [{ text: reply }] });
      addBubble(reply, 'bot');
    })
    .catch(function(err) {
      hideTyping();
      setLoading(false);
      history.pop();
      addBubble('❌ Network error. Please check your connection.', 'bot', 'err');
    });
  }

  /* ── 8. EVENTS ──────────────────────────────────────────────── */
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('ipo-open', isOpen);
    // hide notification dot after first open
    var dot = document.getElementById('ipo-chat-dot');
    if (dot) dot.style.display = 'none';
    if (isOpen) {
      greet();
      setTimeout(function() { inputEl.focus(); }, 220);
    }
  });

  document.getElementById('ipo-chat-close').addEventListener('click', function() {
    isOpen = false;
    panel.classList.remove('ipo-open');
    btn.focus();
  });

  document.getElementById('ipo-chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var txt = inputEl.value.trim();
    if (!txt) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendMessage(txt);
  });

  // auto-grow textarea
  inputEl.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  // Enter to send, Shift+Enter for newline
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('ipo-chat-form').dispatchEvent(new Event('submit'));
    }
  });

  // quick reply buttons
  document.getElementById('ipo-quick').addEventListener('click', function(e) {
    var qr = e.target.closest('.ipo-qr');
    if (qr) sendMessage(qr.getAttribute('data-q'));
  });

  // close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      panel.classList.remove('ipo-open');
      btn.focus();
    }
  });

})();
