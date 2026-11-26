'use strict';
// View model for FIX Protocol Viewer: pagination, search/filter by text, MsgType and session, tag detail.

class FixViewModel {
  constructor(parsed, name, fileSize) {
    this.parsed = parsed;
    this.name = name;
    this.fileSize = fileSize;
    this.filter = { text: '', msgType: '', session: '' };
    this.filtered = parsed.messages.slice();
  }

  summary() {
    const s = this.parsed.stats;
    return {
      name: this.name,
      fileSize: this.fileSize,
      versions: this.parsed.versions,
      messageCount: s.messageCount,
      sessionCount: s.sessionCount,
      gapCount: s.gapCount,
      dupSeqCount: s.dupSeqCount,
      badChecksumCount: s.badChecksumCount,
      badBodyLengthCount: s.badBodyLengthCount,
      rejectCount: s.rejectCount,
      errorCount: s.errorCount,
      warningCount: s.warningCount,
      msgTypes: Object.entries(this.parsed.msgTypeCounts).sort((a, b) => b[1] - a[1]),
      sessions: this.parsed.sessions,
      findings: this.parsed.findings.slice(0, 150),
    };
  }

  totalCount() {
    return this.parsed.messages.length;
  }

  count() {
    return this.filtered.length;
  }

  setFilter(f) {
    const text = f && typeof f.text === 'string' ? f.text.trim().toLowerCase() : '';
    const msgType = f && typeof f.msgType === 'string' ? f.msgType.trim() : '';
    const session = f && typeof f.session === 'string' ? f.session.trim() : '';
    this.filter = { text, msgType, session };
    this.filtered = this.parsed.messages.filter((m) => {
      if (msgType && m.msgTypeName !== msgType && m.msgType !== msgType) return false;
      if (session && m.session !== session) return false;
      if (text) {
        const hay = `${m.seqNum ?? ''} ${m.msgType} ${m.msgTypeName} ${m.session} ${m.symbol} ${m.sideName} ${m.clOrdId} ${m.orderId} ${m.ordStatusName} ${m.text} ${m.fields.map((x) => `${x.tag}=${x.value} ${x.name}`).join(' ')}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
    return this.filtered.length;
  }

  rows(from, limit) {
    const start = Math.max(0, Number(from) || 0);
    const n = Math.max(1, Math.min(500, Number(limit) || 100));
    return this.filtered.slice(start, start + n).map((m) => ({
      index: m.index,
      line: m.line,
      seqNum: m.seqNum,
      sendingTime: m.sendingTime,
      msgType: m.msgType,
      msgTypeName: m.msgTypeName,
      session: m.session,
      symbol: m.symbol,
      sideName: m.sideName,
      orderQty: m.orderQty,
      price: m.price,
      clOrdId: m.clOrdId,
      ordStatusName: m.ordStatusName || m.execTypeName,
      checksumOk: m.checksumOk,
      bodyLengthOk: m.bodyLengthOk,
      seqIssue: m.seqIssue,
      tagCount: m.fields.length,
    }));
  }

  detail(index) {
    return this.parsed.messages.find((x) => x.index === index) || this.parsed.messages[0] || null;
  }
}

module.exports = { FixViewModel };
