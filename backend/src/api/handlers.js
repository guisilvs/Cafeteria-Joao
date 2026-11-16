/**
 * @file handlers.js
 * @description Ponto central de exportação dos Handlers da camada de API.
 *
 * Para evitar um arquivo monolítico e manter o código limpo (Clean Code),
 * as implementações são divididas por domínio em `./handlers/` e agregadas aqui
 * para consumo direto pelo arquivo `routes.js`.
 */

const siteCore = require('../core/siteCore');
const repositorioCore = require('../core/repositorioCore');
const { asyncHandler } = require('./middlewares/errorMiddleware');

const authHandler = require('./handlers/authHandler');
const cardapioHandler = require('./handlers/cardapioHandler');
const favoritoHandler = require('./handlers/favoritoHandler');
const pedidoHandler = require('./handlers/pedidoHandler');
const usuarioHandler = require('./handlers/usuarioHandler');

/**
 * GET /api/health (e GET /api/status)
 * Verifica a saúde da API e informa o status da integração com `database/queries.js`.
 */
const obterStatusSistema = asyncHandler(async (_req, res) => {
  const banco = repositorioCore.verificarStatusBanco();
  const site = siteCore.obterInformacoesSite();

  res.status(200).json({
    sucesso: true,
    servico: 'Cafeteria do João - API Back-end',
    status: 'online',
    timestamp: new Date().toISOString(),
    bancoDeDados: banco,
    estabelecimento: site,
  });
});

/**
 * GET /api/site/info
 * Retorna textos institucionais e configurações públicas do site/portfólio.
 */
const obterInformacoesSite = asyncHandler(async (_req, res) => {
  res.status(200).json({
    sucesso: true,
    site: siteCore.obterInformacoesSite(),
  });
});

module.exports = {
  // Saúde e Informações Gerais
  obterStatusSistema,
  obterInformacoesSite,

  // 1. Autenticação e Conta (Cliente e Admin)
  ...authHandler,

  // 2. Cardápio, Categorias, Produtos e Compressão WebP
  ...cardapioHandler,

  // 3. Favoritos do Cliente
  ...favoritoHandler,

  // 4. Sacola de Compras e Pedidos (Cliente e Admin)
  ...pedidoHandler,

  // 5. Gerenciamento de Usuários (Clientes e Funcionários/Internos)
  ...usuarioHandler,
};
