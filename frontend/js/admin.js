/**
 * @file admin.js
 * @description Eventos, renderização de DOM e integração com a API do Painel Administrador (admin.html).
 * Opera sobre as 8 tabelas da modelagem relacional no PostgreSQL via API.
 */

(function inicializarAppAdmin() {
  const IMAGEM_PADRAO_CAFE =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" rx="28" fill="#ffffff"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="64">☕</text>
      </svg>`
    );

  const AVATAR_PADRAO =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <rect width="120" height="120" rx="60" fill="#e9dec9"/>
        <circle cx="60" cy="45" r="22" fill="#664200"/>
        <path d="M24 106c6-22 22-32 36-32s30 10 36 32" fill="#664200"/>
      </svg>`
    );

  const estado = {
    bancoConectado: true,
    operador: null,
    visaoAtual: 'pedidos',
    categorias: [],
    categoriaAtiva: null,
    itensCategoriaAtiva: [],
    produtoEditando: null,
    fotoProdutoBase64: null,
    categoriaEditandoId: null,
    usuarioEditandoId: null,
    pedidoEditandoId: null,
  };

  function atualizarIndicadorBanco(conectado) {
    estado.bancoConectado = Boolean(conectado);
    const rodape = document.getElementById('rodapeStatusBancoAdmin');
    if (rodape) {
      rodape.style.display = estado.bancoConectado ? 'none' : 'block';
    }
  }

  function mostrarToast(mensagem, tipo = 'padrao') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast-msg ${tipo}`;
    el.textContent = mensagem;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto || '';
    return div.innerHTML;
  }

  // ==========================================================================
  // 1. AUTENTICAÇÃO E SESSÃO DO ADMINISTRADOR
  // ==========================================================================

  async function verificarSessaoAdmin() {
    const conectado = await window.CafeteriaApi.verificarStatusBanco();
    atualizarIndicadorBanco(conectado);

    const token = window.CafeteriaApi.obterToken('admin');
    if (!token) {
      mostrarTelaLogin();
      return;
    }

    try {
      const res = await window.CafeteriaApi.obterPerfil('admin');
      if (!res.usuario || !res.usuario.eh_admin) {
        window.CafeteriaApi.limparToken('admin');
        mostrarTelaLogin();
        return;
      }
      estado.operador = res.usuario;
      entrarNoPainel();
    } catch {
      window.CafeteriaApi.limparToken('admin');
      mostrarTelaLogin();
    }
  }

  function mostrarTelaLogin() {
    document.getElementById('telaAdminLogin').style.display = 'flex';
    document.getElementById('painelAdminLayout').style.display = 'none';
  }

  async function entrarNoPainel() {
    document.getElementById('telaAdminLogin').style.display = 'none';
    document.getElementById('painelAdminLayout').style.display = 'flex';

    atualizarHeaderOperador();
    await atualizarResumoENotificacoes();
    await navegarPara('pedidos');
  }

  function atualizarHeaderOperador() {
    if (!estado.operador) return;
    document.getElementById('operadorCargoTexto').textContent =
      estado.operador.cargo || 'Operador';
    document.getElementById('operadorNomeTexto').textContent = estado.operador.nome;

    const bannerSenha = document.getElementById('bannerTrocaSenhaPadrao');
    bannerSenha.style.display = estado.operador.precisa_trocar_senha ? 'flex' : 'none';
  }

  async function submeterLoginAdmin(evento) {
    evento.preventDefault();
    const identificador = document.getElementById('inputAdminIdentificador').value.trim();
    const senha = document.getElementById('inputAdminSenha').value;

    try {
      const res = await window.CafeteriaApi.loginAdmin(identificador, senha);
      estado.operador = res.usuario;
      mostrarToast(res.mensagem || 'Login administrativo realizado!', 'sucesso');
      await entrarNoPainel();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function fazerLogoutAdmin() {
    await window.CafeteriaApi.logout('admin');
    estado.operador = null;
    mostrarTelaLogin();
    mostrarToast('Sessão encerrada.');
  }

  function abrirModalTrocarSenha() {
    document.getElementById('inputTrocaSenhaAtual').value = '';
    document.getElementById('inputTrocaSenhaNova').value = '';
    document.getElementById('inputTrocaSenhaConfirmar').value = '';
    document.getElementById('modalTrocarSenha').classList.add('aberto');
  }

  async function submeterTrocaSenha(evento) {
    evento.preventDefault();
    const senhaAtual = document.getElementById('inputTrocaSenhaAtual').value;
    const novaSenha = document.getElementById('inputTrocaSenhaNova').value;
    const confirmarSenha = document.getElementById('inputTrocaSenhaConfirmar').value;

    try {
      const res = await window.CafeteriaApi.alterarSenha(
        { senhaAtual, novaSenha, confirmarSenha },
        'admin'
      );
      estado.operador = res.usuario;
      atualizarHeaderOperador();
      fecharModais();
      mostrarToast('Senha alterada com sucesso no PostgreSQL!', 'sucesso');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  // ==========================================================================
  // 2. BARRA LATERAL E NAVEGAÇÃO ENTRE VISÕES DO PAINEL
  // ==========================================================================

  function alternarSidebar() {
    const sb = document.getElementById('adminSidebar');
    sb.classList.toggle('aberta');
  }

  async function atualizarResumoENotificacoes() {
    try {
      const res = await window.CafeteriaApi.obterResumoAdmin();
      const badge = document.getElementById('sidebarBadgePedidos');
      badge.style.display = res.notificacoes?.possuiPedidosPendentes ? 'block' : 'none';

      document.getElementById('resumoPedidosPendentes').textContent =
        res.contadores?.pedidosPendentes || 0;
      document.getElementById('resumoCardapioTotal').textContent = `${
        res.contadores?.categorias || 0
      } cat / ${res.contadores?.itensCardapio || 0} itens`;
      document.getElementById('resumoUsuariosTotal').textContent =
        (res.contadores?.usuariosInternos || 0) + (res.contadores?.usuariosClientes || 0);
    } catch {
      // Silencioso
    }
  }

  async function navegarPara(visao, parametro = null) {
    estado.visaoAtual = visao;

    const conectado = await window.CafeteriaApi.verificarStatusBanco();
    atualizarIndicadorBanco(conectado);

    const idsSecoes = [
      'visaoOpcoes',
      'visaoPedidos',
      'visaoCategorias',
      'visaoItensCategoria',
      'visaoEditorProduto',
      'visaoUsuarios',
    ];
    idsSecoes.forEach((id) => {
      document.getElementById(id).style.display = 'none';
    });

    ['menuBtnPedidos', 'menuBtnCardapio', 'menuBtnUsuarios'].forEach((id) => {
      document.getElementById(id).classList.remove('ativo');
    });

    const titulo = document.getElementById('adminTituloPrincipal');
    const subtitulo = document.getElementById('adminSubtituloPrincipal');

    if (visao === 'opcoes') {
      titulo.textContent = '';
      subtitulo.textContent = '';
      document.getElementById('adminSidebar').classList.add('aberta');
      document.getElementById('visaoOpcoes').style.display = 'block';
      await atualizarResumoENotificacoes();
    } else if (visao === 'pedidos') {
      titulo.textContent = 'Pedidos';
      subtitulo.textContent = 'Pendentes';
      document.getElementById('menuBtnPedidos').classList.add('ativo');
      document.getElementById('visaoPedidos').style.display = 'block';
      await carregarPedidosAdmin();
    } else if (visao === 'categorias') {
      titulo.textContent = 'Cardápio';
      subtitulo.textContent = 'Categorias';
      document.getElementById('menuBtnCardapio').classList.add('ativo');
      document.getElementById('visaoCategorias').style.display = 'block';
      await carregarCategoriasAdmin();
    } else if (visao === 'itens_categoria') {
      document.getElementById('menuBtnCardapio').classList.add('ativo');
      document.getElementById('visaoItensCategoria').style.display = 'block';
      await carregarItensDaCategoriaAdmin(parametro || estado.categoriaAtiva?.id);
    } else if (visao === 'editor_produto') {
      document.getElementById('menuBtnCardapio').classList.add('ativo');
      document.getElementById('visaoEditorProduto').style.display = 'block';
    } else if (visao === 'usuarios') {
      titulo.textContent = 'Usuários';
      subtitulo.textContent = '';
      document.getElementById('menuBtnUsuarios').classList.add('ativo');
      document.getElementById('visaoUsuarios').style.display = 'block';
      await carregarUsuariosAdmin();
    }
  }

  // ==========================================================================
  // 3. GERENCIAMENTO DE PEDIDOS (Node 143:150)
  // ==========================================================================

  async function carregarPedidosAdmin() {
    const gradePendentes = document.getElementById('gradePedidosPendentes');
    const gradeConcluidos = document.getElementById('gradePedidosConcluidos');

    if (!estado.bancoConectado) {
      gradePendentes.innerHTML = `<div class="aviso-centro-sem-banco">Não conectado no banco de dados</div>`;
      gradeConcluidos.innerHTML = '';
      return;
    }

    try {
      const res = await window.CafeteriaApi.listarPedidosAdmin();
      const pendentes = Array.isArray(res.pendentes) ? res.pendentes : [];
      const concluidos = Array.isArray(res.concluidos) ? res.concluidos : [];

      document.getElementById('sidebarBadgePedidos').style.display =
        pendentes.length > 0 ? 'block' : 'none';

      if (pendentes.length === 0) {
        gradePendentes.innerHTML =
          '<p style="color: #555; font-size: 16px;">Nenhum pedido pendente no momento.</p>';
      } else {
        gradePendentes.innerHTML = pendentes
          .map((p) => {
            const avatar = p.cliente_foto || AVATAR_PADRAO;
            return `
              <article class="card-pedido-admin">
                <div>
                  <div class="card-pedido-admin-topo">
                    <div>
                      <h4>${escaparHtml(p.codigo_formatado)}</h4>
                      <p>Tempo até atraso:<br/>${p.previsao_minutos} minutos</p>
                    </div>
                    <button
                      type="button"
                      class="btn-acao-icone"
                      title="Modificar pedido"
                      onclick="window.AppAdmin.abrirModalPedido(${p.id})"
                    >
                      <i class="fa-solid fa-pen"></i>
                    </button>
                  </div>

                  <div class="pedido-itens-lista-texto" style="margin-top: 12px;">${escaparHtml(
                    p.resumo_itens_texto
                  )}</div>
                  <div class="pedido-rodape-totais">
                    <div>Total: ${escaparHtml(p.total_formatado)}</div>
                    <div>${escaparHtml(p.retirada_label)}</div>
                    ${p.observacoes ? `<div style="font-weight:400;font-size:12px;">Obs: ${escaparHtml(p.observacoes)}</div>` : ''}
                  </div>
                </div>

                <div>
                  <div class="card-pedido-admin-cliente">
                    <img src="${avatar}" alt="Cliente" />
                    <div>
                      <span style="font-size: 13px; display: block;">Cliente</span>
                      <strong style="font-size: 16px;">${escaparHtml(p.cliente_nome)}</strong>
                    </div>
                  </div>

                  <div class="botoes-pedido-admin">
                    <button
                      type="button"
                      class="btn-pill-status concluir"
                      onclick="window.AppAdmin.concluirPedido(${p.id})"
                    >
                      Concluir
                    </button>
                    <button
                      type="button"
                      class="btn-pill-status cancelar"
                      onclick="window.AppAdmin.cancelarPedido(${p.id})"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </article>
            `;
          })
          .join('');
      }

      if (concluidos.length === 0) {
        gradeConcluidos.innerHTML =
          '<p style="color: #555; font-size: 16px;">Nenhum pedido concluído no histórico.</p>';
      } else {
        gradeConcluidos.innerHTML = concluidos
          .map((p) => {
            const avatar = p.cliente_foto || AVATAR_PADRAO;
            const infoData =
              p.texto_separado_admin || `Finalizado em: ${p.finalizado_em_formatado || ''}`;

            return `
              <article class="card-pedido-admin concluido">
                <div>
                  <div class="card-pedido-admin-topo">
                    <div>
                      <h4>${escaparHtml(p.codigo_formatado)}</h4>
                      <p>${escaparHtml(infoData)}</p>
                    </div>
                    <button
                      type="button"
                      class="btn-acao-icone"
                      title="Modificar / Excluir pedido"
                      onclick="window.AppAdmin.abrirModalPedido(${p.id})"
                    >
                      <i class="fa-solid fa-pen"></i>
                    </button>
                  </div>

                  <div class="pedido-itens-lista-texto" style="margin-top: 12px;">${escaparHtml(
                    p.resumo_itens_texto
                  )}</div>
                  <div class="pedido-rodape-totais">
                    <div>Total: ${escaparHtml(p.total_formatado)}</div>
                    <div>${escaparHtml(p.retirada_label)}</div>
                  </div>
                </div>

                <div>
                  <div class="card-pedido-admin-cliente">
                    <img src="${avatar}" alt="Cliente" />
                    <div>
                      <span style="font-size: 13px; display: block;">Cliente</span>
                      <strong style="font-size: 16px;">${escaparHtml(p.cliente_nome)}</strong>
                    </div>
                  </div>

                  <div class="botoes-pedido-admin">
                    <button
                      type="button"
                      class="btn-pill-status reabrir"
                      onclick="window.AppAdmin.reabrirPedido(${p.id})"
                    >
                      Reabrir
                    </button>
                  </div>
                </div>
              </article>
            `;
          })
          .join('');
      }
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function concluirPedido(id) {
    try {
      const res = await window.CafeteriaApi.concluirPedidoAdmin(id);
      mostrarToast(res.mensagem, 'sucesso');
      await carregarPedidosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function cancelarPedido(id) {
    try {
      const res = await window.CafeteriaApi.cancelarPedidoAdmin(id);
      mostrarToast(res.mensagem, 'sucesso');
      await carregarPedidosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function reabrirPedido(id) {
    try {
      const res = await window.CafeteriaApi.reabrirPedidoAdmin(id);
      mostrarToast(res.mensagem, 'sucesso');
      await carregarPedidosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function abrirModalPedido(pedidoId) {
    try {
      const res = await window.CafeteriaApi.listarPedidosAdmin();
      const pedido = (res.todos || []).find((p) => String(p.id) === String(pedidoId));
      if (!pedido) return;

      estado.pedidoEditandoId = pedido.id;
      document.getElementById('tituloModalPedido').textContent = `Modificar ${pedido.codigo_formatado}`;
      document.getElementById('inputModalPedidoUnidade').value = pedido.unidade_retirada || 'Shopping Beira Mar';
      document.getElementById('inputModalPedidoPrevisao').value = pedido.previsao_minutos || 5;
      document.getElementById('inputModalPedidoStatus').value =
        pedido.status === 'pendente' ? 'preparando' : pedido.status;
      document.getElementById('inputModalPedidoObs').value = pedido.observacoes || '';

      document.getElementById('modalPedidoAdmin').classList.add('aberto');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function salvarModificacaoPedido(evento) {
    evento.preventDefault();
    if (!estado.pedidoEditandoId) return;

    try {
      const dados = {
        unidade_retirada: document.getElementById('inputModalPedidoUnidade').value.trim(),
        previsao_minutos: Number(document.getElementById('inputModalPedidoPrevisao').value),
        status: document.getElementById('inputModalPedidoStatus').value,
        observacoes: document.getElementById('inputModalPedidoObs').value.trim(),
      };

      const res = await window.CafeteriaApi.modificarPedidoAdmin(estado.pedidoEditandoId, dados);
      mostrarToast(res.mensagem, 'sucesso');
      fecharModais();
      await carregarPedidosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function excluirPedidoModal() {
    if (!estado.pedidoEditandoId) return;
    try {
      await window.CafeteriaApi.removerPedidoAdmin(estado.pedidoEditandoId);
      mostrarToast('Pedido excluído com sucesso.', 'sucesso');
      fecharModais();
      await carregarPedidosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  // ==========================================================================
  // 4. GERENCIAMENTO DE CATEGORIAS DO CARDÁPIO (Node 143:148)
  // ==========================================================================

  async function carregarCategoriasAdmin() {
    const container = document.getElementById('listaCategoriasAdmin');
    if (!estado.bancoConectado) {
      container.innerHTML = `<div class="aviso-centro-sem-banco">Não conectado no banco de dados</div>`;
      return;
    }

    try {
      const res = await window.CafeteriaApi.listarCategoriasAdmin();
      estado.categorias = Array.isArray(res.categorias) ? res.categorias : [];

      if (estado.categorias.length === 0) {
        container.innerHTML = '<p>Nenhuma categoria cadastrada.</p>';
        return;
      }

      container.innerHTML = estado.categorias
        .map(
          (cat, idx) => `
          <div class="barra-item-admin">
            <div class="barra-esquerda" onclick="window.AppAdmin.navegarPara('itens_categoria', ${cat.id})">
              <div class="botoes-ordem-categoria" onclick="event.stopPropagation()" title="Reordenar posição">
                <button type="button" onclick="window.AppAdmin.moverCategoria(${idx}, -1)">▲</button>
                <button type="button" onclick="window.AppAdmin.moverCategoria(${idx}, 1)">▼</button>
              </div>
              <div>
                <div class="barra-titulo-principal">${escaparHtml(cat.nome)}</div>
              </div>
            </div>

            <div class="barra-direita">
              <button
                type="button"
                class="btn-secundario-pill"
                style="height: 36px;"
                onclick="window.AppAdmin.navegarPara('itens_categoria', ${cat.id})"
              >
                Ver produtos
              </button>
              <button
                type="button"
                class="btn-acao-icone"
                title="Editar nome da categoria"
                onclick="window.AppAdmin.abrirModalCategoria(${cat.id})"
              >
                <i class="fa-solid fa-pen"></i>
              </button>
              <button
                type="button"
                class="btn-acao-icone"
                style="color: #c00;"
                title="Excluir categoria"
                onclick="window.AppAdmin.excluirCategoria(${cat.id})"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `
        )
        .join('');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function moverCategoria(indiceAtual, direcao) {
    const novoIndice = indiceAtual + direcao;
    if (novoIndice < 0 || novoIndice >= estado.categorias.length) return;

    const copia = [...estado.categorias];
    const [movida] = copia.splice(indiceAtual, 1);
    copia.splice(novoIndice, 0, movida);

    const payload = copia.map((c, idx) => ({ id: c.id, ordem: idx + 1 }));
    try {
      await window.CafeteriaApi.reordenarCategoriasAdmin(payload);
      await carregarCategoriasAdmin();
      mostrarToast('Ordem das categorias atualizada!', 'sucesso');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function abrirModalCategoria(categoriaId = null) {
    estado.categoriaEditandoId = categoriaId;
    const cat = estado.categorias.find((c) => String(c.id) === String(categoriaId));

    document.getElementById('tituloModalCategoria').textContent = cat
      ? `Editar Categoria: ${cat.nome}`
      : 'Criar Nova Categoria';
    document.getElementById('inputModalCategoriaNome').value = cat ? cat.nome : '';
    document.getElementById('inputModalCategoriaOrdem').value = cat
      ? cat.ordem || 1
      : estado.categorias.length + 1;

    document.getElementById('modalCategoria').classList.add('aberto');
  }

  async function salvarCategoriaModal(evento) {
    evento.preventDefault();
    const nome = document.getElementById('inputModalCategoriaNome').value.trim();
    const ordem = Number(document.getElementById('inputModalCategoriaOrdem').value) || 1;

    try {
      if (estado.categoriaEditandoId) {
        await window.CafeteriaApi.atualizarCategoriaAdmin(estado.categoriaEditandoId, { nome, ordem });
        mostrarToast('Categoria atualizada com sucesso!', 'sucesso');
      } else {
        await window.CafeteriaApi.criarCategoriaAdmin({ nome, ordem });
        mostrarToast('Nova categoria criada no PostgreSQL!', 'sucesso');
      }
      fecharModais();
      await carregarCategoriasAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function excluirCategoria(id) {
    try {
      await window.CafeteriaApi.removerCategoriaAdmin(id, false);
      mostrarToast('Categoria removida!', 'sucesso');
      await carregarCategoriasAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  // ==========================================================================
  // 5. GERENCIAMENTO DE PRODUTOS DE UMA CATEGORIA (Nodes 143:999 e 161:294)
  // ==========================================================================

  async function carregarItensDaCategoriaAdmin(categoriaId) {
    const grade = document.getElementById('gradeItensCategoriaAdmin');
    if (!estado.bancoConectado) {
      grade.innerHTML = `<div class="aviso-centro-sem-banco">Não conectado no banco de dados</div>`;
      return;
    }

    try {
      const res = await window.CafeteriaApi.obterCategoriaComItensAdmin(categoriaId);
      estado.categoriaAtiva = res.categoria;
      estado.itensCategoriaAtiva = Array.isArray(res.itens) ? res.itens : [];

      document.getElementById('adminTituloPrincipal').textContent = 'Cardápio';
      document.getElementById('adminSubtituloPrincipal').textContent = estado.categoriaAtiva.nome;

      if (estado.itensCategoriaAtiva.length === 0) {
        grade.innerHTML =
          '<p style="font-size: 16px; color: #555;">Nenhum produto cadastrado nesta categoria ainda.</p>';
        return;
      }

      grade.innerHTML = estado.itensCategoriaAtiva
        .map((item) => {
          const imgSrc = item.foto_webp || IMAGEM_PADRAO_CAFE;
          const textoBotaoOcultar = item.oculto ? 'Exibir' : 'Ocultar';
          const classeBotaoOcultar = item.oculto ? 'btn-ocultar-produto exibir' : 'btn-ocultar-produto';

          return `
            <article class="card-produto-admin ${item.oculto ? 'esta-oculto' : ''}">
              <div class="card-produto-admin-acoes-topo">
                <button
                  type="button"
                  class="btn-acao-icone"
                  title="Editar produto"
                  onclick="window.AppAdmin.abrirEditorProduto(${item.id})"
                >
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button
                  type="button"
                  class="btn-acao-icone"
                  style="color: #c00;"
                  title="Excluir produto"
                  onclick="window.AppAdmin.excluirProduto(${item.id})"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>

              <div>
                <img src="${imgSrc}" alt="${escaparHtml(item.nome)}" />
                <h4>${escaparHtml(item.nome)}</h4>
                <p class="desc">${escaparHtml(item.descricao)}</p>
                <p class="valor">${escaparHtml(item.valor_label || `Valor: ${item.preco_formatado}`)}</p>
              </div>

              <button
                type="button"
                class="${classeBotaoOcultar}"
                onclick="window.AppAdmin.alternarVisibilidadeProduto(${item.id})"
              >
                ${textoBotaoOcultar}
              </button>
            </article>
          `;
        })
        .join('');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function alternarVisibilidadeProduto(itemId) {
    try {
      const res = await window.CafeteriaApi.alternarVisibilidadeItemAdmin(itemId);
      mostrarToast(res.mensagem, 'sucesso');
      await carregarItensDaCategoriaAdmin(estado.categoriaAtiva.id);
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function excluirProduto(itemId) {
    try {
      await window.CafeteriaApi.removerItemAdmin(itemId);
      mostrarToast('Produto excluído do banco de dados!', 'sucesso');
      await carregarItensDaCategoriaAdmin(estado.categoriaAtiva.id);
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function abrirEditorProduto(itemId = null) {
    if (estado.categorias.length === 0) {
      const resCat = await window.CafeteriaApi.listarCategoriasAdmin();
      estado.categorias = resCat.categorias || [];
    }

    const selectCat = document.getElementById('inputProdutoCategoria');
    selectCat.innerHTML = estado.categorias
      .map((c) => `<option value="${c.id}">${escaparHtml(c.nome)}</option>`)
      .join('');

    const item = estado.itensCategoriaAtiva.find((i) => String(i.id) === String(itemId)) || null;
    estado.produtoEditando = item;
    estado.fotoProdutoBase64 = null;

    document.getElementById('adminTituloPrincipal').textContent = item
      ? 'Editar produto'
      : 'Criar novo produto';

    const catInicialId = item
      ? item.categoria_id
      : estado.categoriaAtiva?.id || estado.categorias[0]?.id;
    selectCat.value = String(catInicialId);

    const catNome =
      estado.categorias.find((c) => String(c.id) === String(catInicialId))?.nome || 'Cardápio';
    document.getElementById('adminSubtituloPrincipal').textContent = `Categoria: ${catNome}`;

    document.getElementById('inputProdutoNome').value = item ? item.nome : '';
    document.getElementById('inputProdutoDescricao').value = item ? item.descricao : '';
    document.getElementById('inputProdutoPreco').value = item
      ? item.preco.toFixed(2).replace('.', ',')
      : '';

    const imgUpload = document.getElementById('imgUploadProdutoPreview');
    const iconeUpload = document.getElementById('iconeUploadProduto');
    const txtUpload = document.getElementById('textoUploadProduto');

    if (item && item.foto_webp) {
      imgUpload.src = item.foto_webp;
      imgUpload.style.display = 'block';
      iconeUpload.style.display = 'none';
      txtUpload.style.display = 'none';
    } else {
      imgUpload.style.display = 'none';
      iconeUpload.style.display = 'block';
      txtUpload.style.display = 'block';
    }

    document.getElementById('btnSalvarProdutoForm').textContent = item
      ? 'Salvar alterações no cardápio'
      : 'Publicar no cardápio';

    await navegarPara('editor_produto');
    atualizarPreviewProduto();
  }

  async function aoSelecionarFotoProduto(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    try {
      const base64 = await window.CafeteriaApi.lerArquivoComoBase64(arquivo);
      estado.fotoProdutoBase64 = base64;

      const imgUpload = document.getElementById('imgUploadProdutoPreview');
      imgUpload.src = base64;
      imgUpload.style.display = 'block';
      document.getElementById('iconeUploadProduto').style.display = 'none';
      document.getElementById('textoUploadProduto').style.display = 'none';

      atualizarPreviewProduto();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function atualizarPreviewProduto() {
    const nome = document.getElementById('inputProdutoNome').value.trim() || 'Matcha';
    const desc =
      document.getElementById('inputProdutoDescricao').value.trim() ||
      'Matcha, leite e gelo. Super refrescante. Perfeito para o verão.';
    const precoBruto = document.getElementById('inputProdutoPreco').value.trim() || '12,90';
    const selectCat = document.getElementById('inputProdutoCategoria');
    const catOption = selectCat.options[selectCat.selectedIndex];

    if (catOption) {
      document.getElementById('adminSubtituloPrincipal').textContent = `Categoria: ${catOption.text}`;
    }

    document.getElementById('previewCardNome').textContent = nome;
    document.getElementById('previewCardDesc').textContent = desc;
    document.getElementById('previewCardPreco').textContent = precoBruto.startsWith('R$')
      ? precoBruto
      : `R$ ${precoBruto}`;

    const imgSrc =
      estado.fotoProdutoBase64 ||
      (estado.produtoEditando && estado.produtoEditando.foto_webp) ||
      IMAGEM_PADRAO_CAFE;
    document.getElementById('previewCardImg').src = imgSrc;
  }

  async function salvarProduto(evento) {
    evento.preventDefault();
    const categoria_id = Number(document.getElementById('inputProdutoCategoria').value);
    const nome = document.getElementById('inputProdutoNome').value.trim();
    const descricao = document.getElementById('inputProdutoDescricao').value.trim();
    const preco = document.getElementById('inputProdutoPreco').value.trim();

    const payload = {
      categoria_id,
      nome,
      descricao,
      preco,
    };

    if (estado.fotoProdutoBase64) {
      payload.foto = estado.fotoProdutoBase64;
    }

    try {
      if (estado.produtoEditando) {
        await window.CafeteriaApi.atualizarItemAdmin(estado.produtoEditando.id, payload);
        mostrarToast('Produto atualizado com sucesso!', 'sucesso');
      } else {
        await window.CafeteriaApi.criarItemAdmin(payload);
        mostrarToast('Novo produto publicado no cardápio!', 'sucesso');
      }

      await navegarPara('itens_categoria', categoria_id);
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function fecharEditorProduto() {
    if (estado.categoriaAtiva) {
      navegarPara('itens_categoria', estado.categoriaAtiva.id);
    } else {
      navegarPara('categorias');
    }
  }

  // ==========================================================================
  // 6. GERENCIAMENTO DE USUÁRIOS (Tabelas Funcionario e Cliente - Node 143:838)
  // ==========================================================================

  async function carregarUsuariosAdmin() {
    const contInternos = document.getElementById('listaUsuariosInternos');
    const contClientes = document.getElementById('listaUsuariosClientes');

    if (!estado.bancoConectado) {
      contInternos.innerHTML = `<div class="aviso-centro-sem-banco">Não conectado no banco de dados</div>`;
      contClientes.innerHTML = '';
      return;
    }

    const busca = document.getElementById('inputBuscaUsuarioAdmin')?.value.trim() || '';
    const ordenar = document.getElementById('selectOrdenarUsuarios')?.value || '';

    try {
      const res = await window.CafeteriaApi.listarUsuariosAdmin({ busca, ordenar });
      const internos = Array.isArray(res.internos) ? res.internos : [];
      const clientes = Array.isArray(res.clientes) ? res.clientes : [];

      contInternos.innerHTML =
        internos.length === 0
          ? '<p>Nenhum funcionário/administrador encontrado.</p>'
          : internos
              .map((u) => {
                const avatar = u.foto_webp || AVATAR_PADRAO;
                const ativoClasse = u.ativo !== false ? 'badge-ativo-admin' : 'badge-ativo-admin inativo';
                return `
                  <div class="barra-item-admin">
                    <div class="barra-esquerda" onclick="window.AppAdmin.abrirModalUsuario(null, ${u.id})">
                      <img src="${avatar}" alt="${escaparHtml(u.nome)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" />
                      <div>
                        <div class="barra-titulo-principal">${escaparHtml(u.nome)}</div>
                        <div class="barra-subtitulo">${escaparHtml(u.cargo || 'Atendimento')}</div>
                      </div>
                    </div>
                    <div class="barra-direita">
                      <button
                        type="button"
                        class="${ativoClasse}"
                        title="Clique para alternar Ativo/Inativo"
                        onclick="window.AppAdmin.alternarStatusUsuario(${u.id})"
                      >
                        ${escaparHtml(u.status_label)}
                      </button>
                      <button
                        type="button"
                        class="btn-acao-icone"
                        title="Editar funcionário"
                        onclick="window.AppAdmin.abrirModalUsuario(null, ${u.id})"
                      >
                        <i class="fa-solid fa-pen"></i>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('');

      contClientes.innerHTML =
        clientes.length === 0
          ? '<p>Nenhum cliente encontrado.</p>'
          : clientes
              .map((u) => {
                const avatar = u.foto_webp || AVATAR_PADRAO;
                return `
                  <div class="barra-item-admin">
                    <div class="barra-esquerda" onclick="window.AppAdmin.abrirModalUsuario(null, ${u.id})">
                      <img src="${avatar}" alt="${escaparHtml(u.nome)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" />
                      <div>
                        <div class="barra-titulo-principal">${escaparHtml(u.nome)}</div>
                        <div class="barra-subtitulo">${escaparHtml(u.ultimo_acesso_label)}</div>
                      </div>
                    </div>
                    <div class="barra-direita">
                      <button
                        type="button"
                        class="btn-acao-icone"
                        title="Editar cliente"
                        onclick="window.AppAdmin.abrirModalUsuario(null, ${u.id})"
                      >
                        <i class="fa-solid fa-pen"></i>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function alternarStatusUsuario(usuarioId) {
    try {
      const res = await window.CafeteriaApi.alternarStatusUsuarioAdmin(usuarioId);
      mostrarToast(res.mensagem, 'sucesso');
      await carregarUsuariosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function abrirModalUsuario(tipoPadrao = 'cliente', usuarioId = null) {
    estado.usuarioEditandoId = usuarioId;
    const btnExcluir = document.getElementById('btnExcluirUsuarioModal');

    if (usuarioId) {
      try {
        const res = await window.CafeteriaApi.listarUsuariosAdmin();
        const u = (res.todos || []).find((item) => String(item.id) === String(usuarioId));
        if (!u) return;

        document.getElementById('tituloModalUsuario').textContent = `Editar Usuário: ${u.nome}`;
        document.getElementById('inputModalUsuarioNome').value = u.nome || '';
        document.getElementById('inputModalUsuarioCpf').value = u.cpf || '';
        document.getElementById('inputModalUsuarioEmail').value = u.email || '';
        document.getElementById('inputModalUsuarioTelefone').value = u.telefone || '';
        document.getElementById('inputModalUsuarioTipo').value = u.tipo || 'cliente';
        document.getElementById('inputModalUsuarioCargo').value = u.cargo || '';
        document.getElementById('inputModalUsuarioSenha').value = '';
        btnExcluir.style.display = 'inline-block';
      } catch (erro) {
        mostrarToast(erro.message, 'erro');
        return;
      }
    } else {
      document.getElementById('tituloModalUsuario').textContent =
        tipoPadrao === 'cliente' ? 'Criar Novo Cliente' : 'Criar Novo Funcionário (Interno)';
      document.getElementById('inputModalUsuarioNome').value = '';
      document.getElementById('inputModalUsuarioCpf').value = '';
      document.getElementById('inputModalUsuarioEmail').value = '';
      document.getElementById('inputModalUsuarioTelefone').value = '';
      document.getElementById('inputModalUsuarioTipo').value = tipoPadrao || 'cliente';
      document.getElementById('inputModalUsuarioCargo').value =
        tipoPadrao === 'cliente' ? '' : 'Atendimento';
      document.getElementById('inputModalUsuarioSenha').value = '';
      btnExcluir.style.display = 'none';
    }

    document.getElementById('modalUsuario').classList.add('aberto');
  }

  async function salvarUsuarioModal(evento) {
    evento.preventDefault();
    const dados = {
      nome: document.getElementById('inputModalUsuarioNome').value.trim(),
      cpf: document.getElementById('inputModalUsuarioCpf').value.trim() || undefined,
      email: document.getElementById('inputModalUsuarioEmail').value.trim(),
      telefone: document.getElementById('inputModalUsuarioTelefone').value.trim(),
      tipo: document.getElementById('inputModalUsuarioTipo').value,
      cargo: document.getElementById('inputModalUsuarioCargo').value.trim() || null,
    };

    const senha = document.getElementById('inputModalUsuarioSenha').value;
    if (senha) {
      dados.senha = senha;
    }

    try {
      if (estado.usuarioEditandoId) {
        const res = await window.CafeteriaApi.atualizarUsuarioAdmin(estado.usuarioEditandoId, dados);
        if (estado.operador && String(estado.operador.id) === String(estado.usuarioEditandoId)) {
          estado.operador = res.usuario;
          atualizarHeaderOperador();
        }
        mostrarToast('Usuário atualizado com sucesso!', 'sucesso');
      } else {
        if (!dados.senha) dados.senha = '123456';
        await window.CafeteriaApi.criarUsuarioAdmin(dados);
        mostrarToast('Novo usuário salvo no PostgreSQL!', 'sucesso');
      }
      fecharModais();
      await carregarUsuariosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function excluirUsuarioModal() {
    if (!estado.usuarioEditandoId) return;
    try {
      await window.CafeteriaApi.removerUsuarioAdmin(estado.usuarioEditandoId);
      mostrarToast('Usuário removido com sucesso.', 'sucesso');
      fecharModais();
      await carregarUsuariosAdmin();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function fecharModais() {
    ['modalCategoria', 'modalUsuario', 'modalPedidoAdmin', 'modalTrocarSenha'].forEach((id) => {
      document.getElementById(id).classList.remove('aberto');
    });
  }

  window.AppAdmin = {
    submeterLoginAdmin,
    fazerLogoutAdmin,
    abrirModalTrocarSenha,
    submeterTrocaSenha,
    alternarSidebar,
    navegarPara,
    concluirPedido,
    cancelarPedido,
    reabrirPedido,
    abrirModalPedido,
    salvarModificacaoPedido,
    excluirPedidoModal,
    moverCategoria,
    abrirModalCategoria,
    salvarCategoriaModal,
    excluirCategoria,
    alternarVisibilidadeProduto,
    excluirProduto,
    abrirEditorProduto,
    aoSelecionarFotoProduto,
    atualizarPreviewProduto,
    salvarProduto,
    fecharEditorProduto,
    carregarUsuariosAdmin,
    alternarStatusUsuario,
    abrirModalUsuario,
    salvarUsuarioModal,
    excluirUsuarioModal,
    fecharModais,
  };

  document.addEventListener('DOMContentLoaded', verificarSessaoAdmin);
})();
