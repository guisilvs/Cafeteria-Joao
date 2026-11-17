const pool = require('./db'); // Conexão com o banco de dados PostgreSQL

// Busca todos os produtos do cardápio
async function listarItensCardapio(filtros = {}) {
  const result = await pool.query('SELECT * FROM Produto');
  return result.rows;
}

// Busca todas as categorias disponíveis
async function listarCategorias(apenasAtivas = false) {
  const result = await pool.query('SELECT * FROM Categoria');
  return result.rows;
}

// Exporta as query functions para o repositorioCore
module.exports = {
  listarItensCardapio,
  listarCategorias,
};
