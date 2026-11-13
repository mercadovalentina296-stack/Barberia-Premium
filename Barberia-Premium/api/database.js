// Adaptador SQL para Supabase Database (PostgreSQL).
// Mantiene la interfaz db.query() existente para no modificar las rutas de la API.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('Falta DATABASE_URL en .env. Copiá la cadena de conexión de Supabase.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function query(sql, params = []) {
  let index = 0;
  let statement = sql.replace(/\?/g, () => `$${++index}`);
  statement = statement.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');

  const isInsert = /^\s*INSERT\s+INTO/i.test(statement);
  if (isInsert && !/\bRETURNING\b/i.test(statement)) {
    statement = statement.replace(/;?\s*$/, ' RETURNING id');
  }

  const result = await pool.query(statement, params);
  if (/^\s*SELECT\b/i.test(statement) || /^\s*WITH\b/i.test(statement)) {
    return [result.rows];
  }
  if (isInsert) {
    return [{ insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount }];
  }
  return [{ affectedRows: result.rowCount }];
}

module.exports = { query, pool };
