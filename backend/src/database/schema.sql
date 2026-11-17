-- ============================================================================
-- SCHEMA OFICIAL — CAFETERIA DO JOÃO (PostgreSQL / pgAdmin)
-- Baseado na Modelagem Relacional do Banco de Dados do Projeto
-- ============================================================================

-- 1. Tabelas Independentes (Não possuem Chaves Estrangeiras)

CREATE TABLE IF NOT EXISTS Cliente (
    id_cliente SERIAL PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL,
    Telefone VARCHAR(20),
    CPF VARCHAR(14) UNIQUE NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Data_nascimento DATE,
    Senha_cliente VARCHAR(255) NOT NULL,
    Foto_url TEXT,
    Ativo BOOLEAN DEFAULT TRUE,
    Ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Funcionario (
    id_funcionario SERIAL PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL,
    CPF VARCHAR(14) UNIQUE NOT NULL,
    Cargo VARCHAR(50),
    Ativo BOOLEAN DEFAULT TRUE,
    Senha_acesso VARCHAR(255) NOT NULL,
    Email VARCHAR(100),
    Telefone VARCHAR(20),
    Foto_url TEXT,
    Precisa_trocar_senha BOOLEAN DEFAULT FALSE,
    Ultimo_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Categoria (
    id_categoria SERIAL PRIMARY KEY,
    Nome VARCHAR(100) UNIQUE NOT NULL,
    Ordem_exibicao INT,
    Ativo BOOLEAN DEFAULT TRUE
);

-- 2. Tabelas com Dependências Nível 1

CREATE TABLE IF NOT EXISTS Produto (
    id_produto SERIAL PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL,
    Descricao VARCHAR(255),
    Preco DECIMAL(10,2) NOT NULL,
    Imagem_url TEXT,
    Oculto BOOLEAN DEFAULT FALSE,
    id_categoria INT NOT NULL,
    FOREIGN KEY (id_categoria) REFERENCES Categoria(id_categoria)
);

CREATE TABLE IF NOT EXISTS Pedido (
    id_pedido SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_funcionario INT NOT NULL,
    Data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Status_pedido VARCHAR(50) NOT NULL,
    Valor_total DECIMAL(10,2) NOT NULL,
    Unidade_retirada VARCHAR(100) DEFAULT 'Shopping Beira Mar',
    Previsao_minutos INT DEFAULT 5,
    Observacoes VARCHAR(255),
    Data_finalizacao TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
    FOREIGN KEY (id_funcionario) REFERENCES Funcionario(id_funcionario)
);

-- 3. Tabelas com Dependências Nível 2 (Associativas e Finais)

CREATE TABLE IF NOT EXISTS Item_Pedido (
    id_item SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_produto INT NOT NULL,
    Quantidade INT NOT NULL,
    Preco_unitario DECIMAL(10,2) NOT NULL,
    Observacoes VARCHAR(255),
    FOREIGN KEY (id_pedido) REFERENCES Pedido(id_pedido),
    FOREIGN KEY (id_produto) REFERENCES Produto(id_produto)
);

CREATE TABLE IF NOT EXISTS Pagamento (
    id_pagamento SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    Metodo_pagamento VARCHAR(50) NOT NULL,
    Status_pagamento VARCHAR(50) NOT NULL,
    Valor DECIMAL(10,2) NOT NULL,
    Data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pedido) REFERENCES Pedido(id_pedido)
);

CREATE TABLE IF NOT EXISTS Favorito (
    id_favorito SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_produto INT NOT NULL,
    Data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
    FOREIGN KEY (id_produto) REFERENCES Produto(id_produto),
    UNIQUE (id_cliente, id_produto)
);

-- 4. Carga inicial (Seed) das Categorias e Produtos

INSERT INTO Categoria (id_categoria, Nome, Ordem_exibicao, Ativo) VALUES 
(1, 'Gelados', 1, TRUE),
(2, 'Quentes', 2, TRUE),
(3, 'Sanduiches', 3, TRUE)
ON CONFLICT (id_categoria) DO NOTHING;

SELECT setval(pg_get_serial_sequence('categoria', 'id_categoria'), COALESCE((SELECT MAX(id_categoria) FROM Categoria), 1));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Produto LIMIT 1) THEN
        INSERT INTO Produto (id_categoria, Nome, Descricao, Preco, Oculto) VALUES 
        (1, 'Café com Baunilha', 'Um delicioso café gelado com creme de baunilha e canela em pó', 10.90, FALSE),
        (1, 'Matcha', 'Matcha, leite e gelo. Super refrescante. Perfeito para o verão.', 12.90, FALSE),
        (1, 'Café Gelado', 'Delicioso café torra média, filtrado e muito gelado.', 12.90, FALSE),
        (1, 'Latte Gelado', 'Um mix de especiarias como canela, erva doce, pimenta preta, cravo e anis.', 19.00, FALSE),
        (2, 'Espresso Duplo', 'Espresso duplo. Essencial para começar o dia, café torra clara.', 9.00, FALSE),
        (2, 'Café com Leite', 'Um clássico brasileiro. Café coado e leite quente na medida certa.', 12.90, FALSE),
        (2, 'Matcha Quente', 'Matcha, leite e baunilha. Um abraço quente de sabor.', 12.90, FALSE),
        (2, 'Café com Leite Mini', 'Uma dose pequena com um pouco de leite. Para quem tem pressa.', 10.00, FALSE),
        (3, 'Sanduiche Classico', 'Pão, queijo, presunto e tomates cerejas. Um clássico da culinária.', 18.75, FALSE),
        (3, 'Queijo Quente', 'Pão torradinho, duas fatias de queijo prato e um toque de manteiga.', 12.90, FALSE),
        (3, 'Misto Quente', 'Pão, queijo e presunto quentinhos. Tão clássico quanto o Sanduiche Clássico.', 12.90, FALSE),
        (3, 'Misto Pão de Queijo', 'Um misto quente diferente, Pão de queijo, presunto e uma fatia de queijo.', 14.00, FALSE);
    END IF;
END $$;
