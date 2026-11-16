/**
 * @file repositorioCore.js
 * @description Camada adaptadora de persistência (Ponte Core <-> Database).
 *
 * Responsabilidade:
 * - Conectar os módulos de regras de negócio (`core/`) às queries SQL (`database/queries.js`).
 * - Caso o time de Banco de Dados já tenha criado `src/database/queries.js`, todas as chamadas
 *   são delegadas diretamente para lá.
 * - Caso `src/database/queries.js` ainda não tenha sido implementado, utiliza um banco em
 *   memória pré-carregado com todos os dados das duas visões do protótipo do Figma
 *   (Visão Usuário 161:289 e Visão Administrador 161:290), permitindo que o time de Front-end
 *   consuma e teste 100% das APIs imediatamente.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const CAMINHO_QUERIES = path.resolve(__dirname, '../database/queries.js');

/**
 * Tenta carregar o módulo `database/queries.js` caso já tenha sido criado pelo time de BD.
 * @returns {Record<string, Function> | null}
 */
function carregarModuloQueries() {
  try {
    if (fs.existsSync(CAMINHO_QUERIES)) {
      const modulo = require(CAMINHO_QUERIES);
      if (modulo && typeof modulo === 'object' && Object.keys(modulo).length > 0) {
        return modulo;
      }
    }
  } catch (erro) {
    console.warn('[RepositorioCore] Aviso ao carregar database/queries.js (usando fallback em memória):', erro.message);
  }
  return null;
}

// ============================================================================
// ESTADO EM MEMÓRIA (FIEL ÀS TELAS 161:289 E 161:290 DO FIGMA)
// ============================================================================

const SENHA_HASH_PADRAO_CLIENTE = bcrypt.hashSync('123456', 10);
const SENHA_HASH_PADRAO_ADMIN = bcrypt.hashSync('admin123', 10);

const estadoMemoria = {
  contadores: {
    usuarios: 3,
    categorias: 3,
    itens: 12,
    pedidos: 52680,
  },

  categorias: [
    { id: 1, nome: 'Gelados', slug: 'gelados', ordem: 1, ativo: true, criado_em: '2026-05-01T08:00:00.000Z' },
    { id: 2, nome: 'Quentes', slug: 'quentes', ordem: 2, ativo: true, criado_em: '2026-05-01T08:00:00.000Z' },
    { id: 3, nome: 'Sanduiches', slug: 'sanduiches', ordem: 3, ativo: true, criado_em: '2026-05-01T08:00:00.000Z' },
  ],

  itensCardapio: [
    // Categoria 1: Gelados (Telas 1:2, 14:41, 143:999)
    {
      id: 1,
      categoria_id: 1,
      categoria_nome: 'Gelados',
      nome: 'Café com Baunilha',
      descricao: 'Um delicioso café gelado com creme de baunilha e canela em pó.',
      preco: 10.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 2,
      categoria_id: 1,
      categoria_nome: 'Gelados',
      nome: 'Matcha',
      descricao: 'Matcha, leite e gelo. Super refrescante. Perfeito para o verão.',
      preco: 12.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 3,
      categoria_id: 1,
      categoria_nome: 'Gelados',
      nome: 'Café Gelado',
      descricao: 'Delicioso café torra média, filtrado e muito gelado.',
      preco: 12.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 4,
      categoria_id: 1,
      categoria_nome: 'Gelados',
      nome: 'Latte Gelado',
      descricao: 'Um mix de especiarias como canela, erva doce, pimenta preta, cravo e anis.',
      preco: 19.00,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },

    // Categoria 2: Quentes (Telas 13:250, 14:128)
    {
      id: 5,
      categoria_id: 2,
      categoria_nome: 'Quentes',
      nome: 'Espresso Duplo',
      descricao: 'Espresso duplo. Essencial para começar o dia, café torra clara.',
      preco: 9.00,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 6,
      categoria_id: 2,
      categoria_nome: 'Quentes',
      nome: 'Café com Leite',
      descricao: 'Um clássico brasileiro. Café coado e leite quente na medida certa.',
      preco: 12.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 7,
      categoria_id: 2,
      categoria_nome: 'Quentes',
      nome: 'Matcha Quente',
      descricao: 'Matcha, leite e baunilha. Um abraço quente de sabor.',
      preco: 12.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 8,
      categoria_id: 2,
      categoria_nome: 'Quentes',
      nome: 'Café com leite Mini',
      descricao: 'Uma dose de espresso com um pouco de leite. Para quem tem pressa.',
      preco: 10.00,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },

    // Categoria 3: Sanduiches (Telas 13:148, 14:180)
    {
      id: 9,
      categoria_id: 3,
      categoria_nome: 'Sanduiches',
      nome: 'Sanduiche Clássico',
      descricao: 'Pão, queijo, presunto e tomates cerejas. Um clássico da culinária.',
      preco: 18.75,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 10,
      categoria_id: 3,
      categoria_nome: 'Sanduiches',
      nome: 'Queijo Quente',
      descricao: 'Pão torradinho, duas fatias de queijo prato e um toque de manteiga.',
      preco: 12.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 11,
      categoria_id: 3,
      categoria_nome: 'Sanduiches',
      nome: 'Misto Quente',
      descricao: 'Pão, queijo e presunto quentinhos. Tão clássico quanto o Sanduiche Clássico.',
      preco: 12.90,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
    {
      id: 12,
      categoria_id: 3,
      categoria_nome: 'Sanduiches',
      nome: 'Misto Pão de Queijo',
      descricao: 'Um misto quente diferente. Pão de queijo, presunto e uma fatia de queijo.',
      preco: 14.00,
      foto_webp: null,
      oculto: false,
      criado_em: '2026-05-01T08:00:00.000Z',
    },
  ],

  usuarios: [
    {
      id: 1,
      nome: 'Guilherme Silveira',
      email: 'guilherme@cafeteriajoao.com',
      telefone: '48999990001',
      senha_hash: SENHA_HASH_PADRAO_CLIENTE,
      tipo: 'cliente',
      cargo: null,
      foto_webp: null,
      ativo: true,
      favoritos: [2, 5, 9, 12], // Matcha, Espresso Duplo, Sanduiche Clássico, Misto Pão de Queijo (telas 14:41, 14:128, 14:180)
      ultimo_acesso: new Date().toISOString(),
      criado_em: '2026-05-01T10:00:00.000Z',
    },
    {
      id: 2,
      nome: 'Lucas Sales',
      email: 'lucas@cafeteriajoao.com',
      telefone: '48999990002',
      senha_hash: SENHA_HASH_PADRAO_ADMIN,
      tipo: 'funcionario',
      cargo: 'Atendimento',
      foto_webp: null,
      ativo: true,
      favoritos: [],
      ultimo_acesso: new Date().toISOString(),
      criado_em: '2026-05-01T09:00:00.000Z',
    },
    {
      id: 3,
      nome: 'Guilherme Silveira',
      email: 'admin@cafeteriajoao.com',
      telefone: '48999990000',
      senha_hash: SENHA_HASH_PADRAO_ADMIN,
      tipo: 'admin',
      cargo: 'Operador',
      foto_webp: null,
      ativo: true,
      favoritos: [],
      ultimo_acesso: new Date().toISOString(),
      criado_em: '2026-05-01T08:00:00.000Z',
    },
  ],

  sacolas: new Map(),

  // Pedidos fiéis às telas 17:222 (Minha conta) e 143:150 (Administrador - pedidos)
  pedidos: [
    {
      id: 52675,
      numero: 52675,
      usuario_id: 1,
      cliente_nome: 'Guilherme Silveira',
      cliente_foto: null,
      itens: [
        { item_id: 4, nome: 'Latte', preco_unitario: 10.00, quantidade: 1, subtotal: 10.00 },
        { item_id: 9, nome: 'Bolo de cenoura', preco_unitario: 9.30, quantidade: 1, subtotal: 9.30 },
      ],
      total: 19.30,
      unidade_retirada: 'Shopping Beira Mar',
      previsao_minutos: 5,
      status: 'concluido',
      criado_em: '2026-05-06T11:00:00.000Z',
      finalizado_em: '2026-05-06T11:10:00.000Z',
    },
    {
      id: 52676,
      numero: 52676,
      usuario_id: 1,
      cliente_nome: 'Guilherme Silveira',
      cliente_foto: null,
      itens: [
        { item_id: 6, nome: 'Cappuccino', preco_unitario: 12.00, quantidade: 1, subtotal: 12.00 },
        { item_id: 12, nome: 'Pão de queijo', preco_unitario: 5.00, quantidade: 2, subtotal: 10.00 },
      ],
      total: 22.00,
      unidade_retirada: 'Shopping Beira Mar',
      previsao_minutos: 5,
      status: 'concluido',
      criado_em: '2026-05-07T15:10:00.000Z',
      finalizado_em: '2026-05-07T15:20:00.000Z',
    },
    {
      id: 52677,
      numero: 52677,
      usuario_id: 1,
      cliente_nome: 'Guilherme Silveira',
      cliente_foto: null,
      itens: [
        { item_id: 3, nome: 'Chá gelado', preco_unitario: 5.00, quantidade: 2, subtotal: 10.00 },
        { item_id: 9, nome: 'Croissant de chocolate', preco_unitario: 8.50, quantidade: 1, subtotal: 8.50 },
      ],
      total: 18.50,
      unidade_retirada: 'Shopping Beira Mar',
      previsao_minutos: 5,
      status: 'concluido',
      criado_em: '2026-05-08T09:35:00.000Z',
      finalizado_em: '2026-05-08T09:45:00.000Z',
    },
    {
      id: 52678,
      numero: 52678,
      usuario_id: 1,
      cliente_nome: 'Guilherme Silveira',
      cliente_foto: null,
      itens: [
        { item_id: 1, nome: 'Café com Baunilha', preco_unitario: 10.90, quantidade: 1, subtotal: 10.90 },
        { item_id: 10, nome: 'Queijo Quente', preco_unitario: 12.90, quantidade: 1, subtotal: 12.90 },
      ],
      total: 23.80,
      unidade_retirada: 'Shopping Beira Mar',
      previsao_minutos: 5,
      status: 'concluido',
      criado_em: '2026-05-09T13:20:00.000Z',
      finalizado_em: '2026-05-09T13:29:00.000Z',
    },
    {
      id: 52679,
      numero: 52679,
      usuario_id: 1,
      cliente_nome: 'Guilherme Silveira',
      cliente_foto: null,
      itens: [
        { item_id: 1, nome: 'Café com Baunilha', preco_unitario: 10.90, quantidade: 1, subtotal: 10.90 },
        { item_id: 10, nome: 'Queijo Quente', preco_unitario: 12.90, quantidade: 1, subtotal: 12.90 },
      ],
      total: 23.80,
      unidade_retirada: 'Shopping Beira Mar',
      previsao_minutos: 5,
      status: 'concluido',
      criado_em: '2026-05-10T10:05:00.000Z',
      finalizado_em: '2026-05-10T10:12:00.000Z',
    },
    {
      id: 52680,
      numero: 52680,
      usuario_id: 1,
      cliente_nome: 'Guilherme Silveira',
      cliente_foto: null,
      itens: [
        { item_id: 1, nome: 'Café com Baunilha', preco_unitario: 10.90, quantidade: 1, subtotal: 10.90 },
        { item_id: 10, nome: 'Queijo Quente', preco_unitario: 12.90, quantidade: 1, subtotal: 12.90 },
        { item_id: 12, nome: 'Misto Pão de Queijo', preco_unitario: 14.00, quantidade: 1, subtotal: 14.00 },
      ],
      total: 37.80,
      unidade_retirada: 'Shopping Beira Mar',
      previsao_minutos: 5,
      status: 'preparando',
      criado_em: new Date().toISOString(),
      finalizado_em: null,
    },
  ],
};

/**
 * Executa a função correspondente em `database/queries.js` se existir,
 * caso contrário executa o fallback em memória.
 * @param {string[]} nomesFuncoes - Possíveis nomes da função em `queries.js`
 * @param {Function} fallbackFn - Implementação em memória
 * @param  {...any} args - Argumentos repassados
 */
async function executarQueryOuFallback(nomesFuncoes, fallbackFn, ...args) {
  const queries = carregarModuloQueries();
  if (queries) {
    for (const nome of nomesFuncoes) {
      if (typeof queries[nome] === 'function') {
        return await queries[nome](...args);
      }
    }
  }
  return await fallbackFn(...args);
}

// ============================================================================
// OPERAÇÕES DE USUÁRIOS
// ============================================================================

async function buscarUsuarioPorId(id) {
  return executarQueryOuFallback(
    ['buscarUsuarioPorId', 'getUsuarioById', 'selectUsuarioPorId'],
    async (idBusca) => {
      const u = estadoMemoria.usuarios.find((item) => String(item.id) === String(idBusca));
      return u ? { ...u, favoritos: [...(u.favoritos || [])] } : null;
    },
    id
  );
}

async function buscarUsuarioPorEmail(email) {
  return executarQueryOuFallback(
    ['buscarUsuarioPorEmail', 'getUsuarioByEmail'],
    async (emailBusca) => {
      const normalizado = String(emailBusca || '').toLowerCase();
      const u = estadoMemoria.usuarios.find((item) => item.email.toLowerCase() === normalizado);
      return u ? { ...u, favoritos: [...(u.favoritos || [])] } : null;
    },
    email
  );
}

async function buscarUsuarioPorTelefone(telefone) {
  return executarQueryOuFallback(
    ['buscarUsuarioPorTelefone', 'getUsuarioByTelefone'],
    async (telBusca) => {
      const digitos = String(telBusca || '').replace(/\D/g, '');
      const u = estadoMemoria.usuarios.find(
        (item) => String(item.telefone || '').replace(/\D/g, '') === digitos
      );
      return u ? { ...u, favoritos: [...(u.favoritos || [])] } : null;
    },
    telefone
  );
}

async function listarUsuarios(filtros = {}) {
  return executarQueryOuFallback(
    ['listarUsuarios', 'getUsuarios', 'selectUsuarios'],
    async ({ tipo, ativo, cargo, busca } = {}) => {
      let lista = estadoMemoria.usuarios.map((u) => ({ ...u, favoritos: [...(u.favoritos || [])] }));

      if (tipo) {
        if (tipo === 'interno') {
          lista = lista.filter((u) => u.tipo === 'admin' || u.tipo === 'funcionario');
        } else {
          lista = lista.filter((u) => u.tipo === tipo);
        }
      }

      if (ativo !== undefined && ativo !== null && ativo !== '') {
        const boolAtivo = ativo === true || ativo === 'true' || ativo === '1' || ativo === 1;
        lista = lista.filter((u) => Boolean(u.ativo) === boolAtivo);
      }

      if (cargo) {
        const termoCargo = String(cargo).toLowerCase();
        lista = lista.filter((u) => u.cargo && u.cargo.toLowerCase().includes(termoCargo));
      }

      if (busca) {
        const termo = String(busca).toLowerCase();
        lista = lista.filter(
          (u) =>
            (u.nome && u.nome.toLowerCase().includes(termo)) ||
            (u.email && u.email.toLowerCase().includes(termo)) ||
            (u.telefone && u.telefone.includes(termo)) ||
            (u.cargo && u.cargo.toLowerCase().includes(termo))
        );
      }

      return lista;
    },
    filtros
  );
}

async function criarUsuario(dadosUsuario) {
  return executarQueryOuFallback(
    ['criarUsuario', 'inserirUsuario', 'insertUsuario'],
    async (dados) => {
      estadoMemoria.contadores.usuarios += 1;
      const novo = {
        id: estadoMemoria.contadores.usuarios,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone || '',
        senha_hash: dados.senha_hash,
        tipo: dados.tipo || 'cliente',
        cargo: dados.cargo || null,
        foto_webp: dados.foto_webp || null,
        ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : true,
        favoritos: Array.isArray(dados.favoritos) ? dados.favoritos : [],
        ultimo_acesso: new Date().toISOString(),
        criado_em: new Date().toISOString(),
      };
      estadoMemoria.usuarios.push(novo);
      return { ...novo };
    },
    dadosUsuario
  );
}

async function atualizarUsuario(id, camposAtualizados) {
  return executarQueryOuFallback(
    ['atualizarUsuario', 'updateUsuario'],
    async (idAlvo, campos) => {
      const idx = estadoMemoria.usuarios.findIndex((u) => String(u.id) === String(idAlvo));
      if (idx === -1) return null;

      const atual = estadoMemoria.usuarios[idx];
      const atualizado = {
        ...atual,
        ...Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)),
        id: atual.id,
      };
      estadoMemoria.usuarios[idx] = atualizado;
      return { ...atualizado };
    },
    id,
    camposAtualizados
  );
}

async function removerUsuario(id) {
  return executarQueryOuFallback(
    ['removerUsuario', 'deletarUsuario', 'deleteUsuario'],
    async (idAlvo) => {
      const idx = estadoMemoria.usuarios.findIndex((u) => String(u.id) === String(idAlvo));
      if (idx === -1) return false;
      estadoMemoria.usuarios.splice(idx, 1);
      return true;
    },
    id
  );
}

// ============================================================================
// OPERAÇÕES DE CATEGORIAS E ITENS DO CARDÁPIO
// ============================================================================

async function listarCategorias(apenasAtivas = false) {
  return executarQueryOuFallback(
    ['listarCategorias', 'getCategorias', 'selectCategorias'],
    async (somenteAtivas) => {
      let lista = [...estadoMemoria.categorias];
      if (somenteAtivas) {
        lista = lista.filter((c) => c.ativo !== false);
      }
      return lista.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    },
    apenasAtivas
  );
}

async function buscarCategoriaPorId(id) {
  return executarQueryOuFallback(
    ['buscarCategoriaPorId', 'getCategoriaById'],
    async (idBusca) => {
      const cat = estadoMemoria.categorias.find(
        (c) => String(c.id) === String(idBusca) || c.slug === String(idBusca).toLowerCase()
      );
      return cat ? { ...cat } : null;
    },
    id
  );
}

async function criarCategoria(dadosCategoria) {
  return executarQueryOuFallback(
    ['criarCategoria', 'inserirCategoria', 'insertCategoria'],
    async (dados) => {
      estadoMemoria.contadores.categorias += 1;
      const novaOrdem =
        dados.ordem !== undefined ? Number(dados.ordem) : estadoMemoria.categorias.length + 1;
      const nova = {
        id: estadoMemoria.contadores.categorias,
        nome: dados.nome,
        slug: dados.slug,
        ordem: novaOrdem,
        ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : true,
        criado_em: new Date().toISOString(),
      };
      estadoMemoria.categorias.push(nova);
      return { ...nova };
    },
    dadosCategoria
  );
}

async function atualizarCategoria(id, campos) {
  return executarQueryOuFallback(
    ['atualizarCategoria', 'updateCategoria'],
    async (idAlvo, novosCampos) => {
      const idx = estadoMemoria.categorias.findIndex((c) => String(c.id) === String(idAlvo));
      if (idx === -1) return null;

      const atual = estadoMemoria.categorias[idx];
      const atualizada = {
        ...atual,
        ...Object.fromEntries(Object.entries(novosCampos).filter(([, v]) => v !== undefined)),
        id: atual.id,
      };
      estadoMemoria.categorias[idx] = atualizada;

      if (novosCampos.nome) {
        estadoMemoria.itensCardapio.forEach((item) => {
          if (String(item.categoria_id) === String(atual.id)) {
            item.categoria_nome = novosCampos.nome;
          }
        });
      }

      return { ...atualizada };
    },
    id,
    campos
  );
}

async function removerCategoria(id) {
  return executarQueryOuFallback(
    ['removerCategoria', 'deletarCategoria', 'deleteCategoria'],
    async (idAlvo) => {
      const idx = estadoMemoria.categorias.findIndex((c) => String(c.id) === String(idAlvo));
      if (idx === -1) return false;
      estadoMemoria.categorias.splice(idx, 1);
      return true;
    },
    id
  );
}

async function listarItensCardapio(filtros = {}) {
  return executarQueryOuFallback(
    ['listarItensCardapio', 'listarProdutos', 'getItensCardapio', 'selectItensCardapio'],
    async ({ categoriaId, categoriaNome, incluirOcultos = false, busca } = {}) => {
      let itens = estadoMemoria.itensCardapio.map((i) => ({ ...i }));

      if (!incluirOcultos) {
        itens = itens.filter((i) => !i.oculto);
      }

      if (categoriaId !== undefined && categoriaId !== null && categoriaId !== '') {
        itens = itens.filter((i) => String(i.categoria_id) === String(categoriaId));
      }

      if (categoriaNome) {
        const nomeLimpo = String(categoriaNome).trim().toLowerCase();
        itens = itens.filter(
          (i) => String(i.categoria_nome || '').toLowerCase() === nomeLimpo
        );
      }

      if (busca) {
        const termo = String(busca).toLowerCase();
        itens = itens.filter(
          (i) =>
            i.nome.toLowerCase().includes(termo) ||
            (i.descricao && i.descricao.toLowerCase().includes(termo))
        );
      }

      return itens;
    },
    filtros
  );
}

async function buscarItemCardapioPorId(id) {
  return executarQueryOuFallback(
    ['buscarItemCardapioPorId', 'buscarProdutoPorId', 'getItemCardapioById'],
    async (idBusca) => {
      const item = estadoMemoria.itensCardapio.find((i) => String(i.id) === String(idBusca));
      return item ? { ...item } : null;
    },
    id
  );
}

async function criarItemCardapio(dadosItem) {
  return executarQueryOuFallback(
    ['criarItemCardapio', 'inserirItemCardapio', 'criarProduto', 'insertProduto'],
    async (dados) => {
      estadoMemoria.contadores.itens += 1;
      const novo = {
        id: estadoMemoria.contadores.itens,
        categoria_id: dados.categoria_id,
        categoria_nome: dados.categoria_nome,
        nome: dados.nome,
        descricao: dados.descricao || '',
        preco: dados.preco,
        foto_webp: dados.foto_webp || null,
        oculto: Boolean(dados.oculto),
        criado_em: new Date().toISOString(),
      };
      estadoMemoria.itensCardapio.push(novo);
      return { ...novo };
    },
    dadosItem
  );
}

async function atualizarItemCardapio(id, campos) {
  return executarQueryOuFallback(
    ['atualizarItemCardapio', 'atualizarProduto', 'updateItemCardapio'],
    async (idAlvo, novosCampos) => {
      const idx = estadoMemoria.itensCardapio.findIndex((i) => String(i.id) === String(idAlvo));
      if (idx === -1) return null;

      const atual = estadoMemoria.itensCardapio[idx];
      const atualizado = {
        ...atual,
        ...Object.fromEntries(Object.entries(novosCampos).filter(([, v]) => v !== undefined)),
        id: atual.id,
      };
      estadoMemoria.itensCardapio[idx] = atualizado;
      return { ...atualizado };
    },
    id,
    campos
  );
}

async function removerItemCardapio(id) {
  return executarQueryOuFallback(
    ['removerItemCardapio', 'deletarItemCardapio', 'removerProduto', 'deleteProduto'],
    async (idAlvo) => {
      const idx = estadoMemoria.itensCardapio.findIndex((i) => String(i.id) === String(idAlvo));
      if (idx === -1) return false;
      estadoMemoria.itensCardapio.splice(idx, 1);
      return true;
    },
    id
  );
}

// ============================================================================
// OPERAÇÕES DE SACOLA E PEDIDOS
// ============================================================================

async function obterSacolaUsuario(usuarioId) {
  return executarQueryOuFallback(
    ['obterSacolaUsuario', 'getSacolaByUsuarioId'],
    async (uId) => {
      const chave = String(uId);
      return estadoMemoria.sacolas.get(chave) || [];
    },
    usuarioId
  );
}

async function salvarSacolaUsuario(usuarioId, itensSacola) {
  return executarQueryOuFallback(
    ['salvarSacolaUsuario', 'saveSacolaByUsuarioId'],
    async (uId, itens) => {
      const chave = String(uId);
      estadoMemoria.sacolas.set(chave, itens);
      return itens;
    },
    usuarioId,
    itensSacola
  );
}

async function obterProximoNumeroPedido() {
  return executarQueryOuFallback(
    ['obterProximoNumeroPedido', 'getNextPedidoId'],
    async () => estadoMemoria.contadores.pedidos + 1
  );
}

async function criarPedido(dadosPedido) {
  return executarQueryOuFallback(
    ['criarPedido', 'inserirPedido', 'insertPedido'],
    async (dados) => {
      estadoMemoria.contadores.pedidos += 1;
      const id = estadoMemoria.contadores.pedidos;
      const novo = {
        id,
        numero: id,
        usuario_id: dados.usuario_id,
        cliente_nome: dados.cliente_nome,
        cliente_foto: dados.cliente_foto || null,
        itens: dados.itens,
        total: dados.total,
        unidade_retirada: dados.unidade_retirada || 'Shopping Beira Mar',
        previsao_minutos: dados.previsao_minutos || 5,
        status: dados.status || 'preparando',
        criado_em: new Date().toISOString(),
        finalizado_em: null,
      };
      estadoMemoria.pedidos.push(novo);
      return { ...novo };
    },
    dadosPedido
  );
}

async function buscarPedidoPorId(id) {
  return executarQueryOuFallback(
    ['buscarPedidoPorId', 'getPedidoById', 'selectPedidoPorId'],
    async (idBusca) => {
      const p = estadoMemoria.pedidos.find(
        (item) => String(item.id) === String(idBusca) || String(item.numero) === String(idBusca)
      );
      return p ? { ...p, itens: [...p.itens] } : null;
    },
    id
  );
}

async function listarPedidos(filtros = {}) {
  return executarQueryOuFallback(
    ['listarPedidos', 'getPedidos', 'selectPedidos'],
    async ({ usuarioId, status, apenasEmAndamento, apenasHistorico } = {}) => {
      let lista = estadoMemoria.pedidos.map((p) => ({ ...p, itens: [...p.itens] }));

      if (usuarioId !== undefined && usuarioId !== null) {
        lista = lista.filter((p) => String(p.usuario_id) === String(usuarioId));
      }

      if (status) {
        if (Array.isArray(status)) {
          lista = lista.filter((p) => status.includes(p.status));
        } else {
          lista = lista.filter((p) => p.status === status);
        }
      }

      if (apenasEmAndamento) {
        lista = lista.filter((p) => p.status === 'pendente' || p.status === 'preparando');
      }

      if (apenasHistorico) {
        lista = lista.filter((p) => p.status === 'concluido' || p.status === 'cancelado');
      }

      return lista.sort((a, b) => Number(b.id) - Number(a.id));
    },
    filtros
  );
}

async function atualizarPedido(id, campos) {
  return executarQueryOuFallback(
    ['atualizarPedido', 'updatePedido', 'atualizarStatusPedido'],
    async (idAlvo, novosCampos) => {
      const idx = estadoMemoria.pedidos.findIndex(
        (p) => String(p.id) === String(idAlvo) || String(p.numero) === String(idAlvo)
      );
      if (idx === -1) return null;

      const atual = estadoMemoria.pedidos[idx];
      const atualizado = {
        ...atual,
        ...Object.fromEntries(Object.entries(novosCampos).filter(([, v]) => v !== undefined)),
        id: atual.id,
      };
      estadoMemoria.pedidos[idx] = atualizado;
      return { ...atualizado };
    },
    id,
    campos
  );
}

function verificarStatusBanco() {
  const queriesAtivas = Boolean(carregarModuloQueries());
  return {
    modo: queriesAtivas ? 'database_queries_sql' : 'memoria_fallback_prototipo',
    queriesConectadas: queriesAtivas,
  };
}

module.exports = {
  verificarStatusBanco,
  // Usuários
  buscarUsuarioPorId,
  buscarUsuarioPorEmail,
  buscarUsuarioPorTelefone,
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
};
