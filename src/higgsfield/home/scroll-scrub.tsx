/* Scroll scrub React/TanStack reference implementation. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import "./scroll-scrub.css";

export interface ScrollScrubScene {
  id: string;
  label: string;
  /** Exact first frame of the deployed desktop clip. */
  poster: string;
  /** Exact first frame of mobileClip; provide whenever mobileClip is set. */
  mobilePoster?: string;
  clip: string;
  mobileClip?: string;
  title: string;
  body: string;
  kicker?: string;
  tags?: string[];
  actions?: ReactNode;
  align?: "left" | "right";
  /** Viewport-heights assigned to this scene. More distance means slower scrub. */
  scroll?: number;
  /** 0..0.6. Slow the middle of the clip without changing either seam frame. */
  linger?: number;
  objectPosition?: string;
  mobileObjectPosition?: string;
}

export interface ScrollScrubConnector {
  /** Exact first frame of this connector clip; never substitute a scene still. */
  poster: string;
  /** Exact first frame of mobileClip; provide whenever mobileClip is set. */
  mobilePoster?: string;
  clip: string;
  mobileClip?: string;
  scroll?: number;
}

export interface ScrollScrubTheme {
  background: string;
  ink: string;
  muted: string;
  accent: string;
}

export interface ScrollScrubProps {
  scenes: ScrollScrubScene[];
  /** Leave empty for continuous-forward architecture A. */
  connectors?: (ScrollScrubConnector | null)[];
  theme: ScrollScrubTheme;
  className?: string;
  onActiveSectionChange?: (index: number) => void;
}

interface Segment {
  key: string;
  kind: "scene" | "connector";
  sectionIndex: number;
  nextSectionIndex: number;
  poster: string;
  mobilePoster?: string;
  clip: string;
  mobileClip?: string;
  weight: number;
  linger: number;
  objectPosition: string;
  mobileObjectPosition: string;
  scene?: ScrollScrubScene;
}

interface RuntimeSegment extends Segment {
  band: HTMLElement;
  layer: HTMLElement;
  start: number;
  end: number;
  current: number;
  target: number;
  visible: boolean;
  loading: boolean;
  ready: boolean;
  failed: boolean;
  loadedSource?: string;
  video?: HTMLVideoElement;
  objectUrl?: string;
  abort?: AbortController;
}

interface Controller {
  jumpToSection: (index: number) => void;
}

type ThemeStyle = CSSProperties & Record<`--ss-${string}`, string | number>;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

const lingerEase = (value: number, amount: number) => {
  const x = clamp(value);
  const linger = clamp(amount, 0, 0.6);
  const centered = x - 0.5;
  return (1 - linger) * x + linger * (4 * centered ** 3 + 0.5);
};

function buildSegments(
  scenes: ScrollScrubScene[],
  connectors: (ScrollScrubConnector | null)[]
): Segment[] {
  const result: Segment[] = [];

  for (const [index, scene] of scenes.entries()) {
    if (scene.mobileClip && !scene.mobilePoster) {
      throw new Error(`Scene ${scene.id} needs mobilePoster for mobileClip`);
    }
    result.push({
      clip: scene.clip,
      key: `scene:${scene.id}`,
      kind: "scene",
      linger: scene.linger ?? 0,
      mobileClip: scene.mobileClip,
      mobilePoster: scene.mobilePoster,
      mobileObjectPosition:
        scene.mobileObjectPosition ?? scene.objectPosition ?? "50% 50%",
      nextSectionIndex: index,
      objectPosition: scene.objectPosition ?? "50% 50%",
      poster: scene.poster,
      scene,
      sectionIndex: index,
      weight: scene.scroll ?? 1.4,
    });

    const connector = connectors[index];
    if (index < scenes.length - 1 && connector?.clip) {
      if (connector.mobileClip && !connector.mobilePoster) {
        throw new Error(
          `Connector after ${scene.id} needs mobilePoster for mobileClip`
        );
      }
      const nextScene = scenes[index + 1];
      result.push({
        clip: connector.clip,
        key: `connector:${scene.id}:${nextScene.id}`,
        kind: "connector",
        linger: 0,
        mobileClip: connector.mobileClip,
        mobilePoster: connector.mobilePoster,
        mobileObjectPosition:
          nextScene.mobileObjectPosition ??
          nextScene.objectPosition ??
          "50% 50%",
        nextSectionIndex: index + 1,
        objectPosition: nextScene.objectPosition ?? "50% 50%",
        poster: connector.poster,
        sectionIndex: index,
        weight: connector.scroll ?? 0.8,
      });
    }
  }

  return result;
}

export function ScrollScrub({
  scenes,
  connectors,
  theme,
  className,
  onActiveSectionChange,
}: ScrollScrubProps) {
  const rootRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const onActiveRef = useRef(onActiveSectionChange);
  const [activeSection, setActiveSection] = useState(0);
  const segments = useMemo(
    () => buildSegments(scenes, connectors ?? []),
    [connectors, scenes]
  );

  // Keep the latest callback reachable from the scroll loop without making it a
  // dependency of the controller effect. Synced in an effect, never during
  // render — a render-phase ref write breaks under React Compiler.
  useEffect(() => {
    onActiveRef.current = onActiveSectionChange;
  }, [onActiveSectionChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || segments.length === 0) {
      return;
    }

    const layerNodes = [
      ...root.querySelectorAll<HTMLElement>("[data-scroll-scrub-layer]"),
    ];
    const bandNodes = [
      ...root.querySelectorAll<HTMLElement>("[data-scroll-scrub-band]"),
    ];
    if (
      layerNodes.length !== segments.length ||
      bandNodes.length !== segments.length
    ) {
      throw new Error("ScrollScrub segment markup is out of sync");
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const coarsePointer = window.matchMedia(
      "(hover: none) and (pointer: coarse)"
    ).matches;
    const smallViewport = window.matchMedia("(max-width: 860px)");
    const isMobile = () => coarsePointer || smallViewport.matches;
    const sourceFor = (segment: RuntimeSegment) =>
      isMobile() && segment.mobileClip ? segment.mobileClip : segment.clip;
    const runtime: RuntimeSegment[] = segments.map((segment, index) => ({
      ...segment,
      band: bandNodes[index],
      current: 0,
      end: 0,
      failed: false,
      layer: layerNodes[index],
      loading: false,
      ready: false,
      start: 0,
      target: 0,
      visible: index === 0,
    }));

    let active = -1;
    let activeLayer = 0;
    let destroyed = false;
    let dirty = true;
    let frame = 0;
    let rootTop = 0;
    let total = 1;
    let viewportHeight = window.innerHeight;
    let layoutWidth = window.innerWidth;
    let userReady = false;
    let lastMobileSeek = -Infinity;
    const primed = new WeakSet<HTMLVideoElement>();

    const scheduleFrame = () => {
      if (!destroyed && !frame) frame = window.requestAnimationFrame(tick);
    };

    const invalidate = () => {
      dirty = true;
      scheduleFrame();
    };

    const unloadClip = (segment: RuntimeSegment) => {
      const { video, objectUrl } = segment;
      segment.abort?.abort();
      delete segment.abort;
      delete segment.video;
      delete segment.objectUrl;
      delete segment.loadedSource;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      segment.loading = false;
      segment.ready = false;
      segment.failed = false;
      segment.current = segment.target;
      delete segment.layer.dataset.videoPainted;
      delete segment.layer.dataset.videoFailed;
    };

    const layout = () => {
      const pageY = window.scrollY || window.pageYOffset;
      rootTop = root.getBoundingClientRect().top + pageY;
      layoutWidth = window.innerWidth;

      for (const segment of runtime) {
        if (
          segment.loadedSource &&
          segment.loadedSource !== sourceFor(segment)
        ) {
          unloadClip(segment);
        }
        const rect = segment.band.getBoundingClientRect();
        segment.start = rect.top + pageY - rootTop;
        segment.end = segment.start + rect.height;
      }
      const first = runtime[0];
      viewportHeight = isMobile() && !reduceMotion
        ? Math.max(1, (first.end - first.start) / Math.max(first.weight, 0.2))
        : window.innerHeight;
      total = Math.max(runtime.at(-1)?.end ?? viewportHeight, viewportHeight);
      invalidate();
    };

    const primeVideo = async (video?: HTMLVideoElement) => {
      if (!video || !isMobile() || !userReady || primed.has(video)) {
        return;
      }
      primed.add(video);
      try {
        await video.play();
        video.pause();
      } catch {
        // Keep the poster; a later user gesture/seek can retry naturally.
      }
    };

    const loadClip = async (segment: RuntimeSegment) => {
      const source = sourceFor(segment);
      if (
        reduceMotion ||
        destroyed ||
        segment.loading ||
        segment.ready ||
        segment.failed ||
        !source
      ) {
        return;
      }

      segment.loading = true;
      segment.loadedSource = source;
      segment.abort = new AbortController();
      const request = segment.abort;

      try {
        const response = await fetch(source, {
          signal: request.signal,
        });
        if (!response.ok) {
          throw new Error(`Clip failed: ${response.status}`);
        }
        const blob = await response.blob();
        if (
          destroyed ||
          request.signal.aborted ||
          segment.loadedSource !== source
        ) {
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        const video = document.createElement("video");
        video.className = "scroll-scrub__video";
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.src = objectUrl;

        video.addEventListener(
          "loadedmetadata",
          () => {
            if (segment.video !== video || segment.loadedSource !== source) {
              return;
            }
            segment.ready = true;
            segment.loading = false;
            scheduleFrame();
          },
          { once: true }
        );
        video.addEventListener(
          "loadeddata",
          () => {
            if (
              runtime[activeLayer] === segment &&
              segment.visible &&
              segment.video === video &&
              segment.loadedSource === source
            ) {
              void primeVideo(video);
            }
          },
          { once: true }
        );
        video.addEventListener(
          "error",
          () => {
            if (segment.video !== video) {
              return;
            }
            video.remove();
            URL.revokeObjectURL(objectUrl);
            delete segment.video;
            delete segment.objectUrl;
            segment.failed = true;
            segment.loading = false;
            segment.ready = false;
            delete segment.layer.dataset.videoPainted;
            segment.layer.dataset.videoFailed = "true";
          },
          { once: true }
        );
        video.addEventListener(
          "seeked",
          () => {
            if (segment.video === video && segment.loadedSource === source) {
              segment.layer.dataset.videoPainted = "true";
              scheduleFrame();
            }
          }
        );

        segment.layer.append(video);
        segment.objectUrl = objectUrl;
        segment.video = video;
      } catch (error) {
        if (
          request.signal.aborted ||
          (error instanceof Error && error.name === "AbortError") ||
          segment.loadedSource !== source
        ) {
          return;
        }
        segment.layer.dataset.videoFailed = "true";
        segment.failed = true;
        segment.loading = false;
      }
    };

    const readScroll = () => {
      const pageY = window.scrollY || window.pageYOffset;
      const scrollY = pageY - rootTop;
      const y = clamp(scrollY, 0, total);
      const mobile = isMobile();
      const crossfade = 0.1 * viewportHeight;
      // On a swipe, give the incoming mobile clip more time to buffer.
      // The first scene is still the only clip requested at the top.
      const ahead = mobile && y > 0 ? 0.95 : 0.6;
      activeLayer = Math.max(0, runtime.findLastIndex((segment) => y >= segment.start));

      for (const [index, segment] of runtime.entries()) {
        const length = Math.max(segment.end - segment.start, 1);
        const local = clamp((y - segment.start) / length);
        segment.target = segment.linger
          ? lingerEase(local, segment.linger)
          : local;

        let outside = 0;
        if (y < segment.start) {
          outside = segment.start - y;
        }
        if (y > segment.end) {
          outside = y - segment.end;
        }
        let opacity = smoothstep(1 - outside / Math.max(crossfade, 1));
        if (reduceMotion) {
          opacity = outside === 0 ? 1 : 0;
        }

        segment.visible = opacity > 0.001 && scrollY < total;
        segment.layer.style.opacity = String(opacity);
        segment.layer.style.zIndex = index === activeLayer ? "2" : "1";

        const nearby = !mobile || Math.abs(index - activeLayer) <= 1;
        if (mobile && (!nearby || scrollY >= total) && segment.loadedSource) {
          unloadClip(segment);
        }
        if (
          nearby &&
          scrollY < total &&
          y > segment.start - ahead * viewportHeight &&
          y < segment.end + 0.6 * viewportHeight
        ) {
          void loadClip(segment);
        }
      }

      const current = runtime[activeLayer];
      if (current.visible && current.video && current.video.readyState >= 2) {
        void primeVideo(current.video);
      }
      const currentLength = Math.max(current.end - current.start, 1);
      const currentProgress = clamp((y - current.start) / currentLength);
      const nextActive =
        current.kind === "connector" && currentProgress >= 0.5
          ? current.nextSectionIndex
          : current.sectionIndex;

      if (nextActive !== active) {
        active = nextActive;
        root.dataset.activeSection = String(active);
        setActiveSection(active);
        onActiveRef.current?.(active);
      }

      root.style.setProperty("--ss-progress", String(clamp(y / total)));
    };

    const updateVideos = (now: number) => {
      const mobile = isMobile();
      for (const [index, segment] of runtime.entries()) {
        const { video } = segment;
        if (
          !segment.visible ||
          (mobile && index !== activeLayer) ||
          !video ||
          !segment.ready ||
          video.seeking
        ) {
          continue;
        }
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) continue;
        const epsilon = mobile ? 1 / 30 : 0.008;
        const finalTime = clamp(segment.target, 0, 0.999) * duration;
        if (Math.abs(video.currentTime - finalTime) <= epsilon) {
          segment.current = segment.target;
          continue;
        }

        if (mobile && now - lastMobileSeek < 1000 / 24) {
          scheduleFrame();
          continue;
        }
        segment.current = mobile
          ? segment.target
          : segment.current + (segment.target - segment.current) * 0.2;
        const targetTime = clamp(segment.current, 0, 0.999) * duration;
        if (Math.abs(video.currentTime - targetTime) > epsilon) {
          try {
            video.currentTime = targetTime;
            if (mobile) lastMobileSeek = now;
          } catch {
            // Keep the last painted frame while the browser catches up.
          }
        } else if (!mobile) {
          scheduleFrame();
        }
      }
    };

    const tick = (now: number) => {
      frame = 0;
      if (destroyed) {
        return;
      }
      if (dirty) {
        dirty = false;
        readScroll();
      }
      updateVideos(now);
    };
    const onResize = () => {
      if (coarsePointer && window.innerWidth === layoutWidth) {
        return;
      }
      layout();
    };
    const onFirstGesture = () => {
      if (userReady) {
        return;
      }
      userReady = true;
      void primeVideo(runtime[activeLayer].video);
    };

    controllerRef.current = {
      jumpToSection(index) {
        const segment = runtime.find(
          (candidate) =>
            candidate.kind === "scene" && candidate.sectionIndex === index
        );
        if (!segment) {
          return;
        }
        const top =
          rootTop + segment.start + 0.15 * (segment.end - segment.start);
        window.scrollTo({
          behavior: reduceMotion ? "auto" : "smooth",
          top,
        });
      },
    };

    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", layout);
    window.addEventListener("pointerdown", onFirstGesture, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", onFirstGesture, {
      once: true,
      passive: true,
    });

    layout();

    return () => {
      destroyed = true;
      controllerRef.current = null;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", layout);
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
      root.style.removeProperty("--ss-progress");
      delete root.dataset.activeSection;

      for (const segment of runtime) {
        unloadClip(segment);
        segment.layer.style.removeProperty("opacity");
        segment.layer.style.removeProperty("z-index");
      }
    };
  }, [segments]);

  if (scenes.length === 0) {
    return null;
  }

  const themeStyle: ThemeStyle = {
    "--ss-accent": theme.accent,
    "--ss-bg": theme.background,
    "--ss-ink": theme.ink,
    "--ss-muted": theme.muted,
  };

  return (
    <section
      className={["scroll-scrub", className].filter(Boolean).join(" ")}
      ref={rootRef}
      style={themeStyle}
    >
      <div className="scroll-scrub__stage">
        <div aria-hidden="true" className="scroll-scrub__media">
          {segments.map((segment, index) => {
            const layerStyle: ThemeStyle = {
              "--ss-mobile-position": segment.mobileObjectPosition,
              "--ss-object-position": segment.objectPosition,
            };
            return (
              <figure
                className={`scroll-scrub__layer scroll-scrub__layer--${segment.kind}`}
                data-scroll-scrub-layer=""
                key={segment.key}
                style={layerStyle}
              >
                <picture className="scroll-scrub__picture">
                  {segment.mobilePoster ? (
                    <source
                      media="(hover: none) and (pointer: coarse), (max-width: 860px)"
                      srcSet={segment.mobilePoster}
                    />
                  ) : null}
                  <img
                    alt=""
                    className="scroll-scrub__poster"
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                    src={segment.poster}
                  />
                </picture>
              </figure>
            );
          })}
        </div>

        <div aria-hidden="true" className="scroll-scrub__progress">
          <span />
        </div>

        <nav aria-label="Scroll chapters" className="scroll-scrub__route">
          {scenes.map((scene, index) => (
            <button
              aria-current={activeSection === index ? "step" : undefined}
              className="scroll-scrub__route-button"
              key={scene.id}
              onClick={() => controllerRef.current?.jumpToSection(index)}
              type="button"
            >
              <span>{scene.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="scroll-scrub__story">
        {segments.map((segment) => {
          const bandStyle: CSSProperties = {
            minHeight: `calc(var(--ss-band-viewport) * ${Math.max(segment.weight, 0.2)})`,
          };

          if (segment.kind === "connector") {
            return (
              <div
                aria-hidden="true"
                className="scroll-scrub__connector-band"
                data-scroll-scrub-band=""
                key={segment.key}
                style={bandStyle}
              />
            );
          }

          const { scene } = segment;
          if (!scene) {
            return null;
          }
          const Heading = segment.sectionIndex === 0 ? "h1" : "h2";

          return (
            <article
              className="scroll-scrub__chapter"
              data-align={scene.align ?? "left"}
              data-scroll-scrub-band=""
              id={scene.id}
              key={segment.key}
              style={bandStyle}
            >
              <div className="scroll-scrub__chapter-pin">
                <div className="scroll-scrub__copy">
                  {scene.kicker ? (
                    <p className="scroll-scrub__kicker">{scene.kicker}</p>
                  ) : null}
                  <Heading className="scroll-scrub__title">
                    {scene.title}
                  </Heading>
                  <p className="scroll-scrub__body">{scene.body}</p>
                  {scene.tags?.length ? (
                    <ul className="scroll-scrub__tags">
                      {scene.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  ) : null}
                  {scene.actions ? (
                    <div className="scroll-scrub__actions">{scene.actions}</div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
