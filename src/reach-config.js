'use strict';
module.exports = {
  prefix: 'zovoFix',
  triesKey: 'zovoFix.proTrial',
  slot: '#protools',
  tools: [
    { id: 'auditSession', title: 'Audit FIX session sequence gaps and checksums', command: 'zovoFix.auditSession' },
    { id: 'exportCsvJson', title: 'Export decoded FIX messages to CSV and JSON', command: 'zovoFix.exportCsvJson' },
    { id: 'diffOrderLifecycle', title: 'Compare order lifecycle across two FIX files', command: 'zovoFix.diffOrderLifecycle' },
  ],
};
