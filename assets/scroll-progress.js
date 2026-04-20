/* ============================================================
   ✦  IPORDISE  —  Scroll Progress Indicator
   Self-contained IIFE. No dependencies. No framework.

   Behaviour:
   - 3px bar fixed at page top, invisible at scroll=0
   - Fades in on first scroll, fades out on return to top
   - Width driven by requestAnimationFrame lerp (smooth chase)
   - Glow: red  blur at 50%+, gold blur at 90%+
   - CSS injected via <style> — zero external dependencies
   - All listeners are passive for mobile performance
   - Respects prefers-reduced-motion
   ============================================================ */
(function () {
    'use strict';

    /* ── 1. Inject styles into <head> ── */
    const STYLE = `
        #ipo-scroll-bar {
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 3px;
            z-index: 99999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.45s ease;
            will-change: opacity;
        }
        #ipo-scroll-bar.ipo-sb-visible {
            opacity: 1;
        }
        #ipo-scroll-fill {
            height: 100%;
            width: 0%;
            /* Deep red → crimson → coral → blush — luxury gradient */
            background: linear-gradient(
                90deg,
                #6b0f0f  0%,
                #b91c1c 22%,
                #e73c3c 48%,
                #fb7185 76%,
                #fda4af 100%
            );
            background-size: 200% 100%;
            border-radius: 0 2px 2px 0;
            /* Only box-shadow & bg-position transition — width set via JS for perf */
            transition:
                box-shadow      0.55s ease,
                background-position 0.55s ease;
            will-change: width, box-shadow;
        }

        /* ── Red glow (50% – 89%) ── */
        #ipo-scroll-fill.ipo-sb-glow {
            box-shadow:
                0 0  5px rgba(231, 60,  60, 0.80),
                0 0 12px rgba(231, 60,  60, 0.40),
                0 0  1px rgba(255, 170, 170, 0.90);
            background-position: 60% center;
        }

        /* ── Gold glow (90%+) ── */
        #ipo-scroll-fill.ipo-sb-gold {
            box-shadow:
                0 0  7px rgba(201, 162, 39, 0.90),
                0 0 18px rgba(201, 162, 39, 0.45),
                0 0  2px rgba(255, 240, 180, 1.00);
            background-position: right center;
        }

        /* ── Accessibility: remove all motion ── */
        @media (prefers-reduced-motion: reduce) {
            #ipo-scroll-bar,
            #ipo-scroll-fill {
                transition: none !important;
                animation: none !important;
            }
        }
    `;

    const styleEl = document.createElement('style');
    styleEl.id    = 'ipo-scroll-bar-css';
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    /* ── 2. Create DOM elements ── */
    const bar = document.createElement('div');
    bar.id    = 'ipo-scroll-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.setAttribute('role', 'presentation');

    const fill = document.createElement('div');
    fill.id   = 'ipo-scroll-fill';
    bar.appendChild(fill);

    /* Append once body is available */
    function mount() {
        if (document.body) {
            document.body.appendChild(bar);
        } else {
            document.addEventListener('DOMContentLoaded', function () {
                document.body.appendChild(bar);
            }, { once: true });
        }
    }
    mount();

    /* ── 3. State ── */
    let rafId      = null;
    let targetPct  = 0;   /* real scroll % (0–100) */
    let displayPct = 0;   /* animated display % */
    let visible    = false;

    /* ── 4. Calculate current scroll percentage ── */
    function getScrollPct() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docH      = document.documentElement.scrollHeight;
        const winH      = window.innerHeight;
        const scrollable = docH - winH;
        if (scrollable <= 0) return 0;
        return Math.min(100, Math.max(0, (scrollTop / scrollable) * 100));
    }

    /* ── 5. Linear interpolation (smooth "chase") ── */
    function lerp(a, b, t) { return a + (b - a) * t; }

    /* ── 6. Apply fill width and glow class ── */
    function applyFill(pct) {
        fill.style.width = pct.toFixed(2) + '%';

        if (pct >= 90) {
            fill.classList.remove('ipo-sb-glow');
            fill.classList.add('ipo-sb-gold');
        } else if (pct >= 50) {
            fill.classList.remove('ipo-sb-gold');
            fill.classList.add('ipo-sb-glow');
        } else {
            fill.classList.remove('ipo-sb-glow', 'ipo-sb-gold');
        }
    }

    /* ── 7. rAF animation loop ── */
    function animate() {
        /* Adaptive easing: faster when gap is large, gentler near target */
        const gap    = Math.abs(targetPct - displayPct);
        const factor = gap > 10 ? 0.20 : gap > 3 ? 0.13 : 0.09;

        displayPct = lerp(displayPct, targetPct, factor);

        /* Snap when close enough to avoid endless micro-animation */
        if (Math.abs(displayPct - targetPct) < 0.04) {
            displayPct = targetPct;
            applyFill(displayPct);
            rafId = null;

            /* Fade bar out when fully back at top */
            if (displayPct === 0 && visible) {
                bar.classList.remove('ipo-sb-visible');
                visible = false;
            }
            return;
        }

        applyFill(displayPct);
        rafId = requestAnimationFrame(animate);
    }

    /* ── 8. Scroll handler ── */
    function onScroll() {
        targetPct = getScrollPct();

        /* Fade in on first scroll away from top */
        if (!visible && targetPct > 0) {
            visible = true;
            bar.classList.add('ipo-sb-visible');
        }

        /* Start rAF loop only if not already running */
        if (rafId === null && displayPct !== targetPct) {
            rafId = requestAnimationFrame(animate);
        }
    }

    /* ── 9. Resize: recalc target without animating ── */
    function onResize() {
        targetPct = getScrollPct();
        /* Snap display instantly on resize — no animation */
        displayPct = targetPct;
        applyFill(displayPct);
    }

    /* ── 10. Bind events (all passive) ── */
    window.addEventListener('scroll', onScroll,  { passive: true });
    window.addEventListener('resize', onResize,  { passive: true });

    /* Handle back/forward navigation (bfcache restore) */
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) { onResize(); }
    });

    /* Seed initial state (page may already be scrolled on load) */
    window.addEventListener('DOMContentLoaded', function () {
        targetPct  = getScrollPct();
        displayPct = targetPct;
        if (targetPct > 0) {
            visible = true;
            bar.classList.add('ipo-sb-visible');
            applyFill(targetPct);
        }
    }, { once: true });

}());
