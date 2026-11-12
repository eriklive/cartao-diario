// Cliente mínimo da API do GitHub (REST + GraphQL) com fetch do Node 22.

export function criarCliente({ token, repo, api = process.env.GITHUB_API_URL || 'https://api.github.com' }) {
  if (!token) throw new Error('Falta o token do GitHub (SQUAD_GH_TOKEN).');
  const [dono, nome] = repo.split('/');
  const cabecalhos = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'squad-cartao-diario',
  };

  async function rest(metodo, caminho, corpo) {
    const url = caminho.startsWith('http') ? caminho : `${api}${caminho.replace('{repo}', `repos/${repo}`)}`;
    const resp = await fetch(url, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (resp.status === 204) return null;
    const dados = await resp.json().catch(() => null);
    if (!resp.ok) {
      const erro = new Error(`${metodo} ${caminho}: ${resp.status} ${dados?.message ?? ''}`);
      erro.status = resp.status;
      throw erro;
    }
    return dados;
  }

  async function paginar(caminho) {
    const todos = [];
    for (let pagina = 1; pagina < 50; pagina++) {
      const sep = caminho.includes('?') ? '&' : '?';
      const lote = await rest('GET', `${caminho}${sep}per_page=100&page=${pagina}`);
      todos.push(...lote);
      if (lote.length < 100) break;
    }
    return todos;
  }

  async function graphql(query, variables) {
    const resp = await fetch(`${api.replace(/\/v3$/, '')}/graphql`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({ query, variables }),
    });
    const dados = await resp.json();
    if (!resp.ok || dados.errors?.length) {
      throw new Error(`GraphQL: ${JSON.stringify(dados.errors ?? dados)}`);
    }
    return dados.data;
  }

  return { rest, paginar, graphql, dono, nome, repo };
}
