/**
 * @file db.js
 * @description Re-exporta o pool de conexão do PostgreSQL (`src/db.js`)
 * para manter compatibilidade com `require('./db')` dentro de `src/database/queries.js`.
 */

const pool = require('../db');

module.exports = pool;
