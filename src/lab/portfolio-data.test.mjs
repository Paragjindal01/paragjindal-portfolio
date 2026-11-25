import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { CASE_STUDIES } from '../data/case-studies.mjs';
import { ALL_PROJECTS, COMPUTE_FLOW, LAB_PROJECTS, RELAYOPS, SIMULATION_REPOSITORY } from '../data/projects.mjs';
import { CURRENT_ROLE, EDUCATION, EMPLOYMENT, workplaceDetails } from '../data/professional.mjs';
import { resolvePortfolioRoute } from '../data/routes.mjs';
import { STRUCTURED_DATA } from '../data/seo.mjs';

test('AltaAI roles, education, and structured biography agree', () => {
  const altaai = EMPLOYMENT.find(({ id }) => id === 'altaai');
  assert.deepEqual(altaai.roles.map(({ title, from, to, employmentType, workplace }) => [title, from, to, employmentType, workplace]), [
    ['AI & Information Systems Specialist', '2026-09', null, 'Permanent full-time', 'On-site'],
    ['AI Product Engineer', '2026-05', '2026-09', 'Permanent part-time', 'Remote'],
  ]);
  const person = STRUCTURED_DATA['@graph'].find((item) => item['@type'] === 'Person');
  assert.equal(person.jobTitle, CURRENT_ROLE.title);
  assert.equal(person.worksFor.name, altaai.organization);
  assert.deepEqual(person.hasOccupation.map(({ name }) => name), altaai.roles.map(({ title }) => title));
  assert.match(workplaceDetails(altaai.roles[0]), /Ottawa, Ontario, Canada/);
  assert.equal(EDUCATION.completed, '2026-04');
  assert.match(person.hasCredential.name, /Software Development/);
});

test('centralized project data retains every lab route and supplies a real screenshot and case study', async () => {
  assert.equal(LAB_PROJECTS.length, 8);
  assert.equal(ALL_PROJECTS.length, 10);
  assert.equal(new Set(ALL_PROJECTS.map(({ id }) => id)).size, ALL_PROJECTS.length);
  for (const project of ALL_PROJECTS) {
    assert.ok(CASE_STUDIES[project.id]?.flow.length >= 3);
    const repository = `https://github.com/Paragjindal01/${project.id}`;
    assert.equal(project.standaloneRepositoryUrl, repository);
    assert.equal(project.links.source, repository);
    assert.ok(project.links.documentation.startsWith(`${repository}/blob/main/`));
    const relative = project.screenshot.source ?? `public${project.screenshot.path}`;
    await access(new URL(`../../${relative}`, import.meta.url));
    assert.deepEqual(resolvePortfolioRoute(project.links.caseStudy), { page: 'case-study', slug: project.id });
    if (LAB_PROJECTS.includes(project)) assert.deepEqual(resolvePortfolioRoute(project.links.demo), { page: 'lab', slug: project.id });
  }
  assert.equal(SIMULATION_REPOSITORY, 'https://github.com/Paragjindal01/infra-simulation');
  assert.equal(COMPUTE_FLOW.links.demo, '/compute-flow/');
  assert.equal(RELAYOPS.links.demo, '/relayops/');
  assert.equal(RELAYOPS.links.release, 'https://github.com/Paragjindal01/paragjindal-portfolio/releases/tag/relayops-ai-v0.1.0');
  assert.deepEqual(resolvePortfolioRoute('/greeting'), { page: 'greeting' });
});
