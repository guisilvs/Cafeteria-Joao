/**
 * @file siteCore.js
 * @description Regras de negócio para processamento/compressão de imagens em `.webp`
 * e informações institucionais do site/cardápio da Cafeteria do João.
 *
 * Requisito atendido:
 * "As fotos enviadas ao banco de dados são comprimidas em .webp em tamanho reduzido
 * mas suficiente para ter qualidade, porém de forma otimizada para economizar banda."
 */

const sharp = require('sharp');
const { erroFormatoImagem, erroValidacao } = require('./errosCore');

const QUALIDADE_WEBP_PADRAO = Number(process.env.WEBP_QUALITY) || 80;
const DIMENSAO_PRODUTO_PX = Number(process.env.WEBP_MAX_DIMENSION) || 336; // 2x de 168x168 do Figma (nitidez Retina com ~10KB)
const DIMENSAO_PERFIL_PX = 200; // Ideal para os avatares de 50x50 a 135x135 do Figma
const TAMANHO_MAXIMO_ENTRADA_BYTES = 5 * 1024 * 1024; // 5 MB antes da compressão

const FORMATOS_PERMITIDOS = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff']);

/**
 * Converte uma entrada (Buffer de arquivo ou string Base64/DataURI) em um Buffer binário.
 * @param {Buffer|string} entrada
 * @returns {Buffer}
 */
function extrairBufferDeEntrada(entrada) {
  if (Buffer.isBuffer(entrada)) {
    return entrada;
  }

  if (typeof entrada === 'string') {
    const limpo = entrada.trim();
    if (!limpo) {
      throw erroFormatoImagem('Imagem vazia fornecida.');
    }

    const matchDataUri = limpo.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/i);
    const base64Puro = matchDataUri ? matchDataUri[2] : limpo;

    try {
      const buffer = Buffer.from(base64Puro, 'base64');
      if (!buffer || buffer.length === 0) {
        throw new Error('Buffer vazio');
      }
      return buffer;
    } catch {
      throw erroFormatoImagem('A string Base64 da imagem fornecida é inválida.');
    }
  }

  throw erroFormatoImagem('Formato de entrada de imagem não suportado. Envie um arquivo ou Base64.');
}

/**
 * Comprime e redimensiona qualquer imagem válida para o formato `.webp` otimizado.
 *
 * @param {Buffer|string} entradaImagem - Buffer (via Multer) ou String Base64/DataURI
 * @param {object} [opcoes]
 * @param {number} [opcoes.largura=336] - Largura máxima em pixels
 * @param {number} [opcoes.altura=336] - Altura máxima em pixels
 * @param {number} [opcoes.qualidade=80] - Qualidade WebP (1 a 100)
 * @returns {Promise<{
 *   dataUri: string,
 *   base64: string,
 *   buffer: Buffer,
 *   mimeType: 'image/webp',
 *   tamanhoOriginalBytes: number,
 *   tamanhoFinalBytes: number,
 *   economiaPercentual: number,
 *   largura: number,
 *   altura: number
 * }>}
 */
async function converterImagemParaWebp(entradaImagem, opcoes = {}) {
  const bufferEntrada = extrairBufferDeEntrada(entradaImagem);

  if (bufferEntrada.length > TAMANHO_MAXIMO_ENTRADA_BYTES) {
    throw erroFormatoImagem('A imagem enviada excede o tamanho máximo permitido de 5 MB.');
  }

  const larguraAlvo = Number(opcoes.largura) || DIMENSAO_PRODUTO_PX;
  const alturaAlvo = Number(opcoes.altura) || DIMENSAO_PRODUTO_PX;
  const qualidade = Math.min(95, Math.max(40, Number(opcoes.qualidade) || QUALIDADE_WEBP_PADRAO));

  let metadados;
  try {
    metadados = await sharp(bufferEntrada).metadata();
  } catch {
    throw erroFormatoImagem('O arquivo enviado não é uma imagem válida ou está corrompido.');
  }

  if (!metadados || !metadados.format || !FORMATOS_PERMITIDOS.has(metadados.format.toLowerCase())) {
    throw erroFormatoImagem(
      'Formato de imagem não suportado. Utilize imagens PNG, JPEG, WebP, AVIF ou GIF.'
    );
  }

  try {
    const { data: bufferWebp, info } = await sharp(bufferEntrada)
      .rotate() // Respeita orientação EXIF de fotos tiradas pelo celular
      .resize(larguraAlvo, alturaAlvo, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({
        quality: qualidade,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });

    const base64 = bufferWebp.toString('base64');
    const dataUri = `data:image/webp;base64,${base64}`;
    const economiaPercentual =
      bufferEntrada.length > 0
        ? Math.round((1 - bufferWebp.length / bufferEntrada.length) * 100)
        : 0;

    return {
      dataUri,
      base64,
      buffer: bufferWebp,
      mimeType: 'image/webp',
      tamanhoOriginalBytes: bufferEntrada.length,
      tamanhoFinalBytes: bufferWebp.length,
      economiaPercentual,
      largura: info.width,
      altura: info.height,
    };
  } catch {
    throw erroFormatoImagem('Falha ao processar e comprimir a imagem para WebP.');
  }
}

/**
 * Processa a foto de um item do cardápio (produto) e retorna a Data URI `.webp` pronta para o banco.
 * @param {Buffer|string|null|undefined} entradaImagem
 * @returns {Promise<string|null>} Data URI `data:image/webp;base64,...` ou `null`
 */
async function processarFotoProduto(entradaImagem) {
  if (!entradaImagem) return null;
  const resultado = await converterImagemParaWebp(entradaImagem, {
    largura: DIMENSAO_PRODUTO_PX,
    altura: DIMENSAO_PRODUTO_PX,
    qualidade: QUALIDADE_WEBP_PADRAO,
  });
  return resultado.dataUri;
}

/**
 * Processa a foto de perfil de um usuário (cliente ou funcionário) em `.webp` compacto.
 * @param {Buffer|string|null|undefined} entradaImagem
 * @returns {Promise<string|null>} Data URI `data:image/webp;base64,...` ou `null`
 */
async function processarFotoPerfil(entradaImagem) {
  if (!entradaImagem) return null;
  const resultado = await converterImagemParaWebp(entradaImagem, {
    largura: DIMENSAO_PERFIL_PX,
    altura: DIMENSAO_PERFIL_PX,
    qualidade: 78,
  });
  return resultado.dataUri;
}

/**
 * Retorna os textos e configurações institucionais da Cafeteria do João (Portfólio/App).
 */
function obterInformacoesSite() {
  const nomeEstabelecimento = 'Cafeteria do João';
  const unidadePadrao = process.env.UNIDADE_PADRAO || 'Shopping Beira Mar';
  const previsaoRetiradaMinutos = Number(process.env.PREVISAO_RETIRADA_MINUTOS) || 5;

  return {
    nome: nomeEstabelecimento,
    slogan: 'Faça pedidos, favorite o cardápio e muito mais!',
    mensagemPedidoRealizado:
      'Estamos preparando seu pedido. Você pode acompanhar o progresso no seu perfil ou continuar navegando no nosso cardápio.',
    unidadePadrao,
    previsaoRetiradaMinutos,
    configuracaoImagens: {
      formato: 'image/webp',
      qualidadePadrao: QUALIDADE_WEBP_PADRAO,
      dimensaoProdutoPx: DIMENSAO_PRODUTO_PX,
      dimensaoPerfilPx: DIMENSAO_PERFIL_PX,
    },
  };
}

/**
 * Valida textos institucionais caso o painel queira atualizar textos do site.
 * @param {object} dados
 */
function validarTextosSite(dados = {}) {
  const titulo = String(dados.titulo || 'Cafeteria do João').trim();
  if (!titulo || titulo.length > 100) {
    throw erroValidacao('O título do site deve ter entre 1 e 100 caracteres.');
  }
  return {
    titulo,
    descricao: String(dados.descricao || '').trim(),
  };
}

module.exports = {
  converterImagemParaWebp,
  processarFotoProduto,
  processarFotoPerfil,
  obterInformacoesSite,
  validarTextosSite,
};
