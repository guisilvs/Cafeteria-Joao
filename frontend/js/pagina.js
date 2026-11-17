/**
 * @file pagina.js
 * @description Controle de estado, eventos de DOM e integração com a API da Visão do Cliente (index.html).
 * Todo o cardápio, categorias, favoritos, sacola e pedidos vêm dinamicamente do PostgreSQL via API.
 */

(function inicializarAppCliente() {
  const IMAGEM_PADRAO_CAFE =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" rx="28" fill="#f3e9dc"/>
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
    abaAtual: 'cardapio', // 'cardapio' | 'favoritos' | 'pedido' | 'pedido_realizado'
    categorias: [],
    categoriaSelecionadaId: null,
    itensCardapio: [],
    itensFavoritos: [],
    usuario: null,
    sacola: {
      itens: [],
      total_itens: 0,
      total: 0,
      total_formatado: 'R$ 0,00',
      para_label: 'Para: Visitante',
      unidade_label: 'Unidade: Shopping Beira Mar',
      pedido_previsto_label: 'Pedido: #52681',
    },
    fotoCadastroBase64: null,
  };

  // ==========================================================================
  // UTILITÁRIOS VISUAIS
  // ==========================================================================

  function mostrarToast(mensagem, tipo = 'padrao') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast-msg ${tipo}`;
    el.textContent = mensagem;
    container.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto || '';
    return div.innerHTML;
  }

  // ==========================================================================
  // CARREGAMENTO DE DADOS DA API (BANCO DE DADOS)
  // ==========================================================================

  async function carregarSessaoUsuario() {
    const token = window.CafeteriaApi.obterToken('cliente');
    if (!token) {
      estado.usuario = null;
      atualizarHeaderUsuario();
      return;
    }

    try {
      const res = await window.CafeteriaApi.obterPerfil('cliente');
      estado.usuario = res.usuario;
    } catch {
      window.CafeteriaApi.limparToken('cliente');
      estado.usuario = null;
    }
    atualizarHeaderUsuario();
  }

  function atualizarHeaderUsuario() {
    const icone = document.getElementById('iconePerfilHeader');
    const foto = document.getElementById('fotoPerfilHeader');
    const badge = document.getElementById('badgePedidoEmAndamento');

    if (estado.usuario) {
      icone.style.display = 'none';
      foto.style.display = 'block';
      foto.src = estado.usuario.foto_webp || AVATAR_PADRAO;
      badge.style.display = estado.usuario.possui_pedido_em_andamento ? 'block' : 'none';
    } else {
      icone.style.display = 'block';
      foto.style.display = 'none';
      badge.style.display = 'none';
    }
  }

  async function carregarCardapioDoBanco() {
    try {
      const dados = await window.CafeteriaApi.obterCardapio();
      estado.categorias = Array.isArray(dados.categorias) ? dados.categorias : [];
      estado.itensCardapio = Array.isArray(dados.itens) ? dados.itens : [];

      if (estado.usuario) {
        estado.usuario.possui_pedido_em_andamento = Boolean(dados.possui_pedido_em_andamento);
        atualizarHeaderUsuario();
      }

      if (
        estado.categorias.length > 0 &&
        (!estado.categoriaSelecionadaId ||
          !estado.categorias.some((c) => String(c.id) === String(estado.categoriaSelecionadaId)))
      ) {
        estado.categoriaSelecionadaId = estado.categorias[0].id;
      }

      renderizarPillsCategorias();
      renderizarGradeProdutos();
    } catch (erro) {
      mostrarToast(erro.message || 'Erro ao carregar cardápio.', 'erro');
    }
  }

  async function carregarFavoritosDoBanco() {
    if (!estado.usuario) {
      estado.itensFavoritos = [];
      renderizarGradeProdutos();
      return;
    }

    try {
      const res = await window.CafeteriaApi.listarFavoritos();
      estado.itensFavoritos = Array.isArray(res.itens) ? res.itens : [];
      renderizarGradeProdutos();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function carregarSacolaDoBanco() {
    if (!estado.usuario) {
      atualizarBadgeSacola(0);
      return;
    }

    try {
      const res = await window.CafeteriaApi.obterSacola();
      if (res.sacola) {
        estado.sacola = res.sacola;
        atualizarBadgeSacola(res.sacola.total_itens || 0);
        if (estado.abaAtual === 'pedido') {
          renderizarSacola();
        }
      }
    } catch {
      // Silencioso caso não autenticado
    }
  }

  function atualizarBadgeSacola(qtd) {
    const badge = document.getElementById('badgeContadorSacola');
    if (!badge) return;
    if (qtd > 0) {
      badge.style.display = 'flex';
      badge.textContent = String(qtd);
    } else {
      badge.style.display = 'none';
    }
  }

  // ==========================================================================
  // RENDERIZAÇÃO DE CATEGORIAS E PRODUTOS
  // ==========================================================================

  function renderizarPillsCategorias() {
    const nav = document.getElementById('barraCategorias');
    if (!nav) return;

    if (estado.abaAtual !== 'cardapio' && estado.abaAtual !== 'favoritos') {
      nav.style.display = 'none';
      return;
    }

    nav.style.display = 'flex';
    nav.innerHTML = '';

    estado.categorias.forEach((cat) => {
      const btn = document.createElement('button');
      const ativa = String(cat.id) === String(estado.categoriaSelecionadaId);
      btn.className = `liquid-glass pill-categoria ${ativa ? 'ativa' : ''}`;
      btn.textContent = cat.nome;
      btn.onclick = () => {
        estado.categoriaSelecionadaId = cat.id;
        renderizarPillsCategorias();
        renderizarGradeProdutos();
      };
      nav.appendChild(btn);
    });
  }

  function renderizarGradeProdutos() {
    const grade = document.getElementById('gradeProdutos');
    if (!grade) return;

    const baseItens =
      estado.abaAtual === 'favoritos' ? estado.itensFavoritos : estado.itensCardapio;

    const filtrados = estado.categoriaSelecionadaId
      ? baseItens.filter((item) => String(item.categoria_id) === String(estado.categoriaSelecionadaId))
      : baseItens;

    if (estado.abaAtual === 'favoritos' && !estado.usuario) {
      grade.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 36px 12px;">
          <p style="font-size: 15px; font-weight: 600; margin-bottom: 14px;">
            Faça login para salvar e visualizar seus produtos favoritos!
          </p>
          <button class="btn-primario-marrom" onclick="window.AppCliente.abrirPainelConta()">
            Fazer login
          </button>
        </div>
      `;
      return;
    }

    if (filtrados.length === 0) {
      grade.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 36px 12px; color: #555;">
          <p style="font-size: 14px;">
            ${
              estado.abaAtual === 'favoritos'
                ? 'Nenhum item favoritado nesta categoria ainda.'
                : 'Nenhum produto disponível nesta categoria.'
            }
          </p>
        </div>
      `;
      return;
    }

    grade.innerHTML = filtrados
      .map((item) => {
        const imgSrc = item.foto_webp || IMAGEM_PADRAO_CAFE;
        const iconeCoracao = item.favorito ? 'fa-solid fa-heart' : 'fa-regular fa-heart';

        return `
          <article class="card-produto" data-item-id="${item.id}">
            <div class="card-produto-img-wrap">
              <img src="${imgSrc}" alt="${escaparHtml(item.nome)}" loading="lazy" />
              <button
                type="button"
                class="btn-favorito-card"
                title="Favoritar"
                onclick="window.AppCliente.alternarFavorito(${item.id})"
              >
                <i class="${iconeCoracao}"></i>
              </button>
            </div>
            <h3 class="card-produto-titulo">${escaparHtml(item.nome)}</h3>
            <p class="card-produto-desc">${escaparHtml(item.descricao)}</p>
            <button
              type="button"
              class="btn-adicionar-pedido"
              onclick="window.AppCliente.adicionarAoPedido(${item.id})"
            >
              <span class="btn-adicionar-esquerda">
                <i class="fa-solid fa-bag-shopping"></i>
                <span class="btn-adicionar-texto">Adicionar<br/>ao pedido</span>
              </span>
              <span class="btn-adicionar-preco">${escaparHtml(item.preco_formatado)}</span>
            </button>
          </article>
        `;
      })
      .join('');
  }

  // ==========================================================================
  // NAVEGAÇÃO ENTRE ABAS (CARDÁPIO, FAVORITOS, PEDIDO)
  // ==========================================================================

  async function mudarAba(novaAba) {
    estado.abaAtual = novaAba;

    const stage = document.getElementById('clienteStage');
    const titulo = document.getElementById('tituloPagina');
    const btnLimpar = document.getElementById('btnLimparPedidoTopo');
    const btnConta = document.getElementById('btnAbrirConta');

    const secaoProdutos = document.getElementById('secaoProdutos');
    const secaoSacola = document.getElementById('secaoSacola');
    const secaoRealizado = document.getElementById('secaoPedidoRealizado');

    const navCardapio = document.getElementById('navBtnCardapio');
    const navFavoritos = document.getElementById('navBtnFavoritos');
    const navPedido = document.getElementById('navBtnPedido');

    [navCardapio, navFavoritos, navPedido].forEach((b) => {
      b.classList.remove('ativo');
      b.removeAttribute('aria-current');
    });

    secaoProdutos.style.display = 'none';
    secaoSacola.style.display = 'none';
    secaoRealizado.style.display = 'none';
    btnLimpar.style.display = 'none';
    btnConta.style.display = 'flex';
    stage.classList.remove('tema-pedido');

    if (novaAba === 'cardapio') {
      titulo.textContent = 'Cafeteria do João';
      navCardapio.classList.add('ativo');
      navCardapio.setAttribute('aria-current', 'page');
      secaoProdutos.style.display = 'block';
      renderizarPillsCategorias();
      await carregarCardapioDoBanco();
    } else if (novaAba === 'favoritos') {
      titulo.textContent = 'Favoritos';
      navFavoritos.classList.add('ativo');
      navFavoritos.setAttribute('aria-current', 'page');
      secaoProdutos.style.display = 'block';
      renderizarPillsCategorias();
      await carregarFavoritosDoBanco();
    } else if (novaAba === 'pedido') {
      titulo.textContent = 'Pedido';
      stage.classList.add('tema-pedido');
      navPedido.classList.add('ativo');
      navPedido.setAttribute('aria-current', 'page');
      btnLimpar.style.display = 'inline-flex';
      btnConta.style.display = 'none';
      secaoSacola.style.display = 'block';
      renderizarPillsCategorias();
      await carregarSacolaDoBanco();
      renderizarSacola();
    } else if (novaAba === 'pedido_realizado') {
      titulo.textContent = '';
      navPedido.classList.add('ativo');
      navPedido.setAttribute('aria-current', 'page');
      btnConta.style.display = 'none';
      secaoRealizado.style.display = 'block';
      renderizarPillsCategorias();
    }
  }

  // ==========================================================================
  // AÇÕES DE FAVORITOS E SACOLA / PEDIDO
  // ==========================================================================

  async function alternarFavorito(itemId) {
    if (!estado.usuario) {
      mostrarToast('Faça login para favoritar itens do cardápio!', 'padrao');
      abrirPainelConta();
      return;
    }

    try {
      const res = await window.CafeteriaApi.alternarFavorito(itemId);
      mostrarToast(res.mensagem, 'sucesso');
      await carregarCardapioDoBanco();
      if (estado.abaAtual === 'favoritos') {
        await carregarFavoritosDoBanco();
      }
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function adicionarAoPedido(itemId) {
    if (!estado.usuario) {
      mostrarToast('Faça login ou crie sua conta para adicionar itens ao pedido!', 'padrao');
      abrirPainelConta();
      return;
    }

    try {
      const res = await window.CafeteriaApi.adicionarItemSacola(itemId, 1);
      estado.sacola = res.sacola;
      atualizarBadgeSacola(res.sacola.total_itens || 0);
      mostrarToast('Item adicionado ao pedido!', 'sucesso');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  function renderizarSacola() {
    const fotoCli = document.getElementById('sacolaFotoCliente');
    const iconeCli = document.getElementById('sacolaIconeCliente');
    const txtPara = document.getElementById('sacolaTextoPara');
    const txtUnidade = document.getElementById('sacolaTextoUnidade');
    const txtNumero = document.getElementById('sacolaTextoNumeroPedido');
    const listaEl = document.getElementById('listaItensSacola');
    const totalEl = document.getElementById('textoTotalSacola');

    if (!estado.usuario) {
      fotoCli.style.display = 'none';
      iconeCli.style.display = 'block';
      txtPara.textContent = 'Para: Faça login para pedir';
      txtUnidade.textContent = 'Unidade: Shopping Beira Mar';
      txtNumero.textContent = '';
      totalEl.textContent = 'Total: R$ 0,00';
      listaEl.innerHTML = `
        <div style="text-align: center; padding: 36px 12px;">
          <p style="font-size: 14px; margin-bottom: 14px;">Entre na sua conta para montar e enviar seu pedido.</p>
          <button class="btn-primario-marrom" onclick="window.AppCliente.abrirPainelConta()">Fazer login</button>
        </div>
      `;
      return;
    }

    if (estado.usuario.foto_webp) {
      fotoCli.src = estado.usuario.foto_webp;
      fotoCli.style.display = 'block';
      iconeCli.style.display = 'none';
    } else {
      fotoCli.src = AVATAR_PADRAO;
      fotoCli.style.display = 'block';
      iconeCli.style.display = 'none';
    }

    txtPara.textContent = estado.sacola.para_label || `Para: ${estado.usuario.nome}`;
    txtUnidade.textContent = estado.sacola.unidade_label || 'Unidade: Shopping Beira Mar';
    txtNumero.textContent = estado.sacola.pedido_previsto_label || '';
    totalEl.textContent = `Total: ${estado.sacola.total_formatado || 'R$ 0,00'}`;

    const itens = Array.isArray(estado.sacola.itens) ? estado.sacola.itens : [];
    if (itens.length === 0) {
      listaEl.innerHTML = `
        <div style="text-align: center; padding: 36px 12px; color: #333;">
          <p style="font-size: 14px; margin-bottom: 12px;">Seu pedido ainda está vazio.</p>
          <button class="liquid-glass btn-limpar-pedido" onclick="window.AppCliente.mudarAba('cardapio')">
            Ver cardápio
          </button>
        </div>
      `;
      return;
    }

    listaEl.innerHTML = itens
      .map((item) => {
        const imgSrc = item.foto_webp || IMAGEM_PADRAO_CAFE;
        return `
          <div class="item-sacola-row">
            <div class="item-sacola-img-wrap">
              <img src="${imgSrc}" alt="${escaparHtml(item.nome)}" />
              <button
                type="button"
                class="liquid-glass btn-remover-item-sacola"
                title="Remover item"
                onclick="window.AppCliente.removerItemSacola(${item.item_id})"
              >
                X
              </button>
            </div>
            <div class="item-sacola-detalhes">
              <h4>${escaparHtml(item.nome)}</h4>
              <p>${escaparHtml(item.descricao)}</p>
              <div class="item-sacola-rodape">
                <span class="item-sacola-preco">${escaparHtml(item.subtotal_formatado)}</span>
                <div class="liquid-glass controle-qtd-sacola">
                  <button type="button" onclick="window.AppCliente.alterarQtdSacola(${item.item_id}, ${item.quantidade - 1})">−</button>
                  <span>${item.quantidade}x</span>
                  <button type="button" onclick="window.AppCliente.alterarQtdSacola(${item.item_id}, ${item.quantidade + 1})">+</button>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  async function alterarQtdSacola(itemId, novaQtd) {
    try {
      const res = await window.CafeteriaApi.atualizarQuantidadeSacola(itemId, novaQtd);
      estado.sacola = res.sacola;
      atualizarBadgeSacola(res.sacola.total_itens || 0);
      renderizarSacola();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function removerItemSacola(itemId) {
    try {
      const res = await window.CafeteriaApi.removerItemSacola(itemId, false);
      estado.sacola = res.sacola;
      atualizarBadgeSacola(res.sacola.total_itens || 0);
      renderizarSacola();
      mostrarToast('Item removido do pedido.');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function limparSacola() {
    if (!estado.usuario) return;
    try {
      const res = await window.CafeteriaApi.limparSacola();
      estado.sacola = res.sacola;
      atualizarBadgeSacola(0);
      renderizarSacola();
      mostrarToast('Pedido limpo.');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function finalizarPedido() {
    if (!estado.usuario) {
      abrirPainelConta();
      return;
    }

    const itens = estado.sacola?.itens || [];
    if (itens.length === 0) {
      mostrarToast('Adicione pelo menos um item ao pedido antes de finalizar.', 'erro');
      return;
    }

    try {
      const res = await window.CafeteriaApi.enviarPedido({});
      const pedido = res.pedido;

      estado.sacola.itens = [];
      estado.sacola.total_itens = 0;
      estado.sacola.total = 0;
      estado.sacola.total_formatado = 'R$ 0,00';
      atualizarBadgeSacola(0);

      estado.usuario.possui_pedido_em_andamento = true;
      atualizarHeaderUsuario();

      document.getElementById('confirmacaoNumeroPedido').textContent =
        pedido.titulo_status_curto || `#${pedido.numero} Em preparo...`;
      document.getElementById('confirmacaoPrevisaoPedido').textContent =
        pedido.previsao_label || 'Previsão de retirada: 5 minutos';

      await mudarAba('pedido_realizado');
      mostrarToast('Pedido enviado para a Cafeteria do João!', 'sucesso');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  // ==========================================================================
  // PAINEL MINHA CONTA / LOGIN / CADASTRO / HISTÓRICO DE PEDIDOS
  // ==========================================================================

  async function abrirPainelConta() {
    const overlay = document.getElementById('sheetContaOverlay');
    overlay.classList.add('aberto');

    if (estado.usuario) {
      mostrarSubtelaConta('minha_conta');
      await carregarMeusPedidosNaConta();
    } else {
      mostrarSubtelaConta('login');
    }
  }

  function fecharPainelConta() {
    const overlay = document.getElementById('sheetContaOverlay');
    overlay.classList.remove('aberto');
  }

  function mostrarSubtelaConta(qual) {
    document.getElementById('subtelaLogin').style.display = qual === 'login' ? 'block' : 'none';
    document.getElementById('subtelaCadastro').style.display = qual === 'cadastro' ? 'block' : 'none';
    document.getElementById('subtelaRecuperar').style.display = qual === 'recuperar' ? 'block' : 'none';
    document.getElementById('subtelaMinhaConta').style.display = qual === 'minha_conta' ? 'block' : 'none';

    if (qual === 'minha_conta' && estado.usuario) {
      document.getElementById('minhaContaNome').textContent = estado.usuario.nome;
      document.getElementById('minhaContaFoto').src = estado.usuario.foto_webp || AVATAR_PADRAO;
    }
  }

  async function carregarMeusPedidosNaConta() {
    const contAndamento = document.getElementById('containerPedidosAndamento');
    const contHistorico = document.getElementById('containerPedidosHistorico');

    contAndamento.innerHTML = '<p style="font-size: 13px; color: #666;">Carregando pedidos...</p>';
    contHistorico.innerHTML = '';

    try {
      const res = await window.CafeteriaApi.listarMeusPedidos();
      const emAndamento = Array.isArray(res.emAndamento) ? res.emAndamento : [];
      const historico = Array.isArray(res.historico) ? res.historico : [];

      estado.usuario.possui_pedido_em_andamento = emAndamento.length > 0;
      atualizarHeaderUsuario();

      if (emAndamento.length === 0) {
        contAndamento.innerHTML = '';
      } else {
        contAndamento.innerHTML =
          emAndamento
            .map(
              (p) => `
            <div class="card-pedido-cliente ativo">
              <span class="badge-status-pedido preparando">${escaparHtml(p.status_label)}</span>
              <div class="card-pedido-topo">
                <i class="fa-solid fa-mug-hot icone-cafeteira"></i>
                <div>
                  <strong style="font-size: 16px; display: block;">${escaparHtml(p.codigo_formatado)}</strong>
                  <span style="font-size: 13px;">Previsão de retirada:<br/>${p.previsao_minutos} minutos</span>
                </div>
              </div>
              <div class="pedido-itens-lista-texto">${escaparHtml(p.resumo_itens_texto)}</div>
              <div class="pedido-rodape-totais">
                <div>Total: ${escaparHtml(p.total_formatado)}</div>
                <div>${escaparHtml(p.retirada_label)}</div>
              </div>
            </div>
          `
            )
            .join('') +
          `<div style="text-align: center; font-size: 20px; letter-spacing: 3px; color: #888; margin: 6px 0 14px;">•••</div>`;
      }

      if (historico.length === 0 && emAndamento.length === 0) {
        contHistorico.innerHTML =
          '<p style="font-size: 13.5px; color: #666; padding: 12px 0;">Você ainda não realizou nenhum pedido.</p>';
      } else {
        contHistorico.innerHTML = historico
          .map((p) => {
            const classeBadge = p.status === 'cancelado' ? 'cancelado' : 'finalizado';
            const dataTexto =
              p.texto_retirada_cliente || `Pedido registrado em: ${p.criado_em_formatado || ''}`;

            return `
              <div class="card-pedido-cliente">
                <span class="badge-status-pedido ${classeBadge}">${escaparHtml(p.status_label)}</span>
                <div style="margin-bottom: 8px; padding-right: 95px;">
                  <strong style="font-size: 15.5px; display: block;">${escaparHtml(p.codigo_formatado)}</strong>
                  <span style="font-size: 12.5px; color: #333;">${escaparHtml(dataTexto)}</span>
                </div>
                <div class="pedido-itens-lista-texto">${escaparHtml(p.resumo_itens_texto)}</div>
                <div class="pedido-rodape-totais">
                  <div>Total: ${escaparHtml(p.total_formatado)}</div>
                  <div>${escaparHtml(p.retirada_label)}</div>
                </div>
              </div>
            `;
          })
          .join('');
      }
    } catch (erro) {
      contAndamento.innerHTML = `<p style="color: red; font-size: 13px;">${escaparHtml(erro.message)}</p>`;
    }
  }

  async function submeterLogin(evento) {
    evento.preventDefault();
    const identificador = document.getElementById('inputLoginIdentificador').value.trim();
    const senha = document.getElementById('inputLoginSenha').value;

    try {
      const res = await window.CafeteriaApi.loginCliente(identificador, senha);
      estado.usuario = res.usuario;
      atualizarHeaderUsuario();
      mostrarToast(`Bem-vindo(a), ${res.usuario.nome}!`, 'sucesso');
      await carregarCardapioDoBanco();
      await carregarSacolaDoBanco();
      mostrarSubtelaConta('minha_conta');
      await carregarMeusPedidosNaConta();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function previsualizarFotoCadastro(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    try {
      const base64 = await window.CafeteriaApi.lerArquivoComoBase64(arquivo);
      estado.fotoCadastroBase64 = base64;
      const img = document.getElementById('imgPreviewCadastro');
      const icone = document.getElementById('iconePreviewCadastro');
      img.src = base64;
      img.style.display = 'block';
      icone.style.display = 'none';
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function submeterCadastro(evento) {
    evento.preventDefault();
    const nome = document.getElementById('inputCadastroNome').value.trim();
    const email = document.getElementById('inputCadastroEmail').value.trim();
    const telefone = document.getElementById('inputCadastroTelefone').value.trim();
    const senha = document.getElementById('inputCadastroSenha').value;
    const confirmarSenha = document.getElementById('inputCadastroConfirmarSenha').value;

    try {
      const res = await window.CafeteriaApi.registrarCliente({
        nome,
        email,
        telefone,
        senha,
        confirmarSenha,
        foto: estado.fotoCadastroBase64,
      });

      estado.usuario = res.usuario;
      estado.fotoCadastroBase64 = null;
      atualizarHeaderUsuario();
      mostrarToast('Conta criada com sucesso!', 'sucesso');
      await carregarCardapioDoBanco();
      mostrarSubtelaConta('minha_conta');
      await carregarMeusPedidosNaConta();
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function submeterRecuperacaoSenha(evento) {
    evento.preventDefault();
    const email = document.getElementById('inputRecEmail').value.trim();
    const telefone = document.getElementById('inputRecTelefone').value.trim();
    const novaSenha = document.getElementById('inputRecNovaSenha').value;
    const confirmarSenha = document.getElementById('inputRecConfirmarSenha').value;

    try {
      const res = await window.CafeteriaApi.recuperarSenha({
        email,
        telefone,
        novaSenha,
        confirmarSenha,
      });
      mostrarToast(res.mensagem || 'Senha redefinida com sucesso!', 'sucesso');
      mostrarSubtelaConta('login');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function atualizarFotoPerfilLogado(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo || !estado.usuario) return;
    try {
      const base64 = await window.CafeteriaApi.lerArquivoComoBase64(arquivo);
      const res = await window.CafeteriaApi.atualizarPerfil({ foto: base64 }, 'cliente');
      estado.usuario = res.usuario;
      document.getElementById('minhaContaFoto').src = res.usuario.foto_webp || AVATAR_PADRAO;
      atualizarHeaderUsuario();
      mostrarToast('Foto de perfil atualizada em WebP!', 'sucesso');
    } catch (erro) {
      mostrarToast(erro.message, 'erro');
    }
  }

  async function fazerLogoff() {
    await window.CafeteriaApi.logout('cliente');
    estado.usuario = null;
    estado.sacola.itens = [];
    atualizarBadgeSacola(0);
    atualizarHeaderUsuario();
    fecharPainelConta();
    await carregarCardapioDoBanco();
    mostrarToast('Você saiu da sua conta.');
  }

  // Exporta funções para os handlers inline do HTML
  window.AppCliente = {
    mudarAba,
    alternarFavorito,
    adicionarAoPedido,
    alterarQtdSacola,
    removerItemSacola,
    limparSacola,
    finalizarPedido,
    abrirPainelConta,
    fecharPainelConta,
    mostrarSubtelaConta,
    submeterLogin,
    previsualizarFotoCadastro,
    submeterCadastro,
    submeterRecuperacaoSenha,
    atualizarFotoPerfilLogado,
    fazerLogoff,
  };

  // Inicialização automática ao abrir a página
  document.addEventListener('DOMContentLoaded', async () => {
    await carregarSessaoUsuario();
    await carregarCardapioDoBanco();
    await carregarSacolaDoBanco();
  });
})();
