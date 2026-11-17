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
    condicoes.push(`p.id_categoria = $${values.length}`);
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
    SELECT
      p.id_produto AS id,
      p.id_produto,
      p.id_categoria AS categoria_id,
      p.id_categoria,
      p.nome,
      p.descricao,
      p.preco,
      p.imagem_url AS foto_webp,
      p.imagem_url,
      p.oculto,
      c.nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON p.id_categoria = c.id_categoria
    ${where}
    ORDER BY p.id_produto ASC;
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

// Busca um produto específico pelo ID
async function buscarItemCardapioPorId(id) {
  const query = `
    SELECT
      p.id_produto AS id,
      p.id_produto,
      p.id_categoria AS categoria_id,
      p.id_categoria,
      p.nome,
      p.descricao,
      p.preco,
      p.imagem_url AS foto_webp,
      p.imagem_url,
      p.oculto,
      c.nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON p.id_categoria = c.id_categoria
    WHERE p.id_produto = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

// Cria um novo produto no banco já salvando a imagem
async function criarProduto(produto) {
  const idCategoria = produto.id_categoria ?? produto.categoria_id;
  const imagemUrl = produto.imagem_url ?? produto.foto_webp ?? null;

  const query = `
    INSERT INTO Produto (id_categoria, nome, descricao, preco, imagem_url, oculto)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      *,
      id_produto AS id,
      id_categoria AS categoria_id,
      imagem_url AS foto_webp;
  `;
  const values = [
    idCategoria,
    produto.nome,
    produto.descricao || '',
    produto.preco,
    imagemUrl,
    produto.oculto || false,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza apenas os campos enviados de um produto existente
async function atualizarProduto(id, campos) {
  const normalizados = { ...campos };
  if (normalizados.categoria_id !== undefined && normalizados.id_categoria === undefined) {
    normalizados.id_categoria = normalizados.categoria_id;
  }
  if (normalizados.foto_webp !== undefined && normalizados.imagem_url === undefined) {
    normalizados.imagem_url = normalizados.foto_webp;
  }

  const permitidos = ['id_categoria', 'nome', 'descricao', 'preco', 'imagem_url', 'oculto'];
  const chaves = Object.keys(normalizados).filter(
    (chave) => permitidos.includes(chave) && normalizados[chave] !== undefined
  );

  if (chaves.length === 0) {
    return buscarItemCardapioPorId(id);
  }

  const sets = chaves.map((chave, index) => `${chave} = $${index + 1}`);
  const values = chaves.map((chave) => normalizados[chave]);
  values.push(id);

  const query = `
    UPDATE Produto
    SET ${sets.join(', ')}
    WHERE id_produto = $${values.length}
    RETURNING
      *,
      id_produto AS id,
      id_categoria AS categoria_id,
      imagem_url AS foto_webp;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// Remove um produto do cardápio pelo ID
async function deletarProduto(id) {
  const query = `
    DELETE FROM Produto
    WHERE id_produto = $1
    RETURNING *, id_produto AS id;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

// Busca as categorias cadastradas
async function listarCategorias(apenasAtivas = false) {
  const filtro = apenasAtivas ? 'WHERE ativo = true' : '';
  const query = `
    SELECT id_categoria AS id, id_categoria, nome, ordem_exibicao, ativo
    FROM Categoria
    ${filtro}
    ORDER BY COALESCE(ordem_exibicao, id_categoria) ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

// Busca uma categoria pelo ID
async function buscarCategoriaPorId(id) {
  const query = `
    SELECT id_categoria AS id, id_categoria, nome, ordem_exibicao, ativo
    FROM Categoria
    WHERE id_categoria::text = $1;
  `;
  const result = await pool.query(query, [String(id)]);
  return result.rows[0] || null;
}

// Cria uma nova categoria no banco
async function criarCategoria(categoria) {
  const query = `
    INSERT INTO Categoria (nome, ordem_exibicao, ativo)
    VALUES ($1, $2, $3)
    RETURNING *, id_categoria AS id;
  `;
  const values = [
    categoria.nome,
    categoria.ordem_exibicao ?? null,
    categoria.ativo !== false,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza os campos enviados de uma categoria existente
async function atualizarCategoria(id, campos) {
  const permitidos = ['nome', 'ordem_exibicao', 'ativo'];
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
    WHERE id_categoria = $${values.length}
    RETURNING *, id_categoria AS id;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// Remove uma categoria do banco
async function deletarCategoria(id) {
  const query = `
    DELETE FROM Categoria
    WHERE id_categoria = $1
    RETURNING *, id_categoria AS id;
  `;
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
