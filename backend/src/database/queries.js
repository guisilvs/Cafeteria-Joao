/**
 * @file queries.js
 * @description Consultas SQL (SELECT, INSERT, UPDATE, DELETE) operando sobre as 8 tabelas
 * da modelagem oficial no PostgreSQL:
 * 1. Cliente
 * 2. Funcionario
 * 3. Categoria
 * 4. Produto
 * 5. Pedido
 * 6. Item_Pedido
 * 7. Pagamento
 * 8. Favorito
 */

const pool = require('./db');
const {
  normalizarOuGerarCpf,
  mapearCategoriaDoBanco,
  mapearProdutoDoBanco,
  mapearClienteDoBanco,
  mapearFuncionarioDoBanco,
  mapearPedidoDoBanco,
} = require('./modelMapper');

// Sacola temporária por sessão de usuário (antes de gravar nas tabelas Pedido + Item_Pedido + Pagamento)
const sacolasTemporarias = new Map();

// ============================================================================
// 1. CATEGORIAS (Tabela: Categoria)
// ============================================================================

async function listarCategorias(apenasAtivas = false) {
  const query = apenasAtivas
    ? 'SELECT * FROM Categoria WHERE Ativo = TRUE ORDER BY COALESCE(Ordem_exibicao, id_categoria) ASC, id_categoria ASC;'
    : 'SELECT * FROM Categoria ORDER BY COALESCE(Ordem_exibicao, id_categoria) ASC, id_categoria ASC;';
  const result = await pool.query(query);
  return result.rows.map(mapearCategoriaDoBanco);
}

async function buscarCategoriaPorId(identificador) {
  const comoNumero = Number(identificador);
  if (
    Number.isInteger(comoNumero) &&
    comoNumero > 0 &&
    String(comoNumero) === String(identificador).trim()
  ) {
    const resId = await pool.query('SELECT * FROM Categoria WHERE id_categoria = $1;', [comoNumero]);
    if (resId.rows[0]) return mapearCategoriaDoBanco(resId.rows[0]);
  }

  const texto = String(identificador || '').trim();
  const resNome = await pool.query('SELECT * FROM Categoria WHERE LOWER(Nome) = LOWER($1) LIMIT 1;', [
    texto,
  ]);
  return mapearCategoriaDoBanco(resNome.rows[0]);
}

async function criarCategoria(categoria) {
  const query = `
    INSERT INTO Categoria (Nome, Ordem_exibicao, Ativo)
    VALUES ($1, COALESCE($2, (SELECT COALESCE(MAX(Ordem_exibicao), 0) + 1 FROM Categoria)), $3)
    RETURNING *;
  `;
  const ordem = categoria.ordem ?? categoria.ordem_exibicao ?? null;
  const values = [categoria.nome, ordem !== null ? Number(ordem) : null, categoria.ativo !== false];
  const result = await pool.query(query, values);
  return mapearCategoriaDoBanco(result.rows[0]);
}

async function atualizarCategoria(id, categoria) {
  const query = `
    UPDATE Categoria
    SET
      Nome = COALESCE($1, Nome),
      Ordem_exibicao = COALESCE($2, Ordem_exibicao),
      Ativo = COALESCE($3, Ativo)
    WHERE id_categoria = $4
    RETURNING *;
  `;
  const ordem = categoria.ordem ?? categoria.ordem_exibicao;
  const values = [
    categoria.nome !== undefined ? categoria.nome : null,
    ordem !== undefined ? Number(ordem) : null,
    categoria.ativo !== undefined ? Boolean(categoria.ativo) : null,
    Number(id),
  ];
  const result = await pool.query(query, values);
  return mapearCategoriaDoBanco(result.rows[0]);
}

async function deletarCategoria(id) {
  const query = 'DELETE FROM Categoria WHERE id_categoria = $1 RETURNING *;';
  const result = await pool.query(query, [Number(id)]);
  return mapearCategoriaDoBanco(result.rows[0]);
}

// ============================================================================
// 2. PRODUTOS DO CARDÁPIO (Tabela: Produto)
// ============================================================================

async function listarItensCardapio(filtros = {}) {
  const { categoriaId, categoriaNome, incluirOcultos = false, busca } = filtros;
  const condicoes = [];
  const valores = [];

  if (!incluirOcultos) {
    condicoes.push('p.Oculto = FALSE');
  }

  if (categoriaId !== undefined && categoriaId !== null && categoriaId !== '') {
    valores.push(Number(categoriaId));
    condicoes.push(`p.id_categoria = $${valores.length}`);
  }

  if (categoriaNome) {
    valores.push(String(categoriaNome).trim());
    condicoes.push(`LOWER(c.Nome) = LOWER($${valores.length})`);
  }

  if (busca) {
    valores.push(`%${String(busca).trim()}%`);
    condicoes.push(`(p.Nome ILIKE $${valores.length} OR COALESCE(p.Descricao, '') ILIKE $${valores.length})`);
  }

  const whereSql = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  const query = `
    SELECT p.*, c.Nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON c.id_categoria = p.id_categoria
    ${whereSql}
    ORDER BY p.id_produto ASC;
  `;

  const result = await pool.query(query, valores);
  return result.rows.map(mapearProdutoDoBanco);
}

async function buscarItemCardapioPorId(id) {
  const query = `
    SELECT p.*, c.Nome AS categoria_nome
    FROM Produto p
    LEFT JOIN Categoria c ON c.id_categoria = p.id_categoria
    WHERE p.id_produto = $1;
  `;
  const result = await pool.query(query, [Number(id)]);
  return mapearProdutoDoBanco(result.rows[0]);
}

async function criarProduto(produto) {
  const query = `
    INSERT INTO Produto (id_categoria, Nome, Descricao, Preco, Imagem_url, Oculto)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id_produto;
  `;
  const catId = Number(produto.categoria_id ?? produto.id_categoria);
  const imagem = produto.foto_webp ?? produto.imagem_url ?? null;
  const values = [
    catId,
    produto.nome,
    String(produto.descricao || '').slice(0, 255),
    Number(produto.preco),
    imagem,
    Boolean(produto.oculto),
  ];
  const result = await pool.query(query, values);
  return buscarItemCardapioPorId(result.rows[0].id_produto);
}

async function atualizarProduto(id, produto) {
  const alterarImagem =
    Object.prototype.hasOwnProperty.call(produto, 'foto_webp') ||
    Object.prototype.hasOwnProperty.call(produto, 'imagem_url');
  const novaImagem = produto.foto_webp ?? produto.imagem_url ?? null;
  const catId = produto.categoria_id ?? produto.id_categoria;

  const query = `
    UPDATE Produto
    SET
      id_categoria = COALESCE($1, id_categoria),
      Nome = COALESCE($2, Nome),
      Descricao = COALESCE($3, Descricao),
      Preco = COALESCE($4, Preco),
      Imagem_url = CASE WHEN $5::boolean THEN $6 ELSE Imagem_url END,
      Oculto = COALESCE($7, Oculto)
    WHERE id_produto = $8
    RETURNING id_produto;
  `;
  const values = [
    catId !== undefined ? Number(catId) : null,
    produto.nome !== undefined ? produto.nome : null,
    produto.descricao !== undefined ? String(produto.descricao).slice(0, 255) : null,
    produto.preco !== undefined ? Number(produto.preco) : null,
    alterarImagem,
    alterarImagem ? novaImagem : null,
    produto.oculto !== undefined ? Boolean(produto.oculto) : null,
    Number(id),
  ];
  const result = await pool.query(query, values);
  if (!result.rows[0]) return null;
  return buscarItemCardapioPorId(result.rows[0].id_produto);
}

async function deletarProduto(id) {
  const idNum = Number(id);
  await pool.query('DELETE FROM Favorito WHERE id_produto = $1;', [idNum]);
  await pool.query('DELETE FROM Item_Pedido WHERE id_produto = $1;', [idNum]);
  const result = await pool.query('DELETE FROM Produto WHERE id_produto = $1 RETURNING *;', [idNum]);
  return mapearProdutoDoBanco(result.rows[0]);
}

// ============================================================================
// 3. USUÁRIOS: TABELAS `Cliente` E `Funcionario` + `Favorito`
// ============================================================================

async function obterIdsFavoritosDoCliente(idCliente) {
  const res = await pool.query(
    'SELECT id_produto FROM Favorito WHERE id_cliente = $1 ORDER BY id_favorito ASC;',
    [Number(idCliente)]
  );
  return res.rows.map((r) => Number(r.id_produto));
}

async function sincronizarFavoritosDoCliente(idCliente, listaIdsProdutos = []) {
  const idCli = Number(idCliente);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM Favorito WHERE id_cliente = $1;', [idCli]);
    for (const idProd of listaIdsProdutos) {
      await client.query(
        'INSERT INTO Favorito (id_cliente, id_produto) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
        [idCli, Number(idProd)]
      );
    }
    await client.query('COMMIT');
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function buscarUsuarioPorId(id) {
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return null;

  // Verifica primeiro em Cliente, depois em Funcionario
  const resCli = await pool.query('SELECT * FROM Cliente WHERE id_cliente = $1;', [idNum]);
  if (resCli.rows[0]) {
    const favs = await obterIdsFavoritosDoCliente(resCli.rows[0].id_cliente);
    return mapearClienteDoBanco(resCli.rows[0], favs);
  }

  const resFunc = await pool.query('SELECT * FROM Funcionario WHERE id_funcionario = $1;', [idNum]);
  if (resFunc.rows[0]) {
    return mapearFuncionarioDoBanco(resFunc.rows[0]);
  }

  return null;
}

async function buscarUsuarioPorEmail(email) {
  const termo = String(email || '').trim();
  const resCli = await pool.query('SELECT * FROM Cliente WHERE LOWER(Email) = LOWER($1) LIMIT 1;', [
    termo,
  ]);
  if (resCli.rows[0]) {
    const favs = await obterIdsFavoritosDoCliente(resCli.rows[0].id_cliente);
    return mapearClienteDoBanco(resCli.rows[0], favs);
  }

  const resFunc = await pool.query(
    'SELECT * FROM Funcionario WHERE LOWER(COALESCE(Email, \'\')) = LOWER($1) LIMIT 1;',
    [termo]
  );
  if (resFunc.rows[0]) {
    return mapearFuncionarioDoBanco(resFunc.rows[0]);
  }

  return null;
}

async function buscarUsuarioPorTelefone(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  const resCli = await pool.query(
    `SELECT * FROM Cliente WHERE REGEXP_REPLACE(COALESCE(Telefone, ''), '\\D', '', 'g') = $1 LIMIT 1;`,
    [digitos]
  );
  if (resCli.rows[0]) {
    const favs = await obterIdsFavoritosDoCliente(resCli.rows[0].id_cliente);
    return mapearClienteDoBanco(resCli.rows[0], favs);
  }

  const resFunc = await pool.query(
    `SELECT * FROM Funcionario WHERE REGEXP_REPLACE(COALESCE(Telefone, ''), '\\D', '', 'g') = $1 LIMIT 1;`,
    [digitos]
  );
  if (resFunc.rows[0]) {
    return mapearFuncionarioDoBanco(resFunc.rows[0]);
  }

  return null;
}

async function buscarUsuarioPorLogin(loginOuNomeOuCpf) {
  const termo = String(loginOuNomeOuCpf || '').trim();
  const digitos = termo.replace(/\D/g, '');

  const resFunc = await pool.query(
    `SELECT * FROM Funcionario
     WHERE LOWER(Nome) = LOWER($1)
        OR LOWER(COALESCE(Email, '')) = LOWER($1)
        OR CPF = $1
        OR ($2 <> '' AND REGEXP_REPLACE(CPF, '\\D', '', 'g') = $2)
     ORDER BY id_funcionario ASC
     LIMIT 1;`,
    [termo, digitos]
  );
  if (resFunc.rows[0]) {
    return mapearFuncionarioDoBanco(resFunc.rows[0]);
  }

  const resCli = await pool.query(
    `SELECT * FROM Cliente
     WHERE LOWER(Nome) = LOWER($1)
        OR LOWER(Email) = LOWER($1)
        OR CPF = $1
        OR ($2 <> '' AND REGEXP_REPLACE(CPF, '\\D', '', 'g') = $2)
     ORDER BY id_cliente ASC
     LIMIT 1;`,
    [termo, digitos]
  );
  if (resCli.rows[0]) {
    const favs = await obterIdsFavoritosDoCliente(resCli.rows[0].id_cliente);
    return mapearClienteDoBanco(resCli.rows[0], favs);
  }

  return null;
}

async function listarUsuarios(filtros = {}) {
  const { tipo, ativo, cargo, busca } = filtros;
  const resultado = [];

  const incluirInternos = !tipo || tipo === 'interno' || tipo === 'funcionario' || tipo === 'admin';
  const incluirClientes = !tipo || tipo === 'cliente';

  if (incluirInternos) {
    const resFunc = await pool.query('SELECT * FROM Funcionario ORDER BY id_funcionario ASC;');
    for (const row of resFunc.rows) {
      resultado.push(mapearFuncionarioDoBanco(row));
    }
  }

  if (incluirClientes) {
    const resCli = await pool.query('SELECT * FROM Cliente ORDER BY id_cliente ASC;');
    for (const row of resCli.rows) {
      const favs = await obterIdsFavoritosDoCliente(row.id_cliente);
      resultado.push(mapearClienteDoBanco(row, favs));
    }
  }

  return resultado.filter((u) => {
    if (tipo && tipo !== 'interno' && u.tipo !== tipo) return false;
    if (ativo !== undefined && ativo !== null && ativo !== '') {
      const boolAtivo = ativo === true || ativo === 'true' || ativo === '1' || ativo === 1;
      if (Boolean(u.ativo) !== boolAtivo) return false;
    }
    if (cargo && (!u.cargo || !u.cargo.toLowerCase().includes(String(cargo).toLowerCase()))) {
      return false;
    }
    if (busca) {
      const t = String(busca).toLowerCase();
      const bate =
        (u.nome && u.nome.toLowerCase().includes(t)) ||
        (u.email && u.email.toLowerCase().includes(t)) ||
        (u.telefone && u.telefone.includes(t)) ||
        (u.cpf && u.cpf.includes(t)) ||
        (u.cargo && u.cargo.toLowerCase().includes(t));
      if (!bate) return false;
    }
    return true;
  });
}

async function criarUsuario(dados) {
  const tipo = dados.tipo || 'cliente';
  const cpf = normalizarOuGerarCpf(dados.cpf, dados.telefone || dados.email || dados.nome);

  if (tipo === 'funcionario' || tipo === 'admin') {
    const cargoPadrao = tipo === 'admin' ? 'Administrador' : 'Atendimento';
    const query = `
      INSERT INTO Funcionario (Nome, CPF, Cargo, Ativo, Senha_acesso, Email, Telefone, Foto_url, Precisa_trocar_senha)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      dados.nome,
      cpf,
      dados.cargo || cargoPadrao,
      dados.ativo !== false,
      dados.senha_hash,
      dados.email || null,
      dados.telefone || null,
      dados.foto_webp || null,
      Boolean(dados.precisa_trocar_senha),
    ];
    const res = await pool.query(query, values);
    return mapearFuncionarioDoBanco(res.rows[0]);
  }

  const query = `
    INSERT INTO Cliente (Nome, Telefone, CPF, Email, Data_nascimento, Senha_cliente, Foto_url, Ativo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [
    dados.nome,
    dados.telefone || null,
    cpf,
    dados.email,
    dados.data_nascimento || null,
    dados.senha_hash,
    dados.foto_webp || null,
    dados.ativo !== false,
  ];
  const res = await pool.query(query, values);
  return mapearClienteDoBanco(res.rows[0], []);
}

async function atualizarUsuario(id, campos) {
  const idNum = Number(id);
  const alterarFoto = Object.prototype.hasOwnProperty.call(campos, 'foto_webp');

  // Verifica se o ID pertence a Cliente
  const checkCli = await pool.query('SELECT id_cliente FROM Cliente WHERE id_cliente = $1;', [idNum]);
  if (checkCli.rowCount > 0) {
    if (Array.isArray(campos.favoritos)) {
      await sincronizarFavoritosDoCliente(idNum, campos.favoritos);
    }

    const query = `
      UPDATE Cliente
      SET
        Nome = COALESCE($1, Nome),
        Email = COALESCE($2, Email),
        Telefone = COALESCE($3, Telefone),
        CPF = COALESCE($4, CPF),
        Senha_cliente = COALESCE($5, Senha_cliente),
        Foto_url = CASE WHEN $6::boolean THEN $7 ELSE Foto_url END,
        Ativo = COALESCE($8, Ativo),
        Ultimo_acesso = COALESCE($9::timestamp, Ultimo_acesso)
      WHERE id_cliente = $10
      RETURNING *;
    `;
    const values = [
      campos.nome !== undefined ? campos.nome : null,
      campos.email !== undefined ? campos.email : null,
      campos.telefone !== undefined ? campos.telefone : null,
      campos.cpf ? normalizarOuGerarCpf(campos.cpf) : null,
      campos.senha_hash || null,
      alterarFoto,
      alterarFoto ? campos.foto_webp : null,
      campos.ativo !== undefined ? Boolean(campos.ativo) : null,
      campos.ultimo_acesso !== undefined ? campos.ultimo_acesso : null,
      idNum,
    ];
    const res = await pool.query(query, values);
    const favs = await obterIdsFavoritosDoCliente(idNum);
    return mapearClienteDoBanco(res.rows[0], favs);
  }

  // Caso contrário, atualiza em Funcionario
  const checkFunc = await pool.query(
    'SELECT id_funcionario FROM Funcionario WHERE id_funcionario = $1;',
    [idNum]
  );
  if (checkFunc.rowCount > 0) {
    const alterarCargo = Object.prototype.hasOwnProperty.call(campos, 'cargo');
    const alterarSenha = Boolean(campos.senha_hash);
    const temFlagTroca = campos.precisa_trocar_senha !== undefined;

    const query = `
      UPDATE Funcionario
      SET
        Nome = COALESCE($1, Nome),
        Email = COALESCE($2, Email),
        Telefone = COALESCE($3, Telefone),
        CPF = COALESCE($4, CPF),
        Cargo = CASE WHEN $5::boolean THEN $6 ELSE Cargo END,
        Senha_acesso = COALESCE($7, Senha_acesso),
        Precisa_trocar_senha = CASE
          WHEN $8::boolean THEN $9
          WHEN $10::boolean THEN FALSE
          ELSE Precisa_trocar_senha
        END,
        Foto_url = CASE WHEN $11::boolean THEN $12 ELSE Foto_url END,
        Ativo = COALESCE($13, Ativo),
        Ultimo_acesso = COALESCE($14::timestamp, Ultimo_acesso)
      WHERE id_funcionario = $15
      RETURNING *;
    `;
    const values = [
      campos.nome !== undefined ? campos.nome : null,
      campos.email !== undefined ? campos.email : null,
      campos.telefone !== undefined ? campos.telefone : null,
      campos.cpf ? normalizarOuGerarCpf(campos.cpf) : null,
      alterarCargo,
      alterarCargo ? campos.cargo : null,
      campos.senha_hash || null,
      temFlagTroca,
      temFlagTroca ? Boolean(campos.precisa_trocar_senha) : false,
      alterarSenha,
      alterarFoto,
      alterarFoto ? campos.foto_webp : null,
      campos.ativo !== undefined ? Boolean(campos.ativo) : null,
      campos.ultimo_acesso !== undefined ? campos.ultimo_acesso : null,
      idNum,
    ];
    const res = await pool.query(query, values);
    return mapearFuncionarioDoBanco(res.rows[0]);
  }

  return null;
}

async function removerUsuario(id) {
  const idNum = Number(id);
  await pool.query('DELETE FROM Favorito WHERE id_cliente = $1;', [idNum]);
  const resCli = await pool.query('DELETE FROM Cliente WHERE id_cliente = $1 RETURNING id_cliente;', [
    idNum,
  ]);
  if (resCli.rowCount > 0) return true;

  const resFunc = await pool.query(
    'DELETE FROM Funcionario WHERE id_funcionario = $1 RETURNING id_funcionario;',
    [idNum]
  );
  return resFunc.rowCount > 0;
}

// ============================================================================
// 4. SACOLA E PEDIDOS (Tabelas: Pedido, Item_Pedido, Pagamento)
// ============================================================================

async function obterSacolaUsuario(usuarioId) {
  return sacolasTemporarias.get(String(usuarioId)) || [];
}

async function salvarSacolaUsuario(usuarioId, itensSacola = []) {
  sacolasTemporarias.set(String(usuarioId), itensSacola);
  return itensSacola;
}

async function obterProximoNumeroPedido() {
  const result = await pool.query('SELECT COALESCE(MAX(id_pedido), 52680) + 1 AS proximo FROM Pedido;');
  return Number(result.rows[0].proximo);
}

/**
 * Garante um `id_cliente` válido na tabela `Cliente` e um `id_funcionario` válido na tabela `Funcionario`
 * para cumprir as chaves estrangeiras obrigatórias da tabela `Pedido`.
 */
async function obterIdsRelacionaisParaPedido(usuarioId) {
  const idNum = Number(usuarioId);
  let idCliente = null;

  const checkCli = await pool.query('SELECT id_cliente FROM Cliente WHERE id_cliente = $1;', [idNum]);
  if (checkCli.rowCount > 0) {
    idCliente = checkCli.rows[0].id_cliente;
  } else {
    // Se um Funcionário/Admin estiver testando o envio de pedido como cliente, garante registro espelho em Cliente
    const func = await pool.query('SELECT * FROM Funcionario WHERE id_funcionario = $1;', [idNum]);
    if (func.rows[0]) {
      const f = func.rows[0];
      const emailEspelho = f.email || `${f.nome.toLowerCase().replace(/\s+/g, '.')}@cafeteriajoao.com`;
      const cliEspelho = await pool.query(
        'SELECT id_cliente FROM Cliente WHERE LOWER(Email) = LOWER($1) LIMIT 1;',
        [emailEspelho]
      );
      if (cliEspelho.rows[0]) {
        idCliente = cliEspelho.rows[0].id_cliente;
      } else {
        const novoCli = await pool.query(
          `INSERT INTO Cliente (Nome, Telefone, CPF, Email, Senha_cliente, Foto_url, Ativo)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id_cliente;`,
          [
            f.nome,
            f.telefone || '48999990000',
            normalizarOuGerarCpf(null, f.cpf),
            emailEspelho,
            f.senha_acesso,
            f.foto_url,
          ]
        );
        idCliente = novoCli.rows[0].id_cliente;
      }
    }
  }

  const funcPadrao = await pool.query(
    'SELECT id_funcionario FROM Funcionario WHERE Ativo = TRUE ORDER BY id_funcionario ASC LIMIT 1;'
  );
  const idFuncionario = funcPadrao.rows[0]?.id_funcionario || 1;

  return { idCliente, idFuncionario };
}

async function buscarPedidoPorId(idPedido) {
  const idNum = Number(idPedido);
  const resPed = await pool.query(
    `SELECT p.*,
            c.Nome AS cliente_nome,
            c.Foto_url AS cliente_foto,
            f.Nome AS funcionario_nome
     FROM Pedido p
     INNER JOIN Cliente c ON c.id_cliente = p.id_cliente
     LEFT JOIN Funcionario f ON f.id_funcionario = p.id_funcionario
     WHERE p.id_pedido = $1;`,
    [idNum]
  );

  if (!resPed.rows[0]) return null;

  const resItens = await pool.query(
    `SELECT ip.*,
            pr.Nome AS produto_nome,
            pr.Descricao AS produto_descricao,
            pr.Imagem_url AS produto_imagem
     FROM Item_Pedido ip
     INNER JOIN Produto pr ON pr.id_produto = ip.id_produto
     WHERE ip.id_pedido = $1
     ORDER BY ip.id_item ASC;`,
    [idNum]
  );

  const resPag = await pool.query(
    'SELECT * FROM Pagamento WHERE id_pedido = $1 ORDER BY id_pagamento DESC LIMIT 1;',
    [idNum]
  );

  return mapearPedidoDoBanco(resPed.rows[0], resItens.rows, resPag.rows[0]);
}

async function criarPedido(dados) {
  const { idCliente, idFuncionario } = await obterIdsRelacionaisParaPedido(dados.usuario_id);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const resPed = await client.query(
      `INSERT INTO Pedido (
         id_cliente, id_funcionario, Status_pedido, Valor_total,
         Unidade_retirada, Previsao_minutos, Observacoes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_pedido;`,
      [
        idCliente,
        idFuncionario,
        dados.status || 'preparando',
        Number(dados.total),
        dados.unidade_retirada || 'Shopping Beira Mar',
        Number(dados.previsao_minutos) || 5,
        dados.observacoes || null,
      ]
    );

    const novoIdPedido = resPed.rows[0].id_pedido;

    for (const item of dados.itens || []) {
      await client.query(
        `INSERT INTO Item_Pedido (id_pedido, id_produto, Quantidade, Preco_unitario, Observacoes)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          novoIdPedido,
          Number(item.item_id ?? item.id_produto),
          Number(item.quantidade),
          Number(item.preco_unitario),
          item.observacoes || dados.observacoes || null,
        ]
      );
    }

    await client.query(
      `INSERT INTO Pagamento (id_pedido, Metodo_pagamento, Status_pagamento, Valor)
       VALUES ($1, 'Retirada no Balcão', 'Aguardando Retirada', $2);`,
      [novoIdPedido, Number(dados.total)]
    );

    await client.query('COMMIT');
    return buscarPedidoPorId(novoIdPedido);
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function listarPedidos(filtros = {}) {
  const { usuarioId, status, apenasEmAndamento, apenasHistorico } = filtros;
  const condicoes = [];
  const valores = [];

  if (usuarioId !== undefined && usuarioId !== null) {
    valores.push(Number(usuarioId));
    condicoes.push(`p.id_cliente = $${valores.length}`);
  }

  if (status) {
    if (Array.isArray(status)) {
      valores.push(status);
      condicoes.push(`LOWER(p.Status_pedido) = ANY($${valores.length})`);
    } else {
      valores.push(String(status).toLowerCase());
      condicoes.push(`LOWER(p.Status_pedido) = $${valores.length}`);
    }
  }

  if (apenasEmAndamento) {
    condicoes.push(`LOWER(p.Status_pedido) IN ('pendente', 'preparando')`);
  }

  if (apenasHistorico) {
    condicoes.push(`LOWER(p.Status_pedido) IN ('concluido', 'cancelado', 'finalizado', 'retirado')`);
  }

  const whereSql = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
  const resPedidos = await pool.query(
    `SELECT p.id_pedido
     FROM Pedido p
     ${whereSql}
     ORDER BY p.id_pedido DESC;`,
    valores
  );

  const listaCompleta = [];
  for (const row of resPedidos.rows) {
    const ped = await buscarPedidoPorId(row.id_pedido);
    if (ped) listaCompleta.push(ped);
  }
  return listaCompleta;
}

async function atualizarPedido(idPedido, campos) {
  const idNum = Number(idPedido);
  const alterarFinalizadoEm = Object.prototype.hasOwnProperty.call(campos, 'finalizado_em');
  const alterarObs = Object.prototype.hasOwnProperty.call(campos, 'observacoes');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (Array.isArray(campos.itens) && campos.itens.length > 0) {
      await client.query('DELETE FROM Item_Pedido WHERE id_pedido = $1;', [idNum]);
      for (const item of campos.itens) {
        await client.query(
          `INSERT INTO Item_Pedido (id_pedido, id_produto, Quantidade, Preco_unitario, Observacoes)
           VALUES ($1, $2, $3, $4, $5);`,
          [
            idNum,
            Number(item.item_id ?? item.id_produto),
            Number(item.quantidade),
            Number(item.preco_unitario),
            item.observacoes || null,
          ]
        );
      }
    }

    await client.query(
      `UPDATE Pedido
       SET
         Valor_total = COALESCE($1, Valor_total),
         Unidade_retirada = COALESCE($2, Unidade_retirada),
         Previsao_minutos = COALESCE($3, Previsao_minutos),
         Observacoes = CASE WHEN $4::boolean THEN $5 ELSE Observacoes END,
         Status_pedido = COALESCE($6, Status_pedido),
         Data_finalizacao = CASE WHEN $7::boolean THEN $8::timestamp ELSE Data_finalizacao END
       WHERE id_pedido = $9;`,
      [
        campos.total !== undefined ? Number(campos.total) : null,
        campos.unidade_retirada !== undefined ? campos.unidade_retirada : null,
        campos.previsao_minutos !== undefined ? Number(campos.previsao_minutos) : null,
        alterarObs,
        alterarObs ? campos.observacoes : null,
        campos.status !== undefined ? campos.status : null,
        alterarFinalizadoEm,
        alterarFinalizadoEm ? campos.finalizado_em : null,
        idNum,
      ]
    );

    if (campos.status || campos.total !== undefined) {
      const novoStatusPag =
        campos.status === 'concluido'
          ? 'Concluído'
          : campos.status === 'cancelado'
            ? 'Cancelado'
            : 'Aguardando Retirada';
      await client.query(
        `UPDATE Pagamento
         SET Status_pagamento = COALESCE($1, Status_pagamento),
             Valor = COALESCE($2, Valor)
         WHERE id_pedido = $3;`,
        [campos.status ? novoStatusPag : null, campos.total !== undefined ? Number(campos.total) : null, idNum]
      );
    }

    await client.query('COMMIT');
    return buscarPedidoPorId(idNum);
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

async function removerPedido(idPedido) {
  const idNum = Number(idPedido);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM Pagamento WHERE id_pedido = $1;', [idNum]);
    await client.query('DELETE FROM Item_Pedido WHERE id_pedido = $1;', [idNum]);
    const res = await client.query('DELETE FROM Pedido WHERE id_pedido = $1 RETURNING id_pedido;', [
      idNum,
    ]);
    await client.query('COMMIT');
    return res.rowCount > 0;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  // Produtos
  listarItensCardapio,
  buscarItemCardapioPorId,
  criarProduto,
  criarItemCardapio: criarProduto,
  atualizarProduto,
  atualizarItemCardapio: atualizarProduto,
  deletarProduto,
  removerItemCardapio: deletarProduto,

  // Categorias
  listarCategorias,
  buscarCategoriaPorId,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
  removerCategoria: deletarCategoria,

  // Usuários (Cliente + Funcionario + Favorito)
  buscarUsuarioPorId,
  buscarUsuarioPorEmail,
  buscarUsuarioPorTelefone,
  buscarUsuarioPorLogin,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  removerUsuario,

  // Sacola e Pedidos (Pedido + Item_Pedido + Pagamento)
  obterSacolaUsuario,
  salvarSacolaUsuario,
  obterProximoNumeroPedido,
  criarPedido,
  buscarPedidoPorId,
  listarPedidos,
  atualizarPedido,
  removerPedido,
};
