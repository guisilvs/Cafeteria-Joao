/**
 * @file cardapioHandler.js
 * @description Handlers da camada de API para Categorias, Itens do Cardápio e Compressão .webp.
 */

const cardapioCore = require('../../core/cardapioCore');
const siteCore = require('../../core/siteCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

// ============================================================================
// HANDLERS PÚBLICOS / CLIENTE
// ============================================================================

/**
 * GET /api/cardapio
 * Retorna o cardápio completo (categorias ativas + itens visíveis + agrupamento por categoria).
 * Se o cliente enviar token JWT, já marca `favorito: true` nos itens favoritados por ele.
 */
const obterCardapioPublico = asyncHandler(async (req, res) => {
  const resultado = await cardapioCore.obterCardapioPublicoCore({
    categoriaId: req.query.categoria_id || req.query.categoriaId,
    categoria: req.query.categoria,
    busca: req.query.busca,
    usuarioId: req.usuario ? req.usuario.id : null,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

/**
 * GET /api/categorias
 * Lista todas as categorias ativas do cardápio ordenadas (ex: Gelados, Quentes, Sanduiches).
 */
const listarCategoriasPublicas = asyncHandler(async (_req, res) => {
  const categorias = await cardapioCore.listarCategoriasCore(true);
  res.status(200).json({
    sucesso: true,
    categorias,
    total: categorias.length,
  });
});

/**
 * GET /api/cardapio/itens/:id
 * Obtém detalhes de um item visível do cardápio.
 */
const obterItemCardapioPublico = asyncHandler(async (req, res) => {
  const item = await cardapioCore.buscarItemCardapioPorIdCore(req.params.id, {
    incluirOculto: false,
    usuarioId: req.usuario ? req.usuario.id : null,
  });

  res.status(200).json({
    sucesso: true,
    item,
  });
});

// ============================================================================
// HANDLERS ADMINISTRATIVOS - CATEGORIAS
// ============================================================================

/**
 * GET /api/admin/categorias
 * Lista todas as categorias no painel Admin.
 */
const listarCategoriasAdmin = asyncHandler(async (_req, res) => {
  const categorias = await cardapioCore.listarCategoriasCore(false);
  res.status(200).json({
    sucesso: true,
    categorias,
    total: categorias.length,
  });
});

/**
 * POST /api/admin/categorias
 * Cria uma nova categoria no cardápio ("Criar nova categoria" - tela 143:148 do Figma).
 */
const criarCategoriaAdmin = asyncHandler(async (req, res) => {
  const categoria = await cardapioCore.criarCategoriaCore(req.body);
  res.status(201).json({
    sucesso: true,
    mensagem: 'Categoria criada com sucesso.',
    categoria,
  });
});

/**
 * PUT /api/admin/categorias/:id
 * Atualiza o nome, ordem ou visibilidade de uma categoria.
 */
const atualizarCategoriaAdmin = asyncHandler(async (req, res) => {
  const categoria = await cardapioCore.atualizarCategoriaCore(req.params.id, req.body);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Categoria atualizada com sucesso.',
    categoria,
  });
});

/**
 * PATCH /api/admin/categorias/reordenar
 * Reordena a posição das categorias ("posição pinça" na tela 143:148 do Figma).
 */
const reordenarCategoriasAdmin = asyncHandler(async (req, res) => {
  const lista = Array.isArray(req.body) ? req.body : req.body.categorias || req.body.ordem;
  const categorias = await cardapioCore.reordenarCategoriasCore(lista);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Ordem das categorias atualizada com sucesso.',
    categorias,
  });
});

/**
 * DELETE /api/admin/categorias/:id
 * Remove uma categoria do cardápio.
 */
const removerCategoriaAdmin = asyncHandler(async (req, res) => {
  const forcar = req.query.forcar === 'true' || req.body?.forcar === true;
  const resultado = await cardapioCore.removerCategoriaCore(req.params.id, { forcar });
  res.status(200).json({
    sucesso: true,
    mensagem: 'Categoria removida com sucesso.',
    ...resultado,
  });
});

// ============================================================================
// HANDLERS ADMINISTRATIVOS - ITENS / PRODUTOS DO CARDÁPIO
// ============================================================================

/**
 * GET /api/admin/cardapio/itens
 * Lista todos os itens do cardápio (incluindo os ocultos) para gerenciamento do Admin.
 */
const listarItensAdmin = asyncHandler(async (req, res) => {
  const itens = await cardapioCore.listarItensAdminCore({
    categoriaId: req.query.categoria_id || req.query.categoriaId,
    categoria: req.query.categoria,
    busca: req.query.busca,
  });

  res.status(200).json({
    sucesso: true,
    itens,
    total: itens.length,
  });
});

/**
 * POST /api/admin/cardapio/itens
 * Cria um novo produto em uma categoria do cardápio ("Publicar no cardápio" - tela 161:294).
 * Comprime a foto enviada para `.webp` automaticamente.
 */
const criarItemAdmin = asyncHandler(async (req, res) => {
  const fotoEntrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const item = await cardapioCore.criarItemCardapioCore({
    ...req.body,
    foto: fotoEntrada,
  });

  res.status(201).json({
    sucesso: true,
    mensagem: 'Produto publicado no cardápio com sucesso.',
    item,
  });
});

/**
 * PUT /api/admin/cardapio/itens/:id
 * Atualiza um produto existente do cardápio (nome, descrição, preço, categoria, foto .webp).
 */
const atualizarItemAdmin = asyncHandler(async (req, res) => {
  const fotoEntrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const item = await cardapioCore.atualizarItemCardapioCore(req.params.id, {
    ...req.body,
    foto: fotoEntrada,
  });

  res.status(200).json({
    sucesso: true,
    mensagem: 'Produto atualizado com sucesso.',
    item,
  });
});

/**
 * PATCH /api/admin/cardapio/itens/:id/visibilidade
 * Alterna ou define se o produto está oculto ou visível ("Ocultar" na tela 143:999 do Figma).
 */
const alternarVisibilidadeItemAdmin = asyncHandler(async (req, res) => {
  const ocultoDesejado =
    req.body && req.body.oculto !== undefined
      ? Boolean(req.body.oculto)
      : req.body && req.body.visivel !== undefined
        ? !Boolean(req.body.visivel)
        : undefined;

  const item = await cardapioCore.alternarVisibilidadeItemCore(req.params.id, ocultoDesejado);

  res.status(200).json({
    sucesso: true,
    mensagem: item.oculto
      ? `O produto "${item.nome}" foi ocultado do cardápio público.`
      : `O produto "${item.nome}" está visível novamente no cardápio público.`,
    item,
  });
});

/**
 * DELETE /api/admin/cardapio/itens/:id
 * Exclui permanentemente um produto do cardápio.
 */
const removerItemAdmin = asyncHandler(async (req, res) => {
  const resultado = await cardapioCore.removerItemCardapioCore(req.params.id);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Produto removido do cardápio com sucesso.',
    ...resultado,
  });
});

/**
 * POST /api/imagens/webp
 * Utilitário dedicado caso o Front-end queira comprimir/pré-visualizar uma imagem em .webp
 * antes de publicar o produto (suporte à "Pré-visualização" da tela 161:294 do Figma).
 */
const comprimirImagemParaWebp = asyncHandler(async (req, res) => {
  const entrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const resultado = await siteCore.converterImagemParaWebp(entrada, {
    largura: req.body.largura,
    altura: req.body.altura,
    qualidade: req.body.qualidade,
  });

  res.status(200).json({
    sucesso: true,
    mensagem: 'Imagem comprimida para WebP com sucesso.',
    imagem: {
      dataUri: resultado.dataUri,
      mimeType: resultado.mimeType,
      largura: resultado.largura,
      altura: resultado.altura,
      tamanhoOriginalBytes: resultado.tamanhoOriginalBytes,
      tamanhoFinalBytes: resultado.tamanhoFinalBytes,
      economiaPercentual: resultado.economiaPercentual,
    },
  });
});

module.exports = {
  obterCardapioPublico,
  listarCategoriasPublicas,
  obterItemCardapioPublico,
  listarCategoriasAdmin,
  criarCategoriaAdmin,
  atualizarCategoriaAdmin,
  reordenarCategoriasAdmin,
  removerCategoriaAdmin,
  listarItensAdmin,
  criarItemAdmin,
  atualizarItemAdmin,
  alternarVisibilidadeItemAdmin,
  removerItemAdmin,
  comprimirImagemParaWebp,
};
