# Portfolio presentation integration

The current React/Vite portfolio remains the published presentation. The future Higgsfield export can present the same engineering products through the following existing interfaces.

| Surface | Stable source or route |
| --- | --- |
| Professional identity and roles | `src/data/professional.mjs` |
| Project catalog, demos, screenshots, release metadata, and verification | `src/data/projects.mjs` |
| Technical case studies | `src/data/case-studies.mjs`, `src/components/ProjectCaseStudy.jsx`, `/case-studies/:project` |
| Contact and external profile links | `src/components/ContactSection.jsx`, professional data, `VITE_WEB3FORMS_ACCESS_KEY` |
| Browser routes and deployments | `src/data/routes.mjs`, `vercel.json`, and both Vite configurations |
| Structured metadata | `src/data/seo.mjs`, injected into the HTML by Vite |
| Engineering applications | `/lab`, `/lab/:app`, `/relayops/` |
| Simulator snapshot API | `GET /api/simulation` |
| Optional existing 3D experience | `/greeting`, lazy-loaded Spline component |
| GitHub profile text | `node tools/render-github-profile.mjs` |

`npm run build` builds the portfolio and labs. After both dependency sets are installed, `npm run build:release` adds the static RelayOps experience in `dist/relayops`. The local SQLite service is installed and run from `relayops-ai` independently. There is a single portfolio project catalog so a new presentation can consume descriptions, links, status, screenshots and verification without scraping markup or copying content.

## When the export arrives

Inspect the exported component and dependency graph, licenses, responsive variants, 3D load boundaries, media sources and deployment expectations. Import self-contained presentation components when their framework and licensing permit. Keep the established route and API contracts, configure any old-path redirects before release, and preserve existing contact behavior and metadata.

Store approved media and source in durable personal hosting. Encode video variants after inspecting the actual media, provide a mobile-appropriate poster or reduced-motion still, and reserve dimensions before media loads. Keep large animation dependencies independent of contact, applications, and navigation. Test keyboard access, media fallback, motion settings, mobile sizes, and page metrics against the existing baseline before deploying the design. The current scope does not include generating or modifying the cinematic homepage.
