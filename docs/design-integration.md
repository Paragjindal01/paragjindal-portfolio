# Portfolio presentation integration

The Higgsfield portfolio export at revision `abf3f80` supplies the cinematic homepage, lab index, tool mastheads, and interface styling. The portfolio uses React and Vite and serves the media from its own deployment.

| Surface | Stable source or route |
| --- | --- |
| Professional identity and roles | `src/data/professional.mjs` |
| Project catalog, demos, screenshots, release metadata, and verification | `src/data/projects.mjs` |
| Technical case studies | `src/data/case-studies.mjs`, `src/components/ProjectCaseStudy.jsx`, `/case-studies/:project` |
| Contact and external profile links | `src/components/ContactSection.jsx`, professional data, `VITE_WEB3FORMS_ACCESS_KEY` |
| Browser routes and deployments | `src/data/routes.mjs`, `vercel.json`, and both Vite configurations |
| Structured metadata | `src/data/seo.mjs`, injected into the HTML by Vite |
| Engineering applications | `/lab`, `/lab/:app`, `/relayops/`, `/compute-flow/` |
| Cinematic homepage and shared navigation | `src/higgsfield/home`, `public/assets`, `public/fonts` |
| Lab index and shared tool theme | `src/lab/LabOverview.jsx`, `src/lab/LabShell.jsx`, `src/higgsfield/lab` |
| Simulator snapshot API | `GET /api/simulation` |
| Optional existing 3D experience | `/greeting`, lazy-loaded Spline component |
| GitHub profile text | `node tools/render-github-profile.mjs` |

`npm run build` builds the portfolio and labs. After their dependencies are installed, `npm run build:release` adds both independent static workbenches in `dist/relayops` and `dist/compute-flow`. The local SQLite service is installed and run from `relayops-ai` independently. There is a single portfolio project catalog so a new presentation can consume descriptions, links, status, screenshots and verification without scraping markup or copying content.

The catalog’s `standaloneRepositoryUrl` and `links.source` point to the individual GitHub repositories. The `links.demo` and `links.caseStudy` entries continue to identify the portfolio’s public routes.

## How the presentation uses the existing applications

Lab navigation mounts the existing interactive React tools. Scenario and time controls continue to drive the original simulator. RelayOps uses its existing browser workflow engine on the public site and its SQLite service locally. ComputeFlow uses the same deterministic scheduler, benchmarks, and controls. Canonical demos, standalone source repositories, and case studies come from the project catalog.

The homepage serves the cinematic clips and posters locally. Portrait touch phones scrub through 24 frames from each original Higgsfield mobile clip. Each WebP image in `public/assets/world/phone-frames` stores a 4 × 6 grid of 384 × 640 tiles in row order. The tiles use a centered 432 × 720 crop of the source, with evenly spaced frame indices that include both ends of the clip. The homepage paints the poster first and uses only posters for reduced motion. The JetBrains Mono font files were encoded as WOFF2 while retaining their glyphs and metrics. The original contact form, professional metadata, and optional 3D greeting have independent entry points.
