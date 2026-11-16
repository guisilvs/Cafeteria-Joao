/**
 * @file usuarioHandler.js
 * @description Handlers da camada de API para gerenciamento de usuários (Clientes e Funcionários)
 * pelo Administrador (Tela 143:838 "Administrador - usuários" do Figma).
 */

const clienteCore = require('../../core/clienteCore');
const { asyncHandler } = require('../middlewares/errorMiddleware');

/**
 * GET /api/admin/usuarios
 * Lista usuários separados em `internos` (funcionários/admins) e `clientes`,
 * permitindo filtrar por `?tipo=interno|cliente`, `?ativo=true|false`, `?cargo=...`,
 * `?busca=...` e `?ordenar=nome|ultimo_acesso`.
 */
const listarUsuariosAdmin = asyncHandler(async (req, res) => {
  const resultado = await clienteCore.listarUsuariosAdmin({
    tipo: req.query.tipo,
    ativo: req.query.ativo,
    cargo: req.query.cargo,
    busca: req.query.busca,
    ordenar: req.query.ordenar,
  });

  res.status(200).json({
    sucesso: true,
    ...resultado,
  });
});

/**
 * GET /api/admin/usuarios/:id
 * Obtém os dados detalhados de um usuário específico.
 */
const obterUsuarioAdminPorId = asyncHandler(async (req, res) => {
  const usuario = await clienteCore.buscarUsuarioPorIdCore(req.params.id);
  res.status(200).json({
    sucesso: true,
    usuario,
  });
});

/**
 * POST /api/admin/usuarios
 * Cria um novo usuário (cliente ou funcionário/admin) a partir do painel Admin ("Criar novo").
 */
const criarUsuarioAdmin = asyncHandler(async (req, res) => {
  const fotoEntrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const usuario = await clienteCore.criarUsuarioPeloAdmin({
    ...req.body,
    foto: fotoEntrada,
  });

  res.status(201).json({
    sucesso: true,
    mensagem: 'Usuário criado com sucesso.',
    usuario,
  });
});

/**
 * PUT /api/admin/usuarios/:id
 * Atualiza dados de um usuário (cliente ou funcionário) pelo painel Admin.
 */
const atualizarUsuarioAdmin = asyncHandler(async (req, res) => {
  const fotoEntrada = req.arquivoImagemBuffer || req.body.foto || req.body.imagem;
  const usuario = await clienteCore.atualizarUsuarioCore(
    req.params.id,
    {
      ...req.body,
      foto: fotoEntrada,
    },
    req.usuario
  );

  res.status(200).json({
    sucesso: true,
    mensagem: 'Usuário atualizado com sucesso.',
    usuario,
  });
});

/**
 * PATCH /api/admin/usuarios/:id/status
 * Alterna ou define o status Ativo / Inativo de um usuário no painel Admin.
 */
const alterarStatusUsuarioAdmin = asyncHandler(async (req, res) => {
  const ativoDesejado =
    req.body && req.body.ativo !== undefined ? Boolean(req.body.ativo) : undefined;

  const usuario = await clienteCore.alterarStatusUsuarioCore(
    req.params.id,
    ativoDesejado,
    req.usuario
  );

  res.status(200).json({
    sucesso: true,
    mensagem: `Status do usuário "${usuario.nome}" alterado para ${usuario.status_label}.`,
    usuario,
  });
});

/**
 * DELETE /api/admin/usuarios/:id
 * Remove um usuário do sistema.
 */
const removerUsuarioAdmin = asyncHandler(async (req, res) => {
  const resultado = await clienteCore.removerUsuarioCore(req.params.id, req.usuario);
  res.status(200).json({
    sucesso: true,
    mensagem: 'Usuário removido com sucesso.',
    ...resultado,
  });
});

module.exports = {
  listarUsuariosAdmin,
  obterUsuarioAdminPorId,
  criarUsuarioAdmin,
  atualizarUsuarioAdmin,
  alterarStatusUsuarioAdmin,
  removerUsuarioAdmin,
};
