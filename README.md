# Parag Jindal — Portfolio Website

A futuristic, 3D animated portfolio website built with modern web technologies.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss)
![Three.js](https://img.shields.io/badge/Three.js-R3F-black?style=flat-square&logo=threedotjs)

## ✨ Features

- **3D Hero Section** — Interactive floating torus knot with particle starfield using React Three Fiber & Drei
- **Glassmorphism Design** — Frosted glass cards with blue/purple glow effects
- **Smooth Animations** — Scroll-triggered Framer Motion animations throughout
- **Responsive Layout** — Optimized for desktop, tablet, and mobile
- **SEO Optimized** — Meta tags, Open Graph, semantic HTML
- **Deploy Ready** — Configured for one-click Vercel deployment

## 🛠 Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 19 | UI Framework |
| Vite 6 | Build Tool |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animations |
| React Three Fiber | 3D Rendering |
| Drei | R3F Helpers |
| Three.js | 3D Engine |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/paragjindal/parag-portfolio.git
cd parag-portfolio

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
# Create optimized build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
src/
├── components/
│   ├── Navbar.jsx            # Sticky glass navigation
│   ├── HeroSection.jsx       # Hero with 3D canvas
│   ├── HeroCanvas.jsx        # React Three Fiber scene
│   ├── AboutSection.jsx      # Bio & education
│   ├── SkillsSection.jsx     # Skills grid
│   ├── ProjectsSection.jsx   # Project showcase
│   ├── ProjectCard.jsx       # Reusable project card
│   ├── ExperienceSection.jsx # Timeline experience
│   ├── ContactSection.jsx    # Contact form & socials
│   ├── SectionWrapper.jsx    # Animation HOC
│   └── Footer.jsx            # Site footer
├── App.jsx                   # Main layout
├── main.jsx                  # Entry point
└── index.css                 # Design system & globals
```

## 🌐 Deploy to Vercel

1. Push to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Framework preset will auto-detect as **Vite**
4. Click **Deploy** — done!

Or use the CLI:

```bash
npx vercel
```

## 📄 License

MIT License © 2026 Parag Jindal
