/**
 * @file securityMiddleware.js
 * @description Configuração de segurança HTTP (Helmet, CORS e Rate Limiting contra força bruta).
 */

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/**
 * Configura o CORS para permitir chamadas do Front-end isolado (`frontend/js/api.js`).
 */
function criarMiddlewareCors() {
  const origemConfigurada = process.env.CORS_ORIGIN || '*';
  return cors({
    origin: origemConfigurada === '*' ? true : origemConfigurada.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
    credentials: true,
  });
}

/**
 * Configura cabeçalhos de segurança com Helmet (permitindo carregamento de imagens .webp e Data URIs).
 */
function criarMiddlewareHelmet() {
  return helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  });
}

/**
 * Limitador geral de requisições da API para evitar abuso / DoS.
 */
const limitadorGeralApi = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    sucesso: false,
    erro: 'Muitas requisições originadas deste IP. Tente novamente em alguns minutos.',
    codigo: 'LIMITE_REQUISICOES_EXCEDIDO',
  },
});

/**
 * Limitador mais restrito para rotas de login/cadastro (proteção contra força bruta de senhas).
 */
const limitadorAutenticacao = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    sucesso: false,
    erro: 'Muitas tentativas de autenticação. Aguarde alguns minutos antes de tentar novamente.',
    codigo: 'LIMITE_AUTENTICACAO_EXCEDIDO',
  },
});

module.exports = {
  criarMiddlewareCors,
  criarMiddlewareHelmet,
  limitadorGeralApi,
  limitadorAutenticacao,
};
