// Servidor estático para prévia local e testes e2e do build de produção.
//
// Padrão (Cloudflare Pages/Netlify): aplica os cabeçalhos de `_headers` (CSP
// etc.) e devolve index.html para rotas do app (fallback de SPA).
// Com --pages (GitHub Pages): ignora `_headers` e, para caminhos que não
// existem, devolve 404.html com status 404, como o GitHub faz.
// Com --base /caminho/: serve o app numa subpasta, como em usuario.github.io/repo/.
//
// Uso: node tools/servidor-estatico.mjs [pasta] [porta] [--base /cartao-diario/] [--pages]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const modoPages = args.includes('--pages') && args.splice(args.indexOf('--pages'), 1).length > 0;
const base = (opcao('--base') ?? '/').replace(/\/?$/, '/');
const raiz = resolve(args[0] ?? 'dist/apps/web/browser');
const porta = Number(args[1] ?? 4300);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function lerCabecalhos() {
  const regras = [];
  try {
    const texto = await readFile(join(raiz, '_headers'), 'utf8');
    let atual = null;
    for (const linha of texto.split('\n')) {
      if (!linha.trim()) continue;
      if (!/^\s/.test(linha)) regras.push((atual = { caminho: linha.trim(), cabecalhos: [] }));
      else if (atual) {
        const i = linha.indexOf(':');
        atual.cabecalhos.push([linha.slice(0, i).trim(), linha.slice(i + 1).trim()]);
      }
    }
  } catch {
    // Sem _headers: serve sem cabeçalhos extras.
  }
  return regras;
}

async function ehArquivo(caminho) {
  try {
    return (await stat(caminho)).isFile();
  } catch {
    return false;
  }
}

const regras = modoPages ? [] : await lerCabecalhos();
const casa = (padrao, caminho) => (padrao.endsWith('*') ? caminho.startsWith(padrao.slice(0, -1)) : padrao === caminho);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404).end('Não encontrado');
    return;
  }
  let caminho = normalize('/' + decodeURIComponent(url.pathname.slice(base.length))).replace(/^(\.\.[/\\])+/, '');
  if (caminho.endsWith('/')) caminho += 'index.html';
  let arquivo = join(raiz, caminho);
  let status = 200;

  if (!(await ehArquivo(arquivo))) {
    if (modoPages && (await ehArquivo(join(raiz, '404.html')))) {
      caminho = '/404.html';
      status = 404;
    } else if (!modoPages && !extname(caminho)) {
      caminho = '/index.html';
    } else {
      res.writeHead(404).end('Não encontrado');
      return;
    }
    arquivo = join(raiz, caminho);
  }

  for (const r of regras) if (casa(r.caminho, caminho)) for (const [k, v] of r.cabecalhos) res.setHeader(k, v);
  res.setHeader('Content-Type', TIPOS[extname(arquivo)] ?? 'application/octet-stream');
  res.writeHead(status);
  res.end(await readFile(arquivo));
}).listen(porta, () =>
  console.log(`Servindo ${raiz} em http://localhost:${porta}${base}${modoPages ? ' (modo GitHub Pages)' : ''}`),
);
