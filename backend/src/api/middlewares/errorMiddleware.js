/**
 * @file errorMiddleware.js
 * @description Utilitário para handlers assíncronos e tratamento centralizado de erros da API.
 */

const { AppError } = require('../../core/errosCore');

/**
 * Envolve um handler assíncrono do Express encaminhando qualquer exceção ao middleware de erro.
 * Evita blocos `try/catch` repetitivos em cada função de `handlers.js`.
 * @param {Function} fn
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(fn) {
  return function handlerEnvolvido(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware para rotas inexistentes (404).
 */
function rotaNaoEncontrada(req, res) {
  res.status(404).json({
    sucesso: false,
    erro: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    codigo: 'ROTA_NAO_ENCONTRADA',
  });
}

/**
 * Middleware global de tratamento de erros.
 * Formata `AppError` com seu `statusCode` apropriado e oculta detalhes internos em erros 500.
 */
function tratadorDeErros(erro, req, res, _next) {
  if (erro instanceof AppError) {
    const resposta = {
      sucesso: false,
      erro: erro.message,
      codigo: erro.codigo,
    };
    if (erro.detalhes) {
      resposta.detalhes = erro.detalhes;
    }
    return res.status(erro.statusCode).json(resposta);
  }

  // Erro de JSON malformado no body da requisição
  if (erro instanceof SyntaxError && erro.status === 400 && 'body' in erro) {
    return res.status(400).json({
      sucesso: false,
      erro: 'O corpo da requisição contém um JSON inválido.',
      codigo: 'JSON_INVALIDO',
    });
  }

  console.error('[Erro Interno da API]:', erro);

  return res.status(500).json({
    sucesso: false,
    erro: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
    codigo: 'ERRO_INTERNO_SERVIDOR',
  });
}

module.exports = {
  asyncHandler,
  rotaNaoEncontrada,
  tratadorDeErros,
};
