(function () {
  'use strict';

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var microphoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm-1-9a1 1 0 1 1 2 0v6a1 1 0 1 1-2 0V5Zm7 6a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V19H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.09A6 6 0 0 0 18 11Z"/></svg>';

  function isCatalogueSearch(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    var text = [input.placeholder, input.getAttribute('aria-label'), input.getAttribute('aria-description')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /search|rechercher|parfum|perfume|collection|\u0627\u0628\u062d\u062b|\u0639\u0637\u0631/.test(text);
  }

  function recognitionLanguage(input) {
    var placeholder = String(input.placeholder || '');
    if (/[\u0600-\u06ff]/.test(placeholder)) return 'ar-MA';
    if (/rechercher|parfum|marque|collection/i.test(placeholder)) return 'fr-FR';
    return 'en-US';
  }

  function setReactInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }

  function enhance(input) {
    if (!isCatalogueSearch(input) || input.dataset.ipoVoiceSearch === 'true') return;

    var host = input.parentElement;
    if (!host) return;
    input.dataset.ipoVoiceSearch = 'true';
    input.classList.add('ipo-voice-search-input');
    host.classList.add('ipo-voice-search-host');

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ipo-voice-search-button';
    button.innerHTML = microphoneIcon;
    button.setAttribute('aria-label', 'Rechercher avec le microphone');
    button.setAttribute('title', 'Recherche vocale');
    if (!SpeechRecognition) button.classList.add('is-unavailable');
    host.appendChild(button);

    function syncValueState() {
      button.classList.toggle('ipo-voice-has-value', Boolean(input.value));
    }
    input.addEventListener('input', syncValueState);
    syncValueState();

    if (!SpeechRecognition) return;

    var recognition = null;
    button.addEventListener('click', function () {
      if (recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = recognitionLanguage(input);
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        button.classList.add('is-listening');
        button.setAttribute('aria-label', 'Écoute en cours. Appuyez pour arrêter');
      };
      recognition.onresult = function (event) {
        var transcript = event.results && event.results[0] && event.results[0][0]
          ? event.results[0][0].transcript.trim()
          : '';
        if (transcript) {
          setReactInputValue(input, transcript);
          syncValueState();
        }
      };
      recognition.onerror = function (event) {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          button.setAttribute('title', 'Autorisez le microphone dans votre navigateur');
        }
      };
      recognition.onend = function () {
        recognition = null;
        button.classList.remove('is-listening');
        button.setAttribute('aria-label', 'Rechercher avec le microphone');
      };

      try {
        recognition.start();
      } catch (_) {
        recognition = null;
        button.classList.remove('is-listening');
      }
    });
  }

  function scan(root) {
    if (root instanceof HTMLInputElement) enhance(root);
    if (root.querySelectorAll) root.querySelectorAll('input').forEach(enhance);
  }

  scan(document);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
