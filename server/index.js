import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockChatAnswers, mockCodebase } from '../src/data/mockCodebase.js';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 8787);
const allowedExtensions = new Set(['.js', '.jsx', '.css', '.html', '.md', '.json', '.txt', '.py']);

const flattenFiles = (nodes, result = []) => {
  Object.values(nodes).forEach((node) => {
    if (node.type === 'directory') flattenFiles(node.children, result);
    else if (node.content) result.push({ path: node.path || node.name, name: node.name, type: node.type, content: node.content });
  });
  return result;
};

const indexedFiles = flattenFiles(mockCodebase.files);
const sessions = new Map();
const repositories = new Map([['demo', indexedFiles]]);
let activeFiles = indexedFiles;
const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(body));
};
const getFile = (filePath) => activeFiles.find((file) => file.path === filePath);
const hashPassword = (password) => createHash('sha256').update(password).digest('hex');
const getSession = (request) => sessions.get((request.headers.authorization || '').replace('Bearer ', ''));

const answerQuery = (query) => {
  const normalizedQuery = query.toLowerCase().trim();
  const match = Object.entries(mockChatAnswers).find(([key]) => normalizedQuery.includes(key) || key.includes(normalizedQuery));
  if (match) return { answer: match[1].answer, sources: match[1].sources || [] };
  const terms = normalizedQuery.split(/\s+/).filter((term) => term.length > 2);
  const sources = activeFiles
    .map((file) => ({ file, score: terms.filter((term) => `${file.path} ${file.content}`.toLowerCase().includes(term)).length }))
    .filter(({ score }) => score > 0).sort((left, right) => right.score - left.score).slice(0, 3)
    .map(({ file }) => ({ file: file.path, name: file.name }));
  return {
    answer: sources.length
      ? `I found related code in **${sources.map((source) => source.file).join('**, **')}**. Ask about a specific module or function for a more detailed explanation.`
      : "I couldn't find a direct code section addressing that query in the active index. Try asking about **directory parsing**, **API routes**, or **RAG workflow**.",
    sources
  };
};

const server = createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    response.end();
    return;
  }
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        const { email, password } = JSON.parse(body || '{}');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || typeof password !== 'string' || password.length < 8) {
          return json(response, 400, { error: 'Enter a valid email and a password with at least 8 characters' });
        }
        const token = randomUUID();
        sessions.set(token, { email, passwordHash: hashPassword(password), createdAt: Date.now() });
        json(response, 200, { token, user: { email } });
      } catch { json(response, 400, { error: 'Request body must be valid JSON' }); }
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const session = getSession(request);
    return session ? json(response, 200, { user: { email: session.email } }) : json(response, 401, { error: 'Not authenticated' });
  }
  if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { status: 'ok', indexed: true, provider: 'local-index' });
  if (request.method === 'GET' && url.pathname === '/api/project') return json(response, 200, { ...mockCodebase, files: undefined, indexedFiles });
  if (request.method === 'GET' && url.pathname === '/api/files') return json(response, 200, { files: activeFiles.map(({ content: _content, ...file }) => file) });
  if (request.method === 'GET' && url.pathname === '/api/files/content') {
    const file = getFile(url.searchParams.get('path'));
    return file ? json(response, 200, file) : json(response, 404, { error: 'File not found' });
  }
  if (request.method === 'POST' && url.pathname === '/api/repositories/upload') {
    if (!getSession(request)) return json(response, 401, { error: 'Login required' });
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        const { name, files } = JSON.parse(body || '{}');
        if (!name || !Array.isArray(files) || !files.length) return json(response, 400, { error: 'Choose a repository folder first' });
        const repositoryFiles = files.filter((file) => file.path && typeof file.content === 'string').map((file) => ({
          path: file.path.replaceAll('\\', '/'), name: file.path.split(/[\\/]/).pop(), type: extname(file.path).slice(1) || 'text', content: file.content
        }));
        repositories.set(name, repositoryFiles);
        activeFiles = repositoryFiles;
        json(response, 200, { status: 'success', repository: name, files: repositoryFiles.length });
      } catch { json(response, 400, { error: 'Upload payload must be valid JSON' }); }
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/query') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        const { query } = JSON.parse(body || '{}');
        if (!query || typeof query !== 'string') return json(response, 400, { error: 'query is required' });
        json(response, 200, answerQuery(query));
      } catch { json(response, 400, { error: 'Request body must be valid JSON' }); }
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/ingest') {
    const repositoryPath = url.searchParams.get('repoPath') || rootDir;
    const target = resolve(rootDir, repositoryPath);
    if (!target.startsWith(rootDir) || !existsSync(target)) return json(response, 400, { error: 'repoPath must point to an existing project inside the workspace' });
    const countFiles = (directory) => readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') return count + countFiles(entryPath);
      return count + (entry.isFile() && allowedExtensions.has(extname(entry.name)) ? 1 : 0);
    }, 0);
    return json(response, 200, { status: 'success', indexed_elements: countFiles(target) });
  }
  json(response, 404, { error: 'Route not found' });
});

server.listen(port, () => console.log(`CodeMentor API running at http://localhost:${port}`));