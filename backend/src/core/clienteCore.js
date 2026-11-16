/**
 * @file clienteCore.js
 * @description Regras de negócio e validações do cadastro de clientes e
 * gerenciamento de usuários (clientes e funcionários/internos).
 *
 * Atende aos requisitos:
 * - Cliente: 1. criar conta e fazer login
 * - Admin: 7. ver e gerenciar usuários (clientes e funcionários, incluindo filtro bi:filter da tela 143:838)
 * - Admin: 8. criar novo usuário (cliente e funcionário)
 */

const repositorio = require('./repositorioCore');
const authCore = require('./authCore');
const { processarFotoPerfil } = require('./siteCore');
const {
  limparTextoSimples,
  validarEmail,
  validarTelefone,
  validarSenha,
  validarId,
} = require('./validacaoCore');
const {
  erroValidacao,
  erroConflito,
  erroNaoEncontrado,
  erroProibido,
} = require('./errosCore');

function derivarNomeDeEmail(email) {
  const prefixo = String(email || '').split('@')[0] || 'Cliente';
  return prefixo
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letra) => letra.toUpperCase())
    .trim();
}

function formatarUltimoAcesso(isoDate) {
  if (!isoDate) return 'Nunca acessou';
  const data = new Date(isoDate);
  if (Number.isNaN(data.getTime())) return String(isoDate);

  const hoje = new Date();
  const mesmoDia =
    data.getUTCFullYear() === hoje.getUTCFullYear() &&
    data.getUTCMonth() === hoje.getUTCMonth() &&
    data.getUTCDate() === hoje.getUTCDate();

  if (mesmoDia) {
    return 'hoje';
  }

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarUsuarioParaResposta(usuario) {
  const seguro = authCore.sanitizarUsuarioPublico(usuario);
  if (!seguro) return null;

  return {
    ...seguro,
    status_label: seguro.ativo !== false ? 'Ativo' : 'Inativo',
    ultimo_acesso_label: `Último acesso: ${formatarUltimoAcesso(seguro.ultimo_acesso)}`,
  };
}

async function garantirUnicidadeEmailETelefone(email, telefone, ignorarId = null) {
  if (email) {
    const existenteEmail = await repositorio.buscarUsuarioPorEmail(email);
    if (existenteEmail && String(existenteEmail.id) !== String(ignorarId)) {
      throw erroConflito('Já existe uma conta cadastrada com este e-mail.');
    }
  }

  if (telefone) {
    const existenteTel = await repositorio.buscarUsuarioPorTelefone(telefone);
    if (existenteTel && String(existenteTel.id) !== String(ignorarId)) {
      throw erroConflito('Já existe uma conta cadastrada com este telefone.');
    }
  }
}

/**
 * Realiza o auto-cadastro de um novo cliente (Tela 87:216 "Criar conta" do aplicativo).
 */
async function cadastrarCliente(dados = {}) {
  const email = validarEmail(dados.email);
  const telefone = validarTelefone(dados.telefone, true);
  const confirmarSenha =
    dados.confirmarSenha !== undefined ? dados.confirmarSenha : dados.confirmar_senha;

  validarSenha(dados.senha, confirmarSenha);

  const nomeInformado = limparTextoSimples(dados.nome);
  const nome = nomeInformado || derivarNomeDeEmail(email);

  if (nome.length < 2 || nome.length > 100) {
    throw erroValidacao('O nome deve ter entre 2 e 100 caracteres.');
  }

  await garantirUnicidadeEmailETelefone(email, telefone);

  const senha_hash = await authCore.gerarHashSenha(dados.senha);
  const entradaFoto = dados.foto || dados.foto_webp || dados.imagem || null;
  const foto_webp = entradaFoto ? await processarFotoPerfil(entradaFoto) : null;

  const novoCliente = await repositorio.criarUsuario({
    nome,
    email,
    telefone,
    senha_hash,
    tipo: 'cliente',
    cargo: null,
    foto_webp,
    ativo: true,
    favoritos: [],
  });

  const token = authCore.gerarToken(novoCliente);

  return {
    token,
    usuario: formatarUsuarioParaResposta(novoCliente),
  };
}

function normalizarTipoUsuario(tipoBruto) {
  const t = String(tipoBruto || 'cliente')
    .trim()
    .toLowerCase();

  if (t === 'interno' || t === 'funcionario' || t === 'funcionário' || t === 'colaborador') {
    return 'funcionario';
  }
  if (t === 'admin' || t === 'administrador' || t === 'operador') {
    return 'admin';
  }
  if (t === 'cliente') {
    return 'cliente';
  }

  throw erroValidacao('Tipo de usuário inválido. Use "cliente", "funcionario" (interno) ou "admin".');
}

/**
 * Cria um novo usuário (cliente ou funcionário/admin) a partir do painel administrativo.
 */
async function criarUsuarioPeloAdmin(dados = {}) {
  const email = validarEmail(dados.email);
  const telefone = validarTelefone(dados.telefone, false);
  const tipo = normalizarTipoUsuario(dados.tipo);

  const nomeInformado = limparTextoSimples(dados.nome);
  const nome = nomeInformado || derivarNomeDeEmail(email);
  if (nome.length < 2 || nome.length > 100) {
    throw erroValidacao('O nome do usuário é obrigatório (entre 2 e 100 caracteres).');
  }

  const confirmarSenha =
    dados.confirmarSenha !== undefined ? dados.confirmarSenha : dados.confirmar_senha;
  const senhaBruta = dados.senha || '123456';
  validarSenha(senhaBruta, confirmarSenha);

  await garantirUnicidadeEmailETelefone(email, telefone);

  const senha_hash = await authCore.gerarHashSenha(senhaBruta);
  const entradaFoto = dados.foto || dados.foto_webp || dados.imagem || null;
  const foto_webp = entradaFoto ? await processarFotoPerfil(entradaFoto) : null;

  const cargoPadrao = tipo === 'cliente' ? null : 'Atendimento';
  const cargo = dados.cargo !== undefined ? limparTextoSimples(dados.cargo) : cargoPadrao;

  const ativo = dados.ativo !== undefined ? Boolean(dados.ativo) : true;

  const novoUsuario = await repositorio.criarUsuario({
    nome,
    email,
    telefone,
    senha_hash,
    tipo,
    cargo,
    foto_webp,
    ativo,
    favoritos: [],
  });

  return formatarUsuarioParaResposta(novoUsuario);
}

/**
 * Lista usuários para o painel administrativo, separando em `internos` e `clientes`
 * e suportando os filtros (`bi:filter`) da tela "Administrador - usuários" (143:838).
 */
async function listarUsuariosAdmin(filtros = {}) {
  const listaBruta = await repositorio.listarUsuarios(filtros);
  const todos = listaBruta.map(formatarUsuarioParaResposta);

  if (filtros.ordenar === 'nome') {
    todos.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  } else if (filtros.ordenar === 'ultimo_acesso') {
    todos.sort(
      (a, b) => new Date(b.ultimo_acesso || 0).getTime() - new Date(a.ultimo_acesso || 0).getTime()
    );
  }

  const internos = todos.filter((u) => u.tipo === 'admin' || u.tipo === 'funcionario');
  const clientes = todos.filter((u) => u.tipo === 'cliente');

  return {
    internos,
    clientes,
    todos,
    totalInternos: internos.length,
    totalClientes: clientes.length,
    total: todos.length,
  };
}

async function buscarUsuarioPorIdCore(id) {
  const idValido = validarId(id, 'ID do usuário');
  const usuario = await repositorio.buscarUsuarioPorId(idValido);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }
  return formatarUsuarioParaResposta(usuario);
}

async function atualizarUsuarioCore(idAlvo, dados = {}, usuarioSolicitante = null) {
  const id = validarId(idAlvo, 'ID do usuário');
  const usuarioAtual = await repositorio.buscarUsuarioPorId(id);
  if (!usuarioAtual) {
    throw erroNaoEncontrado('Usuário');
  }

  const solicitanteEhAdmin = authCore.usuarioEhAdminOuFuncionario(usuarioSolicitante);
  const editandoPropriaConta =
    usuarioSolicitante && String(usuarioSolicitante.id) === String(usuarioAtual.id);

  if (!solicitanteEhAdmin && !editandoPropriaConta) {
    throw erroProibido('Você só pode alterar os dados da sua própria conta.');
  }

  const camposParaAtualizar = {};

  if (dados.nome !== undefined) {
    const nome = limparTextoSimples(dados.nome);
    if (nome.length < 2 || nome.length > 100) {
      throw erroValidacao('O nome deve ter entre 2 e 100 caracteres.');
    }
    camposParaAtualizar.nome = nome;
  }

  if (dados.email !== undefined) {
    camposParaAtualizar.email = validarEmail(dados.email);
  }

  if (dados.telefone !== undefined) {
    camposParaAtualizar.telefone = validarTelefone(dados.telefone, false);
  }

  if (camposParaAtualizar.email || camposParaAtualizar.telefone) {
    await garantirUnicidadeEmailETelefone(
      camposParaAtualizar.email,
      camposParaAtualizar.telefone,
      usuarioAtual.id
    );
  }

  if (dados.senha) {
    const confirmarSenha =
      dados.confirmarSenha !== undefined ? dados.confirmarSenha : dados.confirmar_senha;
    validarSenha(dados.senha, confirmarSenha);
    camposParaAtualizar.senha_hash = await authCore.gerarHashSenha(dados.senha);
  }

  const entradaFoto = dados.foto || dados.foto_webp || dados.imagem;
  if (entradaFoto) {
    camposParaAtualizar.foto_webp = await processarFotoPerfil(entradaFoto);
  } else if (dados.remover_foto === true) {
    camposParaAtualizar.foto_webp = null;
  }

  if (solicitanteEhAdmin) {
    if (dados.tipo !== undefined) {
      camposParaAtualizar.tipo = normalizarTipoUsuario(dados.tipo);
    }
    if (dados.cargo !== undefined) {
      camposParaAtualizar.cargo = dados.cargo ? limparTextoSimples(dados.cargo) : null;
    }
    if (dados.ativo !== undefined) {
      const novoAtivo =
        dados.ativo === true || dados.ativo === 'true' || dados.ativo === 1 || dados.ativo === '1';
      if (!novoAtivo && editandoPropriaConta) {
        throw erroValidacao('Você não pode inativar a sua própria conta de administrador.');
      }
      camposParaAtualizar.ativo = novoAtivo;
    }
  }

  const atualizado = await repositorio.atualizarUsuario(usuarioAtual.id, camposParaAtualizar);
  return formatarUsuarioParaResposta(atualizado);
}

async function alterarStatusUsuarioCore(idAlvo, statusDesejado, usuarioSolicitante) {
  const id = validarId(idAlvo, 'ID do usuário');
  const usuarioAtual = await repositorio.buscarUsuarioPorId(id);
  if (!usuarioAtual) {
    throw erroNaoEncontrado('Usuário');
  }

  const novoStatus =
    statusDesejado !== undefined ? Boolean(statusDesejado) : !Boolean(usuarioAtual.ativo);

  if (!novoStatus && usuarioSolicitante && String(usuarioSolicitante.id) === String(usuarioAtual.id)) {
    throw erroValidacao('Você não pode inativar sua própria conta.');
  }

  const atualizado = await repositorio.atualizarUsuario(usuarioAtual.id, { ativo: novoStatus });
  return formatarUsuarioParaResposta(atualizado);
}

async function removerUsuarioCore(idAlvo, usuarioSolicitante) {
  const id = validarId(idAlvo, 'ID do usuário');
  if (usuarioSolicitante && String(usuarioSolicitante.id) === String(id)) {
    throw erroValidacao('Você não pode excluir sua própria conta.');
  }

  const removido = await repositorio.removerUsuario(id);
  if (!removido) {
    throw erroNaoEncontrado('Usuário');
  }

  return { id, removido: true };
}

module.exports = {
  formatarUsuarioParaResposta,
  cadastrarCliente,
  criarUsuarioPeloAdmin,
  listarUsuariosAdmin,
  buscarUsuarioPorIdCore,
  atualizarUsuarioCore,
  alterarStatusUsuarioCore,
  removerUsuarioCore,
};
