#!/usr/bin/env node
/**
 * Generates `fern/assets/vendor-cookieconsent.bundle.js` from the npm package
 * `vanilla-cookieconsent`. Fern's docs site has no bundler — it serves files
 * from `fern/assets/` as raw static content — so we materialise the library
 * (JS + CSS) as a single bundled file before Fern picks it up.
 *
 * The output file is .gitignored — CI regenerates it on every run via the
 * `yarn install` step in the relevant workflow before Fern reads it. Local
 * dev also gets it for free via the `postinstall` hook in package.json. The
 * pinned version in package.json + yarn.lock is the source of truth; upgrade
 * by bumping the dep and committing the lockfile diff.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(
  repoRoot,
  'fern/assets/vendor-cookieconsent.bundle.js',
);

function resolveDist(file) {
  try {
    return require.resolve(`vanilla-cookieconsent/dist/${file}`, {
      paths: [repoRoot],
    });
  } catch (err) {
    console.error(
      `[sync-vendor-assets] Failed to resolve vanilla-cookieconsent/dist/${file}. Run \`yarn install\` first.`,
    );
    console.error(err.message);
    process.exit(1);
  }
}

const jsSource = fs.readFileSync(resolveDist('cookieconsent.umd.js'), 'utf8');
const cssSource = fs.readFileSync(resolveDist('cookieconsent.css'), 'utf8');

// Embed the CSS as a runtime <style> injection so the single output file
// carries everything Fern needs. Use JSON.stringify to safely escape the CSS
// payload (no template-literal interpolation surprises).
const cssBootstrap = `
(function () {
  var css = ${JSON.stringify(cssSource)};
  var style = document.createElement('style');
  style.setAttribute('data-vendor', 'vanilla-cookieconsent');
  style.textContent = css;
  document.head.append(style);
})();
`;

const banner = `/*! vanilla-cookieconsent — bundled by scripts/sync-vendor-assets.js */\n`;
fs.writeFileSync(outputPath, banner + cssBootstrap + '\n' + jsSource);
console.log(
  `[sync-vendor-assets] wrote ${path.relative(repoRoot, outputPath)} ` +
    `(${(fs.statSync(outputPath).size / 1024).toFixed(1)} KiB)`,
);
