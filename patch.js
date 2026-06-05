// INFINITE ANIMES - Performance & Fullscreen Patch
// Add this as the LAST <script> tag in index.html

(function() {
  'use strict';

  // ─── 1. FAST VIDEO PLAYER ─────────────────────────────────────
  // Intercept all iframe creations and add autoplay params
  const origSetInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  
  // Override playEpisode and playMovie to add autoplay
  const _origPlayEp = window.playEpisode;
  const _origPlayMv = window.playMovie;
  
  window.playEpisode = function(malId, epNum, url, title) {
    // Preload DNS before playing
    preloadBunny(url);
    return _origPlayEp && _origPlayEp.call(this, malId, epNum, url, title);
  };
  
  window.playMovie = function(url) {
    preloadBunny(url);
    return _origPlayMv && _origPlayMv.call(this, url);
  };
  
  function preloadBunny(url) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'document';
    link.href = url.startsWith('http') ? url : 'https://iframe.mediadelivery.net/embed/673328/' + url;
    document.head.appendChild(link);
  }

  // ─── 2. PROPER FULLSCREEN ─────────────────────────────────────
  window.togglePlayerFullscreen = function() {
    if (navigator.vibrate) navigator.vibrate(40);
    
    const ph = document.getElementById('playerHero');
    const fsBtnText = document.getElementById('fsBtnText');
    if (!ph) return;

    const iframe = ph.querySelector('iframe');
    const isFs = ph.classList.contains('ia-fs') || 
                 document.fullscreenElement || 
                 document.webkitFullscreenElement;

    if (isFs) {
      // ── EXIT ──
      ph.classList.remove('ia-fs');
      document.body.style.overflow = '';
      if (fsBtnText) fsBtnText.textContent = 'Fullscreen';
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
      try { 
        if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch(e) {}
    } else {
      // ── ENTER ──
      ph.classList.add('ia-fs');
      document.body.style.overflow = 'hidden';
      if (fsBtnText) fsBtnText.textContent = 'Exit';
      
      // Lock landscape
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{}); } catch(e) {}
      
      // Try native fullscreen on iframe (works best on mobile)
      const target = iframe || ph;
      try {
        if (target.requestFullscreen) target.requestFullscreen().catch(()=>{});
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        else if (target.webkitEnterFullscreen) target.webkitEnterFullscreen(); // iOS Safari
        else if (ph.requestFullscreen) ph.requestFullscreen().catch(()=>{});
      } catch(e) {}
    }
  };

  // Fix: When native fullscreen exits, also remove CSS class
  function onFsChange() {
    const ph = document.getElementById('playerHero');
    const fsBtnText = document.getElementById('fsBtnText');
    if (!ph) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      ph.classList.remove('ia-fs');
      document.body.style.overflow = '';
      if (fsBtnText) fsBtnText.textContent = 'Fullscreen';
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
    }
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // ─── 3. INJECT CSS ────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Fast rendering */
    .player-frame iframe {
      will-change: transform;
      transform: translateZ(0);
      -webkit-transform: translateZ(0);
    }
    .card img { will-change: transform; }
    .hero-slide { will-change: opacity; }
    
    /* CSS Fullscreen fallback */
    #playerHero.ia-fs {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 99999 !important;
      border-radius: 0 !important;
      aspect-ratio: auto !important;
      margin: 0 !important;
      background: #000 !important;
    }
    #playerHero.ia-fs iframe {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border: none !important;
    }
    #playerHero.ia-fs .player-controls-overlay {
      z-index: 100000 !important;
    }
  `;
  document.head.appendChild(style);

  // ─── 4. IFRAME AUTOPLAY FIX ───────────────────────────────────
  // Watch for new iframes and add autoplay param
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.tagName === 'IFRAME') {
          let src = node.src || '';
          if (src.includes('mediadelivery.net') && !src.includes('autoplay=true')) {
            node.src = src + (src.includes('?') ? '&' : '?') + 'autoplay=true&preload=true';
          }
        }
      });
    });
  });
  
  const frame = document.getElementById('playerFrame');
  if (frame) observer.observe(frame, { childList: true });

  console.log('[IA] Patch loaded: Fast player + Fullscreen fix ✅');
})();
