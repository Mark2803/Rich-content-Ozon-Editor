// Превращает DATABASE_URL в переменные окружения для psql (PGHOST, PGPASSWORD и т. д.).
// Так пароль базы не попадает в командную строку, которую видят все пользователи сервера.
// Так же сделано у «Воронки продаж WB».
export function pgEnv(databaseUrl) {
  const raw = String(databaseUrl || '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!raw) return null;
  const u = new URL(raw);
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error('DATABASE_URL должен начинаться с postgresql://');
  const env = {
    PGHOST: decodeURIComponent(u.hostname || 'localhost'),
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username || ''),
    PGPASSWORD: decodeURIComponent(u.password || ''),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
  const ssl = u.searchParams.get('sslmode');
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}
