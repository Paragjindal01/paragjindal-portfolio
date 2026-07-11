import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const services = [
  {
    title: 'Website Design & Development',
    description:
      'Modern, responsive websites for individuals, professionals, and small businesses. Services include portfolio websites, business websites, landing pages, contact forms, mobile optimization, domain setup, and deployment.',
    availability: 'Remote across Canada',
    icon: (
      <svg {...iconProps}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    title: 'Full-Stack Application Development',
    description:
      'Custom web applications with responsive interfaces, backend APIs, authentication, databases, dashboards, administrative tools, and cloud deployment.',
    availability: 'Remote across Canada',
    icon: (
      <svg {...iconProps}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    title: 'AI & Workflow Automation',
    description:
      'AI assistants, retrieval-augmented generation systems, automated workflows, API integrations, scheduled processes, and internal business tools.',
    availability: 'Remote across Canada',
    icon: (
      <svg {...iconProps}>
        <path d="M12 2a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v1h1a2 2 0 0 1 0 4h-1v1a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-6 0v-1H8a3 3 0 0 1-3-3v-1H4a2 2 0 0 1 0-4h1V9a3 3 0 0 1 3-3h1V5a3 3 0 0 1 3-3z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
  {
    title: 'Computer & Software Support',
    description:
      'Help with slow computers, software installation, operating-system issues, account setup, updates, backups, malware concerns, device configuration, and general troubleshooting.',
    availability: 'Kelowna and surrounding areas',
    icon: (
      <svg {...iconProps}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    title: 'Wi-Fi & Home Network Support',
    description:
      'Wi-Fi troubleshooting, router setup, connectivity problems, printer connections, device configuration, network optimization, and help connecting home technology.',
    availability: 'Kelowna and surrounding areas',
    icon: (
      <svg {...iconProps}>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },
  {
    title: 'Smart Devices & Home Technology',
    description:
      'Setup and troubleshooting for televisions, printers, streaming devices, smart-home equipment, mobile devices, peripherals, and connected technology.',
    availability: 'Kelowna and surrounding areas',
    icon: (
      <svg {...iconProps}>
        <path d="M3 9.5 12 3l9 6.5" />
        <path d="M5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
        <circle cx="12" cy="14.5" r="2.5" />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function ServicesSection() {
  return (
    <SectionWrapper id="services">
      <div className="text-center mb-16">
        <h2 className="section-title">
          My <span className="text-[var(--color-accent-blue)]">Services</span>
        </h2>
        <p className="section-subtitle">
          From building digital products to fixing everyday technology — independent services for
          individuals and small businesses.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto"
      >
        {services.map((service) => (
          <motion.div
            key={service.title}
            variants={cardVariants}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="glass-card p-8 flex flex-col h-full group relative overflow-hidden transition-all duration-300 hover:shadow-[0_20px_40px_-10px_rgba(34,211,238,0.2)] hover:border-cyan-400/40"
          >
            {/* Corner glow on hover */}
            <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-[var(--color-accent-cyan)] opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-2xl z-0" />

            <div className="w-12 h-12 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center text-[var(--color-accent-cyan)] mb-6 group-hover:border-[var(--color-accent-cyan)]/50 group-hover:shadow-[0_0_20px_-5px_var(--color-accent-cyan)] transition-all duration-300 relative z-10">
              {service.icon}
            </div>

            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-3 group-hover:text-[var(--color-accent-cyan)] transition-colors duration-300 relative z-10 tracking-tight">
              {service.title}
            </h3>

            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6 flex-grow relative z-10">
              {service.description}
            </p>

            <span className="glass-badge w-fit relative z-10 normal-case tracking-normal text-[11px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {service.availability}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-14 text-center"
      >
        <p className="text-[var(--color-text-secondary)] mb-5">
          Need help with something not listed? Send me a message and describe what you need.
        </p>
        <a href="#contact" className="btn-primary">
          Get in Touch
        </a>
      </motion.div>
    </SectionWrapper>
  );
}
