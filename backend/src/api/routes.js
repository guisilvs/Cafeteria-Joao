/**
 * @file routes.js
 * @description Definição centralizada de todas as rotas da API (GET, POST, PUT, PATCH, DELETE).
 */

const express = require('express');
const handlers = require('./handlers');
const {
  exigirAutenticacao,
  autenticacaoOpcional,
  exigirAdmin,
} = require('./middlewares/authMiddleware');
const { limitadorAutenticacao } = require('./middlewares/securityMiddleware');
const { receberFotoOpcional } = require('./middlewares/uploadMiddleware');

const router = express.Router();

// ============================================================================
// 0. SAÚDE DA API E INFORMAÇÕES DO SITE
// ============================================================================
router.get('/health', handlers.obterStatusSistema);
router.get('/status', handlers.obterStatusSistema);
router.get('/site/info', handlers.obterInformacoesSite);

// ============================================================================
// 1. AUTENTICAÇÃO E CONTA (CLIENTE E ADMINISTRADOR)
// ============================================================================
router.post('/auth/registro', limitadorAutenticacao, receberFotoOpcional, handlers.registrarCliente);
router.post('/auth/cadastro', limitadorAutenticacao, receberFotoOpcional, handlers.registrarCliente);
router.post('/auth/login', limitadorAutenticacao, handlers.loginUsuario);
router.post('/auth/recuperar-senha', limitadorAutenticacao, handlers.recuperarSenha);
router.post('/auth/redefinir-senha', limitadorAutenticacao, handlers.recuperarSenha);

// Admin: login (suporta login padrão "Admin" / "123456", e-mail ou telefone)
router.post('/auth/admin/login', limitadorAutenticacao, handlers.loginAdmin);
router.post('/admin/login', limitadorAutenticacao, handlers.loginAdmin);

// Sessão, Perfil e Alteração de Senha do usuário autenticado
router.get('/auth/me', exigirAutenticacao, handlers.obterPerfilAtual);
router.get('/auth/perfil', exigirAutenticacao, handlers.obterPerfilAtual);
router.put('/auth/perfil', exigirAutenticacao, receberFotoOpcional, handlers.atualizarPerfilAtual);
router.patch('/auth/alterar-senha', exigirAutenticacao, handlers.alterarSenha);
router.put('/auth/alterar-senha', exigirAutenticacao, handlers.alterarSenha);
router.post('/auth/logout', handlers.logoutUsuario);

// ============================================================================
// 2. CARDÁPIO PÚBLICO (CATEGORIAS E PRODUTOS VISÍVEIS)
// ============================================================================
router.get('/cardapio', autenticacaoOpcional, handlers.obterCardapioPublico);
router.get('/cardapio/itens', autenticacaoOpcional, handlers.obterCardapioPublico);
router.get('/produtos', autenticacaoOpcional, handlers.obterCardapioPublico);
router.get('/cardapio/itens/:id', autenticacaoOpcional, handlers.obterItemCardapioPublico);
router.get('/produtos/:id', autenticacaoOpcional, handlers.obterItemCardapioPublico);
router.get('/categorias', handlers.listarCategoriasPublicas);

// ============================================================================
// 3. FAVORITOS DO CLIENTE
// ============================================================================
router.get('/favoritos', exigirAutenticacao, handlers.listarFavoritos);
router.post('/favoritos/toggle/:itemId', exigirAutenticacao, handlers.alternarFavorito);
router.post('/favoritos/:itemId', exigirAutenticacao, handlers.adicionarFavorito);
router.post('/favoritos', exigirAutenticacao, handlers.adicionarFavorito);
router.delete('/favoritos/:itemId', exigirAutenticacao, handlers.removerFavorito);

// ============================================================================
// 4. SACOLA E PEDIDOS DO CLIENTE
// ============================================================================
router.get('/sacola', exigirAutenticacao, handlers.obterSacola);
router.post('/sacola/itens', exigirAutenticacao, handlers.adicionarItemSacola);
router.patch('/sacola/itens/:itemId', exigirAutenticacao, handlers.atualizarItemSacola);
router.delete('/sacola/itens/:itemId', exigirAutenticacao, handlers.removerItemSacola);
router.delete('/sacola', exigirAutenticacao, handlers.limparSacola);

router.post('/pedidos', exigirAutenticacao, handlers.criarPedidoCliente);
router.get('/pedidos', exigirAutenticacao, handlers.listarMeusPedidos);
router.get('/pedidos/andamento', exigirAutenticacao, handlers.listarMeusPedidosEmAndamento);
router.get('/pedidos/historico', exigirAutenticacao, handlers.listarMeuHistoricoPedidos);
router.get('/pedidos/:id', exigirAutenticacao, handlers.obterPedidoPorId);

// ============================================================================
// 5. PAINEL ADMINISTRADOR (FUNCIONÁRIO)
// ============================================================================
router.get('/admin/resumo', exigirAutenticacao, exigirAdmin, handlers.obterResumoPainelAdmin);

// Admin: Gerenciar e modificar pedidos
router.get('/admin/pedidos', exigirAutenticacao, exigirAdmin, handlers.listarPedidosAdmin);
router.get('/admin/pedidos/pendentes', exigirAutenticacao, exigirAdmin, handlers.listarPedidosPendentesAdmin);
router.get('/admin/pedidos/andamento', exigirAutenticacao, exigirAdmin, handlers.listarPedidosPendentesAdmin);
router.get('/admin/pedidos/concluidos', exigirAutenticacao, exigirAdmin, handlers.listarHistoricoPedidosAdmin);
router.get('/admin/pedidos/historico', exigirAutenticacao, exigirAdmin, handlers.listarHistoricoPedidosAdmin);
router.put('/admin/pedidos/:id', exigirAutenticacao, exigirAdmin, handlers.atualizarPedidoAdmin);
router.patch('/admin/pedidos/:id/status', exigirAutenticacao, exigirAdmin, handlers.alterarStatusPedidoAdmin);
router.patch('/admin/pedidos/:id/concluir', exigirAutenticacao, exigirAdmin, handlers.concluirPedidoAdmin);
router.patch('/admin/pedidos/:id/cancelar', exigirAutenticacao, exigirAdmin, handlers.cancelarPedidoAdmin);
router.patch('/admin/pedidos/:id/reabrir', exigirAutenticacao, exigirAdmin, handlers.reabrirPedidoAdmin);
router.delete('/admin/pedidos/:id', exigirAutenticacao, exigirAdmin, handlers.removerPedidoAdmin);

// Admin: Gerenciar categorias do cardápio
router.get('/admin/categorias', exigirAutenticacao, exigirAdmin, handlers.listarCategoriasAdmin);
router.get('/admin/categorias/:id/itens', exigirAutenticacao, exigirAdmin, handlers.obterCategoriaComItensAdmin);
router.post('/admin/categorias', exigirAutenticacao, exigirAdmin, handlers.criarCategoriaAdmin);
router.patch('/admin/categorias/reordenar', exigirAutenticacao, exigirAdmin, handlers.reordenarCategoriasAdmin);
router.put('/admin/categorias/:id', exigirAutenticacao, exigirAdmin, handlers.atualizarCategoriaAdmin);
router.delete('/admin/categorias/:id', exigirAutenticacao, exigirAdmin, handlers.removerCategoriaAdmin);

// Admin: Gerenciar produtos do cardápio (pertencentes a uma categoria)
router.get('/admin/cardapio/itens', exigirAutenticacao, exigirAdmin, handlers.listarItensAdmin);
router.get('/admin/produtos', exigirAutenticacao, exigirAdmin, handlers.listarItensAdmin);
router.post('/admin/cardapio/itens', exigirAutenticacao, exigirAdmin, receberFotoOpcional, handlers.criarItemAdmin);
router.post('/admin/produtos', exigirAutenticacao, exigirAdmin, receberFotoOpcional, handlers.criarItemAdmin);
router.put('/admin/cardapio/itens/:id', exigirAutenticacao, exigirAdmin, receberFotoOpcional, handlers.atualizarItemAdmin);
router.put('/admin/produtos/:id', exigirAutenticacao, exigirAdmin, receberFotoOpcional, handlers.atualizarItemAdmin);
router.patch('/admin/cardapio/itens/:id/visibilidade', exigirAutenticacao, exigirAdmin, handlers.alternarVisibilidadeItemAdmin);
router.patch('/admin/produtos/:id/visibilidade', exigirAutenticacao, exigirAdmin, handlers.alternarVisibilidadeItemAdmin);
router.delete('/admin/cardapio/itens/:id', exigirAutenticacao, exigirAdmin, handlers.removerItemAdmin);
router.delete('/admin/produtos/:id', exigirAutenticacao, exigirAdmin, handlers.removerItemAdmin);

// Utilitário de compressão/preview de imagem .webp
router.post('/imagens/webp', exigirAutenticacao, receberFotoOpcional, handlers.comprimirImagemParaWebp);

// Admin: Gerenciar usuários (clientes, funcionários e Admin)
router.get('/admin/usuarios', exigirAutenticacao, exigirAdmin, handlers.listarUsuariosAdmin);
router.get('/admin/usuarios/:id', exigirAutenticacao, exigirAdmin, handlers.obterUsuarioAdminPorId);
router.post('/admin/usuarios', exigirAutenticacao, exigirAdmin, receberFotoOpcional, handlers.criarUsuarioAdmin);
router.put('/admin/usuarios/:id', exigirAutenticacao, exigirAdmin, receberFotoOpcional, handlers.atualizarUsuarioAdmin);
router.patch('/admin/usuarios/:id/status', exigirAutenticacao, exigirAdmin, handlers.alterarStatusUsuarioAdmin);
router.delete('/admin/usuarios/:id', exigirAutenticacao, exigirAdmin, handlers.removerUsuarioAdmin);

module.exports = router;
