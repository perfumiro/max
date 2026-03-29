/* ═══════════════════════════════════════════════════════════════════
   IPORDISE AI Assistant — Yasmine  |  Powered by Google Gemini 2.0
   ───────────────────────────────────────────────────────────────────
   API KEY SECURITY (important for production):
   1. Go to https://console.cloud.google.com
   2. APIs & Services → Credentials → your key
   3. Application restrictions → HTTP referrers
   4. Add:  www.ipordise.com/*  and  ipordise.com/*
   This ensures your key ONLY works on your domain.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════
     CONFIG
  ═══════════════════════════════════════════════════════════════ */
  var CFG = {
    apiKey  : 'AIzaSyB3Ziukucy6Su21T8DPRTjr5qZFDzgrhV8',
    /* Model fallback chain — tries each in order until one works */
    models  : [
      'gemini-2.0-flash-lite',   // fastest, lightest rate limits
      'gemini-2.0-flash',        // standard
      'gemini-1.5-flash-latest', // reliable fallback
      'gemini-1.5-flash-8b'      // last resort — very low quota usage
    ],
    apiBase : 'https://generativelanguage.googleapis.com/v1beta/models/',
    maxTokens   : 512,
    temperature : 0.75,
    historyLimit: 16
  };

  /* Track which model index is currently working */
  var _modelIndex = 0;
  function getApiUrl() {
    return CFG.apiBase + CFG.models[_modelIndex] + ':generateContent?key=' + CFG.apiKey;
  }

  /* ═══════════════════════════════════════════════════════════════
     PRODUCT CATALOG  (used for smart recommendations)
  ═══════════════════════════════════════════════════════════════ */
  var CATALOG = {
    men: [
      { name: 'Azzaro Forever Wanted Elixir',          style: 'Intense & Woody',   notes: 'Bergamot, Sandalwood, Musk',       url: 'pages/product.html?id=azzaro-forever-wanted-elixir' },
      { name: 'JPG Le Male In Blue',                   style: 'Fresh & Marine',    notes: 'Citrus, Lavender, Sea Salt',       url: 'pages/product.html?id=jpg-le-male-in-blue' },
      { name: 'Armani Stronger With You Powerfully',   style: 'Warm & Spicy',      notes: 'Cardamom, Vanilla, Tonka Bean',    url: 'pages/product.html?id=armani-stronger-with-you-powerfully' },
      { name: 'Xerjoff Naxos',                         style: 'Sweet & Luxurious', notes: 'Lavender, Honey, Tobacco, Vanilla',url: 'pages/product.html?id=xerjoff-naxos' }
    ],
    women: [
      { name: 'Valentino Born in Roma Extradose',      style: 'Floral & Sensual',  notes: 'Jasmine, Vanilla, Musk',           url: 'pages/product.html?id=valentino-born-in-roma-extradose' },
      { name: 'Valentino Donna Born in Roma Intense',  style: 'Warm & Feminine',   notes: 'Jasmine, Vanilla, Orris Root',     url: 'pages/product.html?id=valentino-donna-born-in-roma-intense' },
      { name: 'Azzaro Wanted Girl Tonic',              style: 'Fresh & Floral',    notes: 'Peach, Freesia, White Musk',       url: 'pages/product.html?id=azzaro-wanted-girl-tonic' }
    ]
  };

  /* ═══════════════════════════════════════════════════════════════
     SYSTEM PROMPT
  ═══════════════════════════════════════════════════════════════ */
  var SYSTEM_PROMPT = [
    'You are Yasmine, the friendly AI assistant for IPORDISE — a luxury perfume boutique in Tangier, Morocco.',
    'IPORDISE sells 40+ authentic niche, designer, and Arabian fragrances for men and women.',
    '',
    'KEY STORE FACTS:',
    '- Delivery: 35 MAD flat-rate anywhere in Morocco, Cash on Delivery (COD)',
    '- WhatsApp orders: +212 664-318181',
    '- Website: www.ipordise.com | Physical store in Tangier',
    '- Brands: Valentino, Azzaro, Jean Paul Gaultier, Armani, Xerjoff, Xerjoff Naxos, and more',
    '- Top 2026 arrivals for men: Azzaro Forever Wanted Elixir, JPG Le Male In Blue, Armani Stronger With You Powerfully',
    '- Top picks for women: Valentino Born in Roma Extradose, Valentino Donna Born in Roma Intense',
    '',
    'WHEN RECOMMENDING PERFUMES:',
    '- Give 2-3 specific product names from the IPORDISE catalog',
    '- Mention the scent style (fresh, woody, floral, sweet, oriental, etc.)',
    '- Mention 2-3 key notes',
    '- Keep it concise — 3-5 lines per recommendation',
    '- Always end with: "Order on WhatsApp +212 664-318181 or visit www.ipordise.com"',
    '',
    'LANGUAGE RULES (CRITICAL — follow exactly):',
    '- Detect the language of EACH user message',
    '- Arabic Darija (Moroccan): respond fully in Darija (mix of Arabic/French words as spoken in Morocco)',
    '- Standard Arabic: respond in Standard Arabic',
    '- French: respond entirely in French',
    '- English: respond entirely in English',
    '- Any other language: match it exactly',
    '- NEVER mix languages or switch unless the user switches first',
    '',
    'TONE: Warm, knowledgeable, luxurious yet approachable. Be concise. Max ~120 words per reply.',
    'You can answer ANY question, not just perfume — be genuinely helpful.'
  ].join('\n');

  /* ═══════════════════════════════════════════════════════════════
     GUARD: prevent double-injection on page navigate
  ═══════════════════════════════════════════════════════════════ */
  if (document.getElementById('ipo-chat-widget')) return;

  /* ═══════════════════════════════════════════════════════════════
     CSS — injected as a single <style> tag
  ═══════════════════════════════════════════════════════════════ */
  var CSS = '\
#ipo-chat-btn{\
  position:fixed;bottom:calc(72px + env(safe-area-inset-bottom,0px));right:1.1rem;\
  width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;\
  background:linear-gradient(145deg,#222 40%,#3a3a3a);\
  box-shadow:0 6px 24px rgba(0,0,0,.5),0 0 0 2.5px rgba(201,168,76,.4);\
  display:flex;align-items:center;justify-content:center;\
  z-index:10001;transition:transform .18s ease,box-shadow .18s ease;\
  -webkit-tap-highlight-color:transparent;\
}\
#ipo-chat-btn:hover,#ipo-chat-btn:focus-visible{\
  transform:scale(1.09);\
  box-shadow:0 10px 32px rgba(0,0,0,.55),0 0 0 3px rgba(201,168,76,.6);\
}\
#ipo-chat-btn:focus-visible{outline:3px solid #c9a84c;outline-offset:3px;}\
#ipo-chat-btn svg{width:25px;height:25px;fill:none;stroke:#c9a84c;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}\
#ipo-chat-dot{\
  position:absolute;top:3px;right:3px;width:12px;height:12px;\
  border-radius:50%;background:#e73c3c;border:2px solid #222;\
  animation:ipo-pulse 2.2s ease-in-out infinite;\
}\
@keyframes ipo-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.65}}\
\
#ipo-chat-widget{\
  position:fixed;\
  bottom:calc(142px + env(safe-area-inset-bottom,0px));\
  right:1.1rem;\
  width:min(376px,calc(100vw - 1.8rem));\
  height:min(570px,calc(100dvh - 160px));\
  border-radius:1.25rem;overflow:hidden;\
  background:#fff;\
  box-shadow:0 24px 64px rgba(0,0,0,.28),0 0 0 1px rgba(201,168,76,.18);\
  display:flex;flex-direction:column;\
  z-index:10000;\
  transform:scale(.9) translateY(20px);opacity:0;pointer-events:none;\
  transition:transform .24s cubic-bezier(.34,1.56,.64,1),opacity .2s ease;\
  transform-origin:bottom right;\
  will-change:transform,opacity;\
}\
#ipo-chat-widget.ipo-open{\
  transform:scale(1) translateY(0);opacity:1;pointer-events:auto;\
}\
\
#ipo-chat-head{\
  background:linear-gradient(135deg,#1a1a1a 0%,#2e2e2e 100%);\
  padding:.8rem 1rem;display:flex;align-items:center;gap:.7rem;flex-shrink:0;\
  border-bottom:1px solid rgba(201,168,76,.15);\
}\
#ipo-avatar{\
  width:40px;height:40px;border-radius:50%;flex-shrink:0;\
  background:linear-gradient(135deg,#c9a84c,#e8cc6a);\
  display:flex;align-items:center;justify-content:center;\
  font-size:1.15rem;box-shadow:0 2px 8px rgba(201,168,76,.35);\
}\
#ipo-head-info{flex:1;min-width:0;}\
#ipo-head-name{color:#fff;font-weight:700;font-size:.9rem;font-family:"Playfair Display",Georgia,serif;letter-spacing:.01em;}\
#ipo-head-status{\
  color:rgba(201,168,76,.8);font-size:.7rem;font-family:Inter,system-ui,sans-serif;\
  display:flex;align-items:center;gap:.3rem;\
}\
#ipo-status-dot{\
  width:6px;height:6px;border-radius:50%;background:#4ade80;\
  animation:ipo-status-blink 2.5s ease-in-out infinite;\
}\
@keyframes ipo-status-blink{0%,100%{opacity:1}50%{opacity:.35}}\
#ipo-chat-close{\
  width:30px;height:30px;border:none;cursor:pointer;color:rgba(255,255,255,.7);\
  background:rgba(255,255,255,.08);border-radius:50%;\
  font-size:.95rem;display:flex;align-items:center;justify-content:center;\
  transition:background .15s,color .15s;flex-shrink:0;line-height:1;\
}\
#ipo-chat-close:hover{background:rgba(255,255,255,.18);color:#fff;}\
\
#ipo-chat-msgs{\
  flex:1;overflow-y:auto;overflow-x:hidden;\
  padding:.85rem .85rem 0;\
  display:flex;flex-direction:column;gap:.6rem;\
  scroll-behavior:smooth;\
  overscroll-behavior:contain;\
}\
#ipo-chat-msgs::-webkit-scrollbar{width:3px;}\
#ipo-chat-msgs::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px;}\
\
.ipo-msg-row{display:flex;flex-direction:column;}\
.ipo-msg-row.ipo-row-user{align-items:flex-end;}\
.ipo-msg-row.ipo-row-bot{align-items:flex-start;}\
.ipo-msg{\
  max-width:88%;\
  padding:.6rem .88rem;\
  border-radius:1.1rem;\
  font-size:.84rem;line-height:1.55;\
  font-family:Inter,system-ui,sans-serif;\
  word-break:break-word;\
  white-space:pre-line;\
  animation:ipo-fade-in .2s ease;\
}\
@keyframes ipo-fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}\
.ipo-msg-bot{\
  background:#f3f4f6;color:#1a1a1a;\
  border-bottom-left-radius:.25rem;\
  box-shadow:0 1px 4px rgba(0,0,0,.05);\
}\
.ipo-msg-user{\
  background:linear-gradient(135deg,#1e1e1e,#333);\
  color:#fff;border-bottom-right-radius:.25rem;\
  box-shadow:0 2px 8px rgba(0,0,0,.18);\
}\
.ipo-msg-err{\
  background:#fef2f2;color:#b91c1c;\
  border:1px solid #fca5a5;border-radius:.8rem;\
  font-size:.8rem;\
}\
.ipo-timestamp{\
  font-size:.66rem;color:#9ca3af;\
  margin-top:.2rem;padding:0 .2rem;\
  font-family:Inter,system-ui,sans-serif;\
}\
.ipo-row-user .ipo-timestamp{text-align:right;}\
\
.ipo-typing-row{display:flex;align-items:flex-start;gap:.5rem;padding-bottom:.1rem;}\
.ipo-typing-bubble{\
  background:#f3f4f6;border-radius:1.1rem;border-bottom-left-radius:.25rem;\
  padding:.6rem .88rem;\
  display:flex;align-items:center;gap:5px;\
  box-shadow:0 1px 4px rgba(0,0,0,.05);\
}\
.ipo-typing-label{\
  font-size:.75rem;color:#6b7280;\
  font-family:Inter,system-ui,sans-serif;\
  margin-right:.25rem;\
}\
.ipo-typing-bubble span{\
  width:6px;height:6px;border-radius:50%;\
  background:#9ca3af;\
  display:inline-block;\
  animation:ipo-bounce .9s ease-in-out infinite;\
}\
.ipo-typing-bubble span:nth-child(2){animation-delay:.18s;background:#c9a84c;}\
.ipo-typing-bubble span:nth-child(3){animation-delay:.36s;}\
@keyframes ipo-bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}}\
\
#ipo-quick{\
  padding:.55rem .85rem .55rem;\
  display:flex;gap:.4rem;flex-wrap:nowrap;\
  overflow-x:auto;flex-shrink:0;\
  border-top:1px solid #f0f0f0;\
  background:#fafafa;\
  -ms-overflow-style:none;scrollbar-width:none;\
}\
#ipo-quick::-webkit-scrollbar{display:none;}\
.ipo-qr{\
  border:1.5px solid rgba(201,168,76,.45);\
  background:#fff;color:#1a1a1a;\
  border-radius:2rem;padding:.3rem .78rem;\
  font-size:.74rem;cursor:pointer;\
  font-family:Inter,system-ui,sans-serif;\
  transition:all .14s ease;\
  white-space:nowrap;flex-shrink:0;\
  line-height:1.4;\
}\
.ipo-qr:hover,.ipo-qr:focus-visible{background:#1a1a1a;color:#c9a84c;border-color:#1a1a1a;outline:none;}\
\
#ipo-chat-form{\
  display:flex;align-items:flex-end;gap:.5rem;\
  padding:.65rem .75rem;\
  padding-bottom:calc(.65rem + env(safe-area-inset-bottom,0px));\
  border-top:1px solid #ececec;background:#fff;flex-shrink:0;\
}\
#ipo-chat-input{\
  flex:1;border:1.5px solid #e5e7eb;border-radius:1.1rem;\
  padding:.5rem .9rem;font-size:.85rem;\
  font-family:Inter,system-ui,sans-serif;\
  outline:none;resize:none;line-height:1.45;\
  max-height:90px;overflow-y:auto;\
  transition:border-color .15s ease;\
  color:#1a1a1a;background:#fff;\
}\
#ipo-chat-input:focus{border-color:#c9a84c;}\
#ipo-chat-input::placeholder{color:#9ca3af;}\
#ipo-chat-send{\
  width:38px;height:38px;min-width:38px;\
  border-radius:50%;border:none;flex-shrink:0;\
  background:linear-gradient(135deg,#1a1a1a,#333);\
  color:#c9a84c;cursor:pointer;\
  display:flex;align-items:center;justify-content:center;\
  transition:transform .15s ease,opacity .15s ease;\
  -webkit-tap-highlight-color:transparent;\
}\
#ipo-chat-send:hover:not(:disabled){transform:scale(1.1);}\
#ipo-chat-send:disabled{opacity:.38;cursor:default;transform:none;}\
#ipo-chat-send svg{width:15px;height:15px;fill:currentColor;pointer-events:none;}\
\
@media(min-width:640px){\
  #ipo-chat-btn{bottom:2rem;right:2rem;}\
  #ipo-chat-widget{bottom:5.6rem;right:2rem;}\
}\
@media(max-width:400px){\
  #ipo-chat-widget{width:calc(100vw - 1.2rem);right:.6rem;}\
  #ipo-chat-btn{right:.8rem;}\
}';

  var styleEl    = document.createElement('style');
  styleEl.id     = 'ipo-chat-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ═══════════════════════════════════════════════════════════════
     BUILD HTML SKELETON
  ═══════════════════════════════════════════════════════════════ */
  var btn = document.createElement('button');
  btn.id = 'ipo-chat-btn';
  btn.setAttribute('aria-label', 'Open AI Chat — Yasmine');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML =
    '<div id="ipo-chat-dot"></div>' +
    '<svg viewBox="0 0 24 24">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '<circle cx="8.5"  cy="10" r="1.1" fill="#c9a84c" stroke="none"/>' +
      '<circle cx="12"   cy="10" r="1.1" fill="#c9a84c" stroke="none"/>' +
      '<circle cx="15.5" cy="10" r="1.1" fill="#c9a84c" stroke="none"/>' +
    '</svg>';

  var panel = document.createElement('div');
  panel.id = 'ipo-chat-widget';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'IPORDISE AI Chat Assistant');

  panel.innerHTML =
    '<div id="ipo-chat-head">' +
      '<div id="ipo-avatar" aria-hidden="true">✨</div>' +
      '<div id="ipo-head-info">' +
        '<div id="ipo-head-name">Yasmine — IPORDISE AI</div>' +
        '<div id="ipo-head-status">' +
          '<div id="ipo-status-dot"></div>' +
          '<span id="ipo-status-text">Online — Ask me anything</span>' +
        '</div>' +
      '</div>' +
      '<button id="ipo-chat-close" aria-label="Close chat" title="Close">✕</button>' +
    '</div>' +
    '<div id="ipo-chat-msgs" aria-live="polite" aria-relevant="additions"></div>' +
    '<div id="ipo-quick" aria-label="Quick suggestions">' +
      '<button class="ipo-qr" data-q="Recommend a perfume for men">🎁 For him</button>' +
      '<button class="ipo-qr" data-q="Recommend a perfume for women">🌸 For her</button>' +
      '<button class="ipo-qr" data-q="كيفاش نطلب البارفان؟">📦 كيفاش نطلب؟</button>' +
      '<button class="ipo-qr" data-q="Comment commander?">🇫🇷 Commander</button>' +
      '<button class="ipo-qr" data-q="Quel est le prix de livraison?">🚚 Livraison</button>' +
    '</div>' +
    '<form id="ipo-chat-form" autocomplete="off" novalidate>' +
      '<textarea id="ipo-chat-input" rows="1"' +
        ' placeholder="Ask anything... / أي سؤال... / Posez..."' +
        ' aria-label="Type your message">' +
      '</textarea>' +
      '<button id="ipo-chat-send" type="submit" aria-label="Send message">' +
        '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 19-7z"/></svg>' +
      '</button>' +
    '</form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  /* ═══════════════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════════════ */
  var state = {
    isOpen   : false,
    isLoading: false,
    greeted  : false,
    quickHidden: false,
    history  : []   // Gemini format: [{role, parts:[{text}]}]
  };

  /* DOM refs */
  var msgsEl     = document.getElementById('ipo-chat-msgs');
  var inputEl    = document.getElementById('ipo-chat-input');
  var sendBtn    = document.getElementById('ipo-chat-send');
  var statusText = document.getElementById('ipo-status-text');
  var quickEl    = document.getElementById('ipo-quick');

  /* ═══════════════════════════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════════════════════════ */

  /* Format time HH:MM */
  function getTime() {
    var d = new Date();
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  /* Smooth-scroll messages to bottom */
  function scrollToBottom() {
    msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: 'smooth' });
  }

  /* Add a message bubble */
  function addBubble(text, role, isErr) {
    var row  = document.createElement('div');
    row.className = 'ipo-msg-row ' + (role === 'user' ? 'ipo-row-user' : 'ipo-row-bot');

    var bubble = document.createElement('div');
    bubble.className = 'ipo-msg ' + (role === 'user' ? 'ipo-msg-user' : (isErr ? 'ipo-msg-err' : 'ipo-msg-bot'));
    bubble.textContent = text;

    var ts = document.createElement('div');
    ts.className = 'ipo-timestamp';
    ts.textContent = getTime();

    row.appendChild(bubble);
    row.appendChild(ts);
    msgsEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  /* Typing indicator */
  function showTyping() {
    removeTyping();
    var row = document.createElement('div');
    row.className = 'ipo-typing-row';
    row.id = 'ipo-typing-row';
    row.innerHTML =
      '<div class="ipo-typing-bubble">' +
        '<span class="ipo-typing-label">Yasmine</span>' +
        '<span></span><span></span><span></span>' +
      '</div>';
    msgsEl.appendChild(row);
    scrollToBottom();
    if (statusText) statusText.textContent = 'Yasmine is typing…';
  }

  function removeTyping() {
    var el = document.getElementById('ipo-typing-row');
    if (el) el.remove();
    if (statusText) statusText.textContent = 'Online — Ask me anything';
  }

  /* Lock / unlock UI while waiting */
  function setLoading(v) {
    state.isLoading   = v;
    sendBtn.disabled  = v;
    inputEl.disabled  = v;
    if (v) inputEl.setAttribute('aria-busy', 'true');
    else   inputEl.removeAttribute('aria-busy');
  }

  /* Hide quick replies (once first message is sent) */
  function hideQuick() {
    if (state.quickHidden) return;
    state.quickHidden = true;
    quickEl.style.transition = 'opacity .2s ease, max-height .3s ease';
    quickEl.style.opacity    = '0';
    quickEl.style.maxHeight  = '0';
    quickEl.style.padding    = '0';
    quickEl.style.overflow   = 'hidden';
  }

  /* Trim history to avoid very long payloads */
  function getTrimmedHistory() {
    var h = state.history;
    if (h.length > CFG.historyLimit) {
      h = h.slice(h.length - CFG.historyLimit);
    }
    return h;
  }

  /* ═══════════════════════════════════════════════════════════════
     GREETING  (language-aware)
  ═══════════════════════════════════════════════════════════════ */
  function greet() {
    if (state.greeted) return;
    state.greeted = true;
    var lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var msg;
    if (lang.startsWith('ar'))
      msg = 'السلام عليكم! ✨ أنا ياسمين، المساعدة ديال IPORDISE. فاش نقدر نعاونك اليوم؟';
    else if (lang.startsWith('fr'))
      msg = 'Bonjour ! ✨ Je suis Yasmine, l\'assistante IA de IPORDISE. Comment puis-je vous aider ?';
    else
      msg = 'Welcome to IPORDISE! ✨ I\'m Yasmine, your AI fragrance guide. How can I help you today?';
    addBubble(msg, 'bot');
  }

  /* ═══════════════════════════════════════════════════════════════
     SMART RECOMMENDATION  (client-side fast path, no API call)
  ═══════════════════════════════════════════════════════════════ */
  var REC_TRIGGERS = {
    men :   /\b(men|man|him|homme|رجال|رجل|ذكر|ولد|son|frère|boys?)\b/i,
    women : /\b(women|woman|her|femme|نساء|مرأة|بنت|fille?|sœur|girls?)\b/i
  };

  function buildRecommendationText(gender) {
    var products = CATALOG[gender].slice(0, 3);
    var lines = ['✨ Here are my top picks:\n'];
    products.forEach(function(p, i) {
      lines.push((i + 1) + '. ' + p.name);
      lines.push('   Style: ' + p.style);
      lines.push('   Notes: ' + p.notes);
      lines.push('');
    });
    lines.push('👉 Order on WhatsApp: +212 664-318181 or shop at www.ipordise.com');
    return lines.join('\n');
  }

  /* Returns a local recommendation string if message clearly asks for one, else null */
  function tryLocalRecommendation(text) {
    var lower = text.toLowerCase();
    var isRecommendRequest = /\b(recommend|suggestion|suggest|best|top|good|nice|popular|نصيح|قترح|recommande|meilleur|parfum|perfume|fragrance)\b/i.test(text);
    if (!isRecommendRequest) return null;
    if (REC_TRIGGERS.men.test(text))   return buildRecommendationText('men');
    if (REC_TRIGGERS.women.test(text)) return buildRecommendationText('women');
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════
     API CALL  — Gemini 2.0 Flash
  ═══════════════════════════════════════════════════════════════ */
  /* One request at a time — queue if another is already in flight */
  var _requestInFlight = false;
  var _requestQueue    = [];

  function drainQueue() {
    if (_requestInFlight || _requestQueue.length === 0) return;
    var next = _requestQueue.shift();
    next();
  }

  function callGemini(userText, callback) {
    /* Enqueue if busy */
    if (_requestInFlight) {
      _requestQueue.push(function() { callGemini(userText, callback); });
      return;
    }
    _requestInFlight = true;

    var payload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: getTrimmedHistory(),
      generationConfig: {
        temperature    : CFG.temperature,
        maxOutputTokens: CFG.maxTokens,
        topP           : 0.92,
        candidateCount : 1
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    };

    /* Retry with backoff, then try next model in fallback chain */
    var MAX_RETRIES   = 2;  // retries per model
    var retryCount    = 0;
    var retryDelays   = [1500, 4000]; // ms between retries

    function attempt() {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId  = setTimeout(function() {
        if (controller) controller.abort();
      }, 22000);

      fetch(getApiUrl(), {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
        signal : controller ? controller.signal : undefined
      })
      .then(function(res) {
        clearTimeout(timeoutId);

        /* 429 rate-limit — retry or try next model */
        if (res.status === 429) {
          if (retryCount < MAX_RETRIES) {
            var delay = retryDelays[retryCount] || 5000;
            retryCount++;
            setTimeout(attempt, delay);
            return;
          }
          /* All retries for this model exhausted — try next model */
          if (_modelIndex < CFG.models.length - 1) {
            _modelIndex++;
            retryCount = 0;
            setTimeout(attempt, 800);
            return;
          }
          /* All models exhausted */
          done(new Error('quota'), null);
          return;
        }

        if (!res.ok) {
          return res.json().then(function(d) {
            done(new Error(d.error ? d.error.message : 'HTTP ' + res.status), null);
          })['catch'](function() {
            done(new Error('HTTP ' + res.status), null);
          });
        }
        return res.json();
      })
      .then(function(data) {
        if (!data) return; // already handled above
        var reply = '';
        try { reply = data.candidates[0].content.parts[0].text.trim(); }
        catch(e) { done(new Error('parse'), null); return; }
        if (!reply) { done(new Error('empty'), null); return; }
        done(null, reply);
      })
      ['catch'](function(err) {
        clearTimeout(timeoutId);
        /* Network / abort error — retry once */
        if (retryCount < 1) {
          retryCount++;
          setTimeout(attempt, 2000);
          return;
        }
        done(err, null);
      });
    }

    function done(err, reply) {
      _requestInFlight = false;
      setTimeout(drainQueue, 200);
      callback(err, reply);
    }

    attempt();
  }

  /* ═══════════════════════════════════════════════════════════════
     SEND MESSAGE  (main entry point)
  ═══════════════════════════════════════════════════════════════ */
  function sendMessage(userText) {
    userText = (userText || '').trim();
    if (!userText || state.isLoading) return;

    hideQuick();
    addBubble(userText, 'user');
    state.history.push({ role: 'user', parts: [{ text: userText }] });
    setLoading(true);
    showTyping();

    /* 1. Try fast local recommendation before hitting the API */
    var localReply = tryLocalRecommendation(userText);
    if (localReply) {
      setTimeout(function() {
        removeTyping();
        setLoading(false);
        state.history.push({ role: 'model', parts: [{ text: localReply }] });
        addBubble(localReply, 'bot');
      }, 420);
      return;
    }

    /* 2. Call Gemini API */
    callGemini(userText, function(err, reply) {
      removeTyping();
      setLoading(false);

      if (err) {
        state.history.pop(); // remove failed user message from history
        var friendlyMsg = getFriendlyError(err.message || '');
        addBubble(friendlyMsg, 'bot', true);
        return;
      }

      state.history.push({ role: 'model', parts: [{ text: reply }] });
      addBubble(reply, 'bot');
    });
  }

  /* Map known API errors to friendly messages */
  function getFriendlyError(msg) {
    var m = (msg || '').toLowerCase();
    if (m === 'quota' || m.indexOf('quota') !== -1 || m.indexOf('429') !== -1 || m.indexOf('resource') !== -1)
      return '🙏 Sorry, I\'m a bit busy right now. Please send your message again in a few seconds — I\'ll be right with you!';
    if (m === 'parse' || m === 'empty')
      return '🤔 I didn\'t quite get a response. Please try again!';
    if (m.indexOf('api key') !== -1 || m.indexOf('api_key') !== -1)
      return '⚙️ There\'s a configuration issue. Please contact IPORDISE on WhatsApp: +212 664-318181';
    if (m.indexOf('abort') !== -1 || m.indexOf('timeout') !== -1)
      return '⏱️ The response took too long. Please check your connection and try again.';
    if (m.indexOf('not found') !== -1 || m.indexOf('404') !== -1)
      return '⚠️ AI service temporarily unavailable. Contact us on WhatsApp: +212 664-318181';
    if (m.indexOf('network') !== -1 || m.indexOf('fetch') !== -1)
      return '📶 Network error. Please check your internet connection.';
    return '❌ Something went wrong. Please try again or reach us on WhatsApp: +212 664-318181';
  }

  /* ═══════════════════════════════════════════════════════════════
     EVENTS
  ═══════════════════════════════════════════════════════════════ */

  /* Toggle panel */
  btn.addEventListener('click', function() {
    state.isOpen = !state.isOpen;
    panel.classList.toggle('ipo-open', state.isOpen);
    btn.setAttribute('aria-expanded', String(state.isOpen));

    var dot = document.getElementById('ipo-chat-dot');
    if (dot) dot.style.display = 'none';

    if (state.isOpen) {
      greet();
      requestAnimationFrame(function() {
        setTimeout(function() { inputEl.focus(); }, 240);
      });
    }
  });

  /* Close button */
  document.getElementById('ipo-chat-close').addEventListener('click', function() {
    state.isOpen = false;
    panel.classList.remove('ipo-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  });

  /* Form submit */
  document.getElementById('ipo-chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var txt = inputEl.value.trim();
    if (!txt) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendMessage(txt);
  });

  /* Auto-grow textarea */
  inputEl.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 90) + 'px';
  });

  /* Enter to send, Shift+Enter for new line */
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('ipo-chat-form').dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  /* Quick reply chips */
  quickEl.addEventListener('click', function(e) {
    var qr = e.target.closest('.ipo-qr');
    if (qr) {
      var q = qr.getAttribute('data-q');
      if (q) sendMessage(q);
    }
  });

  /* Close on Escape */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && state.isOpen) {
      state.isOpen = false;
      panel.classList.remove('ipo-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  /* Close when clicking outside the panel */
  document.addEventListener('click', function(e) {
    if (state.isOpen && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      state.isOpen = false;
      panel.classList.remove('ipo-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

})();