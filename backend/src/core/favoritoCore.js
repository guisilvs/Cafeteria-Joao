/**
 * @file favoritoCore.js
 * @description Regras de negócio para Favoritos do cliente.
 *
 * Atende ao requisito:
 * - Cliente: 3. favoritar itens do cardápio (e filtrar favoritos por categoria conforme telas 14:41, 14:128, 14:180 do Figma)
 */

const repositorio = require('./repositorioCore');
const { formatarItemCardapio } = require('./cardapioCore');
const { validarId } = require('./validacaoCore');
const { erroNaoEncontrado } = require('./errosCore');

/**
 * Lista todos os itens favoritados pelo usuário logado, permitindo filtrar por categoria.
 *
 * @param {number|string} usuarioId
 * @param {object} [filtros]
 * @param {number|string} [filtros.categoriaId]
 * @param {string} [filtros.categoria] - Ex: "Gelados", "Quentes", "Sanduiches"
 */
async function listarFavoritosClienteCore(usuarioId, filtros = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const idsFavoritos = Array.isArray(usuario.favoritos) ? usuario.favoritos : [];
  const conjuntoFavoritos = new Set(idsFavoritos.map((id) => String(id)));

  if (conjuntoFavoritos.size === 0) {
    return {
      ids: [],
      itens: [],
      total: 0,
    };
  }

  const todosVisiveis = await repositorio.listarItensCardapio({
    categoriaId: filtros.categoriaId || filtros.categoria_id,
    categoriaNome: filtros.categoria || filtros.categoriaNome,
    incluirOcultos: false,
  });

  const itensFavoritos = todosVisiveis
    .filter((item) => conjuntoFavoritos.has(String(item.id)))
    .map((item) => formatarItemCardapio(item, conjuntoFavoritos));

  return {
    ids: Array.from(conjuntoFavoritos).map((v) => (Number.isNaN(Number(v)) ? v : Number(v))),
    itens: itensFavoritos,
    total: itensFavoritos.length,
  };
}

/**
 * Adiciona um item do cardápio aos favoritos do usuário.
 * @param {number|string} usuarioId
 * @param {number|string} itemId
 */
async function adicionarFavoritoCore(usuarioId, itemId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');

  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const item = await repositorio.buscarItemCardapioPorId(idItem);
  if (!item || item.oculto) {
    throw erroNaoEncontrado('Item do cardápio');
  }

  const atuais = Array.isArray(usuario.favoritos) ? [...usuario.favoritos] : [];
  const jaExiste = atuais.some((favId) => String(favId) === String(item.id));

  if (!jaExiste) {
    atuais.push(item.id);
    await repositorio.atualizarUsuario(usuario.id, { favoritos: atuais });
  }

  return {
    item_id: item.id,
    favorito: true,
    favoritos: atuais,
    item: formatarItemCardapio(item, new Set(atuais.map(String))),
  };
}

/**
 * Remove um item do cardápio dos favoritos do usuário.
 * @param {number|string} usuarioId
 * @param {number|string} itemId
 */
async function removerFavoritoCore(usuarioId, itemId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');

  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const atuais = Array.isArray(usuario.favoritos) ? [...usuario.favoritos] : [];
  const atualizados = atuais.filter((favId) => String(favId) !== String(idItem));

  await repositorio.atualizarUsuario(usuario.id, { favoritos: atualizados });

  return {
    item_id: idItem,
    favorito: false,
    favoritos: atualizados,
  };
}

/**
 * Alterna (toggle) o estado de favorito de um item do cardápio para o usuário.
 * Se já for favorito, remove; se não for, adiciona.
 * @param {number|string} usuarioId
 * @param {number|string} itemId
 */
async function alternarFavoritoCore(usuarioId, itemId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');

  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const atuais = Array.isArray(usuario.favoritos) ? [...usuario.favoritos] : [];
  const jaFavoritado = atuais.some((favId) => String(favId) === String(idItem));

  if (jaFavoritado) {
    return removerFavoritoCore(idUsuario, idItem);
  }
  return adicionarFavoritoCore(idUsuario, idItem);
}

module.exports = {
  listarFavoritosClienteCore,
  adicionarFavoritoCore,
  removerFavoritoCore,
  alternarFavoritoCore,
};
