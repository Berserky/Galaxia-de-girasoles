import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../android/app/src/main/assets/mobile/app.js', import.meta.url), 'utf8');
const sync = app.slice(app.indexOf('function syncChatViewportHeight(){'), app.indexOf('function go(next)'));

test('short landscape and keyboard viewports keep the chat inside the visible screen', () => {
  for (const availableHeight of [220, 268, 308, 640]) {
    const values = new Map(), events = [];
    const chat = {};
    const context = {
      view: 'chat',
      window: { innerHeight: 840, visualViewport: { height: availableHeight } },
      document: {
        querySelector: () => chat,
        activeElement: { matches: () => true },
        documentElement: { clientHeight: 840, style: { setProperty: (name, value) => values.set(name, value) } },
      },
      chatScrollEngine: { beforeViewportChange: el => events.push(['before', el]), afterViewportChange: el => events.push(['after', el]) },
      ensureChatComposer: () => ({ setKeyboard: (focused, height) => events.push(['keyboard', focused, height]) }),
    };
    vm.runInNewContext(sync + ';syncChatViewportHeight()', context);
    assert.equal(values.get('--chat-viewport-height'), `${availableHeight}px`);
    assert.deepEqual(events, [['before', chat], ['keyboard', true, 840 - availableHeight], ['after', chat]]);
  }
});
