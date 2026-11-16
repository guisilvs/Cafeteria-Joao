/**
 * @file authMiddleware.js
 * @description Middlewares de autenticação e autorização via JWT.
 *
 * Suporta envio do token via:
 * - Header padrão: `Authorization: Bearer <token>`
 * - Header alternativo: `x-access-token: <token>`
 */

const authCore = require('../../core/authCore');
const { erroNaoAutorizado, erroProibido } = require('../../core/errosCore');

/**
 * Extrai o token JWT dos cabeçalhos HTTP da requisição.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extrairTokenDaRequisicao(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const xToken = req.headers['x-access-token'];
  if (typeof xToken === 'string' && xToken.trim()) {
    return xToken.trim();
  }

  return null;
}

/**
 * Exige que o usuário esteja autenticado com um token JWT válido e conta ativa.
 * Injeta o objeto `req.usuario` para uso nos handlers.
 */
async function exigirAutenticacao(req, res, next) {
  try {
    const token = extrairTokenDaRequisicao(req);
    if (!token) {
      throw erroNaoAutorizado('Você precisa estar logado para realizar esta ação.');
    }

    const payload = authCore.verificarToken(token);
    const usuario = await authCore.obterUsuarioAutenticado(payload.id || payload.sub);

    req.usuario = usuario;
    next();
  } catch (erro) {
    next(erro);
  }
}

/**
 * Tenta identificar o usuário logado se o token for enviado, mas não bloqueia a requisição
 * caso o visitante esteja deslogado (útil no Cardápio público para marcar favoritos).
 */
async function autenticacaoOpcional(req, res, next) {
  try {
    const token = extrairTokenDaRequisicao(req);
    if (token) {
      const payload = authCore.verificarToken(token);
      const usuario = await authCore.obterUsuarioAutenticado(payload.id || payload.sub);
      req.usuario = usuario;
    }
  } catch {
    req.usuario = null;
  }
  next();
}

/**
 * Exige que o usuário autenticado seja Funcionário ou Administrador (`tipo === 'admin' | 'funcionario'`).
 * Deve ser utilizado em conjunto ou logo após `exigirAutenticacao`.
 */
function exigirAdmin(req, res, next) {
  try {
    if (!req.usuario) {
      throw erroNaoAutorizado('Autenticação necessária para acessar o painel administrativo.');
    }

    if (!authCore.usuarioEhAdminOuFuncionario(req.usuario)) {
      throw erroProibido(
        'Acesso negado. Apenas funcionários e administradores podem realizar esta operação.'
      );
    }

    next();
  } catch (erro) {
    next(erro);
  }
}

module.exports = {
  extrairTokenDaRequisicao,
  exigirAutenticacao,
  autenticacaoOpcional,
  exigirAdmin,
};
