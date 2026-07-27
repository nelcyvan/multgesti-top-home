import express from "express";
import multer from "multer";
import fs from "node:fs";
import {
  createDatabasePool,
  clearZapHubTelevendasPrincipal,
  desvincularZapHubInstanceResponsavel,
  fetchZapHubInstanceAccessInstanceNamesByUsuario,
  fetchZapHubInstanceAcessosByUsuario,
  fetchZapHubInstanceAcessosResumo,
  fetchZapHubTelevendasPrincipal,
  fetchMessageMediaRequestById,
  fetchConversationMessages,
  fetchConversationMessagesSignature,
  fetchPuxadasConversasByUsuario,
  fetchPuxadasBadgesByUsuario,
  fetchPuxadasMensagensByUsuario,
  encerrarZapHubPuxadasConversa,
  iniciarOuReabrirZapHubConversaPuxada,
  puxarZapHubMensagem,
  fetchInstanceConversations,
  fetchInstanceConversationsSignature,
  fetchOpenInstanceMessages,
  fetchOpenInstanceMessagesSignature,
  fetchUnreadCountsByInstanceNames,
  normalizeZapHubInstanceKey,
  resolveCanonicalInstanceNamesByKeys,
  fetchZapHubInstanceResponsaveisMap,
  grantZapHubInstanceAcesso,
  revokeZapHubInstanceAcesso,
  setZapHubTelevendasPrincipal,
  vincularZapHubInstanceResponsavel,
  markChatAsRead,
  mergeContactJids,
  upsertZapHubEventJidLink,
  fetchInstanceNumberById,
  fetchInstanceIdByName,
  fetchInstanceNameById,
  fetchInstanceIdsByNames,
  fetchInstanceIdsByNumbers,
} from "./zaphubInstancias.db.js";
import { createEvolutionClient, extractEvolutionMessage } from "./zaphubInstancias.evolution.js";

let evolutionLogIngestorStarted = false;

function extractBase64Payload(payload) {
  const candidates = [
    payload?.base64,
    payload?.data?.base64,
    payload?.message?.base64,
    payload?.response?.base64,
    payload?.response?.message?.base64,
  ];

  const base64 = candidates.find((value) => typeof value === "string" && value.trim());
  const mimetype =
    payload?.mimetype ||
    payload?.data?.mimetype ||
    payload?.message?.mimetype ||
    payload?.response?.mimetype ||
    payload?.response?.message?.mimetype ||
    null;
  const fileName =
    payload?.fileName ||
    payload?.data?.fileName ||
    payload?.message?.fileName ||
    payload?.response?.fileName ||
    payload?.response?.message?.fileName ||
    null;
  const mediaType =
    payload?.mediaType ||
    payload?.data?.mediaType ||
    payload?.message?.mediaType ||
    payload?.response?.mediaType ||
    payload?.response?.message?.mediaType ||
    null;

  return {
    base64: typeof base64 === "string" ? base64.trim() : null,
    mimetype: typeof mimetype === "string" && mimetype.trim() ? mimetype.trim() : null,
    fileName: typeof fileName === "string" && fileName.trim() ? fileName.trim() : null,
    mediaType: typeof mediaType === "string" && mediaType.trim() ? mediaType.trim() : null,
  };
}

function extractQrPayload(payload) {
  const candidates = [
    payload?.base64,
    payload?.qrcode,
    payload?.qrCode,
    payload?.qr,
    payload?.qrcode?.base64,
    payload?.qrCode?.base64,
    payload?.qr?.base64,
    payload?.data?.base64,
    payload?.data?.qrcode,
    payload?.data?.qrCode,
    payload?.data?.qr,
    payload?.data?.qrcode?.base64,
    payload?.data?.qrCode?.base64,
    payload?.data?.qr?.base64,
    payload?.response?.base64,
    payload?.response?.qrcode,
    payload?.response?.qrCode,
    payload?.response?.qr,
    payload?.response?.qrcode?.base64,
    payload?.response?.qrCode?.base64,
    payload?.response?.qr?.base64,
  ];

  const base64 = candidates.find((value) => typeof value === "string" && value.trim()) || null;
  const pairingCode =
    payload?.pairingCode ||
    payload?.data?.pairingCode ||
    payload?.response?.pairingCode ||
    payload?.code ||
    payload?.data?.code ||
    payload?.response?.code ||
    null;

  return {
    base64: typeof base64 === "string" ? base64.trim() : null,
    pairingCode: typeof pairingCode === "string" && pairingCode.trim() ? pairingCode.trim() : null,
  };
}

function toDataUrl(base64, mimetype = "application/octet-stream") {
  const normalized = String(base64 || "").trim();
  if (!normalized) return null;
  return normalized.startsWith("data:") ? normalized : `data:${mimetype};base64,${normalized}`;
}

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function normalizeEventText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeJidValue(value) {
  const raw = String(value || "").trim().replace(/^`+|`+$/g, "").trim();
  if (!raw || !raw.includes("@")) return null;
  if (raw === "status@broadcast" || raw === "0@s.whatsapp.net") return null;
  return raw;
}

function extractEventFieldsFromLogLine(line, acc) {
  const text = String(line || "");
  const eventMatch = text.match(/\bevent:\s*'([^']+)'/);
  if (eventMatch && !acc.event) acc.event = eventMatch[1];
  const instanceMatch = text.match(/\binstance:\s*'([^']+)'/);
  if (instanceMatch && !acc.instance) acc.instance = instanceMatch[1];
  const instanceIdMatch = text.match(/\binstanceId:\s*'([^']+)'/);
  if (instanceIdMatch && !acc.instanceId) acc.instanceId = instanceIdMatch[1];
  const remoteAltMatch = text.match(/\bremoteJidAlt:\s*'([^']+)'/);
  if (remoteAltMatch && !acc.remoteJidAlt) acc.remoteJidAlt = remoteAltMatch[1];
  const remoteMatch = text.match(/\bremoteJid:\s*'([^']+)'/);
  if (remoteMatch) {
    const value = remoteMatch[1];
    if (!acc.remoteJid) acc.remoteJid = value;
  }
}

function buildEvolutionPayloadFromLogFields(fields) {
  const remoteJid = normalizeJidValue(fields.remoteJid);
  const remoteJidAlt = normalizeJidValue(fields.remoteJidAlt);
  const instanceId = String(fields.instanceId || "").trim() || null;
  const event = String(fields.event || "").trim() || "unknown";
  const instance = String(fields.instance || "").trim() || null;
  if (!instanceId || !remoteJid || !remoteJidAlt) return null;
  return {
    event,
    instance,
    remoteJidAlt,
    data: {
      remoteJid,
      remoteJidAlt,
      instanceId,
    },
  };
}

function pushUniqueJid(target, value) {
  const normalized = normalizeJidValue(value);
  if (!normalized || target.includes(normalized)) return;
  target.push(normalized);
}

function extractRemoteJidsFromNode(node, bucket) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((item) => extractRemoteJidsFromNode(item, bucket));
    return;
  }

  pushUniqueJid(bucket, node.remoteJid);
  pushUniqueJid(bucket, node.remoteJidAlt);
  pushUniqueJid(bucket, node?.key?.remoteJid);
  pushUniqueJid(bucket, node?.data?.remoteJid);
  pushUniqueJid(bucket, node?.data?.remoteJidAlt);
  pushUniqueJid(bucket, node?.data?.key?.remoteJid);
}

function extractInstanceIdsFromNode(node, bucket) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((item) => extractInstanceIdsFromNode(item, bucket));
    return;
  }

  const raw = String(node.instanceId || node.instance_id || node?.data?.instanceId || "").trim();
  if (raw && !bucket.includes(raw)) bucket.push(raw);
}

function normalizeEvolutionEventForJidSync(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const event = normalizeEventText(body.event) || "unknown";
  const remoteJidAlt = normalizeJidValue(
    body.remoteJidAlt || body?.data?.remoteJidAlt || body?.data?.key?.remoteJidAlt || body.altRemoteJid
  );
  const senderJid = normalizeJidValue(body.sender || body.senderJid || body?.data?.sender || body?.data?.senderJid);
  const preferredAltJid = remoteJidAlt || senderJid;
  const remoteJids = [];
  const instanceIds = [];
  const instanceName = normalizeEventText(body.instanceName || body.instance || body?.data?.instanceName || body?.data?.instance);

  extractRemoteJidsFromNode(body.data, remoteJids);
  extractRemoteJidsFromNode(body, remoteJids);
  extractInstanceIdsFromNode(body.data, instanceIds);
  extractInstanceIdsFromNode(body, instanceIds);

  const syncPairs = Array.from(
    new Map(
      remoteJids
        .map((remoteJid) => ({ remoteJid, senderJid: preferredAltJid }))
        .filter((item) => item.remoteJid || item.senderJid)
        .filter((item) => item.remoteJid !== item.senderJid)
        .map((item) => [`${item.remoteJid || ""}::${item.senderJid || ""}`, item])
    ).values()
  );

  return {
    event,
    instance: normalizeEventText(body.instance) || instanceName,
    remoteJidAlt: remoteJidAlt || null,
    senderJid,
    remoteJids,
    instanceIds,
    syncPairs,
    rawType: Array.isArray(body.data) ? "array" : typeof body.data,
  };
}

function normalizeEvolutionEventBatchForJidSync(payload) {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeEvolutionEventForJidSync(item));
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.events)) {
    return payload.events.map((item) => normalizeEvolutionEventForJidSync(item));
  }

  return [normalizeEvolutionEventForJidSync(payload)];
}

function createMessagesRealtimeHub({ databasePool, defaultLimit = 80, pollIntervalMs = 3000, heartbeatMs = 15000 }) {
  const channels = new Map();

  function getChannelKey(instanceName = null, instanceId = null) {
    const safeId = String(instanceId || "").trim();
    if (safeId) return `id:${safeId}`;
    const safe = String(instanceName || "").trim().toLowerCase();
    return safe ? `name:${safe}` : "__open__";
  }

  function getOrCreateChannel(instanceName = null, instanceId = null) {
    const key = getChannelKey(instanceName, instanceId);
    if (!channels.has(key)) {
      channels.set(key, {
        instanceName: String(instanceName || "").trim() || null,
        instanceId: String(instanceId || "").trim() || null,
        clients: new Set(),
        pollTimer: null,
        lastSignature: null,
        pollInFlight: false,
        requestedLimit: defaultLimit,
      });
    }
    return channels.get(key);
  }

  function stopPollingIfIdle(channel) {
    if (channel.clients.size > 0 || !channel.pollTimer) return;
    clearInterval(channel.pollTimer);
    channel.pollTimer = null;
    channel.lastSignature = null;
    channel.requestedLimit = defaultLimit;
    channels.delete(getChannelKey(channel.instanceName, channel.instanceId));
  }

  function refreshChannelRequestedLimit(channel) {
    let nextLimit = defaultLimit;
    for (const client of channel.clients) {
      const clientLimit = Number(client.limit);
      if (Number.isFinite(clientLimit) && clientLimit > nextLimit) {
        nextLimit = clientLimit;
      }
    }
    channel.requestedLimit = nextLimit;
  }

  function broadcast(channel, payload) {
    for (const client of channel.clients) {
      if (client.res.writableEnded || client.res.destroyed) {
        clearInterval(client.heartbeatTimer);
        channel.clients.delete(client);
        continue;
      }
      writeSseEvent(client.res, payload);
    }
    stopPollingIfIdle(channel);
  }

  async function sendSnapshot(channel, res, limit, type = "snapshot") {
    const snapshot = await fetchOpenInstanceMessages({
      databasePool,
      limit,
      instanceName: channel.instanceName,
      instanceId: channel.instanceId,
    });
    channel.lastSignature = snapshot.signature;
    writeSseEvent(res, {
      type,
      sentAt: new Date().toISOString(),
      instance: snapshot.instance,
      rows: snapshot.rows,
    });
  }

  async function pollForChanges(channel) {
    if (channel.pollInFlight || channel.clients.size === 0) return;
    channel.pollInFlight = true;

    try {
      const nextSignature = await fetchOpenInstanceMessagesSignature({
        databasePool,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
      });

      if (channel.lastSignature == null) {
        channel.lastSignature = nextSignature.signature;
        return;
      }

      if (nextSignature.signature === channel.lastSignature) return;

      const snapshot = await fetchOpenInstanceMessages({
        databasePool,
        limit: channel.requestedLimit || defaultLimit,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
      });
      channel.lastSignature = snapshot.signature;
      broadcast(channel, {
        type: "update",
        sentAt: new Date().toISOString(),
        instance: snapshot.instance,
        rows: snapshot.rows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao atualizar stream de mensagens";
      broadcast(channel, {
        type: "error",
        sentAt: new Date().toISOString(),
        message,
      });
    } finally {
      channel.pollInFlight = false;
    }
  }

  function ensurePolling(channel) {
    if (channel.pollTimer || channel.clients.size === 0) return;
    channel.pollTimer = setInterval(() => {
      pollForChanges(channel).catch(() => {});
    }, pollIntervalMs);
  }

  return {
    async subscribe(req, res, limit = defaultLimit, instanceName = null, instanceId = null) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      res.write("retry: 3000\n\n");

      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(": keep-alive\n\n");
        }
      }, heartbeatMs);

      const channel = getOrCreateChannel(instanceName, instanceId);
      const client = { res, heartbeatTimer, limit };
      channel.clients.add(client);
      refreshChannelRequestedLimit(channel);
      ensurePolling(channel);

      try {
        await sendSnapshot(channel, res, limit, "snapshot");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro interno ao inicializar stream de mensagens";
        writeSseEvent(res, {
          type: "error",
          sentAt: new Date().toISOString(),
          message,
        });
      }

      const close = () => {
        clearInterval(heartbeatTimer);
        channel.clients.delete(client);
        refreshChannelRequestedLimit(channel);
        stopPollingIfIdle(channel);
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on("close", close);
      req.on("end", close);
    },
  };
}

function createConversationsRealtimeHub({ databasePool, defaultLimit = 40, pollIntervalMs = 3000, heartbeatMs = 15000 }) {
  const channels = new Map();

  function getChannelKey(instanceName = null, instanceId = null, excludePulled = false) {
    const safeId = String(instanceId || "").trim();
    const pulledSuffix = excludePulled ? ":xpull" : "";
    if (safeId) return `id:${safeId}${pulledSuffix}`;
    const safe = String(instanceName || "").trim().toLowerCase();
    return safe ? `name:${safe}${pulledSuffix}` : `__open__${pulledSuffix}`;
  }

  function getOrCreateChannel(instanceName = null, instanceId = null, excludePulled = false) {
    const key = getChannelKey(instanceName, instanceId, excludePulled);
    if (!channels.has(key)) {
      channels.set(key, {
        instanceName: String(instanceName || "").trim() || null,
        instanceId: String(instanceId || "").trim() || null,
        excludePulled: Boolean(excludePulled),
        clients: new Set(),
        pollTimer: null,
        lastSignature: null,
        pollInFlight: false,
        requestedLimit: defaultLimit,
      });
    }
    return channels.get(key);
  }

  function stopPollingIfIdle(channel) {
    if (channel.clients.size > 0 || !channel.pollTimer) return;
    clearInterval(channel.pollTimer);
    channel.pollTimer = null;
    channel.lastSignature = null;
    channel.requestedLimit = defaultLimit;
    channels.delete(getChannelKey(channel.instanceName, channel.instanceId, channel.excludePulled));
  }

  function refreshChannelRequestedLimit(channel) {
    let nextLimit = defaultLimit;
    for (const client of channel.clients) {
      const clientLimit = Number(client.limit);
      if (Number.isFinite(clientLimit) && clientLimit > nextLimit) {
        nextLimit = clientLimit;
      }
    }
    channel.requestedLimit = nextLimit;
  }

  function broadcast(channel, payload) {
    for (const client of channel.clients) {
      if (client.res.writableEnded || client.res.destroyed) {
        clearInterval(client.heartbeatTimer);
        channel.clients.delete(client);
        continue;
      }
      writeSseEvent(client.res, payload);
    }
    stopPollingIfIdle(channel);
  }

  async function sendSnapshot(channel, res, limit, type = "snapshot") {
    const snapshot = await fetchInstanceConversations({
      databasePool,
      limit,
      instanceName: channel.instanceName,
      instanceId: channel.instanceId,
      excludePulled: channel.excludePulled,
    });
    const signatureData = await fetchInstanceConversationsSignature({
      databasePool,
      instanceName: channel.instanceName,
      instanceId: channel.instanceId,
    });
    channel.lastSignature = signatureData.signature;
    writeSseEvent(res, {
      type,
      sentAt: new Date().toISOString(),
      instance: snapshot.instance,
      rows: snapshot.rows,
    });
  }

  async function pollForChanges(channel) {
    if (channel.pollInFlight || channel.clients.size === 0) return;
    channel.pollInFlight = true;
    try {
      const nextSignature = await fetchInstanceConversationsSignature({
        databasePool,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
      });

      if (channel.lastSignature == null) {
        channel.lastSignature = nextSignature.signature;
        return;
      }
      if (nextSignature.signature === channel.lastSignature) return;

      const snapshot = await fetchInstanceConversations({
        databasePool,
        limit: channel.requestedLimit || defaultLimit,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
        excludePulled: channel.excludePulled,
      });
      channel.lastSignature = nextSignature.signature;
      broadcast(channel, {
        type: "update",
        sentAt: new Date().toISOString(),
        instance: snapshot.instance,
        rows: snapshot.rows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao atualizar stream de conversas";
      broadcast(channel, {
        type: "error",
        sentAt: new Date().toISOString(),
        message,
      });
    } finally {
      channel.pollInFlight = false;
    }
  }

  function ensurePolling(channel) {
    if (channel.pollTimer || channel.clients.size === 0) return;
    channel.pollTimer = setInterval(() => {
      pollForChanges(channel).catch(() => {});
    }, pollIntervalMs);
  }

  return {
    async subscribe(req, res, limit = defaultLimit, instanceName = null, instanceId = null, excludePulled = false) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      res.write("retry: 3000\n\n");

      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(": keep-alive\n\n");
        }
      }, heartbeatMs);

      const channel = getOrCreateChannel(instanceName, instanceId, excludePulled);
      const client = { res, heartbeatTimer, limit };
      channel.clients.add(client);
      refreshChannelRequestedLimit(channel);
      ensurePolling(channel);

      try {
        await sendSnapshot(channel, res, limit, "snapshot");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro interno ao inicializar stream de conversas";
        writeSseEvent(res, {
          type: "error",
          sentAt: new Date().toISOString(),
          message,
        });
      }

      const close = () => {
        clearInterval(heartbeatTimer);
        channel.clients.delete(client);
        refreshChannelRequestedLimit(channel);
        stopPollingIfIdle(channel);
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on("close", close);
      req.on("end", close);
    },
  };
}

function createConversationMessagesRealtimeHub({ databasePool, defaultLimit = 80, pollIntervalMs = 3000, heartbeatMs = 15000 }) {
  const channels = new Map();

  function getChannelKey(
    instanceName = null,
    instanceId = null,
    remoteJid = null,
    excludePulled = false,
    onlyPulledForMatricula = null,
    onlyPulledEncerradas = null
  ) {
    const safeRemoteJid = String(remoteJid || "").trim();
    const safeId = String(instanceId || "").trim();
    const filterSuffix = onlyPulledForMatricula
      ? `:pull:${String(onlyPulledForMatricula).trim()}:${onlyPulledEncerradas === true ? "closed" : onlyPulledEncerradas === false ? "open" : "all"}`
      : excludePulled
      ? ":xpull"
      : "";
    if (safeId && safeRemoteJid) return `id:${safeId}:jid:${safeRemoteJid}${filterSuffix}`;
    const safeName = String(instanceName || "").trim().toLowerCase();
    return `${safeName || "__open__"}:jid:${safeRemoteJid || "__none__"}${filterSuffix}`;
  }

  function getOrCreateChannel(
    instanceName = null,
    instanceId = null,
    remoteJid = null,
    excludePulled = false,
    onlyPulledForMatricula = null,
    onlyPulledEncerradas = null
  ) {
    const key = getChannelKey(instanceName, instanceId, remoteJid, excludePulled, onlyPulledForMatricula, onlyPulledEncerradas);
    if (!channels.has(key)) {
      channels.set(key, {
        instanceName: String(instanceName || "").trim() || null,
        instanceId: String(instanceId || "").trim() || null,
        remoteJid: String(remoteJid || "").trim() || null,
        excludePulled: Boolean(excludePulled),
        onlyPulledForMatricula: String(onlyPulledForMatricula || "").trim() || null,
        onlyPulledEncerradas: onlyPulledEncerradas === true ? true : onlyPulledEncerradas === false ? false : null,
        clients: new Set(),
        pollTimer: null,
        lastSignature: null,
        pollInFlight: false,
        requestedLimit: defaultLimit,
      });
    }
    return channels.get(key);
  }

  function stopPollingIfIdle(channel) {
    if (channel.clients.size > 0 || !channel.pollTimer) return;
    clearInterval(channel.pollTimer);
    channel.pollTimer = null;
    channel.lastSignature = null;
    channel.requestedLimit = defaultLimit;
    channels.delete(
      getChannelKey(
        channel.instanceName,
        channel.instanceId,
        channel.remoteJid,
        channel.excludePulled,
        channel.onlyPulledForMatricula,
        channel.onlyPulledEncerradas
      )
    );
  }

  function refreshChannelRequestedLimit(channel) {
    let nextLimit = defaultLimit;
    for (const client of channel.clients) {
      const clientLimit = Number(client.limit);
      if (Number.isFinite(clientLimit) && clientLimit > nextLimit) {
        nextLimit = clientLimit;
      }
    }
    channel.requestedLimit = nextLimit;
  }

  function broadcast(channel, payload) {
    for (const client of channel.clients) {
      if (client.res.writableEnded || client.res.destroyed) {
        clearInterval(client.heartbeatTimer);
        channel.clients.delete(client);
        continue;
      }
      writeSseEvent(client.res, payload);
    }
    stopPollingIfIdle(channel);
  }

  async function sendSnapshot(channel, res, limit, type = "snapshot") {
    const snapshot = await fetchConversationMessages({
      databasePool,
      limit,
      instanceName: channel.instanceName,
      instanceId: channel.instanceId,
      remoteJid: channel.remoteJid,
      excludePulled: channel.excludePulled,
      onlyPulledForMatricula: channel.onlyPulledForMatricula,
      onlyPulledEncerradas: channel.onlyPulledEncerradas,
    });
    const signatureData = await fetchConversationMessagesSignature({
      databasePool,
      instanceName: channel.instanceName,
      instanceId: channel.instanceId,
      remoteJid: channel.remoteJid,
    });
    channel.lastSignature = signatureData.signature;
    writeSseEvent(res, {
      type,
      sentAt: new Date().toISOString(),
      instance: snapshot.instance,
      remoteJid: channel.remoteJid,
      rows: snapshot.rows,
    });
  }

  async function pollForChanges(channel) {
    if (channel.pollInFlight || channel.clients.size === 0) return;
    channel.pollInFlight = true;
    try {
      const nextSignature = await fetchConversationMessagesSignature({
        databasePool,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
        remoteJid: channel.remoteJid,
      });

      if (channel.lastSignature == null) {
        channel.lastSignature = nextSignature.signature;
        return;
      }
      if (nextSignature.signature === channel.lastSignature) return;

      const snapshot = await fetchConversationMessages({
        databasePool,
        limit: channel.requestedLimit || defaultLimit,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
        remoteJid: channel.remoteJid,
        excludePulled: channel.excludePulled,
        onlyPulledForMatricula: channel.onlyPulledForMatricula,
        onlyPulledEncerradas: channel.onlyPulledEncerradas,
      });
      channel.lastSignature = nextSignature.signature;
      broadcast(channel, {
        type: "update",
        sentAt: new Date().toISOString(),
        instance: snapshot.instance,
        remoteJid: channel.remoteJid,
        rows: snapshot.rows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao atualizar stream de mensagens da conversa";
      broadcast(channel, {
        type: "error",
        sentAt: new Date().toISOString(),
        remoteJid: channel.remoteJid,
        message,
      });
    } finally {
      channel.pollInFlight = false;
    }
  }

  function ensurePolling(channel) {
    if (channel.pollTimer || channel.clients.size === 0) return;
    channel.pollTimer = setInterval(() => {
      pollForChanges(channel).catch(() => {});
    }, pollIntervalMs);
  }

  return {
    async subscribe(
      req,
      res,
      limit = defaultLimit,
      instanceName = null,
      instanceId = null,
      remoteJid = null,
      excludePulled = false,
      onlyPulledForMatricula = null,
      onlyPulledEncerradas = null
    ) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      res.write("retry: 3000\n\n");

      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(": keep-alive\n\n");
        }
      }, heartbeatMs);

      const channel = getOrCreateChannel(instanceName, instanceId, remoteJid, excludePulled, onlyPulledForMatricula, onlyPulledEncerradas);
      const client = { res, heartbeatTimer, limit };
      channel.clients.add(client);
      refreshChannelRequestedLimit(channel);
      ensurePolling(channel);

      try {
        await sendSnapshot(channel, res, limit, "snapshot");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro interno ao inicializar stream de mensagens da conversa";
        writeSseEvent(res, {
          type: "error",
          sentAt: new Date().toISOString(),
          remoteJid: channel.remoteJid,
          message,
        });
      }

      const close = () => {
        clearInterval(heartbeatTimer);
        channel.clients.delete(client);
        refreshChannelRequestedLimit(channel);
        stopPollingIfIdle(channel);
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on("close", close);
      req.on("end", close);
    },
  };
}

function createUnreadCountsRealtimeHub({ databasePool, pollIntervalMs = 3000, heartbeatMs = 15000 }) {
  const instanceChannels = new Map();
  const matriculaChannels = new Map();

  function getChannelKey(instanceName) {
    return normalizeZapHubInstanceKey(instanceName);
  }

  function getOrCreateChannel(instanceName) {
    const key = getChannelKey(instanceName);
    if (!instanceChannels.has(key)) {
      instanceChannels.set(key, {
        instanceName: String(instanceName || "").trim(),
        clients: new Set(),
        pollTimer: null,
        lastUnreadCount: null,
        pollInFlight: false,
      });
    }
    return instanceChannels.get(key);
  }

  function getMatriculaKey(matricula) {
    return String(matricula || "").trim().toLowerCase();
  }

  function getOrCreateMatriculaChannel(matricula) {
    const key = getMatriculaKey(matricula);
    if (!matriculaChannels.has(key)) {
      matriculaChannels.set(key, {
        matricula: String(matricula || "").trim(),
        clients: new Set(),
        pollTimer: null,
        lastCounts: null,
        pollInFlight: false,
      });
    }
    return matriculaChannels.get(key);
  }

  function stopPollingIfIdle(channel) {
    if (channel.clients.size > 0 || !channel.pollTimer) return;
    clearInterval(channel.pollTimer);
    channel.pollTimer = null;
    if ("instanceName" in channel) {
      channel.lastUnreadCount = null;
      instanceChannels.delete(getChannelKey(channel.instanceName));
      return;
    }
    channel.lastCounts = null;
    matriculaChannels.delete(getMatriculaKey(channel.matricula));
  }

  function broadcast(channel, payload) {
    for (const client of channel.clients) {
      if (client.res.writableEnded || client.res.destroyed) {
        clearInterval(client.heartbeatTimer);
        channel.clients.delete(client);
        continue;
      }
      writeSseEvent(client.res, payload);
    }
    stopPollingIfIdle(channel);
  }

  async function readUnreadCount(channel) {
    const unreadCountsMap = await fetchUnreadCountsByInstanceNames({
      databasePool,
      instanceNames: [channel.instanceName],
    }).catch(() => ({}));
    return Number(unreadCountsMap[normalizeZapHubInstanceKey(channel.instanceName)]) || 0;
  }

  async function sendSnapshot(channel, res, type = "snapshot") {
    const unreadCount = await readUnreadCount(channel);
    channel.lastUnreadCount = unreadCount;
    writeSseEvent(res, {
      type,
      sentAt: new Date().toISOString(),
      instanceName: channel.instanceName,
      instanceKey: getChannelKey(channel.instanceName),
      unreadCount,
    });
  }

  async function readUnreadCountsForMatricula(matricula) {
    const safeMatricula = String(matricula || "").trim();
    if (!safeMatricula) return {};
    const allowedNames = await fetchZapHubInstanceAccessInstanceNamesByUsuario({ databasePool, matricula: safeMatricula }).catch(() => []);
    const instanceNames = Array.from(
      new Set((Array.isArray(allowedNames) ? allowedNames : []).map((name) => String(name || "").trim()).filter(Boolean))
    );
    if (!instanceNames.length) return {};

    const canonicalNamesByKey = await resolveCanonicalInstanceNamesByKeys({ databasePool, instanceNames }).catch(() => ({}));
    const unreadCountsMap = await fetchUnreadCountsByInstanceNames({ databasePool, instanceNames }).catch(() => ({}));
    const counts = {};
    instanceNames.forEach((name) => {
      const key = normalizeZapHubInstanceKey(name);
      if (!key) return;
      const displayName = canonicalNamesByKey[key] || String(name || "").trim();
      counts[displayName] = Number(unreadCountsMap[key]) || 0;
    });
    return counts;
  }

  async function sendMatriculaSnapshot(channel, res, type = "snapshot") {
    const counts = await readUnreadCountsForMatricula(channel.matricula);
    channel.lastCounts = counts;
    writeSseEvent(res, {
      type,
      sentAt: new Date().toISOString(),
      counts,
    });
  }

  async function pollForChanges(channel) {
    if (channel.pollInFlight || channel.clients.size === 0) return;
    channel.pollInFlight = true;

    try {
      if (!("instanceName" in channel)) {
        const nextCounts = await readUnreadCountsForMatricula(channel.matricula);
        const prevCounts = channel.lastCounts || {};
        const keys = Array.from(new Set([...Object.keys(prevCounts), ...Object.keys(nextCounts)]));
        if (!channel.lastCounts) {
          channel.lastCounts = nextCounts;
          return;
        }
        keys.forEach((key) => {
          const prev = Number(prevCounts[key] || 0);
          const next = Number(nextCounts[key] || 0);
          if (prev === next) return;
          broadcast(channel, {
            type: "update",
            sentAt: new Date().toISOString(),
            instanceName: key,
            unreadCount: next,
          });
        });
        channel.lastCounts = nextCounts;
        return;
      }

      const nextUnreadCount = await readUnreadCount(channel);

      if (channel.lastUnreadCount == null) {
        channel.lastUnreadCount = nextUnreadCount;
        return;
      }

      if (nextUnreadCount === channel.lastUnreadCount) return;

      channel.lastUnreadCount = nextUnreadCount;
      broadcast(channel, {
        type: "update",
        sentAt: new Date().toISOString(),
        instanceName: channel.instanceName,
        instanceKey: getChannelKey(channel.instanceName),
        unreadCount: nextUnreadCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao atualizar stream de contagem";
      broadcast(channel, {
        type: "error",
        sentAt: new Date().toISOString(),
        instanceName: channel.instanceName,
        message,
      });
    } finally {
      channel.pollInFlight = false;
    }
  }

  function ensurePolling(channel) {
    if (channel.pollTimer || channel.clients.size === 0) return;
    channel.pollTimer = setInterval(() => {
      pollForChanges(channel).catch(() => {});
    }, pollIntervalMs);
  }

  return {
    async subscribeInstance(req, res, instanceName) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      res.write("retry: 3000\n\n");

      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(": keep-alive\n\n");
        }
      }, heartbeatMs);

      const channel = getOrCreateChannel(instanceName);
      const client = { res, heartbeatTimer };
      channel.clients.add(client);
      ensurePolling(channel);

      try {
        await sendSnapshot(channel, res, "snapshot");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro interno ao inicializar stream da contagem";
        writeSseEvent(res, {
          type: "error",
          sentAt: new Date().toISOString(),
          instanceName: channel.instanceName,
          message,
        });
      }

      const close = () => {
        clearInterval(heartbeatTimer);
        channel.clients.delete(client);
        stopPollingIfIdle(channel);
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on("close", close);
      req.on("end", close);
    },
    async subscribeByMatricula(req, res, matricula) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      res.write("retry: 3000\n\n");

      const heartbeatTimer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(": keep-alive\n\n");
        }
      }, heartbeatMs);

      const channel = getOrCreateMatriculaChannel(matricula);
      const client = { res, heartbeatTimer };
      channel.clients.add(client);
      ensurePolling(channel);

      try {
        await sendMatriculaSnapshot(channel, res, "snapshot");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro interno ao inicializar stream da contagem";
        writeSseEvent(res, {
          type: "error",
          sentAt: new Date().toISOString(),
          message,
        });
      }

      const close = () => {
        clearInterval(heartbeatTimer);
        channel.clients.delete(client);
        stopPollingIfIdle(channel);
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on("close", close);
      req.on("end", close);
    },
  };
}

export default function createZapHubInstanciasRouter({ fetchCompat }) {
  const router = express.Router();
  const databasePool = createDatabasePool(process.env.DATABASE_URL);
  // #region debug-point A:instancias-permitidas-reporter
  const __dbgUrl = String(process.env.DEBUG_SERVER_URL || "http://127.0.0.1:7777/event").trim();
  const __dbgSession = String(process.env.DEBUG_SESSION_ID || "instancias-permitidas-freeze").trim() || "instancias-permitidas-freeze";
  const __dbgRunId = String(process.env.DEBUG_RUN_ID || "pre").trim() || "pre";
  const __dbgPost =
    typeof globalThis.fetch === "function"
      ? globalThis.fetch.bind(globalThis)
      : typeof fetchCompat === "function"
        ? fetchCompat
        : null;
  const __dbgReport = (hypothesisId, location, msg, data, traceId) => {
    if (!__dbgUrl || !__dbgPost) return;
    try {
      __dbgPost(__dbgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: __dbgSession,
          runId: __dbgRunId,
          hypothesisId,
          location,
          msg: `[DEBUG] ${msg}`,
          data: data && typeof data === "object" ? data : { value: data },
          traceId,
          ts: Date.now(),
        }),
      }).catch(() => {});
    } catch {
      void 0;
    }
  };
  // #endregion

  // #region debug-point A:with-timeout-helper
  const withTimeout = async (promise, ms, meta) => {
    const timeoutMs = Math.max(1, Number(ms) || 0);
    if (!timeoutMs) return promise;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error(meta?.message || "Tempo limite excedido");
        err.statusCode = Number(meta?.statusCode) || 504;
        err.code = meta?.code || "TIMEOUT";
        reject(err);
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
  // #endregion
  const mensagensRealtimeHub = createMessagesRealtimeHub({
    databasePool,
    defaultLimit: 80,
    pollIntervalMs: Math.max(1000, Number(process.env.ZAPHUB_MESSAGES_REALTIME_INTERVAL_MS) || 3000),
    heartbeatMs: 15000,
  });
  const conversasRealtimeHub = createConversationsRealtimeHub({
    databasePool,
    defaultLimit: 40,
    pollIntervalMs: Math.max(1000, Number(process.env.ZAPHUB_CONVERSAS_REALTIME_INTERVAL_MS) || 3000),
    heartbeatMs: 15000,
  });
  const conversaMensagensRealtimeHub = createConversationMessagesRealtimeHub({
    databasePool,
    defaultLimit: 80,
    pollIntervalMs: Math.max(1000, Number(process.env.ZAPHUB_CONVERSA_MENSAGENS_REALTIME_INTERVAL_MS) || 3000),
    heartbeatMs: 15000,
  });
  const unreadCountsRealtimeHub = createUnreadCountsRealtimeHub({
    databasePool,
    pollIntervalMs: Math.max(1000, Number(process.env.ZAPHUB_UNREAD_REALTIME_INTERVAL_MS) || 3000),
    heartbeatMs: 15000,
  });

  const evolution = createEvolutionClient({
    fetchCompat,
    apiUrl: process.env.EVOLUTION_API_URL || "http://72.60.247.126:8888",
    apiKey: process.env.EVOLUTION_API_KEY || "",
  });

  const autoWebhookUrl = String(process.env.ZAPHUB_EVOLUTION_WEBHOOK_URL || "").trim();
  if (autoWebhookUrl) {
    const events = [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONTACTS_UPDATE",
      "CHATS_UPSERT",
      "CHATS_UPDATE",
    ];
    setTimeout(() => {
      (async () => {
        try {
          const instances = await evolution.fetchEvolutionInstances();
          for (const row of instances) {
            const instanceName = String(row.instanceName || "").trim();
            if (!instanceName || instanceName === "-") continue;
            try {
              await evolution.setEvolutionInstanceWebhook(instanceName, {
                url: autoWebhookUrl,
                events,
                enabled: true,
                webhook_by_events: false,
                webhook_base64: false,
              });
            } catch {
              void 0;
            }
          }
        } catch {
          void 0;
        }
      })();
    }, 0);
  }

  const uploadMidia = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 15 * 1024 * 1024,
      files: 1,
    },
  });

  function getMatriculaFromRequest(req) {
    const fromQuery = String(req.query?.matricula || "").trim();
    if (fromQuery) return fromQuery;
    const fromBody = String(req.body?.matricula || "").trim();
    if (fromBody) return fromBody;
    return "";
  }

  async function resolveInstanceAccessRules(req) {
    const matricula = getMatriculaFromRequest(req);
    if (!matricula) {
      return { matricula: "", hasRules: false, allowedSet: null };
    }

    const allowedNames = await fetchZapHubInstanceAccessInstanceNamesByUsuario({ databasePool, matricula }).catch(() => []);
    const normalizedAllowed = new Set(
      (Array.isArray(allowedNames) ? allowedNames : [])
        .map((name) => String(name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    return {
      matricula,
      hasRules: true,
      allowedSet: normalizedAllowed,
    };
  }

  function assertInstanceAllowed({ hasRules, allowedSet, instanceName }) {
    if (!hasRules || !allowedSet) return;
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key) return;
    if (!allowedSet.has(key)) {
      const err = new Error("Usuário sem permissão para acessar esta instância");
      err.statusCode = 403;
      throw err;
    }
  }

  router.get("/api/zaphub/instancias", async (_req, res) => {
    try {
      const rows = await evolution.fetchEvolutionInstances();
      const idByNumber = await fetchInstanceIdsByNumbers({ databasePool, numbers: rows.map((row) => row?.number) }).catch(() => ({}));
      const idByName = await fetchInstanceIdsByNames({ databasePool, instanceNames: rows.map((row) => row?.instanceName) }).catch(() => ({}));
      const responsaveisMap = await fetchZapHubInstanceResponsaveisMap({ databasePool }).catch(() => ({}));
      const televendasPrincipal = await fetchZapHubTelevendasPrincipal({ databasePool }).catch(() => null);
      const unreadCountsMap = await fetchUnreadCountsByInstanceNames({
        databasePool,
        instanceNames: rows.map((row) => row?.instanceName),
      }).catch(() => ({}));
      const enriched = rows.map((row) => ({
        id:
          String(idByNumber[String(row?.number || "").trim()] || idByName[String(row?.instanceName || "").trim().toLowerCase()] || row?.id || row?.instanceName || "").trim() ||
          String(row?.instanceName || ""),
        ...row,
        unreadCount: Number(unreadCountsMap[normalizeZapHubInstanceKey(row.instanceName)]) || 0,
        responsavel: responsaveisMap[String(row.instanceName || "")] ?? null,
        responsavelMatricula: responsaveisMap[String(row.instanceName || "")]?.matricula ?? null,
        isTelevendasPrincipal:
          Boolean(televendasPrincipal) &&
          normalizeZapHubInstanceKey(televendasPrincipal) === normalizeZapHubInstanceKey(row.instanceName),
      }));
      return res.json({ rows: enriched, count: enriched.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar instâncias";
      return res.status(500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/permitidas", async (req, res) => {
    const matricula = String(req.query?.matricula || "").trim();
    // #region debug-point A:instancias-permitidas-start
    const __traceId = `permitidas:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const __t0 = Date.now();
    __dbgReport("A", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "start", {
      matricula: matricula || null,
      hasMatricula: Boolean(matricula),
      query: req.query || null,
    }, __traceId);
    // #endregion

    try {
      // #region debug-point C:db-allowed-names
      const __tAllowed0 = Date.now();
      __dbgReport("C", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "before fetchZapHubInstanceAccessInstanceNamesByUsuario()", { hasMatricula: Boolean(matricula) }, __traceId);
      // #endregion
      const allowedNames = matricula
        ? await withTimeout(
            fetchZapHubInstanceAccessInstanceNamesByUsuario({ databasePool, matricula }).catch(() => []),
            8000,
            { message: "Timeout ao consultar permissões de instâncias", statusCode: 504, code: "DB_TIMEOUT" }
          )
        : [];
      // #region debug-point C:db-allowed-names-done
      __dbgReport("C", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "after fetchZapHubInstanceAccessInstanceNamesByUsuario()", {
        ms: Date.now() - __tAllowed0,
        count: Array.isArray(allowedNames) ? allowedNames.length : null,
      }, __traceId);
      // #endregion

      const normalizedAllowed = new Set(allowedNames.map((name) => String(name || "").trim().toLowerCase()).filter(Boolean));
      const hasRules = Boolean(matricula);

      if (hasRules && normalizedAllowed.size === 0) {
        // #region debug-point A:instancias-permitidas-end-empty
        __dbgReport("A", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "end early (no allowed instances)", {
          ms: Date.now() - __t0,
          returnedCount: 0,
          hasRules,
        }, __traceId);
        // #endregion
        return res.json({ rows: [], count: 0, hasRules });
      }

      // #region debug-point B:evolution-fetch-instances
      const __tEvolution0 = Date.now();
      __dbgReport("B", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "before evolution.fetchEvolutionInstances()", {}, __traceId);
      // #endregion
      const rows = await withTimeout(
        evolution.fetchEvolutionInstances(),
        9000,
        { message: "Timeout ao consultar instâncias no Evolution", statusCode: 504, code: "EVOLUTION_TIMEOUT" }
      );
      // #region debug-point B:evolution-fetch-instances-done
      __dbgReport("B", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "after evolution.fetchEvolutionInstances()", {
        ms: Date.now() - __tEvolution0,
        count: Array.isArray(rows) ? rows.length : null,
      }, __traceId);
      // #endregion

      const filteredRows = hasRules
        ? rows.filter((row) => normalizedAllowed.has(String(row?.instanceName || "").trim().toLowerCase()))
        : rows;

      const idByNumber = await fetchInstanceIdsByNumbers({ databasePool, numbers: filteredRows.map((row) => row?.number) }).catch(() => ({}));
      const idByName = await fetchInstanceIdsByNames({ databasePool, instanceNames: filteredRows.map((row) => row?.instanceName) }).catch(() => ({}));

      // #region debug-point D:db-enrichment
      const __tEnrich0 = Date.now();
      __dbgReport("D", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "before enrich calls", { filteredCount: filteredRows.length }, __traceId);
      // #endregion
      const responsaveisMap = await withTimeout(
        fetchZapHubInstanceResponsaveisMap({ databasePool }).catch(() => ({})),
        8000,
        { message: "Timeout ao consultar responsáveis", statusCode: 504, code: "DB_TIMEOUT" }
      );
      const televendasPrincipal = await withTimeout(
        fetchZapHubTelevendasPrincipal({ databasePool }).catch(() => null),
        8000,
        { message: "Timeout ao consultar televendas principal", statusCode: 504, code: "DB_TIMEOUT" }
      );
      const unreadCountsMap = await withTimeout(
        fetchUnreadCountsByInstanceNames({
          databasePool,
          instanceNames: filteredRows.map((row) => row?.instanceName),
        }).catch(() => ({})),
        8000,
        { message: "Timeout ao consultar unreadCounts", statusCode: 504, code: "DB_TIMEOUT" }
      );
      // #region debug-point D:db-enrichment-done
      __dbgReport("D", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "after enrich calls", {
        ms: Date.now() - __tEnrich0,
        hasResponsaveisMap: Boolean(responsaveisMap && typeof responsaveisMap === "object"),
        televendasPrincipal: televendasPrincipal || null,
        unreadKeys: unreadCountsMap && typeof unreadCountsMap === "object" ? Object.keys(unreadCountsMap).length : null,
      }, __traceId);
      // #endregion

      const enriched = filteredRows.map((row) => ({
        id:
          String(idByNumber[String(row?.number || "").trim()] || idByName[String(row?.instanceName || "").trim().toLowerCase()] || row?.id || row?.instanceName || "").trim() ||
          String(row?.instanceName || ""),
        ...row,
        unreadCount: Number(unreadCountsMap[normalizeZapHubInstanceKey(row.instanceName)]) || 0,
        responsavel: responsaveisMap[String(row.instanceName || "")] ?? null,
        responsavelMatricula: responsaveisMap[String(row.instanceName || "")]?.matricula ?? null,
        isTelevendasPrincipal:
          Boolean(televendasPrincipal) &&
          normalizeZapHubInstanceKey(televendasPrincipal) === normalizeZapHubInstanceKey(row.instanceName),
      }));
      // #region debug-point A:instancias-permitidas-end
      __dbgReport("A", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "end", {
        ms: Date.now() - __t0,
        returnedCount: enriched.length,
        hasRules,
      }, __traceId);
      // #endregion
      return res.json({ rows: enriched, count: enriched.length, hasRules });
    } catch (err) {
      // #region debug-point E:instancias-permitidas-error
      __dbgReport("E", "zaphubInstancias.js:/api/zaphub/instancias/permitidas", "error", {
        ms: Date.now() - __t0,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : null,
      }, __traceId);
      // #endregion
      const message = err instanceof Error ? err.message : "Erro interno ao listar instâncias permitidas";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/permissoes", async (req, res) => {
    const matricula = String(req.query?.matricula || "").trim();
    if (!matricula) return res.status(400).json({ message: "matricula é obrigatória" });

    try {
      const rows = await fetchZapHubInstanceAcessosByUsuario({ databasePool, matricula });
      return res.json({ rows, count: rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar permissões";
      return res.status(500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/permissoes/resumo", async (_req, res) => {
    try {
      const rows = await fetchZapHubInstanceAcessosResumo({ databasePool });
      return res.json({ rows, count: rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar resumo de permissões";
      return res.status(500).json({ message });
    }
  });

  router.put("/api/zaphub/instancias/permissoes", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const matricula = String(req.body?.matricula || "").trim();
    const nome = req.body?.nome ?? null;
    const areaAtuacao = req.body?.areaAtuacao ?? null;
    const funcao = req.body?.funcao ?? null;

    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });
    if (!matricula) return res.status(400).json({ message: "matricula é obrigatória" });

    try {
      const row = await grantZapHubInstanceAcesso({ databasePool, instanceName, matricula, nome, areaAtuacao, funcao });
      return res.json({ ok: true, row });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao conceder permissão";
      return res.status(500).json({ message });
    }
  });

  router.delete("/api/zaphub/instancias/permissoes", async (req, res) => {
    const instanceName = String(req.query?.instanceName || "").trim();
    const matricula = String(req.query?.matricula || "").trim();
    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });
    if (!matricula) return res.status(400).json({ message: "matricula é obrigatória" });

    try {
      const result = await revokeZapHubInstanceAcesso({ databasePool, instanceName, matricula });
      return res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao revogar permissão";
      return res.status(500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/televendas-principal", async (_req, res) => {
    try {
      const instanceName = await fetchZapHubTelevendasPrincipal({ databasePool });
      return res.json({ ok: true, instanceName });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao consultar televendas principal";
      return res.status(500).json({ message });
    }
  });

  router.put("/api/zaphub/instancias/televendas-principal", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });

    try {
      const row = await setZapHubTelevendasPrincipal({ databasePool, instanceName });
      return res.json({ ok: true, row });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao definir televendas principal";
      return res.status(500).json({ message });
    }
  });

  router.delete("/api/zaphub/instancias/televendas-principal", async (_req, res) => {
    try {
      const row = await clearZapHubTelevendasPrincipal({ databasePool });
      return res.json({ ok: true, row });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao limpar televendas principal";
      return res.status(500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/unread-counts", async (req, res) => {
    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      const rowsRaw = await evolution.fetchEvolutionInstances();
      const rows = hasRules && allowedSet
        ? rowsRaw.filter((row) => allowedSet.has(String(row?.instanceName || "").trim().toLowerCase()))
        : rowsRaw;
      const unreadCountsMap = await fetchUnreadCountsByInstanceNames({
        databasePool,
        instanceNames: rows.map((row) => row?.instanceName),
      }).catch(() => ({}));
      const counts = {};
      rows.forEach((row) => {
        const key = String(row?.instanceName || "").trim();
        if (!key) return;
        counts[key] = Number(unreadCountsMap[normalizeZapHubInstanceKey(key)]) || 0;
      });
      return res.json({ rows: counts, count: Object.keys(counts).length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar contagens das instâncias";
      return res.status(500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/unread-count", async (req, res) => {
    const instanceName = String(req.query?.instanceName || "").trim();
    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const unreadCountsMap = await fetchUnreadCountsByInstanceNames({
        databasePool,
        instanceNames: [instanceName],
      }).catch(() => ({}));

      return res.json({
        instanceName,
        unreadCount: Number(unreadCountsMap[normalizeZapHubInstanceKey(instanceName)]) || 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao consultar contagem da instância";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 500).json({ message });
    }
  });

  router.get("/api/zaphub/instancias/unread-count/stream", async (req, res) => {
    const instanceName = String(req.query?.instanceName || "").trim();
    if (!instanceName) {
      const matricula = getMatriculaFromRequest(req);
      if (!matricula) return res.status(400).json({ message: "matricula é obrigatória" });
      await unreadCountsRealtimeHub.subscribeByMatricula(req, res, matricula);
      return;
    }

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao validar permissão da instância";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 403).json({ message });
    }

    await unreadCountsRealtimeHub.subscribeInstance(req, res, instanceName);
  });

  router.get("/api/zaphub/instancias/responsaveis", async (_req, res) => {
    try {
      const responsaveisMap = await fetchZapHubInstanceResponsaveisMap({ databasePool });
      return res.json({ rows: responsaveisMap });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar responsáveis";
      return res.status(500).json({ message });
    }
  });

  router.put("/api/zaphub/instancias/responsavel", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const matricula = String(req.body?.matricula || "").trim();

    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });
    if (!matricula) return res.status(400).json({ message: "matricula é obrigatória" });

    try {
      const row = await vincularZapHubInstanceResponsavel({ databasePool, instanceName, matricula });
      return res.json({ ok: true, row });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao vincular responsável";
      return res.status(500).json({ message });
    }
  });

  router.delete("/api/zaphub/instancias/responsavel/:instanceName", async (req, res) => {
    const instanceName = String(req.params?.instanceName || "").trim();
    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });

    try {
      const result = await desvincularZapHubInstanceResponsavel({ databasePool, instanceName });
      return res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao desvincular responsável";
      return res.status(500).json({ message });
    }
  });

  router.post("/api/zaphub/instancias/nova", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });

    const safe = encodeURIComponent(instanceName);
    let createPayload = null;
    let createStatus = null;
    let instanceToken = null;

    try {
      const response = await fetchCompat(`${evolution.baseUrl}/instance/create`, {
        method: "POST",
        headers: evolution.headers,
        body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS" }),
      });
      createStatus = response.status;
      createPayload = await evolution.parseEvolutionPayload(response);
      const tokenFromHash =
        createPayload && typeof createPayload === "object"
          ? String(createPayload.hash || "").trim()
          : "";
      instanceToken = tokenFromHash || null;
    } catch {
      createPayload = null;
    }

    if (!instanceToken) {
      try {
        const response = await fetchCompat(`${evolution.baseUrl}/instance/fetchInstances`, {
          method: "GET",
          headers: evolution.headers,
        });
        const payload = await evolution.parseEvolutionPayload(response);
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.instances) ? payload.instances : [];
        const found = rows.find((row) => {
          const rawName = row?.name ?? row?.instanceName ?? row?.instance?.name ?? row?.instance?.instanceName ?? "";
          return String(rawName).trim().toLowerCase() === instanceName.toLowerCase();
        });
        const token = found?.token ?? found?.hash ?? found?.instance?.token ?? found?.instance?.hash ?? null;
        instanceToken = token ? String(token).trim() : null;
      } catch {
        instanceToken = null;
      }
    }

    let qrPayload = null;
    let qrStatus = null;
    for (let round = 0; round < 3; round += 1) {
      try {
        const response = await fetchCompat(`${evolution.baseUrl}/instance/connect/${safe}`, {
          method: "GET",
          headers: instanceToken ? { ...evolution.headers, apikey: instanceToken } : evolution.headers,
        });
        qrStatus = response.status;
        qrPayload = await evolution.parseEvolutionPayload(response);
        const extracted = extractQrPayload(qrPayload);
        if (extracted.base64 || extracted.pairingCode) break;
      } catch {
        qrPayload = null;
        qrStatus = null;
      }
      if (round < 2) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    const qr = extractQrPayload(qrPayload);
    const qrCodeDataUrl = qr.base64 ? toDataUrl(qr.base64, "image/png") : null;

    try {
      const row = await evolution.fetchEvolutionInstanceSnapshot(instanceName);
      const message = extractEvolutionMessage(qrPayload || createPayload, "Instância criada/atualizada");
      return res.json({
        ok: true,
        message,
        row,
        qrCodeDataUrl,
        pairingCode: qr.pairingCode,
        instanceToken: instanceToken ? "[set]" : null,
        createPayload,
        createStatus,
        qrPayload,
        qrStatus,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao consultar instância criada";
      return res.status(500).json({
        message,
        qrCodeDataUrl,
        pairingCode: qr.pairingCode,
        instanceToken: instanceToken ? "[set]" : null,
        createPayload,
        createStatus,
        qrPayload,
        qrStatus,
      });
    }
  });

  router.post("/api/zaphub/instancias/acao", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const action = String(req.body?.action || "").trim().toLowerCase();

    if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });

    const actions = {
      sincronizar: { method: "GET", path: null, successMessage: "Instância sincronizada com sucesso" },
      reiniciar: { method: "PUT", path: `/instance/restart/${encodeURIComponent(instanceName)}`, successMessage: "Instância reiniciada com sucesso" },
      desconectar: { method: "DELETE", path: `/instance/logout/${encodeURIComponent(instanceName)}`, successMessage: "Instância desconectada com sucesso" },
      reconectar: { method: "GET", path: `/instance/connect/${encodeURIComponent(instanceName)}`, successMessage: "Instância reconectada com sucesso" },
    };

    if (!actions[action]) return res.status(400).json({ message: "Ação inválida para a instância" });

    try {
      let payload = null;
      if (actions[action].path) {
        const response = await fetchCompat(`${evolution.baseUrl}${actions[action].path}`, {
          method: actions[action].method,
          headers: evolution.headers,
        });
        payload = await evolution.parseEvolutionPayload(response);
        if (!response.ok) {
          const message = extractEvolutionMessage(payload, `Falha ao executar a ação ${action}`);
          return res.status(response.status || 500).json({ message, payload });
        }
      }

      const row = await evolution.fetchEvolutionInstanceSnapshot(instanceName);
      const message = extractEvolutionMessage(payload, actions[action].successMessage);
      return res.json({ message, row, payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao executar ação da instância";
      return res.status(500).json({ message });
    }
  });

  router.get("/api/zaphub/mensagens", async (req, res) => {
    const t0 = Date.now();
    const traceId = `mensagens:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    try {
      // #region debug-point M0:mensagens-start
      const limit = Number(req.query?.limit || 80);
      const instanceId = String(req.query?.instanceId || "").trim() || null;
      const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
      const instanceName = instanceId
        ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
        : instanceNameRaw;
      __dbgReport(
        "M",
        "zaphubInstancias.js:/api/zaphub/mensagens",
        "start",
        { limit, instanceId, instanceName, matricula: getMatriculaFromRequest(req) || null },
        traceId
      );
      // #endregion

      // #region debug-point M1:resolve-rules
      __dbgReport("M", "zaphubInstancias.js:/api/zaphub/mensagens", "before resolveInstanceAccessRules()", {}, traceId);
      // #endregion
      const { hasRules, allowedSet } = await withTimeout(
        resolveInstanceAccessRules(req),
        8000,
        { message: "Timeout ao validar permissões do usuário", statusCode: 504, code: "DB_TIMEOUT" }
      );
      // #region debug-point M1:resolve-rules-done
      __dbgReport("M", "zaphubInstancias.js:/api/zaphub/mensagens", "after resolveInstanceAccessRules()", { hasRules, allowedSize: allowedSet ? allowedSet.size : null }, traceId);
      // #endregion

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }
      // #region debug-point M2:fetch-messages
      __dbgReport("M", "zaphubInstancias.js:/api/zaphub/mensagens", "before fetchOpenInstanceMessages()", {}, traceId);
      // #endregion
      const result = await withTimeout(
        fetchOpenInstanceMessages({ databasePool, limit, instanceName, instanceId }),
        26000,
        { message: "Timeout ao consultar mensagens", statusCode: 504, code: "DB_TIMEOUT" }
      );
      // #region debug-point M2:fetch-messages-done
      __dbgReport("M", "zaphubInstancias.js:/api/zaphub/mensagens", "after fetchOpenInstanceMessages()", { elapsedMs: Date.now() - t0, count: result?.rows?.length ?? null }, traceId);
      // #endregion
      return res.json({ ...result, count: result.rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar mensagens";
      // #region debug-point M9:mensagens-error
      __dbgReport("M", "zaphubInstancias.js:/api/zaphub/mensagens", "error", {
        elapsedMs: Date.now() - t0,
        message,
        name: err instanceof Error ? err.name : null,
        code: err && typeof err === "object" && "code" in err ? err.code : undefined,
        statusCode: err && typeof err === "object" && "statusCode" in err ? err.statusCode : undefined,
      }, traceId);
      // #endregion
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      const status =
        statusFromError && Number.isFinite(statusFromError)
          ? statusFromError
          : 
        message.includes("Nenhuma instância com status open") || message.includes("não foi encontrada")
          ? 404
          : 500;
      return res.status(status).json({ message });
    }
  });

  router.get("/api/zaphub/conversas", async (req, res) => {
    const t0 = Date.now();
    try {
      const limit = Number(req.query?.limit || 40);
      const instanceId = String(req.query?.instanceId || "").trim() || null;
      const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
      const instanceName = instanceId
        ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
        : instanceNameRaw;

      const { hasRules, allowedSet } = await withTimeout(
        resolveInstanceAccessRules(req),
        8000,
        { message: "Timeout ao validar permissões do usuário", statusCode: 504, code: "DB_TIMEOUT" }
      );

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const excludePulled = String(req.query?.excludePulled || "").trim().toLowerCase() === "true";

      const result = await withTimeout(
        fetchInstanceConversations({ databasePool, limit, instanceName, instanceId, excludePulled }),
        26000,
        { message: "Timeout ao consultar conversas", statusCode: 504, code: "DB_TIMEOUT" }
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json({ ...result, count: result.rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar conversas";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      const status =
        statusFromError && Number.isFinite(statusFromError)
          ? statusFromError
          : message.includes("Nenhuma instância com status open") || message.includes("não foi encontrada")
          ? 404
          : 500;
      return res.status(status).json({ message, elapsedMs: Date.now() - t0 });
    }
  });

  router.get("/api/zaphub/conversas/stream", async (req, res) => {
    const limit = Number(req.query?.limit || 40);
    const instanceId = String(req.query?.instanceId || "").trim() || null;
    const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
    const instanceName = instanceId
      ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
      : instanceNameRaw;
    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao validar permissão da instância";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 403).json({ message });
    }
    const excludePulled = String(req.query?.excludePulled || "").trim().toLowerCase() === "true";
    await conversasRealtimeHub.subscribe(req, res, limit, instanceName, instanceId, excludePulled);
  });

  router.get("/api/zaphub/conversas/mensagens", async (req, res) => {
    const t0 = Date.now();
    try {
      const limit = Number(req.query?.limit || 80);
      const remoteJid = String(req.query?.remoteJid || "").trim();
      const instanceId = String(req.query?.instanceId || "").trim() || null;
      const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
      const instanceName = instanceId
        ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
        : instanceNameRaw;

      if (!remoteJid) {
        return res.status(400).json({ message: "remoteJid é obrigatório" });
      }

      const { hasRules, allowedSet } = await withTimeout(
        resolveInstanceAccessRules(req),
        8000,
        { message: "Timeout ao validar permissões do usuário", statusCode: 504, code: "DB_TIMEOUT" }
      );

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const excludePulled = String(req.query?.excludePulled || "").trim().toLowerCase() === "true";

      const result = await withTimeout(
        fetchConversationMessages({
          databasePool,
          limit,
          instanceName,
          instanceId,
          remoteJid,
          excludePulled,
        }),
        26000,
        { message: "Timeout ao consultar mensagens da conversa", statusCode: 504, code: "DB_TIMEOUT" }
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json({ ...result, count: result.rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar mensagens da conversa";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      const status =
        statusFromError && Number.isFinite(statusFromError)
          ? statusFromError
          : message.includes("Nenhuma instância com status open") || message.includes("não foi encontrada")
          ? 404
          : 500;
      return res.status(status).json({ message, elapsedMs: Date.now() - t0 });
    }
  });

  router.get("/api/zaphub/conversas/mensagens/stream", async (req, res) => {
    const limit = Number(req.query?.limit || 80);
    const remoteJid = String(req.query?.remoteJid || "").trim();
    const instanceId = String(req.query?.instanceId || "").trim() || null;
    const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
    const instanceName = instanceId
      ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
      : instanceNameRaw;
    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }
    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao validar permissão da instância";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 403).json({ message });
    }
    const excludePulled = String(req.query?.excludePulled || "").trim().toLowerCase() === "true";
    const somentePuxadas = String(req.query?.somentePuxadas || "").trim().toLowerCase() === "true";
    const encerradas = String(req.query?.encerradas || "").trim().toLowerCase() === "true";
    const matricula = getMatriculaFromRequest(req);
    const onlyPulledForMatricula = somentePuxadas ? matricula : null;
    const onlyPulledEncerradas = somentePuxadas ? encerradas : null;
    await conversaMensagensRealtimeHub.subscribe(
      req,
      res,
      limit,
      instanceName,
      instanceId,
      remoteJid,
      excludePulled,
      onlyPulledForMatricula,
      onlyPulledEncerradas
    );
  });

  router.get("/api/zaphub/mensagens/stream", async (req, res) => {
    const limit = Number(req.query?.limit || 80);
    const instanceId = String(req.query?.instanceId || "").trim() || null;
    const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
    const instanceName = instanceId
      ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
      : instanceNameRaw;
    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao validar permissão da instância";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 403).json({ message });
    }
    await mensagensRealtimeHub.subscribe(req, res, limit, instanceName, instanceId);
  });

  router.post("/api/zaphub/mensagens/midia-hd", async (req, res) => {
    const messageId = String(req.body?.messageId || "").trim();

    if (!messageId) {
      return res.status(400).json({ message: "messageId é obrigatório" });
    }

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      const target = await fetchMessageMediaRequestById({ databasePool, messageId });
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName: target.instanceName });
      }
      const response = await fetchCompat(
        `${evolution.baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(target.instanceName)}`,
        {
          method: "POST",
          headers: evolution.headers,
          body: JSON.stringify({
            message: { key: target.key },
            convertToMp4: String(target.messageType || "").toLowerCase().includes("video"),
          }),
        }
      );

      const payload = await evolution.parseEvolutionPayload(response);
      if (!response.ok) {
        const message = extractEvolutionMessage(payload, "Falha ao carregar mídia em HD");
        return res.status(response.status || 500).json({ message, payload });
      }

      const mediaPayload = extractBase64Payload(payload);
      if (!mediaPayload.base64) {
        return res.status(502).json({
          message: "A Evolution não retornou base64 para esta mídia",
          payload,
        });
      }

      return res.json({
        ok: true,
        messageId,
        mediaType: mediaPayload.mediaType || target.messageType || null,
        fileName: mediaPayload.fileName || null,
        mimetype: mediaPayload.mimetype || null,
        contentUrl: toDataUrl(mediaPayload.base64, mediaPayload.mimetype || undefined),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao carregar mídia em HD";
      return res.status(500).json({ message });
    }
  });

  async function handleEvolutionJidSync(req, res) {
    try {
      const forceMerge = Boolean(req.body && typeof req.body === "object" && req.body.forceMerge);
      const normalizedEvents = normalizeEvolutionEventBatchForJidSync(req.body);
      const results = [];
      const skipped = [];

      for (const item of normalizedEvents) {
        let instanceId = item.instanceIds[0] || null;
        if (!instanceId && item.instance) {
          instanceId = await fetchInstanceIdByName({ databasePool, instanceName: item.instance });
        }
        const instanceNumber = instanceId ? await fetchInstanceNumberById({ databasePool, instanceId }) : null;
        const didUpsert = [];

        if (instanceId && item.senderJid) {
          for (const remoteJid of item.remoteJids) {
            if (!remoteJid) continue;
            const link = await upsertZapHubEventJidLink({
              databasePool,
              instanceId,
              remoteJid,
              senderJid: item.senderJid,
              remoteJidAlt: item.remoteJidAlt,
            });
            didUpsert.push(link);
          }
        }

        const shouldAutoMerge =
          Boolean(instanceId) &&
          Boolean((item.remoteJidAlt || item.senderJid) && String(item.remoteJidAlt || item.senderJid).endsWith("@s.whatsapp.net")) &&
          Boolean(item.remoteJids.some((jid) => String(jid || "").endsWith("@lid"))) &&
          Boolean(!instanceNumber || (item.remoteJidAlt || item.senderJid) !== instanceNumber);

        if (!didUpsert.length && !item.syncPairs.length) {
          skipped.push({
            event: item.event,
            instance: item.instance,
            remoteJidAlt: item.remoteJidAlt,
            senderJid: item.senderJid,
            remoteJids: item.remoteJids,
            reason: "no-sync-pairs",
          });
          continue;
        }

        if ((forceMerge || shouldAutoMerge) && item.syncPairs.length) {
          for (const pair of item.syncPairs) {
            const result = await mergeContactJids({
              databasePool,
              remoteJid: pair.remoteJid || null,
              senderJid: item.remoteJidAlt || pair.senderJid || null,
            });
            results.push({
              event: item.event,
              instance: item.instance,
              instanceId,
              ...result,
              kind: "merge",
            });
          }
        }

        didUpsert.forEach((row) => {
          results.push({
            event: item.event,
            instance: item.instance,
            instanceId,
            ...row,
            kind: "event-link",
          });
        });
      }

      return res.json({
        ok: true,
        message: results.length ? "JIDs sincronizados com sucesso" : "Nenhum evento elegível para sincronização",
        receivedCount: normalizedEvents.length,
        processedCount: results.length,
        skippedCount: skipped.length,
        results,
        skipped,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao sincronizar JIDs do contato";
      return res.status(500).json({ message });
    }
  }

  router.post("/api/zaphub/contatos/sincronizar-jids", handleEvolutionJidSync);
  router.post("/api/zaphub/evolution/sync-event", handleEvolutionJidSync);

  if (!evolutionLogIngestorStarted) {
    const logPath = String(process.env.ZAPHUB_EVOLUTION_LOG_PATH || "").trim();
    if (logPath) {
      evolutionLogIngestorStarted = true;
      const pollMs = Math.max(250, Number(process.env.ZAPHUB_EVOLUTION_LOG_POLL_MS) || 1000);
      let offset = 0;
      let carry = "";
      let current = {};

      const initOffset = async () => {
        try {
          const stat = await fs.promises.stat(logPath);
          offset = Number(stat.size || 0);
        } catch {
          offset = 0;
        }
      };

      const tick = async () => {
        let stat;
        try {
          stat = await fs.promises.stat(logPath);
        } catch {
          return;
        }
        const size = Number(stat.size || 0);
        if (size < offset) {
          offset = 0;
        }
        if (size === offset) return;

        let fd;
        try {
          fd = await fs.promises.open(logPath, "r");
          const toRead = size - offset;
          const buffer = Buffer.allocUnsafe(Math.min(toRead, 1024 * 128));
          let position = offset;
          while (position < size) {
            const remain = size - position;
            const chunkSize = Math.min(remain, buffer.length);
            const { bytesRead } = await fd.read(buffer, 0, chunkSize, position);
            if (!bytesRead) break;
            position += bytesRead;
            const text = carry + buffer.subarray(0, bytesRead).toString("utf8");
            const lines = text.split(/\r?\n/);
            carry = lines.pop() || "";
            for (const line of lines) {
              extractEventFieldsFromLogLine(line, current);
              if (String(line || "").trim() === "}" || String(line || "").trim().endsWith("}")) {
                const payload = buildEvolutionPayloadFromLogFields(current);
                current = {};
                if (!payload) continue;
                const normalized = normalizeEvolutionEventBatchForJidSync(payload);
                for (const item of normalized) {
                  const instanceId = item.instanceIds[0] || null;
                  const instanceNumber = instanceId ? await fetchInstanceNumberById({ databasePool, instanceId }) : null;
                  if (instanceId && (item.remoteJidAlt || item.senderJid)) {
                    for (const remoteJid of item.remoteJids) {
                      if (!remoteJid) continue;
                      await upsertZapHubEventJidLink({
                        databasePool,
                        instanceId,
                        remoteJid,
                        senderJid: item.senderJid,
                        remoteJidAlt: item.remoteJidAlt,
                      });
                    }
                  }
                  const shouldAutoMerge =
                    Boolean(instanceId) &&
                    Boolean((item.remoteJidAlt || item.senderJid) && String(item.remoteJidAlt || item.senderJid).endsWith("@s.whatsapp.net")) &&
                    Boolean(item.remoteJids.some((jid) => String(jid || "").endsWith("@lid"))) &&
                    Boolean(!instanceNumber || (item.remoteJidAlt || item.senderJid) !== instanceNumber);
                  if (shouldAutoMerge && item.syncPairs.length) {
                    for (const pair of item.syncPairs) {
                      await mergeContactJids({
                        databasePool,
                        remoteJid: pair.remoteJid || null,
                        senderJid: item.remoteJidAlt || pair.senderJid || null,
                      });
                    }
                  }
                }
              }
            }
          }
          offset = size;
        } catch {
          void 0;
        } finally {
          try {
            await fd?.close();
          } catch {
            void 0;
          }
        }
      };

      initOffset().then(() => {
        setInterval(() => {
          tick().catch(() => {});
        }, pollMs);
      });
    }
  }

  router.post("/api/zaphub/mensagens/marcar-lida", async (req, res) => {
    const t0 = Date.now();
    const instanceId = String(req.body?.instanceId || "").trim() || null;
    const instanceNameRaw = String(req.body?.instanceName || "").trim();
    const instanceName = instanceNameRaw || (instanceId ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null) : null);
    const rawReadMessages = Array.isArray(req.body?.readMessages) ? req.body.readMessages : [];
    const remoteJid = String(req.body?.remoteJid || rawReadMessages[0]?.remoteJid || "").trim();
    const readMessages = (() => {
      const seen = new Set();
      const normalized = [];
      for (const item of rawReadMessages) {
        if (!item || typeof item !== "object") continue;
        const id = String(item.id || "").trim();
        const itemRemoteJid = String(item.remoteJid || remoteJid || "").trim();
        if (!id || !itemRemoteJid) continue;
        const fromMe = Boolean(item.fromMe);
        const key = `${itemRemoteJid}::${id}::${fromMe}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push({ id, fromMe, remoteJid: itemRemoteJid });
      }
      return normalized;
    })();

    if (!instanceName) {
      return res.status(400).json({ message: "instanceName ou instanceId válido é obrigatório" });
    }

    if (!readMessages.length) {
      return res.status(400).json({ message: "readMessages é obrigatório" });
    }

    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }
      // #region debug-point R2:marcar-lida-before-evolution
      (() => {
        try {
          const payload = {
            sessionId: "mark-read-lock",
            runId: "pre",
            hypothesisId: "R",
            ts: Date.now(),
            location: "zaphubInstancias.js:/api/zaphub/mensagens/marcar-lida",
            msg: "[DEBUG] marcar-lida start",
            data: {
              instanceName,
              instanceId,
              remoteJid: String(remoteJid || "").slice(0, 80),
              readMessagesCount: readMessages.length,
            },
          };
          const fetchFn = globalThis.fetch;
          if (typeof fetchFn !== "function") return;
          fetchFn("http://127.0.0.1:7777/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {});
        } catch {}
      })();
      // #endregion
      const response = await fetchCompat(`${evolution.baseUrl}/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers: evolution.headers,
        body: JSON.stringify({ readMessages }),
      });
      const payload = await evolution.parseEvolutionPayload(response);
      if (!response.ok) {
        const message = extractEvolutionMessage(payload, "Falha ao marcar conversa como lida");
        return res.status(response.status || 500).json({ message, payload });
      }

      // #region debug-point R2b:marcar-lida-after-evolution
      (() => {
        try {
          const payload = {
            sessionId: "mark-read-lock",
            runId: "pre",
            hypothesisId: "R",
            ts: Date.now(),
            location: "zaphubInstancias.js:/api/zaphub/mensagens/marcar-lida",
            msg: "[DEBUG] evolution ok, calling local markChatAsRead",
            data: {
              elapsedMs: Date.now() - t0,
              instanceName,
              instanceId,
              remoteJid: String(remoteJid || "").slice(0, 80),
            },
          };
          const fetchFn = globalThis.fetch;
          if (typeof fetchFn !== "function") return;
          fetchFn("http://127.0.0.1:7777/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {});
        } catch {}
      })();
      // #endregion
      const localUpdate = await markChatAsRead({ databasePool, instanceName, instanceId, remoteJid });

      // #region debug-point R3:marcar-lida-ok
      (() => {
        try {
          const payload = {
            sessionId: "mark-read-lock",
            runId: "pre",
            hypothesisId: "R",
            ts: Date.now(),
            location: "zaphubInstancias.js:/api/zaphub/mensagens/marcar-lida",
            msg: "[DEBUG] marcar-lida ok",
            data: { elapsedMs: Date.now() - t0, instanceName, instanceId, remoteJid, localUpdate },
          };
          const fetchFn = globalThis.fetch;
          if (typeof fetchFn !== "function") return;
          fetchFn("http://127.0.0.1:7777/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {});
        } catch {}
      })();
      // #endregion
      return res.json({
        ok: true,
        message: extractEvolutionMessage(payload, "Conversa marcada como lida"),
        remoteJid,
        instanceId,
        localUpdate,
        payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao marcar conversa como lida";
      // #region debug-point R4:marcar-lida-err
      (() => {
        try {
          const payload = {
            sessionId: "mark-read-lock",
            runId: "pre",
            hypothesisId: "R",
            ts: Date.now(),
            location: "zaphubInstancias.js:/api/zaphub/mensagens/marcar-lida",
            msg: "[DEBUG] marcar-lida error",
            data: {
              elapsedMs: Date.now() - t0,
              message,
              code: err && typeof err === "object" && "code" in err ? err.code : undefined,
            },
          };
          const fetchFn = globalThis.fetch;
          if (typeof fetchFn !== "function") return;
          fetchFn("http://127.0.0.1:7777/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {});
        } catch {}
      })();
      // #endregion
      return res.status(500).json({ message });
    }
  });

  router.post("/api/zaphub/mensagens/puxar", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const messageKeyId = String(req.body?.messageKeyId || "").trim();
    const remoteJid = String(req.body?.remoteJid || "").trim();
    const messageId = String(req.body?.messageId || "").trim() || null;
    const participant = String(req.body?.participant || "").trim() || null;
    const usuarioNome = String(req.body?.usuarioNome || "").trim() || null;

    if (!instanceName) {
      return res.status(400).json({ message: "instanceName é obrigatório" });
    }
    if (!messageKeyId) {
      return res.status(400).json({ message: "messageKeyId é obrigatório" });
    }
    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }
    if (remoteJid.includes("@g.us")) {
      return res.status(400).json({ message: "Não é possível puxar mensagens de grupos" });
    }

    try {
      const matricula = getMatriculaFromRequest(req);
      if (!matricula) {
        return res.status(400).json({ message: "matricula é obrigatória" });
      }

      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const televendasPrincipal = await fetchZapHubTelevendasPrincipal({ databasePool }).catch(() => null);
      if (!televendasPrincipal || normalizeZapHubInstanceKey(televendasPrincipal) !== normalizeZapHubInstanceKey(instanceName)) {
        return res.status(400).json({ message: "Só é possível puxar mensagens da instância principal" });
      }

      const payload = await puxarZapHubMensagem({
        databasePool,
        instanceName,
        messageKeyId,
        remoteJid,
        matricula,
        usuarioNome,
        participant,
        messageId,
      });
      return res.json({ ok: true, payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao puxar mensagem";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 500).json({ message });
    }
  });

  router.get("/api/zaphub/mensagens/puxadas/badges", async (req, res) => {
    const t0 = Date.now();
    const traceId = `puxadas-badges:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    try {
      const instanceId = String(req.query?.instanceId || "").trim() || null;
      const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
      // #region debug-point A:puxadas-badges-start
      __dbgReport(
        "A",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "start",
        {
          instanceId,
          instanceNameRaw,
          matricula: getMatriculaFromRequest(req) || null,
          query: req.query || null,
        },
        traceId
      );
      // #endregion
      const instanceName = instanceId
        ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
        : instanceNameRaw;
      const matricula = getMatriculaFromRequest(req);
      // #region debug-point B:puxadas-badges-instance-resolved
      __dbgReport(
        "B",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "instance resolved",
        {
          resolveMs: Date.now() - t0,
          instanceId,
          instanceName,
          hasInstanceName: Boolean(instanceName),
          matricula: matricula || null,
        },
        traceId
      );
      // #endregion
      if (!matricula) {
        return res.status(400).json({ message: "matricula é obrigatória" });
      }

      // #region debug-point C:puxadas-badges-before-rules
      const tRules0 = Date.now();
      __dbgReport(
        "C",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "before resolveInstanceAccessRules()",
        { instanceName, matricula },
        traceId
      );
      // #endregion
      const { hasRules, allowedSet } = await withTimeout(
        resolveInstanceAccessRules(req),
        8000,
        { message: "Timeout ao validar permissões do usuário", statusCode: 504, code: "DB_TIMEOUT" }
      );
      // #region debug-point C:puxadas-badges-after-rules
      __dbgReport(
        "C",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "after resolveInstanceAccessRules()",
        {
          rulesMs: Date.now() - tRules0,
          hasRules,
          allowedSize: allowedSet ? allowedSet.size : null,
        },
        traceId
      );
      // #endregion

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      // #region debug-point D:puxadas-badges-before-db
      const tDb0 = Date.now();
      __dbgReport(
        "D",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "before fetchPuxadasBadgesByUsuario()",
        { instanceName, matricula },
        traceId
      );
      // #endregion
      const result = await withTimeout(
        fetchPuxadasBadgesByUsuario({ databasePool, instanceName, matricula }),
        12000,
        { message: "Timeout ao consultar badges de puxadas", statusCode: 504, code: "DB_TIMEOUT" }
      );
      // #region debug-point D:puxadas-badges-after-db
      __dbgReport(
        "D",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "after fetchPuxadasBadgesByUsuario()",
        {
          dbMs: Date.now() - tDb0,
          totalMs: Date.now() - t0,
          puxadasCount: result?.puxadasCount ?? null,
          encerradasCount: result?.encerradasCount ?? null,
        },
        traceId
      );
      // #endregion
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json({ ...result, elapsedMs: Date.now() - t0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao consultar badges de puxadas";
      // #region debug-point E:puxadas-badges-error
      __dbgReport(
        "E",
        "zaphubInstancias.js:/api/zaphub/mensagens/puxadas/badges",
        "error",
        {
          totalMs: Date.now() - t0,
          message,
          name: err instanceof Error ? err.name : null,
          code: err && typeof err === "object" && "code" in err ? err.code : undefined,
          statusCode: err && typeof err === "object" && "statusCode" in err ? err.statusCode : undefined,
        },
        traceId
      );
      // #endregion
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      const status =
        statusFromError && Number.isFinite(statusFromError)
          ? statusFromError
          : message.includes("Nenhuma instância com status open") || message.includes("não foi encontrada")
          ? 404
          : 500;
      return res.status(status).json({ message, elapsedMs: Date.now() - t0 });
    }
  });

  router.get("/api/zaphub/mensagens/puxadas/conversas", async (req, res) => {
    const t0 = Date.now();
    try {
      const limit = Number(req.query?.limit || 80);
      const instanceId = String(req.query?.instanceId || "").trim() || null;
      const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
      const instanceName = instanceId
        ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
        : instanceNameRaw;
      const matricula = getMatriculaFromRequest(req);
      if (!matricula) {
        return res.status(400).json({ message: "matricula é obrigatória" });
      }

      const { hasRules, allowedSet } = await withTimeout(
        resolveInstanceAccessRules(req),
        8000,
        { message: "Timeout ao validar permissões do usuário", statusCode: 504, code: "DB_TIMEOUT" }
      );

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const encerradas = String(req.query?.encerradas || "").trim().toLowerCase() === "true";

      const result = await withTimeout(
        fetchPuxadasConversasByUsuario({ databasePool, instanceName, matricula, limit, encerradas }),
        26000,
        { message: "Timeout ao consultar conversas puxadas", statusCode: 504, code: "DB_TIMEOUT" }
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json({ ...result, count: result.rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar conversas puxadas";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      const status =
        statusFromError && Number.isFinite(statusFromError)
          ? statusFromError
          : message.includes("Nenhuma instância com status open") || message.includes("não foi encontrada")
          ? 404
          : 500;
      return res.status(status).json({ message, elapsedMs: Date.now() - t0 });
    }
  });

  router.get("/api/zaphub/mensagens/puxadas/mensagens", async (req, res) => {
    const t0 = Date.now();
    try {
      const limit = Number(req.query?.limit || 80);
      const remoteJid = String(req.query?.remoteJid || "").trim();
      const instanceId = String(req.query?.instanceId || "").trim() || null;
      const instanceNameRaw = String(req.query?.instanceName || "").trim() || null;
      const instanceName = instanceId
        ? await fetchInstanceNameById({ databasePool, instanceId }).catch(() => null)
        : instanceNameRaw;
      const matricula = getMatriculaFromRequest(req);
      if (!matricula) {
        return res.status(400).json({ message: "matricula é obrigatória" });
      }

      if (!remoteJid) {
        return res.status(400).json({ message: "remoteJid é obrigatório" });
      }

      const { hasRules, allowedSet } = await withTimeout(
        resolveInstanceAccessRules(req),
        8000,
        { message: "Timeout ao validar permissões do usuário", statusCode: 504, code: "DB_TIMEOUT" }
      );

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(400).json({ message: "instanceName (ou instanceId válido) é obrigatório para este usuário" });
        }
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const encerradas = String(req.query?.encerradas || "").trim().toLowerCase() === "true";

      const result = await withTimeout(
        fetchPuxadasMensagensByUsuario({ databasePool, instanceName, matricula, remoteJid, limit, encerradas }),
        26000,
        { message: "Timeout ao consultar mensagens puxadas", statusCode: 504, code: "DB_TIMEOUT" }
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json({ ...result, count: result.rows.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao listar mensagens puxadas";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      const status =
        statusFromError && Number.isFinite(statusFromError)
          ? statusFromError
          : message.includes("Nenhuma instância com status open") || message.includes("não foi encontrada")
          ? 404
          : 500;
      return res.status(status).json({ message, elapsedMs: Date.now() - t0 });
    }
  });

  router.post("/api/zaphub/mensagens/puxadas/iniciar", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const remoteJid = String(req.body?.remoteJid || "").trim();
    const remoteJidsRaw = Array.isArray(req.body?.remoteJids) ? req.body.remoteJids : [];
    const remoteJids = remoteJidsRaw.map((jid) => String(jid || "").trim()).filter(Boolean);
    const usuarioNome = String(req.body?.usuarioNome || "").trim() || null;
    const reabrir = Boolean(req.body?.reabrir);

    if (!instanceName) {
      return res.status(400).json({ message: "instanceName é obrigatório" });
    }
    if (!remoteJid && !remoteJids.length) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }
    if (remoteJid.includes("@g.us") || remoteJids.some((jid) => jid.includes("@g.us"))) {
      return res.status(400).json({ message: "Não é possível iniciar conversas de grupos" });
    }

    try {
      const matricula = getMatriculaFromRequest(req);
      if (!matricula) {
        return res.status(400).json({ message: "matricula é obrigatória" });
      }

      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const televendasPrincipal = await fetchZapHubTelevendasPrincipal({ databasePool }).catch(() => null);
      if (!televendasPrincipal || normalizeZapHubInstanceKey(televendasPrincipal) !== normalizeZapHubInstanceKey(instanceName)) {
        return res.status(400).json({ message: "Só é possível iniciar conversas da instância principal" });
      }

      const payload = await iniciarOuReabrirZapHubConversaPuxada({
        databasePool,
        instanceName,
        matricula,
        remoteJid,
        remoteJids,
        usuarioNome,
        reabrir,
      });
      return res.json({ ok: true, ...payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao iniciar conversa";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 500).json({ message });
    }
  });

  router.post("/api/zaphub/mensagens/puxadas/encerrar", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const remoteJid = String(req.body?.remoteJid || "").trim();
    const remoteJidsRaw = Array.isArray(req.body?.remoteJids) ? req.body.remoteJids : [];
    const remoteJids = remoteJidsRaw.map((jid) => String(jid || "").trim()).filter(Boolean);

    if (!instanceName) {
      return res.status(400).json({ message: "instanceName é obrigatório" });
    }
    if (!remoteJid && !remoteJids.length) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }

    try {
      const matricula = getMatriculaFromRequest(req);
      if (!matricula) {
        return res.status(400).json({ message: "matricula é obrigatória" });
      }

      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const televendasPrincipal = await fetchZapHubTelevendasPrincipal({ databasePool }).catch(() => null);
      if (!televendasPrincipal || normalizeZapHubInstanceKey(televendasPrincipal) !== normalizeZapHubInstanceKey(instanceName)) {
        return res.status(400).json({ message: "Só é possível encerrar conversas puxadas da instância principal" });
      }

      const payload = await encerrarZapHubPuxadasConversa({
        databasePool,
        instanceName,
        matricula,
        remoteJid,
        remoteJids,
      });
      return res.json({ ok: true, payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao encerrar conversa puxada";
      const statusFromError = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : null;
      return res.status(statusFromError && Number.isFinite(statusFromError) ? statusFromError : 500).json({ message });
    }
  });

  router.post("/api/zaphub/mensagens/enviar", async (req, res) => {
    const remoteJid = String(req.body?.remoteJid || req.body?.number || "").trim();
    const text = String(req.body?.text || "").trim();
    const instanceNameBody = String(req.body?.instanceName || "").trim();

    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }

    if (!text) {
      return res.status(400).json({ message: "text é obrigatório" });
    }

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      let instanceName = instanceNameBody;
      if (!instanceName) {
        const signature = await fetchOpenInstanceMessagesSignature({ databasePool });
        instanceName = signature.instance?.instanceName || "";
      }

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(404).json({ message: "Nenhuma instância permitida disponível para envio" });
        }
        try {
          assertInstanceAllowed({ hasRules, allowedSet, instanceName });
        } catch {
          const fallback = Array.from(allowedSet.values())[0] || "";
          if (!fallback) {
            return res.status(404).json({ message: "Nenhuma instância permitida disponível para envio" });
          }
          instanceName = fallback;
        }
      }

      if (!instanceName) {
        return res.status(404).json({ message: "Nenhuma instância open disponível para envio" });
      }

      const response = await fetchCompat(`${evolution.baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers: evolution.headers,
        body: JSON.stringify({ number: remoteJid, text }),
      });
      const payload = await evolution.parseEvolutionPayload(response);
      if (!response.ok) {
        const message = extractEvolutionMessage(payload, "Falha ao enviar mensagem");
        return res.status(response.status || 500).json({ message, payload });
      }

      return res.json({
        ok: true,
        instanceName,
        remoteJid,
        text,
        payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao enviar mensagem";
      return res.status(500).json({ message });
    }
  });

  router.post("/api/zaphub/mensagens/editar", async (req, res) => {
    const instanceName = String(req.body?.instanceName || "").trim();
    const remoteJid = String(req.body?.remoteJid || req.body?.number || "").trim();
    const keyRemoteJid = String(req.body?.keyRemoteJid || remoteJid).trim();
    const number = String(req.body?.number || keyRemoteJid).trim();
    const messageKeyId = String(req.body?.messageKeyId || req.body?.key?.id || "").trim();
    const participant = String(req.body?.participant || req.body?.key?.participant || "").trim() || null;
    const text = String(req.body?.text || "").trim();

    if (!instanceName) {
      return res.status(400).json({ message: "instanceName é obrigatório" });
    }
    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }
    if (!messageKeyId) {
      return res.status(400).json({ message: "messageKeyId é obrigatório" });
    }
    if (!text) {
      return res.status(400).json({ message: "text é obrigatório" });
    }

    try {
      // #region debug-point A:message-edit-failure
      const debugServerUrl =
        process.env.DEBUG_SERVER_URL ||
        (() => {
          try {
            const fs = require("fs");
            const raw = fs.readFileSync("/home/multgesti/.dbg/message-edit-failure.env", "utf8");
            const line = String(raw || "")
              .split("\n")
              .find((l) => String(l || "").startsWith("DEBUG_SERVER_URL="));
            return line ? String(line.split("=").slice(1).join("=")).trim() : "";
          } catch {
            return "";
          }
        })() ||
        "http://127.0.0.1:7777/event";

      const reportDebugEvent = async (payload) => {
        try {
          if (!debugServerUrl) return;
          await fetchCompat(debugServerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "message-edit-failure",
              runId: process.env.DEBUG_RUN_ID || "pre",
              ts: new Date().toISOString(),
              ...payload,
            }),
          });
        } catch {
          void 0;
        }
      };
      // #endregion debug-point A:message-edit-failure

      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      // #region debug-point A:message-edit-failure
      await reportDebugEvent({
        hypothesisId: "A",
        event: "zaphub.edit.request",
        instanceName,
        remoteJid,
        keyRemoteJid,
        number,
        messageKeyId,
        participant,
        textLen: text.length,
        textHead: text.slice(0, 40),
      });
      // #endregion debug-point A:message-edit-failure

      const response = await fetchCompat(`${evolution.baseUrl}/chat/updateMessage/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers: evolution.headers,
        body: JSON.stringify({
          number,
          text,
          key: {
            id: messageKeyId,
            remoteJid: keyRemoteJid,
            fromMe: true,
            participant,
          },
        }),
      });
      const payload = await evolution.parseEvolutionPayload(response);
      if (!response.ok) {
        const message = extractEvolutionMessage(payload, "Falha ao editar mensagem");
        // #region debug-point B:message-edit-failure
        await reportDebugEvent({
          hypothesisId: "B",
          event: "zaphub.edit.response.error",
          status: response.status,
          message,
          instanceName,
          remoteJid,
          keyRemoteJid,
          number,
          messageKeyId,
          participant,
          payloadType: payload == null ? "null" : Array.isArray(payload) ? "array" : typeof payload,
          payloadHead: (() => {
            try {
              const raw = JSON.stringify(payload);
              return raw.length > 1200 ? `${raw.slice(0, 1200)}...` : raw;
            } catch {
              return null;
            }
          })(),
        });
        // #endregion debug-point B:message-edit-failure
        return res.status(response.status || 500).json({ message, payload });
      }

      // #region debug-point C:message-edit-failure
      await reportDebugEvent({
        hypothesisId: "C",
        event: "zaphub.edit.response.ok",
        status: response.status,
        instanceName,
        remoteJid,
        keyRemoteJid,
        number,
        messageKeyId,
        participant,
      });
      // #endregion debug-point C:message-edit-failure

      return res.json({
        ok: true,
        message: extractEvolutionMessage(payload, "Mensagem editada com sucesso"),
        instanceName,
        remoteJid,
        messageKeyId,
        participant,
        text,
        payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao editar mensagem";
      return res.status(500).json({ message });
    }
  });

  router.post("/api/zaphub/mensagens/excluir", async (req, res) => {
    const instanceName = String(req.body?.instanceName || req.query?.instanceName || "").trim();
    const remoteJid = String(req.body?.remoteJid || req.body?.number || req.query?.remoteJid || "").trim();
    const keyRemoteJid = String(req.body?.keyRemoteJid || req.body?.key?.remoteJid || remoteJid).trim();
    const messageKeyId = String(req.body?.messageKeyId || req.body?.key?.id || req.body?.id || "").trim();
    const participant = String(req.body?.participant || req.body?.key?.participant || "").trim() || null;

    if (!instanceName) {
      return res.status(400).json({ message: "instanceName é obrigatório" });
    }
    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }
    if (!messageKeyId) {
      return res.status(400).json({ message: "messageKeyId é obrigatório" });
    }

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      if (hasRules && allowedSet) {
        assertInstanceAllowed({ hasRules, allowedSet, instanceName });
      }

      const response = await fetchCompat(
        `${evolution.baseUrl}/chat/deleteMessageForEveryone/${encodeURIComponent(instanceName)}`,
        {
          method: "DELETE",
          headers: evolution.headers,
          body: JSON.stringify({
            id: messageKeyId,
            remoteJid: keyRemoteJid,
            fromMe: true,
            ...(participant ? { participant } : {}),
          }),
        }
      );
      const payload = await evolution.parseEvolutionPayload(response);
      if (!response.ok) {
        const message = extractEvolutionMessage(payload, "Falha ao excluir mensagem");
        return res.status(response.status || 500).json({ message, payload });
      }

      return res.json({
        ok: true,
        message: extractEvolutionMessage(payload, "Mensagem excluída com sucesso"),
        instanceName,
        remoteJid,
        messageKeyId,
        participant,
        payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao excluir mensagem";
      return res.status(500).json({ message });
    }
  });

  router.post("/api/zaphub/mensagens/enviar-midia", uploadMidia.single("file"), async (req, res) => {
    const remoteJid = String(req.body?.remoteJid || req.body?.number || "").trim();
    const caption = String(req.body?.caption || req.body?.text || "").trim();
    const instanceNameBody = String(req.body?.instanceName || "").trim();
    const file = req.file;

    if (!remoteJid) {
      return res.status(400).json({ message: "remoteJid é obrigatório" });
    }

    if (!file || !file.buffer) {
      return res.status(400).json({ message: "file é obrigatório" });
    }

    const mimetype = String(file.mimetype || "").trim();
    const fileName = String(file.originalname || "").trim() || "arquivo";
    const normalized = mimetype.toLowerCase();
    const mediatype = normalized.startsWith("image/")
      ? "image"
      : normalized.startsWith("video/")
        ? "video"
        : normalized.startsWith("audio/")
          ? "audio"
        : null;

    if (!mediatype) {
      return res.status(400).json({ message: "Tipo de arquivo inválido. Envie imagem, vídeo ou áudio." });
    }

    try {
      const { hasRules, allowedSet } = await resolveInstanceAccessRules(req);
      let instanceName = instanceNameBody;
      if (!instanceName) {
        const signature = await fetchOpenInstanceMessagesSignature({ databasePool });
        instanceName = signature.instance?.instanceName || "";
      }

      if (hasRules && allowedSet) {
        if (!instanceName) {
          return res.status(404).json({ message: "Nenhuma instância permitida disponível para envio" });
        }
        try {
          assertInstanceAllowed({ hasRules, allowedSet, instanceName });
        } catch {
          const fallback = Array.from(allowedSet.values())[0] || "";
          if (!fallback) {
            return res.status(404).json({ message: "Nenhuma instância permitida disponível para envio" });
          }
          instanceName = fallback;
        }
      }

      if (!instanceName) {
        return res.status(404).json({ message: "Nenhuma instância open disponível para envio" });
      }

      const base64Content = file.buffer.toString("base64");
      const isAudio = mediatype === "audio";
      let response = null;
      let payload = null;

      if (isAudio) {
        response = await fetchCompat(`${evolution.baseUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: evolution.headers,
          body: JSON.stringify({
            number: remoteJid,
            audio: base64Content,
          }),
        });
        payload = await evolution.parseEvolutionPayload(response);
        if (!response.ok) {
          response = await fetchCompat(`${evolution.baseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
            method: "POST",
            headers: evolution.headers,
            body: JSON.stringify({
              number: remoteJid,
              mediatype,
              mimetype,
              media: base64Content,
              fileName,
            }),
          });
          payload = await evolution.parseEvolutionPayload(response);
        }
      } else {
        response = await fetchCompat(`${evolution.baseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: evolution.headers,
          body: JSON.stringify({
            number: remoteJid,
            mediatype,
            mimetype,
            caption: caption || undefined,
            media: base64Content,
            fileName,
          }),
        });
        payload = await evolution.parseEvolutionPayload(response);
      }

      if (!response.ok) {
        const message = extractEvolutionMessage(payload, "Falha ao enviar mídia");
        return res.status(response.status || 500).json({ message, payload });
      }

      return res.json({
        ok: true,
        instanceName,
        remoteJid,
        mediatype,
        mimetype,
        fileName,
        caption: caption || null,
        payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro interno ao enviar mídia";
      return res.status(500).json({ message });
    }
  });

  return router;
}
