#!/usr/bin/env node
/**
 * Captura as telas do README a partir do app rodando contra os emuladores.
 *
 *   1. cd backend && firebase emulators:start --only auth,firestore,functions,storage --project demo-limboos
 *   2. node scripts/readme-shots/seed-demo.cjs
 *   3. VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-limboos npx vite --port 5190
 *      (configuração limboos-web-emulators em .claude/launch.json)
 *   4. npm i --no-save playwright-core && node scripts/readme-shots/capture.mjs
 *
 * Usa o Chrome instalado (channel "chrome"). Grava PNG em uma pasta temporária e
 * converte para WebP em docs/readme/screens/ com o cwebp. O painel Ao vivo só mostra
 * quem entrou nos últimos 15 minutos: rode logo depois do seed.
 */
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.APP_URL || 'http://localhost:5190';
const PASSWORD = 'fita-cassete-1999';
const OUT = path.join(ROOT, 'docs', 'readme', 'screens');
const RAW = fs.mkdtempSync(path.join(os.tmpdir(), 'limboos-shots-'));
const ONLY = process.argv.slice(2);

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const WIDE = { width: 1440, height: 900 };

fs.mkdirSync(OUT, { recursive: true });

const wait = (page, ms) => page.waitForTimeout(ms);

async function openContext(name) {
  const dir = path.join(RAW, `profile-${name}`);
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chrome',
    headless: true,
    viewport: PHONE,
    deviceScaleFactor: 2,
    locale: 'pt-BR',
    colorScheme: 'dark',
    // A mídia do Storage emulado vem de http://127.0.0.1, fora do CSP do index.html.
    bypassCSP: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  return { ctx, page };
}

function makeShot(page) {
  return async (name, { width = 0 } = {}) => {
    if (ONLY.length && !ONLY.includes(name)) return;
    const png = path.join(RAW, `${name}.png`);
    await page.screenshot({ path: png });
    const webp = path.join(OUT, `${name}.webp`);
    const args = ['-quiet', '-q', '86', '-m', '6'];
    if (width) args.push('-resize', String(width), '0');
    const res = spawnSync('cwebp', [...args, png, '-o', webp]);
    if (res.status !== 0) {
      fs.copyFileSync(png, path.join(OUT, `${name}.png`));
      console.log('png ', name, '(cwebp indisponível)');
    } else {
      console.log('webp', name);
    }
  };
}

async function login(page, masterId) {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await wait(page, 3000);
  await page.locator('input').first().fill(masterId);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByText('ENTRAR NO SISTEMA', { exact: false }).click();
  await wait(page, 5000);
}

async function pickAgent(page, codinome) {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await wait(page, 3000);
  await page.getByText(codinome, { exact: true }).click();
  await wait(page, 3500);
}

async function openDos(page) {
  await pickAgent(page, 'Raposa');
  await page.locator('[aria-label="Sistemas"]').click();
  await wait(page, 800);
  await page.getByText('MH-DOS v6.22').click();
  await wait(page, 3500);
}

async function typeCommand(page, cmd) {
  for (const ch of cmd) {
    await page.keyboard.press(ch);
    await wait(page, 50);
  }
  await page.keyboard.press('Enter');
}

async function player() {
  const { ctx, page } = await openContext('raposa');
  const shot = makeShot(page);

  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await wait(page, 3000);
  await shot('jogador-login');
  await login(page, 'raposa');
  await shot('jogador-agentes');

  // Walkman: fita tocando
  await page.getByText('Raposa', { exact: true }).click();
  await wait(page, 3500);
  await page.getByText('Polarized — ensaio de 12/12/1999').click();
  await wait(page, 1500);
  await page.locator('[aria-label="Tocar"]').click();
  await wait(page, 7000);
  await shot('walkman-fita');

  // Leitor de evidência: texto e foto
  await page.getByText('Relatório RM-84: ocorrência na Rua Harlow').click();
  await wait(page, 2500);
  await shot('walkman-relatorio');
  await page.getByText('[ FECHAR ]').click();
  await wait(page, 1500);
  await page.getByText('Corredor da escola, 00h03').click();
  await wait(page, 3000);
  await shot('walkman-foto');
  await page.getByText('[ FECHAR ]').click();
  await wait(page, 1500);

  // Ficha do agente e conquistas
  await page.locator('[aria-label="Clique para perfil, segure para trocar agente"]').click();
  await wait(page, 3000);
  await shot('jogador-ficha');
  await page.getByText('Primeiro Contato', { exact: true }).first().evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
  });
  await wait(page, 1500);
  await shot('jogador-conquistas');
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => { if (el.scrollTop > 0) el.scrollTop = 0; });
  });
  await wait(page, 800);
  await page.getByText('Alternar missão', { exact: false }).first().click();
  await wait(page, 4000);
  await shot('jogador-campanhas');

  // Nokia: correio de voz tocando e SMS de NPC
  await pickAgent(page, 'Raposa (2003)');
  await page.getByText('Correio de voz — Mai, 03h12').first().click();
  await wait(page, 2500);
  await page.locator('button.w-12.h-10').first().click();
  await wait(page, 7000);
  await shot('nokia-correio');
  await page.locator('button', { hasText: 'SMS' }).first().click();
  await wait(page, 2500);
  await page.locator('button', { hasText: /^\s*Mai/ }).first().click();
  await wait(page, 3000);
  await shot('nokia-sms');

  // Convite e terminal ARG
  await page.goto(`${BASE}/convite/demo-convite-swallow-rest`, { waitUntil: 'load' });
  await wait(page, 6000);
  await shot('convite');
  await page.goto(`${BASE}/terminal`, { waitUntil: 'load' });
  await wait(page, 6000);
  await shot('terminal-arg');

  // Sistemas de época, em tela de computador
  await page.setViewportSize(DESKTOP);
  await openDos(page);
  await typeCommand(page, 'dir');
  await wait(page, 1500);
  await shot('mhdos', { width: 1600 });
  await typeCommand(page, 'limbo');
  await wait(page, 7000);
  await shot('limbo-board', { width: 1600 });

  await openDos(page);
  await typeCommand(page, 'diskrepair');
  await wait(page, 3000);
  await page.getByRole('button', { name: /inserir disquete/i }).click();
  await wait(page, 11000);
  await shot('diskrepair', { width: 1600 });

  await openDos(page);
  await page.keyboard.press('Enter');
  await wait(page, 9000);
  await page.getByText('Meu Computador').first().dblclick();
  await wait(page, 2500);
  await shot('windows95', { width: 1600 });

  await ctx.close();
}

async function admin() {
  const { ctx, page } = await openContext('mestre');
  const shot = makeShot(page);
  await login(page, 'mestre');
  await page.setViewportSize(WIDE);

  const pages = [
    ['admin-missoes', '/admin/missions'],
    ['admin-missao', '/admin/missions/last-rewind/recursos'],
    ['admin-conquistas', '/admin/content/conquistas'],
    ['admin-mesa', '/admin/mesa/esquadroes'],
  ];
  for (const [name, route] of pages) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'load' });
    await wait(page, 6000);
    await shot(name, { width: 1600 });
  }

  // Ao vivo com a sessão da noite escolhida (por último: a sessão fica gravada).
  await page.goto(`${BASE}/admin/live`, { waitUntil: 'load' });
  await wait(page, 6000);
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ label: 'Turma das Bicicletas' });
  await wait(page, 1000);
  await selects.nth(1).selectOption({ label: 'LAST REWIND' });
  await wait(page, 4000);
  await shot('admin-ao-vivo', { width: 1600 });
  await page.getByText('LIMPAR', { exact: true }).click().catch(() => {});

  await ctx.close();
}

/** Capa do README: compõe as telas capturadas com scripts/readme-shots/hero.html. */
async function hero() {
  const here = path.join(ROOT, 'scripts', 'readme-shots');
  const logo = fs.readFileSync(path.join(ROOT, 'public', 'brand', 'dark-room-logo.svg'), 'utf8')
    .replace(/<rect[^>]*\/>/, '')
    .replace('<svg ', '<svg class="studio" aria-label="Dark Room" ');
  const tmp = path.join(here, '.hero.render.html');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(here, 'hero.html'), 'utf8').replace('<!--DARK_ROOM_LOGO-->', logo));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
    await page.goto(`file://${tmp}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await wait(page, 500);
    const png = path.join(RAW, 'capa.png');
    await page.screenshot({ path: png });
    spawnSync('cwebp', ['-quiet', '-q', '88', '-m', '6', '-resize', '1600', '0', png, '-o', path.join(ROOT, 'docs', 'readme', 'limboos-capa.webp')]);
    console.log('webp', 'limboos-capa');
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
}

try {
  if (!ONLY.length || ONLY.some((n) => !n.startsWith('admin-') && n !== 'capa')) await player();
  if (!ONLY.length || ONLY.some((n) => n.startsWith('admin-'))) await admin();
  if (!ONLY.length || ONLY.includes('capa')) await hero();
} finally {
  fs.rmSync(RAW, { recursive: true, force: true });
}
