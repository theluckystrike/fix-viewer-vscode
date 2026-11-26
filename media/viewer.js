/* global acquireVsCodeApi */
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const app = document.getElementById('app');

  let state = {
    name: '',
    summary: null,
    pageSize: 100,
    page: 0,
    total: 0,
    rows: [],
    selected: null,
    tab: 'messages',
    req: 0,
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function post(msg) {
    state.req += 1;
    vscode.postMessage({ ...msg, req: state.req });
  }

  function fmtSize(n) {
    if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${n} B`;
  }

  function renderShell() {
    const s = state.summary;
    const errChip = s.errorCount > 0 ? `<span class="chip bad"><b>Errors:</b> ${s.errorCount}</span>` : '<span class="chip"><b>Checks:</b> OK</span>';
    const warnChip = s.warningCount > 0 ? `<span class="chip warn"><b>Warnings:</b> ${s.warningCount}</span>` : '';
    const typeOpts = (s.msgTypes || []).map(([t, c]) => `<option value="${esc(t)}">${esc(t)} (${c})</option>`).join('');
    const sessOpts = (s.sessions || []).map((x) => `<option value="${esc(x.session)}">${esc(x.session)} (${x.messageCount})</option>`).join('');

    app.innerHTML = `
      <div class="top">
        <div class="title">
          <span class="name">${esc(state.name)}</span>
          <span class="kind">${esc((s.versions || []).join(', ') || 'FIX')} · ${fmtSize(s.fileSize)}</span>
        </div>
        <div class="summary">
          <span class="chip"><b>Messages:</b> ${s.messageCount}</span>
          <span class="chip"><b>Sessions:</b> ${s.sessionCount}</span>
          <span class="chip"><b>Gaps:</b> ${s.gapCount}</span>
          <span class="chip"><b>Bad CheckSum:</b> ${s.badChecksumCount}</span>
          <span class="chip"><b>Rejects:</b> ${s.rejectCount}</span>
          ${errChip}${warnChip}
        </div>
        <div class="toolbar">
          <input id="q" type="search" placeholder="Filter by symbol, ClOrdID, tag or text..." />
          <select id="typeFilter">
            <option value="">All message types</option>
            ${typeOpts}
          </select>
          <select id="sessFilter">
            <option value="">All sessions</option>
            ${sessOpts}
          </select>
          <button id="filterBtn" type="button">Filter</button>
          <span class="sep"></span>
          <div id="protools"></div>
        </div>
        <div class="tabs">
          <button class="tab on" data-tab="messages" type="button">Messages (${s.messageCount})</button>
          <button class="tab" data-tab="sessions" type="button">Sessions (${s.sessionCount})</button>
          <button class="tab" data-tab="findings" type="button">Audit Findings (${s.errorCount + s.warningCount})</button>
        </div>
        <div id="hint" class="hint"></div>
      </div>
      <div class="main">
        <div id="leftPane" class="tablewrap"></div>
        <div id="detail" class="detail"><p class="muted">Select a FIX message row to inspect every decoded tag and value.</p></div>
      </div>
      <div class="pager">
        <button id="prev" type="button">Prev</button>
        <span id="pageInfo"></span>
        <button id="next" type="button">Next</button>
      </div>
    `;

    const q = document.getElementById('q');
    const tSel = document.getElementById('typeFilter');
    const sSel = document.getElementById('sessFilter');
    const runFilter = () => {
      state.page = 0;
      post({ type: 'filter', filter: { text: q.value, msgType: tSel.value, session: sSel.value } });
    };
    document.getElementById('filterBtn').addEventListener('click', runFilter);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') runFilter(); });
    tSel.addEventListener('change', runFilter);
    sSel.addEventListener('change', runFilter);

    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');
        state.tab = btn.dataset.tab;
        renderPane();
      });
    });

    document.getElementById('prev').addEventListener('click', () => {
      if (state.page > 0) { state.page -= 1; loadPage(); }
    });
    document.getElementById('next').addEventListener('click', () => {
      if ((state.page + 1) * state.pageSize < state.total) { state.page += 1; loadPage(); }
    });
  }

  function loadPage() {
    post({ type: 'page', from: state.page * state.pageSize, n: state.pageSize });
  }

  function renderPane() {
    const left = document.getElementById('leftPane');
    const pager = document.querySelector('.pager');
    const s = state.summary;

    if (state.tab === 'sessions') {
      pager.style.display = 'none';
      const rows = (s.sessions || []).map((x) => `<tr>
        <td>${esc(x.session)}</td>
        <td>${esc(x.beginString || '-')}</td>
        <td class="num">${x.messageCount}</td>
        <td>${x.minSeq != null ? `${x.minSeq}..${x.maxSeq}` : '-'}</td>
        <td class="num ${x.gaps.length ? 'bad' : ''}">${x.gaps.length}</td>
        <td class="num">${x.duplicates.length}</td>
        <td class="num">${x.possDupCount}</td>
        <td class="num ${x.badChecksums ? 'bad' : ''}">${x.badChecksums}</td>
        <td class="num">${x.rejects}</td>
      </tr>`).join('');
      left.innerHTML = `<table id="grid"><thead><tr><th>Session</th><th>Version</th><th class="num">Msgs</th><th>Seq Range</th><th class="num">Gaps</th><th class="num">Dups</th><th class="num">PossDup</th><th class="num">Bad CS</th><th class="num">Rejects</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">No sessions.</td></tr>'}</tbody></table>`;
      return;
    }

    if (state.tab === 'findings') {
      pager.style.display = 'none';
      const fRows = (s.findings || []).map((f) => `<tr>
        <td class="${f.severity === 'error' ? 'bad' : ''}">${esc(f.severity.toUpperCase())}</td>
        <td class="num">${f.line}</td>
        <td class="num">${f.msgIndex}</td>
        <td>${esc(f.field)}</td>
        <td>${esc(f.finding)}</td>
      </tr>`).join('');
      left.innerHTML = fRows
        ? `<table id="grid"><thead><tr><th>Severity</th><th class="num">Line</th><th class="num">Msg</th><th>Field</th><th>Finding</th></tr></thead><tbody>${fRows}</tbody></table>`
        : '<p class="muted" style="padding:12px;">All sequence, BodyLength and CheckSum checks passed.</p>';
      return;
    }

    pager.style.display = 'flex';
    const body = state.rows.map((r) => {
      const sel = state.selected === r.index ? ' class="sel"' : '';
      const flags = [
        !r.checksumOk ? '<span class="badge-mismatch">CS</span>' : '',
        !r.bodyLengthOk ? '<span class="badge-mismatch">LEN</span>' : '',
        r.seqIssue ? `<span class="badge-mismatch">${esc(r.seqIssue)}</span>` : '',
      ].join('');
      return `<tr data-idx="${r.index}"${sel}>
        <td class="num">${r.seqNum != null ? r.seqNum : '-'}</td>
        <td>${esc(r.sendingTime || '-')}</td>
        <td>${esc(r.msgType)} ${esc(r.msgTypeName)}${flags}</td>
        <td>${esc(r.session)}</td>
        <td>${esc(r.symbol || '-')}</td>
        <td>${esc(r.sideName || '-')}</td>
        <td class="num">${esc(r.orderQty || '-')}</td>
        <td class="num">${esc(r.price || '-')}</td>
        <td>${esc(r.clOrdId || '-')}</td>
        <td>${esc(r.ordStatusName || '-')}</td>
      </tr>`;
    }).join('');
    left.innerHTML = `<table id="grid">
      <thead><tr><th class="num">Seq</th><th>Time</th><th>MsgType</th><th>Session</th><th>Symbol</th><th>Side</th><th class="num">Qty</th><th class="num">Price</th><th>ClOrdID</th><th>Status</th></tr></thead>
      <tbody>${body || '<tr><td colspan="10" class="muted">No matching messages.</td></tr>'}</tbody>
    </table>`;

    left.querySelectorAll('tbody tr[data-idx]').forEach((tr) => {
      tr.addEventListener('click', () => {
        const idx = Number(tr.dataset.idx);
        state.selected = idx;
        left.querySelectorAll('tbody tr').forEach((row) => row.classList.toggle('sel', Number(row.dataset.idx) === idx));
        post({ type: 'detail', index: idx });
      });
    });

    const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    document.getElementById('pageInfo').textContent = `Page ${state.page + 1} of ${pages} (${state.total} messages)`;
    document.getElementById('prev').disabled = state.page <= 0;
    document.getElementById('next').disabled = (state.page + 1) * state.pageSize >= state.total;
  }

  function renderDetail(d) {
    const el = document.getElementById('detail');
    if (!d) {
      el.innerHTML = '<p class="muted">No message selected.</p>';
      return;
    }
    const rows = (d.fields || []).map((f) => `<tr>
      <td class="num">${f.tag}</td>
      <td>${esc(f.name)}</td>
      <td><code>${esc(f.value)}</code></td>
      <td>${esc(f.decoded)}</td>
    </tr>`).join('');
    el.innerHTML = `
      <div class="dhead"><strong>Message #${d.index}: ${esc(d.msgTypeName)} (${esc(d.msgType)})</strong><span class="muted">Line ${d.line} · ${esc(d.delimiter)}</span></div>
      <div class="meta"><strong>Session:</strong> ${esc(d.session)} · <strong>Seq:</strong> ${d.seqNum != null ? d.seqNum : '-'} · <strong>Version:</strong> ${esc(d.beginString)}</div>
      <div class="meta"><strong>CheckSum:</strong> ${d.checksumOk ? 'OK' : `FAIL (${esc(d.declaredChecksum)} vs ${esc(d.computedChecksum)})`} · <strong>BodyLength:</strong> ${d.bodyLengthOk ? 'OK' : `FAIL (${d.declaredBodyLength} vs ${d.computedBodyLength})`}</div>
      <table class="splits"><thead><tr><th class="num">Tag</th><th>Name</th><th>Value</th><th>Decoded</th></tr></thead><tbody>${rows}</tbody></table>
    `;
  }

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'init':
        if (m.error) {
          app.innerHTML = `<div class="error"><strong>Could not open ${esc(m.name)}</strong><p>${esc(m.error)}</p></div>`;
          return;
        }
        state.name = m.name;
        state.summary = m.summary;
        state.pageSize = m.pageSize || 100;
        state.page = 0;
        renderShell();
        loadPage();
        return;
      case 'pageResult':
        state.total = m.total;
        state.rows = m.rows || [];
        renderPane();
        if (state.rows.length && state.selected == null) {
          state.selected = state.rows[0].index;
          post({ type: 'detail', index: state.selected });
        }
        return;
      case 'filterResult':
        state.total = m.count;
        document.getElementById('hint').textContent = m.count < m.total ? `Showing ${m.count} of ${m.total} messages.` : '';
        loadPage();
        return;
      case 'detailResult':
        renderDetail(m.detail);
        return;
      case 'hint':
        if (document.getElementById('hint')) document.getElementById('hint').textContent = m.text || '';
        return;
      default:
    }
  });

  post({ type: 'ready' });
})();
