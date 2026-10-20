// Servidor estático para prévia local e testes e2e do build de produção.
// Aplica os cabeçalhos de `_headers` (CSP etc.) como a hospedagem faria e
// devolve index.html para rotas do app (fallback de SPA).
// Uso: node tools/servidor-estatico.mjs [pasta] [porta]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const raiz = resolve(process.argv[2] ?? 'dist/apps/web/browser');
const porta = Number(process.argv[3] ?? 4300);

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

const regras = await lerCabecalhos();
const casa = (padrao, caminho) => (padrao.endsWith('*') ? caminho.startsWith(padrao.slice(0, -1)) : padrao === caminho);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  let caminho = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let arquivo = join(raiz, caminho);
  let existe = false;
  try {
    existe = (await stat(arquivo)).isFile();
  } catch {
    existe = false;
  }
  if (!existe && !extname(caminho)) {
    caminho = '/index.html';
    arquivo = join(raiz, caminho);
    existe = true;
  }
  if (!existe) {
    res.writeHead(404).end('Não encontrado');
    return;
  }
  for (const r of regras) if (casa(r.caminho, caminho)) for (const [k, v] of r.cabecalhos) res.setHeader(k, v);
  res.setHeader('Content-Type', TIPOS[extname(arquivo)] ?? 'application/octet-stream');
  res.end(await readFile(arquivo));
}).listen(porta, () => console.log(`Servindo ${raiz} em http://localhost:${porta}`));
