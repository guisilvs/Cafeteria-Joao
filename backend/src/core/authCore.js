/**
 * @file authCore.js
 * @description Regras de negócio puras de Autenticação e Segurança de Credenciais.
 *
 * Responsabilidades:
 * - Geração de hash de senhas com `bcrypt`
 * - Comparação segura de senhas com hash
 * - Emissão e validação de tokens JWT para sessões de clientes e administradores
 * - Validação de login por E-mail ou Telefone (conforme protótipo do Figma)
 * - Verificação de permissões de acesso (Cliente vs Funcionário/Admin)
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const repositorio = require('./repositorioCore');
const {
  normalizarIdentificadorLogin,
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
 * Remove campos sensíveis (como `senha_hash`) antes de retornar o objeto de usuário para a API.
 * @param {object} usuario
 * @returns {object|null}
 */
function sanitizarUsuarioPublico(usuario) {
  if (!usuario) return null;
  const { senha_hash, senha, ...dadosSeguros } = usuario;
  return {
    ...dadosSeguros,
    eh_admin: dadosSeguros.tipo === 'admin' || dadosSeguros.tipo === 'funcionario',
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

  return {
    token,
    usuario: sanitizarUsuarioPublico(usuarioAtualizado),
  };
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
  return sanitizarUsuarioPublico(usuario);
}

module.exports = {
  sanitizarUsuarioPublico,
  gerarHashSenha,
  verificarSenha,
  gerarToken,
  verificarToken,
  usuarioEhAdminOuFuncionario,
  autenticarUsuario,
  obterUsuarioAutenticado,
};
