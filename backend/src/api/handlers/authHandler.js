/**
 * @file authHandler.js
 * @description Handlers da camada de API para Autenticação, Cadastro de Conta e Perfil.
 */

const authCore = require('../../core/authCore');
const clienteCore = require('../../core/clienteCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

/**
 * POST /api/auth/registro (ou /api/auth/cadastro)
 * Cria conta de cliente com senha em hash bcrypt e foto opcional comprimida em .webp.
 */
const registrarCliente = asyncHandler(async (req, res) => {
  const fotoEntrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const resultado = await clienteCore.cadastrarCliente({
    ...req.body,
    foto: fotoEntrada,
  });

  res.status(201).json({
    sucesso: true,
    mensagem: 'Conta criada com sucesso! Bem-vindo(a) à Cafeteria do João.',
    ...resultado,
  });
});

/**
 * POST /api/auth/login
 * Realiza login do usuário (aceita E-mail ou Telefone + Senha).
 */
const loginUsuario = asyncHandler(async (req, res) => {
  const resultado = await authCore.autenticarUsuario({
    ...req.body,
    exigirAdmin: false,
  });

  res.status(200).json({
    sucesso: true,
    mensagem: 'Login realizado com sucesso.',
    ...resultado,
  });
});

/**
 * POST /api/auth/admin/login (ou /api/admin/login)
 * Realiza login exclusivo para funcionários e administradores no painel Admin.
 */
const loginAdmin = asyncHandler(async (req, res) => {
  const resultado = await authCore.autenticarUsuario({
    ...req.body,
    exigirAdmin: true,
  });

  res.status(200).json({
    sucesso: true,
    mensagem: `Bem-vindo(a) ao painel administrativo, ${resultado.usuario.nome}.`,
    ...resultado,
  });
});

/**
 * GET /api/auth/me (ou /api/auth/perfil)
 * Retorna os dados do usuário autenticado atual.
 */
const obterPerfilAtual = asyncHandler(async (req, res) => {
  const usuario = clienteCore.formatarUsuarioParaResposta(req.usuario);
  res.status(200).json({
    sucesso: true,
    usuario,
  });
});

/**
 * PUT /api/auth/perfil
 * Permite ao usuário logado atualizar seus próprios dados e foto de perfil (.webp).
 */
const atualizarPerfilAtual = asyncHandler(async (req, res) => {
  const fotoEntrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const usuarioAtualizado = await clienteCore.atualizarUsuarioCore(
    req.usuario.id,
    {
      ...req.body,
      foto: fotoEntrada,
    },
    req.usuario
  );

  res.status(200).json({
    sucesso: true,
    mensagem: 'Perfil atualizado com sucesso.',
    usuario: usuarioAtualizado,
  });
});

/**
 * POST /api/auth/logout
 * Confirma o encerramento da sessão ("Fazer Logoff" nas telas 17:222 e 143:146 do Figma).
 */
const logoutUsuario = asyncHandler(async (_req, res) => {
  res.status(200).json({
    sucesso: true,
    mensagem: 'Logoff realizado com sucesso.',
  });
});

module.exports = {
  registrarCliente,
  loginUsuario,
  loginAdmin,
  obterPerfilAtual,
  atualizarPerfilAtual,
  logoutUsuario,
};
