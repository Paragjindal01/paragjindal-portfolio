/**
 * Brand tokens + chapter copy for the scroll-scrub journey.
 *
 * The film is one continuous 15 s take, cut into five contiguous slices so each
 * chapter scrubs its own part of the same move with no seams and no duplicated
 * downloads. Each poster is the exact first frame of the clip beside it.
 */
import type {
  ScrollScrubScene,
  ScrollScrubTheme,
} from "./scroll-scrub";
import { EmailParag, EnterLab } from "./chrome";
import { CONTACT, CURRENT_ROLE } from "../../data/professional.mjs";

export const scrollScrubTheme: ScrollScrubTheme = {
  accent: "#C9D2D6",
  background: "#0B0D0F",
  ink: "#EDEEE9",
  muted: "#8B9298",
};

export const scrollScrubScenes: ScrollScrubScene[] = [
  {
    id: "arrival",
    label: "Arrival",
    kicker: "Ottawa, Ontario",
    title: CONTACT.name,
    body: `${CURRENT_ROLE.title}. I build intelligent software, the automation around it, and the infrastructure it runs on.`,
    tags: ["AI products", "Automation", "GPU infrastructure"],
    actions: (
      <div className="chapter-actions">
        <EnterLab />
        <EmailParag />
      </div>
    ),
    align: "left",
    scroll: 1.2,
    clip: "/assets/world/hall-01.mp4",
    poster: "/assets/world/hall-01-poster.webp",
    mobileClip: "/assets/world/hall-01-mobile.mp4",
    phoneFrames: "/assets/world/phone-frames/hall-01-frames.webp",
    mobilePoster: "/assets/world/hall-01-mobile-poster.webp",
  },
  {
    id: "lab-chapter",
    label: "The lab",
    kicker: "Independent engineering lab",
    title: "Ten systems, built to be examined.",
    body: "A fictional facility with real software in front of it: agents, telemetry, power, networks and storage, all running on synthetic data.",
    tags: ["RelayOps AI", "InfraPilot AI", "LocalMind"],
    align: "right",
    scroll: 0.95,
    clip: "/assets/world/hall-02.mp4",
    poster: "/assets/world/hall-02-poster.webp",
    mobileClip: "/assets/world/hall-02-mobile.mp4",
    phoneFrames: "/assets/world/phone-frames/hall-02-frames.webp",
    mobilePoster: "/assets/world/hall-02-mobile-poster.webp",
  },
  {
    id: "agents",
    label: "Agents",
    title: "Agents that show their work.",
    body: "Multi-agent workflows with visible steps, tool calls you can inspect, and a human decision before simulated actions proceed.",
    tags: ["Agentic AI", "Tool use", "Approval gates"],
    align: "left",
    scroll: 1,
    clip: "/assets/world/hall-03.mp4",
    poster: "/assets/world/hall-03-poster.webp",
    mobileClip: "/assets/world/hall-03-mobile.mp4",
    phoneFrames: "/assets/world/phone-frames/hall-03-frames.webp",
    mobilePoster: "/assets/world/hall-03-mobile-poster.webp",
  },
  {
    id: "product",
    label: "Product",
    title: "From schema to screen.",
    body: "FastAPI services, PostgreSQL and vector stores under interfaces people can use, shipped and maintained end to end.",
    tags: ["React", "FastAPI", "PostgreSQL"],
    align: "right",
    scroll: 1,
    clip: "/assets/world/hall-04.mp4",
    poster: "/assets/world/hall-04-poster.webp",
    mobileClip: "/assets/world/hall-04-mobile.mp4",
    phoneFrames: "/assets/world/phone-frames/hall-04-frames.webp",
    mobilePoster: "/assets/world/hall-04-mobile-poster.webp",
  },
  {
    id: "handover",
    label: "Handover",
    title: "Open to AI product and infrastructure work.",
    body: "Based in Ottawa, available on site or remote across Canada.",
    actions: (
      <div className="chapter-actions">
        <EmailParag />
      </div>
    ),
    align: "left",
    scroll: 1.1,
    clip: "/assets/world/hall-05.mp4",
    poster: "/assets/world/hall-05-poster.webp",
    mobileClip: "/assets/world/hall-05-mobile.mp4",
    phoneFrames: "/assets/world/phone-frames/hall-05-frames.webp",
    mobilePoster: "/assets/world/hall-05-mobile-poster.webp",
  },
];
