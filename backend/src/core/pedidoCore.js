/**
 * @file pedidoCore.js
 * @description Regras de negócio para Sacola de Compras e Pedidos (Cliente e Administrador).
 *
 * Atende aos requisitos:
 * - Cliente: adicionar itens ao carrinho, enviar pedido, ver pedidos em andamento e histórico
 * - Admin: ver e modificar pedidos (alterar itens, quantidades, status, unidade, previsão ou excluir)
 */

const repositorio = require('./repositorioCore');
const authCore = require('./authCore');
const {
  limparTextoSimples,
  formatarMoedaBRL,
  validarId,
} = require('./validacaoCore');
const {
  erroValidacao,
  erroNaoEncontrado,
  erroProibido,
} = require('./errosCore');

const UNIDADE_PADRAO = process.env.UNIDADE_PADRAO || 'Shopping Beira Mar';
const PREVISAO_MINUTOS_PADRAO = Number(process.env.PREVISAO_RETIRADA_MINUTOS) || 5;

function formatarDataHoraBR(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return String(isoDate);

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} - ${hora}:${min}`;
}

function formatarPedido(pedido) {
  if (!pedido) return null;

  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const totalNumerico =
    pedido.total !== undefined
      ? Number(pedido.total)
      : itens.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);

  const totalArredondado = Math.round(totalNumerico * 100) / 100;
  const numeroPedido = pedido.numero || pedido.id;

  const resumoItensTexto = itens
    .map((i) => `${i.quantidade}x ${i.nome}`)
    .join('\n');

  const emAndamento = pedido.status === 'pendente' || pedido.status === 'preparando';

  let statusLabel = 'Preparando';
  if (pedido.status === 'concluido') statusLabel = 'Finalizado';
  if (pedido.status === 'cancelado') statusLabel = 'Cancelado';

  const previsaoMinutos = pedido.previsao_minutos || PREVISAO_MINUTOS_PADRAO;
  const finalizadoFormatado = formatarDataHoraBR(pedido.finalizado_em);
  const criadoFormatado = formatarDataHoraBR(pedido.criado_em);

  return {
    ...pedido,
    numero: numeroPedido,
    codigo_formatado: `Pedido #${numeroPedido}`,
    titulo_status_curto: emAndamento
      ? `#${numeroPedido} Em preparo...`
      : `#${numeroPedido} Retirado`,
    itens,
    resumo_itens_texto: resumoItensTexto,
    total: totalArredondado,
    total_formatado: formatarMoedaBRL(totalArredondado),
    retirada_label: `Retirada: ${pedido.unidade_retirada || UNIDADE_PADRAO}`,
    em_andamento: emAndamento,
    status_label: statusLabel,
    previsao_minutos: previsaoMinutos,
    previsao_label: `Previsão de retirada: ${previsaoMinutos} minutos`,
    texto_retirada_cliente: finalizadoFormatado
      ? `Você retirou o pedido em: ${finalizadoFormatado}`
      : null,
    tempo_ate_atraso_minutos: previsaoMinutos,
    tempo_ate_atraso_label: `Tempo até atraso: ${previsaoMinutos} minutos`,
    texto_separado_admin: finalizadoFormatado
      ? `Pedido separado em: ${finalizadoFormatado}`
      : null,
    criado_em_formatado: criadoFormatado,
    finalizado_em_formatado: finalizadoFormatado,
  };
}

// ============================================================================
// REGRAS DE SACOLA / CARRINHO DO CLIENTE
// ============================================================================

async function obterSacolaDetalhadaCore(usuarioId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const sacolaBruta = await repositorio.obterSacolaUsuario(idUsuario);
  const proximoNumero = await repositorio.obterProximoNumeroPedido();
  const itensDetalhados = [];
  const itensExpandidos = [];

  for (const entrada of sacolaBruta) {
    const produto = await repositorio.buscarItemCardapioPorId(entrada.item_id);
    if (produto && !produto.oculto) {
      const quantidade = Math.max(1, Number(entrada.quantidade) || 1);
      const precoUnitario = Number(produto.preco) || 0;
      const subtotal = Math.round(precoUnitario * quantidade * 100) / 100;

      const itemAgrupado = {
        item_id: produto.id,
        nome: produto.nome,
        descricao: produto.descricao,
        foto_webp: produto.foto_webp || null,
        preco_unitario: precoUnitario,
        preco_formatado: formatarMoedaBRL(precoUnitario),
        quantidade,
        subtotal,
        subtotal_formatado: formatarMoedaBRL(subtotal),
      };

      itensDetalhados.push(itemAgrupado);

      for (let u = 0; u < quantidade; u += 1) {
        itensExpandidos.push({
          ...itemAgrupado,
          quantidade: 1,
          subtotal: precoUnitario,
          subtotal_formatado: formatarMoedaBRL(precoUnitario),
        });
      }
    }
  }

  const total =
    Math.round(itensDetalhados.reduce((acc, i) => acc + i.subtotal, 0) * 100) / 100;
  const totalQuantidade = itensDetalhados.reduce((acc, i) => acc + i.quantidade, 0);

  return {
    usuario_id: usuario.id,
    cliente_nome: usuario.nome,
    cliente_foto: usuario.foto_webp || null,
    para_label: `Para: ${usuario.nome}`,
    unidade_retirada: UNIDADE_PADRAO,
    unidade_label: `Unidade: ${UNIDADE_PADRAO}`,
    numero_pedido_previsto: proximoNumero,
    pedido_previsto_label: `Pedido: #${proximoNumero}`,
    itens: itensDetalhados,
    itens_expandidos: itensExpandidos,
    total_itens: totalQuantidade,
    total,
    total_formatado: formatarMoedaBRL(total),
  };
}

async function adicionarItemSacolaCore(usuarioId, dados = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(
    dados.item_id !== undefined ? dados.item_id : dados.itemId || dados.produto_id || dados.id,
    'ID do item do cardápio'
  );

  const quantidadeAdicional =
    dados.quantidade !== undefined ? Number(dados.quantidade) : 1;

  if (!Number.isInteger(quantidadeAdicional) || quantidadeAdicional < 1 || quantidadeAdicional > 50) {
    throw erroValidacao('A quantidade deve ser um número inteiro entre 1 e 50.');
  }

  const produto = await repositorio.buscarItemCardapioPorId(idItem);
  if (!produto || produto.oculto) {
    throw erroNaoEncontrado('Produto disponível no cardápio');
  }

  const sacolaAtual = [...(await repositorio.obterSacolaUsuario(idUsuario))];
  const idxExistente = sacolaAtual.findIndex(
    (entry) => String(entry.item_id) === String(produto.id)
  );

  if (idxExistente >= 0) {
    sacolaAtual[idxExistente] = {
      ...sacolaAtual[idxExistente],
      quantidade: sacolaAtual[idxExistente].quantidade + quantidadeAdicional,
    };
  } else {
    sacolaAtual.push({
      item_id: produto.id,
      quantidade: quantidadeAdicional,
    });
  }

  await repositorio.salvarSacolaUsuario(idUsuario, sacolaAtual);
  return obterSacolaDetalhadaCore(idUsuario);
}

async function atualizarQuantidadeItemSacolaCore(usuarioId, itemId, novaQuantidade) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');
  const qtd = Number(novaQuantidade);

  if (!Number.isInteger(qtd) || qtd < 0 || qtd > 50) {
    throw erroValidacao('Informe uma quantidade válida (entre 0 e 50).');
  }

  if (qtd === 0) {
    return removerItemSacolaCore(idUsuario, idItem, { apenasUmaUnidade: false });
  }

  const sacolaAtual = [...(await repositorio.obterSacolaUsuario(idUsuario))];
  const idx = sacolaAtual.findIndex((entry) => String(entry.item_id) === String(idItem));
  if (idx === -1) {
    throw erroNaoEncontrado('Item na sacola');
  }

  sacolaAtual[idx] = { ...sacolaAtual[idx], quantidade: qtd };
  await repositorio.salvarSacolaUsuario(idUsuario, sacolaAtual);
  return obterSacolaDetalhadaCore(idUsuario);
}

async function removerItemSacolaCore(usuarioId, itemId, { apenasUmaUnidade = false } = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');

  const sacolaAtual = [...(await repositorio.obterSacolaUsuario(idUsuario))];
  const idx = sacolaAtual.findIndex((entry) => String(entry.item_id) === String(idItem));

  if (idx >= 0) {
    if (apenasUmaUnidade && sacolaAtual[idx].quantidade > 1) {
      sacolaAtual[idx] = {
        ...sacolaAtual[idx],
        quantidade: sacolaAtual[idx].quantidade - 1,
      };
    } else {
      sacolaAtual.splice(idx, 1);
    }
    await repositorio.salvarSacolaUsuario(idUsuario, sacolaAtual);
  }

  return obterSacolaDetalhadaCore(idUsuario);
}

async function limparSacolaCore(usuarioId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  await repositorio.salvarSacolaUsuario(idUsuario, []);
  return obterSacolaDetalhadaCore(idUsuario);
}

// ============================================================================
// CRIAÇÃO E GERENCIAMENTO DE PEDIDOS
// ============================================================================

async function validarECalcularItensPedido(itensEntrada) {
  if (!Array.isArray(itensEntrada) || itensEntrada.length === 0) {
    throw erroValidacao('Adicione pelo menos um item do cardápio para realizar o pedido.');
  }

  const mapaQuantidades = new Map();

  for (const entrada of itensEntrada) {
    const idBruto =
      typeof entrada === 'object' && entrada !== null
        ? entrada.item_id || entrada.itemId || entrada.produto_id || entrada.id
        : entrada;

    const qtdBruta =
      typeof entrada === 'object' && entrada !== null && entrada.quantidade !== undefined
        ? Number(entrada.quantidade)
        : 1;

    const idValido = validarId(idBruto, 'ID do item do pedido');
    if (!Number.isInteger(qtdBruta) || qtdBruta < 1 || qtdBruta > 50) {
      throw erroValidacao('Quantidade inválida para item do pedido.');
    }

    const chave = String(idValido);
    mapaQuantidades.set(chave, (mapaQuantidades.get(chave) || 0) + qtdBruta);
  }

  const itensProcessados = [];
  let totalPedido = 0;

  for (const [idStr, quantidade] of mapaQuantidades.entries()) {
    const produto = await repositorio.buscarItemCardapioPorId(idStr);
    if (!produto || produto.oculto) {
      throw erroValidacao(`O item de ID "${idStr}" não está disponível no cardápio.`);
    }

    const precoUnitario = Number(produto.preco) || 0;
    const subtotal = Math.round(precoUnitario * quantidade * 100) / 100;
    totalPedido += subtotal;

    itensProcessados.push({
      item_id: produto.id,
      nome: produto.nome,
      descricao: produto.descricao,
      foto_webp: produto.foto_webp || null,
      preco_unitario: precoUnitario,
      quantidade,
      subtotal,
    });
  }

  return {
    itens: itensProcessados,
    total: Math.round(totalPedido * 100) / 100,
  };
}

async function criarPedidoClienteCore(usuarioId, dados = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  let itensParaProcessar = dados.itens;
  if (!Array.isArray(itensParaProcessar) || itensParaProcessar.length === 0) {
    const sacola = await repositorio.obterSacolaUsuario(idUsuario);
    if (!sacola || sacola.length === 0) {
      throw erroValidacao(
        'Sua sacola de pedidos está vazia. Adicione itens do cardápio antes de fazer o pedido.'
      );
    }
    itensParaProcessar = sacola;
  }

  const { itens, total } = await validarECalcularItensPedido(itensParaProcessar);

  const unidadeRetirada =
    limparTextoSimples(dados.unidade_retirada || dados.unidadeRetirada) || UNIDADE_PADRAO;
  const observacoes = dados.observacoes ? limparTextoSimples(dados.observacoes) : null;

  const novoPedido = await repositorio.criarPedido({
    usuario_id: usuario.id,
    cliente_nome: usuario.nome,
    cliente_foto: usuario.foto_webp || null,
    itens,
    total,
    unidade_retirada: unidadeRetirada,
    previsao_minutos: PREVISAO_MINUTOS_PADRAO,
    observacoes,
    status: 'preparando',
  });

  await repositorio.salvarSacolaUsuario(idUsuario, []);

  return formatarPedido(novoPedido);
}

async function listarPedidosClienteCore(usuarioId, filtros = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const todosBrutos = await repositorio.listarPedidos({ usuarioId: idUsuario });
  const todos = todosBrutos.map(formatarPedido);

  const emAndamento = todos.filter((p) => p.em_andamento);
  const historico = todos.filter((p) => !p.em_andamento);

  if (filtros.tipo === 'em_andamento') {
    return {
      pedidos: emAndamento,
      possuiPedidoEmAndamento: emAndamento.length > 0,
      total: emAndamento.length,
    };
  }
  if (filtros.tipo === 'historico') {
    return {
      pedidos: historico,
      possuiPedidoEmAndamento: emAndamento.length > 0,
      total: historico.length,
    };
  }

  return {
    emAndamento,
    historico,
    todos,
    possuiPedidoEmAndamento: emAndamento.length > 0,
    total: todos.length,
  };
}

async function buscarPedidoPorIdCore(pedidoId, usuarioSolicitante) {
  const id = validarId(pedidoId, 'ID do pedido');
  const pedido = await repositorio.buscarPedidoPorId(id);
  if (!pedido) {
    throw erroNaoEncontrado('Pedido');
  }

  const ehAdmin = authCore.usuarioEhAdminOuFuncionario(usuarioSolicitante);
  const ehDono =
    usuarioSolicitante && String(usuarioSolicitante.id) === String(pedido.usuario_id);

  if (!ehAdmin && !ehDono) {
    throw erroProibido('Você não tem permissão para visualizar este pedido.');
  }

  return formatarPedido(pedido);
}

// ============================================================================
// GERENCIAMENTO E MODIFICAÇÃO DE PEDIDOS PELO ADMINISTRADOR
// ============================================================================

async function listarPedidosAdminCore(filtros = {}) {
  const todosBrutos = await repositorio.listarPedidos({
    status: filtros.status,
  });

  const todos = todosBrutos.map(formatarPedido);
  const pendentes = todos.filter((p) => p.status === 'pendente' || p.status === 'preparando');
  const concluidos = todos.filter((p) => p.status === 'concluido' || p.status === 'cancelado');

  return {
    pendentes,
    concluidos,
    todos,
    possuiPedidosPendentes: pendentes.length > 0,
    totalPendentes: pendentes.length,
    totalConcluidos: concluidos.length,
    total: todos.length,
  };
}

function normalizarStatusPedido(statusBruto) {
  const statusNormalizado = String(statusBruto || '')
    .trim()
    .toLowerCase();

  if (
    statusNormalizado === 'concluido' ||
    statusNormalizado === 'concluir' ||
    statusNormalizado === 'finalizado' ||
    statusNormalizado === 'retirado'
  ) {
    return { status: 'concluido', finalizado_em: new Date().toISOString() };
  }
  if (statusNormalizado === 'cancelado' || statusNormalizado === 'cancelar') {
    return { status: 'cancelado', finalizado_em: new Date().toISOString() };
  }
  if (
    statusNormalizado === 'preparando' ||
    statusNormalizado === 'pendente' ||
    statusNormalizado === 'reabrir' ||
    statusNormalizado === 'reaberto'
  ) {
    return {
      status: statusNormalizado === 'pendente' ? 'pendente' : 'preparando',
      finalizado_em: null,
    };
  }

  throw erroValidacao(
    'Status de pedido inválido. Use "concluido", "cancelado", "preparando" ou "pendente".'
  );
}

async function alterarStatusPedidoAdminCore(pedidoId, novoStatus) {
  const id = validarId(pedidoId, 'ID do pedido');
  const pedidoAtual = await repositorio.buscarPedidoPorId(id);
  if (!pedidoAtual) {
    throw erroNaoEncontrado('Pedido');
  }

  const { status, finalizado_em } = normalizarStatusPedido(novoStatus);

  const atualizado = await repositorio.atualizarPedido(pedidoAtual.id, {
    status,
    finalizado_em,
  });

  return formatarPedido(atualizado);
}

/**
 * Permite ao Administrador modificar um pedido de forma completa:
 * - Alterar os itens/quantidades (recalculando o total automaticamente)
 * - Alterar unidade de retirada, previsão de minutos, observações ou status
 */
async function atualizarPedidoAdminCore(pedidoId, dados = {}) {
  const id = validarId(pedidoId, 'ID do pedido');
  const pedidoAtual = await repositorio.buscarPedidoPorId(id);
  if (!pedidoAtual) {
    throw erroNaoEncontrado('Pedido');
  }

  const camposParaAtualizar = {};

  if (Array.isArray(dados.itens) && dados.itens.length > 0) {
    const recalculado = await validarECalcularItensPedido(dados.itens);
    camposParaAtualizar.itens = recalculado.itens;
    camposParaAtualizar.total = recalculado.total;
  }

  if (dados.unidade_retirada !== undefined || dados.unidadeRetirada !== undefined) {
    const unidade = limparTextoSimples(dados.unidade_retirada || dados.unidadeRetirada);
    if (!unidade) {
      throw erroValidacao('A unidade de retirada não pode ficar vazia.');
    }
    camposParaAtualizar.unidade_retirada = unidade;
  }

  if (dados.previsao_minutos !== undefined || dados.previsaoMinutos !== undefined) {
    const prev = Number(
      dados.previsao_minutos !== undefined ? dados.previsao_minutos : dados.previsaoMinutos
    );
    if (!Number.isInteger(prev) || prev < 1 || prev > 240) {
      throw erroValidacao('A previsão de retirada deve ser entre 1 e 240 minutos.');
    }
    camposParaAtualizar.previsao_minutos = prev;
  }

  if (dados.observacoes !== undefined) {
    camposParaAtualizar.observacoes = dados.observacoes
      ? limparTextoSimples(dados.observacoes)
      : null;
  }

  if (dados.status !== undefined) {
    const { status, finalizado_em } = normalizarStatusPedido(dados.status);
    camposParaAtualizar.status = status;
    camposParaAtualizar.finalizado_em = finalizado_em;
  }

  const atualizado = await repositorio.atualizarPedido(pedidoAtual.id, camposParaAtualizar);
  return formatarPedido(atualizado);
}

/**
 * Permite ao Administrador remover um pedido do sistema caso necessário.
 */
async function removerPedidoAdminCore(pedidoId) {
  const id = validarId(pedidoId, 'ID do pedido');
  const removido = await repositorio.removerPedido(id);
  if (!removido) {
    throw erroNaoEncontrado('Pedido');
  }
  return { id, removido: true };
}

module.exports = {
  formatarPedido,
  // Sacola do Cliente
  obterSacolaDetalhadaCore,
  adicionarItemSacolaCore,
  atualizarQuantidadeItemSacolaCore,
  removerItemSacolaCore,
  limparSacolaCore,
  // Pedidos do Cliente
  criarPedidoClienteCore,
  listarPedidosClienteCore,
  buscarPedidoPorIdCore,
  // Pedidos do Administrador
  listarPedidosAdminCore,
  alterarStatusPedidoAdminCore,
  atualizarPedidoAdminCore,
  removerPedidoAdminCore,
};
