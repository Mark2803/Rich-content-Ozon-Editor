// Сервер редактора rich-контента Ozon.
// Node 22, без сторонних библиотек. Отдаёт страницу редактора, пускает только
// по ссылке из «Менеджмента» (токен проверяется по базе сайта через psql)
// и хранит общие шаблоны в папке data/.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, readdir, unlink, copyFile, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import path from 'node:path';
import { pgEnv } from './pg-env.js';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// --- Настройки из .env (простой разбор, без библиотек) ---
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const cfg = {
  port: Number(process.env.PORT || 3410),
  host: process.env.HOST || '127.0.0.1',
  noAuth: process.env.AUTH_DISABLED === '1',
  secret: process.env.SESSION_SECRET || '',
  db: process.env.DATABASE_URL || '',
  authSql: process.env.AUTH_SQL || '',
  ttlMin: Number(process.env.SESSION_TTL_MIN || 60),
  cookiePath: process.env.COOKIE_PATH || '/',
  data: path.resolve(ROOT, process.env.DATA_DIR || 'data'),
};
const PUBLIC = path.join(ROOT, 'public');
const TPL = path.join(cfg.data, 'templates');
const BACKUP = path.join(cfg.data, 'backup');

if (cfg.noAuth && process.env.NODE_ENV === 'production') {
  console.error('AUTH_DISABLED=1 нельзя включать на рабочем сервере: редактор окажется открыт всем.');
  process.exit(1);
}
if (!cfg.noAuth) {
  const miss = [];
  if (cfg.secret.length < 32) miss.push('SESSION_SECRET (не короче 32 символов)');
  if (!cfg.db) miss.push('DATABASE_URL');
  if (!cfg.authSql.includes(":'t")) miss.push("AUTH_SQL (запрос с :'t' или :'th')");
  if (miss.length) { console.error(`Не хватает настроек в .env: ${miss.join(', ')}`); process.exit(1); }
}
let PG_ENV = null;
if (!cfg.noAuth) {
  try { PG_ENV = pgEnv(cfg.db); } catch (e) { console.error(`DATABASE_URL: ${e.message}`); process.exit(1); }
}

// --- Вход ---
const COOKIE = 'rich_s';
const sign = (v) => createHmac('sha256', cfg.secret).update(v).digest('base64url');

function makeSession() {
  const exp = Date.now() + cfg.ttlMin * 60_000;
  const v = `${exp}.${randomBytes(8).toString('hex')}`;
  return `${v}.${sign(v)}`;
}
function validSession(req) {
  if (cfg.noAuth) return true;
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const val = raw.slice(COOKIE.length + 1);
  const i = val.lastIndexOf('.');
  if (i < 0) return false;
  const body = val.slice(0, i);
  const a = Buffer.from(val.slice(i + 1));
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(body.split('.')[0]) > Date.now();
}

// Проверка токена из «Менеджмента» тем же способом, что у «Воронки продаж WB»:
// запрос к базе сайта через psql. В запросе :'t' — сам токен, :'th' — его SHA-256.
function checkToken(token) {
  return new Promise((resolve) => {
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return resolve(false);
    const th = createHash('sha256').update(token).digest('hex');
    // Пароль базы — в переменных окружения psql, а не в командной строке.
    const p = spawn('psql', ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-v', `t=${token}`, '-v', `th=${th}`],
      { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH, ...PG_ENV } });
    let out = ''; let err = '';
    const timer = setTimeout(() => { p.kill(); resolve(false); }, 8000);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(timer); console.error('psql не запустился:', e.message); resolve(false); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) console.error('Проверка токена: ошибка запроса', err.trim().split('\n')[0]);
      resolve(code === 0 && out.trim().length > 0);
    });
    p.stdin.end(`${cfg.authSql.trim().replace(/;?\s*$/, ';')}\n`);
  });
}

// Не больше 20 попыток входа за 10 минут с одного адреса.
const tries = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (tries.get(ip) || []).filter((t) => now - t < 600_000);
  list.push(now); tries.set(ip, list);
  return list.length > 20;
}

// --- Ответы ---
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};
function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SEC, ...extra });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
const fail = (res, status, code, message) => send(res, status, { error: { code, message } });

async function readBody(req, limit = 2 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Слишком большой шаблон'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('Неверный JSON'), { status: 400 }); }
}

// --- Шаблоны ---
const idOk = (id) => /^[\p{L}\p{N}-]{1,100}$/u.test(id);
const file = (id) => path.join(TPL, `${encodeURIComponent(id)}.json`);

async function listTemplates() {
  await mkdir(TPL, { recursive: true });
  const names = (await readdir(TPL)).filter((n) => n.endsWith('.json'));
  const items = [];
  for (const n of names) {
    try { const t = JSON.parse(await readFile(path.join(TPL, n), 'utf8')); items.push({ id: decodeURIComponent(n.slice(0, -5)), name: t.name, updatedAt: t.updatedAt }); } catch { /* пропускаем битый файл */ }
  }
  return items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function saveTemplate(id, body) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120) throw Object.assign(new Error('Нужно название шаблона до 120 знаков'), { status: 400 });
  if (!Array.isArray(body.blocks) || body.blocks.length > 200) throw Object.assign(new Error('В шаблоне нет блоков'), { status: 400 });
  await mkdir(TPL, { recursive: true }); await mkdir(BACKUP, { recursive: true });
  const f = file(id);
  // Перед перезаписью сохраняем прежнюю версию; держим 10 последних на шаблон.
  if (existsSync(f)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await copyFile(f, path.join(BACKUP, `${encodeURIComponent(id)}__${stamp}.json`));
    const old = (await readdir(BACKUP)).filter((n) => n.startsWith(`${encodeURIComponent(id)}__`)).sort();
    for (const n of old.slice(0, -10)) await unlink(path.join(BACKUP, n)).catch(() => {});
  }
  const tmp = `${f}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ name: body.name.trim(), blocks: body.blocks, updatedAt: new Date().toISOString() }));
  await rename(tmp, f);
}

// --- Статика ---
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
async function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const full = path.join(PUBLIC, path.normalize(rel));
  if (!full.startsWith(PUBLIC + path.sep)) return fail(res, 404, 'NOT_FOUND', 'Не найдено');
  try {
    const s = await stat(full);
    if (!s.isFile()) throw new Error('dir');
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SEC });
    res.end(body);
  } catch { fail(res, 404, 'NOT_FOUND', 'Не найдено'); }
}

// --- Маршруты ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  try {
    if (p === '/api/health') return send(res, 200, { ok: true });

    if (p === '/api/session' && req.method === 'POST') {
      if (cfg.noAuth) return send(res, 200, { ok: true });
      if (tooMany(ip)) return fail(res, 429, 'TOO_MANY', 'Слишком много попыток. Подождите 10 минут.');
      const { token } = await readBody(req, 4096);
      if (!(await checkToken(String(token || '')))) return fail(res, 401, 'BAD_TOKEN', 'Ссылка недействительна или устарела. Откройте редактор заново из «Менеджмента».');
      return send(res, 200, { ok: true }, undefined, {
        'Set-Cookie': `${COOKIE}=${makeSession()}; Path=${cfg.cookiePath}; HttpOnly; Secure; SameSite=Strict; Max-Age=${cfg.ttlMin * 60}`,
      });
    }

    if (p.startsWith('/api/')) {
      if (!validSession(req)) return fail(res, 401, 'AUTH', 'Нужен вход через «Менеджмент»');
      if (req.method !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json')) return fail(res, 415, 'TYPE', 'Нужен JSON');
      if (p === '/api/me') return send(res, 200, { ok: true });
      if (p === '/api/templates' && req.method === 'GET') return send(res, 200, { items: await listTemplates() });
      const m = p.match(/^\/api\/templates\/([^/]+)$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (!idOk(id)) return fail(res, 400, 'BAD_ID', 'Неверное имя шаблона');
        if (req.method === 'GET') {
          try { return send(res, 200, JSON.parse(await readFile(file(id), 'utf8'))); } catch { return fail(res, 404, 'NOT_FOUND', 'Шаблон не найден'); }
        }
        if (req.method === 'PUT') { await saveTemplate(id, await readBody(req)); return send(res, 200, { ok: true, id }); }
        if (req.method === 'DELETE') { await unlink(file(id)).catch(() => {}); return send(res, 200, { ok: true }); }
      }
      return fail(res, 404, 'NOT_FOUND', 'Не найдено');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'METHOD', 'Метод не поддерживается');
    return serveStatic(res, p);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    return fail(res, status, 'ERROR', status === 500 ? 'Внутренняя ошибка сервера' : e.message);
  }
});

server.listen(cfg.port, cfg.host, () => {
  console.log(`Редактор rich-контента: http://${cfg.host}:${cfg.port}/ ${cfg.noAuth ? '(без входа — только для проверки на своём компьютере)' : ''}`);
});
