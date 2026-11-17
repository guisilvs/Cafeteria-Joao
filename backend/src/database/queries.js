const pool = require('./db'); // Conexão com o banco de dados PostgreSQL

// ============================================================================
// FUNÇÕES AUXILIARES DE NORMALIZAÇÃO DE TIPOS DO POSTGRESQL
// ============================================================================

function normalizarProduto(row) {
  if (!row) return null;
  return {
    ...row,
    preco: Number(row.preco),
    oculto: Boolean(row.oculto),
  };
}

function normalizarUsuario(row) {
  if (!row) return null;
  return {
    ...row,
    ativo: row.ativo !== false,
    precisa_trocar_senha: Boolean(row.precisa_trocar_senha),
    favoritos: Array.isArray(row.favoritos) ? row.favoritos : [],
  };
}

function normalizarPedido(row) {
  if (!row) return null;
  return {
    ...row,
    numero: row.numero || row.id,
    total: Number(row.total),
    itens: Array.isArray(row.itens) ? row.itens : [],
  };
}

// ============================================================================
// 1. PRODUTOS DO CARDÁPIO (Tabela: Produto)
// ============================================================================

// Busca todos os produtos do cardápio (com suporte aos filtros do sistema)
async function listarItensCardapio(filtros = {}) {
  const { categoriaId, categoriaNome, incluirOcultos = false, busca } = filtros;
  const condicoes = [];
  const valores = [];

  if (!incluirOcultos) {
    condicoes.push('p.oculto = FALSE');
  }

  if (categoriaId !== undefined && categoriaId !== null && categoriaId !== '') {
    valores.push(Number(categoriaId));
    condicoes.push(`p.categoria_id = $${valores.length}`);
  }

  if (categoriaNome) {
    valores.push(String(categoriaNome).trim());
    condicoes.push(`LOWER(c.nome) = LOWER($${valores.length})`);
  }

  if (busca) {
    valores.push(`%${String(busca).trim()}%`);
    condicoes.push(`(p.nome ILIKE $${valores.length} OR p.descricao ILIKE $${valores.length})`);
  }

  const whereSql = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  const query = `
    SELECT p.*, c.nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON c.id = p.categoria_id
    ${whereSql}
    ORDER BY p.id ASC;
  `;

  const result = await pool.query(query, valores);
  return result.rows.map(normalizarProduto);
}

// Busca um único produto pelo ID
async function buscarItemCardapioPorId(id) {
  const query = `
    SELECT p.*, c.nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON c.id = p.categoria_id
    WHERE p.id = $1;
  `;
  const result = await pool.query(query, [Number(id)]);
  return normalizarProduto(result.rows[0]);
}

// Cria um novo produto no banco e devolve os dados do item criado
async function criarProduto(produto) {
  const query = `
    INSERT INTO Produto (categoria_id, nome, descricao, preco, foto_webp, oculto)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [
    Number(produto.categoria_id),
    produto.nome,
    produto.descricao || '',
    Number(produto.preco),
    produto.foto_webp || null,
    Boolean(produto.oculto),
  ];
  const result = await pool.query(query, values);
  return buscarItemCardapioPorId(result.rows[0].id);
}

// Atualiza os dados de um produto existente baseado no ID dele (suporta atualização parcial ou completa)
async function atualizarProduto(id, produto) {
  const query = `
    UPDATE Produto
    SET
      categoria_id = COALESCE($1, categoria_id),
      nome = COALESCE($2, nome),
      descricao = COALESCE($3, descricao),
      preco = COALESCE($4, preco),
      foto_webp = CASE WHEN $5::boolean THEN $6 ELSE foto_webp END,
      oculto = COALESCE($7, oculto)
    WHERE id = $8
    RETURNING *;
  `;
  const alterarFoto = Object.prototype.hasOwnProperty.call(produto, 'foto_webp');
  const values = [
    produto.categoria_id !== undefined ? Number(produto.categoria_id) : null,
    produto.nome !== undefined ? produto.nome : null,
    produto.descricao !== undefined ? produto.descricao : null,
    produto.preco !== undefined ? Number(produto.preco) : null,
    alterarFoto,
    alterarFoto ? produto.foto_webp : null,
    produto.oculto !== undefined ? Boolean(produto.oculto) : null,
    Number(id),
  ];
  const result = await pool.query(query, values);
  if (!result.rows[0]) return null;
  return buscarItemCardapioPorId(result.rows[0].id);
}

// Remove um produto do cardápio baseado no ID
async function deletarProduto(id) {
  const query = 'DELETE FROM Produto WHERE id = $1 RETURNING *;';
  const result = await pool.query(query, [Number(id)]);
  return result.rows[0] || null;
}

// ============================================================================
// 2. CATEGORIAS DO CARDÁPIO (Tabela: Categoria)
// ============================================================================

// Busca todas as categorias disponíveis
async function listarCategorias(apenasAtivas = false) {
  const query = apenasAtivas
    ? 'SELECT * FROM Categoria WHERE ativo = TRUE ORDER BY ordem ASC, id ASC;'
    : 'SELECT * FROM Categoria ORDER BY ordem ASC, id ASC;';
  const result = await pool.query(query);
  return result.rows;
}

// Busca uma categoria por ID ou por slug/nome
async function buscarCategoriaPorId(identificador) {
  const comoNumero = Number(identificador);
  if (Number.isInteger(comoNumero) && comoNumero > 0 && String(comoNumero) === String(identificador).trim()) {
    const resId = await pool.query('SELECT * FROM Categoria WHERE id = $1;', [comoNumero]);
    if (resId.rows[0]) return resId.rows[0];
  }

  const texto = String(identificador || '').trim();
  const resTexto = await pool.query(
    'SELECT * FROM Categoria WHERE LOWER(COALESCE(slug, \'\')) = LOWER($1) OR LOWER(nome) = LOWER($1) LIMIT 1;',
    [texto]
  );
  return resTexto.rows[0] || null;
}

// Cria uma nova categoria no banco
async function criarCategoria(categoria) {
  const slug =
    categoria.slug ||
    String(categoria.nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const query = `
    INSERT INTO Categoria (nome, slug, ordem, ativo)
    VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM Categoria)), $4)
    RETURNING *;
  `;
  const values = [
    categoria.nome,
    slug,
    categoria.ordem !== undefined ? Number(categoria.ordem) : null,
    categoria.ativo !== false,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Atualiza o nome, ordem ou status (ativo/inativo) de uma categoria existente
async function atualizarCategoria(id, categoria) {
  const query = `
    UPDATE Categoria
    SET
      nome = COALESCE($1, nome),
      slug = COALESCE($2, slug),
      ordem = COALESCE($3, ordem),
      ativo = COALESCE($4, ativo)
    WHERE id = $5
    RETURNING *;
  `;
  const values = [
    categoria.nome !== undefined ? categoria.nome : null,
    categoria.slug !== undefined ? categoria.slug : null,
    categoria.ordem !== undefined ? Number(categoria.ordem) : null,
    categoria.ativo !== undefined ? Boolean(categoria.ativo) : null,
    Number(id),
  ];
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// Remove uma categoria do banco
async function deletarCategoria(id) {
  const query = 'DELETE FROM Categoria WHERE id = $1 RETURNING *;';
  const result = await pool.query(query, [Number(id)]);
  return result.rows[0] || null;
}

// ============================================================================
// 3. USUÁRIOS: CLIENTES, FUNCIONÁRIOS E ADMIN (Tabela: Usuario)
// ============================================================================

async function buscarUsuarioPorId(id) {
  const result = await pool.query('SELECT * FROM Usuario WHERE id = $1;', [Number(id)]);
  return normalizarUsuario(result.rows[0]);
}

async function buscarUsuarioPorEmail(email) {
  const result = await pool.query('SELECT * FROM Usuario WHERE LOWER(email) = LOWER($1) LIMIT 1;', [
    String(email || '').trim(),
  ]);
  return normalizarUsuario(result.rows[0]);
}

async function buscarUsuarioPorTelefone(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  const result = await pool.query(
    `SELECT * FROM Usuario WHERE REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') = $1 LIMIT 1;`,
    [digitos]
  );
  return normalizarUsuario(result.rows[0]);
}

async function buscarUsuarioPorLogin(loginOuNome) {
  const termo = String(loginOuNome || '').trim();
  const result = await pool.query(
    `SELECT * FROM Usuario
     WHERE LOWER(COALESCE(login, '')) = LOWER($1)
        OR LOWER(nome) = LOWER($1)
     ORDER BY CASE WHEN tipo = 'admin' THEN 0 ELSE 1 END
     LIMIT 1;`,
    [termo]
  );
  return normalizarUsuario(result.rows[0]);
}

async function listarUsuarios(filtros = {}) {
  const { tipo, ativo, cargo, busca } = filtros;
  const condicoes = [];
  const valores = [];

  if (tipo) {
    if (tipo === 'interno') {
      condicoes.push(`tipo IN ('admin', 'funcionario')`);
    } else {
      valores.push(tipo);
      condicoes.push(`tipo = $${valores.length}`);
    }
  }

  if (ativo !== undefined && ativo !== null && ativo !== '') {
    const boolAtivo = ativo === true || ativo === 'true' || ativo === '1' || ativo === 1;
    valores.push(boolAtivo);
    condicoes.push(`ativo = $${valores.length}`);
  }

  if (cargo) {
    valores.push(`%${String(cargo).trim()}%`);
    condicoes.push(`cargo ILIKE $${valores.length}`);
  }

  if (busca) {
    valores.push(`%${String(busca).trim()}%`);
    condicoes.push(
      `(nome ILIKE $${valores.length} OR email ILIKE $${valores.length} OR COALESCE(telefone, '') ILIKE $${valores.length} OR COALESCE(cargo, '') ILIKE $${valores.length} OR COALESCE(login, '') ILIKE $${valores.length})`
    );
  }

  const whereSql = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM Usuario ${whereSql} ORDER BY id ASC;`, valores);
  return result.rows.map(normalizarUsuario);
}

async function criarUsuario(dados) {
  const query = `
    INSERT INTO Usuario (login, nome, email, telefone, senha_hash, tipo, cargo, foto_webp, ativo, precisa_trocar_senha, favoritos)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    RETURNING *;
  `;
  const values = [
    dados.login || null,
    dados.nome,
    dados.email,
    dados.telefone || '',
    dados.senha_hash,
    dados.tipo || 'cliente',
    dados.cargo || null,
    dados.foto_webp || null,
    dados.ativo !== undefined ? Boolean(dados.ativo) : true,
    Boolean(dados.precisa_trocar_senha),
    JSON.stringify(Array.isArray(dados.favoritos) ? dados.favoritos : []),
  ];
  const result = await pool.query(query, values);
  return normalizarUsuario(result.rows[0]);
}

async function atualizarUsuario(id, campos) {
  const alterarFoto = Object.prototype.hasOwnProperty.call(campos, 'foto_webp');
  const alterarCargo = Object.prototype.hasOwnProperty.call(campos, 'cargo');
  const alterarLogin = Object.prototype.hasOwnProperty.call(campos, 'login');
  const alterarSenha = Boolean(campos.senha_hash);

  const query = `
    UPDATE Usuario
    SET
      login = CASE WHEN $1::boolean THEN $2 ELSE login END,
      nome = COALESCE($3, nome),
      email = COALESCE($4, email),
      telefone = COALESCE($5, telefone),
      senha_hash = COALESCE($6, senha_hash),
      precisa_trocar_senha = CASE
        WHEN $7::boolean THEN $8
        WHEN $9::boolean THEN FALSE
        ELSE precisa_trocar_senha
      END,
      tipo = COALESCE($10, tipo),
      cargo = CASE WHEN $11::boolean THEN $12 ELSE cargo END,
      foto_webp = CASE WHEN $13::boolean THEN $14 ELSE foto_webp END,
      ativo = COALESCE($15, ativo),
      favoritos = COALESCE($16::jsonb, favoritos),
      ultimo_acesso = COALESCE($17::timestamp, ultimo_acesso)
    WHERE id = $18
    RETURNING *;
  `;

  const temFlagTrocaSenha = campos.precisa_trocar_senha !== undefined;
  const values = [
    alterarLogin,
    alterarLogin ? campos.login : null,
    campos.nome !== undefined ? campos.nome : null,
    campos.email !== undefined ? campos.email : null,
    campos.telefone !== undefined ? campos.telefone : null,
    campos.senha_hash || null,
    temFlagTrocaSenha,
    temFlagTrocaSenha ? Boolean(campos.precisa_trocar_senha) : false,
    alterarSenha,
    campos.tipo !== undefined ? campos.tipo : null,
    alterarCargo,
    alterarCargo ? campos.cargo : null,
    alterarFoto,
    alterarFoto ? campos.foto_webp : null,
    campos.ativo !== undefined ? Boolean(campos.ativo) : null,
    campos.favoritos !== undefined ? JSON.stringify(campos.favoritos) : null,
    campos.ultimo_acesso !== undefined ? campos.ultimo_acesso : null,
    Number(id),
  ];

  const result = await pool.query(query, values);
  return normalizarUsuario(result.rows[0]);
}

async function removerUsuario(id) {
  const result = await pool.query('DELETE FROM Usuario WHERE id = $1 RETURNING id;', [Number(id)]);
  return result.rowCount > 0;
}

// ============================================================================
// 4. CARRINHO / SACOLA DO USUÁRIO (Tabela: Sacola_Item)
// ============================================================================

async function obterSacolaUsuario(usuarioId) {
  const query = `
    SELECT produto_id AS item_id, quantidade
    FROM Sacola_Item
    WHERE usuario_id = $1
    ORDER BY id ASC;
  `;
  const result = await pool.query(query, [Number(usuarioId)]);
  return result.rows.map((r) => ({
    item_id: Number(r.item_id),
    quantidade: Number(r.quantidade),
  }));
}

async function salvarSacolaUsuario(usuarioId, itensSacola = []) {
  const uId = Number(usuarioId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM Sacola_Item WHERE usuario_id = $1;', [uId]);

    for (const item of itensSacola) {
      await client.query(
        `INSERT INTO Sacola_Item (usuario_id, produto_id, quantidade)
         VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id, produto_id)
         DO UPDATE SET quantidade = EXCLUDED.quantidade;`,
        [uId, Number(item.item_id), Number(item.quantidade)]
      );
    }

    await client.query('COMMIT');
    return itensSacola;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

// ============================================================================
// 5. PEDIDOS (Tabela: Pedido)
// ============================================================================

async function obterProximoNumeroPedido() {
  const result = await pool.query(
    'SELECT COALESCE(MAX(COALESCE(numero, id)), 52680) + 1 AS proximo FROM Pedido;'
  );
  return Number(result.rows[0].proximo);
}

async function criarPedido(dados) {
  const proximoNumero = await obterProximoNumeroPedido();
  const query = `
    INSERT INTO Pedido (
      numero, usuario_id, cliente_nome, cliente_foto,
      itens, total, unidade_retirada, previsao_minutos, observacoes, status
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
    RETURNING *;
  `;
  const values = [
    dados.numero || proximoNumero,
    Number(dados.usuario_id),
    dados.cliente_nome,
    dados.cliente_foto || null,
    JSON.stringify(Array.isArray(dados.itens) ? dados.itens : []),
    Number(dados.total),
    dados.unidade_retirada || 'Shopping Beira Mar',
    Number(dados.previsao_minutos) || 5,
    dados.observacoes || null,
    dados.status || 'preparando',
  ];
  const result = await pool.query(query, values);
  return normalizarPedido(result.rows[0]);
}

async function buscarPedidoPorId(idOuNumero) {
  const num = Number(idOuNumero);
  const result = await pool.query(
    'SELECT * FROM Pedido WHERE id = $1 OR numero = $1 LIMIT 1;',
    [num]
  );
  return normalizarPedido(result.rows[0]);
}

async function listarPedidos(filtros = {}) {
  const { usuarioId, status, apenasEmAndamento, apenasHistorico } = filtros;
  const condicoes = [];
  const valores = [];

  if (usuarioId !== undefined && usuarioId !== null) {
    valores.push(Number(usuarioId));
    condicoes.push(`usuario_id = $${valores.length}`);
  }

  if (status) {
    if (Array.isArray(status)) {
      valores.push(status);
      condicoes.push(`status = ANY($${valores.length})`);
    } else {
      valores.push(status);
      condicoes.push(`status = $${valores.length}`);
    }
  }

  if (apenasEmAndamento) {
    condicoes.push(`status IN ('pendente', 'preparando')`);
  }

  if (apenasHistorico) {
    condicoes.push(`status IN ('concluido', 'cancelado')`);
  }

  const whereSql = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM Pedido ${whereSql} ORDER BY COALESCE(numero, id) DESC;`,
    valores
  );
  return result.rows.map(normalizarPedido);
}

async function atualizarPedido(idOuNumero, campos) {
  const alterarFinalizadoEm = Object.prototype.hasOwnProperty.call(campos, 'finalizado_em');
  const alterarObservacoes = Object.prototype.hasOwnProperty.call(campos, 'observacoes');

  const query = `
    UPDATE Pedido
    SET
      cliente_nome = COALESCE($1, cliente_nome),
      itens = COALESCE($2::jsonb, itens),
      total = COALESCE($3, total),
      unidade_retirada = COALESCE($4, unidade_retirada),
      previsao_minutos = COALESCE($5, previsao_minutos),
      observacoes = CASE WHEN $6::boolean THEN $7 ELSE observacoes END,
      status = COALESCE($8, status),
      finalizado_em = CASE WHEN $9::boolean THEN $10::timestamp ELSE finalizado_em END
    WHERE id = $11 OR numero = $11
    RETURNING *;
  `;
  const values = [
    campos.cliente_nome !== undefined ? campos.cliente_nome : null,
    campos.itens !== undefined ? JSON.stringify(campos.itens) : null,
    campos.total !== undefined ? Number(campos.total) : null,
    campos.unidade_retirada !== undefined ? campos.unidade_retirada : null,
    campos.previsao_minutos !== undefined ? Number(campos.previsao_minutos) : null,
    alterarObservacoes,
    alterarObservacoes ? campos.observacoes : null,
    campos.status !== undefined ? campos.status : null,
    alterarFinalizadoEm,
    alterarFinalizadoEm ? campos.finalizado_em : null,
    Number(idOuNumero),
  ];

  const result = await pool.query(query, values);
  return normalizarPedido(result.rows[0]);
}

async function removerPedido(idOuNumero) {
  const result = await pool.query(
    'DELETE FROM Pedido WHERE id = $1 OR numero = $1 RETURNING id;',
    [Number(idOuNumero)]
  );
  return result.rowCount > 0;
}

// Exporta todas as funções (mantendo os nomes originais do colega e os aliases do Core)
module.exports = {
  // Produtos (nomes do colega + aliases)
  listarItensCardapio,
  buscarItemCardapioPorId,
  criarProduto,
  criarItemCardapio: criarProduto,
  atualizarProduto,
  atualizarItemCardapio: atualizarProduto,
  deletarProduto,
  removerItemCardapio: deletarProduto,

  // Categorias (nomes do colega + aliases)
  listarCategorias,
  buscarCategoriaPorId,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
  removerCategoria: deletarCategoria,

  // Usuários
  buscarUsuarioPorId,
  buscarUsuarioPorEmail,
  buscarUsuarioPorTelefone,
  buscarUsuarioPorLogin,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  removerUsuario,

  // Sacola e Pedidos
  obterSacolaUsuario,
  salvarSacolaUsuario,
  obterProximoNumeroPedido,
  criarPedido,
  buscarPedidoPorId,
  listarPedidos,
  atualizarPedido,
  removerPedido,
};
