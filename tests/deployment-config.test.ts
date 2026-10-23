import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { resolveConfig } from 'vite';

test('a GitHub Pages base_path without a trailing slash resolves image and worker URLs inside the repository', async () => {
  const previous = process.env.VITE_BASE_PATH;
  process.env.VITE_BASE_PATH = '/command';
  try {
    const config = await resolveConfig({
      configFile: resolve('vite.config.ts'),
      configLoader: 'runner',
      envFile: false,
      logLevel: 'silent',
    }, 'build');
    assert.equal(config.env.BASE_URL, '/command/');
    assert.equal(`${config.env.BASE_URL}assets/title-world.webp`, '/command/assets/title-world.webp');
    assert.equal(`${config.env.BASE_URL}sw.js`, '/command/sw.js');
  } finally {
    if (previous === undefined) delete process.env.VITE_BASE_PATH;
    else process.env.VITE_BASE_PATH = previous;
  }
});
