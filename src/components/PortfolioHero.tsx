import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import LiquidCodeReveal from "./LiquidCodeReveal";
import "./PortfolioHero.css";

/** Served from the /public folder, so a missing file can't break the build. */
const DEFAULT_PORTRAIT = "/portrait.png";

const rotatingWords = ["alive", "good", "fast"];
const sectionIds = ["top", "work", "about", "contact"];

const FALLBACK_PORTRAIT =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=800";

interface PortfolioHeroProps {
  /** Optional custom portrait image URL. Defaults to /portrait.png in the public folder */
  portraitSrc?: string;
}

/** Picks a syntax-highlight class for a line of the fake code editor. */
function getSyntaxClass(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//")) return "syntax-comment";
  if (line.includes("const") || line.includes("function")) return "syntax-gold";
  if (line.includes("<") || line.includes(">") || line.includes("import"))
    return "syntax-blue";
  if (line.includes('"')) return "syntax-green";
  return "syntax-text";
}

export default function PortfolioHero({
  portraitSrc = DEFAULT_PORTRAIT,
}: PortfolioHeroProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [imageLoaded, setImageLoaded] = useState(false);

  /*
   * Pointer position is kept in state, but updates are batched
   * to one per animation frame so the whole component doesn't
   * re-render on every raw pointermove event.
   */
  const [pointerState, setPointerState] = useState({
    x: typeof window !== "undefined" ? window.innerWidth * 0.72 : 0,
    y: typeof window !== "undefined" ? window.innerHeight * 0.5 : 0,
    vx: 0,
    vy: 0,
  });

  /*
   * Rotating headline words
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % rotatingWords.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  /*
   * Smooth scroll on nav click
   */
  const handleNavClick = (
    e: ReactMouseEvent<HTMLAnchorElement>,
    sectionId: string
  ) => {
    e.preventDefault();
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      element.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  /*
   * Active section detection while scrolling
   */
  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /*
   * Pointer tracking
   *
   * The reveal only exists from the top of the page (the Dev.Ini logo)
   * down to the bottom of the "See my work" button. We measure that
   * zone and expose it to CSS as --reveal-end (layer coordinates, used
   * by the mask) and --reveal-end-vp (viewport coordinates, used to clip
   * the gold liquid canvas).
   */
  useEffect(() => {
    const root = document.documentElement;
    const layer = document.querySelector<HTMLElement>(".light-layer");
    const FEATHER = 14;

    let previousX = window.innerWidth * 0.72;
    let previousY = window.innerHeight * 0.5;
    let zoneEnd = window.innerHeight; // in the light layer's coordinates
    let frame = 0;
    let latest = { x: previousX, y: previousY, vx: 0, vy: 0 };

    // The reveal mask lives on the (scrollable) light layer, so everything
    // is positioned in that layer's coordinates, not the viewport's.
    const applyReveal = (clientX: number, clientY: number) => {
      const rect = layer?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      root.style.setProperty("--reveal-x", `${clientX - left}px`);
      root.style.setProperty("--reveal-y", `${clientY - top}px`);
      root.style.setProperty("--reveal-end", `${zoneEnd}px`);
      root.style.setProperty("--reveal-end-vp", `${zoneEnd + top}px`);
    };

    const measureZone = () => {
      const button = document.querySelector<HTMLElement>(
        ".hero-buttons .primary-button"
      );
      const rect = layer?.getBoundingClientRect();
      if (!button || !rect) return;
      zoneEnd = button.getBoundingClientRect().bottom - rect.top + FEATHER;
      applyReveal(previousX, previousY);
    };

    const flush = () => {
      frame = 0;
      setPointerState(latest);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;

      const vx = x - previousX;
      const vy = y - previousY;

      previousX = x;
      previousY = y;

      latest = { x, y, vx, vy };

      // CSS variables update immediately; React state updates once per frame
      applyReveal(x, y);

      const speed = Math.sqrt(vx * vx + vy * vy);
      const revealSize = Math.min(155 + speed * 0.35, 220);
      root.style.setProperty("--reveal-size", `${revealSize}px`);

      setHasInteracted(true);

      if (!frame) frame = window.requestAnimationFrame(flush);
    };

    // Keep the hole under the cursor while the page scrolls
    const handleScroll = () => applyReveal(previousX, previousY);

    measureZone();
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", measureZone);

    // Re-measure when fonts load or the layout changes size
    document.fonts?.ready.then(measureZone);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measureZone)
        : null;
    if (layer) resizeObserver?.observe(layer);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", measureZone);
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--reveal-x");
      root.style.removeProperty("--reveal-y");
      root.style.removeProperty("--reveal-size");
      root.style.removeProperty("--reveal-end");
      root.style.removeProperty("--reveal-end-vp");
    };
  }, []);

  /*
   * Image fallback. Clears the handler first so a failing fallback
   * URL can't trigger an infinite error loop.
   */
  const handleImageError = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.src = FALLBACK_PORTRAIT;
  };

  const currentWord = rotatingWords[wordIndex];

  const codeLines = useMemo(
    () => [
      `import { Work, Stack, About } from "./you";`,
      ``,
      `const developer = {`,
      `  name: "Iniobong Okon Uya",`,
      `  role: "Frontend Developer",`,
      `  location: "Port Harcourt, Nigeria",`,
      `  ships: "beautiful web experiences",`,
      `};`,
      ``,
      `function Portfolio() {`,
      `  return (`,
      `    <main className="portfolio">`,
      ``,
      `      <h1>`,
      `        I build software`,
      `        that feels ${currentWord}.`,
      `      </h1>`,
      ``,
      `      <p>`,
      `        Building useful digital experiences`,
      `        for people and businesses.`,
      `      </p>`,
      ``,
      `      <Work />`,
      `      <CV download />`,
      ``,
      `      // open_to_work: true`,
      ``,
      `    </main>`,
      `  );`,
      `}`,
    ],
    [currentWord]
  );

  return (
    <main className={`portfolio ${hasInteracted ? "is-interacting" : ""}`}>
      {/* ==================================================
          DARK CODE VERSION (Background Layer)
      ================================================== */}
      <section className="code-background" aria-hidden="true">
        <div className="code-grid" />

        <div className="code-header">
          <span className="code-file">portfolio.tsx</span>
          <span className="code-status">● LIVE</span>
        </div>

        <div className="code-editor">
          {codeLines.map((line, index) => (
            <div className="code-line" key={index}>
              <span className="line-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className={getSyntaxClass(line)}>{line || " "}</span>
            </div>
          ))}
        </div>

        <div className="ascii-portrait">
          <div className="ascii-scanline" />
          <pre>
{`          .-=========-.
        .-'           '-.
      .'                 '.
     /                     \\
    /     ███████████       \\
   |     ███████████████      |
   |    █████████████████     |
   |    ████  ███  ████      |
   |    █████████████████     |
   |     ███████████████      |
    \\     ███████████       /
     \\          ███          /
      '.                 .'
        '-.           .-'
           '-=========-'`}
          </pre>
        </div>

        <div className="code-cursor">
          <span />
          source
        </div>
      </section>

      {/* ==================================================
          NORMAL LIGHT PORTFOLIO (Foreground Layer)
      ================================================== */}
      <div className="light-layer">
        <header className="navigation">
          <a
            href="#top"
            className="logo"
            onClick={(e) => handleNavClick(e, "top")}
          >
            <span>Dev</span>
            <strong>.Ini</strong>
          </a>

          <nav>
            <a
              href="#work"
              className={activeSection === "work" ? "active" : ""}
              onClick={(e) => handleNavClick(e, "work")}
            >
              Work
            </a>
            <a
              href="#about"
              className={activeSection === "about" ? "active" : ""}
              onClick={(e) => handleNavClick(e, "about")}
            >
              About
            </a>
            <a
              href="#contact"
              className={activeSection === "contact" ? "active" : ""}
              onClick={(e) => handleNavClick(e, "contact")}
            >
              Contact
            </a>
          </nav>

          <div className="nav-dot" />
        </header>

        <div className="hero-shell">
          {/* HERO SECTION */}
          <div className="hero-content" id="top">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                Frontend Developer · Nigeria
              </div>

              <h1 className="hero-title">
                <span className="title-line">I build software</span>
                <span className="title-line">
                  that feels{" "}
                  <span className="rotating-word">
                    <span className="marker" key={`marker-${wordIndex}`} />
                    <span className="word" key={wordIndex}>
                      {currentWord}
                    </span>
                  </span>
                  .
                </span>
              </h1>

              <p className="hero-description">
                I create responsive digital experiences that turn ideas into clean,
                useful and memorable products for people and businesses.
              </p>

              <div className="hero-buttons">
                <a
                  href="#work"
                  className="button primary-button"
                  onClick={(e) => handleNavClick(e, "work")}
                >
                  See my work
                  <span>↗</span>
                </a>

                <a href="/cv.pdf" className="button secondary-button" download>
                  Download CV
                  <span>↓</span>
                </a>
              </div>

              <div className="hero-meta">
                <span>Based in Port Harcourt</span>
                <span className="meta-divider" />
                <span>Available worldwide</span>
              </div>
            </div>

            {/* PORTRAIT CONTAINER */}
            <div className="portrait-area">
              <div className="portrait-glow" />

              <div className="portrait-frame">
                <img
                  src={portraitSrc}
                  alt="Portrait of Iniobong Okon Uya"
                  className={`portrait ${imageLoaded ? "is-loaded" : "is-loading"}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={handleImageError}
                />

                <div className="portrait-overlay" />

                <div className="portrait-number">01 / 04</div>
              </div>

              <div className="status-tag">
                <span className="status-dot" />
                Open to new projects
              </div>

              <div className="portrait-label">
                <span>Frontend</span>
                <span>React · TypeScript</span>
              </div>
            </div>
          </div>

          {/* BOTTOM BAR */}
          <div className="bottom-bar">
            <div className="scroll-indicator">
              <span className="scroll-line" />
              Scroll to explore
            </div>

            <div className="interaction-hint">
              <span className="desktop-hint">Move your cursor to see the code</span>
              <span className="mobile-hint">Drag anywhere to see the code</span>
              <span className="hint-arrow">✦</span>
            </div>

            <div className="copyright">© 2026 Iniobong Okon Uya</div>
          </div>
        </div>

        {/* WORK SECTION */}
        <section id="work" className="content-section">
          <h2 className="section-title">Selected Work</h2>
          <div className="work-grid">
            <article className="work-card">
              <div className="work-card-header">
                <h3>Fintech Dashboard</h3>
                <span className="work-tag">React / Tailwind</span>
              </div>
              <p>Real-time analytics dashboard for digital asset management.</p>
              <a href="#work" className="work-link">
                View Project ↗
              </a>
            </article>

            <article className="work-card">
              <div className="work-card-header">
                <h3>E-Commerce Platform</h3>
                <span className="work-tag">Next.js / TypeScript</span>
              </div>
              <p>
                High-performance storefront with dynamic product preview and
                localized cart.
              </p>
              <a href="#work" className="work-link">
                View Project ↗
              </a>
            </article>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section id="about" className="content-section">
          <h2 className="section-title">About Me</h2>
          <div className="about-content">
            <p>
              Hi, I'm <strong>Iniobong Okon Uya</strong>, a Frontend Developer
              based in Port Harcourt, Nigeria. I specialize in crafting web
              applications with intuitive UX, smooth micro-interactions, and
              scalable architecture.
            </p>
            <div className="skills-list">
              <span className="skill-chip">React</span>
              <span className="skill-chip">TypeScript</span>
              <span className="skill-chip">Next.js</span>
              <span className="skill-chip">Tailwind CSS</span>
              <span className="skill-chip">Node.js</span>
            </div>
          </div>
        </section>

        {/* CONTACT SECTION */}
        <section id="contact" className="content-section">
          <h2 className="section-title">Get In Touch</h2>
          <div className="contact-container">
            <p>Have a project in mind or want to collaborate? Let's connect.</p>
            <div className="contact-actions">
              <a
                href="mailto:inimoneytech@gmail.com"
                className="button primary-button contact-btn"
              >
                Send an Email ✉
              </a>

              <a
                href="https://github.com/INIMONEY234"
                className="button secondary-button contact-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
                <span>↗</span>
              </a>

              <a
                href="https://wa.me/2349029845914"
                className="button secondary-button contact-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
                <span>↗</span>
              </a>
            </div>

            <ul className="contact-details">
              <li>
                <span>Email</span>
                <a href="mailto:inimoneytech@gmail.com">inimoneytech@gmail.com</a>
              </li>
              <li>
                <span>GitHub</span>
                <a
                  href="https://github.com/INIMONEY234"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/INIMONEY234
                </a>
              </li>
              <li>
                <span>WhatsApp</span>
                <a
                  href="https://wa.me/2349029845914"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +234 902 984 5914
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* ==================================================
          GOLD LIQUID EDGE
      ================================================== */}
      <div className="reveal-clip">
        <LiquidCodeReveal
          active={hasInteracted}
          x={pointerState.x}
          y={pointerState.y}
          velocityX={pointerState.vx}
          velocityY={pointerState.vy}
        />
      </div>
    </main>
  );
}
