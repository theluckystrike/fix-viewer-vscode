'use strict';
// Unit tests for FIX Protocol Viewer: SOH/pipe parsing, BodyLength & CheckSum verification,
// sequence-gap detection, CSV/JSON/Markdown exports, order lifecycle diff, ViewModel, CSP, and Pro 1-free-try enforcement.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  computeFixChecksum,
  parseFix,
  buildMessagesCsv,
  buildTagsCsv,
  buildMessagesJson,
  buildSessionAuditMarkdown,
  buildOrderLifecycleDiffMarkdown,
} = require('../src/fix');
const { FixViewModel } = require('../src/view');
const { editorHtml } = require('../src/html');
const { createPro, TRIES, TRIAL_KEY } = require('../src/pro');

function buildValidFixLine(bodyFields, sep = '\x01') {
  const body = bodyFields.map(([t, v]) => `${t}=${v}\x01`).join('');
  const head = `8=FIX.4.4\x019=${body.length}\x01`;
  const cs = computeFixChecksum(head + body);
  const fullSoh = `${head}${body}10=${cs}\x01`;
  return sep === '\x01' ? fullSoh : fullSoh.replace(/\x01/g, sep);
}

test('computeFixChecksum computes exact FIX mod-256 3-digit checksum', () => {
  const line = buildValidFixLine([[35, '0'], [49, 'CLIENT'], [56, 'BROKER'], [34, '1'], [52, '20261124-10:00:00.000']]);
  const parsed = parseFix(line);
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.messages[0].checksumOk, true);
  assert.equal(parsed.messages[0].bodyLengthOk, true);
  assert.equal(parsed.stats.errorCount, 0);
});

test('parseFix handles SOH and pipe delimiters and decodes tags and enums', () => {
  const soh = buildValidFixLine([
    [35, 'D'], [49, 'BUY1'], [56, 'EXCH'], [34, '1'], [52, '20261124-09:30:00.000'],
    [11, 'CL-1'], [55, 'AAPL'], [54, '1'], [38, '100'], [40, '2'], [44, '225.50'], [59, '0'],
  ], '\x01');
  const pipe = buildValidFixLine([
    [35, '8'], [49, 'EXCH'], [56, 'BUY1'], [34, '1'], [52, '20261124-09:30:00.010'],
    [11, 'CL-1'], [37, 'ORD-1'], [55, 'AAPL'], [54, '1'], [38, '100'], [39, '2'], [150, '2'], [14, '100'], [151, '0'], [6, '225.50'],
  ], '|');
  const parsed = parseFix(`${soh}\n2026-11-24 09:30:00.010 IN ${pipe}`);
  assert.equal(parsed.stats.messageCount, 2);
  assert.equal(parsed.stats.sessionCount, 2);
  assert.equal(parsed.stats.badChecksumCount, 0);
  assert.equal(parsed.stats.badBodyLengthCount, 0);
  assert.equal(parsed.messages[0].msgTypeName, 'NewOrderSingle');
  assert.equal(parsed.messages[0].sideName, 'Buy');
  assert.equal(parsed.messages[0].delimiter, 'SOH');
  assert.equal(parsed.messages[1].msgTypeName, 'ExecutionReport');
  assert.equal(parsed.messages[1].ordStatusName, 'Filled');
  assert.equal(parsed.messages[1].delimiter, '|');
});

test('parseFix detects sequence gaps, duplicate seq without PossDup, bad CheckSum and bad BodyLength', () => {
  const m1 = buildValidFixLine([[35, '0'], [49, 'A'], [56, 'B'], [34, '1'], [52, '20261124-10:00:00']], '|');
  const m3 = buildValidFixLine([[35, '0'], [49, 'A'], [56, 'B'], [34, '3'], [52, '20261124-10:00:05']], '|'); // gap: missing 2
  const m3Dup = buildValidFixLine([[35, '0'], [49, 'A'], [56, 'B'], [34, '3'], [52, '20261124-10:00:06']], '|'); // dup without 43=Y
  const mBad = '8=FIX.4.4|9=999|35=0|49=A|56=B|34=4|52=20261124-10:00:07|10=000|';
  const parsed = parseFix([m1, m3, m3Dup, mBad].join('\n'));
  assert.equal(parsed.stats.gapCount, 1);
  assert.equal(parsed.stats.dupSeqCount, 1);
  assert.equal(parsed.stats.badChecksumCount, 1);
  assert.equal(parsed.stats.badBodyLengthCount, 1);
  assert.ok(parsed.stats.errorCount >= 3);
  assert.equal(parsed.messages[1].seqIssue, 'gap:2-2');
});

test('CSV, JSON, audit Markdown and order lifecycle diff builders emit structured outputs', () => {
  const f1 = [
    buildValidFixLine([[35, 'D'], [49, 'A'], [56, 'B'], [34, '1'], [52, '20261124-10:00:00'], [11, 'O-1'], [55, 'NVDA'], [54, '1'], [38, '100'], [44, '140.00']], '|'),
    buildValidFixLine([[35, '8'], [49, 'B'], [56, 'A'], [34, '1'], [52, '20261124-10:00:01'], [11, 'O-1'], [37, 'X1'], [55, 'NVDA'], [54, '1'], [39, '2'], [150, '2'], [14, '100'], [6, '140.00']], '|'),
  ].join('\n');
  const f2 = [
    buildValidFixLine([[35, 'D'], [49, 'A'], [56, 'B'], [34, '1'], [52, '20261124-10:00:00'], [11, 'O-1'], [55, 'NVDA'], [54, '1'], [38, '100'], [44, '140.00']], '|'),
    buildValidFixLine([[35, '8'], [49, 'B'], [56, 'A'], [34, '1'], [52, '20261124-10:00:01'], [11, 'O-1'], [37, 'X1'], [55, 'NVDA'], [54, '1'], [39, '4'], [150, '4'], [14, '0'], [6, '0']], '|'),
  ].join('\n');
  const p1 = parseFix(f1);
  const p2 = parseFix(f2);
  assert.ok(buildMessagesCsv(p1, 'a.fix').includes('NVDA'));
  assert.ok(buildTagsCsv(p1, 'a.fix').includes('NewOrderSingle'));
  const json = JSON.parse(buildMessagesJson(p1, 'a.fix'));
  assert.equal(json.messages.length, 2);
  const audit = buildSessionAuditMarkdown([{ fileName: 'a.fix', parsed: p1 }]);
  assert.ok(audit.includes('# FIX Session Sequence-Gap and Checksum Audit Report'));
  assert.ok(audit.includes('Files checked: 1'));
  const diff = buildOrderLifecycleDiffMarkdown('a.fix', p1, 'b.fix', p2);
  assert.ok(diff.includes('# FIX Order Lifecycle Comparison Report'));
  assert.ok(diff.includes('| O-1 | NVDA | Buy |'));
  assert.ok(diff.includes('| DIFF |'));
});

test('FixViewModel filters by text, MsgType and session and returns detail', () => {
  const sample = fs.readFileSync(path.join(__dirname, '..', 'samples', 'sample.fix'));
  const vm = new FixViewModel(parseFix(sample), 'sample.fix', sample.length);
  assert.equal(vm.totalCount(), 7);
  assert.equal(vm.setFilter({ text: 'MSFT' }), 2);
  assert.equal(vm.setFilter({ msgType: 'ExecutionReport' }), 4);
  assert.equal(vm.setFilter({ session: 'BUY_DESK->EXCHANGE' }), 3);
  assert.equal(vm.detail(2).clOrdId, 'ORD-1001');
});

test('editorHtml emits strict nonce CSP', () => {
  const html = editorHtml({ cspSource: 'https://test', script: 'v.js', styleUri: 'v.css', title: 's.fix', showSupportLinks: true, nonce: 'n1' });
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes("script-src 'nonce-n1'"));
});

test('Pro A-then-B-then-C 1-free-try enforcement', async () => {
  assert.equal(TRIES, 1);
  const store = new Map();
  const requireCalls = [];
  let statusMsg = '';
  const fakeVscode = {
    EventEmitter: class {
      constructor() { this.ls = []; this.event = (fn) => { this.ls.push(fn); return { dispose() {} }; }; }
      fire(v) { this.ls.forEach((fn) => fn(v)); }
      dispose() {}
    },
    window: { setStatusBarMessage(m) { statusMsg = m; } },
  };
  const fakeLic = {
    isPro: () => false,
    requirePro: async (title, opts) => { requireCalls.push({ title, opts }); return false; },
  };
  const context = {
    subscriptions: [],
    globalState: { get: (k) => store.get(k), update: async (k, v) => { store.set(k, v); } },
  };
  const pro = createPro({ vscode: fakeVscode, context, license: fakeLic });

  for (const [idx, feat] of ['auditSession', 'exportCsvJson', 'diffOrderLifecycle'].entries()) {
    assert.equal(pro.left(feat), 1);
    assert.equal(await pro.allowed(feat, { surface: 'toolbar' }), true);
    await pro.produced(feat);
    assert.equal(pro.left(feat), 0);
    assert.ok(statusMsg.includes('1 of 1'));
    assert.equal(await pro.allowed(feat, { surface: 'toolbar' }), false);
    assert.equal(requireCalls.length, idx + 1);
  }
  assert.deepEqual(store.get(TRIAL_KEY), { auditSession: 1, exportCsvJson: 1, diffOrderLifecycle: 1 });
});
