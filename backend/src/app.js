/**
 * @file app.js
 * @description Ponto de entrada do servidor Back-end da Cafeteria do João.
 * Serve as APIs REST (`/api/*`) e os arquivos do Front-end (`/home` -> cliente, `/admin` -> administrador).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const rotasApi = require('./api/routes');
const { inicializarBancoDeDados } = require('./database/connection');
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
const CAMINHO_FRONTEND = path.resolve(__dirname, '../../frontend');

// 1. Segurança HTTP e CORS
app.use(criarMiddlewareHelmet());
app.use(criarMiddlewareCors());
app.use('/api', limitadorGeralApi);

// 2. Parsers de corpo da requisição (suporta JSON e Base64 de imagens até 6MB)
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

// 3. Rotas de Páginas do Front-end (Cliente em /home e Admin em /admin)
app.get(['/', '/home', '/index.html'], (_req, res) => {
  res.sendFile(path.join(CAMINHO_FRONTEND, 'index.html'));
});

app.get(['/admin', '/admin/', '/admin.html'], (_req, res) => {
  res.sendFile(path.join(CAMINHO_FRONTEND, 'admin.html'));
});

// 4. Arquivos estáticos do Front-end (style.css, js/api.js, js/pagina.js, js/admin.js)
app.use(express.static(CAMINHO_FRONTEND));

// 5. Registro das rotas da API
app.use('/api', rotasApi);

// 6. Tratamento de rotas inexistentes (404) e erros globais
app.use(rotaNaoEncontrada);
app.use(tratadorDeErros);

// 7. Inicializa o PostgreSQL e sobe o servidor nas portas 3000 e 80 (para localhost/home e localhost/admin)
if (require.main === module) {
  inicializarBancoDeDados().finally(() => {
    app.listen(PORTA, () => {
      console.log(`☕ Servidor rodando em http://localhost:${PORTA}/home (Cliente) e http://localhost:${PORTA}/admin (Admin)`);
    });

    if (PORTA !== 80) {
      const servidorPorta80 = app.listen(80, () => {
        console.log(`🌐 Atalho porta 80 ativo: http://localhost/home (Cliente) e http://localhost/admin (Admin)`);
      });
      servidorPorta80.on('error', () => {
        // Caso a porta 80 esteja ocupada pelo sistema operacional, mantém apenas a porta 3000 sem erro
      });
    }
  });
}

module.exports = app;
