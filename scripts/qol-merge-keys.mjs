// Funde textos (docs/qol/textos/*.json ou a resposta do Gemini) nos arquivos de locale.
// Uso: node scripts/qol-merge-keys.mjs [--dir <pasta>] [--replace]
// Sem --replace, só adiciona chaves ausentes; com --replace, substitui o texto provisório.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const repo = process.cwd();
const replace = args.includes('--replace');
const dirArg = args.indexOf('--dir');
const dir = path.resolve(repo, dirArg >= 0 ? args[dirArg + 1] : 'docs/qol/textos');
const NS = new Set(['common', 'player', 'admin']);
const LANGS = ['pt-BR', 'en'];
const cache = {};
const load = (lang, ns) => {
  const k = `${lang}/${ns}`;
  if (!cache[k]) {
    const f = path.join(repo, 'src/i18n/locales', lang, `${ns}.json`);
    cache[k] = { f, data: JSON.parse(fs.readFileSync(f, 'utf8')), dirty: false };
  }
  return cache[k];
};
let added = 0;
const conflicts = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const { chaves = [] } = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const c of chaves) {
    if (!NS.has(c.ns)) continue;
    for (const lang of LANGS) {
      const value = c[lang];
      if (typeof value !== 'string') continue;
      const loc = load(lang, c.ns);
      const parts = c.chave.split('.');
      let node = loc.data;
      let blocked = false;
      for (const p of parts.slice(0, -1)) {
        if (typeof node[p] === 'string') {
          blocked = true;
          break;
        }
        if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
        node = node[p];
      }
      if (blocked) {
        conflicts.push(`${file}: ${lang}/${c.ns}:${c.chave} (um prefixo já é texto)`);
        continue;
      }
      const leaf = parts.at(-1);
      if (node[leaf] === undefined || (replace && node[leaf] !== value)) {
        node[leaf] = value;
        loc.dirty = true;
        added++;
      } else if (node[leaf] !== value) {
        conflicts.push(`${file}: ${lang}/${c.ns}:${c.chave}`);
      }
    }
  }
}
for (const loc of Object.values(cache)) {
  if (loc.dirty) fs.writeFileSync(loc.f, JSON.stringify(loc.data, null, 2) + '\n');
}
console.log(`chaves adicionadas: ${added}`);
if (conflicts.length) console.log(`já existiam com outro valor (mantidas):\n${conflicts.join('\n')}`);
