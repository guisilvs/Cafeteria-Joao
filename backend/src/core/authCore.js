/**
 * @file authCore.js
 * @description Regras de negócio puras de Autenticação e Segurança de Credenciais.
 *
 * Responsabilidades:
 * - Geração de hash de senhas com `bcrypt`
 * - Comparação segura de senhas com hash
 * - Emissão e validação de tokens JWT para sessões de clientes e administradores
 * - Validação de login por E-mail ou Telefone (conforme telas 82:113 e 143:145 do Figma)
 * - Recuperação/redefinição de senha ("Esqueceu sua senha?" na tela 82:113 do Figma)
 * - Verificação de permissões de acesso (Cliente vs Funcionário/Admin)
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repositorio = require('./repositorioCore');
const {
  normalizarIdentificadorLogin,
  validarEmail,
  validarTelefone,
  validarSenha,
} = require('./validacaoCore');
const {
  erroValidacao,
  erroNaoAutorizado,
  erroProibido,
  erroNaoEncontrado,
} = require('./errosCore');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const JWT_SECRET = process.env.JWT_SECRET || 'cafeteria_do_joao_chave_secreta_padrao_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Remove campos sensíveis (como `senha_hash`) antes de retornar o objeto de usuário para a API,
 * e adiciona rótulos úteis para as telas de Cliente ("Olá, Guilherme Silveira") e Admin ("Operador Guilherme Silveira").
 * @param {object} usuario
 * @returns {object|null}
 */
function sanitizarUsuarioPublico(usuario) {
  if (!usuario) return null;
  const { senha_hash, senha, ...dadosSeguros } = usuario;
  const ehAdmin = dadosSeguros.tipo === 'admin' || dadosSeguros.tipo === 'funcionario';

  return {
    ...dadosSeguros,
    eh_admin: ehAdmin,
    saudacao_cliente: `Olá, ${dadosSeguros.nome}`,
    cargo_exibicao: ehAdmin ? dadosSeguros.cargo || 'Operador' : 'Cliente',
    titulo_operador_admin: ehAdmin
      ? `${dadosSeguros.cargo || 'Operador'} ${dadosSeguros.nome}`
      : dadosSeguros.nome,
  };
}

/**
 * Gera o hash seguro da senha em texto puro utilizando bcrypt.
 * @param {string} senhaPura
 * @returns {Promise<string>} Hash bcrypt
 */
async function gerarHashSenha(senhaPura) {
  validarSenha(senhaPura);
  return bcrypt.hash(senhaPura, SALT_ROUNDS);
}

/**
 * Compara uma senha em texto puro com um hash bcrypt salvo no banco de dados.
 * @param {string} senhaPura
 * @param {string} senhaHash
 * @returns {Promise<boolean>}
 */
async function verificarSenha(senhaPura, senhaHash) {
  if (!senhaPura || !senhaHash) return false;
  return bcrypt.compare(String(senhaPura), String(senhaHash));
}

/**
 * Gera um token JWT assinado contendo a identidade e perfil do usuário.
 * @param {object} usuario
 * @returns {string} Token JWT
 */
function gerarToken(usuario) {
  const payload = {
    sub: usuario.id,
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: usuario.tipo,
    cargo: usuario.cargo || null,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Decodifica e valida um token JWT.
 * @param {string} token
 * @returns {object} Payload decodificado
 */
function verificarToken(token) {
  if (!token || typeof token !== 'string') {
    throw erroNaoAutorizado('Token de autenticação não fornecido.');
  }

  try {
    return jwt.verify(token.trim(), JWT_SECRET);
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      throw erroNaoAutorizado('Sua sessão expirou. Faça login novamente.');
    }
    throw erroNaoAutorizado('Token de autenticação inválido.');
  }
}

/**
 * Verifica se o tipo de usuário corresponde a um perfil administrativo (funcionário ou admin).
 * @param {object} usuario
 * @returns {boolean}
 */
function usuarioEhAdminOuFuncionario(usuario) {
  if (!usuario) return false;
  return usuario.tipo === 'admin' || usuario.tipo === 'funcionario';
}

/**
 * Autentica um usuário (Cliente ou Administrador/Funcionário) usando E-mail ou Telefone + Senha.
 *
 * @param {object} credenciais
 * @param {string} [credenciais.identificador] - E-mail ou telefone (também aceita `email` ou `telefone`)
 * @param {string} [credenciais.email]
 * @param {string} [credenciais.telefone]
 * @param {string} credenciais.senha
 * @param {boolean} [credenciais.exigirAdmin=false] - Se true, permite login apenas de funcionários/admins
 * @returns {Promise<{ token: string, usuario: object }>}
 */
async function autenticarUsuario(credenciais = {}) {
  const identificadorBruto =
    credenciais.identificador ||
    credenciais.emailOuTelefone ||
    credenciais.login ||
    credenciais.email ||
    credenciais.telefone;

  const { senha, exigirAdmin = false } = credenciais;

  if (!identificadorBruto) {
    throw erroValidacao('Informe seu e-mail ou telefone.');
  }
  if (!senha) {
    throw erroValidacao('Informe sua senha.');
  }

  const { tipo, valor } = normalizarIdentificadorLogin(identificadorBruto);

  const usuario =
    tipo === 'email'
      ? await repositorio.buscarUsuarioPorEmail(valor)
      : await repositorio.buscarUsuarioPorTelefone(valor);

  if (!usuario) {
    throw erroNaoAutorizado('E-mail/telefone ou senha incorretos.');
  }

  if (usuario.ativo === false) {
    throw erroProibido('Esta conta está inativa. Entre em contato com o estabelecimento.');
  }

  const senhaValida = await verificarSenha(senha, usuario.senha_hash);
  if (!senhaValida) {
    throw erroNaoAutorizado('E-mail/telefone ou senha incorretos.');
  }

  if (exigirAdmin && !usuarioEhAdminOuFuncionario(usuario)) {
    throw erroProibido('Acesso restrito a funcionários e administradores da Cafeteria do João.');
  }

  const agora = new Date().toISOString();
  const usuarioAtualizado =
    (await repositorio.atualizarUsuario(usuario.id, { ultimo_acesso: agora })) || {
      ...usuario,
      ultimo_acesso: agora,
    };

  const token = gerarToken(usuarioAtualizado);
  const usuarioPublico = await enriquecerUsuarioComIndicadores(usuarioAtualizado);

  return {
    token,
    usuario: usuarioPublico,
  };
}

/**
 * Adiciona indicadores de notificação para as bolinhas de alerta do protótipo:
 * - Visão Usuário (Tela 17:132 `Ellipse 1`): `possui_pedido_em_andamento`
 * - Visão Admin (Tela 143:146 `Ellipse 2`): `possui_pedidos_pendentes`
 * @param {object} usuario
 */
async function enriquecerUsuarioComIndicadores(usuario) {
  const base = sanitizarUsuarioPublico(usuario);
  if (!base) return null;

  try {
    const pedidosEmAndamentoCliente = await repositorio.listarPedidos({
      usuarioId: base.id,
      apenasEmAndamento: true,
    });

    base.possui_pedido_em_andamento = pedidosEmAndamentoCliente.length > 0;
    base.quantidade_pedidos_em_andamento = pedidosEmAndamentoCliente.length;

    if (base.eh_admin) {
      const todosPendentes = await repositorio.listarPedidos({ apenasEmAndamento: true });
      base.possui_pedidos_pendentes = todosPendentes.length > 0;
      base.total_pedidos_pendentes = todosPendentes.length;
    }
  } catch {
    base.possui_pedido_em_andamento = false;
    base.quantidade_pedidos_em_andamento = 0;
  }

  return base;
}

/**
 * Recupera os dados atualizados do usuário autenticado a partir do seu ID.
 * @param {number|string} usuarioId
 * @returns {Promise<object>}
 */
async function obterUsuarioAutenticado(usuarioId) {
  const usuario = await repositorio.buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }
  if (usuario.ativo === false) {
    throw erroProibido('Conta de usuário desativada.');
  }
  return enriquecerUsuarioComIndicadores(usuario);
}

/**
 * Permite ao usuário redefinir sua senha ("Esqueceu sua senha?" - tela 82:113 do Figma)
 * confirmando seu E-mail + Telefone cadastrado + Nova Senha.
 *
 * @param {object} dados
 * @param {string} dados.email
 * @param {string} dados.telefone
 * @param {string} dados.novaSenha
 * @param {string} [dados.confirmarSenha]
 */
async function redefinirSenhaPorConfirmacao(dados = {}) {
  const email = validarEmail(dados.email);
  const telefone = validarTelefone(dados.telefone, true);
  const novaSenha = dados.novaSenha || dados.senha;
  const confirmarSenha =
    dados.confirmarSenha !== undefined ? dados.confirmarSenha : dados.confirmar_senha;

  validarSenha(novaSenha, confirmarSenha);

  const usuario = await repositorio.buscarUsuarioPorEmail(email);
  const telCadastrado = usuario ? String(usuario.telefone || '').replace(/\D/g, '') : '';

  if (!usuario || telCadastrado !== telefone) {
    throw erroNaoAutorizado(
      'Não foi possível validar os dados informados. Verifique seu e-mail e telefone cadastrados.'
    );
  }

  if (usuario.ativo === false) {
    throw erroProibido('Esta conta está inativa.');
  }

  const novoHash = await gerarHashSenha(novaSenha);
  await repositorio.atualizarUsuario(usuario.id, { senha_hash: novoHash });

  return {
    redefinida: true,
    email: usuario.email,
  };
}

module.exports = {
  sanitizarUsuarioPublico,
  enriquecerUsuarioComIndicadores,
  gerarHashSenha,
  verificarSenha,
  gerarToken,
  verificarToken,
  usuarioEhAdminOuFuncionario,
  autenticarUsuario,
  obterUsuarioAutenticado,
  redefinirSenhaPorConfirmacao,
};
