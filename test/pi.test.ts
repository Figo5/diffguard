// test/pi.test.ts
import { describe, it, expect, vi } from 'vitest';
import { registerPiExtension } from '../agent/pi.js';
import { TOOL_NAME } from '../agent/core.js';

function fakeApi() {
  const registerTool = vi.fn();
  const getProviderAuth = vi.fn(async () => 'sk-pi-credential');
  const api = {
    registerTool,
    modelRegistry: { getProviderAuth },
  };
  return { api, registerTool, getProviderAuth };
}

const CLEAN = { text: 'No issues found in 1 file.', findings: [], error: null };

describe('registerPiExtension', () => {
  it('registers the diffguard_audit tool with a schema', () => {
    const { api, registerTool } = fakeApi();
    registerPiExtension(api as never, async () => CLEAN);
    expect(registerTool).toHaveBeenCalledTimes(1);
    const [tool] = registerTool.mock.calls[0];
    expect(tool.name).toBe(TOOL_NAME);
    expect(tool.schema).toBeDefined();
    expect(tool.handler).toBeInstanceOf(Function);
  });

  it('reuses the Pi provider credential via getProviderAuth', async () => {
    const { api, registerTool, getProviderAuth } = fakeApi();
    registerPiExtension(api as never, async () => CLEAN);
    const tool = registerTool.mock.calls[0][0];
    const result = await tool.handler({ scope: 'working' }, { signal: new AbortController().signal });
    expect(getProviderAuth).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it('threads the Pi abort signal through to runAudit', async () => {
    const { api, registerTool } = fakeApi();
    const runAudit = vi.fn(async () => CLEAN);
    registerPiExtension(api as never, runAudit);
    const tool = registerTool.mock.calls[0][0];
    const controller = new AbortController();
    await tool.handler({ scope: 'working' }, { signal: controller.signal });
    expect(runAudit).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
  });
});
