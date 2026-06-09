import Navbar from './components/Navbar';
import ScrollProgress from './components/ScrollProgress';
import MouseGlow from './components/MouseGlow';
import AnimatedBackground from './components/AnimatedBackground';
import HeroSection from './components/HeroSection';
import AboutSection from './components/AboutSection';
import SkillsSection from './components/SkillsSection';
import ProjectsSection from './components/ProjectsSection';
import ExperienceSection from './components/ExperienceSection';
import ContactSection from './components/ContactSection';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen bg-gradient-hero bg-circuit">
      {/* Interactive effects */}
      <MouseGlow />
      <ScrollProgress />

      {/* Navigation */}
      <Navbar />

      {/* Animated background (gradient orbs + energy lines) */}
      <AnimatedBackground>
        {/* Main Content */}
        <main>
          <HeroSection />
          <AboutSection />
          <SkillsSection />
          <ProjectsSection />
          <ExperienceSection />
          <ContactSection />
        </main>

        {/* Footer */}
        <Footer />
      </AnimatedBackground>
    </div>
  );
}
