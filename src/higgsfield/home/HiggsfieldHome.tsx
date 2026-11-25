import { useCallback, useEffect, useRef, useState } from "react";

import ContactSection from "../../components/ContactSection.jsx";
import { CONTACT, CURRENT_ROLE, EDUCATION, EMPLOYMENT, employmentMonth, employmentPeriod, workplaceDetails } from "../../data/professional.mjs";
import { LAB_TOOLS } from "../../lab/lab-design.mjs";

import "./shared-chrome.css";
import "./site.css";

import { ScrollScrub } from "./scroll-scrub";
import { scrollScrubScenes, scrollScrubTheme } from "./scroll-scrub-scenes";
import {
  Brand,
  CaseLink,
  Cursor,
  EMAIL,
  EmailParag,
  FooterTop,
  GITHUB,
  Kinetic,
  LabIndex,
  LINKEDIN,
  Marquee,
  SiteNav,
  SoundToggle,
} from "./chrome";
import type { LabApp } from "./chrome";
import { EpisodeModal } from "./episode-modal";
import type { EpisodeDossier } from "./episode-modal";

const HOMEPAGE_LAB_ORDER = [
  "relayops-ai", "infrapilot-ai", "rackops", "gpuwatch", "powerops",
  "fabriclab", "virtscan", "storagecalc", "compute-flow", "localmind",
];

const LAB_APPS: LabApp[] = HOMEPAGE_LAB_ORDER.map((id) => {
  const { links, name, description, category, preview } = LAB_TOOLS.find((tool) => tool.id === id);
  return { href: links.demo, name, desc: description, category, image: preview };
});

const [altaai, bestBuy, okanagan] = EMPLOYMENT;
const [specialist, productEngineer] = altaai.roles;
const [fieldAgent] = bestBuy.roles;
const [studentEmployee] = okanagan.roles;

const EPISODES: EpisodeDossier[] = [
  {
    index: "EP.01",
    tag: "EDUCATION",
    title: "Learning how software meets hardware",
    meta: `${EDUCATION.institution} · Completed ${employmentMonth(EDUCATION.completed)}`,
    image: "/assets/img/ep-01.jpg",
    summary:
      "Computer information systems with a software development specialization. The coursework that stuck was databases, APIs, and the parts of a system nobody puts in a demo.",
    sections: [
      {
        label: "Context",
        body: `${EDUCATION.degree} with a ${EDUCATION.specialization} specialization at ${EDUCATION.institution}, completed in ${employmentMonth(EDUCATION.completed)}. Coursework ran across databases, data warehousing, backend services, mobile development and team project delivery.`,
      },
      {
        label: "What I built",
        body: "Academic projects including the Diagram Data Warehouse, a financial analytics iOS app, and a collaborative capstone that served machine learning predictions through an API. Most of it was team work, which meant reading someone else's schema before changing a line of it.",
      },
      {
        label: "What it taught me",
        body: "That systems fail quietly long before they fail loudly. Indexes, migrations and error paths are where the actual engineering lives, and a working demo is the beginning of the work rather than the end of it.",
      },
    ],
    stack: ["Python", "SQL", "React", "GraphQL", "PostgreSQL", "Swift"],
  },
  {
    index: "EP.02",
    tag: "SUPPORT",
    title: "Fixing things in person",
    meta: "OKANAGAN COLLEGE · GEEK SQUAD · 2025 to 2026",
    image: "/assets/img/ep-02.jpg",
    summary:
      "Campus support and field service taught me how systems fail and how to explain what went wrong.",
    sections: [
      {
        label: "Context",
        body: `${studentEmployee.title} at ${okanagan.organization}, ${employmentPeriod(studentEmployee)}. ${fieldAgent.title} at ${bestBuy.organization}, ${employmentPeriod(fieldAgent)}.`,
      },
      {
        label: "What I did",
        body: fieldAgent.summary,
      },
      {
        label: "What it taught me",
        body: "The way people describe a problem is rarely the problem. Patience is a technical skill, and a clear explanation is part of the fix.",
      },
    ],
    stack: [
      "Hardware diagnostics",
      "Windows",
      "macOS",
      "Networking",
      "Device configuration",
    ],
  },
  {
    index: "EP.03",
    tag: "PRODUCT",
    title: "Building with models",
    meta: "ALTAAI · AI PRODUCT ENGINEER · MAY to SEP 2026",
    image: "/assets/img/ep-03.jpg",
    summary:
      "Building AI applications on local models and retrieval in a part-time product engineering role.",
    sections: [
      {
        label: "Context",
        body: `${productEngineer.title} at ${altaai.organization}, ${employmentPeriod(productEngineer)}. ${workplaceDetails(productEngineer)}.`,
      },
      {
        label: "What I shipped",
        body: "Self-hosted retrieval augmented generation, local language model deployment, FastAPI services, ChromaDB vector search, PostgreSQL, OAuth2 integrations and the automation around them. Also more GPU, Docker and CUDA troubleshooting than the job description suggested.",
      },
      {
        label: "What it taught me",
        body: "Retrieval quality decides product quality. Guardrails belong in the design, not bolted on once the demo impresses someone.",
      },
    ],
    stack: ["Python", "FastAPI", "ChromaDB", "PostgreSQL", "Ollama", "Docker"],
  },
  {
    index: "EP.04",
    tag: "NOW",
    title: "The systems underneath",
    meta: "ALTAAI · SPECIALIST · SEP 2026 to present",
    image: "/assets/img/ep-04.jpg",
    summary:
      "The full time role: AI engineering and automation, plus the GPU, network and storage work everything else quietly depends on.",
    sections: [
      {
        label: "Context",
        body: `${specialist.title} at ${altaai.organization}, ${employmentPeriod(specialist)}. ${workplaceDetails(specialist)}.`,
      },
      {
        label: "What I work on",
        body: "AI engineering and intelligent automation, agent workflows, GPU infrastructure deployment planning, data centre operations, observability, networking and distributed storage, with secure operational workflows running through all of it.",
      },
      {
        label: "What it taught me",
        body: "An application is only as reliable as the infrastructure under it. That is why the lab exists: a place to test an idea about automation, telemetry or failure before it is allowed near anything real.",
      },
    ],
    stack: [
      "Linux",
      "Proxmox",
      "InfiniBand",
      "Observability",
      "Distributed storage",
    ],
  },
];

export default function HiggsfieldHome() {
  const [openEpisode, setOpenEpisode] = useState<EpisodeDossier | null>(null);
  const episodeTrigger = useRef<HTMLButtonElement | null>(null);
  const closeEpisode = useCallback(() => {
    setOpenEpisode(null);
    window.requestAnimationFrame(() => episodeTrigger.current?.focus());
  }, []);

  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "instant" });
  }, []);

  return (
    <div className="higgsfield-home" id="top">
      <div id="higgsfield-page" inert={Boolean(openEpisode)}>
        <a className="higgsfield-skip" href="#home">Skip to content</a>
        <Cursor />
        <div aria-hidden="true" className="grain" />
        <div aria-hidden="true" className="scan" />
        <SoundToggle />
        <SiteNav insideHome />

        <main id="home" tabIndex={-1}>
          <ScrollScrub scenes={scrollScrubScenes} theme={scrollScrubTheme} />

          <Marquee />

          <section className="section" id="lab">
            <span aria-hidden="true" className="section__number">
              01
            </span>
            <div className="section__head">
              <p className="eyebrow" id="projects">Independent engineering lab</p>
              <h2 className="higgsfield-heading"><Kinetic text="Ten systems, built to be examined." /></h2>
              <p className="lede rise-2">
                Independent projects for a fictional Alder Research Facility. The public demos run on synthetic data so you can try operational workflows, failure scenarios, and recovery safely.
              </p>
            </div>

            <LabIndex apps={LAB_APPS} />

            <div className="index__foot">
              <p>Fictional infrastructure · synthetic telemetry · simulated controls</p>
              <div className="index__links">
                <CaseLink href="/lab">Enter the full lab</CaseLink>
                <CaseLink href="/case-studies">Engineering case studies</CaseLink>
              </div>
            </div>
          </section>

          <section className="section" id="story">
            <span aria-hidden="true" className="section__number">
              02
            </span>
            <div className="section__head">
              <p className="eyebrow">Four episodes</p>
              <h2 className="higgsfield-heading"><Kinetic text="How I got here" /></h2>
              <p className="lede rise-2">
                Not a straight line. Support work taught me how systems fail,
                product work taught me who they fail for, and infrastructure is
                where both answers meet. Open any episode for the longer version.
              </p>
            </div>

            <div className="episodes">
              {EPISODES.map((episode) => (
                <button
                  aria-haspopup="dialog"
                  className="episode"
                  data-card="true"
                  key={episode.index}
                  onClick={(event) => {
                    episodeTrigger.current = event.currentTarget;
                    setOpenEpisode(episode);
                  }}
                  type="button"
                >
                  <p className="episode__num">{episode.index}</p>
                  <div>
                    <p className="episode__tag">{episode.tag}</p>
                    <h3 className="episode__title">{episode.title}</h3>
                    <p className="episode__desc">{episode.summary}</p>
                    <span className="episode__open">
                      Open dossier <span aria-hidden="true">↗</span>
                    </span>
                  </div>
                  <p className="episode__meta">
                    {episode.meta.split(" · ").slice(-1)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="section" id="work">
            <span aria-hidden="true" className="section__number">
              03
            </span>
            <div className="section__head">
              <p className="eyebrow" id="software">Selected software</p>
              <h2 className="higgsfield-heading"><Kinetic text="Shipped, not sketched." /></h2>
              <p className="lede rise-2">
                Product work for real users, from a community platform in
                production to model pipelines and a research data warehouse.
              </p>
            </div>

            <div className="work__grid">
              <article className="work__cell work__cell--wide rise">
                <div className="work__meta">
                  <span>2026</span>
                  <span>LIVE</span>
                </div>
                <h3 className="work__title">SafeKelowna</h3>
                <p className="work__desc">
                  Community safety platform: map-based reporting, community alerts,
                  lost-and-found listings, private messaging and moderation. Next.js,
                  TypeScript, PostgreSQL and Leaflet, including deployment and the
                  database work.
                </p>
                <div className="work__links">
                  <CaseLink href="https://safekelowna.com/">Visit site</CaseLink>
                </div>
              </article>

              <div className="work__stack">
                <article className="work__cell rise-2">
                  <div className="work__meta">
                    <span>2026</span>
                    <span>CAPSTONE</span>
                  </div>
                  <h3 className="work__title">Algorithmic Trading Platform</h3>
                  <p className="work__desc">
                    Market data processing and XGBoost prediction serving through
                    FastAPI, containerised with Docker and trained on a Slurm
                    cluster.
                  </p>
                </article>

                <article className="work__cell rise-3">
                  <div className="work__meta">
                    <span>2025</span>
                    <span>COURSE</span>
                  </div>
                  <h3 className="work__title">Diagram Data Warehouse</h3>
                  <p className="work__desc">
                    Diagram uploads with metadata, advanced search, API access and
                    analysis exports on React, GraphQL, PostgreSQL and S3.
                  </p>
                </article>
              </div>
            </div>

            <div className="work__earlier">
              <p>Earlier work</p>
              <CaseLink href="https://github.com/Paragjindal01/financial-analytic-ios-app">
                Financial analytics iOS app
              </CaseLink>
              <CaseLink href="https://github.com/Paragjindal01/cybersecurity-home-lab">
                Cybersecurity home lab
              </CaseLink>
            </div>
          </section>

          <section className="section" id="experience">
            <span aria-hidden="true" className="section__number">
              04
            </span>
            <div className="section__head">
              <p className="eyebrow">Professional record</p>
              <h2 className="higgsfield-heading"><Kinetic text="Where I have worked" /></h2>
              <p className="lede rise-2">
                Two positions at AltaAI chart the move from building AI products to planning and developing the systems they run on.
              </p>
            </div>

            <div className="timeline">
              {EMPLOYMENT.map(({ id, organization, roles }) => (
                <article className="timeline__employer" key={id}>
                  <h3 className="timeline__company">{organization}</h3>
                  {roles.map((role) => (
                    <div className="timeline__item" key={role.title}>
                      <p className="timeline__date">{employmentPeriod(role)}</p>
                      <div>
                        <h4 className="timeline__role">{role.title}</h4>
                        <p className="timeline__org">{workplaceDetails(role)}</p>
                        <p className="timeline__desc">{role.summary}</p>
                        {role.highlights && (
                          <details className="timeline__details">
                            <summary>Technical responsibilities</summary>
                            <ul>{role.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </article>
              ))}
              <article className="timeline__item" id="education">
                <p className="timeline__date">Completed {employmentMonth(EDUCATION.completed)}</p>
                <div>
                  <h3 className="timeline__role">{EDUCATION.degree}</h3>
                  <p className="timeline__org">{EDUCATION.institution}</p>
                  <p className="timeline__desc">{EDUCATION.specialization} specialization</p>
                </div>
              </article>
            </div>
          </section>

          <section className="section" id="range">
            <span aria-hidden="true" className="section__number">
              05
            </span>
            <div className="section__head">
              <p className="eyebrow" id="services">Operating range</p>
              <h2 className="higgsfield-heading"><Kinetic text="What I work on" /></h2>
              <p className="lede rise-2">
                Breadth is the point. The same person who reads the telemetry writes
                the interface that explains it.
              </p>
            </div>

            <div className="bento">
              <div className="bento__cell bento__photo">
                <img
                  alt="Concept art of a fictional server monolith lit in magenta and cyan"
                  src="/assets/img/tower.webp"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="bento__cell bento__figure">
                <div>
                  <strong>{LAB_APPS.length}</strong>
                  <span>Systems in the lab</span>
                </div>
                <div className="bento__figure-rows">
                  <p>
                    <span>Servers modelled</span>
                    <b>16</b>
                  </p>
                  <p>
                    <span>Scenarios</span>
                    <b>04</b>
                  </p>
                  <p>
                    <span>Data policy</span>
                    <b>Synthetic</b>
                  </p>
                </div>
                <CaseLink href="/lab">Open the lab</CaseLink>
              </div>
              <div className="bento__cell bento__list">
                <p>Agentic AI and automation</p>
                <p>Full-stack product engineering</p>
                <p>GPU and data centre infrastructure</p>
                <p>Networks and distributed storage</p>
              </div>
              <div className="bento__cell bento__note">
                <div className="bento__note-col" id="stack">
                  <p className="bento__slot-label">Stack</p>
                  <p>
                    Python, TypeScript, React, Next.js, FastAPI, PostgreSQL,
                    Docker, Linux, Proxmox, Ollama, ChromaDB, InfiniBand. Chosen
                    per problem, not per trend.
                  </p>
                  <div id="github"><CaseLink href={GITHUB}>All repositories</CaseLink></div>
                </div>
                <div className="bento__note-col">
                  <p className="bento__slot-label">Currently</p>
                  <p>
                    {CURRENT_ROLE.title} at AltaAI in {CONTACT.city}. I build RelayOps AI and the rest of the lab independently.
                  </p>
                  <CaseLink href="/lab">Walk the lab</CaseLink>
                </div>
              </div>
            </div>
          </section>

          <section className="about" id="about">
            <span aria-hidden="true" className="section__number">
              06
            </span>
            <div className="about__grid">
              <figure className="about__media">
                <img
                  alt="Stylised character portrait of Parag in a neon server hall"
                  src="/assets/img/engineer.webp"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>Stylised portrait · fiction</figcaption>
              </figure>

              <div className="about__text">
                <h2 className="about__lead">
                  I like systems that can explain themselves.
                </h2>
                <p>
                  I completed a {EDUCATION.degree} at {EDUCATION.institution} in {employmentMonth(EDUCATION.completed)}. My work has moved from
                  repairing other people’s machines, to shipping AI products, to
                  planning and developing the infrastructure those products depend on.
                </p>
                <p>
                  Most of what I know came from taking something apart to find out
                  why it behaved the way it did. That habit is why the lab exists: a
                  place to test an idea about automation, or telemetry, or failure,
                  before it is allowed near anything real.
                </p>
                <p>
                  I am more interested in the next thing I do not understand than in
                  repeating the last thing I did well.
                </p>

                <div className="about__aside">
                  <p className="about__note">
                    Currently: {CURRENT_ROLE.title} at AltaAI, {CONTACT.city}
                  </p>
                  <p className="about__note">
                    Independently: building RelayOps AI and the rest of the lab
                  </p>
                  <p className="about__note">
                    All artwork here is fiction. No employer systems, customers or
                    internal records appear on this site.
                  </p>
                </div>
                <CaseLink href="/greeting">Open 3D greeting</CaseLink>
              </div>
            </div>
          </section>

          <section className="handover" id="contact-links">
            <h2 className="higgsfield-heading"><Kinetic className="statement" text="Open to AI product and infrastructure work." /></h2>
            <div className="handover__actions">
              <EmailParag solid />
              <CaseLink href={LINKEDIN}>Connect on LinkedIn</CaseLink>
              <CaseLink href="#contact">Contact form</CaseLink>
            </div>

            <div className="contact-rows">
              <a className="contact-row" href={`mailto:${EMAIL}`}>
                <span>EMAIL</span>
                <strong>{EMAIL}</strong>
              </a>
              <a
                className="contact-row"
                href={LINKEDIN}
                rel="noreferrer"
                target="_blank"
              >
                <span>LINKEDIN</span>
                <strong>parag-jindal</strong>
              </a>
              <a
                className="contact-row"
                href={GITHUB}
                rel="noreferrer"
                target="_blank"
              >
                <span>GITHUB</span>
                <strong>Paragjindal01</strong>
              </a>
              <a
                className="contact-row"
                href="/lab"
              >
                <span>ENGINEERING LAB</span>
                <strong>paragjindal.com/lab</strong>
              </a>
            </div>
          </section>
          <ContactSection />
        </main>

        <footer className="higgsfield-footer">
          <Brand href="#top" />
          <nav aria-label="Footer">
            <a className="nav-link" href="#lab">
              Lab
            </a>
            <a className="nav-link" href="#story">
              Story
            </a>
            <a className="nav-link" href="#work">
              Work
            </a>
            <a className="nav-link" href="#contact">
              Contact
            </a>
          </nav>
          <FooterTop />
        </footer>
      </div>

      {openEpisode ? (
        <EpisodeModal
          episode={openEpisode}
          onClose={closeEpisode}
        />
      ) : null}
    </div>
  );
}
