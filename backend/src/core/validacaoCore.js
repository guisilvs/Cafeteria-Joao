/**
 * @file validacaoCore.js
 * @description Funções puras de validação, normalização e sanitização de dados.
 * Protege o sistema contra entradas malformadas, XSS e inconsistências.
 */

const { erroValidacao } = require('./errosCore');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIPOS_USUARIO_VALIDOS = ['cliente', 'funcionario', 'admin'];
const STATUS_PEDIDO_VALIDOS = ['pendente', 'preparando', 'concluido', 'cancelado'];

/**
 * Remove espaços excedentes e neutraliza tags HTML básicas para evitar XSS armazenado.
 * @param {unknown} valor
 * @returns {string}
 */
function sanitizarTexto(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Limpa um texto mantendo caracteres normais mas sem tags perigosas `<script>`.
 * @param {unknown} valor
 * @returns {string}
 */
function limparTextoSimples(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Valida e normaliza um endereço de e-mail.
 * @param {string} email
 * @returns {string} E-mail em letras minúsculas
 */
function validarEmail(email) {
  const emailLimpo = String(email || '').trim().toLowerCase();
  if (!emailLimpo) {
    throw erroValidacao('O campo e-mail é obrigatório.');
  }
  if (!REGEX_EMAIL.test(emailLimpo) || emailLimpo.length > 150) {
    throw erroValidacao('Informe um endereço de e-mail válido.');
  }
  return emailLimpo;
}

/**
 * Normaliza número de telefone mantendo apenas dígitos (e sinal + opcional).
 * Aceita formatos como "(48) 99999-9999", "48999999999", etc.
 * @param {string} telefone
 * @param {boolean} [obrigatorio=true]
 * @returns {string}
 */
function validarTelefone(telefone, obrigatorio = true) {
  const bruto = String(telefone || '').trim();
  if (!bruto) {
    if (obrigatorio) {
      throw erroValidacao('O campo telefone é obrigatório.');
    }
    return '';
  }

  const apenasDigitos = bruto.replace(/\D/g, '');
  if (apenasDigitos.length < 8 || apenasDigitos.length > 15) {
    throw erroValidacao('Informe um telefone válido com DDD (entre 8 e 15 dígitos).');
  }
  return apenasDigitos;
}

/**
 * Verifica se um identificador de login é um e-mail ou um telefone e o normaliza.
 * Usado nas telas de Login Cliente e Login Administrador ("E-mail ou telefone").
 * @param {string} identificador
 * @returns {{ tipo: 'email' | 'telefone', valor: string }}
 */
function normalizarIdentificadorLogin(identificador) {
  const texto = String(identificador || '').trim();
  if (!texto) {
    throw erroValidacao('Informe seu e-mail ou telefone para entrar.');
  }

  if (texto.includes('@')) {
    return {
      tipo: 'email',
      valor: validarEmail(texto),
    };
  }

  const digitos = texto.replace(/\D/g, '');
  if (digitos.length >= 8) {
    return {
      tipo: 'telefone',
      valor: digitos,
    };
  }

  throw erroValidacao('Informe um e-mail ou número de telefone válido.');
}

/**
 * Valida a senha do usuário quanto a tamanho mínimo e máximo (limite do bcrypt = 72 bytes).
 * @param {string} senha
 * @param {string} [confirmarSenha]
 */
function validarSenha(senha, confirmarSenha = undefined) {
  if (typeof senha !== 'string' || !senha) {
    throw erroValidacao('A senha é obrigatória.');
  }
  if (senha.length < 6) {
    throw erroValidacao('A senha deve ter pelo menos 6 caracteres.');
  }
  if (senha.length > 72) {
    throw erroValidacao('A senha deve ter no máximo 72 caracteres.');
  }
  if (confirmarSenha !== undefined && confirmarSenha !== null && senha !== confirmarSenha) {
    throw erroValidacao('A confirmação de senha não confere com a senha informada.');
  }
}

/**
 * Converte valores monetários como `10.9`, `"10,90"`, `"R$ 10,90"` para número float com 2 casas.
 * @param {number|string} valorPreco
 * @returns {number}
 */
function validarPreco(valorPreco) {
  if (valorPreco === undefined || valorPreco === null || valorPreco === '') {
    throw erroValidacao('O preço do produto é obrigatório.');
  }

  let numero = valorPreco;
  if (typeof valorPreco === 'string') {
    const limpo = valorPreco
      .replace(/R\$/gi, '')
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(?:,|$))/g, '')
      .replace(',', '.');
    numero = Number(limpo);
  }

  if (typeof numero !== 'number' || Number.isNaN(numero) || !Number.isFinite(numero)) {
    throw erroValidacao('O preço informado é inválido.');
  }

  if (numero <= 0) {
    throw erroValidacao('O preço do produto deve ser maior que zero.');
  }

  if (numero > 99999.99) {
    throw erroValidacao('O preço do produto excede o limite permitido.');
  }

  return Math.round(numero * 100) / 100;
}

/**
 * Formata um valor numérico em Reais (ex: `10.9` -> `"R$ 10,90"`).
 * @param {number} valor
 * @returns {string}
 */
function formatarMoedaBRL(valor) {
  const numero = Number(valor) || 0;
  return `R$ ${numero.toFixed(2).replace('.', ',')}`;
}

/**
 * Valida um ID numérico ou textual não vazio.
 * @param {number|string} id
 * @param {string} [nomeCampo='ID']
 * @returns {number|string}
 */
function validarId(id, nomeCampo = 'ID') {
  if (id === undefined || id === null || String(id).trim() === '') {
    throw erroValidacao(`${nomeCampo} é obrigatório.`);
  }
  const texto = String(id).trim();
  const comoNumero = Number(texto);
  if (Number.isInteger(comoNumero) && comoNumero > 0 && String(comoNumero) === texto) {
    return comoNumero;
  }
  return texto;
}

module.exports = {
  TIPOS_USUARIO_VALIDOS,
  STATUS_PEDIDO_VALIDOS,
  sanitizarTexto,
  limparTextoSimples,
  validarEmail,
  validarTelefone,
  normalizarIdentificadorLogin,
  validarSenha,
  validarPreco,
  formatarMoedaBRL,
  validarId,
};
