import { useState } from 'react';
import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const socialLinks = [
  {
    label: 'Email',
    detail: 'paragjindal023@gmail.com',
    href: 'mailto:paragjindal023@gmail.com',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    detail: 'parag-jindal',
    href: 'https://www.linkedin.com/in/parag-jindal-604b41320/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    detail: 'Paragjindal01',
    href: 'https://github.com/Paragjindal01',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
      </svg>
    ),
  },
];

const serviceOptions = [
  'Website Development',
  'Full-Stack Application',
  'AI or Automation',
  'Computer Support',
  'Wi-Fi or Networking',
  'Smart Device Setup',
  'Other',
];

const initialForm = {
  name: '',
  email: '',
  phone: '',
  service: '',
  location: '',
  preferredContact: 'Email',
  message: '',
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ContactSection() {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!formData.name.trim()) next.name = 'Please enter your name.';
    if (!formData.email.trim()) {
      next.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (formData.phone.trim() && !/^[\d\s()+.-]{7,20}$/.test(formData.phone.trim())) {
      next.phone = 'Please enter a valid phone number.';
    }
    if (!formData.service) next.service = 'Please select a service.';
    if (!formData.location.trim()) next.location = 'Please enter your location.';
    if (formData.preferredContact === 'Phone' && !formData.phone.trim()) {
      next.phone = 'A phone number is required when phone is your preferred contact method.';
    }
    if (!formData.message.trim()) next.message = 'Please describe what you need.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus('loading');
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          subject: `New inquiry: ${formData.service} — ${formData.name}`,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || 'Not provided',
          service: formData.service,
          location: formData.location,
          preferred_contact: formData.preferredContact,
          message: formData.message,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setStatus('success');
        setFormData(initialForm);
        setTimeout(() => setStatus('idle'), 6000);
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  const fieldError = (name) =>
    errors[name] ? (
      <p className="text-xs font-medium text-[var(--color-accent-coral)] mt-1.5" role="alert">
        {errors[name]}
      </p>
    ) : null;

  return (
    <SectionWrapper id="contact">
      <div className="text-center mb-16">
        <h2 className="section-title">
          Let&apos;s Build Something or <span className="text-[var(--color-accent-blue)]">Solve Your Tech Problem</span>
        </h2>
        <p className="section-subtitle">
          Need a website, custom application, AI solution, or help with a computer or home technology
          issue? Send me a message describing what you need.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 max-w-6xl mx-auto"
      >
        {/* Social Links + Info */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-[24px] p-8 md:p-10 border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] h-full">
            <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
              Reach Out Directly
            </h3>
            <p className="text-[var(--color-text-secondary)] leading-relaxed mb-8">
              Based in Kelowna, BC — available for local technical support and remote development
              work across Canada.
            </p>

            <div className="space-y-4">
              {socialLinks.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  whileHover={{ x: 4, transition: { duration: 0.2 } }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-400/40 hover:bg-slate-800/80 transition-all duration-300 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-cyan)] shadow-sm"
                >
                  {link.icon}
                  <span className="flex flex-col">
                    <span className="font-medium">{link.label}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{link.detail}</span>
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto opacity-30"
                    aria-hidden="true"
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
          <form onSubmit={handleSubmit} className="glass-card p-8 md:p-10 space-y-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Name <span className="text-[var(--color-accent-coral)]" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="form-input"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  required
                />
                {fieldError('name')}
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Email <span className="text-[var(--color-accent-coral)]" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="form-input"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  required
                />
                {fieldError('email')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-phone" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Phone <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(250) 555-0123"
                  className="form-input"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                />
                {fieldError('phone')}
              </div>
              <div>
                <label htmlFor="contact-service" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Service Needed <span className="text-[var(--color-accent-coral)]" aria-hidden="true">*</span>
                </label>
                <select
                  id="contact-service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className="form-input form-select"
                  aria-invalid={!!errors.service}
                  required
                >
                  <option value="" disabled>
                    Select a service…
                  </option>
                  {serviceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {fieldError('service')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-location" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Location <span className="text-[var(--color-accent-coral)]" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-location"
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Kelowna, BC"
                  className="form-input"
                  aria-invalid={!!errors.location}
                  required
                />
                {fieldError('location')}
              </div>
              <fieldset>
                <legend className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  Preferred Contact Method
                </legend>
                <div className="flex gap-3">
                  {['Email', 'Phone'].map((method) => (
                    <label
                      key={method}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border cursor-pointer text-sm font-medium transition-all duration-300 ${
                        formData.preferredContact === method
                          ? 'border-[var(--color-accent-cyan)]/60 bg-[var(--color-bg-ice)]/40 text-[var(--color-accent-cyan)]'
                          : 'border-white/10 bg-white/5 text-[var(--color-text-secondary)] hover:border-white/25'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preferredContact"
                        value={method}
                        checked={formData.preferredContact === method}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      {method}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Message <span className="text-[var(--color-accent-coral)]" aria-hidden="true">*</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Describe the website, application, or technology problem you need help with…"
                rows={4}
                className="form-input resize-none"
                aria-invalid={!!errors.message}
                required
              />
              {fieldError('message')}
            </div>

            <motion.button
              type="submit"
              disabled={status === 'loading'}
              whileHover={status !== 'loading' ? { scale: 1.02 } : {}}
              whileTap={status !== 'loading' ? { scale: 0.98 } : {}}
              className="btn-primary w-full justify-center mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-label="Sending…" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                role="status"
              >
                Thanks — your message was sent. I&apos;ll get back to you within 1–2 business days.
              </motion.p>
            )}
            {status === 'error' && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium text-[var(--color-accent-coral)] text-center mt-4"
                role="alert"
              >
                Something went wrong sending your message. Please try again, or email me directly at
                paragjindal023@gmail.com.
              </motion.p>
            )}
          </form>
        </motion.div>
      </motion.div>
    </SectionWrapper>
  );
}
