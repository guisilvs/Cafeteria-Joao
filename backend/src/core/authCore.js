/**
 * @file authCore.js
 * @description Regras de negócio puras de Autenticação e Segurança de Credenciais.
 *
 * Responsabilidades:
 * - Geração de hash de senhas com `bcrypt`
 * - Comparação segura de senhas com hash
 * - Emissão e validação de tokens JWT para sessões de clientes e administradores
 * - Validação de login por Login ("Admin"), E-mail ou Telefone
 * - Alteração da senha padrão do Administrador ("123456") e recuperação de senha
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
 * Remove campos sensíveis (como `senha_hash`) antes de retornar o objeto de usuário para a API.
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
    precisa_trocar_senha: Boolean(dadosSeguros.precisa_trocar_senha),
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
    login: usuario.login || null,
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
 * Autentica um usuário (Cliente ou Administrador/Funcionário) usando Login ("Admin"), E-mail ou Telefone + Senha.
 */
async function autenticarUsuario(credenciais = {}) {
  const identificadorBruto =
    credenciais.identificador ||
    credenciais.emailOuTelefone ||
    credenciais.login ||
    credenciais.usuario ||
    credenciais.email ||
    credenciais.telefone;

  const { senha, exigirAdmin = false } = credenciais;

  if (!identificadorBruto) {
    throw erroValidacao('Informe seu login, e-mail ou telefone.');
  }
  if (!senha) {
    throw erroValidacao('Informe sua senha.');
  }

  if (!repositorio.verificarStatusBanco().postgresConectado) {
    const { AppError } = require('./errosCore');
    throw new AppError('Não conectado no banco de dados', 503, 'BANCO_DESCONECTADO');
  }

  const { tipo, valor } = normalizarIdentificadorLogin(identificadorBruto);

  let usuario = null;
  if (tipo === 'email') {
    usuario = await repositorio.buscarUsuarioPorEmail(valor);
  } else if (tipo === 'telefone') {
    usuario = await repositorio.buscarUsuarioPorTelefone(valor);
  } else {
    usuario = await repositorio.buscarUsuarioPorLogin(valor);
  }

  if (!usuario) {
    throw erroNaoAutorizado('Credenciais incorretas. Verifique seu login/e-mail e senha.');
  }

  if (usuario.ativo === false) {
    throw erroProibido('Esta conta está inativa. Entre em contato com o estabelecimento.');
  }

  const senhaValida = await verificarSenha(senha, usuario.senha_hash);
  if (!senhaValida) {
    throw erroNaoAutorizado('Credenciais incorretas. Verifique seu login/e-mail e senha.');
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
    aviso_troca_senha: usuarioPublico.precisa_trocar_senha
      ? 'Você está utilizando a senha padrão inicial. Recomendamos alterá-la no painel.'
      : null,
  };
}

/**
 * Adiciona indicadores de notificação para as bolinhas de alerta do protótipo.
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
 * Permite que o usuário logado (especialmente o `Admin` padrão com senha inicial `123456`)
 * modifique sua própria senha com segurança.
 */
async function alterarSenhaAutenticado(usuarioId, dados = {}) {
  const usuario = await repositorio.buscarUsuarioPorId(usuarioId);
  if (!usuario) {
    throw erroNaoEncontrado('Usuário');
  }

  const senhaAtual = dados.senhaAtual || dados.senha_atual;
  const novaSenha = dados.novaSenha || dados.nova_senha || dados.senha;
  const confirmarSenha =
    dados.confirmarSenha !== undefined ? dados.confirmarSenha : dados.confirmar_senha;

  if (senhaAtual !== undefined) {
    const confere = await verificarSenha(senhaAtual, usuario.senha_hash);
    if (!confere) {
      throw erroNaoAutorizado('A senha atual informada está incorreta.');
    }
  }

  validarSenha(novaSenha, confirmarSenha);

  const novoHash = await gerarHashSenha(novaSenha);
  const atualizado = await repositorio.atualizarUsuario(usuario.id, {
    senha_hash: novoHash,
    precisa_trocar_senha: false,
  });

  return sanitizarUsuarioPublico(atualizado);
}

/**
 * Permite ao usuário redefinir sua senha ("Esqueceu sua senha?")
 * confirmando seu E-mail + Telefone cadastrado + Nova Senha.
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
  await repositorio.atualizarUsuario(usuario.id, {
    senha_hash: novoHash,
    precisa_trocar_senha: false,
  });

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
  alterarSenhaAutenticado,
  redefinirSenhaPorConfirmacao,
};
