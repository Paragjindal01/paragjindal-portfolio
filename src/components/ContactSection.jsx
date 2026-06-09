import { useState } from 'react';
import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const socialLinks = [
  {
    label: 'Email',
    href: 'mailto:paragjindal023@gmail.com',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/parag-jindal-604b41320/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/Paragjindal01',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ContactSection() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle');

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          ...formData
        })
      });

      const result = await response.json();
      if (result.success) {
        setStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <SectionWrapper id="contact">
      <div className="text-center mb-16">
        <h2 className="section-title">
          Get in <span className="text-[var(--color-accent-blue)]">Touch</span>
        </h2>
        <p className="section-subtitle">
          Have a project idea or want to collaborate? Let&apos;s connect.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto"
      >
        {/* Social Links + Info */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-[24px] p-8 md:p-10 border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] h-full">
            <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
              Let&apos;s Build Together
            </h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed mb-8">
              I&apos;m always open to discussing new projects, creative ideas, or opportunities to be
              part of your vision. Reach out through any of the channels below.
            </p>

            <div className="space-y-4">
              {socialLinks.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ x: 4, transition: { duration: 0.2 } }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-400/40 hover:bg-slate-800/80 transition-all duration-300 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-cyan)] shadow-sm"
                >
                  {link.icon}
                  <span className="font-medium">{link.label}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto opacity-30 group-hover:opacity-100"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </motion.a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div variants={itemVariants}>
          <form onSubmit={handleSubmit} className="glass-card p-8 md:p-10 space-y-6">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Name
              </label>
              <input
                id="contact-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
                className="form-input"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="form-input"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Subject
              </label>
              <input
                id="contact-subject"
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Project Inquiry"
                className="form-input"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell me about your project..."
                rows={4}
                className="form-input resize-none"
                required
              />
            </div>
            <motion.button
              type="submit"
              disabled={status === 'loading'}
              whileHover={status !== 'loading' ? { scale: 1.02 } : {}}
              whileTap={status !== 'loading' ? { scale: 0.98 } : {}}
              className="btn-primary w-full justify-center mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send Message
                </>
              )}
            </motion.button>

            {status === 'success' && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium text-[var(--color-accent-cyan)] text-center mt-4"
              >
                Message sent successfully. I&apos;ll get back to you soon.
              </motion.p>
            )}
            {status === 'error' && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium text-[var(--color-accent-coral)] text-center mt-4"
              >
                Something went wrong. Please try again or email me directly.
              </motion.p>
            )}
          </form>
        </motion.div>
      </motion.div>
    </SectionWrapper>
  );
}
