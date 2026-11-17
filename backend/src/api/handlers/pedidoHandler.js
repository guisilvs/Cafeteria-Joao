/**
 * @file pedidoHandler.js
 * @description Handlers da camada de API para Sacola de Compras e Pedidos (Cliente e Admin).
 */

const pedidoCore = require('../../core/pedidoCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

// ============================================================================
// HANDLERS DE SACOLA DO CLIENTE
// ============================================================================

const obterSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.obterSacolaDetalhadaCore(req.usuario.id);
  res.status(200).json({
    sucesso: true,
    sacola,
  });
});

const adicionarItemSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.adicionarItemSacolaCore(req.usuario.id, req.body);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Item adicionado ao pedido.',
    sacola,
  });
});

const atualizarItemSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.atualizarQuantidadeItemSacolaCore(
    req.usuario.id,
    req.params.itemId,
    req.body.quantidade
  );
  res.status(200).json({
    sucesso: true,
    mensagem: 'Quantidade atualizada no pedido.',
    sacola,
  });
});

const removerItemSacola = asyncHandler(async (req, res) => {
  const apenasUmaUnidade =
    req.query.apenasUmaUnidade === 'true' || req.body?.apenasUmaUnidade === true;

  const sacola = await pedidoCore.removerItemSacolaCore(req.usuario.id, req.params.itemId, {
    apenasUmaUnidade,
  });
  res.status(200).json({
    sucesso: true,
    mensagem: 'Item removido do pedido.',
    sacola,
  });
});

const limparSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.limparSacolaCore(req.usuario.id);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Pedido limpo com sucesso.',
    sacola,
  });
});

// ============================================================================
// HANDLERS DE PEDIDOS DO CLIENTE
// ============================================================================

const criarPedidoCliente = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.criarPedidoClienteCore(req.usuario.id, req.body);
  res.status(201).json({
    sucesso: true,
    mensagem:
      'Estamos preparando seu pedido. Você pode acompanhar o progresso no seu perfil ou continuar navegando no nosso cardápio.',
    pedido,
  });
});

const listarMeusPedidos = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosClienteCore(req.usuario.id, {
    tipo: req.query.tipo,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

const listarMeusPedidosEmAndamento = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosClienteCore(req.usuario.id, {
    tipo: 'em_andamento',
  });

  res.status(200).json({
    sucesso: true,
    pedidos: resultado.pedidos,
    possuiPedidoEmAndamento: resultado.possuiPedidoEmAndamento,
    total: resultado.total,
  });
});

const listarMeuHistoricoPedidos = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosClienteCore(req.usuario.id, {
    tipo: 'historico',
  });

  res.status(200).json({
    sucesso: true,
    pedidos: resultado.pedidos,
    possuiPedidoEmAndamento: resultado.possuiPedidoEmAndamento,
    total: resultado.total,
  });
});

const obterPedidoPorId = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.buscarPedidoPorIdCore(req.params.id, req.usuario);
  res.status(200).json({
    sucesso: true,
    pedido,
  });
});

// ============================================================================
// HANDLERS DE PEDIDOS DO ADMINISTRADOR
// ============================================================================

const listarPedidosAdmin = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosAdminCore({
    status: req.query.status,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

const listarPedidosPendentesAdmin = asyncHandler(async (_req, res) => {
  const resultado = await pedidoCore.listarPedidosAdminCore();
  res.status(200).json({
    sucesso: true,
    pedidos: resultado.pendentes,
    possuiPedidosPendentes: resultado.possuiPedidosPendentes,
    total: resultado.totalPendentes,
  });
});

const listarHistoricoPedidosAdmin = asyncHandler(async (_req, res) => {
  const resultado = await pedidoCore.listarPedidosAdminCore();
  res.status(200).json({
    sucesso: true,
    pedidos: resultado.concluidos,
    total: resultado.totalConcluidos,
  });
});

const atualizarPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.atualizarPedidoAdminCore(req.params.id, req.body);
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} modificado com sucesso.`,
    pedido,
  });
});

const alterarStatusPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(
    req.params.id,
    req.body.status || req.body.acao
  );

  res.status(200).json({
    sucesso: true,
    mensagem: `Status do Pedido #${pedido.numero} atualizado para "${pedido.status_label}".`,
    pedido,
  });
});

const concluirPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(req.params.id, 'concluido');
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} concluído com sucesso.`,
    pedido,
  });
});

const cancelarPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(req.params.id, 'cancelado');
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} cancelado.`,
    pedido,
  });
});

const reabrirPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(req.params.id, 'preparando');
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} reaberto e retornado para a fila de preparo.`,
    pedido,
  });
});

const removerPedidoAdmin = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.removerPedidoAdminCore(req.params.id);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Pedido removido com sucesso.',
    ...resultado,
  });
});

module.exports = {
  obterSacola,
  adicionarItemSacola,
  atualizarItemSacola,
  removerItemSacola,
  limparSacola,
  criarPedidoCliente,
  listarMeusPedidos,
  listarMeusPedidosEmAndamento,
  listarMeuHistoricoPedidos,
  obterPedidoPorId,
  listarPedidosAdmin,
  listarPedidosPendentesAdmin,
  listarHistoricoPedidosAdmin,
  atualizarPedidoAdmin,
  alterarStatusPedidoAdmin,
  concluirPedidoAdmin,
  cancelarPedidoAdmin,
  reabrirPedidoAdmin,
  removerPedidoAdmin,
};
