// A repeatable CLI walkthrough using a loopback fixture provider, not an LLM.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'diffguard-demo-'));
let requests = 0;
const finding = {
  category: 'security', severity: 'high', file: 'query.js', line: 2,
  message: 'User input is interpolated into a SQL query.',
  suggestedFix: 'Use a parameterized query with a separate values array.',
};
const provider = createServer(async (req, res) => {
  try {
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.method, 'POST');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const request = JSON.parse(raw);
    assert.equal(request.model, 'fixture-only');
    assert.equal(request.stream, true);
    const prompt = request.messages[0].content;
    assert.match(prompt, /\+.*SELECT \* FROM users WHERE email/);
    assert.match(prompt, /query\.js/);
    requests++;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk',
      created: 0, model: 'fixture-only', choices: [{index:0, delta:{content:JSON.stringify({findings:[finding]})}, finish_reason:null}] }) + '\n\ndata: [DONE]\n\n');
  } catch {
    res.writeHead(400, {'content-type':'application/json'});
    res.end(JSON.stringify({error:{message:'Unexpected demo request'}}));
  }
});

try {
  await new Promise((resolve, reject) => {
    provider.once('error', reject); provider.listen(0, '127.0.0.1', resolve);
  });
  const port = provider.address().port;
  await mkdir(join(root, 'config', 'diffguard'), {recursive:true});
  await writeFile(join(root, 'config', 'diffguard', 'config.json'), JSON.stringify({
    provider:'openai', model:'fixture-only', baseUrl:`http://127.0.0.1:${port}/v1`, needsKey:false,
  }));
  await writeFile(join(root, 'query.js'), 'export function findUser(db, email) {\n  return db.query(`SELECT * FROM users WHERE email = \'${email}\'`);\n}\n');
  for (const args of [['init','--quiet'], ['add','--','query.js']]) {
    const result = spawnSync('git', args, {cwd:root, encoding:'utf8', env:{...process.env, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:join(root,'no-global-config')}});
    if (result.status !== 0) throw new Error('Could not prepare the disposable demo repository.');
  }
  console.log('FIXTURE DEMO — prewritten finding, no model call or accuracy claim.\n');
  const output = await new Promise((resolve, reject) => {
    // Explicit settings isolate the demo from personal configuration and keys.
    const child = spawn(process.execPath, [fileURLToPath(new URL('../bin/diffguard', import.meta.url)), '--staged'], {
      cwd:root, env:{...process.env, XDG_CONFIG_HOME:join(root,'config'), ANTHROPIC_API_KEY:'',
        DIFFGUARD_PROVIDER:'openai', DIFFGUARD_MODEL:'fixture-only', DIFFGUARD_BASE_URL:`http://127.0.0.1:${port}/v1`,
        DIFFGUARD_SECURITY_ENABLED:'true', DIFFGUARD_BEHAVIOR_ENABLED:'true', DIFFGUARD_SEVERITY_THRESHOLD:'medium', DIFFGUARD_MAX_DIFF_TOKENS:'8000'},
      stdio:['ignore','pipe','pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    const timeout = setTimeout(() => child.kill(), 20000);
    child.once('error', reject);
    child.once('close', code => { clearTimeout(timeout); resolve({stdout,stderr,code}); });
  });
  assert.equal(output.code, 1, `Expected findings exit code 1; got ${output.code}. ${output.stderr}`);
  assert.equal(requests, 1, 'Expected one request to the local fixture provider.');
  assert.match(output.stdout, /\[security\] high  query\.js:2/);
  assert.match(output.stdout, /1 finding \(1 security\)/);
  process.stdout.write(output.stdout);
  console.log('\nCLI exit code: 1 (findings). Demo completed successfully.');
} finally {
  await new Promise(resolve => provider.close(resolve));
  // Only remove the exact temporary directory created by this process.
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('diffguard-demo-')) {
    throw new Error('Refusing cleanup outside the demo temporary directory.');
  }
  await rm(root, {recursive:true, force:true});
}
