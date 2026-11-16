/**
 * @file pedidoHandler.js
 * @description Handlers da camada de API para Sacola de Compras e Pedidos (Cliente e Admin).
 */

const pedidoCore = require('../../core/pedidoCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

// ============================================================================
// HANDLERS DE SACOLA DO CLIENTE (TELA 16:336 "PEDIDO")
// ============================================================================

/**
 * GET /api/sacola
 * Retorna os itens atualmente adicionados ao pedido (sacola) pelo cliente logado.
 */
const obterSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.obterSacolaDetalhadaCore(req.usuario.id);
  res.status(200).json({
    sucesso: true,
    sacola,
  });
});

/**
 * POST /api/sacola/itens
 * Adiciona um item do cardápio ao pedido (sacola) do cliente ("Adicionar ao pedido").
 */
const adicionarItemSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.adicionarItemSacolaCore(req.usuario.id, req.body);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Item adicionado ao pedido.',
    sacola,
  });
});

/**
 * PATCH /api/sacola/itens/:itemId
 * Atualiza a quantidade de um item na sacola do cliente.
 */
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

/**
 * DELETE /api/sacola/itens/:itemId
 * Remove um item da sacola (Botão "X" da tela 16:336 do Figma).
 */
const removerItemSacola = asyncHandler(async (req, res) => {
  const sacola = await pedidoCore.removerItemSacolaCore(req.usuario.id, req.params.itemId);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Item removido do pedido.',
    sacola,
  });
});

/**
 * DELETE /api/sacola
 * Limpa todos os itens da sacola atual ("Limpar pedido" da tela 16:336 do Figma).
 */
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

/**
 * POST /api/pedidos
 * Envia o pedido para o estabelecimento (sem pagamento - tela 17:321 "Pedido realizado").
 * Aceita `{ itens: [...] }` no body OU converte automaticamente os itens da sacola do cliente.
 */
const criarPedidoCliente = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.criarPedidoClienteCore(req.usuario.id, req.body);
  res.status(201).json({
    sucesso: true,
    mensagem:
      'Estamos preparando seu pedido. Você pode acompanhar o progresso no seu perfil ou continuar navegando no nosso cardápio.',
    pedido,
  });
});

/**
 * GET /api/pedidos
 * Lista todos os pedidos do cliente logado (separados em `emAndamento` e `historico`).
 */
const listarMeusPedidos = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosClienteCore(req.usuario.id, {
    tipo: req.query.tipo,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

/**
 * GET /api/pedidos/andamento
 * Lista exclusivamente os pedidos em andamento do cliente logado.
 */
const listarMeusPedidosEmAndamento = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosClienteCore(req.usuario.id, {
    tipo: 'em_andamento',
  });

  res.status(200).json({
    sucesso: true,
    pedidos: resultado.pedidos,
    total: resultado.total,
  });
});

/**
 * GET /api/pedidos/historico
 * Lista exclusivamente o histórico de pedidos finalizados/cancelados do cliente logado.
 */
const listarMeuHistoricoPedidos = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosClienteCore(req.usuario.id, {
    tipo: 'historico',
  });

  res.status(200).json({
    sucesso: true,
    pedidos: resultado.pedidos,
    total: resultado.total,
  });
});

/**
 * GET /api/pedidos/:id
 * Busca detalhes de um pedido específico.
 */
const obterPedidoPorId = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.buscarPedidoPorIdCore(req.params.id, req.usuario);
  res.status(200).json({
    sucesso: true,
    pedido,
  });
});

// ============================================================================
// HANDLERS DE PEDIDOS DO ADMINISTRADOR (TELA 143:150 "ADMINISTRADOR - PEDIDOS")
// ============================================================================

/**
 * GET /api/admin/pedidos
 * Lista todos os pedidos para o painel Admin, separando em `pendentes` e `concluidos`.
 */
const listarPedidosAdmin = asyncHandler(async (req, res) => {
  const resultado = await pedidoCore.listarPedidosAdminCore({
    status: req.query.status,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

/**
 * GET /api/admin/pedidos/andamento (ou /api/admin/pedidos/pendentes)
 * Lista apenas os pedidos pendentes/em preparo no painel Admin.
 */
const listarPedidosPendentesAdmin = asyncHandler(async (_req, res) => {
  const resultado = await pedidoCore.listarPedidosAdminCore();
  res.status(200).json({
    sucesso: true,
    pedidos: resultado.pendentes,
    total: resultado.totalPendentes,
  });
});

/**
 * GET /api/admin/pedidos/historico (ou /api/admin/pedidos/concluidos)
 * Lista apenas o histórico de pedidos concluídos/cancelados no painel Admin.
 */
const listarHistoricoPedidosAdmin = asyncHandler(async (_req, res) => {
  const resultado = await pedidoCore.listarPedidosAdminCore();
  res.status(200).json({
    sucesso: true,
    pedidos: resultado.concluidos,
    total: resultado.totalConcluidos,
  });
});

/**
 * PATCH /api/admin/pedidos/:id/status
 * Altera o status de um pedido (`concluido`, `cancelado` ou `preparando`).
 */
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

/**
 * PATCH /api/admin/pedidos/:id/concluir
 * Marca um pedido em andamento como concluído (Botão "Concluir" na tela 143:150 do Figma).
 */
const concluirPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(req.params.id, 'concluido');
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} concluído com sucesso.`,
    pedido,
  });
});

/**
 * PATCH /api/admin/pedidos/:id/cancelar
 * Marca um pedido como cancelado (Botão "Cancelar" na tela 143:150 do Figma).
 */
const cancelarPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(req.params.id, 'cancelado');
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} cancelado.`,
    pedido,
  });
});

/**
 * PATCH /api/admin/pedidos/:id/reabrir
 * Reabre um pedido concluído/cancelado voltando para "preparando" (Botão "Reabrir" na tela 143:150 do Figma).
 */
const reabrirPedidoAdmin = asyncHandler(async (req, res) => {
  const pedido = await pedidoCore.alterarStatusPedidoAdminCore(req.params.id, 'preparando');
  res.status(200).json({
    sucesso: true,
    mensagem: `Pedido #${pedido.numero} reaberto e retornado para a fila de preparo.`,
    pedido,
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
  alterarStatusPedidoAdmin,
  concluirPedidoAdmin,
  cancelarPedidoAdmin,
  reabrirPedidoAdmin,
};
