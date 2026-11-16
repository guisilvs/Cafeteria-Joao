/**
 * @file favoritoHandler.js
 * @description Handlers da camada de API para Favoritos do cliente.
 */

const favoritoCore = require('../../core/favoritoCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

/**
 * GET /api/favoritos
 * Lista os itens favoritos do cliente logado (permite filtrar por `?categoria=Gelados` ou `?categoria_id=1`).
 */
const listarFavoritos = asyncHandler(async (req, res) => {
  const resultado = await favoritoCore.listarFavoritosClienteCore(req.usuario.id, {
    categoriaId: req.query.categoria_id || req.query.categoriaId,
    categoria: req.query.categoria,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

/**
 * POST /api/favoritos/:itemId
 * Adiciona um item do cardápio aos favoritos do cliente logado.
 */
const adicionarFavorito = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId || req.body.item_id || req.body.itemId;
  const resultado = await favoritoCore.adicionarFavoritoCore(req.usuario.id, itemId);

  res.status(200).json({
    sucesso: true,
    mensagem: 'Item adicionado aos favoritos.',
    ...resultado,
  });
});

/**
 * POST /api/favoritos/toggle/:itemId
 * Alterna (adiciona ou remove) um item nos favoritos do cliente logado.
 */
const alternarFavorito = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId || req.body.item_id || req.body.itemId;
  const resultado = await favoritoCore.alternarFavoritoCore(req.usuario.id, itemId);

  res.status(200).json({
    sucesso: true,
    mensagem: resultado.favorito
      ? 'Item adicionado aos favoritos.'
      : 'Item removido dos favoritos.',
    ...resultado,
  });
});

/**
 * DELETE /api/favoritos/:itemId
 * Remove um item dos favoritos do cliente logado.
 */
const removerFavorito = asyncHandler(async (req, res) => {
  const resultado = await favoritoCore.removerFavoritoCore(req.usuario.id, req.params.itemId);

  res.status(200).json({
    sucesso: true,
    mensagem: 'Item removido dos favoritos.',
    ...resultado,
  });
});

module.exports = {
  listarFavoritos,
  adicionarFavorito,
  alternarFavorito,
  removerFavorito,
};
