import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { CONTACT } from "../../data/professional.mjs";
import { disableSound, enableSound, glitch, isSoundEnabled } from "./sound";

export const { email: EMAIL, github: GITHUB, linkedin: LINKEDIN } = CONTACT;

/* ---------- cinematic cursor ---------- */

export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let frame = 0;

    const move = (event: MouseEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    const over = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const hot = target?.closest("a, button, [data-cursor='hot']");
      node.dataset.hover = hot ? "true" : "false";
      if (hot) glitch();
    };
    const tick = () => {
      cx += (x - cx) * 0.18;
      cy += (y - cy) * 0.18;
      node.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      frame = Math.abs(x - cx) < 0.1 && Math.abs(y - cy) < 0.1
        ? 0 : window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    node.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div aria-hidden="true" className="cursor" ref={ref} />;
}

/* ---------- kinetic display heading ---------- */

export function Kinetic({
  text,
  className = "display",
}: {
  text: string;
  className?: string;
}) {
  const words = text.split(" ");
  let counter = 0;
  return (
    <span className={className}>
      <span aria-hidden="true" className="kinetic">
        {words.map((word, wordIndex) => (
          <span className="kinetic__word" key={`${word}-${wordIndex}`}>
            {Array.from(word).map((char, charIndex) => (
              <span
                key={`${char}-${charIndex}`}
                style={{ ["--i" as string]: counter++ }}
              >
                {char}
              </span>
            ))}
            {wordIndex < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/* ---------- brand + nav ---------- */

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a className="brand" href={href}>
      <span aria-hidden="true" className="monogram">
        PJ
      </span>
      <span className="brand__name">Parag Jindal</span>
    </a>
  );
}

const NAV = [
  { href: "#lab", label: "Lab" },
  { href: "#story", label: "Story" },
  { href: "#work", label: "Work" },
  { href: "#about", label: "About" },
];

export function SiteNav({ insideHome = false }: { insideHome?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const anchor = (href: string) => insideHome ? href : `/${href}`;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="site-nav">
      <Brand href={anchor("#top")} />
      <div className="nav-right">
        <button
          aria-controls="cinematic-navigation"
          aria-expanded={open}
          aria-label="Toggle menu"
          className="nav-toggle"
          onClick={() => setOpen(!open)}
          ref={toggle}
          type="button"
        >Menu</button>
        <nav aria-label="Portfolio" className="nav-links" data-open={open} id="cinematic-navigation">
          {NAV.map((item) => (
            <a className="nav-link" href={anchor(item.href)} key={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <a className="nav-link nav-link--mobile" href={anchor("#services")} onClick={() => setOpen(false)}>Expertise</a>
          <a className="nav-link nav-link--mobile" href={anchor("#contact")} onClick={() => setOpen(false)}>Contact</a>
        </nav>
        <a className="cta-text" href={`mailto:${EMAIL}`}>
          Email Parag
        </a>
      </div>
    </header>
  );
}

/* ---------- CTAs ---------- */

export function EnterLab() {
  return (
    <a className="cta-primary" href="#lab">
      Walk the lab
      <span aria-hidden="true">→</span>
    </a>
  );
}

export function EmailParag({ solid = false }: { solid?: boolean }) {
  return (
    <a
      className={solid ? "cta-primary" : "cta-ghost"}
      href={`mailto:${EMAIL}`}
    >
      Email Parag
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function CaseLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      className="cta-text"
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
      {external ? <span aria-hidden="true">↗</span> : null}
    </a>
  );
}

export function FooterTop() {
  return (
    <button
      className="cta-top"
      onClick={() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
      }}
      type="button"
    >
      Back to top
    </button>
  );
}

/* ---------- sound toggle ---------- */

export function SoundToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isSoundEnabled());
    return disableSound;
  }, []);

  return (
    <button
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      aria-pressed={on}
      className="sound-toggle"
      onClick={async () => {
        if (on) {
          disableSound();
          setOn(false);
          return;
        }
        await enableSound();
        setOn(isSoundEnabled());
      }}
      type="button"
    >
      <span aria-hidden="true" className="sound-toggle__bars">
        <i />
        <i />
        <i />
        <i />
      </span>
      {on ? "Sound on" : "Sound off"}
    </button>
  );
}

/* ---------- ticker ---------- */

const TICKER = [
  "AI PRODUCT ENGINEERING",
  "AGENTIC WORKFLOWS",
  "RETRIEVAL WITH SOURCES",
  "GPU INFRASTRUCTURE",
  "FASTAPI SERVICES",
  "FULL-STACK DELIVERY",
  "LOCAL INFERENCE",
];

export function Marquee() {
  const row = [...TICKER, ...TICKER];
  return (
    <div aria-hidden="true" className="marquee">
      <div className="marquee__track">
        {row.map((item, index) => (
          <span key={`${item}-${index}`}>
            {item} <b>/</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- lab index ---------- */

export type LabApp = {
  href: string;
  name: string;
  desc: string;
  category: string;
  image?: string;
  status?: string;
};

export function LabIndex({ apps }: { apps: LabApp[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [top, setTop] = useState(0);

  return (
    <div className="index" onMouseLeave={() => setActive(null)}>
      {apps.map((app, index) => (
        <a
          className="index__row"
          href={app.href}
          key={app.name}
          onFocus={(event) => {
            setActive(index);
            setTop(event.currentTarget.offsetTop);
          }}
          onMouseEnter={(event) => {
            setActive(index);
            setTop(event.currentTarget.offsetTop);
          }}
          onBlur={() => setActive(null)}
        >
          <span className="index__num">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="index__name">{app.name}</span>
          <span className="index__desc">{app.desc}</span>
          <span className="index__cat">
            {app.category}
            {app.status ? (
              <em className="index__status">{app.status}</em>
            ) : null}
          </span>
          <span aria-hidden="true" className="index__arrow">
            ↗
          </span>
        </a>
      ))}

      <div
        aria-hidden="true"
        className="index__preview"
        data-on={active === null ? "false" : "true"}
        style={{ top }}
      >
        {active === null || !apps[active]?.image ? null : (
          <img alt="" loading="lazy" src={apps[active].image} />
        )}
      </div>
    </div>
  );
}
