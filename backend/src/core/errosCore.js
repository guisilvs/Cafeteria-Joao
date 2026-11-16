/**
 * @file errosCore.js
 * @description Classes e fábricas padronizadas de erros de negócio.
 * Isola a camada Core de detalhes de protocolo HTTP diretos, mantendo
 * semântica clara para a camada de API traduzir em respostas JSON.
 */

class AppError extends Error {
  /**
   * @param {string} mensagem - Mensagem amigável e clara do erro
   * @param {number} [statusCode=400] - Código de status HTTP correspondente
   * @param {string} [codigo='ERRO_NEGOCIO'] - Identificador interno do tipo de erro
   * @param {object|null} [detalhes=null] - Informações adicionais opcionais
   */
  constructor(mensagem, statusCode = 400, codigo = 'ERRO_NEGOCIO', detalhes = null) {
    super(mensagem);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.codigo = codigo;
    this.detalhes = detalhes;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

function erroValidacao(mensagem, detalhes = null) {
  return new AppError(mensagem, 400, 'ERRO_VALIDACAO', detalhes);
}

function erroNaoAutorizado(mensagem = 'Autenticação necessária para realizar esta ação.') {
  return new AppError(mensagem, 401, 'NAO_AUTORIZADO');
}

function erroProibido(mensagem = 'Você não possui permissão para realizar esta ação.') {
  return new AppError(mensagem, 403, 'ACESSO_NEGADO');
}

function erroNaoEncontrado(recurso = 'Recurso') {
  return new AppError(`${recurso} não encontrado(a).`, 404, 'NAO_ENCONTRADO');
}

function erroConflito(mensagem) {
  return new AppError(mensagem, 409, 'CONFLITO_DADOS');
}

function erroFormatoImagem(mensagem) {
  return new AppError(mensagem, 422, 'IMAGEM_INVALIDA');
}

module.exports = {
  AppError,
  erroValidacao,
  erroNaoAutorizado,
  erroProibido,
  erroNaoEncontrado,
  erroConflito,
  erroFormatoImagem,
};
