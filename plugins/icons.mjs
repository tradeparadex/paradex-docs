// Font Awesome icons used by the content, resolved at build time.
//
// Fern served Font Awesome Pro. The site now uses the free (open source)
// set; Pro-only names map to the closest free icon below. Only icons that
// appear in the content are written to src/generated/icons.json, so the
// client bundle stays small.

import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

/** Pro-only (or renamed) icons -> free equivalents. */
const ALIASES = {
  'chart-network': 'circle-nodes',
  'circle-caret-right': 'circle-chevron-right',
  'circle-t': 't',
  'circle-m': 'm',
  'user-robot': 'robot',
  'monitor-waveform': 'wave-square',
  'message-smile': 'face-smile',
  lighthouse: 'tower-observation',
  'display-chart-up-circle-dollar': 'chart-line',
  'arrows-repeat': 'repeat',
  'signature-lock': 'signature',
  'shield-check': 'shield-halved',
  window: 'window-maximize',
  'check-circle': 'circle-check',
};

const STYLE_TOKENS = new Set(['solid', 'regular', 'light', 'thin', 'duotone', 'sharp', 'brands', 'sharp-duotone']);

function loadPack(pkg) {
  const mod = require(pkg);
  const byName = new Map();
  for (const value of Object.values(mod)) {
    if (!value || typeof value !== 'object' || !value.iconName || !Array.isArray(value.icon)) continue;
    byName.set(value.iconName, value);
    for (const alias of value.icon[2] ?? []) if (typeof alias === 'string') byName.set(alias, value);
  }
  return byName;
}

/** Parse "fa-solid fa-circle-check" / "chart-network" / "fa-coins". */
export function parseIcon(spec) {
  const tokens = String(spec).trim().split(/\s+/).map((t) => t.replace(/^fa-/, ''));
  const styles = tokens.filter((t) => STYLE_TOKENS.has(t));
  const name = tokens.filter((t) => !STYLE_TOKENS.has(t)).pop();
  return {name, brand: styles.includes('brands'), regular: styles.some((s) => ['regular', 'light', 'thin'].includes(s))};
}

export function collectIconSpecs(roots) {
  const specs = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'generated' && entry.name !== 'node_modules') walk(full);
      } else if (/\.(mdx?|ya?ml|tsx?)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/\bicon(?:=\{?|:)\s*["']([^"'{}]+)["']/g)) specs.add(m[1].trim());
      }
    }
  };
  for (const root of roots.filter((r) => fs.existsSync(r))) {
    if (fs.statSync(root).isDirectory()) walk(root);
    else for (const m of fs.readFileSync(root, 'utf8').matchAll(/\bicon:\s*["']?([^"'\n]+?)["']?\s*$/gm)) specs.add(m[1].trim());
  }
  return specs;
}

export function writeIconData({roots, outFile, extra = []}) {
  const solid = loadPack('@fortawesome/free-solid-svg-icons');
  const regular = loadPack('@fortawesome/free-regular-svg-icons');
  const brands = loadPack('@fortawesome/free-brands-svg-icons');
  const result = {};
  const missing = [];
  for (const spec of [...collectIconSpecs(roots), ...extra]) {
    const {name, brand, regular: wantsRegular} = parseIcon(spec);
    if (!name) continue;
    const resolved = ALIASES[name] ?? name;
    const def = brand
      ? brands.get(resolved)
      : (wantsRegular ? regular.get(resolved) : undefined) ?? solid.get(resolved) ?? regular.get(resolved) ?? brands.get(resolved);
    if (!def) {
      missing.push(spec);
      continue;
    }
    const [width, height, , , pathData] = def.icon;
    result[spec] = {width, height, path: Array.isArray(pathData) ? pathData : [pathData]};
  }
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, JSON.stringify(result));
  return {count: Object.keys(result).length, missing};
}
