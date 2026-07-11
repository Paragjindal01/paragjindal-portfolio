# Parag Jindal — Portfolio & Technology Services

Personal portfolio and independent technology-services website, live at [paragjindal.com](https://paragjindal.com).

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss)

## ✨ Features

- **Interactive Spline robot hero** — lazy-loaded so it never blocks initial page load
- **Services showcase** — six independent technology-service cards (development + local tech support)
- **Featured projects** — SafeKelowna (live), trading platform backend, diagram warehouse
- **Full contact form** — service dropdown, validation, Web3Forms email delivery
- **SEO** — meta/OG/Twitter tags, canonical URL, JSON-LD (Person + ProfessionalService), sitemap, robots.txt
- **Accessible** — reduced-motion support, visible keyboard focus states, semantic headings
- **Glassmorphism dark design** — Framer Motion scroll choreography throughout

## 🛠 Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 19 | UI Framework |
| Vite 8 | Build Tool |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animations |
| @splinetool/react-spline | 3D hero scene |
| Web3Forms | Contact form email delivery |

## 🚀 Quick Start

```bash
git clone https://github.com/Paragjindal01/paragjindal-portfolio.git
cd paragjindal-portfolio
npm install
cp .env.example .env.local   # then fill in your Web3Forms key
npm run dev                  # http://localhost:5173
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_WEB3FORMS_ACCESS_KEY` | Web3Forms access key for the contact form (get one free at web3forms.com). Public-facing by design — Web3Forms access keys are safe to expose in frontend code. |

### Build & deploy

```bash
npm run lint      # ESLint
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

Deployed on Vercel: push to `main` and Vercel auto-deploys (framework preset: **Vite**). Set `VITE_WEB3FORMS_ACCESS_KEY` in Vercel → Project → Settings → Environment Variables.

## 📁 Project Structure

```
src/
├── components/
│   ├── Navbar.jsx             # Sticky glass navigation (active-section highlight)
│   ├── HeroSection.jsx        # Hero with scroll choreography + lazy Spline
│   ├── SplineHero.jsx         # Spline robot scene (async chunk)
│   ├── AboutSection.jsx       # Bio + compact skill tags
│   ├── ServicesSection.jsx    # Six service cards + CTA
│   ├── ProjectsSection.jsx    # Project data (SafeKelowna featured)
│   ├── ProjectCard.jsx        # Card with live-site / details buttons
│   ├── ExperienceSection.jsx  # Timeline experience
│   ├── HowItWorksSection.jsx  # 3-step client process
│   ├── ContactSection.jsx     # Validated contact form (Web3Forms)
│   ├── SectionWrapper.jsx     # Scroll-reveal section HOC
│   ├── AnimatedBackground.jsx # Gradient orbs + particles
│   ├── MouseGlow.jsx          # Cursor-following glow
│   ├── ScrollProgress.jsx     # Top progress bar
│   └── Footer.jsx             # Footer with services disclaimer
├── App.jsx
├── main.jsx
└── index.css                  # Design system, focus states, reduced motion
public/
├── favicon.svg
├── robots.txt
└── sitemap.xml
```

## 📄 License

MIT License © Parag Jindal
