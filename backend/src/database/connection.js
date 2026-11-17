/**
 * @file connection.js
 * @description Gerencia a conexão com o PostgreSQL local, criação automática do banco,
 * execução do `schema.sql` oficial (8 tabelas: Cliente, Funcionario, Categoria, Produto,
 * Pedido, Item_Pedido, Pagamento, Favorito) e seed inicial com imagens `.webp`.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const pool = require('../db');

let bancoConectado = false;
let ultimoErroConexao = null;

function carregarFotosIniciaisWebp() {
  try {
    const caminho = path.resolve(__dirname, 'fotosIniciaisWebp.json');
    if (fs.existsSync(caminho)) {
      return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
    }
  } catch {
    // Ignora caso o arquivo de cache não exista
  }
  return { produtos: {}, perfil: null };
}

async function garantirDatabaseExistente() {
  const nomeBanco = (process.env.DB_NAME || 'cafeteria').replace(/[^a-zA-Z0-9_]/g, '');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres',
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${nomeBanco}"`);
      console.log(`🗄️  [PostgreSQL] Banco de dados "${nomeBanco}" criado automaticamente!`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Executa o `schema.sql` oficial de 8 tabelas e garante todas as colunas complementares.
 */
async function garantirTabelasEColunas() {
  // Verifica se existiam tabelas antigas (sem a coluna id_categoria da modelagem oficial)
  const checkColunaModelagem = await pool.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categoria'
      AND column_name = 'id_categoria'
  `);

  const checkTabelaAntiga = await pool.query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'categoria'
  `);

  if (checkTabelaAntiga.rowCount > 0 && checkColunaModelagem.rowCount === 0) {
    console.log('🔄 [PostgreSQL] Migrando para a modelagem oficial de 8 tabelas...');
    await pool.query(`
      DROP TABLE IF EXISTS sacola_item CASCADE;
      DROP TABLE IF EXISTS favorito CASCADE;
      DROP TABLE IF EXISTS pagamento CASCADE;
      DROP TABLE IF EXISTS item_pedido CASCADE;
      DROP TABLE IF EXISTS pedido CASCADE;
      DROP TABLE IF EXISTS produto CASCADE;
      DROP TABLE IF EXISTS categoria CASCADE;
      DROP TABLE IF EXISTS usuario CASCADE;
      DROP TABLE IF EXISTS cliente CASCADE;
      DROP TABLE IF EXISTS funcionario CASCADE;
    `);
  }

  const caminhoSchema = path.resolve(__dirname, 'schema.sql');
  const sqlSchema = fs.readFileSync(caminhoSchema, 'utf-8');
  await pool.query(sqlSchema);

  // Garante colunas complementares caso as tabelas já tivessem sido criadas manualmente no pgAdmin
  await pool.query(`
    ALTER TABLE Cliente ADD COLUMN IF NOT EXISTS Foto_url TEXT;
    ALTER TABLE Cliente ADD COLUMN IF NOT EXISTS Ativo BOOLEAN DEFAULT TRUE;
    ALTER TABLE Cliente ADD COLUMN IF NOT EXISTS Ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE Funcionario ADD COLUMN IF NOT EXISTS Email VARCHAR(100);
    ALTER TABLE Funcionario ADD COLUMN IF NOT EXISTS Telefone VARCHAR(20);
    ALTER TABLE Funcionario ADD COLUMN IF NOT EXISTS Foto_url TEXT;
    ALTER TABLE Funcionario ADD COLUMN IF NOT EXISTS Precisa_trocar_senha BOOLEAN DEFAULT FALSE;
    ALTER TABLE Funcionario ADD COLUMN IF NOT EXISTS Ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS Unidade_retirada VARCHAR(100) DEFAULT 'Shopping Beira Mar';
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS Previsao_minutos INT DEFAULT 5;
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS Observacoes VARCHAR(255);
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS Data_finalizacao TIMESTAMP;
  `);

  // Ajusta sequências para evitar colisão numérica entre id_funcionario (1..99) e id_cliente (101+)
  // e manter os números de pedido a partir de #52679 conforme o protótipo do Figma
  await pool.query(`
    DO $$
    BEGIN
      IF (SELECT COALESCE(MAX(id_cliente), 0) FROM Cliente) < 100 THEN
        PERFORM setval(pg_get_serial_sequence('cliente', 'id_cliente'), 100, true);
      END IF;
      IF (SELECT COALESCE(MAX(id_pedido), 0) FROM Pedido) < 52678 THEN
        PERFORM setval(pg_get_serial_sequence('pedido', 'id_pedido'), 52678, true);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;
  `);
}

/**
 * Popula as fotos `.webp` nos 12 produtos, cria o funcionário `Admin` (`123456`),
 * o funcionário `Lucas Sales`, o cliente `Guilherme Silveira` e os pedidos iniciais.
 */
async function garantirDadosIniciais() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  const fotosIniciais = carregarFotosIniciaisWebp();
  const mapaFotos = fotosIniciais.produtos || {};

  // 1. Atualiza as fotos .webp nos 12 produtos da tabela Produto
  const aliasesNomes = {
    'Café com Leite Mini': 'Café com leite Mini',
    'Sanduiche Classico': 'Sanduiche Clássico',
  };

  const todosProdutos = await pool.query('SELECT id_produto, Nome, Imagem_url FROM Produto');
  for (const prod of todosProdutos.rows) {
    if (!prod.imagem_url) {
      const chaveFoto = mapaFotos[prod.nome] ? prod.nome : aliasesNomes[prod.nome];
      const fotoWebp = chaveFoto ? mapaFotos[chaveFoto] : null;
      if (fotoWebp) {
        await pool.query('UPDATE Produto SET Imagem_url = $1 WHERE id_produto = $2', [
          fotoWebp,
          prod.id_produto,
        ]);
      }
    }
  }

  // 2. Garante o funcionário padrão Admin (Senha: 123456) na tabela Funcionario
  const adminCheck = await pool.query(
    `SELECT id_funcionario FROM Funcionario WHERE LOWER(Nome) = 'admin' OR LOWER(COALESCE(Cargo, '')) LIKE '%admin%' LIMIT 1`
  );

  let idAdmin = adminCheck.rows[0]?.id_funcionario;
  if (!idAdmin) {
    const senhaPadrao = process.env.ADMIN_DEFAULT_PASSWORD || '123456';
    const senhaHash = await bcrypt.hash(senhaPadrao, saltRounds);
    const insAdmin = await pool.query(
      `INSERT INTO Funcionario (Nome, CPF, Cargo, Ativo, Senha_acesso, Email, Telefone, Foto_url, Precisa_trocar_senha)
       VALUES ('Admin', '000.000.000-01', 'Administrador', TRUE, $1, 'admin@cafeteriajoao.com', '48999990000', $2, TRUE)
       ON CONFLICT (CPF) DO UPDATE SET Nome = EXCLUDED.Nome
       RETURNING id_funcionario`,
      [senhaHash, fotosIniciais.perfil]
    );
    idAdmin = insAdmin.rows[0].id_funcionario;
    console.log('🔐 [PostgreSQL] Funcionário padrão "Admin" (senha: 123456) garantido na tabela Funcionario!');
  }

  // 3. Garante o funcionário Lucas Sales (Atendimento) do protótipo do Figma
  const lucasCheck = await pool.query(
    `SELECT id_funcionario FROM Funcionario WHERE LOWER(Nome) = 'lucas sales' OR CPF = '000.000.000-02' LIMIT 1`
  );
  if (lucasCheck.rowCount === 0) {
    const senhaHash = await bcrypt.hash('123456', saltRounds);
    await pool.query(
      `INSERT INTO Funcionario (Nome, CPF, Cargo, Ativo, Senha_acesso, Email, Telefone, Foto_url, Precisa_trocar_senha)
       VALUES ('Lucas Sales', '000.000.000-02', 'Atendimento', TRUE, $1, 'lucas@cafeteriajoao.com', '48999990002', $2, FALSE)`,
      [senhaHash, fotosIniciais.perfil]
    );
  }

  // 4. Garante o cliente de exemplo Guilherme Silveira na tabela Cliente
  const cliCheck = await pool.query(
    `SELECT id_cliente FROM Cliente WHERE LOWER(Email) = 'guilherme@cafeteriajoao.com' LIMIT 1`
  );
  let idClienteExemplo = cliCheck.rows[0]?.id_cliente;
  if (!idClienteExemplo) {
    const senhaHash = await bcrypt.hash('123456', saltRounds);
    const insCli = await pool.query(
      `INSERT INTO Cliente (Nome, Telefone, CPF, Email, Data_nascimento, Senha_cliente, Foto_url, Ativo)
       VALUES ('Guilherme Silveira', '48999990001', '111.222.333-44', 'guilherme@cafeteriajoao.com', '2002-05-10', $1, $2, TRUE)
       RETURNING id_cliente`,
      [senhaHash, fotosIniciais.perfil]
    );
    idClienteExemplo = insCli.rows[0].id_cliente;

    // Favoritos iniciais na tabela Favorito (Matcha=2, Espresso Duplo=5, Sanduiche Classico=9, Misto Pão de Queijo=12)
    for (const idProd of [2, 5, 9, 12]) {
      await pool.query(
        `INSERT INTO Favorito (id_cliente, id_produto) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [idClienteExemplo, idProd]
      );
    }
  }

  // 5. Garante os pedidos iniciais do protótipo (#52679 Finalizado e #52680 Preparando) nas tabelas Pedido, Item_Pedido e Pagamento
  const pedCheck = await pool.query('SELECT COUNT(*)::int AS total FROM Pedido');
  if (pedCheck.rows[0].total === 0 && idClienteExemplo && idAdmin) {
    // Pedido #52679 (Finalizado)
    const p1 = await pool.query(
      `INSERT INTO Pedido (id_pedido, id_cliente, id_funcionario, Data_hora, Status_pedido, Valor_total, Unidade_retirada, Previsao_minutos, Data_finalizacao)
       VALUES (52679, $1, $2, '2026-05-10 10:05:00', 'concluido', 23.80, 'Shopping Beira Mar', 5, '2026-05-10 10:12:00')
       RETURNING id_pedido`,
      [idClienteExemplo, idAdmin]
    );
    await pool.query(
      `INSERT INTO Item_Pedido (id_pedido, id_produto, Quantidade, Preco_unitario) VALUES
       ($1, 1, 1, 10.90),
       ($1, 10, 1, 12.90)`,
      [p1.rows[0].id_pedido]
    );
    await pool.query(
      `INSERT INTO Pagamento (id_pedido, Metodo_pagamento, Status_pagamento, Valor)
       VALUES ($1, 'Retirada no Balcão', 'Concluído', 23.80)`,
      [p1.rows[0].id_pedido]
    );

    // Pedido #52680 (Preparando)
    const p2 = await pool.query(
      `INSERT INTO Pedido (id_pedido, id_cliente, id_funcionario, Status_pedido, Valor_total, Unidade_retirada, Previsao_minutos)
       VALUES (52680, $1, $2, 'preparando', 37.80, 'Shopping Beira Mar', 5)
       RETURNING id_pedido`,
      [idClienteExemplo, idAdmin]
    );
    await pool.query(
      `INSERT INTO Item_Pedido (id_pedido, id_produto, Quantidade, Preco_unitario) VALUES
       ($1, 1, 1, 10.90),
       ($1, 10, 1, 12.90),
       ($1, 12, 1, 14.00)`,
      [p2.rows[0].id_pedido]
    );
    await pool.query(
      `INSERT INTO Pagamento (id_pedido, Metodo_pagamento, Status_pagamento, Valor)
       VALUES ($1, 'Retirada no Balcão', 'Aguardando Retirada', 37.80)`,
      [p2.rows[0].id_pedido]
    );

    await pool.query(
      `SELECT setval(pg_get_serial_sequence('pedido', 'id_pedido'), COALESCE((SELECT MAX(id_pedido) FROM Pedido), 52680))`
    );
  }
}

async function inicializarBancoDeDados() {
  try {
    try {
      await pool.query('SELECT 1');
    } catch (erroInicial) {
      if (erroInicial && erroInicial.code === '3D000') {
        await garantirDatabaseExistente();
      } else {
        throw erroInicial;
      }
    }

    await garantirTabelasEColunas();
    await garantirDadosIniciais();

    bancoConectado = true;
    ultimoErroConexao = null;
    console.log(
      `✅ [PostgreSQL] Conectado com sucesso ao banco "${process.env.DB_NAME || 'cafeteria'}" (8 tabelas relacionais ativas no pgAdmin).`
    );
    return true;
  } catch (erro) {
    bancoConectado = false;
    ultimoErroConexao = erro.message;
    console.warn(`⚠️  [PostgreSQL] Não conectado no banco de dados (${erro.message}).`);
    return false;
  }
}

/**
 * Verifica ativamente a conexão com o PostgreSQL.
 */
async function verificarConexaoAtiva() {
  try {
    await pool.query('SELECT 1');
    bancoConectado = true;
    ultimoErroConexao = null;
    return true;
  } catch (erro) {
    bancoConectado = false;
    ultimoErroConexao = erro.message;
    return false;
  }
}

function estaConectadoAoPostgres() {
  return bancoConectado;
}

function obterUltimoErroPostgres() {
  return ultimoErroConexao;
}

module.exports = {
  pool,
  inicializarBancoDeDados,
  verificarConexaoAtiva,
  estaConectadoAoPostgres,
  obterUltimoErroPostgres,
};
