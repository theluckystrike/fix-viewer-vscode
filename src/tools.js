'use strict';
// Pro tools for FIX Protocol Viewer:
//   1. auditSession: Session sequence-gap, BodyLength and CheckSum audit report in Markdown.
//   2. exportCsvJson: Write messages.csv, tags.csv and messages.json locally. Never overwrites existing files.
//   3. diffOrderLifecycle: Compare order lifecycle across two FIX files in Markdown.
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
  parseFix,
  buildMessagesCsv,
  buildTagsCsv,
  buildMessagesJson,
  buildSessionAuditMarkdown,
  buildOrderLifecycleDiffMarkdown,
} = require('./fix');

function uniquePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  for (let i = 1; i < 10000; i++) {
    const cand = path.join(dir, `${base}-${i}${ext}`);
    if (!fs.existsSync(cand)) return cand;
  }
  return path.join(dir, `${base}-${Date.now()}${ext}`);
}

async function resolveTargetUri(uri, provider, openLabel = 'Select FIX file') {
  if (uri && uri.scheme) return uri;
  if (provider && provider.active && provider.active.uri) return provider.active.uri;
  const ed = vscode.window.activeTextEditor;
  if (ed && ed.document && /\.(fix|fixlog)$/i.test(ed.document.uri.fsPath || ed.document.uri.path)) return ed.document.uri;
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'FIX Log File': ['fix', 'FIX', 'fixlog', 'FIXLOG'] },
    openLabel,
  });
  return picked && picked[0] ? picked[0] : null;
}

function listFixFilesInDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.(fix|fixlog)$/i.test(e.name))
    .map((e) => path.join(dirPath, e.name))
    .sort();
}

function createTools({ provider, pro, reach }) {
  async function auditSession(uri, opts = {}) {
    if (!(await pro.allowed('auditSession', opts))) return undefined;
    const target = await resolveTargetUri(uri, provider);
    if (!target) return undefined;

    const targetPath = target.fsPath;
    const isDir = target.scheme === 'file' && fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    const files = isDir ? listFixFilesInDir(targetPath) : [targetPath];
    if (!files.length) {
      vscode.window.showInformationMessage('No .fix files were found in this folder.');
      return undefined;
    }

    const entries = [];
    for (const f of files) {
      const buf = f === targetPath && target.scheme !== 'file'
        ? Buffer.from(await vscode.workspace.fs.readFile(target))
        : fs.readFileSync(f);
      entries.push({ fileName: path.basename(f), parsed: parseFix(buf) });
    }
    const md = buildSessionAuditMarkdown(entries);
    const doc = await vscode.workspace.openTextDocument({ content: md, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: false });
    await pro.produced('auditSession');
    if (reach) reach.refresh();
    return { files: files.length, markdown: md };
  }

  async function exportCsvJson(uri, opts = {}) {
    if (!(await pro.allowed('exportCsvJson', opts))) return undefined;
    const target = await resolveTargetUri(uri, provider);
    if (!target) return undefined;

    const targetPath = target.fsPath;
    const bytes = await vscode.workspace.fs.readFile(target);
    const parsed = parseFix(Buffer.from(bytes));
    const baseName = path.basename(targetPath, path.extname(targetPath));
    const defaultOut = uniquePath(path.join(path.dirname(targetPath), `${baseName}-messages.csv`));
    const saveUri = opts.outPath
      ? vscode.Uri.file(uniquePath(opts.outPath))
      : await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultOut),
        filters: { 'CSV file': ['csv'] },
        saveLabel: 'Save messages CSV',
      });
    if (!saveUri) return undefined;

    const msgPath = uniquePath(saveUri.fsPath);
    const dir = path.dirname(msgPath);
    const stem = path.basename(msgPath, '.csv');
    const tagsPath = uniquePath(path.join(dir, `${stem}-tags.csv`));
    const jsonPath = uniquePath(path.join(dir, `${stem}.json`));

    fs.writeFileSync(msgPath, buildMessagesCsv(parsed, path.basename(targetPath)), 'utf8');
    fs.writeFileSync(tagsPath, buildTagsCsv(parsed, path.basename(targetPath)), 'utf8');
    fs.writeFileSync(jsonPath, buildMessagesJson(parsed, path.basename(targetPath)), 'utf8');

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(msgPath));
    await vscode.window.showTextDocument(doc, { preview: false });
    await pro.produced('exportCsvJson');
    if (reach) reach.refresh();
    return { files: [msgPath, tagsPath, jsonPath], messages: parsed.stats.messageCount };
  }

  async function diffOrderLifecycle(uri, opts = {}) {
    if (!(await pro.allowed('diffOrderLifecycle', opts))) return undefined;
    const left = await resolveTargetUri(uri, provider, 'Select first FIX file');
    if (!left) return undefined;

    let right = opts.compareUri || null;
    if (!right) {
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'FIX Log File': ['fix', 'FIX', 'fixlog', 'FIXLOG'] },
        openLabel: 'Select second FIX file to compare',
      });
      right = picked && picked[0] ? picked[0] : null;
    }
    if (!right) return undefined;

    const leftBuf = Buffer.from(await vscode.workspace.fs.readFile(left));
    const rightBuf = Buffer.from(await vscode.workspace.fs.readFile(right));
    const md = buildOrderLifecycleDiffMarkdown(
      path.basename(left.fsPath || left.path),
      parseFix(leftBuf),
      path.basename(right.fsPath || right.path),
      parseFix(rightBuf),
    );
    const doc = await vscode.workspace.openTextDocument({ content: md, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: false });
    await pro.produced('diffOrderLifecycle');
    if (reach) reach.refresh();
    return { markdown: md };
  }

  return { auditSession, exportCsvJson, diffOrderLifecycle };
}

module.exports = { createTools, uniquePath };
