/**
 * @file cardapioCore.js
 * @description Regras de negócio para Categorias e Itens (Produtos) do Cardápio.
 *
 * Atende aos requisitos:
 * - Cliente: 2. ver o cardápio
 * - Admin: 4. ver e gerenciar categorias do cardápio (incluindo reordenação)
 * - Admin: 5. ver e gerenciar itens de cada categoria do cardápio (editar, ocultar/exibir, excluir)
 * - Admin: 6. criar novos itens em uma categoria do cardápio (com foto comprimida em .webp)
 */

const repositorio = require('./repositorioCore');
const { processarFotoProduto } = require('./siteCore');
const {
  limparTextoSimples,
  validarPreco,
  formatarMoedaBRL,
  validarId,
} = require('./validacaoCore');
const {
  erroValidacao,
  erroNaoEncontrado,
  erroConflito,
} = require('./errosCore');

/**
 * Gera um identificador amigável (slug) para o nome da categoria.
 * @param {string} nome
 * @returns {string}
 */
function gerarSlugCategoria(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formata um item do cardápio adicionando campos úteis para o Front-end
 * (como `preco_formatado`, `valor_label` da tela 143:999, `visivel` e flag `favorito`).
 *
 * @param {object} item
 * @param {Set<string>|null} [conjuntoFavoritos=null]
 */
function formatarItemCardapio(item, conjuntoFavoritos = null) {
  if (!item) return null;
  const precoNumerico = Number(item.preco) || 0;
  const precoFormatado = formatarMoedaBRL(precoNumerico);
  const oculto = Boolean(item.oculto);

  return {
    ...item,
    preco: precoNumerico,
    preco_formatado: precoFormatado,
    valor_label: `Valor: ${precoFormatado}`,
    oculto,
    visivel: !oculto,
    acao_visibilidade_label: oculto ? 'Exibir' : 'Ocultar',
    favorito: conjuntoFavoritos ? conjuntoFavoritos.has(String(item.id)) : false,
  };
}

// ============================================================================
// REGRAS DE NEGÓCIO DE CATEGORIAS
// ============================================================================

async function listarCategoriasCore(apenasAtivas = true) {
  return repositorio.listarCategorias(apenasAtivas);
}

async function buscarCategoriaOuFalhar(identificadorCategoria) {
  if (identificadorCategoria === undefined || identificadorCategoria === null || identificadorCategoria === '') {
    throw erroValidacao('A categoria do produto é obrigatória.');
  }

  const porIdOuSlug = await repositorio.buscarCategoriaPorId(identificadorCategoria);
  if (porIdOuSlug) return porIdOuSlug;

  const todas = await repositorio.listarCategorias(false);
  const nomeNormalizado = String(identificadorCategoria).trim().toLowerCase();
  const encontradaPorNome = todas.find(
    (c) =>
      c.nome.toLowerCase() === nomeNormalizado ||
      gerarSlugCategoria(c.nome) === gerarSlugCategoria(nomeNormalizado)
  );

  if (!encontradaPorNome) {
    throw erroNaoEncontrado('Categoria do cardápio');
  }

  return encontradaPorNome;
}

async function criarCategoriaCore(dados = {}) {
  const nome = limparTextoSimples(dados.nome);
  if (!nome || nome.length < 2 || nome.length > 60) {
    throw erroValidacao('O nome da categoria deve ter entre 2 e 60 caracteres.');
  }

  const slug = gerarSlugCategoria(nome);
  const existentes = await repositorio.listarCategorias(false);
  const duplicada = existentes.find(
    (c) => c.nome.toLowerCase() === nome.toLowerCase() || c.slug === slug
  );

  if (duplicada) {
    throw erroConflito(`Já existe uma categoria chamada "${nome}".`);
  }

  const ordem =
    dados.ordem !== undefined && dados.ordem !== null && dados.ordem !== ''
      ? Number(dados.ordem)
      : existentes.length + 1;

  const ativo = dados.ativo !== undefined ? Boolean(dados.ativo) : true;

  return repositorio.criarCategoria({
    nome,
    slug,
    ordem: Number.isFinite(ordem) ? ordem : existentes.length + 1,
    ativo,
  });
}

async function atualizarCategoriaCore(idCategoria, dados = {}) {
  const id = validarId(idCategoria, 'ID da categoria');
  const categoriaAtual = await repositorio.buscarCategoriaPorId(id);
  if (!categoriaAtual) {
    throw erroNaoEncontrado('Categoria');
  }

  const campos = {};

  if (dados.nome !== undefined) {
    const nome = limparTextoSimples(dados.nome);
    if (!nome || nome.length < 2 || nome.length > 60) {
      throw erroValidacao('O nome da categoria deve ter entre 2 e 60 caracteres.');
    }

    const slug = gerarSlugCategoria(nome);
    const existentes = await repositorio.listarCategorias(false);
    const conflito = existentes.find(
      (c) =>
        String(c.id) !== String(categoriaAtual.id) &&
        (c.nome.toLowerCase() === nome.toLowerCase() || c.slug === slug)
    );
    if (conflito) {
      throw erroConflito(`Já existe outra categoria com o nome "${nome}".`);
    }

    campos.nome = nome;
    campos.slug = slug;
  }

  if (dados.ordem !== undefined) {
    const novaOrdem = Number(dados.ordem);
    if (!Number.isFinite(novaOrdem) || novaOrdem < 0) {
      throw erroValidacao('A ordem da categoria deve ser um número válido.');
    }
    campos.ordem = novaOrdem;
  }

  if (dados.ativo !== undefined) {
    campos.ativo = Boolean(dados.ativo);
  }

  return repositorio.atualizarCategoria(categoriaAtual.id, campos);
}

/**
 * Permite reordenar as categorias (suporte ao ícone "posição pinça" da tela 143:148 do Figma).
 * @param {Array<number|string|{id: number|string, ordem: number}>} novaOrdenacao
 */
async function reordenarCategoriasCore(novaOrdenacao) {
  if (!Array.isArray(novaOrdenacao) || novaOrdenacao.length === 0) {
    throw erroValidacao('Informe a lista de categorias para reordenação.');
  }

  for (let i = 0; i < novaOrdenacao.length; i += 1) {
    const entrada = novaOrdenacao[i];
    const id = typeof entrada === 'object' && entrada !== null ? entrada.id : entrada;
    const ordem =
      typeof entrada === 'object' && entrada !== null && entrada.ordem !== undefined
        ? Number(entrada.ordem)
        : i + 1;

    if (id !== undefined && id !== null) {
      await repositorio.atualizarCategoria(id, { ordem });
    }
  }

  return repositorio.listarCategorias(false);
}

async function removerCategoriaCore(idCategoria, { forcar = false } = {}) {
  const id = validarId(idCategoria, 'ID da categoria');
  const categoria = await repositorio.buscarCategoriaPorId(id);
  if (!categoria) {
    throw erroNaoEncontrado('Categoria');
  }

  const itensDaCategoria = await repositorio.listarItensCardapio({
    categoriaId: categoria.id,
    incluirOcultos: true,
  });

  if (itensDaCategoria.length > 0 && !forcar) {
    throw erroConflito(
      `Não é possível excluir a categoria "${categoria.nome}" pois ela possui ${itensDaCategoria.length} item(ns) cadastrado(s). Remova ou mova os itens antes.`
    );
  }

  if (forcar && itensDaCategoria.length > 0) {
    for (const item of itensDaCategoria) {
      await repositorio.removerItemCardapio(item.id);
    }
  }

  await repositorio.removerCategoria(categoria.id);
  return { id: categoria.id, nome: categoria.nome, removida: true };
}

// ============================================================================
// REGRAS DE NEGÓCIO DE ITENS / PRODUTOS DO CARDÁPIO
// ============================================================================

async function obterConjuntoFavoritosUsuario(usuarioId) {
  if (!usuarioId) return null;
  const usuario = await repositorio.buscarUsuarioPorId(usuarioId);
  if (!usuario || !Array.isArray(usuario.favoritos)) return null;
  return new Set(usuario.favoritos.map((id) => String(id)));
}

/**
 * Consulta o cardápio público para clientes (apenas itens visíveis/não ocultos).
 */
async function obterCardapioPublicoCore(opcoes = {}) {
  const categorias = await repositorio.listarCategorias(true);
  const conjuntoFavoritos = await obterConjuntoFavoritosUsuario(opcoes.usuarioId);

  let categoriaIdFiltro = opcoes.categoriaId || opcoes.categoria_id;
  let categoriaNomeFiltro = opcoes.categoria || opcoes.categoriaNome;

  if (categoriaNomeFiltro && !categoriaIdFiltro) {
    const catEncontrada = categorias.find(
      (c) =>
        c.nome.toLowerCase() === String(categoriaNomeFiltro).trim().toLowerCase() ||
        c.slug === gerarSlugCategoria(categoriaNomeFiltro) ||
        String(c.id) === String(categoriaNomeFiltro)
    );
    if (catEncontrada) {
      categoriaIdFiltro = catEncontrada.id;
      categoriaNomeFiltro = undefined;
    }
  }

  const itensBrutos = await repositorio.listarItensCardapio({
    categoriaId: categoriaIdFiltro,
    categoriaNome: categoriaNomeFiltro,
    incluirOcultos: false,
    busca: opcoes.busca,
  });

  const itens = itensBrutos.map((item) => formatarItemCardapio(item, conjuntoFavoritos));

  const porCategoria = categorias.map((cat) => ({
    ...cat,
    itens: itens.filter((item) => String(item.categoria_id) === String(cat.id)),
  }));

  return {
    categorias,
    itens,
    porCategoria,
    totalItens: itens.length,
  };
}

/**
 * Lista itens do cardápio para o painel Administrador (inclui itens ocultos).
 * @param {object} [filtros]
 */
async function listarItensAdminCore(filtros = {}) {
  let categoriaId = filtros.categoriaId || filtros.categoria_id;
  const categoriaNome = filtros.categoria || filtros.categoriaNome;

  if (categoriaNome && !categoriaId) {
    try {
      const cat = await buscarCategoriaOuFalhar(categoriaNome);
      categoriaId = cat.id;
    } catch {
      // Mantém filtro por nome se não achar por ID
    }
  }

  const itensBrutos = await repositorio.listarItensCardapio({
    categoriaId,
    categoriaNome: categoriaId ? undefined : categoriaNome,
    incluirOcultos: true,
    busca: filtros.busca,
  });

  return itensBrutos.map((item) => formatarItemCardapio(item));
}

/**
 * Lista os itens de uma categoria específica no painel Admin junto com os metadados da categoria
 * (para preencher a tela 143:999 "Cardápio > Gelados").
 * @param {number|string} identificadorCategoria
 */
async function obterCategoriaComItensAdminCore(identificadorCategoria) {
  const categoria = await buscarCategoriaOuFalhar(identificadorCategoria);
  const itens = await listarItensAdminCore({ categoriaId: categoria.id });

  return {
    categoria,
    itens,
    total: itens.length,
  };
}

/**
 * Busca um único item do cardápio por ID.
 */
async function buscarItemCardapioPorIdCore(idItem, { incluirOculto = false, usuarioId = null } = {}) {
  const id = validarId(idItem, 'ID do produto');
  const item = await repositorio.buscarItemCardapioPorId(id);

  if (!item || (item.oculto && !incluirOculto)) {
    throw erroNaoEncontrado('Produto do cardápio');
  }

  const conjuntoFavoritos = await obterConjuntoFavoritosUsuario(usuarioId);
  return formatarItemCardapio(item, conjuntoFavoritos);
}

/**
 * Cria um novo item em uma categoria do cardápio (Tela 161:294 "Criar novo produto").
 * Comprime automaticamente a foto enviada para `.webp`.
 */
async function criarItemCardapioCore(dados = {}) {
  const nome = limparTextoSimples(dados.nome);
  if (!nome || nome.length < 2 || nome.length > 80) {
    throw erroValidacao('O nome do produto é obrigatório (entre 2 e 80 caracteres).');
  }

  const descricao = limparTextoSimples(dados.descricao || '');
  if (descricao.length > 300) {
    throw erroValidacao('A descrição do produto deve ter no máximo 300 caracteres.');
  }

  const preco = validarPreco(dados.preco !== undefined ? dados.preco : dados.valor);

  const identificadorCat =
    dados.categoria_id || dados.categoriaId || dados.categoria || dados.categoria_nome;
  const categoria = await buscarCategoriaOuFalhar(identificadorCat);

  const entradaFoto = dados.foto || dados.foto_webp || dados.imagem || null;
  const foto_webp = entradaFoto ? await processarFotoProduto(entradaFoto) : null;

  const oculto = dados.oculto !== undefined ? Boolean(dados.oculto) : false;

  const novoItem = await repositorio.criarItemCardapio({
    categoria_id: categoria.id,
    categoria_nome: categoria.nome,
    nome,
    descricao,
    preco,
    foto_webp,
    oculto,
  });

  return formatarItemCardapio(novoItem);
}

/**
 * Atualiza um item existente do cardápio (Admin).
 */
async function atualizarItemCardapioCore(idItem, dados = {}) {
  const id = validarId(idItem, 'ID do produto');
  const itemAtual = await repositorio.buscarItemCardapioPorId(id);
  if (!itemAtual) {
    throw erroNaoEncontrado('Produto do cardápio');
  }

  const campos = {};

  if (dados.nome !== undefined) {
    const nome = limparTextoSimples(dados.nome);
    if (!nome || nome.length < 2 || nome.length > 80) {
      throw erroValidacao('O nome do produto deve ter entre 2 e 80 caracteres.');
    }
    campos.nome = nome;
  }

  if (dados.descricao !== undefined) {
    const descricao = limparTextoSimples(dados.descricao);
    if (descricao.length > 300) {
      throw erroValidacao('A descrição do produto deve ter no máximo 300 caracteres.');
    }
    campos.descricao = descricao;
  }

  if (dados.preco !== undefined || dados.valor !== undefined) {
    campos.preco = validarPreco(dados.preco !== undefined ? dados.preco : dados.valor);
  }

  const identificadorCat =
    dados.categoria_id || dados.categoriaId || dados.categoria || dados.categoria_nome;
  if (identificadorCat !== undefined) {
    const categoria = await buscarCategoriaOuFalhar(identificadorCat);
    campos.categoria_id = categoria.id;
    campos.categoria_nome = categoria.nome;
  }

  if (dados.oculto !== undefined) {
    campos.oculto = Boolean(dados.oculto);
  } else if (dados.visivel !== undefined) {
    campos.oculto = !Boolean(dados.visivel);
  }

  const entradaFoto = dados.foto || dados.foto_webp || dados.imagem;
  if (entradaFoto) {
    campos.foto_webp = await processarFotoProduto(entradaFoto);
  } else if (dados.remover_foto === true) {
    campos.foto_webp = null;
  }

  const atualizado = await repositorio.atualizarItemCardapio(itemAtual.id, campos);
  return formatarItemCardapio(atualizado);
}

/**
 * Alterna ou define a visibilidade de um item no cardápio (Botão "Ocultar" da tela 143:999 do Figma).
 */
async function alternarVisibilidadeItemCore(idItem, ocultoDesejado = undefined) {
  const id = validarId(idItem, 'ID do produto');
  const itemAtual = await repositorio.buscarItemCardapioPorId(id);
  if (!itemAtual) {
    throw erroNaoEncontrado('Produto do cardápio');
  }

  const novoOculto =
    ocultoDesejado !== undefined ? Boolean(ocultoDesejado) : !Boolean(itemAtual.oculto);

  const atualizado = await repositorio.atualizarItemCardapio(itemAtual.id, {
    oculto: novoOculto,
  });

  return formatarItemCardapio(atualizado);
}

/**
 * Remove permanentemente um item do cardápio.
 */
async function removerItemCardapioCore(idItem) {
  const id = validarId(idItem, 'ID do produto');
  const removido = await repositorio.removerItemCardapio(id);
  if (!removido) {
    throw erroNaoEncontrado('Produto do cardápio');
  }
  return { id, removido: true };
}

module.exports = {
  formatarItemCardapio,
  // Categorias
  listarCategoriasCore,
  buscarCategoriaOuFalhar,
  criarCategoriaCore,
  atualizarCategoriaCore,
  reordenarCategoriasCore,
  removerCategoriaCore,
  // Itens / Produtos
  obterCardapioPublicoCore,
  listarItensAdminCore,
  obterCategoriaComItensAdminCore,
  buscarItemCardapioPorIdCore,
  criarItemCardapioCore,
  atualizarItemCardapioCore,
  alternarVisibilidadeItemCore,
  removerItemCardapioCore,
};
