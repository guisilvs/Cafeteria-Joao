/**
 * @file connection.js
 * @description Gerencia a conexão com o PostgreSQL local, criação automática do banco,
 * execução automática do `schema.sql` (tabelas e colunas) e criação do usuário `Admin` padrão.
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

/**
 * Caso o banco de dados configurado em `DB_NAME` (ex: `cafeteria`) ainda não tenha sido
 * criado manualmente no pgAdmin, conecta no banco padrão `postgres` e o cria automaticamente.
 */
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
 * Executa o `schema.sql` e aplica migrações não-destrutivas (`ADD COLUMN IF NOT EXISTS`).
 */
async function garantirTabelasEColunas() {
  const caminhoSchema = path.resolve(__dirname, 'schema.sql');
  const sqlSchema = fs.readFileSync(caminhoSchema, 'utf-8');
  await pool.query(sqlSchema);

  await pool.query(`
    ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
    ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE Produto ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '';
    ALTER TABLE Produto ADD COLUMN IF NOT EXISTS foto_webp TEXT;
    ALTER TABLE Produto ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE Produto ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS login VARCHAR(80);
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS cargo VARCHAR(80);
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS foto_webp TEXT;
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS precisa_trocar_senha BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS favoritos JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS numero INTEGER;
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS cliente_foto TEXT;
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS unidade_retirada VARCHAR(120) NOT NULL DEFAULT 'Shopping Beira Mar';
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS previsao_minutos INTEGER NOT NULL DEFAULT 5;
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS observacoes TEXT;
    ALTER TABLE Pedido ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMP;
  `);
}

/**
 * Garante a existência do usuário Administrador padrão (`Admin` / `123456`)
 * e das categorias/produtos iniciais com fotos `.webp` caso o banco esteja vazio.
 */
async function garantirDadosIniciais() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  const fotosIniciais = carregarFotosIniciaisWebp();

  // 1. Verifica se já existe algum administrador ou usuário "Admin"
  const adminCheck = await pool.query(
    `SELECT id FROM Usuario WHERE LOWER(COALESCE(login, '')) = 'admin' OR LOWER(nome) = 'admin' OR tipo = 'admin' LIMIT 1`
  );

  if (adminCheck.rowCount === 0) {
    const loginPadrao = process.env.ADMIN_DEFAULT_LOGIN || 'Admin';
    const senhaPadrao = process.env.ADMIN_DEFAULT_PASSWORD || '123456';
    const senhaHash = await bcrypt.hash(senhaPadrao, saltRounds);

    await pool.query(
      `INSERT INTO Usuario (login, nome, email, telefone, senha_hash, tipo, cargo, foto_webp, ativo, precisa_trocar_senha, favoritos)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'Administrador', $6, TRUE, TRUE, '[]'::jsonb)`,
      [loginPadrao, 'Admin', 'admin@cafeteriajoao.com', '48999990000', senhaHash, fotosIniciais.perfil]
    );
    console.log(
      `🔐 [PostgreSQL] Usuário administrador padrão criado -> Login: "${loginPadrao}" | Senha inicial: "${senhaPadrao}"`
    );
  }

  // Garante também o funcionário de exemplo do Figma (Lucas Sales - Atendimento) se não existir
  const funcCheck = await pool.query(`SELECT id FROM Usuario WHERE LOWER(email) = 'lucas@cafeteriajoao.com' LIMIT 1`);
  if (funcCheck.rowCount === 0) {
    const senhaHash = await bcrypt.hash('123456', saltRounds);
    await pool.query(
      `INSERT INTO Usuario (login, nome, email, telefone, senha_hash, tipo, cargo, foto_webp, ativo, precisa_trocar_senha, favoritos)
       VALUES ('lucas', 'Lucas Sales', 'lucas@cafeteriajoao.com', '48999990002', $1, 'funcionario', 'Atendimento', $2, TRUE, FALSE, '[]'::jsonb)`,
      [senhaHash, fotosIniciais.perfil]
    );
  }

  // 2. Se não houver nenhuma categoria cadastrada ainda, insere o cardápio inicial do protótipo
  const catCheck = await pool.query('SELECT COUNT(*)::int AS total FROM Categoria');
  if (catCheck.rows[0].total === 0) {
    const c1 = await pool.query(
      `INSERT INTO Categoria (nome, slug, ordem, ativo) VALUES ('Gelados', 'gelados', 1, TRUE) RETURNING id`
    );
    const c2 = await pool.query(
      `INSERT INTO Categoria (nome, slug, ordem, ativo) VALUES ('Quentes', 'quentes', 2, TRUE) RETURNING id`
    );
    const c3 = await pool.query(
      `INSERT INTO Categoria (nome, slug, ordem, ativo) VALUES ('Sanduiches', 'sanduiches', 3, TRUE) RETURNING id`
    );

    const idGelados = c1.rows[0].id;
    const idQuentes = c2.rows[0].id;
    const idSanduiches = c3.rows[0].id;

    const produtosIniciais = [
      [idGelados, 'Café com Baunilha', 'Um delicioso café gelado com creme de baunilha e canela em pó.', 10.90],
      [idGelados, 'Matcha', 'Matcha, leite e gelo. Super refrescante. Perfeito para o verão.', 12.90],
      [idGelados, 'Café Gelado', 'Delicioso café torra média, filtrado e muito gelado.', 12.90],
      [idGelados, 'Latte Gelado', 'Um mix de especiarias como canela, erva doce, pimenta preta, cravo e anis.', 19.00],
      [idQuentes, 'Espresso Duplo', 'Espresso duplo. Essencial para começar o dia, café torra clara.', 9.00],
      [idQuentes, 'Café com Leite', 'Um clássico brasileiro. Café coado e leite quente na medida certa.', 12.90],
      [idQuentes, 'Matcha Quente', 'Matcha, leite e baunilha. Um abraço quente de sabor.', 12.90],
      [idQuentes, 'Café com leite Mini', 'Uma dose de espresso com um pouco de leite. Para quem tem pressa.', 10.00],
      [idSanduiches, 'Sanduiche Clássico', 'Pão, queijo, presunto e tomates cerejas. Um clássico da culinária.', 18.75],
      [idSanduiches, 'Queijo Quente', 'Pão torradinho, duas fatias de queijo prato e um toque de manteiga.', 12.90],
      [idSanduiches, 'Misto Quente', 'Pão, queijo e presunto quentinhos. Tão clássico quanto o Sanduiche Clássico.', 12.90],
      [idSanduiches, 'Misto Pão de Queijo', 'Um misto quente diferente. Pão de queijo, presunto e uma fatia de queijo.', 14.00],
    ];

    for (const [catId, nome, descricao, preco] of produtosIniciais) {
      const fotoWebp = (fotosIniciais.produtos && fotosIniciais.produtos[nome]) || null;
      await pool.query(
        `INSERT INTO Produto (categoria_id, nome, descricao, preco, foto_webp, oculto) VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [catId, nome, descricao, preco, fotoWebp]
      );
    }
    console.log('☕ [PostgreSQL] Categorias e Produtos iniciais do cardápio populados com sucesso!');
  } else if (fotosIniciais.produtos) {
    // Preenche fotos .webp nos produtos existentes que ainda estejam sem foto
    for (const [nome, fotoWebp] of Object.entries(fotosIniciais.produtos)) {
      await pool.query(
        `UPDATE Produto SET foto_webp = $1 WHERE nome = $2 AND (foto_webp IS NULL OR foto_webp = '')`,
        [fotoWebp, nome]
      );
    }
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
      `✅ [PostgreSQL] Conectado com sucesso ao banco "${process.env.DB_NAME || 'cafeteria'}" em ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432} (pronto para visualização no pgAdmin).`
    );
    return true;
  } catch (erro) {
    bancoConectado = false;
    ultimoErroConexao = erro.message;
    console.warn(
      `⚠️  [PostgreSQL] Não foi possível conectar ao PostgreSQL local (${erro.message}). Verifique DB_PASSWORD no arquivo backend/.env. Usando fallback em memória temporariamente.`
    );
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
  estaConectadoAoPostgres,
  obterUltimoErroPostgres,
};
