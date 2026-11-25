import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelEvent } from "react";

import "./modal.css";

export type EpisodeDossier = {
  index: string;
  tag: string;
  title: string;
  meta: string;
  image: string;
  summary: string;
  sections: { label: string; body: string }[];
  stack: string[];
};

/**
 * Full-screen episode dossier. Entrance and exit are written as CSS states so
 * the chromatic aberration is one timeline, not a chain of timers. Scrolling
 * past the end of the content, pressing Escape, or the close control all run
 * the same exit.
 */
export function EpisodeModal({
  episode,
  onClose,
}: {
  episode: EpisodeDossier;
  onClose: () => void;
}) {
  const [state, setState] = useState<"in" | "out">("in");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setState("out");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(onClose, reduceMotion ? 0 : 360);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("button, [tabindex='0']");
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panelRef.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (active === last || active === panelRef.current)) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(closeTimer.current);
    };
  }, [close]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node) return;
    const atEnd =
      node.scrollTop + node.clientHeight >= node.scrollHeight - 4;
    if (atEnd && event.deltaY > 12) close();
  };

  return (
    <div className="modal" data-state={state} role="presentation">
      <div aria-hidden="true" className="modal__scrim" onClick={close} />
      <div
        aria-labelledby="episode-title"
        aria-modal="true"
        className="modal__panel"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <button className="modal__close" onClick={close} type="button">
          Close <span aria-hidden="true">✕</span>
        </button>

        <div
          aria-label="Dossier content"
          className="modal__scroll"
          onWheel={handleWheel}
          ref={scrollRef}
          tabIndex={0}
        >
          <figure className="modal__still">
            <img alt={`${episode.title} concept still`} src={episode.image} />
            <span aria-hidden="true" className="modal__still-grain" />
            <figcaption>
              {episode.index} · {episode.tag} · concept art
            </figcaption>
          </figure>

          <div className="modal__body">
            <p className="modal__kicker">
              {episode.index} <span>/</span> {episode.meta}
            </p>
            <h2 className="modal__title" id="episode-title">
              {episode.title}
            </h2>
            <p className="modal__summary">{episode.summary}</p>

            <div className="modal__sections">
              {episode.sections.map((section) => (
                <section className="modal__section" key={section.label}>
                  <p className="modal__label">{section.label}</p>
                  <p className="modal__text">{section.body}</p>
                </section>
              ))}
            </div>

            <ul className="modal__stack">
              {episode.stack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className="modal__hint">
              Keep scrolling to close this dossier
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
