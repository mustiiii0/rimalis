const service = require('./admin.service');

async function getDashboard(req, res, next) {
  try {
    const stats = await service.dashboard();
    return res.json({ success: true, stats });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await service.users();
    return res.json({ success: true, users });
  } catch (err) {
    return next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await service.createUser(req.body);
    return res.status(201).json({ success: true, user });
  } catch (err) {
    return next(err);
  }
}

async function patchUser(req, res, next) {
  try {
    const user = await service.updateUser(req.params.userId, req.body, req.user?.id);
    return res.json({ success: true, user });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const result = await service.removeUser(req.params.userId, req.user?.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
}

async function restoreUser(req, res, next) {
  try {
    const result = await service.restoreUser(req.params.userId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const messages = await service.messages();
    return res.json({ success: true, messages });
  } catch (err) {
    return next(err);
  }
}

async function patchMessageRead(req, res, next) {
  try {
    const message = await service.markRead(req.params.messageId);
    return res.json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function replyMessage(req, res, next) {
  try {
    const message = await service.reply(req.params.messageId, req.body, req.user?.id);
    return res.json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function listSupportAgents(req, res, next) {
  try {
    const agents = await service.supportAgents();
    return res.json({ success: true, agents });
  } catch (err) {
    return next(err);
  }
}

async function patchMessageMeta(req, res, next) {
  try {
    const meta = await service.updateMessageMeta(req.params.messageId, req.body || {});
    return res.json({ success: true, meta });
  } catch (err) {
    return next(err);
  }
}

async function listMessageNotes(req, res, next) {
  try {
    const notes = await service.messageNotes(req.params.messageId);
    return res.json({ success: true, notes });
  } catch (err) {
    return next(err);
  }
}

async function createMessageNote(req, res, next) {
  try {
    const notes = await service.addMessageNote(req.params.messageId, req.body?.note, req.user?.id);
    return res.status(201).json({ success: true, notes });
  } catch (err) {
    return next(err);
  }
}

async function bulkMessages(req, res, next) {
  try {
    const result = await service.bulkMessages(req.body || {}, req.user?.id);
    return res.json({ success: true, result });
  } catch (err) {
    return next(err);
  }
}

async function listSupportMacros(req, res, next) {
  try {
    const macros = await service.supportMacros();
    return res.json({ success: true, macros });
  } catch (err) {
    return next(err);
  }
}

async function createSupportMacro(req, res, next) {
  try {
    const macro = await service.createSupportMacro(req.body || {}, req.user?.id);
    return res.status(201).json({ success: true, macro });
  } catch (err) {
    return next(err);
  }
}

async function deleteSupportMacro(req, res, next) {
  try {
    const deleted = await service.deleteSupportMacro(req.params.macroId);
    return res.json({ success: true, deleted });
  } catch (err) {
    return next(err);
  }
}

async function listAuditEntries(req, res, next) {
  try {
    const entries = await service.auditEntries(req.query || {});
    return res.json({ success: true, entries });
  } catch (err) {
    return next(err);
  }
}

function toCsv(entries) {
  const header = [
    'createdAt',
    'actorName',
    'actorEmail',
    'action',
    'outcome',
    'method',
    'path',
    'ipAddress',
    'requestId',
  ];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = entries.map((entry) => {
    const action = entry.metadata?.action || '';
    const outcome = entry.metadata?.outcome || '';
    return [
      entry.createdAt || '',
      entry.actorName || '',
      entry.actorEmail || '',
      action,
      outcome,
      entry.method || '',
      entry.path || '',
      entry.ipAddress || '',
      entry.requestId || '',
    ].map(escape).join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

async function exportAuditEntriesCsv(req, res, next) {
  try {
    const entries = await service.auditEntries(req.query || {});
    const csv = toCsv(entries);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"admin-audit-log.csv\"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const settings = await service.settings();
    return res.json({ success: true, settings });
  } catch (err) {
    return next(err);
  }
}

async function patchSettings(req, res, next) {
  try {
    const settings = await service.saveSettings(req.body);
    return res.json({ success: true, settings });
  } catch (err) {
    return next(err);
  }
}

async function getSiteControls(req, res, next) {
  try {
    const controls = await service.siteControls();
    return res.json({ success: true, controls });
  } catch (err) {
    return next(err);
  }
}

async function patchSiteControls(req, res, next) {
  try {
    const controls = await service.saveSiteControls(req.body, req.user?.id, req.ip);
    return res.json({ success: true, controls });
  } catch (err) {
    return next(err);
  }
}

async function listSiteControlVersions(req, res, next) {
  try {
    const versions = await service.siteControlVersions();
    return res.json({ success: true, versions });
  } catch (err) {
    return next(err);
  }
}

async function listSiteControlAudit(req, res, next) {
  try {
    const entries = await service.siteControlAudit();
    return res.json({ success: true, entries });
  } catch (err) {
    return next(err);
  }
}

async function restoreSiteControlVersion(req, res, next) {
  try {
    const controls = await service.restoreSiteControlVersion(req.params.versionId, req.user?.id, req.ip);
    return res.json({ success: true, controls });
  } catch (err) {
    return next(err);
  }
}

async function rotateSitePreviewToken(req, res, next) {
  try {
    const preview = await service.rotatePreviewToken(req.user?.id, req.ip);
    return res.json({ success: true, preview });
  } catch (err) {
    return next(err);
  }
}

async function getMediaHealth(req, res, next) {
  try {
    const health = await service.mediaHealth();
    return res.json({ success: true, health });
  } catch (err) {
    return next(err);
  }
}

async function postMediaCleanup(req, res, next) {
  try {
    const result = await service.cleanupMedia(req.body || {});
    return res.json({ success: true, result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDashboard,
  listUsers,
  createUser,
  patchUser,
  deleteUser,
  restoreUser,
  listMessages,
  patchMessageRead,
  replyMessage,
  listSupportAgents,
  patchMessageMeta,
  listMessageNotes,
  createMessageNote,
  bulkMessages,
  listSupportMacros,
  createSupportMacro,
  deleteSupportMacro,
  getSettings,
  patchSettings,
  getSiteControls,
  patchSiteControls,
  listSiteControlVersions,
  listSiteControlAudit,
  restoreSiteControlVersion,
  rotateSitePreviewToken,
  listAuditEntries,
  exportAuditEntriesCsv,
  getMediaHealth,
  postMediaCleanup,
};
