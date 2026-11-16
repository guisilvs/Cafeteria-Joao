/**
 * @file app.js
 * @description Ponto de entrada do servidor Back-end da Cafeteria do João.
 * Inicializa o Express na porta 3000 (ou process.env.PORT), aplica os middlewares
 * de segurança e conecta a camada de rotas (`/api`).
 */

require('dotenv').config();

const express = require('express');
const rotasApi = require('./api/routes');
const {
  criarMiddlewareCors,
  criarMiddlewareHelmet,
  limitadorGeralApi,
} = require('./api/middlewares/securityMiddleware');
const {
  rotaNaoEncontrada,
  tratadorDeErros,
} = require('./api/middlewares/errorMiddleware');

const app = express();
const PORTA = Number(process.env.PORT) || 3000;

// 1. Segurança HTTP e CORS para comunicação isolada com o Front-end
app.use(criarMiddlewareHelmet());
app.use(criarMiddlewareCors());
app.use(limitadorGeralApi);

// 2. Parsers de corpo da requisição (suporta JSON e Base64 de imagens até 6MB)
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

// 3. Registro das rotas da API (disponíveis com prefixo `/api` e também na raiz `/`)
app.use('/api', rotasApi);
app.use('/', rotasApi);

// 4. Tratamento de rotas inexistentes (404) e erros globais
app.use(rotaNaoEncontrada);
app.use(tratadorDeErros);

// 5. Inicializa o servidor quando executado diretamente (`node src/app.js`)
if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`☕ Servidor Back-end da Cafeteria do João rodando em http://localhost:${PORTA}`);
  });
}

module.exports = app;
