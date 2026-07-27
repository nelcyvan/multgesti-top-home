import pg from "pg";
import { getMessagePreview } from "./zaphubInstancias.messagePreview.js";
import fs from "node:fs";

let cachedHasCanonicalJidColumn = null;
let cachedHasZapHubEventJidLinksTable = null;
let cachedEnsuredZapHubMensagensIndexes = false;
let ensuringZapHubMensagensIndexesPromise = null;

// #region debug-point A:init
function debugReport({ hypothesisId, msg, data, location }) {
  try {
    const envPathCandidates = [
      "/home/multgesti/.dbg/conversas-param-type.env",
      ".dbg/conversas-param-type.env",
      "/home/multgesti/.dbg/badges-query-timeout.env",
      ".dbg/badges-query-timeout.env",
      "/tmp/mark-read-lock-dbg/mark-read-lock.env",
      ".dbg/mark-read-lock.env",
      ".dbg/zaphub-pool-stopped.env",
    ];
    let url = "http://127.0.0.1:7778/event";
    let sessionId = "badges-query-timeout";
    try {
      for (const envPath of envPathCandidates) {
        try {
          const content = fs.readFileSync(envPath, "utf8");
          url = content.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || url;
          sessionId = content.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
          break;
        } catch {}
      }
    } catch {}

    const payload = {
      sessionId,
      runId: "pre",
      hypothesisId,
      ts: Date.now(),
      location,
      msg: `[DEBUG] ${msg}`,
      data: data && typeof data === "object" ? data : undefined,
    };

    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== "function") return;
    fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}
// #endregion

async function ensureIsOnWhatsappCanonicalSupportWithClient(client) {
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '2s'");
    await client.query("set local statement_timeout = '30s'");
    await client.query(`alter table "IsOnWhatsapp" add column if not exists "canonicalJid" varchar(100) null`);
  await client.query(
    `
      create or replace function zaphub_ionw_sync_jids()
      returns trigger
      language plpgsql
      as $$
      declare
        next_remote text;
        next_lid text;
        tokens text[];
      begin
        next_remote := nullif(trim(coalesce(new."remoteJid", '')), '');
        next_lid := nullif(trim(coalesce(new."lid", '')), '');
        tokens := string_to_array(coalesce(new."jidOptions", ''), ',');
        if next_remote is not null then
          tokens := array_append(tokens, next_remote);
          tokens := array_append(tokens, replace(next_remote, '+', ''));
        end if;
        if next_lid is not null then
          tokens := array_append(tokens, next_lid);
          tokens := array_append(tokens, replace(next_lid, '+', ''));
        end if;
        tokens := array(
          select distinct trim(t)
            from unnest(tokens) as t
           where trim(coalesce(t, '')) <> ''
        );
        new."jidOptions" := array_to_string(tokens, ',');
        if next_remote is null then
          new."canonicalJid" := null;
        elsif next_remote like '%@s.whatsapp.net' then
          new."canonicalJid" := next_remote;
        elsif next_lid is not null and next_lid like '%@s.whatsapp.net' then
          new."canonicalJid" := next_lid;
        else
          new."canonicalJid" := next_remote;
        end if;
        return new;
      end;
      $$;
    `
  );

  await client.query(
    `
      create or replace function zaphub_ionw_merge_contact_jids(input_remote_jid text, input_sender_jid text)
      returns void
      language plpgsql
      as $$
      declare
        safe_remote text;
        safe_sender text;
        lid_jid text;
        wa_jid text;
        merged_options text[];
      begin
        safe_remote := nullif(trim(coalesce(input_remote_jid, '')), '');
        safe_sender := nullif(trim(coalesce(input_sender_jid, '')), '');

        if safe_remote is not null and (safe_remote like '%@g.us' or safe_remote in ('status@broadcast', '0@s.whatsapp.net')) then
          safe_remote := null;
        end if;
        if safe_sender is not null and (safe_sender like '%@g.us' or safe_sender in ('status@broadcast', '0@s.whatsapp.net')) then
          safe_sender := null;
        end if;

        if safe_remote is null and safe_sender is null then
          return;
        end if;

        lid_jid := case
          when safe_remote like '%@lid' then safe_remote
          when safe_sender like '%@lid' then safe_sender
          else null
        end;
        wa_jid := case
          when safe_remote like '%@s.whatsapp.net' then safe_remote
          when safe_sender like '%@s.whatsapp.net' then safe_sender
          else null
        end;

        if wa_jid is null then
          wa_jid := coalesce(safe_remote, safe_sender);
        end if;

        merged_options := array(
          select distinct trim(candidate)
            from (
              select unnest(string_to_array(coalesce(io."jidOptions", ''), ',')) as candidate
                from "IsOnWhatsapp" io
               where (wa_jid is not null and (io."remoteJid" = wa_jid or io."lid" = wa_jid))
                  or (lid_jid is not null and (io."remoteJid" = lid_jid or io."lid" = lid_jid))
              union all select safe_remote
              union all select replace(coalesce(safe_remote, ''), '+', '')
              union all select safe_sender
              union all select replace(coalesce(safe_sender, ''), '+', '')
              union all select wa_jid
              union all select replace(coalesce(wa_jid, ''), '+', '')
              union all select lid_jid
              union all select replace(coalesce(lid_jid, ''), '+', '')
            ) candidates
           where trim(coalesce(candidate, '')) <> ''
        );

        insert into "IsOnWhatsapp" ("id", "remoteJid", "jidOptions", "createdAt", "updatedAt", "lid", "canonicalJid")
        values (
          wa_jid,
          wa_jid,
          array_to_string(merged_options, ','),
          now(),
          now(),
          lid_jid,
          case when wa_jid like '%@s.whatsapp.net' then wa_jid else wa_jid end
        )
        on conflict ("remoteJid") do update
          set "jidOptions" = array_to_string(
                array(
                  select distinct trim(candidate)
                    from unnest(
                      string_to_array(
                        coalesce("IsOnWhatsapp"."jidOptions", '') || ',' || array_to_string(merged_options, ','),
                        ','
                      )
                    ) as candidate
                   where trim(coalesce(candidate, '')) <> ''
                ),
                ','
              ),
              "lid" = coalesce(excluded."lid", "IsOnWhatsapp"."lid"),
              "canonicalJid" = case
                when excluded."remoteJid" like '%@s.whatsapp.net' then excluded."remoteJid"
                else coalesce("IsOnWhatsapp"."canonicalJid", excluded."remoteJid")
              end,
              "updatedAt" = now();

        if lid_jid is not null and lid_jid <> wa_jid then
          delete from "IsOnWhatsapp"
           where "remoteJid" = lid_jid;
        end if;
      end;
      $$;
    `
  );

  await client.query(
    `
      create or replace function zaphub_ionw_upsert_from_jid(input_jid text)
      returns void
      language plpgsql
      as $$
      begin
        perform zaphub_ionw_merge_contact_jids(input_jid, null);
      end;
      $$;
    `
  );

  await client.query(
    `
      create or replace function zaphub_capture_remotejid_to_ionw()
      returns trigger
      language plpgsql
      as $$
      begin
        perform zaphub_ionw_upsert_from_jid(new."remoteJid");
        return new;
      end;
      $$;
    `
  );

  await client.query(
    `
      do $$
      begin
        if not exists (
          select 1
            from pg_trigger
           where tgname = 'trg_zaphub_ionw_sync_jids'
        ) then
          create trigger trg_zaphub_ionw_sync_jids
            before insert or update on "IsOnWhatsapp"
            for each row
            execute function zaphub_ionw_sync_jids();
        end if;
      end $$;
    `
  );

  await client.query(
    `
      do $$
      begin
        if not exists (
          select 1
            from pg_trigger
           where tgname = 'trg_zaphub_contact_capture_remotejid'
        ) then
          create trigger trg_zaphub_contact_capture_remotejid
            after insert or update on "Contact"
            for each row
            execute function zaphub_capture_remotejid_to_ionw();
        end if;
      end $$;
    `
  );

  await client.query(
    `
      do $$
      begin
        if not exists (
          select 1
            from pg_trigger
           where tgname = 'trg_zaphub_chat_capture_remotejid'
        ) then
          create trigger trg_zaphub_chat_capture_remotejid
            after insert or update on "Chat"
            for each row
            execute function zaphub_capture_remotejid_to_ionw();
        end if;
      end $$;
    `
  );

  await client.query(
    `
      insert into "IsOnWhatsapp" ("id", "remoteJid", "jidOptions", "createdAt", "updatedAt", "lid")
      select
        c."remoteJid" as "id",
        c."remoteJid" as "remoteJid",
        c."remoteJid" as "jidOptions",
        now() as "createdAt",
        now() as "updatedAt",
        null as "lid"
      from "Contact" c
      where c."remoteJid" like '%@s.whatsapp.net'
      group by c."remoteJid"
      on conflict ("remoteJid") do update
        set "jidOptions" = case
            when coalesce("IsOnWhatsapp"."jidOptions", '') = '' then excluded."jidOptions"
            else "IsOnWhatsapp"."jidOptions" || ',' || excluded."jidOptions"
          end,
          "updatedAt" = now();
    `
  );

  await client.query(
    `
      insert into "IsOnWhatsapp" ("id", "remoteJid", "jidOptions", "createdAt", "updatedAt", "lid")
      select
        ch."remoteJid" as "id",
        ch."remoteJid" as "remoteJid",
        ch."remoteJid" as "jidOptions",
        now() as "createdAt",
        now() as "updatedAt",
        null as "lid"
      from "Chat" ch
      where ch."remoteJid" like '%@s.whatsapp.net'
      group by ch."remoteJid"
      on conflict ("remoteJid") do update
        set "jidOptions" = case
            when coalesce("IsOnWhatsapp"."jidOptions", '') = '' then excluded."jidOptions"
            else "IsOnWhatsapp"."jidOptions" || ',' || excluded."jidOptions"
          end,
          "updatedAt" = now();
    `
  );

  await client.query(`update "IsOnWhatsapp" set "jidOptions" = coalesce("jidOptions", '')`);

  await client.query(
    `
      create table if not exists zaphub_event_jid_links (
        instance_id varchar(100) not null,
        remote_jid varchar(100) not null,
        sender_jid varchar(100) null,
        remote_jid_alt varchar(100) null,
        updated_at timestamptz not null default now(),
        primary key (instance_id, remote_jid)
      )
    `
  );
  await client.query(`alter table zaphub_event_jid_links add column if not exists remote_jid_alt varchar(100) null`);
  await client.query(
    `
      create index if not exists zaphub_event_jid_links_remote_idx
        on zaphub_event_jid_links (remote_jid)
    `
  );
  await client.query(
    `
      create index if not exists zaphub_event_jid_links_sender_idx
        on zaphub_event_jid_links (sender_jid)
    `
  );
  await client.query(
    `
      create index if not exists zaphub_event_jid_links_alt_idx
        on zaphub_event_jid_links (remote_jid_alt)
    `
  );
  cachedHasCanonicalJidColumn = true;
    await client.query("commit");
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {}
    throw err;
  }
}

async function ensureZapHubEventJidLinksTable(client) {
  if (typeof cachedHasZapHubEventJidLinksTable === "boolean") return cachedHasZapHubEventJidLinksTable;
  try {
    const result = await client.query(
      `
        select 1
          from information_schema.tables
         where table_schema = current_schema()
           and lower(table_name) = lower('zaphub_event_jid_links')
         limit 1
      `
    );
    cachedHasZapHubEventJidLinksTable = Boolean(result.rows && result.rows.length > 0);
  } catch {
    cachedHasZapHubEventJidLinksTable = false;
  }

  return cachedHasZapHubEventJidLinksTable;
}

async function ensureZapHubMensagensIndexesWithClient(client) {
  const statements = [
    `create index if not exists zaphub_message_instance_ts_idx on "Message" ("instanceId", "messageTimestamp" desc)`,
    `create index if not exists zaphub_message_instance_remote_ts_idx on "Message" ("instanceId", ((key->>'remoteJid')), "messageTimestamp" desc)`,
    `create index if not exists zaphub_message_instance_remote_ts_id_idx on "Message" ("instanceId", ((key->>'remoteJid')), "messageTimestamp" desc, id desc)`,
    `create index if not exists zaphub_message_instance_remote_ts_id_partial_idx on "Message" ("instanceId", ((key->>'remoteJid')), "messageTimestamp" desc, id desc)
      where coalesce(key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
        and lower(coalesce("messageType", '')) <> 'secretencryptedmessage'`,
    `create index if not exists zaphub_chat_instance_remote_idx on "Chat" ("instanceId", "remoteJid")`,
    `create index if not exists zaphub_contact_instance_remote_idx on "Contact" ("instanceId", "remoteJid")`,
    `create index if not exists zaphub_media_instance_message_idx on "Media" ("instanceId", "messageId")`,
    `create index if not exists zaphub_ionw_lid_idx on "IsOnWhatsapp" ("lid")`,
  ];

  for (const statement of statements) {
    try {
      await client.query(statement);
    } catch (err) {
      debugReport({
        hypothesisId: "IDX",
        location: "zaphubInstancias.db.js:ensureZapHubMensagensIndexesWithClient",
        msg: "failed to ensure index",
        data: { statement, message: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

async function ensureZapHubMensagensIndexesOnce(client) {
  if (cachedEnsuredZapHubMensagensIndexes) return;
  if (ensuringZapHubMensagensIndexesPromise) {
    await ensuringZapHubMensagensIndexesPromise;
    return;
  }
  ensuringZapHubMensagensIndexesPromise = (async () => {
    try {
      await ensureZapHubMensagensIndexesWithClient(client);
      cachedEnsuredZapHubMensagensIndexes = true;
    } finally {
      ensuringZapHubMensagensIndexesPromise = null;
    }
  })();
  await ensuringZapHubMensagensIndexesPromise;
}

export function createDatabasePool(databaseUrl) {
  // #region debug-point A:pool-create
  (() => {
    const raw = String(databaseUrl || "");
    let parsed = null;
    try {
      const u = new URL(raw);
      parsed = {
        protocol: u.protocol,
        host: u.host,
        pathname: u.pathname,
      };
    } catch {}
    debugReport({
      hypothesisId: "A",
      location: "zaphubInstancias.db.js:createDatabasePool",
      msg: "createDatabasePool called",
      data: {
        hasDatabaseUrl: Boolean(raw),
        urlInfo: parsed,
      },
    });
  })();
  // #endregion
  if (!databaseUrl) return null;
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
    query_timeout: 30000,
  });

  // #region debug-point B:pool-error-event
  pool.on("error", (err) => {
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:pg.Pool:error",
      msg: "pool emitted error event",
      data: { message: err instanceof Error ? err.message : String(err) },
    });
  });
  // #endregion

  return pool;
}

async function hasCanonicalJidColumn(client) {
  if (typeof cachedHasCanonicalJidColumn === "boolean") return cachedHasCanonicalJidColumn;

  const t0 = Date.now();
  try {
    // #region debug-point C:has-column-start
    debugReport({
      hypothesisId: "C",
      location: "zaphubInstancias.db.js:hasCanonicalJidColumn",
      msg: "checking information_schema for IsOnWhatsapp.canonicalJid",
      data: {},
    });
    // #endregion
    const result = await client.query(
      `
        select 1
          from information_schema.columns
         where table_schema = current_schema()
           and lower(table_name) = lower('IsOnWhatsapp')
           and lower(column_name) = lower('canonicalJid')
         limit 1
      `
    );
    cachedHasCanonicalJidColumn = Boolean(result.rows && result.rows.length > 0);
  } catch {
    cachedHasCanonicalJidColumn = false;
  }

  // #region debug-point C:has-column-result
  debugReport({
    hypothesisId: "C",
    location: "zaphubInstancias.db.js:hasCanonicalJidColumn",
    msg: "information_schema check completed",
    data: { hasCanonicalJid: cachedHasCanonicalJidColumn, elapsedMs: Date.now() - t0 },
  });
  // #endregion

  return cachedHasCanonicalJidColumn;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function getSafeLimit(limit) {
  const numericLimit = Number(limit);
  return Number.isFinite(numericLimit) ? Math.max(1, Math.min(40, numericLimit)) : 40;
}

function getSafeConversationsLimit(limit) {
  const numericLimit = Number(limit);
  return Number.isFinite(numericLimit) ? Math.max(1, Math.min(120, numericLimit)) : 40;
}

function getSafeConversationMessageLimit(limit) {
  const safeLimit = getSafeLimit(limit);
  return Math.max(5, Math.min(16, Math.ceil(480 / safeLimit)));
}

function getSafeConversationMessagesLimit(limit) {
  const numericLimit = Number(limit);
  return Number.isFinite(numericLimit) ? Math.max(10, Math.min(240, numericLimit)) : 80;
}

function normalizeMediaKind(messageType) {
  const normalizedType = String(messageType || "").trim().toLowerCase();
  if (normalizedType.includes("image")) return "image";
  if (normalizedType.includes("video")) return "video";
  if (normalizedType.includes("audio")) return "audio";
  if (normalizedType.includes("sticker")) return "sticker";
  if (normalizedType.includes("document")) return "document";
  return null;
}

function getMessageMediaPayload(message, messageType) {
  if (!message || typeof message !== "object") return null;

  const rawType = String(messageType || "").trim();
  if (rawType && message[rawType] && typeof message[rawType] === "object") {
    return message[rawType];
  }

  const mediaKind = normalizeMediaKind(messageType);
  const fallbackKeyByKind = {
    image: "imageMessage",
    video: "videoMessage",
    audio: "audioMessage",
    sticker: "stickerMessage",
    document: "documentMessage",
  };
  const fallbackKey = mediaKind ? fallbackKeyByKind[mediaKind] : null;
  return fallbackKey && message[fallbackKey] && typeof message[fallbackKey] === "object"
    ? message[fallbackKey]
    : null;
}

function getHttpUrl(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

function extractMessageMedia(message, messageType, mediaRow = {}) {
  const kind = normalizeMediaKind(messageType);
  if (!kind) return null;

  const payload = getMessageMediaPayload(message, messageType);
  const sourceUrl = getHttpUrl(payload?.url) || getHttpUrl(payload?.mediaUrl);
  const caption = typeof payload?.caption === "string" && payload.caption.trim() ? payload.caption.trim() : null;
  const fileName = String(mediaRow.fileName || payload?.fileName || "").trim() || null;
  const mimetype = String(mediaRow.mimetype || payload?.mimetype || "").trim() || null;

  return {
    kind,
    sourceUrl,
    fileName,
    mimetype,
    caption,
    canLoadHd: true,
  };
}

function mapInstance(instance) {
  return {
    id: instance.id,
    instanceName: instance.name,
    profileName: instance.profileName || null,
    number: instance.number || null,
    status: instance.connectionStatus,
  };
}

async function fetchTargetInstanceById(client, instanceId) {
  const safeInstanceId = String(instanceId || "").trim();
  if (!safeInstanceId) {
    throw new Error("instanceId é obrigatório");
  }
  const result = await client.query(
    `
      select
        id,
        name,
        "profileName",
        number,
        "connectionStatus",
        extract(epoch from coalesce("createdAt", now()))::bigint as "instanceCreatedAt"
      from "Instance"
      where id = $1
      order by "createdAt" desc nulls last, id desc
      limit 1
    `,
    [safeInstanceId]
  );
  const instance = result.rows[0];
  if (!instance) {
    throw new Error(`Instância ${safeInstanceId} não foi encontrada`);
  }
  return instance;
}

async function fetchTargetInstance(client, instanceName = null, instanceId = null) {
  const safeInstanceName = String(instanceName || "").trim();
  const safeInstanceId = String(instanceId || "").trim();
  if (safeInstanceId) {
    return await fetchTargetInstanceById(client, safeInstanceId);
  }
  const instanceResult = safeInstanceName
    ? await client.query(
        `
          select
            id,
            name,
            "profileName",
            number,
            "connectionStatus",
            extract(epoch from coalesce("createdAt", now()))::bigint as "instanceCreatedAt"
          from "Instance"
          where lower(name) = lower($1)
          order by "createdAt" desc nulls last, id desc
          limit 1
        `,
        [safeInstanceName]
      )
    : await client.query(
        `
          select
            id,
            name,
            "profileName",
            number,
            "connectionStatus",
            extract(epoch from coalesce("createdAt", now()))::bigint as "instanceCreatedAt"
          from "Instance"
          where "connectionStatus" = 'open'
          order by "createdAt" desc nulls last, id desc
          limit 1
        `
      );

  const instance = instanceResult.rows[0];
  if (!instance) {
    throw new Error(
      safeInstanceName
        ? `Instância ${safeInstanceName} não foi encontrada`
        : "Nenhuma instância com status open foi encontrada"
    );
  }

  return instance;
}

async function fetchOpenInstanceMessagesSignatureWithClient(client, instanceName = null, instanceId = null) {
  const instance = await fetchTargetInstance(client, instanceName, instanceId);

  const messagesMetaResult = await client.query(
    `
      select
        count(*)::bigint as "messageCount",
        coalesce(max("messageTimestamp"), 0)::bigint as "lastMessageTimestamp"
      from "Message"
      where "instanceId" = $1
        and coalesce(key->>'remoteJid', '') not in ('status@broadcast', '0@s.whatsapp.net')
        and lower(coalesce("messageType", '')) <> 'secretencryptedmessage'
    `,
    [instance.id]
  );

  const chatMetaResult = await client.query(
    `
      select
        count(*)::bigint as "chatCount",
        coalesce(max(extract(epoch from coalesce("createdAt", now()))), 0)::bigint as "lastChatCreatedAt",
        coalesce(sum("unreadMessages"), 0)::bigint as "totalUnreadMessages",
        coalesce(max("unreadMessages"), 0)::bigint as "maxUnreadMessages"
      from "Chat"
      where "instanceId" = $1
    `,
    [instance.id]
  );

  const messagesMeta = messagesMetaResult.rows[0] || {};
  const chatMeta = chatMetaResult.rows[0] || {};

  const signature = [
    instance.id,
    instance.connectionStatus || "",
    String(instance.instanceCreatedAt || 0),
    String(messagesMeta.messageCount || 0),
    String(messagesMeta.lastMessageTimestamp || 0),
    String(chatMeta.chatCount || 0),
    String(chatMeta.lastChatCreatedAt || 0),
    String(chatMeta.totalUnreadMessages || 0),
    String(chatMeta.maxUnreadMessages || 0),
  ].join(":");

  return {
    instance: mapInstance(instance),
    signature,
  };
}

async function fetchInstanceConversationsSignatureWithClient(client, instanceName = null, instanceId = null) {
  return fetchOpenInstanceMessagesSignatureWithClient(client, instanceName, instanceId);
}

async function fetchConversationMessagesSignatureWithClient(client, instanceName = null, instanceId = null, remoteJid = null) {
  const instance = await fetchTargetInstance(client, instanceName, instanceId);
  const safeRemoteJid = String(remoteJid || "").trim();
  if (!safeRemoteJid) {
    throw new Error("remoteJid é obrigatório para consultar assinatura da conversa");
  }

  const messagesMetaResult = await client.query(
    `
      select
        count(*)::bigint as "messageCount",
        coalesce(max("messageTimestamp"), 0)::bigint as "lastMessageTimestamp"
      from "Message"
      where "instanceId" = $1
        and coalesce(key->>'remoteJid', '') = $2
        and coalesce(key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
        and lower(coalesce("messageType", '')) <> 'secretencryptedmessage'
    `,
    [instance.id, safeRemoteJid]
  );

  const chatMetaResult = await client.query(
    `
      select
        coalesce("unreadMessages", 0)::bigint as "unreadMessages"
      from "Chat"
      where "instanceId" = $1
        and "remoteJid" = $2
      order by "updatedAt" desc nulls last, "createdAt" desc nulls last
      limit 1
    `,
    [instance.id, safeRemoteJid]
  );

  const messagesMeta = messagesMetaResult.rows[0] || {};
  const chatMeta = chatMetaResult.rows[0] || {};
  const signature = [
    instance.id,
    safeRemoteJid,
    String(messagesMeta.messageCount || 0),
    String(messagesMeta.lastMessageTimestamp || 0),
    String(chatMeta.unreadMessages || 0),
  ].join(":");

  return {
    instance: mapInstance(instance),
    remoteJid: safeRemoteJid,
    signature,
  };
}

async function fetchOpenInstanceMessagesWithClient(client, limit = 80, instanceName = null, instanceId = null) {
  await ensureZapHubMensagensIndexesOnce(client);
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '2s'");
    await client.query("set local statement_timeout = '25s'");

    // #region debug-point G0:mensagens-tx-start
    debugReport({
      hypothesisId: "G",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesWithClient",
      msg: "tx started",
      data: { limit, instanceName, instanceId: instanceId || null },
    });
    // #endregion
    const instance = await fetchTargetInstance(client, instanceName, instanceId);
    const safeLimit = getSafeLimit(limit);
    const safeConversationMessageLimit = getSafeConversationMessageLimit(safeLimit);
    const canUseCanonicalJid = await hasCanonicalJidColumn(client);
    const canUseEventLinks = await ensureZapHubEventJidLinksTable(client);
    // #region debug-point G1:mensagens-capabilities
    debugReport({
      hypothesisId: "G",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesWithClient",
      msg: "capabilities resolved",
      data: {
        instanceId: instance?.id,
        canUseCanonicalJid,
        canUseEventLinks,
        safeLimit,
        safeConversationMessageLimit,
      },
    });
    // #endregion
    const ionwCanonicalSelect = canUseCanonicalJid ? 'ionw."canonicalJid"' : "null";
    const ionwPartCanonicalSelect = canUseCanonicalJid ? 'ionw_part."canonicalJid"' : "null";
    const eventSenderSelect = canUseEventLinks
      ? `jel.sender_jid as "eventSenderJid", jel.remote_jid_alt as "eventRemoteJidAlt",`
      : `null as "eventSenderJid", null as "eventRemoteJidAlt",`;
    const eventLinksJoin = canUseEventLinks
      ? `
      left join zaphub_event_jid_links jel
        on jel.instance_id = b."instanceId"
       and jel.remote_jid = coalesce(c."remoteJid", b."remoteJidKey")
    `
      : "";

    const messagesResult = await client.query(
      `
        with recent_conversations as (
          select *
          from (
            select distinct on (coalesce(m.key->>'remoteJid', ''))
              coalesce(m.key->>'remoteJid', '') as "remoteJidKey",
              m."messageTimestamp" as "latestMessageTimestamp"
            from "Message" m
            where m."instanceId" = $1
              and coalesce(m.key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
              and lower(coalesce(m."messageType", '')) <> 'secretencryptedmessage'
            order by coalesce(m.key->>'remoteJid', ''), m."messageTimestamp" desc nulls last, m.id desc
          ) recent
          order by recent."latestMessageTimestamp" desc nulls last, recent."remoteJidKey"
          limit $2
        )
        select
          b.id,
          b."messageType",
          b.message,
          b.key,
          b."messageTimestamp",
          b."pushName",
          rc."latestMessageTimestamp" as "latestMessageTimestamp",
          case
            when coalesce(b.participant, b."participantKey") like '%@g.us'
              then null
            else coalesce(b.participant, b."participantKey")
          end as participant,
          b.status,
          b.key->>'id' as "messageKeyId",
          c.name as "chatName",
          coalesce(c."remoteJid", b."remoteJidKey") as "remoteJid",
          case
            when coalesce(c."remoteJid", b."remoteJidKey") like '%@g.us'
              then coalesce(c."remoteJid", b."remoteJidKey")
            else coalesce(${ionwCanonicalSelect}, ionw."remoteJid", coalesce(c."remoteJid", b."remoteJidKey"))
          end as "canonicalRemoteJid",
          case
            when coalesce(c."remoteJid", b."remoteJidKey") like '%@g.us'
              then coalesce(
                ${ionwPartCanonicalSelect},
                ionw_part."remoteJid",
                case
                  when coalesce(b.participant, b."participantKey") like '%@g.us'
                    then null
                  else coalesce(b.participant, b."participantKey")
                end
              )
            else coalesce(${ionwCanonicalSelect}, ionw."remoteJid", coalesce(c."remoteJid", b."remoteJidKey"))
          end as "contactRemoteJid",
          case
            when coalesce(c."remoteJid", b."remoteJidKey") like '%@g.us'
              then null
            else coalesce(ionw."lid", null)
          end as "lidRemoteJid",
          coalesce(c."unreadMessages", 0) as "unreadMessages",
          ct."profilePicUrl" as "profilePicUrl",
          ${eventSenderSelect}
          md."fileName" as "mediaFileName",
          md.mimetype as "mediaMimetype",
          md.type as "mediaStoredType"
        from recent_conversations rc
        inner join lateral (
          select
            m.id,
            m."instanceId",
            m."messageType",
            m.message,
            m.key,
            m."messageTimestamp",
            m."pushName",
            m.participant,
            m.status,
            (m.key->>'remoteJid') as "remoteJidKey",
            (m.key->>'participant') as "participantKey"
          from "Message" m
          where m."instanceId" = $1
            and coalesce(m.key->>'remoteJid', '') = rc."remoteJidKey"
            and coalesce(m.key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
            and lower(coalesce(m."messageType", '')) <> 'secretencryptedmessage'
          order by m."messageTimestamp" desc nulls last, m.id desc
          limit $3
        ) b on true
        left join "Chat" c
          on c."instanceId" = b."instanceId"
         and c."remoteJid" = b."remoteJidKey"
        ${eventLinksJoin}
        left join "Contact" ct
          on ct."instanceId" = b."instanceId"
         and ct."remoteJid" = coalesce(c."remoteJid", b."remoteJidKey")
        left join "IsOnWhatsapp" ionw
          on (
            ionw."remoteJid" = coalesce(c."remoteJid", b."remoteJidKey")
            or ionw."remoteJid" = replace(coalesce(c."remoteJid", b."remoteJidKey"), '+', '')
            or ionw."lid" = coalesce(c."remoteJid", b."remoteJidKey")
            or ionw."lid" = replace(coalesce(c."remoteJid", b."remoteJidKey"), '+', '')
          )
        left join "IsOnWhatsapp" ionw_part
          on (
            ionw_part."remoteJid" = coalesce(b.participant, b."participantKey")
            or ionw_part."remoteJid" = replace(coalesce(b.participant, b."participantKey"), '+', '')
            or ionw_part."lid" = coalesce(b.participant, b."participantKey")
            or ionw_part."lid" = replace(coalesce(b.participant, b."participantKey"), '+', '')
          )
        left join "Media" md
          on md."instanceId" = b."instanceId"
         and md."messageId" = b.id
        order by rc."latestMessageTimestamp" desc nulls last, b."messageTimestamp" desc nulls last
      `,
      [instance.id, safeLimit, safeConversationMessageLimit]
    );

    const rows = messagesResult.rows.map((row) => {
      const key = row.key && typeof row.key === "object" ? row.key : {};
      const fromMe = parseBoolean(key.fromMe);
      const preview = getMessagePreview(row.message, row.messageType);
      const previewNormalized = String(preview || "").trim().toLowerCase();
      const statusNormalized = String(row.status || "").trim().toUpperCase();
      const isDeleted = statusNormalized === "DELETED" || (fromMe && previewNormalized === "[conversation]");
      const media = extractMessageMedia(row.message, row.messageType, {
        fileName: row.mediaFileName,
        mimetype: row.mediaMimetype,
        type: row.mediaStoredType,
      });
      return {
        id: row.id,
        messageKeyId: row.messageKeyId || null,
        chatName: row.chatName || row.pushName || row.remoteJid || "Sem nome",
        remoteJid: row.remoteJid || null,
        canonicalRemoteJid: row.canonicalRemoteJid || row.contactRemoteJid || row.remoteJid || null,
        contactRemoteJid: row.contactRemoteJid || row.remoteJid || null,
        lidRemoteJid: row.lidRemoteJid || null,
        unreadMessages: Number(row.unreadMessages) || 0,
        profilePicUrl: row.profilePicUrl || null,
        eventSenderJid: row.eventSenderJid || null,
        eventRemoteJidAlt: row.eventRemoteJidAlt || null,
        messageType: row.messageType,
        preview,
        fromMe,
        senderName: fromMe
          ? instance.profileName || instance.name || "Eu"
          : row.pushName || row.participant || row.chatName || row.remoteJid || "Contato",
        participant: row.participant || null,
        status: row.status || null,
        isDeleted,
        timestamp: Number(row.messageTimestamp) || null,
        sentAt: Number(row.messageTimestamp) > 0 ? new Date(Number(row.messageTimestamp) * 1000).toISOString() : null,
        media,
      };
    });

    const normalizedRows = rows.filter(
      (row) => String(row.messageType || "").trim().toLowerCase() !== "secretencryptedmessage"
    );
    const dedupedByKey = new Map();
    normalizedRows.forEach((row) => {
      const keyId = String(row.messageKeyId || "").trim();
      const remoteKey = String(row.remoteJid || row.canonicalRemoteJid || row.contactRemoteJid || "")
        .trim()
        .toLowerCase();
      const dedupeKey = keyId ? `${remoteKey}::${keyId}` : `id::${row.id}`;
      const current = dedupedByKey.get(dedupeKey);
      if (!current) {
        dedupedByKey.set(dedupeKey, row);
        return;
      }
      const currentTs = Number(current.timestamp || 0);
      const nextTs = Number(row.timestamp || 0);
      if (nextTs > currentTs) {
        dedupedByKey.set(dedupeKey, row);
        return;
      }
      if (nextTs === currentTs && Boolean(row.isDeleted) && !Boolean(current.isDeleted)) {
        dedupedByKey.set(dedupeKey, row);
        return;
      }
      const currentStatus = String(current.status || "").trim().toUpperCase();
      const nextStatus = String(row.status || "").trim().toUpperCase();
      if (currentStatus === "PENDING" && nextStatus !== "PENDING") {
        dedupedByKey.set(dedupeKey, row);
        return;
      }
      const currentPreview = String(current.preview || "").trim();
      const nextPreview = String(row.preview || "").trim();
      if (nextPreview.length > currentPreview.length) {
        dedupedByKey.set(dedupeKey, row);
      }
    });

    const signatureData = await fetchOpenInstanceMessagesSignatureWithClient(client, instanceName);

    const result = {
      instance: mapInstance(instance),
      rows: Array.from(dedupedByKey.values()).sort(
        (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
      ),
      signature: signatureData.signature,
    };

    await client.query("commit");
    // #region debug-point G2:mensagens-tx-commit
    debugReport({
      hypothesisId: "G",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesWithClient",
      msg: "tx committed",
      data: { instanceId: instance?.id, rowsCount: result.rows.length },
    });
    // #endregion
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {}
    // #region debug-point G3:mensagens-tx-error
    debugReport({
      hypothesisId: "G",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesWithClient",
      msg: "tx failed",
      data: {
        message: err instanceof Error ? err.message : String(err),
        code: err && typeof err === "object" && "code" in err ? err.code : undefined,
        detail: err && typeof err === "object" && "detail" in err ? err.detail : undefined,
        where: err && typeof err === "object" && "where" in err ? err.where : undefined,
        routine: err && typeof err === "object" && "routine" in err ? err.routine : undefined,
      },
    });
    // #endregion
    throw err;
  }
}

function getConversationRowTimestamp(row) {
  const fromSentAt = row?.lastSentAt ? new Date(row.lastSentAt).getTime() : 0;
  const fromTimestamp = Number(row?.lastTimestamp || 0) * 1000;
  const ts = Math.max(fromSentAt, fromTimestamp);
  return Number.isFinite(ts) && ts > 0 ? ts : 0;
}

function mergeConversationRows(left, right) {
  const leftTs = getConversationRowTimestamp(left);
  const rightTs = getConversationRowTimestamp(right);
  const newest = rightTs > leftTs ? right : left;
  const oldest = newest === left ? right : left;

  const pickJid = (...candidates) => {
    const values = candidates.map((value) => String(value || "").trim()).filter(Boolean);
    const groupJid = values.find((jid) => jid.includes("@g.us"));
    if (groupJid) return groupJid;
    return (
      values.find((jid) => jid.endsWith("@s.whatsapp.net")) ||
      values.find((jid) => jid.endsWith("@lid")) ||
      values[0] ||
      null
    );
  };

  const remoteJid = pickJid(
    newest.remoteJid,
    oldest.remoteJid,
    newest.canonicalRemoteJid,
    oldest.canonicalRemoteJid,
    newest.contactRemoteJid,
    oldest.contactRemoteJid
  );
  const canonicalRemoteJid = pickJid(
    newest.canonicalRemoteJid,
    oldest.canonicalRemoteJid,
    newest.remoteJid,
    oldest.remoteJid,
    newest.contactRemoteJid,
    oldest.contactRemoteJid
  );
  const contactRemoteJid = pickJid(newest.contactRemoteJid, oldest.contactRemoteJid, canonicalRemoteJid, remoteJid);
  const mergedId = String(remoteJid || canonicalRemoteJid || contactRemoteJid || newest.id || oldest.id).trim();

  return {
    ...newest,
    id: mergedId,
    chatName: newest.chatName || oldest.chatName,
    remoteJid,
    canonicalRemoteJid,
    contactRemoteJid,
    lidRemoteJid: newest.lidRemoteJid || oldest.lidRemoteJid || null,
    eventSenderJid: newest.eventSenderJid || oldest.eventSenderJid || null,
    eventRemoteJidAlt: newest.eventRemoteJidAlt || oldest.eventRemoteJidAlt || null,
    unreadCount: Math.max(Number(left.unreadCount) || 0, Number(right.unreadCount) || 0),
    profilePicUrl: newest.profilePicUrl || oldest.profilePicUrl || null,
  };
}

function getContatoNumeroFromJid(remoteJid) {
  const raw = String(remoteJid || "").trim();
  if (!raw || raw.includes("@g.us")) return null;
  const jidPart = raw.split("@")[0] || "";
  const digits = jidPart.replace(/\D+/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? `+${digits}` : digits;
}

function isGroupConversationJid(remoteJid) {
  return String(remoteJid || "").includes("@g.us");
}

function collectConversationRowJids(row) {
  return [
    row?.remoteJid,
    row?.canonicalRemoteJid,
    row?.contactRemoteJid,
    row?.lidRemoteJid,
    row?.eventSenderJid,
    row?.eventRemoteJidAlt,
    row?.id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getConversationRowGroupJid(row) {
  return collectConversationRowJids(row).find((jid) => isGroupConversationJid(jid)) || null;
}

function jidToConversationMergeKey(jid) {
  const trimmed = String(jid || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("@g.us")) return `group:${trimmed}`;
  if (trimmed.endsWith("@lid")) return `lid:${trimmed}`;
  const phone = getContatoNumeroFromJid(trimmed);
  if (phone) return `phone:${phone}`;
  return `jid:${trimmed}`;
}

function getConversationRowIdentityKey(row) {
  const jidCandidates = collectConversationRowJids(row);
  const groupJid = jidCandidates.find((jid) => isGroupConversationJid(jid));
  if (groupJid) return `group:${groupJid}`;

  const whatsappJid = jidCandidates.find((jid) => jid.endsWith("@s.whatsapp.net")) || null;
  const lidJid = jidCandidates.find((jid) => jid.endsWith("@lid")) || null;
  const phone = getContatoNumeroFromJid(
    whatsappJid || row?.canonicalRemoteJid || row?.contactRemoteJid || row?.remoteJid
  );
  if (phone) return `phone:${phone}`;
  if (lidJid) return `lid:${lidJid}`;

  const canonical = String(row?.canonicalRemoteJid || row?.contactRemoteJid || row?.remoteJid || "").trim();
  if (canonical) return `jid:${canonical}`;

  const id = String(row?.id || "").trim();
  if (id) return `id:${id}`;

  return `name:${String(row?.chatName || "").trim().toLowerCase()}`;
}

function shouldCrossLinkMergeConversationRows(left, right) {
  if (isGroupConversationJid(left?.remoteJid) || isGroupConversationJid(right?.remoteJid)) return false;

  const leftJids = new Set(collectConversationRowJids(left).filter((jid) => !isGroupConversationJid(jid)));
  const rightJids = collectConversationRowJids(right).filter((jid) => !isGroupConversationJid(jid));
  if (rightJids.some((jid) => leftJids.has(jid))) return true;

  const leftRemote = String(left?.remoteJid || "").trim();
  const rightRemote = String(right?.remoteJid || "").trim();
  const leftCanonical = String(left?.canonicalRemoteJid || "").trim();
  const rightCanonical = String(right?.canonicalRemoteJid || "").trim();
  const leftLid = String(left?.lidRemoteJid || "").trim();
  const rightLid = String(right?.lidRemoteJid || "").trim();

  if (leftRemote.endsWith("@lid") && rightRemote.endsWith("@s.whatsapp.net") && leftCanonical === rightRemote) return true;
  if (rightRemote.endsWith("@lid") && leftRemote.endsWith("@s.whatsapp.net") && rightCanonical === leftRemote) return true;
  if (leftLid && (leftLid === rightRemote || leftLid === rightCanonical)) return true;
  if (rightLid && (rightLid === leftRemote || rightLid === leftCanonical)) return true;

  return false;
}

function dedupeConversationRows(rows) {
  if (!Array.isArray(rows) || rows.length <= 1) return rows || [];

  const byIdentity = new Map();
  for (const row of rows) {
    const key = getConversationRowIdentityKey(row);
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? mergeConversationRows(existing, row) : row);
  }

  let current = Array.from(byIdentity.values());

  const byId = new Map();
  for (const row of current) {
    const id = String(row?.id || row?.remoteJid || "").trim();
    if (!id) continue;
    const existing = byId.get(id);
    byId.set(id, existing ? mergeConversationRows(existing, row) : row);
  }
  current = Array.from(byId.values());

  if (current.length <= 1) {
    return current.sort((a, b) => getConversationRowTimestamp(b) - getConversationRowTimestamp(a));
  }

  const parent = current.map((_, index) => index);
  const find = (index) => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left, right) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };

  for (let left = 0; left < current.length; left += 1) {
    for (let right = left + 1; right < current.length; right += 1) {
      if (shouldCrossLinkMergeConversationRows(current[left], current[right])) {
        union(left, right);
      }
    }
  }

  const groups = new Map();
  current.forEach((row, index) => {
    const root = find(index);
    const existing = groups.get(root);
    groups.set(root, existing ? mergeConversationRows(existing, row) : row);
  });

  const deduped = Array.from(groups.values());
  if (deduped.length !== rows.length) {
    debugReport({
      hypothesisId: "F",
      location: "zaphubInstancias.db.js:dedupeConversationRows",
      msg: "conversation rows deduped",
      data: {
        beforeCount: rows.length,
        afterCount: deduped.length,
        removedCount: rows.length - deduped.length,
      },
    });
  }

  return deduped.sort((a, b) => getConversationRowTimestamp(b) - getConversationRowTimestamp(a));
}

function buildContactJidsMatchSql(leftJidExpr, rightJidExpr, instanceIdParam = null) {
  const eventLinks = instanceIdParam
    ? `
      or exists (
        select 1
          from zaphub_event_jid_links jel
         where jel.instance_id = ${instanceIdParam}
           and (
             (
               jel.remote_jid = ${leftJidExpr}
               and coalesce(nullif(jel.remote_jid_alt, ''), nullif(jel.sender_jid, '')) = ${rightJidExpr}
             )
             or (
               jel.remote_jid = ${rightJidExpr}
               and coalesce(nullif(jel.remote_jid_alt, ''), nullif(jel.sender_jid, '')) = ${leftJidExpr}
             )
             or (jel.sender_jid = ${leftJidExpr} and jel.remote_jid = ${rightJidExpr})
             or (jel.sender_jid = ${rightJidExpr} and jel.remote_jid = ${leftJidExpr})
           )
      )
    `
    : "";

  return `(
    ${leftJidExpr} = ${rightJidExpr}
    or replace(${leftJidExpr}, '+', '') = replace(${rightJidExpr}, '+', '')
    or exists (
      select 1
        from "IsOnWhatsapp" io_a
       where (
         io_a."remoteJid" = ${leftJidExpr}
         or io_a."lid" = ${leftJidExpr}
         or io_a."jidOptions" like ('%,' || ${leftJidExpr} || ',%')
         or io_a."jidOptions" like (${leftJidExpr} || ',%')
         or io_a."jidOptions" like ('%,' || ${leftJidExpr})
         or io_a."jidOptions" = ${leftJidExpr}
       )
       and (
         io_a."remoteJid" = ${rightJidExpr}
         or io_a."lid" = ${rightJidExpr}
         or io_a."jidOptions" like ('%,' || ${rightJidExpr} || ',%')
         or io_a."jidOptions" like (${rightJidExpr} || ',%')
         or io_a."jidOptions" like ('%,' || ${rightJidExpr})
         or io_a."jidOptions" = ${rightJidExpr}
       )
    )
    ${eventLinks}
  )`;
}

function buildExcludePuxadasFromPrincipalSql(messageRemoteJidExpr, instanceNameParam, instanceIdParam = null) {
  const contactMatchSql = buildContactJidsMatchSql("p.remote_jid", messageRemoteJidExpr, instanceIdParam);
  return `
    and not exists (
      select 1
        from zaphub_mensagens_puxadas p
       where p.instance_name = ${instanceNameParam}
         and p.encerrada_at is null
         and ${contactMatchSql}
    )
  `;
}

function buildIncludePuxadasForMatriculaSql(messageRemoteJidExpr, instanceNameParam, matriculaParam, instanceIdParam, encerradasFilterSql = "") {
  const contactMatchSql = buildContactJidsMatchSql("p.remote_jid", messageRemoteJidExpr, instanceIdParam);
  return `
    and exists (
      select 1
        from zaphub_mensagens_puxadas p
       where p.instance_name = ${instanceNameParam}
         and p.usuario_matricula = ${matriculaParam}
         and ${contactMatchSql}
         ${encerradasFilterSql}
    )
  `;
}

async function expandContactJidAliasesWithClient(client, remoteJid, instanceId = null) {
  const safeRemote = String(remoteJid || "").trim();
  if (!safeRemote || safeRemote.includes("@g.us")) return safeRemote ? [safeRemote] : [];

  const eventLinksSql = instanceId
    ? `
      union
      select jel.remote_jid_alt as candidate
        from zaphub_event_jid_links jel
       where jel.instance_id = $2
         and jel.remote_jid = $1
         and coalesce(jel.remote_jid_alt, '') <> ''
      union
      select jel.sender_jid as candidate
        from zaphub_event_jid_links jel
       where jel.instance_id = $2
         and jel.remote_jid = $1
         and coalesce(jel.sender_jid, '') <> ''
      union
      select jel.remote_jid as candidate
        from zaphub_event_jid_links jel
       where jel.instance_id = $2
         and (jel.remote_jid_alt = $1 or jel.sender_jid = $1)
         and coalesce(jel.remote_jid, '') <> ''
    `
    : "";

  const params = instanceId ? [safeRemote, instanceId] : [safeRemote];
  const result = await client.query(
    `
      select distinct trim(candidate) as jid
        from (
          select unnest(string_to_array(coalesce(io."jidOptions", ''), ',')) as candidate
            from "IsOnWhatsapp" io
           where io."remoteJid" = $1
              or io."lid" = $1
              or position($1 in coalesce(io."jidOptions", '')) > 0
          union select $1 as candidate
          union select replace($1, '+', '') as candidate
          ${eventLinksSql}
        ) aliases
       where trim(coalesce(candidate, '')) <> ''
    `,
    params
  );

  return Array.from(
    new Set(
      result.rows
        .map((row) => String(row.jid || "").trim())
        .filter(Boolean)
    )
  );
}

async function fetchExpandedActivePuxadaJidsWithClient(client, instanceName, instanceId, matricula = null) {
  const params = [instanceName];
  let matriculaFilterSql = "";
  if (matricula) {
    matriculaFilterSql = "and p.usuario_matricula = $2";
    params.push(matricula);
  }

  const pulledRows = await client.query(
    `
      select distinct p.remote_jid as "remoteJid"
        from zaphub_mensagens_puxadas p
       where p.instance_name = $1
         and p.encerrada_at is null
         ${matriculaFilterSql}
    `,
    params
  );

  const expanded = new Set();
  for (const row of pulledRows.rows || []) {
    const remoteJid = String(row.remoteJid || "").trim();
    if (!remoteJid) continue;
    const aliases = await expandContactJidAliasesWithClient(client, remoteJid, instanceId);
    if (aliases.length) {
      aliases.forEach((jid) => expanded.add(jid));
    } else {
      expanded.add(remoteJid);
    }
  }

  return Array.from(expanded);
}

function buildMessageRemoteJidAnySql(aliasParamRef) {
  return `coalesce(m.key->>'remoteJid', '') = any(${aliasParamRef}::text[])`;
}

async function resolveContactRemoteJidForStorage(client, remoteJid, altJid = null) {
  const safeRemote = String(remoteJid || "").trim();
  const safeAlt = String(altJid || "").trim() || safeRemote;
  if (!safeRemote || safeRemote.includes("@g.us")) return safeRemote;

  await client.query(`select zaphub_ionw_merge_contact_jids($1, $2)`, [safeRemote, safeAlt]);

  const result = await client.query(
    `
      select coalesce(
        nullif(
          (
            select io."remoteJid"
              from "IsOnWhatsapp" io
             where io."remoteJid" like '%@s.whatsapp.net'
               and (
                 io."remoteJid" = $1
                 or io."lid" = $1
                 or io."jidOptions" like ('%,' || $1 || ',%')
                 or io."jidOptions" like ($1 || ',%')
                 or io."jidOptions" like ('%,' || $1)
                 or io."jidOptions" = $1
               )
             limit 1
          ),
          ''
        ),
        nullif(
          (
            select io."lid"
              from "IsOnWhatsapp" io
             where io."lid" is not null
               and (
                 io."remoteJid" = $1
                 or io."lid" = $1
                 or io."jidOptions" like ('%,' || $1 || ',%')
                 or io."jidOptions" like ($1 || ',%')
                 or io."jidOptions" like ('%,' || $1)
                 or io."jidOptions" = $1
               )
             limit 1
          ),
          ''
        ),
        $1
      ) as "remoteJid"
    `,
    [safeRemote]
  );

  return String(result.rows[0]?.remoteJid || safeRemote).trim() || safeRemote;
}

async function reabrirPuxadasEncerradasComNovaMensagem(client, instanceName, instanceId) {
  // #region debug-point A:conversas-reabrir-start
  const t0 = Date.now();
  debugReport({
    hypothesisId: "A",
    location: "zaphubInstancias.db.js:reabrirPuxadasEncerradasComNovaMensagem",
    msg: "start",
    data: {
      instanceName: instanceName || null,
      instanceId: instanceId || null,
    },
  });
  // #endregion
  await ensureZapHubMensagensPuxadasTable(client);
  const instance = await fetchTargetInstance(client, instanceName, instanceId);
  const encerradas = await client.query(
    `
      select p.id, p.remote_jid as "remoteJid", p.encerrada_at as "encerradaAt"
        from zaphub_mensagens_puxadas p
       where p.instance_name = $1
         and p.encerrada_at is not null
    `,
    [instance.name]
  );
  // #region debug-point A:conversas-reabrir-encerradas
  debugReport({
    hypothesisId: "A",
    location: "zaphubInstancias.db.js:reabrirPuxadasEncerradasComNovaMensagem",
    msg: "encerradas loaded",
    data: {
      ms: Date.now() - t0,
      resolvedInstanceName: instance.name,
      resolvedInstanceId: instance.id,
      rows: Number(encerradas?.rowCount) || 0,
    },
  });
  // #endregion

  const idsToDelete = [];
  const remoteJids = [];

  for (const row of encerradas.rows || []) {
    const remoteJid = String(row.remoteJid || "").trim();
    const encerradaAt = row.encerradaAt;
    if (!remoteJid || !encerradaAt) continue;

    const aliases = await expandContactJidAliasesWithClient(client, remoteJid, instance.id);
    const aliasList = aliases.length ? aliases : [remoteJid];
    // #region debug-point B:conversas-reabrir-before-has-new
    const tHasNew0 = Date.now();
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:reabrirPuxadasEncerradasComNovaMensagem",
      msg: "before hasNewIncoming query",
      data: {
        rowId: row.id,
        remoteJid,
        aliasCount: aliasList.length,
        encerradaAtType:
          encerradaAt == null ? "null" : encerradaAt instanceof Date ? "date" : Array.isArray(encerradaAt) ? "array" : typeof encerradaAt,
        encerradaAtValue: encerradaAt instanceof Date ? encerradaAt.toISOString() : String(encerradaAt),
      },
    });
    // #endregion
    const hasNewIncoming = await client.query(
      `
        select 1
          from "Message" m
         where m."instanceId" = $1
           and coalesce(m.key->>'remoteJid', '') = any($2::text[])
           and coalesce((m.key->>'fromMe')::boolean, false) = false
           and to_timestamp(m."messageTimestamp") > $3
         limit 1
      `,
      [instance.id, aliasList, encerradaAt]
    );
    // #region debug-point B:conversas-reabrir-after-has-new
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:reabrirPuxadasEncerradasComNovaMensagem",
      msg: "after hasNewIncoming query",
      data: {
        ms: Date.now() - tHasNew0,
        rowId: row.id,
        found: Boolean(hasNewIncoming.rows?.[0]),
      },
    });
    // #endregion

    if (hasNewIncoming.rows[0]) {
      idsToDelete.push(row.id);
      remoteJids.push(remoteJid);
    }
  }

  if (idsToDelete.length) {
    await client.query(`delete from zaphub_mensagens_puxadas where id = any($1::int[])`, [idsToDelete]);
  }

  // #region debug-point A:conversas-reabrir-end
  debugReport({
    hypothesisId: "A",
    location: "zaphubInstancias.db.js:reabrirPuxadasEncerradasComNovaMensagem",
    msg: "end",
    data: {
      totalMs: Date.now() - t0,
      reabertasCount: remoteJids.length,
    },
  });
  // #endregion
  return { reabertasCount: remoteJids.length, remoteJids };
}

async function fetchInstanceConversationsWithClient(client, limit = 40, instanceName = null, instanceId = null, excludePulled = false) {
  await ensureZapHubMensagensIndexesOnce(client);
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '25s'");

    // #region debug-point C:conversas-start
    const t0 = Date.now();
    debugReport({
      hypothesisId: "C",
      location: "zaphubInstancias.db.js:fetchInstanceConversationsWithClient",
      msg: "start",
      data: {
        limit,
        instanceName: instanceName || null,
        instanceId: instanceId || null,
        excludePulled: Boolean(excludePulled),
      },
    });
    // #endregion
    const instance = await fetchTargetInstance(client, instanceName, instanceId);
    const safeLimit = getSafeConversationsLimit(limit);
    const shouldExcludePulled = Boolean(excludePulled);
    if (shouldExcludePulled) {
      await ensureZapHubMensagensPuxadasTable(client);
    }
    const reabertura = shouldExcludePulled
      ? await reabrirPuxadasEncerradasComNovaMensagem(client, instanceName, instanceId)
      : { reabertasCount: 0, remoteJids: [] };
    const excludedPuxadaJids = shouldExcludePulled
      ? await fetchExpandedActivePuxadaJidsWithClient(client, instance.name, instance.id)
      : [];
    const pulledFilterSql =
      shouldExcludePulled && excludedPuxadaJids.length
        ? `and not (${buildMessageRemoteJidAnySql("$3")})`
        : "";
    const pulledFilterSqlB =
      shouldExcludePulled && excludedPuxadaJids.length
        ? `and not (${buildMessageRemoteJidAnySql("$3")})`
        : "";
    const queryParams =
      shouldExcludePulled && excludedPuxadaJids.length
        ? [instance.id, safeLimit, excludedPuxadaJids]
        : [instance.id, safeLimit];
    // #region debug-point D:conversas-query-shape
    debugReport({
      hypothesisId: "D",
      location: "zaphubInstancias.db.js:fetchInstanceConversationsWithClient",
      msg: "query shape prepared",
      data: {
        instanceResolvedName: instance.name,
        instanceResolvedId: instance.id,
        safeLimit,
        shouldExcludePulled,
        excludedPuxadaJidsCount: excludedPuxadaJids.length,
        queryParamsCount: queryParams.length,
        queryParamsPreview: queryParams.map((value, index) => ({
          index: index + 1,
          type: Array.isArray(value) ? "array" : value instanceof Date ? "date" : value == null ? "null" : typeof value,
          value:
            Array.isArray(value)
              ? { length: value.length, first: value[0] || null }
              : value instanceof Date
              ? value.toISOString()
              : String(value),
        })),
      },
    });
    // #endregion
    const canUseCanonicalJid = await hasCanonicalJidColumn(client);
    const canUseEventLinks = await ensureZapHubEventJidLinksTable(client);
    const ionwCanonicalSelect = canUseCanonicalJid ? 'ionw."canonicalJid"' : "null";
    const ionwPartCanonicalSelect = canUseCanonicalJid ? 'ionw_part."canonicalJid"' : "null";
    const eventSenderSelect = canUseEventLinks
      ? `jel.sender_jid as "eventSenderJid", jel.remote_jid_alt as "eventRemoteJidAlt",`
      : `null as "eventSenderJid", null as "eventRemoteJidAlt",`;
    const eventLinksJoin = canUseEventLinks
      ? `
      left join zaphub_event_jid_links jel
        on jel.instance_id = b."instanceId"
       and jel.remote_jid = coalesce(c."remoteJid", b."remoteJidKey")
    `
      : "";

    // #region debug-point E:conversas-before-main-query
    const tMainQuery0 = Date.now();
    // #endregion
    const result = await client.query(
      `
        with recent_conversations as (
          select *
          from (
            select distinct on (coalesce(m.key->>'remoteJid', ''))
              coalesce(m.key->>'remoteJid', '') as "remoteJidKey",
              m."messageTimestamp" as "latestMessageTimestamp"
            from "Message" m
            where m."instanceId" = $1
              and coalesce(m.key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
              and lower(coalesce(m."messageType", '')) <> 'secretencryptedmessage'
              ${pulledFilterSql}
            order by coalesce(m.key->>'remoteJid', ''), m."messageTimestamp" desc nulls last, m.id desc
          ) recent
          order by recent."latestMessageTimestamp" desc nulls last, recent."remoteJidKey"
          limit $2
        )
        select
          b.id,
          b."messageType",
          b.message,
          b.key,
          b."messageTimestamp",
          b."pushName",
          rc."latestMessageTimestamp" as "latestMessageTimestamp",
          case
            when coalesce(b.participant, b."participantKey") like '%@g.us'
              then null
            else coalesce(b.participant, b."participantKey")
          end as participant,
          b.status,
          b.key->>'id' as "messageKeyId",
          c.name as "chatName",
          coalesce(c."remoteJid", b."remoteJidKey") as "remoteJid",
          case
            when coalesce(c."remoteJid", b."remoteJidKey") like '%@g.us'
              then coalesce(c."remoteJid", b."remoteJidKey")
            else coalesce(${ionwCanonicalSelect}, ionw."remoteJid", coalesce(c."remoteJid", b."remoteJidKey"))
          end as "canonicalRemoteJid",
          case
            when coalesce(c."remoteJid", b."remoteJidKey") like '%@g.us'
              then coalesce(
                ${ionwPartCanonicalSelect},
                ionw_part."remoteJid",
                case
                  when coalesce(b.participant, b."participantKey") like '%@g.us'
                    then null
                  else coalesce(b.participant, b."participantKey")
                end
              )
            else coalesce(${ionwCanonicalSelect}, ionw."remoteJid", coalesce(c."remoteJid", b."remoteJidKey"))
          end as "contactRemoteJid",
          case
            when coalesce(c."remoteJid", b."remoteJidKey") like '%@g.us'
              then null
            else coalesce(ionw."lid", null)
          end as "lidRemoteJid",
          coalesce(c."unreadMessages", 0) as "unreadMessages",
          ct."profilePicUrl" as "profilePicUrl",
          ${eventSenderSelect}
          md."fileName" as "mediaFileName",
          md.mimetype as "mediaMimetype",
          md.type as "mediaStoredType"
        from recent_conversations rc
        inner join lateral (
          select
            m.id,
            m."instanceId",
            m."messageType",
            m.message,
            m.key,
            m."messageTimestamp",
            m."pushName",
            m.participant,
            m.status,
            (m.key->>'remoteJid') as "remoteJidKey",
            (m.key->>'participant') as "participantKey"
          from "Message" m
          where m."instanceId" = $1
            and coalesce(m.key->>'remoteJid', '') = rc."remoteJidKey"
            and coalesce(m.key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
            and lower(coalesce(m."messageType", '')) <> 'secretencryptedmessage'
            ${pulledFilterSqlB}
          order by m."messageTimestamp" desc nulls last, m.id desc
          limit 1
        ) b on true
        left join "Chat" c
          on c."instanceId" = b."instanceId"
         and c."remoteJid" = b."remoteJidKey"
        ${eventLinksJoin}
        left join "Contact" ct
          on ct."instanceId" = b."instanceId"
         and ct."remoteJid" = coalesce(c."remoteJid", b."remoteJidKey")
        left join "IsOnWhatsapp" ionw
          on (
            ionw."remoteJid" = coalesce(c."remoteJid", b."remoteJidKey")
            or ionw."remoteJid" = replace(coalesce(c."remoteJid", b."remoteJidKey"), '+', '')
            or ionw."lid" = coalesce(c."remoteJid", b."remoteJidKey")
            or ionw."lid" = replace(coalesce(c."remoteJid", b."remoteJidKey"), '+', '')
          )
        left join "IsOnWhatsapp" ionw_part
          on (
            ionw_part."remoteJid" = coalesce(b.participant, b."participantKey")
            or ionw_part."remoteJid" = replace(coalesce(b.participant, b."participantKey"), '+', '')
            or ionw_part."lid" = coalesce(b.participant, b."participantKey")
            or ionw_part."lid" = replace(coalesce(b.participant, b."participantKey"), '+', '')
          )
        left join "Media" md
          on md."instanceId" = b."instanceId"
         and md."messageId" = b.id
        order by rc."latestMessageTimestamp" desc nulls last, b."messageTimestamp" desc nulls last
      `,
      queryParams
    );
    // #region debug-point E:conversas-after-main-query
    debugReport({
      hypothesisId: "E",
      location: "zaphubInstancias.db.js:fetchInstanceConversationsWithClient",
      msg: "after main conversations query",
      data: {
        ms: Date.now() - tMainQuery0,
        rowCount: Number(result?.rowCount) || 0,
        totalMs: Date.now() - t0,
      },
    });
    // #endregion

    const rows = dedupeConversationRows(
      result.rows.map((row) => {
      const key = row.key && typeof row.key === "object" ? row.key : {};
      const fromMe = parseBoolean(key.fromMe);
      const preview = getMessagePreview(row.message, row.messageType);
      const previewNormalized = String(preview || "").trim().toLowerCase();
      const statusNormalized = String(row.status || "").trim().toUpperCase();
      const isDeleted = statusNormalized === "DELETED" || (fromMe && previewNormalized === "[conversation]");
      const media = extractMessageMedia(row.message, row.messageType, {
        fileName: row.mediaFileName,
        mimetype: row.mediaMimetype,
        type: row.mediaStoredType,
      });
      const timestamp = Number(row.messageTimestamp) || null;
      return {
        id: String(row.remoteJid || row.remoteJidKey || row.id),
        chatName: row.chatName || row.pushName || row.remoteJid || "Sem nome",
        remoteJid: row.remoteJid || row.remoteJidKey || null,
        canonicalRemoteJid: row.canonicalRemoteJid || row.contactRemoteJid || row.remoteJid || null,
        contactRemoteJid: row.contactRemoteJid || row.remoteJid || null,
        lidRemoteJid: row.lidRemoteJid || null,
        eventSenderJid: row.eventSenderJid || null,
        eventRemoteJidAlt: row.eventRemoteJidAlt || null,
        unreadCount: Number(row.unreadMessages) || 0,
        profilePicUrl: row.profilePicUrl || null,
        lastMessage: preview || "",
        lastSentAt: timestamp ? new Date(timestamp * 1000).toISOString() : null,
        lastTimestamp: timestamp,
        totalMensagens: 0,
        mensagens: [],
        lastMessageType: row.messageType || null,
        lastMessageFromMe: fromMe,
        lastMessageStatus: row.status || null,
        lastMessageDeleted: isDeleted,
        lastMessageMedia: media ? { kind: normalizeMediaKind(row.messageType) } : null,
      };
    })
    );

    await client.query("commit");
    // #region debug-point C:conversas-end
    debugReport({
      hypothesisId: "C",
      location: "zaphubInstancias.db.js:fetchInstanceConversationsWithClient",
      msg: "success",
      data: {
        totalMs: Date.now() - t0,
        count: rows.length,
      },
    });
    // #endregion
    return {
      instance: mapInstance(instance),
      rows,
      count: rows.length,
      reabertasCount: reabertura.reabertasCount,
      reabertasRemoteJids: reabertura.remoteJids,
    };
  } catch (err) {
    // #region debug-point Z:conversas-error
    debugReport({
      hypothesisId: "Z",
      location: "zaphubInstancias.db.js:fetchInstanceConversationsWithClient",
      msg: "error",
      data: {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : null,
        code: err && typeof err === "object" && "code" in err ? err.code : undefined,
        severity: err && typeof err === "object" && "severity" in err ? err.severity : undefined,
      },
    });
    // #endregion
    try {
      await client.query("rollback");
    } catch {}
    throw err;
  }
}

async function fetchConversationMessagesWithClient(
  client,
  {
    limit = 80,
    instanceName = null,
    instanceId = null,
    remoteJid,
    excludePulled = false,
    onlyPulledForMatricula = null,
    onlyPulledEncerradas = null,
  }
) {
  await ensureZapHubMensagensIndexesOnce(client);
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '25s'");

    const instance = await fetchTargetInstance(client, instanceName, instanceId);
    const safeLimit = getSafeConversationMessagesLimit(limit);
    const safeRemoteJid = String(remoteJid || "").trim();
    if (!safeRemoteJid) {
      throw new Error("remoteJid é obrigatório");
    }
    const safeOnlyPulledForMatricula = String(onlyPulledForMatricula || "").trim() || null;
    const shouldExcludePulled = Boolean(excludePulled) && !safeOnlyPulledForMatricula;
    if (shouldExcludePulled || safeOnlyPulledForMatricula) {
      await ensureZapHubMensagensPuxadasTable(client);
    }
    const contactJidAliases = safeOnlyPulledForMatricula
      ? await expandContactJidAliasesWithClient(client, safeRemoteJid, instance.id)
      : [];
    let contactJidList = contactJidAliases.length ? contactJidAliases : [safeRemoteJid];
    if (safeOnlyPulledForMatricula && instance.id) {
      const phoneDigits = safeRemoteJid.split("@")[0]?.replace(/\D/g, "") || "";
      if (phoneDigits.length >= 8) {
        const related = await client.query(
          `
            select distinct coalesce(m.key->>'remoteJid', '') as jid
              from "Message" m
             where m."instanceId" = $1
               and coalesce(m.key->>'remoteJid', '') <> ''
               and coalesce(m.key->>'remoteJid', '') not like '%@g.us'
               and (
                 coalesce(m.key->>'remoteJid', '') = any($2::text[])
                 or split_part(coalesce(m.key->>'remoteJid', ''), '@', 1) = $3
               )
          `,
          [instance.id, contactJidList, phoneDigits]
        );
        contactJidList = Array.from(
          new Set([
            ...contactJidList,
            ...related.rows.map((row) => String(row.jid || "").trim()).filter(Boolean),
          ])
        );
      }
    }
    const excludedPuxadaJids = shouldExcludePulled
      ? await fetchExpandedActivePuxadaJidsWithClient(client, instance.name, instance.id)
      : [];
    const canUseCanonicalJid = await hasCanonicalJidColumn(client);
    const canUseEventLinks = await ensureZapHubEventJidLinksTable(client);
    const ionwCanonicalSelect = canUseCanonicalJid ? 'ionw."canonicalJid"' : "null";
    const ionwPartCanonicalSelect = canUseCanonicalJid ? 'ionw_part."canonicalJid"' : "null";
    const eventSenderSelect = canUseEventLinks
      ? `jel.sender_jid as "eventSenderJid", jel.remote_jid_alt as "eventRemoteJidAlt",`
      : `null as "eventSenderJid", null as "eventRemoteJidAlt",`;
    const eventLinksJoin = canUseEventLinks
      ? `
      left join zaphub_event_jid_links jel
        on jel.instance_id = m."instanceId"
       and jel.remote_jid = coalesce(c."remoteJid", m.key->>'remoteJid', '')
    `
      : "";

    const encerradaFilterSql =
      onlyPulledEncerradas === true
        ? "and p.encerrada_at is not null"
        : onlyPulledEncerradas === false
        ? "and p.encerrada_at is null"
        : "";
    const pulledFilterSql = safeOnlyPulledForMatricula
      ? `
          and exists (
            select 1
              from zaphub_mensagens_puxadas p
             where p.instance_name = $4
               and p.usuario_matricula = $5
               and p.remote_jid = any($6::text[])
               ${encerradaFilterSql}
          )
        `
      : shouldExcludePulled && excludedPuxadaJids.length
      ? `and not (${buildMessageRemoteJidAnySql("$4")})`
      : "";
    const remoteJidWhereSql = safeOnlyPulledForMatricula
      ? buildMessageRemoteJidAnySql("$6")
      : `coalesce(m.key->>'remoteJid', '') = $2`;

    const queryParams = [instance.id, safeRemoteJid, safeLimit];
    if (safeOnlyPulledForMatricula) {
      queryParams.push(instance.name, safeOnlyPulledForMatricula, contactJidList);
    } else if (shouldExcludePulled && excludedPuxadaJids.length) {
      queryParams.push(excludedPuxadaJids);
    }

    const result = await client.query(
      `
        select
          m.id,
          m."messageType",
          m.message,
          m.key,
          m."messageTimestamp",
          m."pushName",
          case
            when coalesce(m.participant, m.key->>'participant') like '%@g.us'
              then null
            else coalesce(m.participant, m.key->>'participant')
          end as participant,
          m.status,
          m.key->>'id' as "messageKeyId",
          c.name as "chatName",
          coalesce(c."remoteJid", m.key->>'remoteJid', '') as "remoteJid",
          case
            when coalesce(c."remoteJid", m.key->>'remoteJid', '') like '%@g.us'
              then coalesce(c."remoteJid", m.key->>'remoteJid', '')
            else coalesce(${ionwCanonicalSelect}, ionw."remoteJid", coalesce(c."remoteJid", m.key->>'remoteJid', ''))
          end as "canonicalRemoteJid",
          case
            when coalesce(c."remoteJid", m.key->>'remoteJid', '') like '%@g.us'
              then coalesce(
                ${ionwPartCanonicalSelect},
                ionw_part."remoteJid",
                case
                  when coalesce(m.participant, m.key->>'participant') like '%@g.us'
                    then null
                  else coalesce(m.participant, m.key->>'participant')
                end
              )
            else coalesce(${ionwCanonicalSelect}, ionw."remoteJid", coalesce(c."remoteJid", m.key->>'remoteJid', ''))
          end as "contactRemoteJid",
          case
            when coalesce(c."remoteJid", m.key->>'remoteJid', '') like '%@g.us'
              then null
            else coalesce(ionw."lid", null)
          end as "lidRemoteJid",
          coalesce(c."unreadMessages", 0) as "unreadMessages",
          ct."profilePicUrl" as "profilePicUrl",
          ${eventSenderSelect}
          md."fileName" as "mediaFileName",
          md.mimetype as "mediaMimetype",
          md.type as "mediaStoredType"
        from "Message" m
        left join "Chat" c
          on c."instanceId" = m."instanceId"
         and c."remoteJid" = coalesce(m.key->>'remoteJid', '')
        ${eventLinksJoin}
        left join "Contact" ct
          on ct."instanceId" = m."instanceId"
         and ct."remoteJid" = coalesce(c."remoteJid", m.key->>'remoteJid', '')
        left join "IsOnWhatsapp" ionw
          on (
            ionw."remoteJid" = coalesce(c."remoteJid", m.key->>'remoteJid', '')
            or ionw."remoteJid" = replace(coalesce(c."remoteJid", m.key->>'remoteJid', ''), '+', '')
            or ionw."lid" = coalesce(c."remoteJid", m.key->>'remoteJid', '')
            or ionw."lid" = replace(coalesce(c."remoteJid", m.key->>'remoteJid', ''), '+', '')
          )
        left join "IsOnWhatsapp" ionw_part
          on (
            ionw_part."remoteJid" = coalesce(m.participant, m.key->>'participant')
            or ionw_part."remoteJid" = replace(coalesce(m.participant, m.key->>'participant'), '+', '')
            or ionw_part."lid" = coalesce(m.participant, m.key->>'participant')
            or ionw_part."lid" = replace(coalesce(m.participant, m.key->>'participant'), '+', '')
          )
        left join "Media" md
          on md."instanceId" = m."instanceId"
         and md."messageId" = m.id
        where m."instanceId" = $1
          and ${remoteJidWhereSql}
          and coalesce(m.key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
          and lower(coalesce(m."messageType", '')) <> 'secretencryptedmessage'
          ${pulledFilterSql}
        order by m."messageTimestamp" desc nulls last, m.id desc
        limit $3
      `,
      queryParams
    );

    const rows = result.rows.map((row) => {
      const key = row.key && typeof row.key === "object" ? row.key : {};
      const fromMe = parseBoolean(key.fromMe);
      const preview = getMessagePreview(row.message, row.messageType);
      const previewNormalized = String(preview || "").trim().toLowerCase();
      const statusNormalized = String(row.status || "").trim().toUpperCase();
      const isDeleted = statusNormalized === "DELETED" || (fromMe && previewNormalized === "[conversation]");
      const media = extractMessageMedia(row.message, row.messageType, {
        fileName: row.mediaFileName,
        mimetype: row.mediaMimetype,
        type: row.mediaStoredType,
      });
      return {
        id: row.id,
        messageKeyId: row.messageKeyId || null,
        chatName: row.chatName || row.pushName || row.remoteJid || "Sem nome",
        remoteJid: row.remoteJid || null,
        canonicalRemoteJid: row.canonicalRemoteJid || row.contactRemoteJid || row.remoteJid || null,
        contactRemoteJid: row.contactRemoteJid || row.remoteJid || null,
        lidRemoteJid: row.lidRemoteJid || null,
        unreadMessages: Number(row.unreadMessages) || 0,
        profilePicUrl: row.profilePicUrl || null,
        eventSenderJid: row.eventSenderJid || null,
        eventRemoteJidAlt: row.eventRemoteJidAlt || null,
        messageType: row.messageType,
        preview,
        fromMe,
        senderName: fromMe
          ? instance.profileName || instance.name || "Eu"
          : row.pushName || row.participant || row.chatName || row.remoteJid || "Contato",
        participant: row.participant || null,
        status: row.status || null,
        isDeleted,
        timestamp: Number(row.messageTimestamp) || null,
        sentAt: Number(row.messageTimestamp) > 0 ? new Date(Number(row.messageTimestamp) * 1000).toISOString() : null,
        media,
      };
    });

    await client.query("commit");
    return {
      instance: mapInstance(instance),
      rows,
      count: rows.length,
    };
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {}
    throw err;
  }
}

export async function fetchOpenInstanceMessagesSignature({ databasePool, instanceName = null, instanceId = null }) {
  if (!databasePool) {
    // #region debug-point A:no-pool-signature
    debugReport({
      hypothesisId: "A",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesSignature",
      msg: "databasePool is null",
      data: {},
    });
    // #endregion
    throw new Error("DATABASE_URL não configurada para consultar mensagens");
  }

  // #region debug-point B:pool-stats-signature
  debugReport({
    hypothesisId: "B",
    location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesSignature",
    msg: "pool stats before connect",
    data: {
      totalCount: databasePool.totalCount,
      idleCount: databasePool.idleCount,
      waitingCount: databasePool.waitingCount,
    },
  });
  // #endregion

  const t0 = Date.now();
  let client;
  try {
    client = await databasePool.connect();
  } catch (err) {
    // #region debug-point B:pool-connect-failed-signature
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesSignature",
      msg: "pool.connect failed",
      data: { elapsedMs: Date.now() - t0, message: err instanceof Error ? err.message : String(err) },
    });
    // #endregion
    throw err;
  }
  try {
    // #region debug-point B:pool-connected-signature
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesSignature",
      msg: "connected",
      data: {
        totalCount: databasePool.totalCount,
        idleCount: databasePool.idleCount,
        waitingCount: databasePool.waitingCount,
      },
    });
    // #endregion
    return await fetchOpenInstanceMessagesSignatureWithClient(client, instanceName, instanceId);
  } finally {
    client.release();
    // #region debug-point B:pool-released-signature
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessagesSignature",
      msg: "released",
      data: {
        totalCount: databasePool.totalCount,
        idleCount: databasePool.idleCount,
        waitingCount: databasePool.waitingCount,
      },
    });
    // #endregion
  }
}

export async function fetchInstanceConversationsSignature({ databasePool, instanceName = null, instanceId = null }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar assinatura de conversas");
  }
  const client = await databasePool.connect();
  try {
    return await fetchInstanceConversationsSignatureWithClient(client, instanceName, instanceId);
  } finally {
    client.release();
  }
}

export async function fetchConversationMessagesSignature({ databasePool, instanceName = null, instanceId = null, remoteJid = null }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar assinatura de mensagens da conversa");
  }
  const client = await databasePool.connect();
  try {
    return await fetchConversationMessagesSignatureWithClient(client, instanceName, instanceId, remoteJid);
  } finally {
    client.release();
  }
}

export async function fetchOpenInstanceMessages({ databasePool, limit = 80, instanceName = null, instanceId = null }) {
  if (!databasePool) {
    // #region debug-point A:no-pool-messages
    debugReport({
      hypothesisId: "A",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessages",
      msg: "databasePool is null",
      data: { limit },
    });
    // #endregion
    throw new Error("DATABASE_URL não configurada para consultar mensagens");
  }

  // #region debug-point B:pool-stats-messages
  debugReport({
    hypothesisId: "B",
    location: "zaphubInstancias.db.js:fetchOpenInstanceMessages",
    msg: "pool stats before connect",
    data: {
      limit,
      instanceId: instanceId || null,
      totalCount: databasePool.totalCount,
      idleCount: databasePool.idleCount,
      waitingCount: databasePool.waitingCount,
    },
  });
  // #endregion

  const t0 = Date.now();
  let client;
  try {
    client = await databasePool.connect();
  } catch (err) {
    // #region debug-point B:pool-connect-failed-messages
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessages",
      msg: "pool.connect failed",
      data: { limit, elapsedMs: Date.now() - t0, message: err instanceof Error ? err.message : String(err) },
    });
    // #endregion
    throw err;
  }
  try {
    // #region debug-point B:pool-connected-messages
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessages",
      msg: "connected",
      data: {
        totalCount: databasePool.totalCount,
        idleCount: databasePool.idleCount,
        waitingCount: databasePool.waitingCount,
      },
    });
    // #endregion
    return await fetchOpenInstanceMessagesWithClient(client, limit, instanceName, instanceId);
  } catch (err) {
    // #region debug-point D:messages-error
    debugReport({
      hypothesisId: "D",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessages",
      msg: "fetchOpenInstanceMessages failed",
      data: {
        elapsedMs: Date.now() - t0,
        limit,
        instanceName,
        instanceId: instanceId || null,
        message: err instanceof Error ? err.message : String(err),
        code: err && typeof err === "object" && "code" in err ? err.code : undefined,
        detail: err && typeof err === "object" && "detail" in err ? err.detail : undefined,
        where: err && typeof err === "object" && "where" in err ? err.where : undefined,
        routine: err && typeof err === "object" && "routine" in err ? err.routine : undefined,
      },
    });
    // #endregion
    throw err;
  } finally {
    client.release();
    // #region debug-point B:pool-released-messages
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchOpenInstanceMessages",
      msg: "released",
      data: {
        totalCount: databasePool.totalCount,
        idleCount: databasePool.idleCount,
        waitingCount: databasePool.waitingCount,
      },
    });
    // #endregion
  }
}

export async function fetchInstanceConversations({
  databasePool,
  limit = 40,
  instanceName = null,
  instanceId = null,
  excludePulled = false,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar conversas");
  }
  const client = await databasePool.connect();
  try {
    return await fetchInstanceConversationsWithClient(client, limit, instanceName, instanceId, excludePulled);
  } finally {
    client.release();
  }
}

export async function fetchConversationMessages({
  databasePool,
  limit = 80,
  instanceName = null,
  instanceId = null,
  remoteJid,
  excludePulled = false,
  onlyPulledForMatricula = null,
  onlyPulledEncerradas = null,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar mensagens da conversa");
  }
  const client = await databasePool.connect();
  try {
    return await fetchConversationMessagesWithClient(client, {
      limit,
      instanceName,
      instanceId,
      remoteJid,
      excludePulled,
      onlyPulledForMatricula,
      onlyPulledEncerradas,
    });
  } finally {
    client.release();
  }
}

export async function fetchMessageMediaRequestById({ databasePool, messageId }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar mídia");
  }

  const safeMessageId = String(messageId || "").trim();
  if (!safeMessageId) {
    throw new Error("messageId é obrigatório");
  }

  const client = await databasePool.connect();
  try {
    const result = await client.query(
      `
        select
          m.id,
          m.key,
          m."messageType",
          i.name as "instanceName"
        from "Message" m
        inner join "Instance" i
          on i.id = m."instanceId"
        where m.id = $1
        limit 1
      `,
      [safeMessageId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Mensagem não encontrada para carregar mídia");
    }

    const mediaKind = normalizeMediaKind(row.messageType);
    if (!mediaKind) {
      throw new Error("A mensagem informada não contém mídia compatível");
    }

    const key = row.key && typeof row.key === "object" ? row.key : null;
    if (!key || !key.id) {
      throw new Error("Chave da mensagem não disponível para carregar mídia");
    }

    return {
      messageId: row.id,
      instanceName: row.instanceName,
      messageType: row.messageType,
      key,
    };
  } finally {
    client.release();
  }
}

export async function markChatAsRead({ databasePool, instanceName, instanceId, remoteJid }) {
  if (!databasePool) {
    // #region debug-point A:no-pool-mark-read
    debugReport({
      hypothesisId: "A",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "databasePool is null",
      data: { instanceName, instanceId: instanceId || null, remoteJid: String(remoteJid || "").slice(0, 40) },
    });
    // #endregion
    throw new Error("DATABASE_URL não configurada para atualizar mensagens");
  }

  const t0 = Date.now();
  let client;
  try {
    client = await databasePool.connect();
  } catch (err) {
    // #region debug-point B:pool-connect-failed-mark-read
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "pool.connect failed",
      data: { elapsedMs: Date.now() - t0, message: err instanceof Error ? err.message : String(err) },
    });
    // #endregion
    throw err;
  }
  try {
    // #region debug-point M0:mark-read-start
    debugReport({
      hypothesisId: "M",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "markChatAsRead start",
      data: { instanceName, instanceId: instanceId || null, remoteJid: String(remoteJid || "").slice(0, 80) },
    });
    // #endregion
    await client.query("begin");
    const canUseCanonicalJid = await hasCanonicalJidColumn(client);
    // #region debug-point B:mark-read-begin
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "begin transaction",
      data: {
        instanceName,
        instanceId: instanceId || null,
        canUseCanonicalJid,
        totalCount: databasePool.totalCount,
        idleCount: databasePool.idleCount,
        waitingCount: databasePool.waitingCount,
      },
    });
    // #endregion

    let resolvedInstanceId = String(instanceId || "").trim() || null;
    if (!resolvedInstanceId) {
      const instanceResult = await client.query(
        `
          select i.id
            from "Instance" i
           where i.name = $1
           order by i."createdAt" desc nulls last, i.id desc
           limit 1
        `,
        [instanceName]
      );
      resolvedInstanceId = instanceResult.rows[0]?.id || null;
    }

    if (!resolvedInstanceId) {
      throw new Error("Instancia nao encontrada para marcar conversa como lida");
    }

    // #region debug-point M1:mark-read-aliases-start
    debugReport({
      hypothesisId: "M",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "fetching aliases from IsOnWhatsapp",
      data: { instanceId: resolvedInstanceId, canUseCanonicalJid },
    });
    // #endregion
    const aliasResult = await client.query(
      `
        select distinct candidate as "remoteJid"
          from (
            select unnest(string_to_array(coalesce(io."jidOptions", ''), ',')) as candidate
              from "IsOnWhatsapp" io
             where ${canUseCanonicalJid ? 'io."canonicalJid" = $1 or' : ""}
                   io."remoteJid" = $1
                or io."lid" = $1
                or io."jidOptions" like ('%,' || $1 || ',%')
                or io."jidOptions" like ($1 || ',%')
                or io."jidOptions" like ('%,' || $1)
                or io."jidOptions" = $1
            union
            select $1 as candidate
          ) aliases
         where candidate is not null
           and candidate <> ''
      `,
      [remoteJid]
    );

    const remoteJids = Array.from(
      new Set(
        aliasResult.rows
          .map((row) => String(row.remoteJid || "").trim())
          .filter(Boolean)
      )
    );

    // #region debug-point M2:mark-read-updates-start
    debugReport({
      hypothesisId: "M",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "updating Message and Chat",
      data: { instanceId: resolvedInstanceId, remoteJidsCount: remoteJids.length },
    });
    // #endregion
    const messagesResult = await client.query(
      `
        update "Message" m
           set "status" = 'READ'
         where m."instanceId" = $1
           and coalesce(m.key->>'remoteJid', '') = any($2::text[])
           and coalesce((m.key->>'fromMe')::boolean, false) = false
           and (m."status" is null or m."status" <> 'READ')
      `,
      [resolvedInstanceId, remoteJids]
    );

    const chatResult = await client.query(
      `
        update "Chat" c
           set "unreadMessages" = 0
         where c."instanceId" = $1
           and c."remoteJid" = any($2::text[])
      `,
      [resolvedInstanceId, remoteJids]
    );

    await client.query("commit");

    // #region debug-point M3:mark-read-success
    debugReport({
      hypothesisId: "M",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "markChatAsRead success",
      data: {
        elapsedMs: Date.now() - t0,
        instanceId: resolvedInstanceId,
        updatedChatCount: Number(chatResult.rowCount || 0),
        updatedMessageCount: Number(messagesResult.rowCount || 0),
      },
    });
    // #endregion
    return {
      updatedChatCount: Number(chatResult.rowCount || 0),
      updatedMessageCount: Number(messagesResult.rowCount || 0),
    };
  } catch (error) {
    // #region debug-point B:mark-read-error
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:markChatAsRead",
      msg: "markChatAsRead failed",
      data: {
        elapsedMs: Date.now() - t0,
        message: error instanceof Error ? error.message : String(error),
        code: error && typeof error === "object" && "code" in error ? error.code : undefined,
        detail: error && typeof error === "object" && "detail" in error ? error.detail : undefined,
        where: error && typeof error === "object" && "where" in error ? error.where : undefined,
        routine: error && typeof error === "object" && "routine" in error ? error.routine : undefined,
      },
    });
    // #endregion
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function mergeContactJids({ databasePool, remoteJid, senderJid }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para sincronizar JIDs");
  }

  const safeRemoteJid = String(remoteJid || "").trim() || null;
  const safeSenderJid = String(senderJid || "").trim() || null;
  if (!safeRemoteJid && !safeSenderJid) {
    throw new Error("remoteJid ou senderJid é obrigatório");
  }

  const client = await databasePool.connect();
  try {
    await client.query(`select zaphub_ionw_merge_contact_jids($1, $2)`, [safeRemoteJid, safeSenderJid]);
    return {
      remoteJid: safeRemoteJid,
      senderJid: safeSenderJid,
      canonicalRemoteJid: safeRemoteJid?.endsWith("@s.whatsapp.net")
        ? safeRemoteJid
        : safeSenderJid?.endsWith("@s.whatsapp.net")
          ? safeSenderJid
          : safeRemoteJid || safeSenderJid || null,
      lidRemoteJid: safeRemoteJid?.endsWith("@lid")
        ? safeRemoteJid
        : safeSenderJid?.endsWith("@lid")
          ? safeSenderJid
          : null,
    };
  } finally {
    client.release();
  }
}

export async function upsertZapHubEventJidLink({ databasePool, instanceId, remoteJid, senderJid, remoteJidAlt = null }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para sincronizar JIDs");
  }

  const safeInstanceId = String(instanceId || "").trim();
  const safeRemoteJid = String(remoteJid || "").trim();
  const safeSenderJid = String(senderJid || "").trim() || null;
  const safeRemoteJidAlt = String(remoteJidAlt || "").trim() || null;

  if (!safeInstanceId) throw new Error("instanceId é obrigatório");
  if (!safeRemoteJid) throw new Error("remoteJid é obrigatório");

  const client = await databasePool.connect();
  try {
    await client.query(
      `
        insert into zaphub_event_jid_links (instance_id, remote_jid, sender_jid, remote_jid_alt, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (instance_id, remote_jid) do update
          set sender_jid = coalesce(excluded.sender_jid, zaphub_event_jid_links.sender_jid),
              remote_jid_alt = coalesce(excluded.remote_jid_alt, zaphub_event_jid_links.remote_jid_alt),
              updated_at = now()
      `,
      [safeInstanceId, safeRemoteJid, safeSenderJid, safeRemoteJidAlt]
    );
    return {
      instanceId: safeInstanceId,
      remoteJid: safeRemoteJid,
      senderJid: safeSenderJid,
      remoteJidAlt: safeRemoteJidAlt,
    };
  } finally {
    client.release();
  }
}

export async function fetchInstanceNumberById({ databasePool, instanceId }) {
  if (!databasePool) return null;
  const safeInstanceId = String(instanceId || "").trim();
  if (!safeInstanceId) return null;

  const client = await databasePool.connect();
  try {
    const result = await client.query(
      `
        select i.number
          from "Instance" i
         where i.id = $1
         limit 1
      `,
      [safeInstanceId]
    );
    const raw = result.rows?.[0]?.number;
    const value = typeof raw === "string" ? raw.trim() : "";
    return value || null;
  } finally {
    client.release();
  }
}

export async function fetchInstanceIdByName({ databasePool, instanceName }) {
  const safeInstanceName = String(instanceName || "").trim();
  if (!safeInstanceName) return null;
  const client = await databasePool.connect();
  try {
    const result = await client.query(
      `
        select i.id
          from "Instance" i
         where i.name = $1
         order by i."createdAt" desc nulls last, i.id desc
         limit 1
      `,
      [safeInstanceName]
    );
    return result.rows[0]?.id || null;
  } finally {
    client.release();
  }
}

export async function fetchInstanceNameById({ databasePool, instanceId }) {
  if (!databasePool) return null;
  const safeInstanceId = String(instanceId || "").trim();
  if (!safeInstanceId) return null;
  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    const result = await client.query(
      `
        select name
        from "Instance"
        where id = $1
        order by "createdAt" desc nulls last, id desc
        limit 1
      `,
      [safeInstanceId]
    );
    const row = result.rows[0];
    const name = row && typeof row.name === "string" ? row.name.trim() : "";
    return name || null;
  } finally {
    client.release();
  }
}

export async function fetchInstanceIdsByNames({ databasePool, instanceNames }) {
  if (!databasePool) return {};
  const list = Array.isArray(instanceNames)
    ? instanceNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  if (!list.length) return {};

  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    const result = await client.query(
      `
        select id, name
        from "Instance"
        where lower(name) = any($1::text[])
      `,
      [list.map((name) => name.toLowerCase())]
    );
    const map = {};
    (Array.isArray(result.rows) ? result.rows : []).forEach((row) => {
      const name = String(row?.name || "").trim();
      const id = String(row?.id || "").trim();
      if (!name || !id) return;
      map[name.toLowerCase()] = id;
    });
    return map;
  } finally {
    client.release();
  }
}

export async function fetchInstanceIdsByNumbers({ databasePool, numbers }) {
  if (!databasePool) return {};
  const list = Array.isArray(numbers) ? numbers.map((n) => String(n || "").trim()).filter(Boolean) : [];
  if (!list.length) return {};
  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    const result = await client.query(
      `
        select id, number
        from "Instance"
        where number = any($1::text[])
      `,
      [list]
    );
    const map = {};
    (Array.isArray(result.rows) ? result.rows : []).forEach((row) => {
      const number = String(row?.number || "").trim();
      const id = String(row?.id || "").trim();
      if (!number || !id) return;
      map[number] = id;
    });
    return map;
  } finally {
    client.release();
  }
}

export function normalizeZapHubInstanceKey(instanceName = null) {
  return String(instanceName || "").trim().normalize("NFC").toLowerCase();
}

export async function resolveCanonicalInstanceNamesByKeys({ databasePool, instanceNames = [] }) {
  if (!databasePool) return {};

  const normalizedKeys = Array.from(
    new Set(
      (Array.isArray(instanceNames) ? instanceNames : [])
        .map((value) => normalizeZapHubInstanceKey(value))
        .filter(Boolean)
    )
  );

  if (!normalizedKeys.length) return {};

  const client = await databasePool.connect();
  try {
    const result = await client.query(
      `
        with latest_instances as (
          select
            i.name,
            row_number() over (
              partition by lower(i.name)
              order by i."createdAt" desc nulls last, i.id desc
            ) as rn
          from "Instance" i
          where lower(i.name) = any($1::text[])
        )
        select name as "instanceName"
        from latest_instances
        where rn = 1
      `,
      [normalizedKeys]
    );

    const map = {};
    for (const row of result.rows || []) {
      const instanceName = String(row.instanceName || "").trim();
      const key = normalizeZapHubInstanceKey(instanceName);
      if (!key) continue;
      map[key] = instanceName;
    }
    return map;
  } finally {
    client.release();
  }
}

export async function fetchUnreadCountsByInstanceNames({ databasePool, instanceNames = [] }) {
  if (!databasePool) return {};

  const normalizedNames = Array.from(
    new Set(
      (Array.isArray(instanceNames) ? instanceNames : [])
        .map((value) => normalizeZapHubInstanceKey(value))
        .filter(Boolean)
    )
  );

  if (!normalizedNames.length) return {};

  const client = await databasePool.connect();
  try {
    const result = await client.query(
      `
        with latest_instances as (
          select
            i.id,
            i.name,
            row_number() over (
              partition by lower(i.name)
              order by i."createdAt" desc nulls last, i.id desc
            ) as rn
          from "Instance" i
          where lower(i.name) = any($1::text[])
        )
        select
          li.name as "instanceName",
          coalesce(sum(c."unreadMessages"), 0)::bigint as "unreadCount"
        from latest_instances li
        left join "Chat" c
          on c."instanceId" = li.id
        where li.rn = 1
        group by li.id, li.name
      `,
      [normalizedNames]
    );

    const map = {};
    for (const row of result.rows || []) {
      const instanceName = String(row.instanceName || "").trim();
      const key = normalizeZapHubInstanceKey(instanceName);
      if (!key) continue;
      map[key] = Number(row.unreadCount) || 0;
    }

    return map;
  } finally {
    client.release();
  }
}

async function ensureZapHubInstanceResponsaveisTable(client) {
  await client.query(
    `
      create table if not exists zaphub_instance_responsaveis (
        instance_name varchar(255) primary key,
        responsavel_matricula varchar(50) not null,
        responsavel_nome varchar(150) null,
        responsavel_areaatuacao varchar(150) null,
        responsavel_funcao varchar(150) null,
        updated_at timestamptz not null default now()
      )
    `
  );
  await client.query(`alter table zaphub_instance_responsaveis add column if not exists responsavel_nome varchar(150) null`);
  await client.query(`alter table zaphub_instance_responsaveis add column if not exists responsavel_areaatuacao varchar(150) null`);
  await client.query(`alter table zaphub_instance_responsaveis add column if not exists responsavel_funcao varchar(150) null`);
  await client.query(
    `
      create index if not exists zaphub_instance_responsaveis_responsavel_idx
        on zaphub_instance_responsaveis (responsavel_matricula)
    `
  );
}

export async function fetchZapHubInstanceResponsaveisMap({ databasePool }) {
  if (!databasePool) return {};

  const client = await databasePool.connect();
  try {
    await ensureZapHubInstanceResponsaveisTable(client);
    const result = await client.query(
      `
        select
          instance_name as "instanceName",
          responsavel_matricula as "matricula",
          responsavel_nome as "nome",
          responsavel_areaatuacao as "areaAtuacao",
          responsavel_funcao as "funcao",
          updated_at as "updatedAt"
        from zaphub_instance_responsaveis
      `
    );

    const map = {};
    for (const row of result.rows || []) {
      const instanceName = String(row.instanceName || "").trim();
      if (!instanceName) continue;
      map[instanceName] = {
        matricula: String(row.matricula || "").trim() || null,
        nome: String(row.nome || "").trim() || null,
        areaAtuacao: String(row.areaAtuacao || "").trim() || null,
        funcao: String(row.funcao || "").trim() || null,
        updatedAt: row.updatedAt || null,
      };
    }
    return map;
  } finally {
    client.release();
  }
}

export async function vincularZapHubInstanceResponsavel({
  databasePool,
  instanceName,
  matricula,
  nome = null,
  areaAtuacao = null,
  funcao = null,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para vincular responsável");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");
  const safeNome = String(nome || "").trim() || null;
  const safeAreaAtuacao = String(areaAtuacao || "").trim() || null;
  const safeFuncao = String(funcao || "").trim() || null;

  const client = await databasePool.connect();
  try {
    await ensureZapHubInstanceResponsaveisTable(client);
    const result = await client.query(
      `
        insert into zaphub_instance_responsaveis (
          instance_name,
          responsavel_matricula,
          responsavel_nome,
          responsavel_areaatuacao,
          responsavel_funcao
        )
        values ($1, $2, $3, $4, $5)
        on conflict (instance_name)
        do update set responsavel_matricula = excluded.responsavel_matricula,
                     responsavel_nome = excluded.responsavel_nome,
                     responsavel_areaatuacao = excluded.responsavel_areaatuacao,
                     responsavel_funcao = excluded.responsavel_funcao,
                     updated_at = now()
        returning
          instance_name as "instanceName",
          responsavel_matricula as "matricula",
          responsavel_nome as "nome",
          responsavel_areaatuacao as "areaAtuacao",
          responsavel_funcao as "funcao",
          updated_at as "updatedAt"
      `,
      [safeInstanceName, safeMatricula, safeNome, safeAreaAtuacao, safeFuncao]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function desvincularZapHubInstanceResponsavel({ databasePool, instanceName }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para desvincular responsável");
  }

  const safeInstanceName = String(instanceName || "").trim();
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");

  const client = await databasePool.connect();
  try {
    await ensureZapHubInstanceResponsaveisTable(client);
    const result = await client.query(
      `
        delete from zaphub_instance_responsaveis
         where instance_name = $1
      `,
      [safeInstanceName]
    );
    return { deletedCount: Number(result.rowCount || 0) };
  } finally {
    client.release();
  }
}

async function ensureZapHubTelevendasPrincipalTable(client) {
  await client.query(
    `
      create table if not exists zaphub_televendas_principal (
        id smallint primary key default 1,
        instance_name varchar(255) null,
        updated_at timestamptz not null default now(),
        constraint zaphub_televendas_principal_singleton check (id = 1)
      )
    `
  );
  await client.query(`alter table zaphub_televendas_principal add column if not exists instance_name varchar(255) null`);
  await client.query(`alter table zaphub_televendas_principal add column if not exists updated_at timestamptz not null default now()`);
}

export async function fetchZapHubTelevendasPrincipal({ databasePool }) {
  if (!databasePool) return null;

  const client = await databasePool.connect();
  try {
    await ensureZapHubTelevendasPrincipalTable(client);
    const result = await client.query(
      `
        select instance_name as "instanceName"
          from zaphub_televendas_principal
         where id = 1
         limit 1
      `
    );
    const instanceName = String(result.rows?.[0]?.instanceName || "").trim();
    return instanceName || null;
  } finally {
    client.release();
  }
}

export async function setZapHubTelevendasPrincipal({ databasePool, instanceName }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para definir televendas principal");
  }

  const safeInstanceName = String(instanceName || "").trim();
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");

  const client = await databasePool.connect();
  try {
    await ensureZapHubTelevendasPrincipalTable(client);
    const result = await client.query(
      `
        insert into zaphub_televendas_principal (id, instance_name)
        values (1, $1)
        on conflict (id)
        do update set instance_name = excluded.instance_name,
                     updated_at = now()
        returning instance_name as "instanceName",
                  updated_at as "updatedAt"
      `,
      [safeInstanceName]
    );
    return result.rows[0] || { instanceName: safeInstanceName, updatedAt: new Date().toISOString() };
  } finally {
    client.release();
  }
}

export async function clearZapHubTelevendasPrincipal({ databasePool }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para limpar televendas principal");
  }

  const client = await databasePool.connect();
  try {
    await ensureZapHubTelevendasPrincipalTable(client);
    const result = await client.query(
      `
        insert into zaphub_televendas_principal (id, instance_name)
        values (1, null)
        on conflict (id)
        do update set instance_name = null,
                     updated_at = now()
        returning instance_name as "instanceName",
                  updated_at as "updatedAt"
      `
    );
    return result.rows[0] || { instanceName: null, updatedAt: new Date().toISOString() };
  } finally {
    client.release();
  }
}

async function ensureZapHubInstanceAcessosTable(client) {
  await client.query(
    `
      create table if not exists zaphub_instance_acessos (
        instance_name varchar(255) not null,
        usuario_matricula varchar(50) not null,
        usuario_nome varchar(150) null,
        usuario_areaatuacao varchar(150) null,
        usuario_funcao varchar(150) null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (instance_name, usuario_matricula)
      )
    `
  );
  await client.query(`alter table zaphub_instance_acessos add column if not exists usuario_nome varchar(150) null`);
  await client.query(`alter table zaphub_instance_acessos add column if not exists usuario_areaatuacao varchar(150) null`);
  await client.query(`alter table zaphub_instance_acessos add column if not exists usuario_funcao varchar(150) null`);
  await client.query(`alter table zaphub_instance_acessos add column if not exists created_at timestamptz not null default now()`);
  await client.query(`alter table zaphub_instance_acessos add column if not exists updated_at timestamptz not null default now()`);
  await client.query(
    `
      create index if not exists zaphub_instance_acessos_usuario_idx
        on zaphub_instance_acessos (usuario_matricula)
    `
  );
  await client.query(
    `
      create index if not exists zaphub_instance_acessos_instance_idx
        on zaphub_instance_acessos (instance_name)
    `
  );
}

async function resetClientTransactionState(client) {
  if (!client) return;
  try {
    await client.query("rollback");
  } catch {
    void 0;
  }
}

export async function fetchZapHubInstanceAcessosByUsuario({ databasePool, matricula }) {
  if (!databasePool) return [];
  const safeMatricula = String(matricula || "").trim();
  if (!safeMatricula) return [];

  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    await ensureZapHubInstanceAcessosTable(client);
    const result = await client.query(
      `
        select
          instance_name as "instanceName",
          usuario_matricula as "matricula",
          usuario_nome as "nome",
          usuario_areaatuacao as "areaAtuacao",
          usuario_funcao as "funcao",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from zaphub_instance_acessos
        where usuario_matricula = $1
        order by instance_name asc
      `,
      [safeMatricula]
    );
    return Array.isArray(result.rows) ? result.rows : [];
  } finally {
    client.release();
  }
}

export async function fetchZapHubInstanceAccessInstanceNamesByUsuario({ databasePool, matricula }) {
  const rows = await fetchZapHubInstanceAcessosByUsuario({ databasePool, matricula });
  return rows
    .map((row) => String(row.instanceName || "").trim())
    .filter(Boolean);
}

export async function grantZapHubInstanceAcesso({
  databasePool,
  instanceName,
  matricula,
  nome = null,
  areaAtuacao = null,
  funcao = null,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para conceder acesso de instância");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");
  const safeNome = String(nome || "").trim() || null;
  const safeAreaAtuacao = String(areaAtuacao || "").trim() || null;
  const safeFuncao = String(funcao || "").trim() || null;

  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    await ensureZapHubInstanceAcessosTable(client);
    const result = await client.query(
      `
        insert into zaphub_instance_acessos (
          instance_name,
          usuario_matricula,
          usuario_nome,
          usuario_areaatuacao,
          usuario_funcao
        )
        values ($1, $2, $3, $4, $5)
        on conflict (instance_name, usuario_matricula)
        do update set usuario_nome = excluded.usuario_nome,
                     usuario_areaatuacao = excluded.usuario_areaatuacao,
                     usuario_funcao = excluded.usuario_funcao,
                     updated_at = now()
        returning
          instance_name as "instanceName",
          usuario_matricula as "matricula",
          usuario_nome as "nome",
          usuario_areaatuacao as "areaAtuacao",
          usuario_funcao as "funcao",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `,
      [safeInstanceName, safeMatricula, safeNome, safeAreaAtuacao, safeFuncao]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function revokeZapHubInstanceAcesso({ databasePool, instanceName, matricula }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para revogar acesso de instância");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");

  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    await ensureZapHubInstanceAcessosTable(client);
    const result = await client.query(
      `
        delete from zaphub_instance_acessos
         where instance_name = $1
           and usuario_matricula = $2
      `,
      [safeInstanceName, safeMatricula]
    );
    return { deletedCount: Number(result.rowCount || 0) };
  } finally {
    client.release();
  }
}

export async function fetchZapHubInstanceAcessosResumo({ databasePool }) {
  if (!databasePool) return [];

  const client = await databasePool.connect();
  try {
    await resetClientTransactionState(client);
    await ensureZapHubInstanceAcessosTable(client);
    const result = await client.query(
      `
        select
          usuario_matricula as "matricula",
          max(usuario_nome) as "nome",
          max(usuario_areaatuacao) as "areaAtuacao",
          max(usuario_funcao) as "funcao",
          count(*)::int as "totalInstancias",
          array_agg(instance_name order by instance_name asc) as "instances"
        from zaphub_instance_acessos
        group by usuario_matricula
        order by usuario_matricula asc
      `
    );
    return Array.isArray(result.rows) ? result.rows : [];
  } finally {
    client.release();
  }
}

async function ensureZapHubMensagensPuxadasTable(client) {
  await client.query(
    `
      create table if not exists zaphub_mensagens_puxadas (
        id serial primary key,
        instance_name varchar(255) not null,
        message_key_id varchar(255) not null,
        message_id varchar(255) null,
        remote_jid varchar(255) not null,
        participant varchar(255) null,
        usuario_matricula varchar(50) not null,
        usuario_nome varchar(150) null,
        pulled_at timestamptz not null default now(),
        unique (instance_name, message_key_id)
      )
    `
  );
  await client.query(
    `
      create index if not exists zaphub_mensagens_puxadas_usuario_idx
        on zaphub_mensagens_puxadas (instance_name, usuario_matricula, pulled_at desc)
    `
  );
  await client.query(
    `
      create index if not exists zaphub_mensagens_puxadas_remote_idx
        on zaphub_mensagens_puxadas (instance_name, usuario_matricula, remote_jid)
    `
  );
  await client.query(`alter table zaphub_mensagens_puxadas add column if not exists encerrada_at timestamptz null`);
  await client.query(
    `
      create index if not exists zaphub_mensagens_puxadas_encerrada_idx
        on zaphub_mensagens_puxadas (instance_name, usuario_matricula, encerrada_at desc nulls last)
    `
  );
}

export async function puxarZapHubMensagem({
  databasePool,
  instanceName,
  messageKeyId,
  remoteJid,
  matricula,
  usuarioNome = null,
  participant = null,
  messageId = null,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para puxar mensagem");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMessageKeyId = String(messageKeyId || "").trim();
  const safeRemoteJid = String(remoteJid || "").trim();
  const safeMatricula = String(matricula || "").trim();
  const safeUsuarioNome = String(usuarioNome || "").trim() || null;
  const safeParticipant = String(participant || "").trim() || null;
  const safeMessageId = String(messageId || "").trim() || null;

  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMessageKeyId) throw new Error("messageKeyId é obrigatório");
  if (!safeRemoteJid) throw new Error("remoteJid é obrigatório");
  if (safeRemoteJid.includes("@g.us")) {
    const err = new Error("Não é possível puxar mensagens de grupos");
    err.statusCode = 400;
    throw err;
  }
  if (!safeMatricula) throw new Error("matricula é obrigatória");

  const client = await databasePool.connect();
  try {
    await ensureZapHubMensagensPuxadasTable(client);
    const storedRemoteJid = await resolveContactRemoteJidForStorage(client, safeRemoteJid, safeParticipant);

    const outroUsuarioAtivo = await client.query(
      `
        select p.usuario_matricula as "matricula", p.usuario_nome as "nome"
          from zaphub_mensagens_puxadas p
         where p.instance_name = $1
           and p.encerrada_at is null
           and p.usuario_matricula <> $2
           and ${buildContactJidsMatchSql("p.remote_jid", "$3")}
         limit 1
      `,
      [safeInstanceName, safeMatricula, storedRemoteJid]
    );
    if (outroUsuarioAtivo.rows[0]) {
      const row = outroUsuarioAtivo.rows[0];
      const err = new Error(`Conversa já em atendimento por ${row.nome || row.matricula || "outro usuário"}`);
      err.statusCode = 409;
      throw err;
    }

    const existing = await client.query(
      `
        select usuario_matricula as "matricula", usuario_nome as "nome"
          from zaphub_mensagens_puxadas
         where instance_name = $1
           and message_key_id = $2
         limit 1
      `,
      [safeInstanceName, safeMessageKeyId]
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      const err = new Error(
        row.matricula === safeMatricula
          ? "Mensagem já puxada por você"
          : `Mensagem já puxada por ${row.nome || row.matricula || "outro usuário"}`
      );
      err.statusCode = 409;
      throw err;
    }

    const result = await client.query(
      `
        insert into zaphub_mensagens_puxadas (
          instance_name,
          message_key_id,
          message_id,
          remote_jid,
          participant,
          usuario_matricula,
          usuario_nome
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id,
                  instance_name as "instanceName",
                  message_key_id as "messageKeyId",
                  message_id as "messageId",
                  remote_jid as "remoteJid",
                  participant,
                  usuario_matricula as "usuarioMatricula",
                  usuario_nome as "usuarioNome",
                  pulled_at as "pulledAt"
      `,
      [safeInstanceName, safeMessageKeyId, safeMessageId, storedRemoteJid, safeParticipant, safeMatricula, safeUsuarioNome]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function iniciarOuReabrirZapHubConversaPuxada({
  databasePool,
  instanceName,
  matricula,
  remoteJid,
  remoteJids = null,
  usuarioNome = null,
  reabrir = false,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para iniciar conversa puxada");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  const safeUsuarioNome = String(usuarioNome || "").trim() || null;
  const safeRemoteJid = String(remoteJid || "").trim();
  const safeRemoteJids = Array.from(
    new Set(
      [safeRemoteJid, ...(Array.isArray(remoteJids) ? remoteJids : [])]
        .map((jid) => String(jid || "").trim())
        .filter(Boolean)
    )
  );
  const somenteReabrir = Boolean(reabrir);

  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");
  if (!safeRemoteJids.length) throw new Error("remoteJid é obrigatório");
  if (safeRemoteJids.some((jid) => jid.includes("@g.us"))) {
    const err = new Error("Não é possível iniciar conversas de grupos");
    err.statusCode = 400;
    throw err;
  }

  const client = await databasePool.connect();
  try {
    await ensureZapHubMensagensPuxadasTable(client);
    await client.query("begin");
    const instance = await fetchTargetInstance(client, safeInstanceName, null);
    const storedRemoteJid = await resolveContactRemoteJidForStorage(client, safeRemoteJid, safeRemoteJids[0] || safeRemoteJid);

    const outroUsuarioAtivo = await client.query(
      `
        select p.usuario_matricula as "matricula", p.usuario_nome as "nome"
          from zaphub_mensagens_puxadas p
         where p.instance_name = $1
           and p.encerrada_at is null
           and p.usuario_matricula <> $2
           and (
             p.remote_jid = any($3::text[])
             or exists (
               select 1
                 from unnest($3::text[]) candidate(jid)
                where ${buildContactJidsMatchSql("p.remote_jid", "candidate.jid", "$4")}
             )
           )
         limit 1
      `,
      [safeInstanceName, safeMatricula, safeRemoteJids, instance.id]
    );
    if (outroUsuarioAtivo.rows[0]) {
      const row = outroUsuarioAtivo.rows[0];
      const err = new Error(`Conversa já em atendimento por ${row.nome || row.matricula || "outro usuário"}`);
      err.statusCode = 409;
      throw err;
    }

    const reabertura = await client.query(
      `
        update zaphub_mensagens_puxadas p
           set encerrada_at = null,
               pulled_at = now(),
               remote_jid = $4
         where p.instance_name = $1
           and p.usuario_matricula = $2
           and p.encerrada_at is not null
           and (
             p.remote_jid = any($3::text[])
             or exists (
               select 1
                 from unnest($3::text[]) candidate(jid)
                where ${buildContactJidsMatchSql("p.remote_jid", "candidate.jid", "$5")}
             )
           )
        returning p.id, p.remote_jid as "remoteJid", p.message_key_id as "messageKeyId"
      `,
      [safeInstanceName, safeMatricula, safeRemoteJids, storedRemoteJid, instance.id]
    );

    const ativa = await client.query(
      `
        select p.id, p.remote_jid as "remoteJid", p.message_key_id as "messageKeyId"
          from zaphub_mensagens_puxadas p
         where p.instance_name = $1
           and p.usuario_matricula = $2
           and p.encerrada_at is null
           and (
             p.remote_jid = any($3::text[])
             or exists (
               select 1
                 from unnest($3::text[]) candidate(jid)
                where ${buildContactJidsMatchSql("p.remote_jid", "candidate.jid", "$4")}
             )
           )
         order by p.pulled_at desc nulls last
         limit 1
      `,
      [safeInstanceName, safeMatricula, safeRemoteJids, instance.id]
    );

    if (ativa.rows[0]) {
      await client.query("commit");
      return {
        action: reabertura.rowCount > 0 ? "reaberta" : "ativa",
        remoteJid: ativa.rows[0].remoteJid,
        payload: ativa.rows[0],
      };
    }

    if (somenteReabrir) {
      const err = new Error("Nenhuma conversa encerrada encontrada para reabrir");
      err.statusCode = 404;
      throw err;
    }

    const anchorRemoteJid = storedRemoteJid;
    const anchorMessage = await client.query(
      `
        select
          m.id as "messageId",
          m.key->>'id' as "messageKeyId"
        from "Message" m
        where m."instanceId" = $1
          and coalesce(m.key->>'remoteJid', '') = $2
          and coalesce(m.key->>'remoteJid', '') not in ('', 'status@broadcast', '0@s.whatsapp.net')
        order by
          case when coalesce((m.key->>'fromMe')::boolean, false) = false then 0 else 1 end,
          m."messageTimestamp" desc nulls last
        limit 1
      `,
      [instance.id, anchorRemoteJid]
    );

    const anchorRow = anchorMessage.rows[0] || null;
    const messageKeyId = String(anchorRow?.messageKeyId || "").trim() || `iniciada:${safeInstanceName}:${anchorRemoteJid}:${safeMatricula}`;
    const messageId = String(anchorRow?.messageId || "").trim() || null;

    const existingKey = await client.query(
      `
        select usuario_matricula as "matricula", usuario_nome as "nome", encerrada_at as "encerradaAt"
          from zaphub_mensagens_puxadas
         where instance_name = $1
           and message_key_id = $2
         limit 1
      `,
      [safeInstanceName, messageKeyId]
    );
    if (existingKey.rows[0]) {
      const row = existingKey.rows[0];
      if (row.matricula !== safeMatricula) {
        const err = new Error(`Mensagem já puxada por ${row.nome || row.matricula || "outro usuário"}`);
        err.statusCode = 409;
        throw err;
      }
      const reativada = await client.query(
        `
          update zaphub_mensagens_puxadas
             set encerrada_at = null,
                 pulled_at = now(),
                 remote_jid = $4,
                 usuario_nome = coalesce($5, usuario_nome)
           where instance_name = $1
             and message_key_id = $2
             and usuario_matricula = $3
          returning id,
                    instance_name as "instanceName",
                    message_key_id as "messageKeyId",
                    message_id as "messageId",
                    remote_jid as "remoteJid",
                    usuario_matricula as "usuarioMatricula",
                    usuario_nome as "usuarioNome",
                    pulled_at as "pulledAt"
        `,
        [safeInstanceName, messageKeyId, safeMatricula, anchorRemoteJid, safeUsuarioNome]
      );
      await client.query("commit");
      return {
        action: row.encerradaAt ? "reaberta" : "iniciada",
        remoteJid: anchorRemoteJid,
        payload: reativada.rows[0] || null,
      };
    }

    const insert = await client.query(
      `
        insert into zaphub_mensagens_puxadas (
          instance_name,
          message_key_id,
          message_id,
          remote_jid,
          participant,
          usuario_matricula,
          usuario_nome
        )
        values ($1, $2, $3, $4, null, $5, $6)
        returning id,
                  instance_name as "instanceName",
                  message_key_id as "messageKeyId",
                  message_id as "messageId",
                  remote_jid as "remoteJid",
                  usuario_matricula as "usuarioMatricula",
                  usuario_nome as "usuarioNome",
                  pulled_at as "pulledAt"
      `,
      [safeInstanceName, messageKeyId, messageId, anchorRemoteJid, safeMatricula, safeUsuarioNome]
    );

    await client.query("commit");
    return {
      action: reabertura.rowCount > 0 ? "reaberta" : "iniciada",
      remoteJid: anchorRemoteJid,
      payload: insert.rows[0] || null,
    };
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      void 0;
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function encerrarZapHubPuxadasConversa({ databasePool, instanceName, matricula, remoteJid, remoteJids = null }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para encerrar conversa puxada");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  const safeRemoteJid = String(remoteJid || "").trim();
  const safeRemoteJids = Array.from(
    new Set(
      [safeRemoteJid, ...(Array.isArray(remoteJids) ? remoteJids : [])]
        .map((jid) => String(jid || "").trim())
        .filter(Boolean)
    )
  );
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");
  if (!safeRemoteJids.length) throw new Error("remoteJid é obrigatório");
  if (safeRemoteJids.some((jid) => jid.includes("@g.us"))) {
    const err = new Error("Não é possível encerrar conversas de grupos");
    err.statusCode = 400;
    throw err;
  }

  const client = await databasePool.connect();
  try {
    await ensureZapHubMensagensPuxadasTable(client);
    const result = await client.query(
      `
        update zaphub_mensagens_puxadas
           set encerrada_at = coalesce(encerrada_at, now())
         where instance_name = $1
           and usuario_matricula = $2
           and remote_jid = any($3::text[])
           and encerrada_at is null
        returning id
      `,
      [safeInstanceName, safeMatricula, safeRemoteJids]
    );
    if (!result.rowCount) {
      const err = new Error("Nenhuma mensagem puxada ativa encontrada para encerrar nesta conversa");
      err.statusCode = 404;
      throw err;
    }
    return { encerradasCount: Number(result.rowCount || 0) };
  } finally {
    client.release();
  }
}

export async function fetchPuxadasConversasByUsuario({
  databasePool,
  instanceName,
  matricula,
  limit = 80,
  encerradas = false,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar puxadas");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  const safeLimit = Math.max(1, Math.min(120, Number(limit) || 80));
  const somenteEncerradas = Boolean(encerradas);
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");

  const client = await databasePool.connect();
  try {
    await ensureZapHubMensagensPuxadasTable(client);
    await client.query("begin");
    const instance = await fetchTargetInstance(client, safeInstanceName, null);
    const reabertura = somenteEncerradas
      ? await reabrirPuxadasEncerradasComNovaMensagem(client, safeInstanceName, instance.id)
      : { reabertasCount: 0, remoteJids: [] };
    const encerradaFilterSql = somenteEncerradas ? "and p.encerrada_at is not null" : "and p.encerrada_at is null";
    const orderClause = somenteEncerradas ? "pulled.last_encerrada_at" : "pulled.last_pulled_at";
    const result = await client.query(
      `
        with pulled as (
          select
            p.remote_jid,
            max(p.pulled_at) as last_pulled_at,
            max(p.encerrada_at) as last_encerrada_at,
            count(*)::int as pulled_count
          from zaphub_mensagens_puxadas p
          where p.instance_name = $1
            and p.usuario_matricula = $2
            ${encerradaFilterSql}
          group by p.remote_jid
        ),
        latest_msg as (
          select distinct on (p.remote_jid)
            p.remote_jid,
            m.id,
            m."messageType",
            m.message,
            m.key,
            m."messageTimestamp",
            m."pushName",
            m.status,
            m.key->>'id' as "messageKeyId",
            coalesce(m.participant, m.key->>'participant') as participant,
            p.encerrada_at as "encerradaAt"
          from zaphub_mensagens_puxadas p
          inner join "Message" m
            on m."instanceId" = $3
           and m.key->>'id' = p.message_key_id
          where p.instance_name = $1
            and p.usuario_matricula = $2
            ${encerradaFilterSql}
          order by p.remote_jid, ${somenteEncerradas ? "p.encerrada_at" : "p.pulled_at"} desc nulls last
        )
        select
          pulled.remote_jid as "remoteJid",
          pulled.pulled_count as "pulledCount",
          pulled.last_pulled_at as "lastPulledAt",
          pulled.last_encerrada_at as "lastEncerradaAt",
          coalesce(c.name, lm."pushName", pulled.remote_jid, 'Sem nome') as "chatName",
          coalesce(c."remoteJid", pulled.remote_jid) as "chatRemoteJid",
          coalesce(c."unreadMessages", 0) as "unreadMessages",
          ct."profilePicUrl" as "profilePicUrl",
          lm.id as "lastMessageId",
          lm."messageType" as "lastMessageType",
          lm.message as "lastMessagePayload",
          lm.key as "lastMessageKey",
          lm."messageTimestamp" as "lastMessageTimestamp",
          lm.status as "lastMessageStatus",
          lm."messageKeyId" as "lastMessageKeyId",
          lm.participant as "lastMessageParticipant"
        from pulled
        left join latest_msg lm on lm.remote_jid = pulled.remote_jid
        left join "Chat" c
          on c."instanceId" = $3
         and c."remoteJid" = pulled.remote_jid
        left join "Contact" ct
          on ct."instanceId" = $3
         and ct."remoteJid" = pulled.remote_jid
        order by ${orderClause} desc nulls last
        limit $4
      `,
      [safeInstanceName, safeMatricula, instance.id, safeLimit]
    );

    const rows = result.rows.map((row) => {
      const key = row.lastMessageKey && typeof row.lastMessageKey === "object" ? row.lastMessageKey : {};
      const fromMe = parseBoolean(key.fromMe);
      const preview = getMessagePreview(row.lastMessagePayload, row.lastMessageType);
      const previewNormalized = String(preview || "").trim().toLowerCase();
      const statusNormalized = String(row.lastMessageStatus || "").trim().toUpperCase();
      const isDeleted = statusNormalized === "DELETED" || (fromMe && previewNormalized === "[conversation]");
      const timestamp = Number(row.lastMessageTimestamp) || null;
      const encerradaAt = row.lastEncerradaAt ? new Date(row.lastEncerradaAt).toISOString() : null;
      return {
        id: row.remoteJid,
        chatName: row.chatName || row.remoteJid || "Sem nome",
        remoteJid: row.remoteJid || null,
        canonicalRemoteJid: row.chatRemoteJid || row.remoteJid || null,
        contactRemoteJid: row.chatRemoteJid || row.remoteJid || null,
        unreadCount: 0,
        profilePicUrl: row.profilePicUrl || null,
        lastMessage: preview || "",
        lastSentAt: somenteEncerradas
          ? encerradaAt
          : timestamp
          ? new Date(timestamp * 1000).toISOString()
          : row.lastPulledAt
          ? new Date(row.lastPulledAt).toISOString()
          : null,
        lastTimestamp: somenteEncerradas
          ? row.lastEncerradaAt
            ? Math.floor(new Date(row.lastEncerradaAt).getTime() / 1000)
            : timestamp
          : timestamp,
        totalMensagens: Number(row.pulledCount) || 0,
        mensagens: [],
        lastMessageType: row.lastMessageType || null,
        lastMessageFromMe: fromMe,
        lastMessageDeleted: isDeleted,
        pulledCount: Number(row.pulledCount) || 0,
        encerradaAt,
      };
    });

    await client.query("commit");
    return {
      instance: mapInstance(instance),
      rows,
      count: rows.length,
      reabertasCount: reabertura.reabertasCount,
      reabertasRemoteJids: reabertura.remoteJids,
    };
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      void 0;
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function fetchPuxadasBadgesByUsuario({ databasePool, instanceName, matricula }) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar puxadas");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");

  const client = await databasePool.connect();
  try {
    // #region debug-point A:puxadas-badges-db-start
    const t0 = Date.now();
    const poolStatsAtStart =
      databasePool && typeof databasePool === "object"
        ? {
            totalCount: Number(databasePool.totalCount) || 0,
            idleCount: Number(databasePool.idleCount) || 0,
            waitingCount: Number(databasePool.waitingCount) || 0,
          }
        : null;
    debugReport({
      hypothesisId: "A",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "start",
      data: {
        instanceName: safeInstanceName,
        matricula: safeMatricula,
        pool: poolStatsAtStart,
      },
    });
    // #endregion
    // #region debug-point B:puxadas-badges-ensure-table
    const tEnsure0 = Date.now();
    // #endregion
    await ensureZapHubMensagensPuxadasTable(client);
    // #region debug-point B:puxadas-badges-ensure-table-done
    debugReport({
      hypothesisId: "B",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "after ensureZapHubMensagensPuxadasTable()",
      data: { ms: Date.now() - tEnsure0 },
    });
    // #endregion
    // #region debug-point C:puxadas-badges-instance
    const tInstance0 = Date.now();
    // #endregion
    const instance = await fetchTargetInstance(client, safeInstanceName, null);
    // #region debug-point C:puxadas-badges-instance-done
    debugReport({
      hypothesisId: "C",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "after fetchTargetInstance()",
      data: {
        ms: Date.now() - tInstance0,
        instanceId: instance?.id ?? null,
      },
    });
    // #endregion
    // #region debug-point D:puxadas-badges-reopen
    const tReopen0 = Date.now();
    // #endregion
    await reabrirPuxadasEncerradasComNovaMensagem(client, safeInstanceName, instance.id);
    // #region debug-point D:puxadas-badges-reopen-done
    debugReport({
      hypothesisId: "D",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "after reabrirPuxadasEncerradasComNovaMensagem()",
      data: {
        ms: Date.now() - tReopen0,
        totalMs: Date.now() - t0,
      },
    });
    // #endregion
    // #region debug-point E:puxadas-badges-query
    const tQuery0 = Date.now();
    // #endregion
    const result = await client.query(
      `
        select
          count(distinct case when p.encerrada_at is null then p.remote_jid end)::int as "puxadasCount",
          count(distinct case when p.encerrada_at is not null then p.remote_jid end)::int as "encerradasCount"
        from zaphub_mensagens_puxadas p
        where p.instance_name = $1
          and p.usuario_matricula = $2
      `,
      [safeInstanceName, safeMatricula]
    );
    // #region debug-point E:puxadas-badges-query-done
    debugReport({
      hypothesisId: "E",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "after badges count query",
      data: {
        ms: Date.now() - tQuery0,
        rowCount: Number(result?.rowCount) || 0,
        totalMs: Date.now() - t0,
      },
    });
    // #endregion
    const row = result.rows?.[0] || {};
    // #region debug-point A:puxadas-badges-db-end
    debugReport({
      hypothesisId: "A",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "success",
      data: {
        totalMs: Date.now() - t0,
        puxadasCount: Math.max(0, Number(row.puxadasCount) || 0),
        encerradasCount: Math.max(0, Number(row.encerradasCount) || 0),
      },
    });
    // #endregion
    return {
      puxadasCount: Math.max(0, Number(row.puxadasCount) || 0),
      encerradasCount: Math.max(0, Number(row.encerradasCount) || 0),
    };
  } catch (err) {
    // #region debug-point Z:puxadas-badges-db-error
    debugReport({
      hypothesisId: "Z",
      location: "zaphubInstancias.db.js:fetchPuxadasBadgesByUsuario",
      msg: "error",
      data: {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : null,
        code: err && typeof err === "object" && "code" in err ? err.code : undefined,
        severity: err && typeof err === "object" && "severity" in err ? err.severity : undefined,
      },
    });
    // #endregion
    throw err;
  } finally {
    client.release();
  }
}

export async function fetchPuxadasMensagensByUsuario({
  databasePool,
  instanceName,
  matricula,
  remoteJid,
  limit = 80,
  encerradas = false,
}) {
  if (!databasePool) {
    throw new Error("DATABASE_URL não configurada para consultar mensagens puxadas");
  }

  const safeInstanceName = String(instanceName || "").trim();
  const safeMatricula = String(matricula || "").trim();
  const safeRemoteJid = String(remoteJid || "").trim();
  const safeLimit = Math.max(1, Math.min(240, Number(limit) || 80));
  if (!safeInstanceName) throw new Error("instanceName é obrigatório");
  if (!safeMatricula) throw new Error("matricula é obrigatória");
  if (!safeRemoteJid) throw new Error("remoteJid é obrigatório");

  const client = await databasePool.connect();
  try {
    await ensureZapHubMensagensPuxadasTable(client);
    const snapshot = await fetchConversationMessagesWithClient(client, {
      limit: safeLimit,
      instanceName: safeInstanceName,
      instanceId: null,
      remoteJid: safeRemoteJid,
      onlyPulledForMatricula: safeMatricula,
      onlyPulledEncerradas: Boolean(encerradas),
    });
    return snapshot;
  } finally {
    client.release();
  }
}
