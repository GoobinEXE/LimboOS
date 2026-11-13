#!/usr/bin/env node
/**
 * Mesa de demonstração para as capturas do README. Só roda contra os emuladores
 * (projeto demo-limboos); recusa qualquer outro alvo.
 *
 *   cd backend && firebase emulators:start --only auth,firestore,functions,storage --project demo-limboos
 *   node scripts/readme-shots/seed-demo.cjs [--media=<pasta>]
 *
 * Sem --media, o áudio e o vídeo de exemplo são gerados com o ffmpeg numa pasta temporária.
 * As capas e fotos usam a arte de referência de docs/readme/limboos-*.png.
 *
 * Contas criadas (Master ID / senha, só existem no emulador):
 *   mestre / fita-cassete-1999   dono da pasta "Mesa de Swallow Rest"
 *   raposa / fita-cassete-1999   jogador com dois agentes (Last Rewind e Side B)
 *   vela, pardal, tique          jogadores extras para o painel do mestre
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const ROOT = path.join(__dirname, '..', '..');
const PROJECT = 'demo-limboos';
const BUCKET = `${PROJECT}.appspot.com`;
const PASSWORD = 'fita-cassete-1999';

process.env.GCLOUD_PROJECT = PROJECT;
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';

const fnRequire = createRequire(path.join(ROOT, 'backend', 'functions', 'package.json'));
const { initializeApp } = fnRequire('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = fnRequire('firebase-admin/firestore');
const { getAuth } = fnRequire('firebase-admin/auth');
const { getStorage } = fnRequire('firebase-admin/storage');
const { main: migrate } = require(path.join(ROOT, 'backend', 'scripts', 'migrate-to-workspaces.cjs'));

initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

const MEDIA_DIR = process.argv.find((a) => a.startsWith('--media='))?.slice(8)
  || path.join(os.tmpdir(), 'limboos-demo-media');

/**
 * Áudio e vídeo de exemplo (ruído de fita e estática de VHS), gerados com o ffmpeg
 * quando a pasta ainda não tem os arquivos. Nada disso vai para o repositório.
 */
function ensureDemoMedia() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const jobs = {
    'tape-a.mp3': ['-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.05:d=154', '-f', 'lavfi', '-i', 'sine=frequency=220:d=154',
      '-filter_complex', '[1]volume=0.04,tremolo=f=0.3:d=0.7[s];[0][s]amix=inputs=2,lowpass=f=3200,highpass=f=80', '-ac', '1', '-b:a', '48k'],
    'tape-b.mp3': ['-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.04:d=213', '-f', 'lavfi', '-i', 'sine=frequency=330:d=213',
      '-filter_complex', '[1]volume=0.03,vibrato=f=0.5:d=0.4[s];[0][s]amix=inputs=2,lowpass=f=2800', '-ac', '1', '-b:a', '48k'],
    'tape-c.mp3': ['-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.06:d=97', '-af', 'lowpass=f=1800,tremolo=f=2:d=0.3', '-ac', '1', '-b:a', '48k'],
    'vhs.mp4': ['-f', 'lavfi', '-i', 'nullsrc=s=320x240:d=12,geq=random(1)*255:128:128,format=yuv420p', '-f', 'lavfi', '-i', 'anoisesrc=color=white:amplitude=0.03:d=12',
      '-vf', 'boxblur=1:1,eq=contrast=1.4', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '32', '-c:a', 'aac', '-b:a', '48k', '-shortest'],
  };
  for (const [file, args] of Object.entries(jobs)) {
    const out = path.join(MEDIA_DIR, file);
    if (fs.existsSync(out)) continue;
    const res = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args, out]);
    if (res.status !== 0) throw new Error(`ffmpeg falhou ao gerar ${file} (instale o ffmpeg ou passe --media=<pasta>)`);
  }
}

const daysAgo = (d, h = 0) => Timestamp.fromMillis(Date.now() - (d * 24 + h) * 3600 * 1000);

async function ensureUser(masterId, displayName, minutesAgo = 60) {
  const email = `${masterId}@limboos.local`;
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password: PASSWORD, displayName });
  }
  await db.doc(`users/${user.uid}`).set({
    uid: user.uid,
    email,
    masterName: masterId,
    displayName,
    createdAt: daysAgo(40),
    // O painel Ao vivo considera online quem entrou nos últimos 15 minutos.
    lastLogin: Timestamp.fromMillis(Date.now() - minutesAgo * 60 * 1000),
  }, { merge: true });
  return user.uid;
}

/** Sobe um arquivo para o Storage emulado e devolve a URL de download com token. */
async function upload(localPath, storagePath, contentType) {
  const token = crypto.randomUUID();
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
  });
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  return `http://${host}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST.startsWith('127.0.0.1')) {
    throw new Error('Este script só roda contra o emulador local.');
  }
  ensureDemoMedia();

  // 1. Contas
  const gm = await ensureUser('mestre', 'Goobin', 1);
  const raposa = await ensureUser('raposa', 'Lia', 2);
  const vela = await ensureUser('vela', 'Teo', 4);
  const pardal = await ensureUser('pardal', 'Duda', 6);
  const tique = await ensureUser('tique', 'Caio', 9);
  const ws = gm;

  // 2. Pasta + lore legada (campanhas, conquistas, NPCs e diálogos)
  await db.doc(`workspaces/${ws}`).set({ ownerUid: gm, name: 'Mesa de Swallow Rest', createdAt: daysAgo(40) });
  await migrate([`--owner-uid=${gm}`, '--apply', '--skip-logs']);

  // 3. Mídia: capas, fitas, fotos e vídeo
  const art = (f) => path.join(ROOT, 'docs', 'readme', `limboos-${f}`);
  const media = (f) => path.join(MEDIA_DIR, f);
  const coverWalkman = await upload(art('walkman.png'), `workspaces/${ws}/covers/last-rewind.png`, 'image/png');
  const coverNokia = await upload(art('nokia.png'), `workspaces/${ws}/covers/side-b.png`, 'image/png');
  await db.doc(`workspaces/${ws}/campaigns/last-rewind`).set({ imageUrl: coverWalkman }, { merge: true });
  await db.doc(`workspaces/${ws}/campaigns/last-rewind-side-b`).set({ imageUrl: coverNokia }, { merge: true });
  // A demonstração fica só com as duas campanhas de Swallow Rest.
  for (const id of ['neo-sampa-2099', 'orbit-station-zero', 'retro-grid-84', 'dead-zone-arizona']) {
    await db.recursiveDelete(db.doc(`workspaces/${ws}/campaigns/${id}`));
  }

  const tapeA = await upload(media('tape-a.mp3'), `workspaces/${ws}/audio/tape-a.mp3`, 'audio/mpeg');
  const tapeB = await upload(media('tape-b.mp3'), `workspaces/${ws}/audio/tape-b.mp3`, 'audio/mpeg');
  const tapeC = await upload(media('tape-c.mp3'), `workspaces/${ws}/audio/tape-c.mp3`, 'audio/mpeg');
  const photoFenda = await upload(art('fenda.png'), `workspaces/${ws}/img/fenda.png`, 'image/png');
  const photoBench = await upload(art('hero.png'), `workspaces/${ws}/img/bancada.png`, 'image/png');
  const vhs = fs.existsSync(media('vhs.mp4'))
    ? await upload(media('vhs.mp4'), `workspaces/${ws}/video/vhs.mp4`, 'video/mp4')
    : null;

  const asset = (id, campaignId, type, url, mimeType, metadata, extra = {}) => db
    .doc(`workspaces/${ws}/mediaAssets/${id}`)
    .set({
      id,
      filename: `${id}`,
      originalName: `${id}`,
      url,
      storagePath: '',
      mimeType,
      size: 0,
      type,
      campaignId,
      uploadedAt: daysAgo(12),
      uploadedBy: gm,
      metadata,
      ...extra,
    });

  const LR = 'last-rewind';
  const SB = 'last-rewind-side-b';
  await asset('fita-polarized-ensaio', LR, 'audio', tapeB, 'audio/mpeg', {
    title: 'Polarized — ensaio de 12/12/1999', artist: 'Polarized', chapter: 'Lado A', duration: 213, level: 1,
    description: 'Gravado na garagem do Joe. A guitarra some aos 2:31 e volta afinada meio tom abaixo.',
  });
  await asset('fita-secretaria-joe', LR, 'audio', tapeC, 'audio/mpeg', {
    title: 'Secretária eletrônica do Joe', npc: 'Joe', chapter: 'Lado A', duration: 97, level: 2,
    description: 'Três recados da mesma noite. O terceiro tem data de 2003.',
  });
  await asset('fita-radio-swallow', LR, 'audio', tapeA, 'audio/mpeg', {
    title: 'Rádio Swallow Rest FM — 31/12, 23h58', artist: 'Rádio Swallow Rest', chapter: 'Lado B', duration: 154, level: 2,
    description: 'A contagem para a virada é interrompida por dez segundos de estática.',
  });
  await asset('fita-sem-etiqueta', LR, 'audio', tapeC, 'audio/mpeg', {
    title: 'Fita sem etiqueta (Ashfield Springs)', chapter: 'Lado B', duration: 97, level: 3, isSecret: true,
    description: 'Encontrada no porta-luvas. Ninguém no grupo lembra de ter gravado.',
  });
  await asset('fita-ponto-zero', LR, 'audio', tapeA, 'audio/mpeg', {
    title: 'O ponto zero', chapter: 'Lado B', duration: 154, level: 4, isSecret: true,
    description: 'Só toca de trás para frente.',
  });
  await asset('foto-fenda-corredor', LR, 'image', photoFenda, 'image/png', {
    title: 'Corredor da escola, 00h03', category: 'locais', level: 3,
    description: 'Foto tirada pela Mai na virada. A luz no fim do corredor não aparece no negativo.',
  });
  await asset('foto-bancada-joe', LR, 'image', photoBench, 'image/png', {
    title: 'Bancada da oficina', category: 'pistas', level: 1,
    description: 'O monitor ficou ligado a noite toda. Ninguém sabe quem digitou a última linha.',
  });
  await asset('doc-relatorio-rm84', LR, 'text', '', 'text/plain', {
    title: 'Relatório RM-84: ocorrência na Rua Harlow', npc: 'Mai', chapter: 'Lado A', level: 3,
    description: 'Transcrição datilografada, carimbo da prefeitura.',
  }, {
    textContent: 'OCORRÊNCIA 84/1999 — RUA HARLOW, 214\n\n00h01: queda de energia em todo o quarteirão.\n00h02: moradores relatam o mesmo som vindo de todos os rádios da rua, uma fita sendo rebobinada.\n00h03: energia volta. Relógios da rua marcam 23h58.\n\nObservação do plantonista: quatro adolescentes vistos de bicicleta saindo da rua. Um deles levava um walkman.',
  });
  await asset('doc-bilhete-armario', LR, 'text', '', 'text/plain', {
    title: 'Bilhete no armário 113', chapter: 'Lado A', level: 1,
    description: 'Papel de caderno dobrado em quatro.',
  }, {
    textContent: 'Se você está lendo isso, a fita funcionou.\nNão confie no relógio da praça.\nVolte pela mesma porta.',
  });
  await asset('sb-correio-mai', SB, 'audio', tapeC, 'audio/mpeg', {
    title: 'Correio de voz — Mai, 03h12', npc: 'Mai', chapter: 'Lado B', duration: 97, level: 2,
    description: 'Ela fala baixo. Ao fundo, alguém está digitando.',
  });
  await asset('sb-fita-garagem-2003', SB, 'audio', tapeB, 'audio/mpeg', {
    title: 'Garagem, 2003', artist: 'Polarized', chapter: 'Lado B', duration: 213, level: 1,
    description: 'A mesma música de 1999, tocada por gente que não lembra de ter ensaiado.',
  });
  await asset('sb-cartorio', SB, 'text', '', 'text/plain', {
    title: 'Certidões duplicadas', npc: 'Mai', chapter: 'Lado B', level: 3,
    description: 'Cópias dos registros de nascimento de 1980 a 1985.',
  }, {
    textContent: 'Registro 1.112 (1981) e registro 1.112 (1984): mesmo nome, mesma data, mesmo erro de digitação no sobrenome da mãe.\n\nCarimbo da prefeitura com tinta fresca nos dois.',
  });
  if (vhs) {
    await asset('sb-vhs-show', SB, 'video', vhs, 'video/mp4', {
      title: 'VHS: show no ginásio', chapter: 'Lado B', duration: 12, level: 2, videoFormat: 'VHS', videoSource: 'upload',
      description: 'A fita termina antes do show começar.',
    });
  }

  // 4. Agentes e roster
  async function agent(uid, id, data, intel, achievements) {
    const ref = db.doc(`users/${uid}/characters/${id}`);
    await ref.set({
      agentStatus: 'vivo',
      archived: false,
      workspaceId: ws,
      createdAt: daysAgo(30),
      hasTerminalAccess: true,
      hasMacAccess: true,
      achievementsRevealed: true,
      ...data,
    });
    for (const [i, intelId] of intel.entries()) {
      await ref.collection('intel').doc(intelId).set({
        intelId, unlockedAt: daysAgo(10 - i), campaignId: data.campaignId, workspaceId: ws, source: 'admin',
      });
    }
    for (const [i, achId] of achievements.entries()) {
      await ref.collection('achievements').doc(achId).set({
        achievementId: achId, campaignId: data.campaignId, workspaceId: ws, platform: 'walkman',
        unlockedAt: daysAgo(9 - i), source: 'player',
      });
    }
    await db.doc(`users/${uid}/memberships/${ws}`).set({
      wsId: ws, workspaceName: 'Mesa de Swallow Rest', isPlayer: true, updatedAt: daysAgo(1),
    });
  }

  await agent(raposa, 'raposa-lr', {
    codinome: 'Raposa', agentId: '0417', dangerLevel: 3, campaignId: LR, unlockedCampaigns: [LR, SB],
    phoneNumber: '(555) 014-2299',
    notes: 'Guarda o walkman do irmão. Ainda não ouviu o lado B.',
  }, [
    'fita-polarized-ensaio', 'fita-secretaria-joe', 'fita-radio-swallow', 'fita-sem-etiqueta',
    'foto-fenda-corredor', 'foto-bancada-joe', 'doc-relatorio-rm84', 'doc-bilhete-armario',
  ], [
    'ACH-FIRST', 'ACH-THREE', 'ACH-LISTENER', 'ACH-FULL-LISTEN', 'ACH-BIOS-BOOT', 'ACH-WIN95-BOOT',
    'ACH-LIMBO-FOUND', 'ACH-MECH-SCREW', 'ACH-LR-DEMO', 'ACH-LORE-ANALOG', 'ACH-FIVE', 'ACH-SECRET',
    'ACH-ARCHIVE-OPEN', 'ACH-REPAIR-APP', 'ACH-OS-TRIPLE',
  ]);
  await agent(raposa, 'raposa-sb', {
    codinome: 'Raposa (2003)', agentId: '0418', dangerLevel: 4, campaignId: SB, unlockedCampaigns: [SB],
    phoneNumber: '(555) 014-2300',
  }, ['sb-correio-mai', 'sb-fita-garagem-2003', 'sb-cartorio', ...(vhs ? ['sb-vhs-show'] : [])], ['ACH-SB-SIGNAL', 'ACH-SB-SHARED', 'ACH-FIRST', 'ACH-FIVE', 'ACH-SECRET', 'ACH-ARCHIVE-OPEN']);
  await agent(vela, 'vela-lr', {
    codinome: 'Vela', agentId: '0233', dangerLevel: 2, campaignId: LR, unlockedCampaigns: [LR],
  }, ['fita-polarized-ensaio', 'foto-bancada-joe'], ['ACH-FIRST']);
  await agent(pardal, 'pardal-lr', {
    codinome: 'Pardal', agentId: '0561', dangerLevel: 1, campaignId: LR, unlockedCampaigns: [LR],
  }, ['fita-polarized-ensaio', 'fita-secretaria-joe', 'doc-bilhete-armario'], ['ACH-FIRST', 'ACH-THREE']);
  await agent(tique, 'tique-sb', {
    codinome: 'Tique', agentId: '0712', dangerLevel: 3, campaignId: SB, unlockedCampaigns: [SB],
  }, ['sb-correio-mai'], []);

  const roster = (uid, displayName, masterName, characterIds, campaignIds, minutesAgo) => db
    .doc(`workspaces/${ws}/players/${uid}`)
    .set({
      uid, displayName, masterName, characterIds, campaignIds, status: 'active', joinedAt: daysAgo(30),
      lastLogin: Timestamp.fromMillis(Date.now() - minutesAgo * 60 * 1000),
    });
  await roster(raposa, 'Lia', 'raposa', ['raposa-lr', 'raposa-sb'], [LR, SB], 2);
  await roster(vela, 'Teo', 'vela', ['vela-lr'], [LR], 4);
  await roster(pardal, 'Duda', 'pardal', ['pardal-lr'], [LR], 6);
  await roster(tique, 'Caio', 'tique', ['tique-sb'], [SB], 9);

  // 5. Esquadrões
  await db.doc(`workspaces/${ws}/groups/esq-bicicletas`).set({
    id: 'esq-bicicletas', name: 'Turma das Bicicletas', campaignId: LR, unlockedCampaigns: [], campaignIds: [LR],
    characterSlots: [
      { uid: raposa, characterId: 'raposa-lr', joinedAt: daysAgo(30) },
      { uid: vela, characterId: 'vela-lr', joinedAt: daysAgo(30) },
      { uid: pardal, characterId: 'pardal-lr', joinedAt: daysAgo(29) },
    ],
    memberUids: [raposa, vela, pardal], sessions: [], createdAt: daysAgo(30), updatedAt: daysAgo(2),
  });
  await db.doc(`workspaces/${ws}/groups/esq-2003`).set({
    id: 'esq-2003', name: 'Sinal de 2003', campaignId: SB, unlockedCampaigns: [], campaignIds: [SB],
    characterSlots: [
      { uid: raposa, characterId: 'raposa-sb', joinedAt: daysAgo(8) },
      { uid: tique, characterId: 'tique-sb', joinedAt: daysAgo(8) },
    ],
    memberUids: [raposa, tique], sessions: [], createdAt: daysAgo(8), updatedAt: daysAgo(1),
  });

  // SMS: duas conversas de NPC entregues ao agente de 2003 (mesma forma de
  // GroupService.sendNpcDialogueToCharacter).
  const contacts = Object.fromEntries(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/scripts/legacy-seed/npcContacts.json'), 'utf8'))
      .map((c) => [c.id, c]),
  );
  const dialogues = Object.fromEntries(
    JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/scripts/legacy-seed/npcDialogues.json'), 'utf8'))
      .map((d) => [d.id, d]),
  );
  let clock = Date.now() - 3 * 3600 * 1000;
  for (const dialogueId of ['bigmouth_bocao_conv_2', 'mai_archive_conv_1']) {
    const dialogue = dialogues[dialogueId];
    const npc = contacts[dialogue.npcId];
    for (const [i, msg] of dialogue.messages.entries()) {
      const isPlayer = msg.speaker === 'player';
      const id = `${dialogueId}-${i}`;
      clock += 90 * 1000;
      await db.doc(`workspaces/${ws}/groups/esq-2003/messages/${id}`).set({
        id,
        senderId: isPlayer ? 'raposa-sb' : npc.id,
        senderName: isPlayer ? 'Raposa (2003)' : npc.name,
        senderNumber: isPlayer ? '(555) 014-2300' : npc.number,
        text: msg.text,
        recipientId: isPlayer ? npc.id : 'raposa-sb',
        recipientName: isPlayer ? npc.name : 'Raposa (2003)',
        recipientNumber: isPlayer ? npc.number : '(555) 014-2300',
        createdAt: Timestamp.fromMillis(clock),
        npcId: npc.id,
        dialogueId,
      });
    }
  }

  // 6. Estado ao vivo: reparo de disco liberado
  await db.doc(`workspaces/${ws}/campaigns/${LR}/state/live`).set({ diskRepairAllowed: true }, { merge: true });

  // 7. Convite aberto para a captura da tela de convite
  const token = 'demo-convite-swallow-rest';
  await db.doc(`invites/${crypto.createHash('sha256').update(token).digest('hex')}`).set({
    wsId: ws, kind: 'player', campaignId: LR, squadId: 'esq-bicicletas', createdBy: gm,
    createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 7 * 864e5),
    maxUses: 10, uses: 3, revoked: false,
  });

  console.log(JSON.stringify({ ws, gm, raposa, inviteToken: token }, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
