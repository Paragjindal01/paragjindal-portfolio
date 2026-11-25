# Contributing

Use Node.js 24 or later. Run `npm ci`, `npm test`, and `npm run build`. Install Playwright Chromium with `npx playwright install chromium` before running `npm run test:browser` and `npm run test:browser:service`. The public build defaults to offline. Use the separately documented service build for SQLite-backed changes.

Keep workflow nodes deterministic where possible. Add connector tests using bounded, synthetic data. Test run recovery, duplicate requests, cancelled branches, and approval ordering when changing execution semantics. Maintain compatibility with saved graph versions or document a migration. Store model credentials only in the ignored local environment file. Keep company code, operational data and private material out of fixtures and screenshots.
