-- ============================================================================
-- SCHEMA SQL — CAFETERIA DO JOÃO (PostgreSQL / pgAdmin)
-- ============================================================================
-- Este script é executado automaticamente na inicialização do Back-end
-- (e também pode ser executado manualmente no Query Tool do pgAdmin).
-- ============================================================================

-- 1. Tabela de Categorias de Produtos
CREATE TABLE IF NOT EXISTS Categoria (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(100),
    ordem INTEGER NOT NULL DEFAULT 1,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Produtos do Cardápio (Todo produto pertence obrigatoriamente a uma Categoria)
CREATE TABLE IF NOT EXISTS Produto (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES Categoria(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    nome VARCHAR(120) NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    preco NUMERIC(10, 2) NOT NULL CHECK (preco > 0),
    foto_webp TEXT,
    oculto BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Usuários (Clientes, Funcionários e Administrador Padrão)
CREATE TABLE IF NOT EXISTS Usuario (
    id SERIAL PRIMARY KEY,
    login VARCHAR(80) UNIQUE,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefone VARCHAR(30),
    senha_hash TEXT NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente', 'funcionario', 'admin')),
    cargo VARCHAR(80),
    foto_webp TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    precisa_trocar_senha BOOLEAN NOT NULL DEFAULT FALSE,
    favoritos JSONB NOT NULL DEFAULT '[]'::jsonb,
    ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Carrinho / Sacola Temporária do Usuário
CREATE TABLE IF NOT EXISTS Sacola_Item (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES Usuario(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES Produto(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, produto_id)
);

-- 5. Tabela de Pedidos (Modificáveis pelo Administrador)
CREATE TABLE IF NOT EXISTS Pedido (
    id SERIAL PRIMARY KEY,
    numero INTEGER UNIQUE,
    usuario_id INTEGER NOT NULL REFERENCES Usuario(id) ON DELETE RESTRICT,
    cliente_nome VARCHAR(120) NOT NULL,
    cliente_foto TEXT,
    itens JSONB NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    unidade_retirada VARCHAR(120) NOT NULL DEFAULT 'Shopping Beira Mar',
    previsao_minutos INTEGER NOT NULL DEFAULT 5,
    observacoes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'preparando' CHECK (status IN ('pendente', 'preparando', 'concluido', 'cancelado')),
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizado_em TIMESTAMP
);

-- Garante que a sequência de IDs de Pedido comece em 52680 (padrão visual do protótipo)
DO $$
BEGIN
    IF (SELECT COALESCE(MAX(id), 0) FROM Pedido) < 52675 THEN
        PERFORM setval(pg_get_serial_sequence('Pedido', 'id'), 52675, false);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
