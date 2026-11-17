/**
 * @file repositorioCore.js
 * @description Camada adaptadora de persistência (Ponte Core <-> PostgreSQL `database/queries.js`).
 *
 * Responsabilidade:
 * - Conectar os módulos de regras de negócio (`core/`) às queries SQL das 8 tabelas da modelagem
 *   relacional em `database/queries.js` (`Cliente`, `Funcionario`, `Categoria`, `Produto`,
 *   `Pedido`, `Item_Pedido`, `Pagamento`, `Favorito`).
 * - Caso o PostgreSQL não esteja conectado, não retorna conteúdo morto/falso nas listagens,
 *   sinalizando `postgresConectado: false` para que o Front-end exiba a mensagem
 *   "Não conectado no banco de dados".
 */

const fs = require('fs');
const path = require('path');
const {
  estaConectadoAoPostgres,
  obterUltimoErroPostgres,
} = require('../database/connection');
const { AppError } = require('./errosCore');

const CAMINHO_QUERIES = path.resolve(__dirname, '../database/queries.js');

function carregarModuloQueries() {
  try {
    if (fs.existsSync(CAMINHO_QUERIES)) {
      const modulo = require(CAMINHO_QUERIES);
      if (modulo && typeof modulo === 'object' && Object.keys(modulo).length > 0) {
        return modulo;
      }
    }
  } catch (erro) {
    console.warn('[RepositorioCore] Erro ao carregar database/queries.js:', erro.message);
  }
  return null;
}

/**
 * Executa a função correspondente em `database/queries.js`.
 * Se não estiver conectado ao PostgreSQL:
 * - Para listagens/buscas de leitura, retorna `valorDesconectado` (`[]` ou `null`) sem conteúdo morto.
 * - Para ações de escrita, lança um erro claro informando "Não conectado no banco de dados".
 */
async function executarNoBanco(nomesFuncoes, { ehEscrita = false, valorDesconectado = null } = {}, ...args) {
  if (!estaConectadoAoPostgres()) {
    if (ehEscrita) {
      throw new AppError('Não conectado no banco de dados', 503, 'BANCO_DESCONECTADO');
    }
    return valorDesconectado;
  }

  const queries = carregarModuloQueries();
  if (!queries) {
    if (ehEscrita) {
      throw new AppError('Não conectado no banco de dados', 503, 'BANCO_DESCONECTADO');
    }
    return valorDesconectado;
  }

  for (const nome of nomesFuncoes) {
    if (typeof queries[nome] === 'function') {
      try {
        return await queries[nome](...args);
      } catch (erro) {
        // Caso o PostgreSQL caia durante a execução
        if (erro.code === 'ECONNREFUSED' || erro.code === '57P01' || erro.code === '28P01') {
          if (ehEscrita) {
            throw new AppError('Não conectado no banco de dados', 503, 'BANCO_DESCONECTADO');
          }
          return valorDesconectado;
        }
        throw erro;
      }
    }
  }

  return valorDesconectado;
}

// ============================================================================
// OPERAÇÕES DE USUÁRIOS (Cliente + Funcionario + Favorito)
// ============================================================================

async function buscarUsuarioPorId(id) {
  return executarNoBanco(['buscarUsuarioPorId'], { ehEscrita: false, valorDesconectado: null }, id);
}

async function buscarUsuarioPorEmail(email) {
  return executarNoBanco(['buscarUsuarioPorEmail'], { ehEscrita: false, valorDesconectado: null }, email);
}

async function buscarUsuarioPorTelefone(telefone) {
  return executarNoBanco(['buscarUsuarioPorTelefone'], { ehEscrita: false, valorDesconectado: null }, telefone);
}

async function buscarUsuarioPorLogin(loginOuNome) {
  return executarNoBanco(['buscarUsuarioPorLogin'], { ehEscrita: false, valorDesconectado: null }, loginOuNome);
}

async function listarUsuarios(filtros = {}) {
  return executarNoBanco(['listarUsuarios'], { ehEscrita: false, valorDesconectado: [] }, filtros);
}

async function criarUsuario(dadosUsuario) {
  return executarNoBanco(['criarUsuario'], { ehEscrita: true }, dadosUsuario);
}

async function atualizarUsuario(id, camposAtualizados) {
  return executarNoBanco(['atualizarUsuario'], { ehEscrita: true }, id, camposAtualizados);
}

async function removerUsuario(id) {
  return executarNoBanco(['removerUsuario'], { ehEscrita: true }, id);
}

// ============================================================================
// OPERAÇÕES DE CATEGORIAS E PRODUTOS DO CARDÁPIO
// ============================================================================

async function listarCategorias(apenasAtivas = false) {
  return executarNoBanco(['listarCategorias'], { ehEscrita: false, valorDesconectado: [] }, apenasAtivas);
}

async function buscarCategoriaPorId(id) {
  return executarNoBanco(['buscarCategoriaPorId'], { ehEscrita: false, valorDesconectado: null }, id);
}

async function criarCategoria(dadosCategoria) {
  return executarNoBanco(['criarCategoria'], { ehEscrita: true }, dadosCategoria);
}

async function atualizarCategoria(id, campos) {
  return executarNoBanco(['atualizarCategoria'], { ehEscrita: true }, id, campos);
}

async function removerCategoria(id) {
  return executarNoBanco(['deletarCategoria', 'removerCategoria'], { ehEscrita: true }, id);
}

async function listarItensCardapio(filtros = {}) {
  return executarNoBanco(['listarItensCardapio'], { ehEscrita: false, valorDesconectado: [] }, filtros);
}

async function buscarItemCardapioPorId(id) {
  return executarNoBanco(['buscarItemCardapioPorId'], { ehEscrita: false, valorDesconectado: null }, id);
}

async function criarItemCardapio(dadosItem) {
  return executarNoBanco(['criarProduto', 'criarItemCardapio'], { ehEscrita: true }, dadosItem);
}

async function atualizarItemCardapio(id, campos) {
  return executarNoBanco(['atualizarProduto', 'atualizarItemCardapio'], { ehEscrita: true }, id, campos);
}

async function removerItemCardapio(id) {
  return executarNoBanco(['deletarProduto', 'removerItemCardapio'], { ehEscrita: true }, id);
}

// ============================================================================
// OPERAÇÕES DE SACOLA E PEDIDOS (Pedido + Item_Pedido + Pagamento)
// ============================================================================

async function obterSacolaUsuario(usuarioId) {
  return executarNoBanco(['obterSacolaUsuario'], { ehEscrita: false, valorDesconectado: [] }, usuarioId);
}

async function salvarSacolaUsuario(usuarioId, itensSacola) {
  return executarNoBanco(['salvarSacolaUsuario'], { ehEscrita: true }, usuarioId, itensSacola);
}

async function obterProximoNumeroPedido() {
  return executarNoBanco(['obterProximoNumeroPedido'], { ehEscrita: false, valorDesconectado: 52681 });
}

async function criarPedido(dadosPedido) {
  return executarNoBanco(['criarPedido'], { ehEscrita: true }, dadosPedido);
}

async function buscarPedidoPorId(id) {
  return executarNoBanco(['buscarPedidoPorId'], { ehEscrita: false, valorDesconectado: null }, id);
}

async function listarPedidos(filtros = {}) {
  return executarNoBanco(['listarPedidos'], { ehEscrita: false, valorDesconectado: [] }, filtros);
}

async function atualizarPedido(id, campos) {
  return executarNoBanco(['atualizarPedido'], { ehEscrita: true }, id, campos);
}

async function removerPedido(id) {
  return executarNoBanco(['removerPedido'], { ehEscrita: true }, id);
}

function verificarStatusBanco() {
  const conectado = estaConectadoAoPostgres();
  return {
    sgbd: 'PostgreSQL',
    banco: process.env.DB_NAME || 'cafeteria',
    host: process.env.DB_HOST || 'localhost',
    porta: Number(process.env.DB_PORT) || 5432,
    modo: conectado ? 'postgresql_local_pgadmin' : 'desconectado',
    postgresConectado: conectado,
    avisoConexao: conectado ? null : 'Não conectado no banco de dados',
    detalheErro: conectado ? null : obterUltimoErroPostgres(),
  };
}

module.exports = {
  verificarStatusBanco,
  // Usuários
  buscarUsuarioPorId,
  buscarUsuarioPorEmail,
  buscarUsuarioPorTelefone,
  buscarUsuarioPorLogin,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  removerUsuario,
  // Categorias
  listarCategorias,
  buscarCategoriaPorId,
  criarCategoria,
  atualizarCategoria,
  removerCategoria,
  // Cardápio / Produtos
  listarItensCardapio,
  buscarItemCardapioPorId,
  criarItemCardapio,
  atualizarItemCardapio,
  removerItemCardapio,
  // Sacola e Pedidos
  obterSacolaUsuario,
  salvarSacolaUsuario,
  obterProximoNumeroPedido,
  criarPedido,
  buscarPedidoPorId,
  listarPedidos,
  atualizarPedido,
  removerPedido,
};
