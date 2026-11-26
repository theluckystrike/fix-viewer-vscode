'use strict';
// Zero-dependency FIX 4.2 / 4.4 / 5.0 / FIXT.1.1 protocol parser, validator, CSV/JSON exporter,
// session sequence-gap auditor and multi-file order lifecycle comparator.

const TAG_NAMES = {
  1: 'Account', 6: 'AvgPx', 7: 'BeginSeqNo', 8: 'BeginString', 9: 'BodyLength', 10: 'CheckSum',
  11: 'ClOrdID', 12: 'Commission', 13: 'CommType', 14: 'CumQty', 15: 'Currency', 16: 'EndSeqNo',
  17: 'ExecID', 18: 'ExecInst', 19: 'ExecRefID', 20: 'ExecTransType', 21: 'HandlInst', 22: 'SecurityIDSource',
  30: 'LastMkt', 31: 'LastPx', 32: 'LastQty', 34: 'MsgSeqNum', 35: 'MsgType', 36: 'NewSeqNo',
  37: 'OrderID', 38: 'OrderQty', 39: 'OrdStatus', 40: 'OrdType', 41: 'OrigClOrdID', 43: 'PossDupFlag',
  44: 'Price', 45: 'RefSeqNum', 48: 'SecurityID', 49: 'SenderCompID', 50: 'SenderSubID', 52: 'SendingTime',
  53: 'Quantity', 54: 'Side', 55: 'Symbol', 56: 'TargetCompID', 57: 'TargetSubID', 58: 'Text',
  59: 'TimeInForce', 60: 'TransactTime', 63: 'SettlType', 64: 'SettlDate', 65: 'SymbolSfx',
  70: 'AllocID', 75: 'TradeDate', 76: 'ExecBroker', 97: 'PossResend', 98: 'EncryptMethod',
  99: 'StopPx', 100: 'ExDestination', 102: 'CxlRejReason', 103: 'OrdRejReason', 108: 'HeartBtInt',
  110: 'MinQty', 111: 'MaxFloor', 112: 'TestReqID', 115: 'OnBehalfOfCompID', 122: 'OrigSendingTime',
  123: 'GapFillFlag', 126: 'ExpireTime', 128: 'DeliverToCompID', 141: 'ResetSeqNumFlag',
  150: 'ExecType', 151: 'LeavesQty', 167: 'SecurityType', 198: 'SecondaryOrderID',
  207: 'SecurityExchange', 262: 'MDReqID', 263: 'SubscriptionRequestType', 264: 'MarketDepth',
  268: 'NoMDEntries', 269: 'MDEntryType', 270: 'MDEntryPx', 271: 'MDEntrySize', 320: 'SecurityReqID',
  371: 'RefTagID', 372: 'RefMsgType', 373: 'SessionRejectReason', 378: 'ExecRestatementReason',
  379: 'BusinessRejectRefID', 380: 'BusinessRejectReason', 434: 'CxlRejResponseTo',
  447: 'PartyIDSource', 448: 'PartyID', 452: 'PartyRole', 453: 'NoPartyIDs',
  526: 'SecondaryClOrdID', 528: 'OrderCapacity', 553: 'Username', 584: 'MassStatusReqID',
  1028: 'ManualOrderIndicator', 1128: 'ApplVerID', 1137: 'DefaultApplVerID',
};

const MSG_TYPES = {
  '0': 'Heartbeat', '1': 'TestRequest', '2': 'ResendRequest', '3': 'Reject',
  '4': 'SequenceReset', '5': 'Logout', '6': 'IOI', '7': 'Advertisement',
  '8': 'ExecutionReport', '9': 'OrderCancelReject', 'A': 'Logon', 'B': 'News',
  'C': 'Email', 'D': 'NewOrderSingle', 'E': 'NewOrderList', 'F': 'OrderCancelRequest',
  'G': 'OrderCancelReplaceRequest', 'H': 'OrderStatusRequest', 'J': 'AllocationInstruction',
  'P': 'AllocationInstructionAck', 'Q': 'DontKnowTrade', 'R': 'QuoteRequest', 'S': 'Quote',
  'V': 'MarketDataRequest', 'W': 'MarketDataSnapshot', 'X': 'MarketDataIncrementalRefresh',
  'Y': 'MarketDataRequestReject', 'Z': 'QuoteCancel', 'j': 'BusinessMessageReject',
  'AE': 'TradeCaptureReport', 'AR': 'TradeCaptureReportAck', 'AF': 'OrderMassStatusRequest',
};

const SIDE_NAMES = {
  '1': 'Buy', '2': 'Sell', '3': 'Buy minus', '4': 'Sell plus', '5': 'Sell short',
  '6': 'Sell short exempt', '7': 'Undisclosed', '8': 'Cross', '9': 'Cross short',
};

const ORD_TYPE_NAMES = {
  '1': 'Market', '2': 'Limit', '3': 'Stop', '4': 'Stop Limit', '5': 'Market on Close',
  'P': 'Pegged', 'K': 'Market with Left Over as Limit',
};

const ORD_STATUS_NAMES = {
  '0': 'New', '1': 'Partially filled', '2': 'Filled', '3': 'Done for day', '4': 'Canceled',
  '5': 'Replaced', '6': 'Pending Cancel', '7': 'Stopped', '8': 'Rejected', '9': 'Suspended',
  'A': 'Pending New', 'B': 'Calculated', 'C': 'Expired', 'D': 'Accepted for bidding', 'E': 'Pending Replace',
};

const EXEC_TYPE_NAMES = {
  '0': 'New', '1': 'Partial fill', '2': 'Fill', '3': 'Done for day', '4': 'Canceled',
  '5': 'Replaced', '6': 'Pending Cancel', '7': 'Stopped', '8': 'Rejected', '9': 'Suspended',
  'A': 'Pending New', 'C': 'Expired', 'D': 'Restated', 'E': 'Pending Replace', 'F': 'Trade',
  'G': 'Trade Correct', 'H': 'Trade Cancel', 'I': 'Order Status',
};

const TIF_NAMES = {
  '0': 'Day', '1': 'GTC', '2': 'OPG', '3': 'IOC', '4': 'FOK', '5': 'GTX', '6': 'GTD', '7': 'At the Close',
};

const ORD_REJ_REASONS = {
  '0': 'Broker/Exchange option', '1': 'Unknown symbol', '2': 'Exchange closed',
  '3': 'Order exceeds limit', '4': 'Too late to enter', '5': 'Unknown order',
  '6': 'Duplicate order', '11': 'Unsupported order characteristic', '13': 'Incorrect quantity',
  '15': 'Unknown account',
};

const SESSION_REJ_REASONS = {
  '0': 'Invalid tag number', '1': 'Required tag missing', '2': 'Tag not defined for message type',
  '3': 'Undefined tag', '4': 'Tag specified without a value', '5': 'Value is incorrect',
  '6': 'Incorrect data format', '9': 'CompID problem', '10': 'SendingTime accuracy problem',
  '11': 'Invalid MsgType',
};

function decodeTagValue(tag, value) {
  switch (tag) {
    case 35: return MSG_TYPES[value] || '';
    case 54: return SIDE_NAMES[value] || '';
    case 40: return ORD_TYPE_NAMES[value] || '';
    case 39: return ORD_STATUS_NAMES[value] || '';
    case 150: return EXEC_TYPE_NAMES[value] || '';
    case 59: return TIF_NAMES[value] || '';
    case 103: return ORD_REJ_REASONS[value] || '';
    case 373: return SESSION_REJ_REASONS[value] || '';
    case 43: return value === 'Y' ? 'Possible duplicate' : value === 'N' ? 'Original' : '';
    case 97: return value === 'Y' ? 'Possible resend' : value === 'N' ? 'Original' : '';
    case 123: return value === 'Y' ? 'Gap fill' : value === 'N' ? 'Sequence reset' : '';
    case 141: return value === 'Y' ? 'Reset sequence' : value === 'N' ? 'No reset' : '';
    default: return '';
  }
}

function computeFixChecksum(sohMessageBeforeTag10) {
  let sum = 0;
  for (let i = 0; i < sohMessageBeforeTag10.length; i++) {
    sum = (sum + sohMessageBeforeTag10.charCodeAt(i)) & 0xff;
  }
  return String(sum).padStart(3, '0');
}

function detectDelimiter(line) {
  if (line.includes('\x01')) return '\x01';
  if (line.includes('^A')) return '^A';
  if (line.includes('|')) return '|';
  return '\x01';
}

function splitFixMessages(text) {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (!raw.trim()) continue;
    const idx = raw.indexOf('8=FIX');
    if (idx === -1) continue;
    // Handle multiple messages concatenated on a single line
    let pos = idx;
    while (pos !== -1) {
      const next = raw.indexOf('8=FIX', pos + 5);
      const chunk = (next === -1 ? raw.slice(pos) : raw.slice(pos, next)).trimEnd();
      if (chunk) out.push({ lineNumber: i + 1, prefix: pos === idx ? raw.slice(0, idx).trim() : '', raw: chunk });
      pos = next;
    }
  }
  return out;
}

function parseFix(input) {
  const text = Buffer.isBuffer(input) ? input.toString('latin1') : String(input || '');
  const chunks = splitFixMessages(text);
  const messages = [];
  const findings = [];
  const sessionsMap = new Map();
  const msgTypeCounts = {};
  let badChecksumCount = 0;
  let badBodyLengthCount = 0;
  let gapCount = 0;
  let dupSeqCount = 0;
  let rejectCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const { lineNumber, prefix, raw } = chunks[i];
    const delim = detectDelimiter(raw);
    const parts = raw.split(delim).filter((p) => p.length > 0);
    const fields = [];
    const byTag = {};

    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq <= 0) {
        findings.push({ severity: 'warning', line: lineNumber, msgIndex: i + 1, field: 'token', finding: `Malformed tag token "${part.slice(0, 40)}"` });
        continue;
      }
      const tagNum = Number(part.slice(0, eq));
      const value = part.slice(eq + 1);
      if (!Number.isInteger(tagNum) || tagNum <= 0) {
        findings.push({ severity: 'warning', line: lineNumber, msgIndex: i + 1, field: 'tag', finding: `Non-numeric tag "${part.slice(0, eq)}"` });
        continue;
      }
      const name = TAG_NAMES[tagNum] || `Tag_${tagNum}`;
      const decoded = decodeTagValue(tagNum, value);
      fields.push({ tag: tagNum, name, value, decoded });
      if (byTag[tagNum] === undefined) byTag[tagNum] = value;
    }

    // Normalize message to SOH for BodyLength & CheckSum verification
    const normalized = fields.map((f) => `${f.tag}=${f.value}\x01`).join('');
    const tag10Pos = normalized.lastIndexOf('\x0110=');
    let checksumOk = true;
    let computedChecksum = '';
    const declaredChecksum = byTag[10] || '';
    if (tag10Pos !== -1) {
      const before10 = normalized.slice(0, tag10Pos + 1);
      computedChecksum = computeFixChecksum(before10);
      if (declaredChecksum && declaredChecksum.padStart(3, '0') !== computedChecksum) {
        checksumOk = false;
        badChecksumCount += 1;
        findings.push({
          severity: 'error',
          line: lineNumber,
          msgIndex: i + 1,
          field: 'CheckSum (10)',
          finding: `Declared ${declaredChecksum}, computed ${computedChecksum}`,
        });
      }
    } else if (fields.length > 0) {
      checksumOk = false;
      badChecksumCount += 1;
      findings.push({ severity: 'warning', line: lineNumber, msgIndex: i + 1, field: 'CheckSum (10)', finding: 'Missing tag 10 (CheckSum)' });
    }

    // BodyLength check: bytes after tag 9 SOH up to (not including) tag 10
    let bodyLengthOk = true;
    let computedBodyLength = null;
    const declaredBodyLength = byTag[9] !== undefined ? Number(byTag[9]) : null;
    const tag9Match = normalized.match(/^8=[^\x01]*\x019=[^\x01]*\x01/);
    if (tag9Match && tag10Pos !== -1) {
      computedBodyLength = (tag10Pos + 1) - tag9Match[0].length;
      if (declaredBodyLength !== null && Number.isFinite(declaredBodyLength) && declaredBodyLength !== computedBodyLength) {
        bodyLengthOk = false;
        badBodyLengthCount += 1;
        findings.push({
          severity: 'error',
          line: lineNumber,
          msgIndex: i + 1,
          field: 'BodyLength (9)',
          finding: `Declared ${declaredBodyLength}, computed ${computedBodyLength}`,
        });
      }
    }

    const beginString = byTag[8] || '';
    const msgType = byTag[35] || '';
    const msgTypeName = MSG_TYPES[msgType] || msgType || 'Unknown';
    const seqNum = byTag[34] !== undefined ? Number(byTag[34]) : null;
    const sender = byTag[49] || '';
    const target = byTag[56] || '';
    const sessionKey = `${sender || '?'}->${target || '?'}`;
    const sendingTime = byTag[52] || '';
    const symbol = byTag[55] || '';
    const side = byTag[54] || '';
    const sideName = SIDE_NAMES[side] || side;
    const orderQty = byTag[38] || byTag[32] || '';
    const price = byTag[44] || byTag[31] || '';
    const clOrdId = byTag[11] || '';
    const origClOrdId = byTag[41] || '';
    const orderId = byTag[37] || '';
    const ordStatus = byTag[39] || '';
    const ordStatusName = ORD_STATUS_NAMES[ordStatus] || ordStatus;
    const execType = byTag[150] || '';
    const execTypeName = EXEC_TYPE_NAMES[execType] || execType;
    const cumQty = byTag[14] || '';
    const leavesQty = byTag[151] || '';
    const avgPx = byTag[6] || '';
    const possDup = byTag[43] === 'Y';
    const textField = byTag[58] || '';

    msgTypeCounts[msgTypeName] = (msgTypeCounts[msgTypeName] || 0) + 1;
    if (msgType === '3' || msgType === '9' || msgType === 'j' || ordStatus === '8' || execType === '8') {
      rejectCount += 1;
    }

    // Track session sequence numbers
    if (!sessionsMap.has(sessionKey)) {
      sessionsMap.set(sessionKey, {
        session: sessionKey,
        sender,
        target,
        beginString,
        messageCount: 0,
        minSeq: null,
        maxSeq: null,
        lastSeq: null,
        gaps: [],
        duplicates: [],
        possDupCount: 0,
        badChecksums: 0,
        rejects: 0,
      });
    }
    const sess = sessionsMap.get(sessionKey);
    sess.messageCount += 1;
    if (possDup) sess.possDupCount += 1;
    if (!checksumOk) sess.badChecksums += 1;
    if (msgType === '3' || msgType === '9' || msgType === 'j' || ordStatus === '8' || execType === '8') sess.rejects += 1;

    let seqIssue = '';
    if (seqNum !== null && Number.isFinite(seqNum)) {
      if (sess.minSeq === null || seqNum < sess.minSeq) sess.minSeq = seqNum;
      if (sess.maxSeq === null || seqNum > sess.maxSeq) sess.maxSeq = seqNum;
      if (sess.lastSeq !== null) {
        if (msgType === '4' && byTag[36]) {
          // SequenceReset sets next expected seq
          const newSeq = Number(byTag[36]);
          if (Number.isFinite(newSeq)) sess.lastSeq = newSeq - 1;
        } else if (seqNum > sess.lastSeq + 1) {
          const gap = { expected: sess.lastSeq + 1, actual: seqNum, missing: seqNum - sess.lastSeq - 1, line: lineNumber, msgIndex: i + 1 };
          sess.gaps.push(gap);
          gapCount += 1;
          seqIssue = `gap:${gap.expected}-${seqNum - 1}`;
          findings.push({
            severity: 'error',
            line: lineNumber,
            msgIndex: i + 1,
            field: 'MsgSeqNum (34)',
            finding: `Session ${sessionKey} sequence gap: expected ${gap.expected}, got ${seqNum} (${gap.missing} missing)`,
          });
        } else if (seqNum <= sess.lastSeq && !possDup) {
          sess.duplicates.push({ seqNum, prevSeq: sess.lastSeq, line: lineNumber, msgIndex: i + 1 });
          dupSeqCount += 1;
          seqIssue = `dup:${seqNum}`;
          findings.push({
            severity: 'warning',
            line: lineNumber,
            msgIndex: i + 1,
            field: 'MsgSeqNum (34)',
            finding: `Session ${sessionKey} out-of-order or duplicate MsgSeqNum ${seqNum} after ${sess.lastSeq} without PossDupFlag=Y`,
          });
        }
      }
      if (msgType !== '4' || !byTag[36]) {
        if (sess.lastSeq === null || seqNum > sess.lastSeq) sess.lastSeq = seqNum;
      }
    }

    messages.push({
      index: i + 1,
      line: lineNumber,
      prefix,
      delimiter: delim === '\x01' ? 'SOH' : delim,
      beginString,
      msgType,
      msgTypeName,
      seqNum,
      sender,
      target,
      session: sessionKey,
      sendingTime,
      symbol,
      side,
      sideName,
      orderQty,
      price,
      clOrdId,
      origClOrdId,
      orderId,
      ordStatus,
      ordStatusName,
      execType,
      execTypeName,
      cumQty,
      leavesQty,
      avgPx,
      possDup,
      text: textField,
      checksumOk,
      declaredChecksum,
      computedChecksum,
      bodyLengthOk,
      declaredBodyLength,
      computedBodyLength,
      seqIssue,
      fields,
    });
  }

  const sessions = Array.from(sessionsMap.values());
  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const versions = Array.from(new Set(messages.map((m) => m.beginString).filter(Boolean)));

  return {
    messages,
    sessions,
    findings,
    msgTypeCounts,
    versions,
    stats: {
      messageCount: messages.length,
      sessionCount: sessions.length,
      gapCount,
      dupSeqCount,
      badChecksumCount,
      badBodyLengthCount,
      rejectCount,
      errorCount,
      warningCount,
    },
  };
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildMessagesCsv(parsed, fileName = '') {
  const header = [
    'file', 'index', 'line', 'begin_string', 'session', 'seq_num', 'sending_time',
    'msg_type', 'msg_type_name', 'symbol', 'side', 'order_qty', 'price',
    'cl_ord_id', 'order_id', 'ord_status', 'exec_type', 'cum_qty', 'leaves_qty',
    'avg_px', 'poss_dup', 'checksum_ok', 'body_length_ok', 'seq_issue', 'text',
  ];
  const lines = [header.join(',')];
  for (const m of parsed.messages) {
    lines.push([
      fileName, m.index, m.line, m.beginString, m.session, m.seqNum ?? '', m.sendingTime,
      m.msgType, m.msgTypeName, m.symbol, m.sideName, m.orderQty, m.price,
      m.clOrdId, m.orderId, m.ordStatusName, m.execTypeName, m.cumQty, m.leavesQty,
      m.avgPx, m.possDup ? 'Y' : 'N', m.checksumOk ? 'OK' : 'FAIL', m.bodyLengthOk ? 'OK' : 'FAIL',
      m.seqIssue, m.text,
    ].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

function buildTagsCsv(parsed, fileName = '') {
  const header = ['file', 'msg_index', 'line', 'seq_num', 'msg_type', 'tag', 'tag_name', 'value', 'decoded'];
  const lines = [header.join(',')];
  for (const m of parsed.messages) {
    for (const f of m.fields) {
      lines.push([fileName, m.index, m.line, m.seqNum ?? '', m.msgType, f.tag, f.name, f.value, f.decoded].map(csvCell).join(','));
    }
  }
  return lines.join('\n') + '\n';
}

function buildMessagesJson(parsed, fileName = '') {
  return JSON.stringify({
    file: fileName,
    stats: parsed.stats,
    sessions: parsed.sessions,
    messages: parsed.messages,
  }, null, 2) + '\n';
}

function buildSessionAuditMarkdown(entries) {
  const lines = ['# FIX Session Sequence-Gap and Checksum Audit Report', ''];
  lines.push(`Files checked: ${entries.length}`);
  const totalMsgs = entries.reduce((s, e) => s + e.parsed.stats.messageCount, 0);
  const totalGaps = entries.reduce((s, e) => s + e.parsed.stats.gapCount, 0);
  const totalBadCs = entries.reduce((s, e) => s + e.parsed.stats.badChecksumCount, 0);
  const totalBadBl = entries.reduce((s, e) => s + e.parsed.stats.badBodyLengthCount, 0);
  const totalErr = entries.reduce((s, e) => s + e.parsed.stats.errorCount, 0);
  lines.push(`Total messages: ${totalMsgs}`);
  lines.push(`Sequence gaps: ${totalGaps}`);
  lines.push(`CheckSum errors: ${totalBadCs}`);
  lines.push(`BodyLength errors: ${totalBadBl}`);
  lines.push(`Total errors: ${totalErr}`);
  lines.push('');

  for (const { fileName, parsed } of entries) {
    lines.push(`## ${fileName}`);
    lines.push('');
    lines.push(`- Messages: ${parsed.stats.messageCount}`);
    lines.push(`- Versions: ${parsed.versions.join(', ') || 'none'}`);
    lines.push(`- Sessions: ${parsed.stats.sessionCount}`);
    lines.push(`- Errors: ${parsed.stats.errorCount} | Warnings: ${parsed.stats.warningCount}`);
    lines.push('');
    if (parsed.sessions.length) {
      lines.push('| Session | Version | Messages | Seq Range | Gaps | Duplicates | PossDup | Bad CheckSum | Rejects |');
      lines.push('| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |');
      for (const s of parsed.sessions) {
        const range = s.minSeq !== null ? `${s.minSeq}..${s.maxSeq}` : '-';
        lines.push(`| ${s.session} | ${s.beginString || '-'} | ${s.messageCount} | ${range} | ${s.gaps.length} | ${s.duplicates.length} | ${s.possDupCount} | ${s.badChecksums} | ${s.rejects} |`);
      }
      lines.push('');
    }
    if (parsed.findings.length) {
      lines.push('### Findings');
      lines.push('');
      lines.push('| Severity | Line | Msg # | Field | Detail |');
      lines.push('| --- | ---: | ---: | --- | --- |');
      for (const f of parsed.findings.slice(0, 200)) {
        lines.push(`| ${f.severity.toUpperCase()} | ${f.line} | ${f.msgIndex} | ${f.field} | ${f.finding} |`);
      }
      lines.push('');
    } else {
      lines.push('All sequence, BodyLength and CheckSum checks passed.');
      lines.push('');
    }
  }
  return lines.join('\n');
}

function summarizeOrders(parsed) {
  const orders = new Map();
  for (const m of parsed.messages) {
    const key = m.clOrdId || m.origClOrdId || m.orderId;
    if (!key) continue;
    if (!orders.has(key)) {
      orders.set(key, {
        key,
        symbol: m.symbol,
        side: m.sideName,
        orderQty: m.orderQty,
        price: m.price,
        orderId: m.orderId,
        firstTime: m.sendingTime,
        lastTime: m.sendingTime,
        states: [],
        cumQty: '',
        avgPx: '',
        msgCount: 0,
      });
    }
    const o = orders.get(key);
    o.msgCount += 1;
    if (!o.symbol && m.symbol) o.symbol = m.symbol;
    if (!o.side && m.sideName) o.side = m.sideName;
    if (!o.orderQty && m.orderQty) o.orderQty = m.orderQty;
    if (!o.price && m.price) o.price = m.price;
    if (!o.orderId && m.orderId) o.orderId = m.orderId;
    if (m.sendingTime) o.lastTime = m.sendingTime;
    if (m.cumQty) o.cumQty = m.cumQty;
    if (m.avgPx) o.avgPx = m.avgPx;
    const stateLabel = m.ordStatusName || m.execTypeName || m.msgTypeName;
    if (stateLabel && o.states[o.states.length - 1] !== stateLabel) {
      o.states.push(stateLabel);
    }
  }
  return orders;
}

function buildOrderLifecycleDiffMarkdown(leftName, leftParsed, rightName, rightParsed) {
  const leftOrders = summarizeOrders(leftParsed);
  const rightOrders = summarizeOrders(rightParsed);
  const allKeys = Array.from(new Set([...leftOrders.keys(), ...rightOrders.keys()])).sort();

  const matched = [];
  const onlyLeft = [];
  const onlyRight = [];
  let diffCount = 0;

  for (const k of allKeys) {
    const a = leftOrders.get(k);
    const b = rightOrders.get(k);
    if (a && !b) { onlyLeft.push(a); diffCount += 1; }
    else if (!a && b) { onlyRight.push(b); diffCount += 1; }
    else {
      const aPath = a.states.join(' -> ');
      const bPath = b.states.join(' -> ');
      const same = aPath === bPath && a.cumQty === b.cumQty && a.avgPx === b.avgPx;
      if (!same) diffCount += 1;
      matched.push({ key: k, a, b, aPath, bPath, same });
    }
  }

  const lines = [
    '# FIX Order Lifecycle Comparison Report',
    '',
    `- Left file: ${leftName} (${leftOrders.size} orders, ${leftParsed.stats.messageCount} messages)`,
    `- Right file: ${rightName} (${rightOrders.size} orders, ${rightParsed.stats.messageCount} messages)`,
    `- Matched orders: ${matched.length} | Only in left: ${onlyLeft.length} | Only in right: ${onlyRight.length} | Differences: ${diffCount}`,
    '',
    '## Matched Orders',
    '',
    '| ClOrdID / OrderID | Symbol | Side | Left Lifecycle | Right Lifecycle | Left CumQty / AvgPx | Right CumQty / AvgPx | Status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const m of matched) {
    lines.push(`| ${m.key} | ${m.a.symbol || m.b.symbol || '-'} | ${m.a.side || m.b.side || '-'} | ${m.aPath || '-'} | ${m.bPath || '-'} | ${m.a.cumQty || '-'} @ ${m.a.avgPx || '-'} | ${m.b.cumQty || '-'} @ ${m.b.avgPx || '-'} | ${m.same ? 'MATCH' : 'DIFF'} |`);
  }
  if (!matched.length) lines.push('| (none) | - | - | - | - | - | - | - |');
  lines.push('');

  if (onlyLeft.length) {
    lines.push(`## Only in ${leftName}`);
    lines.push('');
    for (const o of onlyLeft) lines.push(`- ${o.key} (${o.symbol || '-'} ${o.side || '-'}): ${o.states.join(' -> ')}`);
    lines.push('');
  }
  if (onlyRight.length) {
    lines.push(`## Only in ${rightName}`);
    lines.push('');
    for (const o of onlyRight) lines.push(`- ${o.key} (${o.symbol || '-'} ${o.side || '-'}): ${o.states.join(' -> ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  TAG_NAMES,
  MSG_TYPES,
  SIDE_NAMES,
  ORD_STATUS_NAMES,
  EXEC_TYPE_NAMES,
  decodeTagValue,
  computeFixChecksum,
  parseFix,
  buildMessagesCsv,
  buildTagsCsv,
  buildMessagesJson,
  buildSessionAuditMarkdown,
  buildOrderLifecycleDiffMarkdown,
};
