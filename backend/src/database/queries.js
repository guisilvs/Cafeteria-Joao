const pool = require('./db'); // Conexão com o banco de dados PostgreSQL

// Busca todos os produtos do cardápio
async function listarItensCardapio(filtros = {}) {
  const result = await pool.query('SELECT * FROM Produto');
  return result.rows;
}

// Cria um novo produto no banco e devolve os dados do item criado
async function criarProduto(produto) {
  const query = `
    INSERT INTO Produto (categoria_id, nome, descricao, preco, oculto)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [produto.categoria_id, produto.nome, produto.descricao, produto.preco, produto.oculto || false];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza os dados de um produto existente baseado no ID dele
async function atualizarProduto(id, produto) {
  const query = `
    UPDATE Produto
    SET categoria_id = $1, nome = $2, descricao = $3, preco = $4, oculto = $5
    WHERE id = $6
    RETURNING *;
  `;
  const values = [produto.categoria_id, produto.nome, produto.descricao, produto.preco, produto.oculto, id];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Remove um produto do cardápio baseado no ID
async function deletarProduto(id) {
  const query = 'DELETE FROM Produto WHERE id = $1 RETURNING *;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

// Busca todas as categorias disponíveis
async function listarCategorias(apenasAtivas = false) {
  const result = await pool.query('SELECT * FROM Categoria');
  return result.rows;
}

// Cria uma nova categoria no banco
async function criarCategoria(categoria) {
  const query = `
    INSERT INTO Categoria (nome, ativo)
    VALUES ($1, $2)
    RETURNING *;
  `;
  const values = [categoria.nome, categoria.ativo !== false]; // Se não for enviado, padrão é true
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza o nome ou status (ativo/inativo) de uma categoria existente
async function atualizarCategoria(id, categoria) {
  const query = `
    UPDATE Categoria
    SET nome = $1, ativo = $2
    WHERE id = $3
    RETURNING *;
  `;
  const values = [categoria.nome, categoria.ativo, id];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Remove uma categoria do banco
async function deletarCategoria(id) {
  const query = 'DELETE FROM Categoria WHERE id = $1 RETURNING *;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

// Exporta todas as funções para serem usadas pelo resto do sistema
module.exports = {
  listarItensCardapio,
  criarProduto,
  atualizarProduto,
  deletarProduto,
  
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria
};
