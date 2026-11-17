/**
 * @file api.js
 * @description Camada única de comunicação HTTP (fetch) do Front-end com o Back-end.
 * Respeita estritamente a arquitetura: Front-end -> API -> Back-end -> Banco de Dados.
 */

const API_BASE =
  window.location.protocol === 'file:' ||
  (window.location.port && window.location.port !== '3000' && window.location.port !== '80')
    ? 'http://localhost:3000/api'
    : '/api';

const CHAVE_TOKEN_CLIENTE = 'cafeteria_token_cliente';
const CHAVE_TOKEN_ADMIN = 'cafeteria_token_admin';

function obterToken(modo = 'cliente') {
  if (modo === 'admin') {
    return localStorage.getItem(CHAVE_TOKEN_ADMIN) || localStorage.getItem(CHAVE_TOKEN_CLIENTE);
  }
  return localStorage.getItem(CHAVE_TOKEN_CLIENTE);
}

function salvarToken(token, modo = 'cliente') {
  const chave = modo === 'admin' ? CHAVE_TOKEN_ADMIN : CHAVE_TOKEN_CLIENTE;
  if (token) {
    localStorage.setItem(chave, token);
  } else {
    localStorage.removeItem(chave);
  }
}

function limparToken(modo = 'cliente') {
  const chave = modo === 'admin' ? CHAVE_TOKEN_ADMIN : CHAVE_TOKEN_CLIENTE;
  localStorage.removeItem(chave);
}

/**
 * Função central de requisição HTTP para o Back-end.
 */
async function requisitar(endpoint, { metodo = 'GET', body = null, modo = 'cliente' } = {}) {
  const headers = {};
  const token = obterToken(modo);

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const ehFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body && !ehFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const resposta = await fetch(`${API_BASE}${endpoint}`, {
    method: metodo,
    headers,
    body: body ? (ehFormData ? body : JSON.stringify(body)) : undefined,
  });

  const dados = await resposta.json().catch(() => ({
    sucesso: false,
    erro: 'Erro inesperado ao processar resposta do servidor.',
  }));

  if (!resposta.ok || dados.sucesso === false) {
    const erro = new Error(dados.erro || `Erro HTTP ${resposta.status}`);
    erro.status = resposta.status;
    erro.codigo = dados.codigo;
    throw erro;
  }

  return dados;
}

/**
 * Converte um arquivo (<input type="file">) em Data URI Base64 para envio limpo à API.
 * O Back-end comprime automaticamente para .webp via sharp.
 * @param {File} arquivo
 * @returns {Promise<string>}
 */
function lerArquivoComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    leitor.readAsDataURL(arquivo);
  });
}

const Api = {
  obterToken,
  salvarToken,
  limparToken,
  lerArquivoComoBase64,

  // ==========================================================================
  // 1. AUTENTICAÇÃO E PERFIL (CLIENTE E ADMIN)
  // ==========================================================================
  async registrarCliente(dados) {
    const res = await requisitar('/auth/registro', { metodo: 'POST', body: dados, modo: 'cliente' });
    if (res.token) salvarToken(res.token, 'cliente');
    return res;
  },

  async loginCliente(identificador, senha) {
    const res = await requisitar('/auth/login', {
      metodo: 'POST',
      body: { identificador, senha },
      modo: 'cliente',
    });
    if (res.token) salvarToken(res.token, 'cliente');
    return res;
  },

  async loginAdmin(identificador, senha) {
    const res = await requisitar('/auth/admin/login', {
      metodo: 'POST',
      body: { identificador, senha },
      modo: 'admin',
    });
    if (res.token) salvarToken(res.token, 'admin');
    return res;
  },

  async recuperarSenha(dados) {
    return requisitar('/auth/recuperar-senha', { metodo: 'POST', body: dados, modo: 'cliente' });
  },

  async alterarSenha(dados, modo = 'admin') {
    return requisitar('/auth/alterar-senha', { metodo: 'PATCH', body: dados, modo });
  },

  async obterPerfil(modo = 'cliente') {
    return requisitar('/auth/me', { metodo: 'GET', modo });
  },

  async atualizarPerfil(dados, modo = 'cliente') {
    return requisitar('/auth/perfil', { metodo: 'PUT', body: dados, modo });
  },

  async logout(modo = 'cliente') {
    try {
      await requisitar('/auth/logout', { metodo: 'POST', modo });
    } finally {
      limparToken(modo);
    }
  },

  // ==========================================================================
  // 2. CARDÁPIO PÚBLICO E FAVORITOS (VISÃO CLIENTE)
  // ==========================================================================
  async obterCardapio({ categoria = '', categoriaId = '', busca = '' } = {}) {
    const params = new URLSearchParams();
    if (categoria) params.set('categoria', categoria);
    if (categoriaId) params.set('categoria_id', categoriaId);
    if (busca) params.set('busca', busca);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return requisitar(`/cardapio${qs}`, { metodo: 'GET', modo: 'cliente' });
  },

  async listarCategoriasPublicas() {
    return requisitar('/categorias', { metodo: 'GET', modo: 'cliente' });
  },

  async listarFavoritos({ categoria = '', categoriaId = '' } = {}) {
    const params = new URLSearchParams();
    if (categoria) params.set('categoria', categoria);
    if (categoriaId) params.set('categoria_id', categoriaId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return requisitar(`/favoritos${qs}`, { metodo: 'GET', modo: 'cliente' });
  },

  async alternarFavorito(itemId) {
    return requisitar(`/favoritos/toggle/${itemId}`, { metodo: 'POST', modo: 'cliente' });
  },

  // ==========================================================================
  // 3. SACOLA / CARRINHO E PEDIDOS DO CLIENTE
  // ==========================================================================
  async obterSacola() {
    return requisitar('/sacola', { metodo: 'GET', modo: 'cliente' });
  },

  async adicionarItemSacola(itemId, quantidade = 1) {
    return requisitar('/sacola/itens', {
      metodo: 'POST',
      body: { item_id: itemId, quantidade },
      modo: 'cliente',
    });
  },

  async atualizarQuantidadeSacola(itemId, quantidade) {
    return requisitar(`/sacola/itens/${itemId}`, {
      metodo: 'PATCH',
      body: { quantidade },
      modo: 'cliente',
    });
  },

  async removerItemSacola(itemId, apenasUmaUnidade = false) {
    const qs = apenasUmaUnidade ? '?apenasUmaUnidade=true' : '';
    return requisitar(`/sacola/itens/${itemId}${qs}`, { metodo: 'DELETE', modo: 'cliente' });
  },

  async limparSacola() {
    return requisitar('/sacola', { metodo: 'DELETE', modo: 'cliente' });
  },

  async enviarPedido(dados = {}) {
    return requisitar('/pedidos', { metodo: 'POST', body: dados, modo: 'cliente' });
  },

  async listarMeusPedidos() {
    return requisitar('/pedidos', { metodo: 'GET', modo: 'cliente' });
  },

  // ==========================================================================
  // 4. PAINEL ADMINISTRADOR (CATEGORIAS, PRODUTOS, PEDIDOS E USUÁRIOS)
  // ==========================================================================
  async obterResumoAdmin() {
    return requisitar('/admin/resumo', { metodo: 'GET', modo: 'admin' });
  },

  // Categorias Admin
  async listarCategoriasAdmin() {
    return requisitar('/admin/categorias', { metodo: 'GET', modo: 'admin' });
  },

  async obterCategoriaComItensAdmin(categoriaId) {
    return requisitar(`/admin/categorias/${categoriaId}/itens`, { metodo: 'GET', modo: 'admin' });
  },

  async criarCategoriaAdmin(dados) {
    return requisitar('/admin/categorias', { metodo: 'POST', body: dados, modo: 'admin' });
  },

  async atualizarCategoriaAdmin(id, dados) {
    return requisitar(`/admin/categorias/${id}`, { metodo: 'PUT', body: dados, modo: 'admin' });
  },

  async reordenarCategoriasAdmin(listaOrdem) {
    return requisitar('/admin/categorias/reordenar', {
      metodo: 'PATCH',
      body: { categorias: listaOrdem },
      modo: 'admin',
    });
  },

  async removerCategoriaAdmin(id, forcar = false) {
    const qs = forcar ? '?forcar=true' : '';
    return requisitar(`/admin/categorias/${id}${qs}`, { metodo: 'DELETE', modo: 'admin' });
  },

  // Produtos / Itens do Cardápio Admin
  async listarItensAdmin({ categoriaId = '', busca = '' } = {}) {
    const params = new URLSearchParams();
    if (categoriaId) params.set('categoria_id', categoriaId);
    if (busca) params.set('busca', busca);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return requisitar(`/admin/cardapio/itens${qs}`, { metodo: 'GET', modo: 'admin' });
  },

  async criarItemAdmin(dados) {
    return requisitar('/admin/cardapio/itens', { metodo: 'POST', body: dados, modo: 'admin' });
  },

  async atualizarItemAdmin(id, dados) {
    return requisitar(`/admin/cardapio/itens/${id}`, { metodo: 'PUT', body: dados, modo: 'admin' });
  },

  async alternarVisibilidadeItemAdmin(id, oculto = undefined) {
    return requisitar(`/admin/cardapio/itens/${id}/visibilidade`, {
      metodo: 'PATCH',
      body: oculto !== undefined ? { oculto } : {},
      modo: 'admin',
    });
  },

  async removerItemAdmin(id) {
    return requisitar(`/admin/cardapio/itens/${id}`, { metodo: 'DELETE', modo: 'admin' });
  },

  // Pedidos Admin
  async listarPedidosAdmin() {
    return requisitar('/admin/pedidos', { metodo: 'GET', modo: 'admin' });
  },

  async modificarPedidoAdmin(id, dados) {
    return requisitar(`/admin/pedidos/${id}`, { metodo: 'PUT', body: dados, modo: 'admin' });
  },

  async concluirPedidoAdmin(id) {
    return requisitar(`/admin/pedidos/${id}/concluir`, { metodo: 'PATCH', modo: 'admin' });
  },

  async cancelarPedidoAdmin(id) {
    return requisitar(`/admin/pedidos/${id}/cancelar`, { metodo: 'PATCH', modo: 'admin' });
  },

  async reabrirPedidoAdmin(id) {
    return requisitar(`/admin/pedidos/${id}/reabrir`, { metodo: 'PATCH', modo: 'admin' });
  },

  async removerPedidoAdmin(id) {
    return requisitar(`/admin/pedidos/${id}`, { metodo: 'DELETE', modo: 'admin' });
  },

  // Usuários Admin
  async listarUsuariosAdmin({ tipo = '', ativo = '', busca = '', ordenar = '' } = {}) {
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    if (ativo !== '') params.set('ativo', ativo);
    if (busca) params.set('busca', busca);
    if (ordenar) params.set('ordenar', ordenar);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return requisitar(`/admin/usuarios${qs}`, { metodo: 'GET', modo: 'admin' });
  },

  async criarUsuarioAdmin(dados) {
    return requisitar('/admin/usuarios', { metodo: 'POST', body: dados, modo: 'admin' });
  },

  async atualizarUsuarioAdmin(id, dados) {
    return requisitar(`/admin/usuarios/${id}`, { metodo: 'PUT', body: dados, modo: 'admin' });
  },

  async alternarStatusUsuarioAdmin(id, ativo = undefined) {
    return requisitar(`/admin/usuarios/${id}/status`, {
      metodo: 'PATCH',
      body: ativo !== undefined ? { ativo } : {},
      modo: 'admin',
    });
  },

  async removerUsuarioAdmin(id) {
    return requisitar(`/admin/usuarios/${id}`, { metodo: 'DELETE', modo: 'admin' });
  },
};

window.CafeteriaApi = Api;
