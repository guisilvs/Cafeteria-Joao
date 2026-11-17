/**
 * @file modelMapper.js
 * @description Camada tradutora entre a Modelagem Relacional de 8 Tabelas do PostgreSQL
 * (`Cliente`, `Funcionario`, `Categoria`, `Produto`, `Pedido`, `Item_Pedido`, `Pagamento`, `Favorito`)
 * e o domínio da aplicação (`core/` e `api/`).
 */

function gerarSlug(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formata ou gera um CPF único no padrão `XXX.XXX.XXX-XX` (14 caracteres)
 * para atender à restrição `CPF VARCHAR(14) UNIQUE NOT NULL` das tabelas `Cliente` e `Funcionario`.
 */
function normalizarOuGerarCpf(cpfInformado, sementeUnica = '') {
  const apenasDigitos = String(cpfInformado || '').replace(/\D/g, '');
  if (apenasDigitos.length === 11) {
    return `${apenasDigitos.slice(0, 3)}.${apenasDigitos.slice(3, 6)}.${apenasDigitos.slice(6, 9)}-${apenasDigitos.slice(9, 11)}`;
  }

  // Gera 11 dígitos determinísticos/únicos caso o formulário simplificado do Figma não envie CPF
  const baseNumerica = (
    String(sementeUnica).replace(/\D/g, '') +
    String(Date.now()) +
    String(Math.floor(Math.random() * 899 + 100))
  ).slice(-11).padStart(11, '0');

  return `${baseNumerica.slice(0, 3)}.${baseNumerica.slice(3, 6)}.${baseNumerica.slice(6, 9)}-${baseNumerica.slice(9, 11)}`;
}

function mapearCategoriaDoBanco(row) {
  if (!row) return null;
  const id = Number(row.id_categoria ?? row.id);
  const nome = row.nome || row.Nome;
  const ordem = Number(row.ordem_exibicao ?? row.Ordem_exibicao ?? row.ordem ?? id);
  const ativo = (row.ativo ?? row.Ativo) !== false;

  return {
    id,
    id_categoria: id,
    nome,
    slug: gerarSlug(nome),
    ordem,
    ordem_exibicao: ordem,
    ativo,
  };
}

function mapearProdutoDoBanco(row) {
  if (!row) return null;
  const id = Number(row.id_produto ?? row.id);
  const categoriaId = Number(row.id_categoria ?? row.categoria_id);
  const nome = row.nome || row.Nome;
  const descricao = row.descricao ?? row.Descricao ?? '';
  const preco = Number(row.preco ?? row.Preco ?? 0);
  const imagem = row.imagem_url ?? row.Imagem_url ?? row.foto_webp ?? null;
  const oculto = Boolean(row.oculto ?? row.Oculto ?? false);

  return {
    id,
    id_produto: id,
    categoria_id: categoriaId,
    id_categoria: categoriaId,
    categoria_nome: row.categoria_nome || null,
    nome,
    descricao,
    preco,
    foto_webp: imagem,
    imagem_url: imagem,
    oculto,
  };
}

function mapearClienteDoBanco(row, idsFavoritos = []) {
  if (!row) return null;
  const id = Number(row.id_cliente ?? row.id);
  const nome = row.nome || row.Nome;
  const email = row.email || row.Email;
  const telefone = row.telefone ?? row.Telefone ?? '';
  const cpf = row.cpf || row.CPF || '';

  return {
    id,
    id_cliente: id,
    tabela_origem: 'Cliente',
    login: email,
    nome,
    email,
    telefone,
    cpf,
    data_nascimento: row.data_nascimento || row.Data_nascimento || null,
    senha_hash: row.senha_cliente || row.Senha_cliente,
    tipo: 'cliente',
    cargo: null,
    foto_webp: row.foto_url || row.Foto_url || null,
    ativo: (row.ativo ?? row.Ativo) !== false,
    precisa_trocar_senha: false,
    favoritos: Array.isArray(idsFavoritos) ? idsFavoritos.map(Number) : [],
    ultimo_acesso: row.ultimo_acesso
      ? new Date(row.ultimo_acesso).toISOString()
      : new Date().toISOString(),
  };
}

function mapearFuncionarioDoBanco(row) {
  if (!row) return null;
  const id = Number(row.id_funcionario ?? row.id);
  const nome = row.nome || row.Nome;
  const cargo = row.cargo ?? row.Cargo ?? 'Atendimento';
  const cpf = row.cpf || row.CPF || '';
  const ehAdmin =
    nome.toLowerCase() === 'admin' ||
    String(cargo).toLowerCase().includes('admin') ||
    String(cargo).toLowerCase().includes('operador') ||
    String(cargo).toLowerCase().includes('gerente');

  const emailPadrao = `${gerarSlug(nome).replace(/-/g, '.')}@cafeteriajoao.com`;

  return {
    id,
    id_funcionario: id,
    tabela_origem: 'Funcionario',
    login: nome.toLowerCase() === 'admin' ? 'Admin' : row.email || nome,
    nome,
    email: row.email || row.Email || emailPadrao,
    telefone: row.telefone || row.Telefone || '',
    cpf,
    senha_hash: row.senha_acesso || row.Senha_acesso,
    tipo: ehAdmin ? 'admin' : 'funcionario',
    cargo,
    foto_webp: row.foto_url || row.Foto_url || null,
    ativo: (row.ativo ?? row.Ativo) !== false,
    precisa_trocar_senha: Boolean(row.precisa_trocar_senha ?? row.Precisa_trocar_senha ?? false),
    favoritos: [],
    ultimo_acesso: row.ultimo_acesso
      ? new Date(row.ultimo_acesso).toISOString()
      : new Date().toISOString(),
  };
}

function mapearPedidoDoBanco(row, itensRows = [], pagamentoRow = null) {
  if (!row) return null;
  const id = Number(row.id_pedido ?? row.id);
  const itens = itensRows.map((ir) => {
    const qtd = Number(ir.quantidade ?? ir.Quantidade ?? 1);
    const precoUnit = Number(ir.preco_unitario ?? ir.Preco_unitario ?? 0);
    return {
      id_item: Number(ir.id_item ?? ir.id),
      item_id: Number(ir.id_produto ?? ir.item_id),
      id_produto: Number(ir.id_produto ?? ir.item_id),
      nome: ir.produto_nome || ir.nome || 'Produto',
      descricao: ir.produto_descricao || ir.descricao || '',
      foto_webp: ir.produto_imagem || ir.foto_webp || null,
      preco_unitario: precoUnit,
      quantidade: qtd,
      subtotal: Math.round(precoUnit * qtd * 100) / 100,
      observacoes: ir.observacoes || ir.Observacoes || null,
    };
  });

  const statusBruto = String(row.status_pedido || row.Status_pedido || 'preparando').toLowerCase();

  return {
    id,
    id_pedido: id,
    numero: id,
    usuario_id: Number(row.id_cliente),
    id_cliente: Number(row.id_cliente),
    id_funcionario: Number(row.id_funcionario),
    funcionario_nome: row.funcionario_nome || 'Admin',
    cliente_nome: row.cliente_nome || 'Cliente',
    cliente_foto: row.cliente_foto || null,
    itens,
    total: Number(row.valor_total ?? row.Valor_total ?? 0),
    unidade_retirada: row.unidade_retirada || 'Shopping Beira Mar',
    previsao_minutos: Number(row.previsao_minutos || 5),
    observacoes: row.observacoes || null,
    status: statusBruto,
    criado_em: row.data_hora ? new Date(row.data_hora).toISOString() : new Date().toISOString(),
    finalizado_em: row.data_finalizacao ? new Date(row.data_finalizacao).toISOString() : null,
    pagamento: pagamentoRow
      ? {
          id_pagamento: pagamentoRow.id_pagamento,
          metodo: pagamentoRow.metodo_pagamento,
          status: pagamentoRow.status_pagamento,
          valor: Number(pagamentoRow.valor),
        }
      : null,
  };
}

module.exports = {
  gerarSlug,
  normalizarOuGerarCpf,
  mapearCategoriaDoBanco,
  mapearProdutoDoBanco,
  mapearClienteDoBanco,
  mapearFuncionarioDoBanco,
  mapearPedidoDoBanco,
};
