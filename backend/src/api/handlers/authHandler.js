/**
 * @file authHandler.js
 * @description Handlers da camada de API para Autenticação, Cadastro de Conta,
 * Alteração/Recuperação de Senha e Perfil.
 */

const authCore = require('../../core/authCore');
const clienteCore = require('../../core/clienteCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

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

const alterarSenha = asyncHandler(async (req, res) => {
  const usuario = await authCore.alterarSenhaAutenticado(req.usuario.id, req.body);

  res.status(200).json({
    sucesso: true,
    mensagem: 'Senha alterada com sucesso!',
    usuario,
  });
});

const recuperarSenha = asyncHandler(async (req, res) => {
  const resultado = await authCore.redefinirSenhaPorConfirmacao(req.body);

  res.status(200).json({
    sucesso: true,
    mensagem: 'Senha redefinida com sucesso! Você já pode fazer login com a nova senha.',
    ...resultado,
  });
});

const obterPerfilAtual = asyncHandler(async (req, res) => {
  const usuario = clienteCore.formatarUsuarioParaResposta(req.usuario);
  res.status(200).json({
    sucesso: true,
    usuario,
  });
});

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
  alterarSenha,
  recuperarSenha,
  obterPerfilAtual,
  atualizarPerfilAtual,
  logoutUsuario,
};
