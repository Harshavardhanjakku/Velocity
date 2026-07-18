/**
 * animations.js
 * -------------
 * Ambient/interaction animations: canvas particle field, mouse glow,
 * card tilt, button ripple, and scroll-reveal via IntersectionObserver.
 *
 * Note: rather than pulling in the long-unmaintained particles.js library,
 * a small dependency-free canvas particle field is implemented directly
 * here -- same visual effect, zero extra network requests.
 */

const Animations = (() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Lightweight floating-dot particle field on a full-viewport canvas. */
  function initParticles(canvasId = "particles-canvas") {
    const canvas = document.getElementById(canvasId);
    if (!canvas || prefersReduced) return;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let width, height, rafId;

    const COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4"];

    function resize() {
      width = canvas.width = canvas.offsetWidth * devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * devicePixelRatio;
    }

    function createParticles() {
      const count = Math.min(70, Math.floor((width * height) / 90000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: (Math.random() * 1.6 + 0.6) * devicePixelRatio,
        vx: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.18 * devicePixelRatio,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.5 + 0.2,
      }));
    }

    function step() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(step);
    }

    resize();
    createParticles();
    step();

    window.addEventListener(
      "resize",
      Utils.debounce(() => {
        resize();
        createParticles();
      }, 200)
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else step();
    });
  }

  /** Soft radial glow that follows the cursor (desktop only). */
  function initCursorGlow(selector = ".cursor-glow") {
    const glow = document.querySelector(selector);
    if (!glow || prefersReduced || matchMedia("(pointer: coarse)").matches) return;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let curX = targetX;
    let curY = targetY;

    window.addEventListener("mousemove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    function animate() {
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      glow.style.left = `${curX}px`;
      glow.style.top = `${curY}px`;
      requestAnimationFrame(animate);
    }
    animate();
  }

  /** 3D tilt effect on hover for elements with [data-tilt]. */
  function initTilt(selector = "[data-tilt]") {
    if (prefersReduced || matchMedia("(pointer: coarse)").matches) return;
    document.querySelectorAll(selector).forEach((el) => {
      const strength = 8;
      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `perspective(800px) rotateY(${px * strength}deg) rotateX(${-py * strength}deg) translateY(-4px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    });
  }

  /** Material-style ripple effect for [data-ripple] buttons. */
  function initRipple(selector = "[data-ripple]") {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement("span");
        const size = Math.max(rect.width, rect.height);
        ripple.className = "ripple";
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
      });
    });
  }

  /** Reveal elements marked [data-reveal] as they scroll into view. */
  function initScrollReveal(selector = "[data-reveal]") {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    if (prefersReduced) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
  }

  /** Attach ripple + tilt to elements added dynamically (after initial load). */
  function refresh() {
    initTilt();
    initRipple();
    initScrollReveal();
  }

  return { initParticles, initCursorGlow, initTilt, initRipple, initScrollReveal, refresh };
})();
