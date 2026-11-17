const pool = require('./db'); // Conexão com o banco de dados PostgreSQL

// Busca os produtos do cardápio aplicando os filtros de categoria, busca e visibilidade
async function listarItensCardapio(filtros = {}) {
  const { categoriaId, categoriaNome, incluirOcultos = false, busca } = filtros;
  const condicoes = [];
  const values = [];

  if (!incluirOcultos) {
    condicoes.push('p.oculto = false');
  }

  if (categoriaId !== undefined && categoriaId !== null && categoriaId !== '') {
    values.push(categoriaId);
    condicoes.push(`p.categoria_id = $${values.length}`);
  }

  if (categoriaNome) {
    values.push(String(categoriaNome).trim());
    condicoes.push(`LOWER(c.nome) = LOWER($${values.length})`);
  }

  if (busca) {
    values.push(`%${String(busca).trim()}%`);
    condicoes.push(`(p.nome ILIKE $${values.length} OR p.descricao ILIKE $${values.length})`);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  const query = `
    SELECT p.*, c.nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON p.categoria_id = c.id
    ${where}
    ORDER BY p.id ASC;
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

// Busca um produto específico pelo ID
async function buscarItemCardapioPorId(id) {
  const query = `
    SELECT p.*, c.nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON p.categoria_id = c.id
    WHERE p.id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

// Cria um novo produto no banco já salvando a foto
async function criarProduto(produto) {
  const query = `
    INSERT INTO Produto (categoria_id, nome, descricao, preco, foto_webp, oculto)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [
    produto.categoria_id,
    produto.nome,
    produto.descricao || '',
    produto.preco,
    produto.foto_webp || null,
    produto.oculto || false,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza apenas os campos enviados de um produto existente
async function atualizarProduto(id, campos) {
  const permitidos = ['categoria_id', 'nome', 'descricao', 'preco', 'foto_webp', 'oculto'];
  const chaves = Object.keys(campos).filter(
    (chave) => permitidos.includes(chave) && campos[chave] !== undefined
  );

  if (chaves.length === 0) {
    return buscarItemCardapioPorId(id);
  }

  const sets = chaves.map((chave, index) => `${chave} = $${index + 1}`);
  const values = chaves.map((chave) => campos[chave]);
  values.push(id);

  const query = `
    UPDATE Produto
    SET ${sets.join(', ')}
    WHERE id = $${values.length}
    RETURNING *;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// Remove um produto do cardápio pelo ID
async function deletarProduto(id) {
  const query = 'DELETE FROM Produto WHERE id = $1 RETURNING *;';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

// Busca as categorias cadastradas
async function listarCategorias(apenasAtivas = false) {
  const query = apenasAtivas
    ? 'SELECT * FROM Categoria WHERE ativo = true ORDER BY id ASC;'
    : 'SELECT * FROM Categoria ORDER BY id ASC;';
  const result = await pool.query(query);
  return result.rows;
}

// Busca uma categoria pelo ID
async function buscarCategoriaPorId(id) {
  const query = 'SELECT * FROM Categoria WHERE id::text = $1;';
  const result = await pool.query(query, [String(id)]);
  return result.rows[0] || null;
}

// Cria uma nova categoria no banco
async function criarCategoria(categoria) {
  const query = `
    INSERT INTO Categoria (nome, ativo)
    VALUES ($1, $2)
    RETURNING *;
  `;
  const values = [categoria.nome, categoria.ativo !== false];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza os campos enviados de uma categoria existente
async function atualizarCategoria(id, campos) {
  const permitidos = ['nome', 'ativo'];
  const chaves = Object.keys(campos).filter(
    (chave) => permitidos.includes(chave) && campos[chave] !== undefined
  );

  if (chaves.length === 0) {
    return buscarCategoriaPorId(id);
  }

  const sets = chaves.map((chave, index) => `${chave} = $${index + 1}`);
  const values = chaves.map((chave) => campos[chave]);
  values.push(id);

  const query = `
    UPDATE Categoria
    SET ${sets.join(', ')}
    WHERE id = $${values.length}
    RETURNING *;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// Remove uma categoria do banco
async function deletarCategoria(id) {
  const query = 'DELETE FROM Categoria WHERE id = $1 RETURNING *;';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

// Exporta todas as funções para o repositorioCore
module.exports = {
  listarItensCardapio,
  buscarItemCardapioPorId,
  criarProduto,
  atualizarProduto,
  deletarProduto,

  listarCategorias,
  buscarCategoriaPorId,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
};
