import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const skillGroups = [
  {
    category: 'Frontend',
    items: ['React', 'JavaScript', 'TypeScript', 'Tailwind CSS', 'HTML', 'CSS']
  },
  {
    category: 'Backend',
    items: ['Python', 'FastAPI', 'Node.js', 'Express.js', 'REST APIs', 'GraphQL']
  },
  {
    category: 'Databases',
    items: ['PostgreSQL', 'MySQL', 'MongoDB', 'Prisma']
  },
  {
    category: 'AI / Automation',
    items: ['OpenAI API', 'AI Workflow Automation', 'RAG Concepts', 'API Integrations']
  },
  {
    category: 'IT / Support',
    items: ['Windows OS', 'Linux', 'Device Setup', 'Hardware/Software Support', 'Field Support', 'Customer Support', 'Troubleshooting', 'Documentation']
  },
  {
    category: 'Networking / Security',
    items: ['TCP/IP', 'DNS', 'HTTP/HTTPS', 'Wi-Fi Troubleshooting', 'SSH', 'Wireshark', 'Nmap', 'UFW', 'Linux Logs']
  },
  {
    category: 'Tools',
    items: ['Git', 'GitHub', 'Docker', 'Postman', 'JIRA', 'Excel', 'AWS basics']
  }
];

const capsuleVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.4,
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  }),
};

const floatKeyframes = [
  { y: [0, -4, 0], duration: 4 },
  { y: [0, -6, 0], duration: 5 },
  { y: [0, -3, 0], duration: 3.5 },
  { y: [0, -5, 0], duration: 4.5 },
  { y: [0, -4, 0], duration: 3.8 },
];

export default function SkillsSection() {
  return (
    <SectionWrapper id="skills">
      <div className="text-center mb-16">
        <h2 className="section-title">
          My <span className="text-[var(--color-accent-blue)]">Skills</span>
        </h2>
        <p className="section-subtitle">
          Technologies and tools I use to bring ideas to life.
        </p>
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {skillGroups.map((group, groupIdx) => (
          <div key={group.category} className="space-y-6">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] text-center tracking-tight">
              {group.category}
            </h3>
            <div className="flex flex-wrap justify-center gap-3 md:gap-4">
              {group.items.map((skill, i) => {
                const globalIndex = groupIdx * 10 + i;
                const floatAnim = floatKeyframes[globalIndex % floatKeyframes.length];
                return (
                  <motion.div
                    key={skill}
                    custom={i}
                    variants={capsuleVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    animate={{ y: floatAnim.y }}
                    transition={{
                      y: {
                        duration: floatAnim.duration,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: (globalIndex % 5) * 0.1,
                      },
                    }}
                    whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                    className="skill-capsule cursor-default"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-cyan)] inline-block" />
                    {skill}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
