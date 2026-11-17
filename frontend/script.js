// 1. Dados dos produtos
const produtos = [
    { id: 1, nome: "Café com Baunilha", desc: "Um delicioso café gelado com creme de baunilha e canela em pó.", preco: "R$ 10,90", img: "https://via.placeholder.com/100x120", cat: "gelados" },
    { id: 2, nome: "Matcha", desc: "Matcha, leite e gelo. Super refrescante. Perfeito para o verão.", preco: "R$ 12,90", img: "https://via.placeholder.com/100x120", cat: "gelados" },
    { id: 3, nome: "Café Gelado", desc: "Café especial extraído a frio.", preco: "R$ 11,00", img: "https://via.placeholder.com/100x120", cat: "gelados" },
    { id: 4, nome: "Latte Gelado", desc: "Expresso e leite frio com cubos de gelo.", preco: "R$ 12,50", img: "https://via.placeholder.com/100x120", cat: "gelados" },
    { id: 5, nome: "Cold Brew", desc: "Infusão a frio por 12 horas, sabor suave.", preco: "R$ 14,00", img: "https://via.placeholder.com/100x120", cat: "gelados" },
    { id: 6, nome: "Flash Brew", desc: "Café coado quente e resfriado rapidamente.", preco: "R$ 13,50", img: "https://via.placeholder.com/100x120", cat: "gelados" },
    { id: 7, nome: "Espresso Duplo", desc: "Espresso duplo. Essencial para começar o dia com energia.", preco: "R$ 9,00", img: "https://via.placeholder.com/100x120", cat: "quentes" },
    { id: 8, nome: "Café com Leite M", desc: "Um clássico brasileiro. Café coado e leite quente na medida.", preco: "R$ 12,00", img: "https://via.placeholder.com/100x120", cat: "quentes" },
    { id: 9, nome: "Matcha Quente", desc: "Chá verde em pó preparado com leite vaporizado.", preco: "R$ 13,00", img: "https://via.placeholder.com/100x120", cat: "quentes" },
    { id: 10, nome: "Café com Leite P", desc: "Dose pequena do nosso clássico café com leite.", preco: "R$ 8,00", img: "https://via.placeholder.com/100x120", cat: "quentes" },
    { id: 11, nome: "Latte Macchiato", desc: "Leite cremoso manchado com um toque de espresso.", preco: "R$ 14,50", img: "https://via.placeholder.com/100x120", cat: "quentes" },
    { id: 12, nome: "Espresso Panna", desc: "Espresso tradicional coberto com chantilly.", preco: "R$ 11,90", img: "https://via.placeholder.com/100x120", cat: "quentes" },
    { id: 13, nome: "Sanduíche Clássico", desc: "Pão, queijo, presunto e tomates frescos. Um clássico.", preco: "R$ 14,75", img: "https://via.placeholder.com/100x120", cat: "sanduiches" },
    { id: 14, nome: "Queijo Quente", desc: "Pão tostado, duas fatias de queijo prato e manteiga.", preco: "R$ 12,90", img: "https://via.placeholder.com/100x120", cat: "sanduiches" },
    { id: 15, nome: "Bauru", desc: "Pão francês, rosbife, tomate e queijo derretido.", preco: "R$ 16,50", img: "https://via.placeholder.com/100x120", cat: "sanduiches" },
    { id: 16, nome: "Sanduíche Natural", desc: "Pão integral, patê de frango, alface e cenoura.", preco: "R$ 13,00", img: "https://via.placeholder.com/100x120", cat: "sanduiches" },
    { id: 17, nome: "Sanduíche de Costela", desc: "Costela desfiada, queijo e molho barbecue no pão brioche.", preco: "R$ 22,90", img: "https://via.placeholder.com/100x120", cat: "sanduiches" },
    { id: 18, nome: "Misto Quente", desc: "Presunto e queijo derretidos no pão de forma tostado.", preco: "R$ 11,50", img: "https://via.placeholder.com/100x120", cat: "sanduiches" }
];

// 2. Elementos do DOM
const gridProdutos = document.querySelector('.products-grid');
const tabs = document.querySelectorAll('.tab');
const navItems = document.querySelectorAll('.nav-item');

// 3. Função para renderizar os produtos
function renderizarProdutos(categoriaFiltro = 'gelados') {
    gridProdutos.innerHTML = ''; 

    const produtosFiltrados = produtos.filter(p => p.cat === categoriaFiltro);

    produtosFiltrados.forEach(produto => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image-container">
                <img src="${produto.img}" alt="${produto.nome}">
                <button class="favorite-btn" onclick="toggleFavorito(this)">
                    <i class="far fa-heart"></i>
                </button>
            </div>
            <h3 class="product-title">${produto.nome}</h3>
            <p class="product-desc">${produto.desc}</p>
            <button class="add-to-cart-btn" onclick="adicionarAoCarrinho('${produto.nome}', '${produto.preco}')">
                <span class="lock-icon"><i class="fas fa-shopping-bag"></i> Adicionar</span>
                <span class="price">${produto.preco}</span>
            </button>
        `;
        gridProdutos.appendChild(card);
    });
}

// 4. Lógica das Abas
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const categoria = tab.innerText.toLowerCase().replace('í', 'i');
        renderizarProdutos(categoria);
    });
});

// 5. Função para favoritar
window.toggleFavorito = function (btn) {
    const icone = btn.querySelector('i');
    if (icone.classList.contains('far')) {
        icone.classList.replace('far', 'fas');
        icone.style.color = '#e74c3c';
    } else {
        icone.classList.replace('fas', 'far');
        icone.style.color = '';
    }
};

// 6. Função de adicionar ao carrinho
window.adicionarAoCarrinho = function (nome, preco) {
    alert(`${nome} (${preco}) adicionado ao pedido!`);
};

// 7. Lógica da Barra Inferior
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => {
            nav.classList.remove('active');
            const icone = nav.querySelector('i');
            if (nav.querySelector('.nav-icon-bg')) {
                nav.innerHTML = `<i class="${icone.className}"></i><span>${nav.innerText}</span>`;
            }
        });
        item.classList.add('active');
        const iconeAtual = item.querySelector('i');
        const textoAtual = item.innerText;
        item.innerHTML = `<div class="nav-icon-bg"><i class="${iconeAtual.className}"></i></div><span>${textoAtual}</span>`;
    });
});

// 8. Inicializa o aplicativo
renderizarProdutos('gelados');