import { EDUCATION, EMPLOYMENT, employmentMonth, employmentPeriod, workplaceDetails } from '../data/professional.mjs';

export default function ProfessionalExperience() {
  return <section className="site-section site-section-tint" id="experience">
    <div className="site-frame site-about-grid">
      <div className="site-section-heading"><span className="eyebrow">Work history</span><h2>Professional experience</h2></div>
      <div className="site-experience">
        {EMPLOYMENT.map((employer) => <article key={employer.id}>
          <h3>{employer.organization}</h3>
          <ol className="site-role-list">{employer.roles.map((role) => <li key={role.title}>
            <span className="eyebrow">{employmentPeriod(role)}</span>
            <h4>{role.title}</h4>
            <strong>{workplaceDetails(role)}</strong>
            <p>{role.summary}</p>
            {role.highlights && <ul>{role.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>}
          </li>)}</ol>
        </article>)}
        <article id="education"><span className="eyebrow">Education · {employmentMonth(EDUCATION.completed)}</span>
          <h3>{EDUCATION.degree}</h3><strong>{EDUCATION.institution}</strong><p>{EDUCATION.specialization} specialization</p>
        </article>
      </div>
    </div>
  </section>;
}
