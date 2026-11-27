import { CONTACT, CURRENT_ROLE, EDUCATION, EMPLOYMENT, POSITIONING, employmentPeriod, workplaceDetails } from './professional.mjs';

const url = `${CONTACT.website}/`;
const address = { '@type': 'PostalAddress', addressLocality: CONTACT.city, addressRegion: 'ON', addressCountry: 'CA' };
const personId = `${url}#parag-jindal`;

export const SEO_TITLE = `${CONTACT.name} | AI Product Engineering, Automation & GPU Infrastructure`;
export const SEO_DESCRIPTION = `${CONTACT.name}, ${CURRENT_ROLE.title} in Ottawa. Explore independent engineering work in AI workflows, full-stack development, GPU infrastructure, and observability.`;
export const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@id': personId,
      '@type': 'Person',
      name: CONTACT.name,
      url,
      email: `mailto:${CONTACT.email}`,
      jobTitle: CURRENT_ROLE.title,
      description: POSITIONING,
      address,
      worksFor: { '@type': 'Organization', name: EMPLOYMENT[0].organization },
      alumniOf: { '@type': 'CollegeOrUniversity', name: EDUCATION.institution },
      hasCredential: { '@type': 'EducationalOccupationalCredential', name: `${EDUCATION.degree}, ${EDUCATION.specialization}`, dateCreated: EDUCATION.completed },
      hasOccupation: EMPLOYMENT[0].roles.map((role) => ({
        '@type': 'Occupation', name: role.title, description: `${employmentPeriod(role)}. ${workplaceDetails(role)}. ${role.summary}`,
      })),
      sameAs: [CONTACT.github, CONTACT.linkedin, CONTACT.instagram],
    },
    {
      '@type': 'ProfessionalService',
      name: `${CONTACT.name} — AI product engineering and software development`,
      url,
      email: `mailto:${CONTACT.email}`,
      description: 'Independent web development, full-stack applications, AI workflows, and technical support.',
      areaServed: [{ '@type': 'City', name: CONTACT.city }, { '@type': 'Country', name: CONTACT.country }],
      founder: { '@id': personId },
      address,
    },
  ],
};

export function portfolioMetadata() {
  return {
    name: 'portfolio-metadata',
    transformIndexHtml() {
      const descriptors = [
        ['name', 'description', SEO_DESCRIPTION], ['name', 'author', CONTACT.name],
        ['property', 'og:type', 'website'], ['property', 'og:url', url], ['property', 'og:title', SEO_TITLE],
        ['property', 'og:description', SEO_DESCRIPTION], ['property', 'og:site_name', CONTACT.name],
        ['property', 'og:image', `${url}assets/brand/og.png`],
        ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', SEO_TITLE], ['name', 'twitter:description', SEO_DESCRIPTION],
        ['name', 'twitter:image', `${url}assets/brand/og.png`],
      ];
      return [
        { tag: 'title', children: SEO_TITLE },
        { tag: 'link', attrs: { rel: 'canonical', href: url } },
        ...descriptors.map(([attribute, key, content]) => ({ tag: 'meta', attrs: { [attribute]: key, content } })),
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(STRUCTURED_DATA).replace(/</g, '\\u003c') },
      ];
    },
  };
}
