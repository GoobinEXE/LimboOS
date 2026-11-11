// Gera public/build-info.json (versão, commit, data do build) e public/licenses.json
// (dependências de produção com a licença declarada), lidos pela tela "Sobre".
// Roda antes de `npm run dev` e `npm run build` (scripts predev/prebuild).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

const buildInfo = {
  version: pkg.version,
  commit: git('rev-parse --short HEAD'),
  branch: git('rev-parse --abbrev-ref HEAD'),
  builtAt: new Date().toISOString(),
};
writeFileSync(join(root, 'public/build-info.json'), JSON.stringify(buildInfo, null, 2) + '\n');

function repoUrl(meta) {
  const repo = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
  if (!repo) return meta.homepage ?? null;
  return repo.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://');
}

const licenses = Object.keys(pkg.dependencies ?? {})
  .sort((a, b) => a.localeCompare(b))
  .map((name) => {
    const file = join(root, 'node_modules', name, 'package.json');
    if (!existsSync(file)) return { name, version: null, license: null, url: null };
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    const license = typeof meta.license === 'string' ? meta.license : meta.license?.type ?? null;
    return { name, version: meta.version, license, url: repoUrl(meta) };
  });
writeFileSync(join(root, 'public/licenses.json'), JSON.stringify(licenses, null, 2) + '\n');

console.log(`[build-info] v${buildInfo.version} (${buildInfo.commit ?? 'sem git'}), ${licenses.length} licenças`);
