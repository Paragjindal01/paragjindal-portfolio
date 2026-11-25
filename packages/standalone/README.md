# Standalone Engineering Lab exports

The integrated portfolio owns the eight application sources. The export script creates an independent source archive for each application and pins the versioned simulator as a local npm dependency. No archive depends on the portfolio checkout or imports source files from outside its extracted directory. PowerOps and InfraPilot AI include the other as a same-origin companion for the simulated approval handoff and incident replay.

## Build and verify exports

From the portfolio repository, use Node.js 24 or later and run:

```sh
npm ci
npx playwright install chromium
npm run verify:standalone
```

The verifier creates the archives, unpacks them into independent temporary directories, checks each simulator archive digest, runs a clean dependency install, executes the unit suite, builds the production UI, and checks a browser interaction and mobile layout for each application. It also checks the InfraPilot-to-PowerOps handoff. The browser tests disable external requests.

Output is written to `test-output/standalone/release/`. To regenerate archives without verification, use `npm run export:standalone`. An optional output directory can follow `--` with either command. Verification uses either Playwright's Chromium build or a channel explicitly set by `STANDALONE_BROWSER_CHANNEL`.

Each application archive contains:

- Its React entry point and the relevant tracked application code.
- A pinned npm shrinkwrap and the versioned local simulation package.
- A README, integrated demo screenshot, technical case study, and release notes. Available product concept artwork is included with a separate label.
- Unit tests, a standalone verification workflow, and a static Docker configuration.

Extract the intended source archive with one leading directory stripped, then run `npm ci`, `npm test`, and `npm run dev` inside the extracted directory. npm must have access to the public React and Vite packages or to a populated npm cache. Simulation, model-free workflows and browser data export run offline once dependencies are installed. See the app case study for any optional local services.

## Release workflow

The standalone GitHub Actions workflow verifies the archives on pull requests or pushes that affect the code and package templates. Only a successful run on the personal portfolio repository's `main` branch may create a release. The release job publishes one tag per explicit application version, attaches the archive manifest and verification record, and leaves existing tags and assets untouched.

The initial export targets application version 0.1.0 and simulator version 2.0.0. Bump `LAB_RELEASE` in the portfolio project catalog for a new application release. Bump the package version under [simulation](../simulation/package.json) when that dependency changes. The lock template supplies pinned browser dependencies for all archives, and its root entry is rewritten for each package with the exact local simulator archive and integrity hash.

These outputs prepare the applications for dedicated repositories while repository creation permissions are unavailable. The archive does not assign an unconfirmed license.
