/**
 * @file pedidoCore.js
 * @description Regras de negócio para Sacola de Compras e Pedidos (Cliente e Administrador).
 *
 * Atende aos requisitos:
 * - Cliente: 4. adicionar itens ao pedido (sacola/carrinho + remover item + limpar pedido)
 * - Cliente: 5. enviar pedido para o estabelecimento (sem pagamento)
 * - Cliente: 6. ver pedidos em andamento
 * - Cliente: 7. ver histórico de pedidos
 * - Admin: 2. ver e gerenciar pedidos em andamento (Concluir, Cancelar)
 * - Admin: 3. ver e gerenciar histórico de pedidos (Concluídos/Cancelados, Reabrir)
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

/**
 * Formata uma data ISO no padrão brasileiro do protótipo: `DD/MM/AAAA - HH:mm`.
 * @param {string|null} isoDate
 * @returns {string|null}
 */
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

/**
 * Enriquecimento visual/semântico do objeto de pedido para o Front-end (Cliente e Admin).
 * @param {object} pedido
 * @returns {object}
 */
function formatarPedido(pedido) {
  if (!pedido) return null;

  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const totalNumerico =
    pedido.total !== undefined
      ? Number(pedido.total)
      : itens.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);

  const totalArredondado = Math.round(totalNumerico * 100) / 100;

  const resumoItensTexto = itens
    .map((i) => `${i.quantidade}x ${i.nome}`)
    .join('\n');

  const emAndamento = pedido.status === 'pendente' || pedido.status === 'preparando';

  let statusLabel = 'Preparando';
  if (pedido.status === 'concluido') statusLabel = 'Finalizado';
  if (pedido.status === 'cancelado') statusLabel = 'Cancelado';

  const finalizadoFormatado = formatarDataHoraBR(pedido.finalizado_em);

  return {
    ...pedido,
    numero: pedido.numero || pedido.id,
    codigo_formatado: `Pedido #${pedido.numero || pedido.id}`,
    itens,
    resumo_itens_texto: resumoItensTexto,
    total: totalArredondado,
    total_formatado: formatarMoedaBRL(totalArredondado),
    em_andamento: emAndamento,
    status_label: statusLabel,
    previsao_minutos: pedido.previsao_minutos || PREVISAO_MINUTOS_PADRAO,
    previsao_label: `Previsão de retirada: ${pedido.previsao_minutos || PREVISAO_MINUTOS_PADRAO} minutos`,
    criado_em_formatado: formatarDataHoraBR(pedido.criado_em),
    finalizado_em_formatado: finalizadoFormatado,
  };
}

// ============================================================================
// REGRAS DE SACOLA / CARRINHO DO CLIENTE (TELA 16:336 "PEDIDO")
// ============================================================================

/**
 * Monta o resumo detalhado da sacola atual do cliente com preços atualizados do cardápio.
 * @param {number|string} usuarioId
 */
async function obterSacolaDetalhadaCore(usuarioId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const usuario = await repositorio.buscarUsuarioPorId(idUsuario);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const sacolaBruta = await repositorio.obterSacolaUsuario(idUsuario);
  const itensDetalhados = [];

  for (const entrada of sacolaBruta) {
    const produto = await repositorio.buscarItemCardapioPorId(entrada.item_id);
    if (produto && !produto.oculto) {
      const quantidade = Math.max(1, Number(entrada.quantidade) || 1);
      const precoUnitario = Number(produto.preco) || 0;
      const subtotal = Math.round(precoUnitario * quantidade * 100) / 100;

      itensDetalhados.push({
        item_id: produto.id,
        nome: produto.nome,
        descricao: produto.descricao,
        foto_webp: produto.foto_webp || null,
        preco_unitario: precoUnitario,
        preco_formatado: formatarMoedaBRL(precoUnitario),
        quantidade,
        subtotal,
        subtotal_formatado: formatarMoedaBRL(subtotal),
      });
    }
  }

  const total =
    Math.round(itensDetalhados.reduce((acc, i) => acc + i.subtotal, 0) * 100) / 100;
  const totalQuantidade = itensDetalhados.reduce((acc, i) => acc + i.quantidade, 0);

  return {
    usuario_id: usuario.id,
    cliente_nome: usuario.nome,
    unidade_retirada: UNIDADE_PADRAO,
    itens: itensDetalhados,
    total_itens: totalQuantidade,
    total,
    total_formatado: formatarMoedaBRL(total),
  };
}

/**
 * Adiciona um item do cardápio à sacola de pedido do cliente.
 * @param {number|string} usuarioId
 * @param {object} dados
 * @param {number|string} dados.item_id
 * @param {number} [dados.quantidade=1]
 */
async function adicionarItemSacolaCore(usuarioId, dados = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(
    dados.item_id !== undefined ? dados.item_id : dados.itemId || dados.produto_id,
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

/**
 * Atualiza a quantidade de um item na sacola (se quantidade <= 0, remove o item).
 * @param {number|string} usuarioId
 * @param {number|string} itemId
 * @param {number} novaQuantidade
 */
async function atualizarQuantidadeItemSacolaCore(usuarioId, itemId, novaQuantidade) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');
  const qtd = Number(novaQuantidade);

  if (!Number.isInteger(qtd) || qtd < 0 || qtd > 50) {
    throw erroValidacao('Informe uma quantidade válida (entre 0 e 50).');
  }

  if (qtd === 0) {
    return removerItemSacolaCore(idUsuario, idItem);
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

/**
 * Remove um item específico da sacola (Botão "X" da tela 16:336 do Figma).
 * @param {number|string} usuarioId
 * @param {number|string} itemId
 */
async function removerItemSacolaCore(usuarioId, itemId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const idItem = validarId(itemId, 'ID do item');

  const sacolaAtual = await repositorio.obterSacolaUsuario(idUsuario);
  const novaSacola = sacolaAtual.filter((entry) => String(entry.item_id) !== String(idItem));

  await repositorio.salvarSacolaUsuario(idUsuario, novaSacola);
  return obterSacolaDetalhadaCore(idUsuario);
}

/**
 * Esvazia completamente a sacola do cliente (Botão "Limpar pedido" da tela 16:336 do Figma).
 * @param {number|string} usuarioId
 */
async function limparSacolaCore(usuarioId) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  await repositorio.salvarSacolaUsuario(idUsuario, []);
  return obterSacolaDetalhadaCore(idUsuario);
}

// ============================================================================
// CRIAÇÃO E GERENCIAMENTO DE PEDIDOS
// ============================================================================

/**
 * Normaliza e valida uma lista de itens de pedido contra o banco de dados,
 * garantindo que o preço seja sempre calculado no Back-end (segurança contra manipulação de preço no Front-end).
 *
 * Aceita formatos:
 * - `[{ item_id: 1, quantidade: 2 }, { id: 10, quantidade: 1 }]`
 * - `[1, 10, 12]` (array simples de IDs de produtos)
 *
 * @param {Array} itensEntrada
 */
async function validarECalcularItensPedido(itensEntrada) {
  if (!Array.isArray(itensEntrada) || itensEntrada.length === 0) {
    throw erroValidacao('Adicione pelo menos um item do cardápio para realizar o pedido.');
  }

  // Agrupa quantidades caso o mesmo item apareça mais de uma vez na lista
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

/**
 * Envia um novo pedido para o estabelecimento (sem pagamento).
 * Se `dados.itens` não for informado no body, utiliza automaticamente os itens da sacola do cliente!
 *
 * @param {number|string} usuarioId
 * @param {object} [dados]
 * @param {Array} [dados.itens] - Lista opcional de itens (se omitida, usa a sacola atual)
 * @param {string} [dados.unidade_retirada] - Ex: "Shopping Beira Mar"
 * @param {string} [dados.observacoes]
 */
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

  const novoPedido = await repositorio.criarPedido({
    usuario_id: usuario.id,
    cliente_nome: usuario.nome,
    cliente_foto: usuario.foto_webp || null,
    itens,
    total,
    unidade_retirada: unidadeRetirada,
    previsao_minutos: PREVISAO_MINUTOS_PADRAO,
    status: 'preparando',
  });

  // Limpa a sacola temporária do cliente após enviar o pedido
  await repositorio.salvarSacolaUsuario(idUsuario, []);

  return formatarPedido(novoPedido);
}

/**
 * Lista os pedidos do cliente logado (separados em `emAndamento` e `historico`, além da lista completa).
 * Atende aos requisitos 6 e 7 do cliente e à tela 17:222 ("Minha conta - Pedido em andamento").
 *
 * @param {number|string} usuarioId
 * @param {object} [filtros]
 * @param {'em_andamento' | 'historico' | 'todos'} [filtros.tipo='todos']
 */
async function listarPedidosClienteCore(usuarioId, filtros = {}) {
  const idUsuario = validarId(usuarioId, 'ID do usuário');
  const todosBrutos = await repositorio.listarPedidos({ usuarioId: idUsuario });
  const todos = todosBrutos.map(formatarPedido);

  const emAndamento = todos.filter((p) => p.em_andamento);
  const historico = todos.filter((p) => !p.em_andamento);

  if (filtros.tipo === 'em_andamento') {
    return { pedidos: emAndamento, total: emAndamento.length };
  }
  if (filtros.tipo === 'historico') {
    return { pedidos: historico, total: historico.length };
  }

  return {
    emAndamento,
    historico,
    todos,
    possuiPedidoEmAndamento: emAndamento.length > 0,
    total: todos.length,
  };
}

/**
 * Busca um pedido específico por ID (permitindo acesso ao dono do pedido ou ao Admin).
 * @param {number|string} pedidoId
 * @param {object} usuarioSolicitante
 */
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
// GERENCIAMENTO DE PEDIDOS PELO ADMINISTRADOR (TELA 143:150 DO FIGMA)
// ============================================================================

/**
 * Lista todos os pedidos para o painel Administrador, separando em `pendentes` (em andamento)
 * e `concluidos` (histórico), conforme a tela "Administrador - pedidos" (143:150).
 *
 * @param {object} [filtros]
 */
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
    totalPendentes: pendentes.length,
    totalConcluidos: concluidos.length,
    total: todos.length,
  };
}

/**
 * Altera o status de um pedido no painel Administrador:
 * - Concluir (`status = 'concluido'`) -> Botão "Concluir" no Figma
 * - Cancelar (`status = 'cancelado'`) -> Botão "Cancelar" no Figma
 * - Reabrir (`status = 'preparando'`) -> Botão "Reabrir" no Figma
 *
 * @param {number|string} pedidoId
 * @param {'concluido' | 'cancelado' | 'preparando' | 'pendente'} novoStatus
 */
async function alterarStatusPedidoAdminCore(pedidoId, novoStatus) {
  const id = validarId(pedidoId, 'ID do pedido');
  const pedidoAtual = await repositorio.buscarPedidoPorId(id);
  if (!pedidoAtual) {
    throw erroNaoEncontrado('Pedido');
  }

  const statusNormalizado = String(novoStatus || '')
    .trim()
    .toLowerCase();

  let statusFinal;
  let finalizadoEm = pedidoAtual.finalizado_em;

  if (
    statusNormalizado === 'concluido' ||
    statusNormalizado === 'concluir' ||
    statusNormalizado === 'finalizado' ||
    statusNormalizado === 'retirado'
  ) {
    statusFinal = 'concluido';
    finalizadoEm = new Date().toISOString();
  } else if (statusNormalizado === 'cancelado' || statusNormalizado === 'cancelar') {
    statusFinal = 'cancelado';
    finalizadoEm = new Date().toISOString();
  } else if (
    statusNormalizado === 'preparando' ||
    statusNormalizado === 'pendente' ||
    statusNormalizado === 'reabrir' ||
    statusNormalizado === 'reaberto'
  ) {
    statusFinal = 'preparando';
    finalizadoEm = null;
  } else {
    throw erroValidacao(
      'Status de pedido inválido. Use "concluido", "cancelado" ou "preparando" (reabrir).'
    );
  }

  const atualizado = await repositorio.atualizarPedido(pedidoAtual.id, {
    status: statusFinal,
    finalizado_em: finalizadoEm,
  });

  return formatarPedido(atualizado);
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
};
