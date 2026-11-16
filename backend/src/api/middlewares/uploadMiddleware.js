/**
 * @file uploadMiddleware.js
 * @description Middleware de recebimento de imagens em memória via Multer.
 *
 * Permite que o Front-end envie fotos tanto via `multipart/form-data` (campos `foto` ou `imagem`)
 * quanto via JSON Base64. O arquivo em memória é então comprimido para `.webp` pelo `siteCore.js`.
 */

const multer = require('multer');
const { erroFormatoImagem } = require('../../core/errosCore');

const TAMANHO_MAXIMO_UPLOAD = 5 * 1024 * 1024; // 5 MB

const armazenamentoMemoria = multer.memoryStorage();

function filtroArquivoImagem(req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(
      erroFormatoImagem('Apenas arquivos de imagem (JPEG, PNG, WebP, AVIF, GIF) são permitidos.'),
      false
    );
  }
  return cb(null, true);
}

const uploadMemoria = multer({
  storage: armazenamentoMemoria,
  limits: {
    fileSize: TAMANHO_MAXIMO_UPLOAD,
    files: 1,
  },
  fileFilter: filtroArquivoImagem,
});

/**
 * Middleware flexível que aceita upload no campo `foto` ou `imagem` (ou nenhum arquivo se enviado via JSON).
 */
function receberFotoOpcional(req, res, next) {
  const tipoConteudo = String(req.headers['content-type'] || '').toLowerCase();
  if (!tipoConteudo.includes('multipart/form-data')) {
    return next();
  }

  const middlewareCampos = uploadMemoria.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'imagem', maxCount: 1 },
    { name: 'foto_perfil', maxCount: 1 },
  ]);

  return middlewareCampos(req, res, (erro) => {
    if (erro) {
      if (erro.code === 'LIMIT_FILE_SIZE') {
        return next(erroFormatoImagem('A imagem enviada excede o limite máximo de 5 MB.'));
      }
      return next(erro);
    }

    // Normaliza o arquivo recebido em `req.arquivoImagemBuffer` para os handlers
    const arquivos = req.files || {};
    const arquivo =
      (arquivos.foto && arquivos.foto[0]) ||
      (arquivos.imagem && arquivos.imagem[0]) ||
      (arquivos.foto_perfil && arquivos.foto_perfil[0]) ||
      req.file ||
      null;

    if (arquivo && arquivo.buffer) {
      req.arquivoImagemBuffer = arquivo.buffer;
    }

    return next();
  });
}

module.exports = {
  receberFotoOpcional,
};
