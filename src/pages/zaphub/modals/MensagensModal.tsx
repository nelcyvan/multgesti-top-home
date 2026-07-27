import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  ArchiveFill,
  ArrowClockwise,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CameraVideoFill,
  ChatDotsFill,
  Check,
  Check2All,
  ClockHistory,
  EmojiSmileFill,
  ExclamationTriangleFill,
  FileEarmarkTextFill,
  GearFill,
  HouseDoorFill,
  ImageFill,
  InboxFill,
  InfoCircleFill,
  LightningChargeFill,
  MicFill,
  PeopleFill,
  PencilFill,
  PlayFill,
  PauseFill,
  PersonCircle,
  TelephoneFill,
  TrashFill,
} from "react-bootstrap-icons";
type MensagensModalProps = {
  show: boolean;
  onClose: () => void;
};

type MensagemRow = {
  id: string;
  messageKeyId?: string | null;
  chatName: string;
  remoteJid?: string | null;
  canonicalRemoteJid?: string | null;
  contactRemoteJid?: string | null;
  lidRemoteJid?: string | null;
  eventSenderJid?: string | null;
  eventRemoteJidAlt?: string | null;
  unreadMessages?: number | null;
  profilePicUrl?: string | null;
  messageType: string;
  preview: string;
  fromMe: boolean;
  senderName: string;
  participant?: string | null;
  status?: string | null;
  isDeleted?: boolean | null;
  deletedBy?: string | null;
  timestamp?: number | null;
  sentAt?: string | null;
  media?: {
    kind: "image" | "video" | "audio" | "sticker" | "document";
    sourceUrl?: string | null;
    fileName?: string | null;
    mimetype?: string | null;
    caption?: string | null;
    canLoadHd?: boolean | null;
  } | null;
};

type LoadedMediaAsset = {
  src: string;
  fileName?: string | null;
  mimetype?: string | null;
};

type AnexoEnvio = {
  id: string;
  file: File;
  kind: "image" | "video" | "audio";
  previewUrl: string;
  fileName: string;
  mimetype: string;
  size: number;
};

type InstanciaAberta = {
  id: string;
  instanceName: string;
  profileName?: string | null;
  number?: string | null;
  status: string;
  unreadCount?: number | null;
  isTelevendasPrincipal?: boolean;
  responsavelMatricula?: string | null;
};

type UsuarioLogado = {
  usuario?: string;
  nome?: string;
  matricula?: string;
  codfilial?: string;
  codusur?: number | null;
  [key: string]: unknown;
};

type ConversaAgrupada = {
  id: string;
  chatName: string;
  remoteJid?: string | null;
  canonicalRemoteJid?: string | null;
  contactRemoteJid?: string | null;
  lidRemoteJid?: string | null;
  eventSenderJid?: string | null;
  eventRemoteJidAlt?: string | null;
  unreadCount: number;
  profilePicUrl?: string | null;
  lastMessage: string;
  lastMessageType?: string | null;
  lastMessageFromMe?: boolean;
  lastMessageDeleted?: boolean;
  lastSentAt?: string | null;
  lastTimestamp?: number | null;
  totalMensagens: number;
  mensagens: MensagemRow[];
};

type AbaConversas = "hoje" | "ontem" | "antigas" | "naoVisualizadas";
type ModoVisualizacaoInstancia = "normal" | "puxadas" | "encerradas";
type ConversasEscopoModo = "normal" | "puxadas" | "encerradas";
type ModalIniciarConversaModo = "iniciar" | "reabrir";

type MensagensCacheSnapshot = {
  instance: InstanciaAberta | null;
  rows: MensagemRow[];
  count: number | null;
  syncedAt: string;
};

const cardStyle: React.CSSProperties = {
  borderRadius: 0,
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
};

const MAX_CONVERSAS_VISIVEIS = 20;
const DEFAULT_MENSAGENS_LIMIT = 40;
const MENSAGENS_LOAD_MORE_STEP = 40;
const MODAL_CONTENT_HEIGHT = "calc(100vh - 128px)";
const PAINEIS_HEIGHT = "calc(100vh - 260px)";

function normalizeInstanceKey(instanceName?: string | null): string {
  return String(instanceName || "").trim().normalize("NFC").toLowerCase();
}

function isUuid(value?: string | null): boolean {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function getUnreadCountForInstance(counts: Record<string, number>, instanceName?: string | null): number {
  return Number(counts[normalizeInstanceKey(instanceName)]) || 0;
}

function applyUnreadCountUpdate(
  prev: Record<string, number>,
  instanceName: string,
  value: number
): Record<string, number> {
  const key = normalizeInstanceKey(instanceName);
  if (!key) return prev;
  return { ...prev, [key]: Math.max(0, Number(value) || 0) };
}

function seedUnreadCountsFromInstances(
  prev: Record<string, number>,
  instances: InstanciaAberta[],
  { reset = false }: { reset?: boolean } = {}
): Record<string, number> {
  const next = reset ? {} : { ...(prev || {}) };
  const allowed = new Set<string>();

  instances.forEach((item) => {
    const key = normalizeInstanceKey(item.instanceName);
    if (!key) return;
    allowed.add(key);
    const fromApi = Number(item.unreadCount);
    if (reset || !(key in next)) {
      next[key] = Number.isFinite(fromApi) ? Math.max(0, fromApi) : 0;
    }
  });

  Object.keys(next).forEach((key) => {
    if (!allowed.has(key)) {
      delete next[key];
    }
  });

  return next;
}

const ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT = [
  "Consultor(a)",
  "Comprador(a)",
  "Analista",
  "Gerente",
  "Operador(a)",
  "SAC",
  "Financeiro",
  "Comercial",
  "Marketing",
];

const ZAPHUB_HEADER_ROLE_STORAGE_KEYS = {
  options: "zaphub.headerRoleOptions",
  selected: "zaphub.headerRoleSelected",
};
const ZAPHUB_DELETED_BY_STORAGE_KEY = "zaphub.deletedByMap";

function sanitizeHeaderRoleOption(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/:$/, "")
    .trim();
}

function loadHeaderRoleOptions(): string[] {
  try {
    const raw = localStorage.getItem(ZAPHUB_HEADER_ROLE_STORAGE_KEYS.options);
    if (!raw) return [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    const normalized = list
      .map((item) => sanitizeHeaderRoleOption(String(item ?? "")))
      .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    return unique.length ? unique : [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
  } catch {
    return [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
  }
}

function loadHeaderRoleSelected(options: string[]) {
  try {
    const raw = localStorage.getItem(ZAPHUB_HEADER_ROLE_STORAGE_KEYS.selected);
    const candidate = sanitizeHeaderRoleOption(String(raw || ""));
    if (candidate && options.includes(candidate)) return candidate;
  } catch {
    void 0;
  }
  return options[0] || ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT[0] || "Consultor(a)";
}

function getDeletedByStorage() {
  try {
    const raw = localStorage.getItem(ZAPHUB_DELETED_BY_STORAGE_KEY);
    if (!raw) return {} as Record<string, string>;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {} as Record<string, string>;
    const out: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      const k = String(key || "").trim();
      const v = typeof value === "string" ? value.trim() : "";
      if (!k || !v) return;
      out[k] = v;
    });
    return out;
  } catch {
    return {} as Record<string, string>;
  }
}

function setDeletedByStorage(next: Record<string, string>) {
  try {
    localStorage.setItem(ZAPHUB_DELETED_BY_STORAGE_KEY, JSON.stringify(next || {}));
  } catch {
    void 0;
  }
}

function getDeletedByKey(remoteJid: string, messageKeyId: string) {
  const r = String(remoteJid || "").trim().toLowerCase();
  const id = String(messageKeyId || "").trim();
  if (!r || !id) return "";
  return `${r}::${id}`;
}

function saveDeletedBy(remoteJid: string, messageKeyId: string, deletedBy: string) {
  const key = getDeletedByKey(remoteJid, messageKeyId);
  const value = String(deletedBy || "").trim();
  if (!key || !value) return;
  const current = getDeletedByStorage();
  current[key] = value;
  setDeletedByStorage(current);
}

function normalizeMediaKind(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("image")) return "image";
  if (normalized.includes("video")) return "video";
  if (normalized.includes("audio")) return "audio";
  if (normalized.includes("sticker")) return "sticker";
  if (normalized.includes("document")) return "document";
  return null;
}

function getMediaPresentation(value?: string | null) {
  const kind = normalizeMediaKind(value);
  if (kind === "image") {
    return { kind, label: "Imagem", icon: <ImageFill size={12} className="flex-shrink-0" /> };
  }
  if (kind === "video") {
    return { kind, label: "Video", icon: <CameraVideoFill size={12} className="flex-shrink-0" /> };
  }
  if (kind === "audio") {
    return { kind, label: "Audio", icon: <MicFill size={12} className="flex-shrink-0" /> };
  }
  if (kind === "sticker") {
    return { kind, label: "Sticker", icon: <EmojiSmileFill size={12} className="flex-shrink-0" /> };
  }
  if (kind === "document") {
    return { kind, label: "Documento", icon: <FileEarmarkTextFill size={12} className="flex-shrink-0" /> };
  }
  return null;
}

function isEmojiOnlyText(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const withoutSpaces = raw.replace(/\s+/g, "");
    if (!withoutSpaces) return false;
    return /^[\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(withoutSpaces);
  } catch {
    return false;
  }
}

function getConversationPreviewPresentation(messageType?: string | null, preview?: string | null) {
  const media = getMediaPresentation(messageType);
  if (media) return { label: media.label, icon: media.icon };

  const typeNormalized = String(messageType || "").trim().toLowerCase();
  if (typeNormalized.includes("reaction")) {
    return { label: "Reação", icon: <EmojiSmileFill size={12} className="flex-shrink-0" /> };
  }

  if (isEmojiOnlyText(preview)) {
    return { label: "Emoji", icon: <EmojiSmileFill size={12} className="flex-shrink-0" /> };
  }

  if (typeNormalized && typeNormalized !== "conversation" && typeNormalized !== "extendedtextmessage") {
    return { label: "Mensagem", icon: <InfoCircleFill size={12} className="flex-shrink-0" /> };
  }

  return null;
}

function shouldRenderMessageText(preview?: string | null) {
  const normalized = String(preview || "").trim().toLowerCase();
  if (!normalized) return false;
  return !["[imagem]", "[video]", "[audio]", "[sticker]", "[documento]"].includes(normalized);
}

function isSecretEncryptedMessageType(value?: string | null) {
  return String(value || "").trim().toLowerCase() === "secretencryptedmessage";
}

function getMensagemStatusScore(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "READ") return 5;
  if (normalized === "DELIVERY_ACK") return 4;
  if (normalized === "SERVER_ACK") return 3;
  if (normalized === "PENDING") return 2;
  if (normalized === "ERROR" || normalized === "DELETED") return 0;
  return 1;
}

function isDeletedStatus(status?: string | null) {
  return String(status || "").trim().toUpperCase() === "DELETED";
}

function isMensagemApagada(mensagem: MensagemRow) {
  return Boolean(mensagem.isDeleted) || isDeletedStatus(mensagem.status);
}

function getMensagemTextoExibicao(mensagem: MensagemRow, roleLabels: string[]) {
  if (isMensagemApagada(mensagem)) return "Mensagem apagada";
  const raw = stripMountedConsultorHeader(mensagem.preview, roleLabels);
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "[conversation]") return "Mensagem";
  return trimmed;
}

function getMensagemTextoConversa(mensagem: MensagemRow, roleLabels: string[]) {
  return getMensagemTextoExibicao(mensagem, roleLabels) || "-";
}

function pickBetterMensagemRow(a: MensagemRow, b: MensagemRow) {
  const aSecret = isSecretEncryptedMessageType(a.messageType);
  const bSecret = isSecretEncryptedMessageType(b.messageType);
  if (aSecret !== bSecret) {
    const chosen = aSecret ? b : a;
    const other = chosen === a ? b : a;
    return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
  }

  const aDeleted = isMensagemApagada(a);
  const bDeleted = isMensagemApagada(b);
  if (aDeleted !== bDeleted) {
    const aTs = Number(a.timestamp || 0);
    const bTs = Number(b.timestamp || 0);
    if (aTs !== bTs) {
      const chosen = aTs > bTs ? a : b;
      const other = chosen === a ? b : a;
      return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
    }
    const chosen = aDeleted ? a : b;
    const other = chosen === a ? b : a;
    return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
  }

  const aHasText = shouldRenderMessageText(a.preview);
  const bHasText = shouldRenderMessageText(b.preview);
  if (aHasText !== bHasText) {
    const chosen = aHasText ? a : b;
    const other = chosen === a ? b : a;
    return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
  }

  const aTs = Number(a.timestamp || 0);
  const bTs = Number(b.timestamp || 0);
  if (aTs !== bTs) {
    const chosen = aTs > bTs ? a : b;
    const other = chosen === a ? b : a;
    return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
  }

  const aScore = getMensagemStatusScore(a.status);
  const bScore = getMensagemStatusScore(b.status);
  if (aScore !== bScore) {
    const chosen = aScore > bScore ? a : b;
    const other = chosen === a ? b : a;
    return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
  }

  const aLen = String(a.preview || "").trim().length;
  const bLen = String(b.preview || "").trim().length;
  if (aLen !== bLen) {
    const chosen = aLen > bLen ? a : b;
    const other = chosen === a ? b : a;
    return !chosen.deletedBy && other.deletedBy ? { ...chosen, deletedBy: other.deletedBy } : chosen;
  }

  return !a.deletedBy && b.deletedBy ? { ...a, deletedBy: b.deletedBy } : a;
}

function normalizeSnapshotRows(rows: MensagemRow[]) {
  const deletedByMap = getDeletedByStorage();
  const map = new Map<string, MensagemRow>();
  rows.forEach((row) => {
    if (isSecretEncryptedMessageType(row.messageType)) return;
    const remoteKeyRaw = String(row.remoteJid || row.canonicalRemoteJid || row.contactRemoteJid || "").trim();
    const remoteKey = remoteKeyRaw.toLowerCase();
    const keyId = String(row.messageKeyId || "").trim();
    const deletedByKey = keyId && remoteKey ? `${remoteKey}::${keyId}` : "";
    const deletedBy =
      row.deletedBy ||
      (isDeletedStatus(row.status) || Boolean(row.isDeleted) ? deletedByMap[deletedByKey] || null : null);
    const nextRow = deletedBy ? { ...row, deletedBy } : row;
    const mapKey = keyId ? `${remoteKey}::${keyId}` : `id::${row.id}`;
    const current = map.get(mapKey);
    if (!current) {
      map.set(mapKey, nextRow);
      return;
    }
    map.set(mapKey, pickBetterMensagemRow(current, nextRow));
  });

  return Array.from(map.values()).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

function getMensagemRowKey(row: Pick<MensagemRow, "id" | "messageKeyId" | "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid">) {
  const keyId = String(row.messageKeyId || "").trim();
  if (keyId) {
    const remote = String(row.remoteJid || row.canonicalRemoteJid || row.contactRemoteJid || "").trim().toLowerCase();
    return `${remote}::${keyId}`;
  }
  return `id::${row.id}`;
}

function mergeMensagemRows(prev: MensagemRow[], next: MensagemRow[]) {
  if (!prev.length) return next;
  if (!next.length) return prev;
  const map = new Map<string, MensagemRow>();
  prev.forEach((row) => map.set(getMensagemRowKey(row), row));
  next.forEach((row) => {
    const key = getMensagemRowKey(row);
    const current = map.get(key);
    map.set(key, current ? pickBetterMensagemRow(current, row) : row);
  });
  return Array.from(map.values()).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
}

function mensagemRowsAreEquivalent(prev: MensagemRow[], next: MensagemRow[]) {
  if (prev.length !== next.length) return false;
  for (let index = 0; index < prev.length; index += 1) {
    const left = prev[index];
    const right = next[index];
    if (left.id !== right.id) return false;
    if (String(left.messageKeyId || "") !== String(right.messageKeyId || "")) return false;
    if (Number(left.timestamp || 0) !== Number(right.timestamp || 0)) return false;
    if (String(left.status || "") !== String(right.status || "")) return false;
    if (String(left.preview || "") !== String(right.preview || "")) return false;
  }
  return true;
}

function getConversationMessagesCacheKey(conversaId: string, encerradas: boolean) {
  return `${conversaId}::${encerradas ? "encerradas" : "ativas"}`;
}

function findConversaCorrespondente(
  conversas: ConversaAgrupada[],
  referencia: ConversaAgrupada | null,
  remoteJid = ""
): ConversaAgrupada | null {
  if (!conversas.length) return null;

  const candidatos = new Set<string>();
  const push = (value?: string | null) => {
    const safe = String(value || "").trim();
    if (safe) candidatos.add(safe);
  };

  push(remoteJid);
  if (referencia) {
    push(referencia.id);
    push(referencia.remoteJid);
    getConversationMessageRemoteJidCandidates(referencia).forEach(push);
    const identityKey = getConversaIdentityKey(referencia);
    const porIdentidade = conversas.find((row) => getConversaIdentityKey(row) === identityKey);
    if (porIdentidade) return porIdentidade;
  }

  return (
    conversas.find((row) => {
      const id = String(row.id || "").trim();
      const rowRemote = String(row.remoteJid || "").trim();
      return candidatos.has(id) || candidatos.has(rowRemote);
    }) || null
  );
}

function conversasEscopoCompativelComModo(modoAtual: ModoVisualizacaoInstancia, escopoCarregado: ConversasEscopoModo | null) {
  if (escopoCarregado === null) return false;
  return escopoCarregado === modoAtual;
}

function mergeConversasForSync(prev: ConversaAgrupada[], next: ConversaAgrupada[]) {
  if (!prev.length) return next;
  const prevById = new Map(prev.map((row) => [row.id, row]));
  return next.map((nextRow) => {
    const prevRow = prevById.get(nextRow.id);
    if (!prevRow) return nextRow;
    const merged: ConversaAgrupada = {
      ...prevRow,
      ...nextRow,
      unreadCount: prevRow.unreadCount === 0 ? 0 : nextRow.unreadCount,
    };
    if (
      prevRow.unreadCount === merged.unreadCount &&
      prevRow.lastMessage === merged.lastMessage &&
      prevRow.lastTimestamp === merged.lastTimestamp &&
      prevRow.lastSentAt === merged.lastSentAt &&
      prevRow.chatName === merged.chatName &&
      prevRow.profilePicUrl === merged.profilePicUrl
    ) {
      return prevRow;
    }
    return merged;
  });
}

function buildConversasPorAba(
  conversas: ConversaAgrupada[],
  getTsMs: (conversa: ConversaAgrupada) => number | null
) {
  const now = new Date();
  const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ontemInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const hoje: ConversaAgrupada[] = [];
  const ontem: ConversaAgrupada[] = [];
  const antigas: ConversaAgrupada[] = [];
  const naoVisualizadas: ConversaAgrupada[] = [];

  for (const conversa of conversas) {
    if (Number(conversa.unreadCount) > 0) naoVisualizadas.push(conversa);
    const tsMs = getTsMs(conversa);
    if (tsMs == null) {
      antigas.push(conversa);
      continue;
    }
    if (tsMs >= hojeInicio) hoje.push(conversa);
    else if (tsMs >= ontemInicio) ontem.push(conversa);
    else antigas.push(conversa);
  }

  return { hoje, ontem, antigas, naoVisualizadas };
}

type ConversaAvatarProps = {
  profilePicUrl?: string | null;
  name?: string | null;
  isGrupo?: boolean;
  size?: number;
};

function ConversaAvatar({ profilePicUrl, name, isGrupo = false, size = 38 }: ConversaAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const url = String(profilePicUrl || "").trim();

  React.useEffect(() => {
    setImageError(false);
  }, [url]);

  const iconSize = Math.max(16, Math.round(size * 0.52));

  if (!url || imageError) {
    return (
      <div
        className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0 border"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: "#e9ecef",
          color: "#6c757d",
          borderColor: "rgba(0,0,0,0.08)",
        }}
        title={name || undefined}
        aria-hidden={!name}
      >
        {isGrupo ? <PeopleFill size={iconSize} /> : <PersonCircle size={iconSize} />}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name || "Avatar"}
      className="rounded-circle border flex-shrink-0"
      style={{ width: `${size}px`, height: `${size}px`, objectFit: "cover" }}
      onError={() => setImageError(true)}
    />
  );
}

function prefixConversationPreview(content: React.ReactNode, fromMe?: boolean) {
  return (
    <>
      {fromMe ? <span className="fw-semibold flex-shrink-0">você:</span> : null}
      {content}
    </>
  );
}

function renderConversationPreview(messageType: string, preview: string, fromMe?: boolean) {
  const presentation = getConversationPreviewPresentation(messageType, preview);
  if (presentation) {
    return prefixConversationPreview(
      <span className="text-truncate d-inline-flex align-items-center" style={{ gap: "4px", minWidth: 0 }}>
        {presentation.icon}
        <span className="text-truncate">{presentation.label}</span>
      </span>,
      fromMe
    );
  }

  return prefixConversationPreview(<span className="text-truncate">{String(preview || "").trim() || "-"}</span>, fromMe);
}

function getStatusAppearance(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();

  if (normalized === "PENDING") {
    return {
      label: "Pendente",
      animated: true,
      wrapperStyle: { color: "#b45309", backgroundColor: "rgba(245, 158, 11, 0.14)" },
      icon: <ClockHistory size={11} />,
    };
  }

  if (normalized === "SERVER_ACK") {
    return {
      label: "Recebida pelo servidor",
      animated: true,
      wrapperStyle: { color: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.14)" },
      icon: <Check size={12} />,
    };
  }

  if (normalized === "DELIVERY_ACK") {
    return {
      label: "Entregue",
      animated: false,
      wrapperStyle: { color: "#4f46e5", backgroundColor: "rgba(79, 70, 229, 0.14)" },
      icon: <Check2All size={12} />,
    };
  }

  if (normalized === "READ") {
    return {
      label: "Lida",
      animated: true,
      wrapperStyle: { color: "#0891b2", backgroundColor: "rgba(6, 182, 212, 0.14)" },
      icon: <Check2All size={12} />,
    };
  }

  if (normalized === "PLAYED") {
    return {
      label: "Reproduzida",
      animated: false,
      wrapperStyle: { color: "#059669", backgroundColor: "rgba(5, 150, 105, 0.14)" },
      icon: <PlayFill size={11} />,
    };
  }

  if (normalized === "ERROR") {
    return {
      label: "Erro",
      animated: false,
      wrapperStyle: { color: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.12)" },
      icon: <ExclamationTriangleFill size={11} />,
    };
  }

  if (normalized === "DELETED") {
    return {
      label: "Apagada",
      animated: false,
      wrapperStyle: { color: "#6b7280", backgroundColor: "rgba(107, 114, 128, 0.14)" },
      icon: <TrashFill size={11} />,
    };
  }

  if (normalized === "EDITED") {
    return {
      label: "Editada",
      animated: false,
      wrapperStyle: { color: "#7c3aed", backgroundColor: "rgba(124, 58, 237, 0.14)" },
      icon: <PencilFill size={10} />,
    };
  }

  return null;
}

function getContatoNumero(remoteJid?: string | null) {
  const raw = String(remoteJid || "").trim();
  if (!raw) return null;
  if (raw.includes("@g.us")) return null;
  const jidPart = raw.split("@")[0] || "";
  const digits = jidPart.replace(/\D+/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? `+${digits}` : digits;
}

function stripMountedConsultorHeader(value: string | null | undefined, roleLabels: string[]) {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) return raw.trim();

  const firstLine = String(lines[0] || "").trim();
  const unwrappedFirstLine =
    firstLine.startsWith("*") && firstLine.endsWith("*") ? firstLine.slice(1, -1).trim() : firstLine;
  const roleStarts = Array.from(
    new Set(
      [
        ...roleLabels,
        "Consultor(a)",
        "Consultor",
      ]
        .map((label) => sanitizeHeaderRoleOption(label))
        .filter(Boolean)
        .map((label) => `${label}:`.toLowerCase())
    )
  );
  const normalizedFirstLine = unwrappedFirstLine.toLowerCase();
  const isRoleHeader = roleStarts.some((start) => normalizedFirstLine.startsWith(start));
  if (!isRoleHeader) return raw.trim();

  let idx = 1;
  if (idx < lines.length && String(lines[idx] || "").trim() === "") idx += 1;

  if (idx < lines.length) {
    const maybeBold = String(lines[idx] || "").trim();
    if (maybeBold.startsWith("*") && maybeBold.endsWith("*") && maybeBold.length >= 3) {
      idx += 1;
    }
  }

  if (idx < lines.length && String(lines[idx] || "").startsWith("Contato:")) {
    idx += 1;
    if (idx < lines.length) {
      const maybeInstance = String(lines[idx] || "").trim();
      if (maybeInstance && !maybeInstance.includes(":")) {
        idx += 1;
      }
    }
  }

  if (idx < lines.length && String(lines[idx] || "").trim() === "") idx += 1;

  return lines.slice(idx).join("\n").trim();
}

function stripInlineBoldHeader(value: string | null | undefined, roleLabels: string[]) {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  const labels = Array.from(
    new Set(
      [...roleLabels, "Consultor(a)", "Consultor"].map((label) => sanitizeHeaderRoleOption(label)).filter(Boolean)
    )
  );
  const roleStarts = labels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .map((label) => `\\*${label}:\\s*[^*]{1,80}\\*`);
  if (!roleStarts.length) return raw.trim();
  const pattern = new RegExp(`^(?:${roleStarts.join("|")})\\s*`, "i");
  const stripped = raw.replace(pattern, "");
  return stripped.trim() || "";
}

function extractUserTextFromMessage(value: string | null | undefined, roleLabels: string[]) {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  if (raw.includes("\n")) return stripMountedConsultorHeader(raw, roleLabels);
  return stripInlineBoldHeader(raw, roleLabels);
}

function isPlaceholderChatName(value?: string | null) {
  const name = String(value || "").trim();
  if (!name) return true;
  const normalized = name.toLowerCase();
  return normalized === "sem nome" || normalized === "você" || normalized === "voce" || normalized === "eu";
}

function isGroupConversationRemoteJid(remoteJid?: string | null) {
  return String(remoteJid || "").includes("@g.us");
}

function getConversationJidInfo(
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  const candidates = [
    conversa.eventRemoteJidAlt,
    conversa.eventSenderJid,
    conversa.canonicalRemoteJid,
    conversa.contactRemoteJid,
    conversa.remoteJid,
    conversa.lidRemoteJid,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const whatsappJid = candidates.find((jid) => jid.endsWith("@s.whatsapp.net")) || null;
  const lidJid = candidates.find((jid) => jid.endsWith("@lid")) || null;

  return { whatsappJid, lidJid };
}

function collectConversationJids(
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  return [
    conversa.remoteJid,
    conversa.canonicalRemoteJid,
    conversa.contactRemoteJid,
    conversa.lidRemoteJid,
    conversa.eventSenderJid,
    conversa.eventRemoteJidAlt,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getConversationGroupRemoteJid(
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  return collectConversationJids(conversa).find((jid) => isGroupConversationRemoteJid(jid)) || null;
}

function getConversationApiRemoteJid(
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  const groupJid = getConversationGroupRemoteJid(conversa);
  if (groupJid) return groupJid;

  const candidates = collectConversationJids(conversa);
  return (
    candidates.find((jid) => jid.endsWith("@s.whatsapp.net")) ||
    candidates.find((jid) => jid.endsWith("@lid")) ||
    candidates[0] ||
    ""
  );
}

function getConversationMessageRemoteJidCandidates(
  conversa: Pick<
    ConversaAgrupada,
    "id" | "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  const groupJid = getConversationGroupRemoteJid(conversa);
  if (groupJid) return [groupJid];

  const ordered: string[] = [];
  const push = (jid?: string | null) => {
    const value = String(jid || "").trim();
    if (!value || value.includes("@g.us") || ordered.includes(value)) return;
    ordered.push(value);
  };

  push(conversa.remoteJid);
  push(conversa.id);
  push(conversa.lidRemoteJid);
  for (const jid of collectConversationJids(conversa)) {
    push(jid);
  }

  return ordered.length ? ordered : [getConversationApiRemoteJid(conversa)].filter(Boolean);
}

function getConversationMessagesRemoteJid(
  conversa: Pick<
    ConversaAgrupada,
    "id" | "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  return getConversationMessageRemoteJidCandidates(conversa)[0] || "";
}

function collectMensagemJids(
  mensagem: Pick<
    MensagemRow,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  return [
    mensagem.remoteJid,
    mensagem.canonicalRemoteJid,
    mensagem.contactRemoteJid,
    mensagem.lidRemoteJid,
    mensagem.eventSenderJid,
    mensagem.eventRemoteJidAlt,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function jidMatchesDirectConversation(
  candidateJid: string,
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  const trimmed = String(candidateJid || "").trim();
  if (!trimmed || trimmed.includes("@g.us")) return false;

  const conversaJids = collectConversationJids(conversa);
  if (conversaJids.includes(trimmed)) return true;
  if (payloadRemoteJidMatchesConversa(trimmed, conversa as ConversaAgrupada)) return true;

  const conversaRemote = String(conversa.remoteJid || "").trim();
  const conversaCanonical = String(conversa.canonicalRemoteJid || "").trim();
  const conversaLid = String(conversa.lidRemoteJid || "").trim();

  if (trimmed.endsWith("@lid") && conversaRemote.endsWith("@s.whatsapp.net") && conversaCanonical === trimmed) return true;
  if (conversaRemote.endsWith("@lid") && trimmed.endsWith("@s.whatsapp.net") && conversaCanonical === trimmed) return true;
  if (conversaLid && (conversaLid === trimmed || conversaLid === conversaCanonical)) return true;

  const { whatsappJid, lidJid } = getConversationJidInfo(conversa);
  if (lidJid && trimmed === lidJid) return true;
  if (whatsappJid && trimmed === whatsappJid) return true;

  const conversaPhone = getContatoNumero(whatsappJid || conversaCanonical || conversa.contactRemoteJid || conversaRemote);
  const candidatePhone = getContatoNumero(trimmed);
  return Boolean(conversaPhone && candidatePhone && conversaPhone === candidatePhone);
}

function getMensagemMarkReadRemoteJid(
  mensagem: Pick<MensagemRow, "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid">,
  fallback: string
) {
  const candidates = collectMensagemJids(mensagem).filter((jid) => !jid.includes("@g.us"));
  return candidates[0] || fallback;
}

function mensagemPertenceConversa(
  mensagem: Pick<
    MensagemRow,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >,
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  const msgJids = collectMensagemJids(mensagem);
  if (!msgJids.length) return false;

  const groupJid = getConversationGroupRemoteJid(conversa);
  if (groupJid) {
    return msgJids.some((jid) => jid === groupJid);
  }

  return msgJids.some((jid) => jidMatchesDirectConversation(jid, conversa));
}

function payloadRemoteJidMatchesConversa(payloadRemoteJid: string | null, conversa: ConversaAgrupada | null) {
  if (!conversa) return false;
  if (!payloadRemoteJid) return true;

  const selectedRemoteJid = getConversationApiRemoteJid(conversa);
  if (!selectedRemoteJid || payloadRemoteJid === selectedRemoteJid) return true;

  const selectedJids = collectConversationJids(conversa);
  if (selectedJids.includes(payloadRemoteJid)) return true;

  const isGrupo = Boolean(getConversationGroupRemoteJid(conversa));
  if (isGrupo) return payloadRemoteJid === selectedRemoteJid;

  const payloadPhone = getContatoNumero(payloadRemoteJid);
  const selectedPhone = getContatoNumero(selectedRemoteJid);
  return Boolean(payloadPhone && selectedPhone && payloadPhone === selectedPhone);
}

function clearConversationSnapshotSigCache(
  cache: Record<string, string>,
  conversa: Pick<
    ConversaAgrupada,
    "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  for (const jid of collectConversationJids(conversa)) {
    delete cache[jid];
  }
}

function resolveSelectedConversa(
  conversaSelecionadaId: string | null,
  conversaSelecionadaRef: React.RefObject<ConversaAgrupada | null>,
  conversasRef: React.RefObject<ConversaAgrupada[]>
) {
  if (!conversaSelecionadaId) return null;

  const cached = conversaSelecionadaRef.current;
  if (cached && cached.id === conversaSelecionadaId) return cached;

  const fromList = conversasRef.current.find((row) => row.id === conversaSelecionadaId) || null;
  if (fromList) {
    conversaSelecionadaRef.current = fromList;
  }
  return fromList;
}

type ConversasDuplicateReport = {
  total: number;
  duplicateIds: Array<{ id: string; count: number; remoteJids: string[]; chatNames: string[] }>;
  duplicateIdentities: Array<{
    identityKey: string;
    count: number;
    rows: Array<{ id: string; chatName: string; remoteJid: string; canonicalRemoteJid: string }>;
  }>;
  duplicateChatNames: Array<{
    chatName: string;
    count: number;
    likelySameContact: boolean;
    rows: Array<{
      id: string;
      chatName: string;
      remoteJid: string;
      canonicalRemoteJid: string;
      lidRemoteJid: string;
      identityKey: string;
      mergeKeys: string[];
      phone: string | null;
    }>;
  }>;
};

function jidToMergeKey(jid?: string | null) {
  const trimmed = String(jid || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("@g.us")) return `group:${trimmed}`;
  if (trimmed.endsWith("@lid")) return `lid:${trimmed}`;
  const phone = getContatoNumero(trimmed);
  if (phone) return `phone:${phone}`;
  return `jid:${trimmed}`;
}

function buildConversaMergeKeys(
  conversa: Pick<
    ConversaAgrupada,
    "id" | "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt"
  >
) {
  const groupJid = getConversationGroupRemoteJid(conversa);
  if (groupJid) return [`group:${groupJid}`];

  const keys = new Set<string>();
  for (const jid of [
    conversa.remoteJid,
    conversa.canonicalRemoteJid,
    conversa.contactRemoteJid,
    conversa.lidRemoteJid,
    conversa.eventSenderJid,
    conversa.eventRemoteJidAlt,
    conversa.id,
  ]) {
    const trimmed = String(jid || "").trim();
    if (!trimmed || trimmed.includes("@g.us")) continue;
    const key = jidToMergeKey(trimmed);
    if (key && !key.startsWith("group:")) keys.add(key);
  }
  return Array.from(keys);
}

function shouldCrossLinkMergeConversas(left: ConversaAgrupada, right: ConversaAgrupada) {
  if (isGroupConversationRemoteJid(left.remoteJid) || isGroupConversationRemoteJid(right.remoteJid)) return false;

  const leftJids = new Set(collectConversationJids(left).filter((jid) => !jid.includes("@g.us")));
  const rightJids = collectConversationJids(right).filter((jid) => !jid.includes("@g.us"));
  if (rightJids.some((jid) => leftJids.has(jid))) return true;

  const leftRemote = String(left.remoteJid || "").trim();
  const rightRemote = String(right.remoteJid || "").trim();
  const leftCanonical = String(left.canonicalRemoteJid || "").trim();
  const rightCanonical = String(right.canonicalRemoteJid || "").trim();
  const leftLid = String(left.lidRemoteJid || "").trim();
  const rightLid = String(right.lidRemoteJid || "").trim();

  if (leftRemote.endsWith("@lid") && rightRemote.endsWith("@s.whatsapp.net") && leftCanonical === rightRemote) return true;
  if (rightRemote.endsWith("@lid") && leftRemote.endsWith("@s.whatsapp.net") && rightCanonical === leftRemote) return true;
  if (leftLid && (leftLid === rightRemote || leftLid === rightCanonical)) return true;
  if (rightLid && (rightLid === leftRemote || rightLid === leftCanonical)) return true;

  return false;
}

function enrichDuplicateChatNameRow(conversa: ConversaAgrupada) {
  const { whatsappJid } = getConversationJidInfo(conversa);
  return {
    id: String(conversa.id || "").trim(),
    chatName: String(conversa.chatName || "").trim(),
    remoteJid: String(conversa.remoteJid || "").trim(),
    canonicalRemoteJid: String(conversa.canonicalRemoteJid || "").trim(),
    lidRemoteJid: String(conversa.lidRemoteJid || "").trim(),
    identityKey: getConversaIdentityKey(conversa),
    mergeKeys: buildConversaMergeKeys(conversa),
    phone: getContatoNumero(whatsappJid || conversa.canonicalRemoteJid || conversa.contactRemoteJid || conversa.remoteJid),
  };
}

function isLikelySameContactDuplicate(rows: ConversaAgrupada[]) {
  if (rows.length < 2) return false;
  const enriched = rows.map(enrichDuplicateChatNameRow);
  const mergeKeySets = enriched.map((row) => new Set(row.mergeKeys));
  for (let i = 0; i < enriched.length; i += 1) {
    for (let j = i + 1; j < enriched.length; j += 1) {
      const left = enriched[i];
      const right = enriched[j];
      const sharedMergeKey = left.mergeKeys.some((key) => mergeKeySets[j].has(key));
      if (sharedMergeKey) return true;
      const leftIsLid = left.remoteJid.endsWith("@lid") || Boolean(left.lidRemoteJid);
      const rightIsLid = right.remoteJid.endsWith("@lid") || Boolean(right.lidRemoteJid);
      const leftIsPhone = Boolean(left.phone) || left.remoteJid.endsWith("@s.whatsapp.net");
      const rightIsPhone = Boolean(right.phone) || right.remoteJid.endsWith("@s.whatsapp.net");
      if ((leftIsLid && rightIsPhone) || (rightIsLid && leftIsPhone)) return true;
    }
  }
  return false;
}

function getConversaIdentityKey(conversa: Pick<ConversaAgrupada, "remoteJid" | "canonicalRemoteJid" | "contactRemoteJid" | "lidRemoteJid" | "eventSenderJid" | "eventRemoteJidAlt" | "chatName" | "id">) {
  const jidCandidates = [
    conversa.remoteJid,
    conversa.canonicalRemoteJid,
    conversa.contactRemoteJid,
    conversa.lidRemoteJid,
    conversa.eventSenderJid,
    conversa.eventRemoteJidAlt,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const groupJid = jidCandidates.find((jid) => jid.includes("@g.us"));
  if (groupJid) return `group:${groupJid}`;

  const { whatsappJid, lidJid } = getConversationJidInfo(conversa);
  const phone = getContatoNumero(whatsappJid || conversa.canonicalRemoteJid || conversa.contactRemoteJid || conversa.remoteJid);
  if (phone) return `phone:${phone}`;

  if (lidJid) return `lid:${lidJid}`;

  const canonical = String(conversa.canonicalRemoteJid || conversa.contactRemoteJid || conversa.remoteJid || "").trim();
  if (canonical) return `jid:${canonical}`;

  const id = String(conversa.id || "").trim();
  if (id) return `id:${id}`;

  return `name:${String(conversa.chatName || "").trim().toLowerCase()}`;
}

function getConversaTimestampMs(conversa: ConversaAgrupada) {
  const fromSentAt = conversa.lastSentAt ? new Date(conversa.lastSentAt).getTime() : 0;
  const fromTimestamp = Number(conversa.lastTimestamp || 0) * 1000;
  const ts = Math.max(fromSentAt, fromTimestamp);
  return Number.isFinite(ts) && ts > 0 ? ts : 0;
}

function pickPreferredConversationJid(...candidates: Array<string | null | undefined>) {
  const values = candidates.map((value) => String(value || "").trim()).filter(Boolean);
  const groupJid = values.find((jid) => jid.includes("@g.us"));
  if (groupJid) return groupJid;
  return (
    values.find((jid) => jid.endsWith("@s.whatsapp.net")) ||
    values.find((jid) => jid.endsWith("@lid")) ||
    values[0] ||
    null
  );
}

function mergeConversaRows(left: ConversaAgrupada, right: ConversaAgrupada): ConversaAgrupada {
  const leftTs = getConversaTimestampMs(left);
  const rightTs = getConversaTimestampMs(right);
  const newest = rightTs > leftTs ? right : left;
  const oldest = newest === left ? right : left;

  const remoteJid = pickPreferredConversationJid(
    newest.remoteJid,
    oldest.remoteJid,
    newest.canonicalRemoteJid,
    oldest.canonicalRemoteJid,
    newest.contactRemoteJid,
    oldest.contactRemoteJid
  );
  const canonicalRemoteJid = pickPreferredConversationJid(
    newest.canonicalRemoteJid,
    oldest.canonicalRemoteJid,
    newest.remoteJid,
    oldest.remoteJid,
    newest.contactRemoteJid,
    oldest.contactRemoteJid
  );
  const contactRemoteJid = pickPreferredConversationJid(
    newest.contactRemoteJid,
    oldest.contactRemoteJid,
    canonicalRemoteJid,
    remoteJid
  );
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
    unreadCount: Math.max(Number(left.unreadCount || 0), Number(right.unreadCount || 0)),
    profilePicUrl: newest.profilePicUrl || oldest.profilePicUrl || null,
    totalMensagens: Math.max(Number(left.totalMensagens || 0), Number(right.totalMensagens || 0)),
    mensagens: newest.mensagens.length >= oldest.mensagens.length ? newest.mensagens : oldest.mensagens,
  };
}

function dedupeConversas(rows: ConversaAgrupada[]): ConversaAgrupada[] {
  if (rows.length <= 1) return rows;

  const byIdentity = new Map<string, ConversaAgrupada>();
  for (const row of rows) {
    const key = getConversaIdentityKey(row);
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? mergeConversaRows(existing, row) : row);
  }

  let current = Array.from(byIdentity.values());

  const byId = new Map<string, ConversaAgrupada>();
  for (const row of current) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    const existing = byId.get(id);
    byId.set(id, existing ? mergeConversaRows(existing, row) : row);
  }
  current = Array.from(byId.values());

  if (current.length <= 1) return current.sort((a, b) => getConversaTimestampMs(b) - getConversaTimestampMs(a));

  const parent = current.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) {
      parent[index] = find(parent[index]);
    }
    return parent[index];
  };
  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };

  for (let left = 0; left < current.length; left += 1) {
    for (let right = left + 1; right < current.length; right += 1) {
      if (shouldCrossLinkMergeConversas(current[left], current[right])) {
        union(left, right);
      }
    }
  }

  const groups = new Map<number, ConversaAgrupada>();
  current.forEach((row, index) => {
    const root = find(index);
    const existing = groups.get(root);
    groups.set(root, existing ? mergeConversaRows(existing, row) : row);
  });

  return Array.from(groups.values()).sort((a, b) => getConversaTimestampMs(b) - getConversaTimestampMs(a));
}

function normalizeConversaJids(conversa: ConversaAgrupada): ConversaAgrupada {
  const messageRemoteJid = String(conversa.remoteJid || conversa.id || "").trim();
  const apiRemoteJid = getConversationApiRemoteJid(conversa);
  const storageJid = messageRemoteJid || apiRemoteJid;
  if (!storageJid) return conversa;
  const groupJid = getConversationGroupRemoteJid(conversa);
  return {
    ...conversa,
    id: storageJid,
    remoteJid: storageJid,
    canonicalRemoteJid: groupJid || conversa.canonicalRemoteJid || apiRemoteJid || storageJid,
  };
}

function analyzeConversasDuplicates(conversas: ConversaAgrupada[]): ConversasDuplicateReport {
  const byId = new Map<string, ConversaAgrupada[]>();
  const byIdentity = new Map<string, ConversaAgrupada[]>();
  const byChatName = new Map<string, ConversaAgrupada[]>();

  for (const conversa of conversas) {
    const id = String(conversa.id || "").trim();
    if (id) {
      const bucket = byId.get(id) || [];
      bucket.push(conversa);
      byId.set(id, bucket);
    }

    const identityKey = getConversaIdentityKey(conversa);
    const identityBucket = byIdentity.get(identityKey) || [];
    identityBucket.push(conversa);
    byIdentity.set(identityKey, identityBucket);

    const chatName = String(conversa.chatName || "").trim().toLowerCase();
    if (chatName && !isPlaceholderChatName(chatName)) {
      const nameBucket = byChatName.get(chatName) || [];
      nameBucket.push(conversa);
      byChatName.set(chatName, nameBucket);
    }
  }

  const duplicateIds = Array.from(byId.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([id, rows]) => ({
      id,
      count: rows.length,
      remoteJids: rows.map((row) => String(row.remoteJid || "").trim()).filter(Boolean),
      chatNames: Array.from(new Set(rows.map((row) => String(row.chatName || "").trim()).filter(Boolean))),
    }));

  const duplicateIdentities = Array.from(byIdentity.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([identityKey, rows]) => ({
      identityKey,
      count: rows.length,
      rows: rows.map((row) => ({
        id: String(row.id || "").trim(),
        chatName: String(row.chatName || "").trim(),
        remoteJid: String(row.remoteJid || "").trim(),
        canonicalRemoteJid: String(row.canonicalRemoteJid || "").trim(),
      })),
    }));

  const duplicateChatNames = Array.from(byChatName.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([chatName, rows]) => ({
      chatName,
      count: rows.length,
      likelySameContact: isLikelySameContactDuplicate(rows),
      rows: rows.map(enrichDuplicateChatNameRow),
    }));

  return {
    total: conversas.length,
    duplicateIds,
    duplicateIdentities,
    duplicateChatNames,
  };
}

function getDisplayedSenderName(
  mensagem: MensagemRow,
  conversationName?: string | null
) {
  const remoteJid = mensagem.canonicalRemoteJid || mensagem.contactRemoteJid || mensagem.remoteJid || "";
  if (!isGroupConversationRemoteJid(remoteJid)) {
    const preferredConversationName = String(conversationName || "").trim();
    if (preferredConversationName && !isPlaceholderChatName(preferredConversationName)) {
      return preferredConversationName;
    }
    const receivedName = !mensagem.fromMe ? String(mensagem.senderName || mensagem.chatName || "").trim() : "";
    if (receivedName && !isPlaceholderChatName(receivedName)) {
      return receivedName;
    }
    return getContatoNumero(remoteJid) || "Sem nome";
  }

  const senderName = String(mensagem.senderName || "").trim();
  if (senderName && !isPlaceholderChatName(senderName)) return senderName;

  const chatName = String(mensagem.chatName || "").trim();
  if (chatName && !isPlaceholderChatName(chatName)) return chatName;

  return "Sem nome";
}

function ConversaUnreadBadge({ unreadCount }: { unreadCount: number }) {
  if (unreadCount <= 0) return null;

  return (
    <span
      className="badge mt-1 d-inline-flex align-items-center justify-content-center rounded-circle bg-danger text-white"
      style={{
        minWidth: "24px",
        height: "24px",
        fontSize: "0.74rem",
        transition: "opacity 0.28s ease, transform 0.28s ease",
      }}
      aria-label={`${unreadCount} mensagens não lidas`}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

const MensagensModal: React.FC<MensagensModalProps> = ({ show, onClose }) => {
  const [loading, setLoading] = React.useState(false);
  const [carregandoConversas, setCarregandoConversas] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [carregandoMaisConversas, setCarregandoMaisConversas] = React.useState(false);
  const [instanciasDisponiveis, setInstanciasDisponiveis] = React.useState<InstanciaAberta[]>([]);
  const [semPermissaoInstancias, setSemPermissaoInstancias] = React.useState(false);
  const [unreadCountsByInstance, setUnreadCountsByInstance] = React.useState<Record<string, number>>({});
  const [instanciaAtivaNome, setInstanciaAtivaNome] = React.useState<string | null>(null);
  const [modoVisualizacao, setModoVisualizacao] = React.useState<ModoVisualizacaoInstancia>("normal");
  const [instancia, setInstancia] = React.useState<InstanciaAberta | null>(null);
  const [conversas, setConversas] = React.useState<ConversaAgrupada[]>([]);
  const [conversasLimit, setConversasLimit] = React.useState(DEFAULT_MENSAGENS_LIMIT);
  const [mensagens, setMensagens] = React.useState<MensagemRow[]>([]);
  const [mensagensLimit, setMensagensLimit] = React.useState(DEFAULT_MENSAGENS_LIMIT);
  const [conversaSelecionadaId, setConversaSelecionadaId] = React.useState<string | null>(null);
  const [carregandoConversaId, setCarregandoConversaId] = React.useState<string | null>(null);
  const [carregandoConversaVisivel, setCarregandoConversaVisivel] = React.useState(false);
  const carregandoConversaTimeoutRef = React.useRef<number | null>(null);
  const [abaConversas, setAbaConversas] = React.useState<AbaConversas>("hoje");
  const [conversasVisiveisLimit, setConversasVisiveisLimit] = React.useState(MAX_CONVERSAS_VISIVEIS);
  const [lastConversasFetchCount, setLastConversasFetchCount] = React.useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const mensagensContainerRef = React.useRef<HTMLDivElement | null>(null);
  const conversaSelecionadaRef = React.useRef<ConversaAgrupada | null>(null);
  const [usuarioLogado, setUsuarioLogado] = React.useState<UsuarioLogado | null>(null);
  const [showUsuarioMenu, setShowUsuarioMenu] = React.useState(false);
  const usuarioMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [headerRoleOptions, setHeaderRoleOptions] = React.useState<string[]>(() => loadHeaderRoleOptions());
  const [headerRoleSelected, setHeaderRoleSelected] = React.useState<string>(() =>
    loadHeaderRoleSelected(loadHeaderRoleOptions())
  );

  const redirecionarParaLogin = React.useCallback(() => {
    try {
      localStorage.removeItem("usuarioLogado");
    } catch {
      void 0;
    }
    window.location.href = "/";
  }, []);

  const getMatriculaLogada = React.useCallback(() => {
    try {
      const raw = localStorage.getItem("usuarioLogado");
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { matricula?: unknown } | null;
      return String(parsed?.matricula || "").trim();
    } catch {
      return "";
    }
  }, []);

  // #region debug-point A:init-chat-stream-loading
  const DEBUG_CHAT_STREAM_URL = "/__dbg/event";
  const DEBUG_CHAT_STREAM_SESSION = "chat-stream-loading";
  const DEBUG_CHAT_STREAM_RUN = "pre-fix";
  const reportChatStreamDebug = React.useCallback(
    (hypothesisId: string, msg: string, data?: Record<string, unknown>, traceId?: string) => {
      try {
        fetch(DEBUG_CHAT_STREAM_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: DEBUG_CHAT_STREAM_SESSION,
            runId: DEBUG_CHAT_STREAM_RUN,
            hypothesisId,
            location: "MensagensModal.tsx",
            msg: `[DEBUG] ${msg}`,
            data: data && typeof data === "object" ? data : {},
            traceId,
            ts: Date.now(),
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        void 0;
      }
    },
    []
  );

  const logConversasDuplicateDetails = React.useCallback((report: ConversasDuplicateReport, source: string) => {
    if (report.duplicateIds.length) {
      console.groupCollapsed(`[ZapHub] IDs duplicados (${source})`);
      console.table(report.duplicateIds);
      for (const group of report.duplicateIds) {
        console.log(`id=${group.id}`, group);
      }
      console.groupEnd();
    }
    if (report.duplicateIdentities.length) {
      console.groupCollapsed(`[ZapHub] Identidades duplicadas (${source})`);
      console.table(
        report.duplicateIdentities.flatMap((group) =>
          group.rows.map((row) => ({
            identityKey: group.identityKey,
            id: row.id,
            chatName: row.chatName,
            remoteJid: row.remoteJid,
            canonicalRemoteJid: row.canonicalRemoteJid,
          }))
        )
      );
      console.groupEnd();
    }
  }, []);

  const reportConversasDuplicates = React.useCallback(
    (rows: ConversaAgrupada[], source: string, opts?: { dedupedCount?: number }) => {
      const report = analyzeConversasDuplicates(rows);
      const hasCriticalDuplicates = report.duplicateIds.length > 0 || report.duplicateIdentities.length > 0;
      const suspiciousNameDuplicates = report.duplicateChatNames.filter((group) => group.likelySameContact);
      const homonymNameDuplicates = report.duplicateChatNames.filter((group) => !group.likelySameContact);
      const isBeforeDedupe = source.includes("before-dedupe");
      const removedCount =
        opts?.dedupedCount != null && opts.dedupedCount >= 0 ? Math.max(0, report.total - opts.dedupedCount) : null;

      if (!hasCriticalDuplicates && report.duplicateChatNames.length === 0) return report;
      if (source === "state-conversas" && !hasCriticalDuplicates) return report;

      const summary = {
        source,
        total: report.total,
        dedupedCount: opts?.dedupedCount ?? null,
        removedCount,
        duplicateIdCount: report.duplicateIds.length,
        duplicateIdentityCount: report.duplicateIdentities.length,
        duplicateChatNameCount: report.duplicateChatNames.length,
        suspiciousSameContactNameCount: suspiciousNameDuplicates.length,
        homonymNameCount: homonymNameDuplicates.length,
      };

      if (hasCriticalDuplicates) {
        if (isBeforeDedupe && removedCount != null && removedCount > 0) {
          console.info(
            `[ZapHub Conversas] API retornou duplicatas — dedupe corrigiu ${removedCount} (${report.total} → ${opts?.dedupedCount})`,
            summary
          );
          logConversasDuplicateDetails(report, source);
        } else {
          console.warn("[ZapHub Conversas] duplicatas críticas (id/identidade)", summary);
          logConversasDuplicateDetails(report, source);
        }
      } else if (suspiciousNameDuplicates.length > 0) {
        console.warn("[ZapHub Conversas] possível mesmo contato com nomes iguais", summary);
        for (const group of suspiciousNameDuplicates) {
          console.groupCollapsed(`[ZapHub] "${group.chatName}" — ${group.count} entradas (provável split LID/telefone)`);
          console.table(group.rows);
          console.groupEnd();
        }
      } else if (homonymNameDuplicates.length > 0) {
        console.info("[ZapHub Conversas] homônimos (mesmo nome, contatos distintos)", summary);
        for (const group of homonymNameDuplicates) {
          console.groupCollapsed(`[ZapHub] "${group.chatName}" — ${group.count} contatos distintos`);
          console.table(group.rows);
          console.groupEnd();
        }
      }

      if (hasCriticalDuplicates || suspiciousNameDuplicates.length > 0) {
        reportChatStreamDebug("F", "conversas duplicates detected", {
          ...summary,
          duplicateIds: report.duplicateIds.slice(0, 8),
          duplicateIdentities: report.duplicateIdentities.slice(0, 8),
          duplicateChatNames: report.duplicateChatNames.slice(0, 8),
        });
      }
      return report;
    },
    [logConversasDuplicateDetails, reportChatStreamDebug]
  );
  // #endregion

  const instanciasClassificadas = React.useMemo(() => {
    const televendasPrincipal: InstanciaAberta[] = [];
    const outrasInstancias: InstanciaAberta[] = [];
    for (const item of instanciasDisponiveis) {
      if (item?.isTelevendasPrincipal) {
        televendasPrincipal.push(item);
        continue;
      }
      outrasInstancias.push(item);
    }
    return { televendasPrincipal, meuNumero: [] as InstanciaAberta[], outrasInstancias };
  }, [instanciasDisponiveis]);

  const instanciaAtivaMeta = React.useMemo(() => {
    if (!instanciaAtivaNome) return null;
    return instanciasDisponiveis.find((row) => row.instanceName === instanciaAtivaNome) || null;
  }, [instanciaAtivaNome, instanciasDisponiveis]);

  const instanciaAtivaEhTelevendas = Boolean(instanciaAtivaMeta?.isTelevendasPrincipal);
  const instanciaAtivaEhPuxadas = modoVisualizacao === "puxadas";
  const instanciaAtivaEhEncerradas = modoVisualizacao === "encerradas";
  const instanciaAtivaEhAtendimento = instanciaAtivaEhPuxadas || instanciaAtivaEhEncerradas;
  const bloquearEnvioPrincipal = instanciaAtivaEhTelevendas && modoVisualizacao === "normal";
  const somenteLeituraEncerradas = instanciaAtivaEhEncerradas;
  const televendasPrincipalInstancia = instanciasClassificadas.televendasPrincipal[0] || null;
  const usuarioTemTelevendasPrincipal = Boolean(televendasPrincipalInstancia);
  const latestMessagesStreamRef = React.useRef<string | null>(null);
  const lastMessagesSnapshotSigRef = React.useRef<Record<string, string>>({});
  const pendingMessagesSnapshotRef = React.useRef<unknown | null>(null);
  const pendingMessagesSnapshotRafRef = React.useRef<number | null>(null);
  const conversasStreamRefreshTimeoutRef = React.useRef<number | null>(null);
  const conversasStreamNextAllowedAtRef = React.useRef(0);
  const messagesCacheRef = React.useRef<Record<string, MensagensCacheSnapshot>>({});
  const conversationMessagesCacheRef = React.useRef<Record<string, MensagemRow[]>>({});
  const pendingMarkReadRef = React.useRef<Map<string, number>>(new Map());
  const marcarLidaInflightRef = React.useRef<Set<string>>(new Set());
  const mensagensRef = React.useRef<MensagemRow[]>([]);
  const mensagensLimitRef = React.useRef(DEFAULT_MENSAGENS_LIMIT);
  const instanciaRef = React.useRef<InstanciaAberta | null>(null);
  const marcarConversaComoLidaRef = React.useRef<((conversa: ConversaAgrupada, rows?: MensagemRow[]) => Promise<void>) | null>(null);
  const finalizarLeituraConversaAbertaRef = React.useRef<(() => Promise<void>) | null>(null);
  const conversaAbertaNaoLidaIdRef = React.useRef<string | null>(null);
  const conversasRef = React.useRef<ConversaAgrupada[]>([]);
  const abaConversasRef = React.useRef<AbaConversas>(abaConversas);
  const abaConversasAnteriorRef = React.useRef<AbaConversas>(abaConversas);
  const conversasLoadSeqRef = React.useRef(0);
  const isMessagesNearBottomRef = React.useRef(true);
  const shouldAutoScrollRef = React.useRef(false);

  const onMensagensScroll = React.useCallback(() => {
    const container = mensagensContainerRef.current;
    if (!container) return;
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    isMessagesNearBottomRef.current = remaining < 80;
  }, []);

  React.useEffect(() => {
    mensagensLimitRef.current = mensagensLimit;
  }, [mensagensLimit]);

  React.useEffect(() => {
    mensagensRef.current = mensagens;
  }, [mensagens]);

  React.useEffect(() => {
    instanciaRef.current = instancia;
  }, [instancia]);

  React.useEffect(() => {
    conversasRef.current = conversas;
  }, [conversas]);

  React.useEffect(() => {
    abaConversasRef.current = abaConversas;
  }, [abaConversas]);

  React.useEffect(() => {
    modoVisualizacaoRef.current = modoVisualizacao;
  }, [modoVisualizacao]);

  React.useEffect(() => {
    if (!conversaSelecionadaId) {
      setCarregandoConversaId(null);
      setCarregandoConversaVisivel(false);
    }
  }, [conversaSelecionadaId]);

  React.useEffect(() => {
    if (carregandoConversaTimeoutRef.current != null) {
      window.clearTimeout(carregandoConversaTimeoutRef.current);
      carregandoConversaTimeoutRef.current = null;
    }
    if (!carregandoConversaId) {
      setCarregandoConversaVisivel(false);
      return undefined;
    }
    carregandoConversaTimeoutRef.current = window.setTimeout(() => {
      setCarregandoConversaVisivel(true);
    }, 420);
    return () => {
      if (carregandoConversaTimeoutRef.current != null) {
        window.clearTimeout(carregandoConversaTimeoutRef.current);
        carregandoConversaTimeoutRef.current = null;
      }
    };
  }, [carregandoConversaId]);

  React.useEffect(() => {
    // #region debug-point E:loading-state-change
    reportChatStreamDebug("E", "loading state changed", {
      conversaSelecionadaId,
      carregandoConversaId,
    });
    // #endregion
  }, [carregandoConversaId, conversaSelecionadaId, reportChatStreamDebug]);

  const getMessagesCacheKey = React.useCallback((instanceKey: string, limit: number) => {
    return `${normalizeInstanceKey(instanceKey)}::${Math.max(1, Number(limit) || DEFAULT_MENSAGENS_LIMIT)}`;
  }, []);
  const [loadedMediaByMessageId, setLoadedMediaByMessageId] = React.useState<Record<string, LoadedMediaAsset>>({});
  const [loadingMediaByMessageId, setLoadingMediaByMessageId] = React.useState<Record<string, boolean>>({});
  const [mediaLoadErrorByMessageId, setMediaLoadErrorByMessageId] = React.useState<Record<string, string | null>>({});
  const audioPlayerRef = React.useRef<HTMLAudioElement | null>(null);
  const audioPlayerMessageIdRef = React.useRef<string | null>(null);
  const audioDetachListenersRef = React.useRef<(() => void) | null>(null);
  const audioProgressRafRef = React.useRef<number | null>(null);
  const [audioSelectedMessageId, setAudioSelectedMessageId] = React.useState<string | null>(null);
  const [audioPlayingMessageId, setAudioPlayingMessageId] = React.useState<string | null>(null);
  const [audioIsPlaying, setAudioIsPlaying] = React.useState(false);
  const [audioPlaybackRate, setAudioPlaybackRate] = React.useState(1);
  const [audioCurrentTimeSec, setAudioCurrentTimeSec] = React.useState(0);
  const [audioDurationSec, setAudioDurationSec] = React.useState(0);
  const [textoEnvio, setTextoEnvio] = React.useState("");
  const [anexosEnvio, setAnexosEnvio] = React.useState<AnexoEnvio[]>([]);
  const [enviandoMensagem, setEnviandoMensagem] = React.useState(false);
  const [puxandoMensagemId, setPuxandoMensagemId] = React.useState<string | null>(null);
  const [puxandoParaMinhasPuxadas, setPuxandoParaMinhasPuxadas] = React.useState(false);
  const [encerrandoConversa, setEncerrandoConversa] = React.useState(false);
  const [mostrarModalEncerrarConversa, setMostrarModalEncerrarConversa] = React.useState(false);
  const [erroEncerrarConversa, setErroEncerrarConversa] = React.useState<string | null>(null);
  const [mostrarModalIniciarConversa, setMostrarModalIniciarConversa] = React.useState(false);
  const [modalIniciarConversaModo, setModalIniciarConversaModo] = React.useState<ModalIniciarConversaModo>("iniciar");
  const [iniciandoConversa, setIniciandoConversa] = React.useState(false);
  const [erroIniciarConversa, setErroIniciarConversa] = React.useState<string | null>(null);
  const [conversasPuxadasCount, setConversasPuxadasCount] = React.useState(0);
  const [conversasEncerradasCount, setConversasEncerradasCount] = React.useState(0);
  const [conversasEscopoModo, setConversasEscopoModo] = React.useState<ConversasEscopoModo | null>(null);
  const conversasEscopoModoRef = React.useRef<ConversasEscopoModo | null>(null);
  const modoVisualizacaoRef = React.useRef<ModoVisualizacaoInstancia>(modoVisualizacao);
  const [gravandoAudio, setGravandoAudio] = React.useState(false);
  const anexosInputRef = React.useRef<HTMLInputElement | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<BlobPart[]>([]);
  const [menuMensagemAbertoId, setMenuMensagemAbertoId] = React.useState<string | null>(null);
  const menuMensagemRef = React.useRef<HTMLDivElement | null>(null);
  const menuMensagemButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [mensagemEmEdicao, setMensagemEmEdicao] = React.useState<MensagemRow | null>(null);
  const [textoEdicaoMensagem, setTextoEdicaoMensagem] = React.useState("");
  const [infoEdicaoMensagem, setInfoEdicaoMensagem] = React.useState<string | null>(null);
  const [erroEdicaoMensagem, setErroEdicaoMensagem] = React.useState<string | null>(null);
  const [salvandoEdicaoMensagem, setSalvandoEdicaoMensagem] = React.useState(false);
  const [aguardandoConfirmacaoEdicao, setAguardandoConfirmacaoEdicao] = React.useState(false);
  const [mensagemEmExclusao, setMensagemEmExclusao] = React.useState<MensagemRow | null>(null);
  const [infoExclusaoMensagem, setInfoExclusaoMensagem] = React.useState<string | null>(null);
  const [erroExclusaoMensagem, setErroExclusaoMensagem] = React.useState<string | null>(null);
  const [excluindoMensagem, setExcluindoMensagem] = React.useState(false);

  React.useEffect(() => {
    if (!menuMensagemAbertoId) return undefined;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuMensagemRef.current && menuMensagemRef.current.contains(target)) return;
      if (menuMensagemButtonRef.current && menuMensagemButtonRef.current.contains(target)) return;
      setMenuMensagemAbertoId(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuMensagemAbertoId(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const rafId = window.requestAnimationFrame(() => {
      menuMensagemRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuMensagemAbertoId]);

  const getBaseApi = React.useCallback(() => {
    const env = import.meta.env.VITE_API_URL || "";
    const trimmed = typeof env === "string" ? env.replace(/\/$/, "") : "";
    return trimmed ? (trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`) : "/api";
  }, []);

  const normalizeDateValue = React.useCallback((value?: string | null) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const normalized = raw.replace(
      /\.(\d{3})\d+([+-]\d{2}:\d{2}|Z)$/,
      ".$1$2"
    );

    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;

    const fallback = new Date(raw);
    if (!Number.isNaN(fallback.getTime())) return fallback;

    return null;
  }, []);

  const formatDateTime = React.useCallback((value?: string | null) => {
    const date = normalizeDateValue(value);
    if (!date) return "-";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [normalizeDateValue]);

  const formatHour = React.useCallback((value?: string | null) => {
    const date = normalizeDateValue(value);
    if (!date) return "-";
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [normalizeDateValue]);

  const syncAudioUiFromElement = React.useCallback((audio: HTMLAudioElement | null, messageId?: string | null) => {
    if (!audio || !messageId) return;
    setAudioSelectedMessageId(messageId);
    setAudioCurrentTimeSec(Number(audio.currentTime) || 0);
    setAudioDurationSec(Number(audio.duration) || 0);
    setAudioIsPlaying(!audio.paused && !audio.ended);
    if (!audio.paused && !audio.ended) {
      setAudioPlayingMessageId(messageId);
      return;
    }
    setAudioPlayingMessageId((prev) => (prev === messageId ? null : prev));
  }, []);

  const stopAudioProgressRaf = React.useCallback(() => {
    if (audioProgressRafRef.current) {
      window.cancelAnimationFrame(audioProgressRafRef.current);
      audioProgressRafRef.current = null;
    }
  }, []);

  const startAudioProgressRaf = React.useCallback((audio: HTMLAudioElement, messageId: string) => {
    stopAudioProgressRaf();
    const tick = () => {
      syncAudioUiFromElement(audio, messageId);
      if (!audio.paused && !audio.ended) {
        audioProgressRafRef.current = window.requestAnimationFrame(tick);
      } else {
        audioProgressRafRef.current = null;
      }
    };
    audioProgressRafRef.current = window.requestAnimationFrame(tick);
  }, [stopAudioProgressRaf, syncAudioUiFromElement]);

  const detachAudioListeners = React.useCallback(() => {
    if (audioDetachListenersRef.current) {
      audioDetachListenersRef.current();
      audioDetachListenersRef.current = null;
    }
    stopAudioProgressRaf();
  }, [stopAudioProgressRaf]);

  const bindAudioListeners = React.useCallback((audio: HTMLAudioElement, messageId: string) => {
    detachAudioListeners();

    const sync = () => syncAudioUiFromElement(audio, messageId);
    const onPlay = () => {
      sync();
      startAudioProgressRaf(audio, messageId);
    };
    const onPause = () => {
      sync();
      stopAudioProgressRaf();
    };
    const onEnded = () => {
      stopAudioProgressRaf();
      setAudioIsPlaying(false);
      setAudioPlayingMessageId(null);
      setAudioCurrentTimeSec(0);
      setAudioDurationSec(Number(audio.duration) || 0);
      setAudioSelectedMessageId(messageId);
    };
    const onError = () => {
      stopAudioProgressRaf();
      setAudioIsPlaying(false);
      setAudioPlayingMessageId(null);
      setAudioSelectedMessageId(null);
      setAudioCurrentTimeSec(0);
      setAudioDurationSec(0);
    };

    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("durationchange", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("seeking", sync);
    audio.addEventListener("seeked", sync);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    audioDetachListenersRef.current = () => {
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("durationchange", sync);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("seeking", sync);
      audio.removeEventListener("seeked", sync);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };

    sync();
  }, [detachAudioListeners, startAudioProgressRaf, stopAudioProgressRaf, syncAudioUiFromElement]);

  const toggleAudioPlayback = React.useCallback((messageId: string, src: string, forcePlay = false) => {
    const safeSrc = String(src || "").trim();
    if (!safeSrc) return;

    const current = audioPlayerRef.current;
    const currentId = audioPlayerMessageIdRef.current;
    if (current && currentId && currentId !== messageId) {
      try {
        current.pause();
      } catch {
        void 0;
      }
    }

    const ensureAudio = () => {
      if (audioPlayerRef.current && audioPlayerMessageIdRef.current === messageId) {
        try {
          audioPlayerRef.current.playbackRate = audioPlaybackRate;
        } catch {
          void 0;
        }
        syncAudioUiFromElement(audioPlayerRef.current, messageId);
        return audioPlayerRef.current;
      }
      const next = new Audio(safeSrc);
      next.preload = "metadata";
      next.playbackRate = audioPlaybackRate;
      bindAudioListeners(next, messageId);
      audioPlayerRef.current = next;
      audioPlayerMessageIdRef.current = messageId;
      return next;
    };

    const audio = ensureAudio();
    if (forcePlay) {
      audio.play().catch(() => {});
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [audioPlaybackRate, bindAudioListeners, syncAudioUiFromElement]);

  const getMensagemTextoEditavel = React.useCallback((mensagem: MensagemRow) => {
    const mediaKind = normalizeMediaKind(mensagem.media?.kind || mensagem.messageType);
    if (mediaKind === "image" || mediaKind === "video") {
      return String(mensagem.media?.caption || mensagem.preview || "").trim();
    }
    return String(mensagem.preview || "").trim();
  }, []);

  const getMensagemTextoEditavelSemCabecalho = React.useCallback(
    (mensagem: MensagemRow) => extractUserTextFromMessage(getMensagemTextoEditavel(mensagem), headerRoleOptions),
    [getMensagemTextoEditavel, headerRoleOptions]
  );

  const getPermissaoEdicaoMensagem = React.useCallback((mensagem: MensagemRow) => {
    if (!mensagem.fromMe) {
      return { allowed: false, reason: "Apenas mensagens enviadas por você podem ser editadas." };
    }
    if (!mensagem.messageKeyId) {
      return { allowed: false, reason: "Esta mensagem ainda não possui chave para edição." };
    }
    if (String(mensagem.status || "").toUpperCase() === "DELETED") {
      return { allowed: false, reason: "Mensagens apagadas não podem ser editadas." };
    }
    if (String(mensagem.status || "").toUpperCase() === "ERROR") {
      return { allowed: false, reason: "Mensagens com falha não podem ser editadas." };
    }

    const messageType = String(mensagem.messageType || "").trim().toLowerCase();
    const previewNormalized = String(mensagem.preview || "").trim().toLowerCase();
    if (messageType.includes("secretencryptedmessage") || previewNormalized === "[secretencryptedmessage]") {
      return { allowed: false, reason: "Esta mensagem está criptografada (secretEncryptedMessage) e não é compatível com edição." };
    }

    const mediaKind = normalizeMediaKind(mensagem.media?.kind || mensagem.messageType);
    const tipoCompativel = messageType === "conversation" || messageType === "extendedtextmessage" || mediaKind === "image" || mediaKind === "video";
    if (!tipoCompativel) {
      return { allowed: false, reason: "A edição está disponível apenas para texto, imagem com legenda e vídeo com legenda." };
    }

    const date = normalizeDateValue(mensagem.sentAt);
    if (date) {
      const maxAgeMs = 15 * 60 * 1000;
      if (Date.now() - date.getTime() > maxAgeMs) {
        return { allowed: false, reason: "O WhatsApp permite editar apenas mensagens recentes." };
      }
    }

    if (!getMensagemTextoEditavelSemCabecalho(mensagem)) {
      return { allowed: false, reason: "Não há texto disponível para editar nesta mensagem." };
    }

    return { allowed: true, reason: null as string | null };
  }, [getMensagemTextoEditavelSemCabecalho, normalizeDateValue]);

  const getPermissaoExclusaoMensagem = React.useCallback((mensagem: MensagemRow) => {
    if (!mensagem.fromMe) {
      return { allowed: false, reason: "Apenas mensagens enviadas por você podem ser excluídas." };
    }
    if (!mensagem.messageKeyId) {
      return { allowed: false, reason: "Esta mensagem ainda não possui chave para exclusão." };
    }
    if (isMensagemApagada(mensagem)) {
      return { allowed: false, reason: "Esta mensagem já está apagada." };
    }
    const statusUpper = String(mensagem.status || "").trim().toUpperCase();
    if (statusUpper === "PENDING") {
      return { allowed: false, reason: "Aguarde o envio ser confirmado antes de excluir." };
    }
    if (statusUpper === "ERROR") {
      return { allowed: false, reason: "Mensagens com falha não podem ser excluídas." };
    }
    if (isSecretEncryptedMessageType(mensagem.messageType)) {
      return { allowed: false, reason: "Mensagens criptografadas não podem ser excluídas por aqui." };
    }

    const date = normalizeDateValue(mensagem.sentAt);
    const tsMs = date ? date.getTime() : Number(mensagem.timestamp || 0) * 1000;
    const windowMs = 2 * 24 * 60 * 60 * 1000;
    if (tsMs > 0 && Date.now() - tsMs > windowMs) {
      return { allowed: false, reason: "Esta mensagem ultrapassou o limite do WhatsApp para exclusão." };
    }

    return { allowed: true, reason: null as string | null };
  }, [normalizeDateValue]);

  const localizarMensagemParaEdicao = React.useCallback((rows: MensagemRow[], mensagemBase: MensagemRow) => {
    const remoteTarget = String(
      mensagemBase.canonicalRemoteJid || mensagemBase.contactRemoteJid || mensagemBase.remoteJid || ""
    ).trim();
    const previewTarget = String(mensagemBase.preview || "").trim();
    const sentAtTarget = normalizeDateValue(mensagemBase.sentAt)?.getTime() || 0;

    return rows.find((row) => {
      if (!row.fromMe) return false;
      const rowRemote = String(row.canonicalRemoteJid || row.contactRemoteJid || row.remoteJid || "").trim();
      if (remoteTarget && rowRemote && rowRemote !== remoteTarget) return false;
      const rowPreview = String(row.preview || "").trim();
      if (previewTarget && rowPreview !== previewTarget) return false;
      if (mensagemBase.messageKeyId && row.messageKeyId && row.messageKeyId === mensagemBase.messageKeyId) return true;
      const rowTs = normalizeDateValue(row.sentAt)?.getTime() || 0;
      if (sentAtTarget && rowTs && Math.abs(rowTs - sentAtTarget) > 2 * 60 * 1000) return false;
      return true;
    }) || null;
  }, [normalizeDateValue]);

  const carregarInstanciasDisponiveis = React.useCallback(async () => {
    const matricula = getMatriculaLogada();
    if (!matricula) {
      setInstanciasDisponiveis([]);
      setSemPermissaoInstancias(false);
      setUnreadCountsByInstance({});
      setInstanciaAtivaNome(null);
      setError("Usuário sem matrícula (não é possível validar permissões).");
      onClose();
      redirecionarParaLogin();
      return [];
    }
    const url = `${getBaseApi()}/zaphub/instancias/permitidas?matricula=${encodeURIComponent(matricula)}`;
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.toLowerCase().includes("application/json");
    const payload: unknown = isJson ? await response.json() : { message: await response.text() };

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "Falha ao carregar instâncias";
      throw new Error(message);
    }

    const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
    const rows = Array.isArray(rowsRaw) ? (rowsRaw as InstanciaAberta[]) : [];
    const hasRules =
      payload && typeof payload === "object" && "hasRules" in payload ? Boolean((payload as { hasRules?: unknown }).hasRules) : true;
    setInstanciasDisponiveis(rows);
    setSemPermissaoInstancias(hasRules && rows.length === 0);
    setUnreadCountsByInstance((prev) => seedUnreadCountsFromInstances(prev, rows));
    setInstanciaAtivaNome((prev) => {
      if (prev && rows.some((row) => row.instanceName === prev)) return prev;
      return null;
    });
    setError(null);
    return rows;
  }, [getBaseApi, getMatriculaLogada, onClose, redirecionarParaLogin]);

  React.useEffect(() => {
    if (instanciaAtivaNome) return;
    setConversas([]);
    setConversasLimit(DEFAULT_MENSAGENS_LIMIT);
    setLastConversasFetchCount(null);
    setConversaSelecionadaId(null);
    setMensagens([]);
    setMensagensLimit(DEFAULT_MENSAGENS_LIMIT);
    setInstancia(null);
    setLastSyncAt(null);
  }, [instanciaAtivaNome]);

  const carregarBadgesPuxadas = React.useCallback(
    async (opts?: { instanceName?: string | null; instanceId?: string | null }) => {
      const item = televendasPrincipalInstancia;
      if (!item) {
        setConversasPuxadasCount(0);
        setConversasEncerradasCount(0);
        return;
      }

      const instanceName = String(opts?.instanceName || item.instanceName || "").trim();
      const instanceIdRaw = String(opts?.instanceId || item.id || "").trim();
      const instanceId = isUuid(instanceIdRaw) ? instanceIdRaw : null;
      if (!instanceName && !instanceId) return;

      const queryInstanceId = instanceId ? `&instanceId=${encodeURIComponent(instanceId)}` : "";
      const queryInstanceName = instanceId ? "" : `&instanceName=${encodeURIComponent(instanceName)}`;

      try {
        const response = await fetch(
          `${getBaseApi()}/zaphub/mensagens/puxadas/badges?matricula=${encodeURIComponent(getMatriculaLogada())}${queryInstanceName}${queryInstanceId}`,
          {
            cache: "no-store",
            headers: {
              "cache-control": "no-cache",
              pragma: "no-cache",
            },
          }
        );
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : null;
        if (!response.ok || !payload || typeof payload !== "object") return;

        setConversasPuxadasCount(Math.max(0, Number((payload as { puxadasCount?: unknown }).puxadasCount) || 0));
        setConversasEncerradasCount(Math.max(0, Number((payload as { encerradasCount?: unknown }).encerradasCount) || 0));
      } catch {
        void 0;
      }
    },
    [getBaseApi, getMatriculaLogada, televendasPrincipalInstancia]
  );

  const carregarConversas = React.useCallback(
    async (opts?: {
      limit?: number;
      instanceName?: string | null;
      instanceId?: string | null;
      silent?: boolean;
      modoPuxadas?: boolean;
      encerradas?: boolean;
      modoVisualizacao?: ModoVisualizacaoInstancia;
    }) => {
      const modoAtual = opts?.modoVisualizacao ?? modoVisualizacaoRef.current ?? modoVisualizacao;
      const modoListaPuxadas = opts?.modoPuxadas ?? (modoAtual === "puxadas" || modoAtual === "encerradas");
      const somenteEncerradas = Boolean(opts?.encerradas ?? modoAtual === "encerradas");
      const requestedInstanceName = String(opts?.instanceName || instanciaAtivaNome || "").trim();
      const requestedInstanceIdRaw = String(opts?.instanceId || "").trim();
      const requestedInstanceId = isUuid(requestedInstanceIdRaw) ? requestedInstanceIdRaw : null;
      const requestedLimitRaw = Number(opts?.limit || conversasLimit || DEFAULT_MENSAGENS_LIMIT) || DEFAULT_MENSAGENS_LIMIT;
      const requestedLimit = Math.max(1, Math.min(120, requestedLimitRaw));
      const silent = opts?.silent === true;
      let loadSeq: number | null = null;

      if (!requestedInstanceId && !requestedInstanceName) {
        setConversas([]);
        setLastConversasFetchCount(null);
        setInstancia(null);
        setLastSyncAt(null);
        return [];
      }

      if (!silent) {
        loadSeq = ++conversasLoadSeqRef.current;
        setCarregandoConversas(true);
        setError(null);
      }
      try {
        const queryInstanceId = requestedInstanceId ? `&instanceId=${encodeURIComponent(requestedInstanceId)}` : "";
        const queryInstanceName = requestedInstanceId ? "" : `&instanceName=${encodeURIComponent(requestedInstanceName)}`;
        const excludePulled =
          !modoListaPuxadas &&
          Boolean(televendasPrincipalInstancia) &&
          normalizeInstanceKey(requestedInstanceName) === normalizeInstanceKey(televendasPrincipalInstancia.instanceName);
        const excludePulledQuery = excludePulled ? "&excludePulled=true" : "";
        const encerradasQuery = somenteEncerradas ? "&encerradas=true" : "";
        const endpoint = modoListaPuxadas ? "mensagens/puxadas/conversas" : "conversas";
        const response = await fetch(
          `${getBaseApi()}/zaphub/${endpoint}?limit=${encodeURIComponent(String(requestedLimit))}${queryInstanceName}${queryInstanceId}${excludePulledQuery}${encerradasQuery}&matricula=${encodeURIComponent(getMatriculaLogada())}`,
          {
            cache: "no-store",
            headers: {
              "cache-control": "no-cache",
              pragma: "no-cache",
            },
          }
        );
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao carregar conversas";
          throw new Error(message);
        }

        const nextInstancia =
          payload && typeof payload === "object" && "instance" in payload
            ? (payload as { instance?: InstanciaAberta }).instance || null
            : null;
        const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
        const rows = Array.isArray(rowsRaw) ? (rowsRaw as Partial<ConversaAgrupada>[]) : [];
        const mapped = rows
          .map((row) => {
            const id = String(row?.remoteJid || row?.id || "").trim();
            const chatName = String(row?.chatName || "").trim();
            if (!id || !chatName) return null;
            return {
              id,
              chatName,
              remoteJid: row?.remoteJid || null,
              canonicalRemoteJid: row?.canonicalRemoteJid || row?.contactRemoteJid || row?.remoteJid || null,
              contactRemoteJid: row?.contactRemoteJid || row?.canonicalRemoteJid || row?.remoteJid || null,
              lidRemoteJid: row?.lidRemoteJid || null,
              eventSenderJid: row?.eventSenderJid || null,
              eventRemoteJidAlt: row?.eventRemoteJidAlt || null,
              unreadCount: Math.max(0, Number(row?.unreadCount) || 0),
              profilePicUrl: row?.profilePicUrl || null,
              lastMessage: String(row?.lastMessage || "").trim(),
              lastMessageType: row?.lastMessageType || null,
              lastMessageFromMe: Boolean(row?.lastMessageFromMe),
              lastMessageDeleted: Boolean(row?.lastMessageDeleted),
              lastSentAt: row?.lastSentAt || null,
              lastTimestamp: row?.lastTimestamp != null ? Number(row.lastTimestamp) || null : null,
              totalMensagens: 0,
              mensagens: [],
            } satisfies ConversaAgrupada;
          })
          .filter(Boolean) as ConversaAgrupada[];

        const deduped = dedupeConversas(mapped).map(normalizeConversaJids);

        const escopoDesatualizado =
          modoListaPuxadas &&
          ((modoAtual === "encerradas" && !somenteEncerradas) || (modoAtual === "puxadas" && somenteEncerradas));
        const loadDesatualizado = !silent && loadSeq !== conversasLoadSeqRef.current;

        const reabertasCount =
          payload && typeof payload === "object" && "reabertasCount" in payload
            ? Math.max(0, Number((payload as { reabertasCount?: unknown }).reabertasCount) || 0)
            : 0;

        if (!escopoDesatualizado && !loadDesatualizado) {
          const applyConversas = () => {
            setInstancia(nextInstancia);
            const proximoEscopo: ConversasEscopoModo | null = modoListaPuxadas
              ? somenteEncerradas
                ? "encerradas"
                : "puxadas"
              : "normal";
            conversasEscopoModoRef.current = proximoEscopo;
            setConversasEscopoModo(proximoEscopo);
            setConversas((prev) => (silent && modoListaPuxadas ? deduped : silent ? mergeConversasForSync(prev, deduped) : deduped));
            setConversasLimit(requestedLimit);
            setLastConversasFetchCount(deduped.length);
            setLastSyncAt(new Date().toISOString());
          };
          if (silent) {
            React.startTransition(applyConversas);
          } else {
            applyConversas();
          }
          if (deduped.length !== mapped.length) {
            reportConversasDuplicates(mapped, "carregarConversas:before-dedupe", { dedupedCount: deduped.length });
          }
          reportConversasDuplicates(deduped, "carregarConversas:after-dedupe");
          if (!silent && reabertasCount > 0 && modoAtual === "encerradas") {
            setModoVisualizacao("normal");
            setAbaConversas("hoje");
            void carregarConversas({
              instanceName: requestedInstanceName,
              instanceId: requestedInstanceId,
              limit: requestedLimit,
              modoVisualizacao: "normal",
            }).catch(() => {});
          }
        }

        return deduped;
      } catch (err) {
        if (!silent && loadSeq === conversasLoadSeqRef.current) {
          setConversas([]);
          setLastConversasFetchCount(null);
          setError(err instanceof Error ? err.message : "Erro ao carregar conversas");
        }
        return [];
      } finally {
        if (!silent && loadSeq === conversasLoadSeqRef.current) {
          setCarregandoConversas(false);
        }
      }
    },
    [conversasLimit, getBaseApi, getMatriculaLogada, instanciaAtivaNome, modoVisualizacao, reportConversasDuplicates, televendasPrincipalInstancia]
  );

  const carregarMensagensConversa = React.useCallback(
    async (conversa: ConversaAgrupada, opts?: { limit?: number; silent?: boolean; modoPuxadas?: boolean; encerradas?: boolean; modoVisualizacao?: ModoVisualizacaoInstancia }) => {
      const modoAtual = opts?.modoVisualizacao ?? modoVisualizacaoRef.current ?? modoVisualizacao;
      const modoListaPuxadas = opts?.modoPuxadas ?? (modoAtual === "puxadas" || modoAtual === "encerradas");
      const somenteEncerradas = Boolean(opts?.encerradas ?? modoAtual === "encerradas");
      const remoteJidCandidates = getConversationMessageRemoteJidCandidates(conversa);
      if (!remoteJidCandidates.length) {
        setMensagens([]);
        return [];
      }

      const rawInstanceId = String(instanciaAtivaMeta?.id || "").trim();
      const instanceId = isUuid(rawInstanceId) ? rawInstanceId : null;
      const instanceName = String(instanciaAtivaNome || "").trim();
      const requestedLimitRaw = Number(opts?.limit || mensagensLimit || DEFAULT_MENSAGENS_LIMIT) || DEFAULT_MENSAGENS_LIMIT;
      const requestedLimit = Math.max(1, Math.min(240, requestedLimitRaw));
      const silent = opts?.silent === true;

      if (!instanceId && !instanceName) {
        setMensagens([]);
        return [];
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const queryInstanceId = instanceId ? `&instanceId=${encodeURIComponent(instanceId)}` : "";
        const queryInstanceName = instanceId ? "" : `&instanceName=${encodeURIComponent(instanceName)}`;
        const excludePulledQuery =
          !modoListaPuxadas &&
          Boolean(televendasPrincipalInstancia) &&
          normalizeInstanceKey(instanceName) === normalizeInstanceKey(televendasPrincipalInstancia.instanceName)
            ? "&excludePulled=true"
            : "";
        const encerradasQuery = somenteEncerradas ? "&encerradas=true" : "";
        const endpoint = modoListaPuxadas ? "mensagens/puxadas/mensagens" : "conversas/mensagens";
        let lastPayload: unknown = null;
        let anyResponseOk = false;
        let usedRemoteJid = remoteJidCandidates[0];
        let mergedRows: MensagemRow[] = [];

        for (const remoteJid of remoteJidCandidates) {
          const response = await fetch(
            `${getBaseApi()}/zaphub/${endpoint}?limit=${encodeURIComponent(String(requestedLimit))}${queryInstanceName}${queryInstanceId}${excludePulledQuery}${encerradasQuery}&remoteJid=${encodeURIComponent(remoteJid)}&matricula=${encodeURIComponent(getMatriculaLogada())}`,
            {
              cache: "no-store",
              headers: {
                "cache-control": "no-cache",
                pragma: "no-cache",
              },
            }
          );
          const contentType = response.headers.get("content-type") || "";
          const isJson = contentType.toLowerCase().includes("application/json");
          const payload: unknown = isJson ? await response.json() : { message: await response.text() };
          lastPayload = payload;

          if (!response.ok) continue;

          anyResponseOk = true;
          usedRemoteJid = remoteJid;

          const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
          const rows = Array.isArray(rowsRaw) ? (rowsRaw as MensagemRow[]) : [];
          const candidateRows = normalizeSnapshotRows(rows).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
          mergedRows = mergeMensagemRows(mergedRows, candidateRows);
        }

        const deduped = mergedRows;

        if (!anyResponseOk) {
          const message =
            lastPayload && typeof lastPayload === "object" && "message" in lastPayload && typeof (lastPayload as { message?: unknown }).message === "string"
              ? (lastPayload as { message: string }).message
              : "Falha ao carregar mensagens";
          throw new Error(message);
        }

        const nextInstancia =
          lastPayload && typeof lastPayload === "object" && "instance" in lastPayload
            ? (lastPayload as { instance?: InstanciaAberta }).instance || null
            : null;
        const syncedAt = new Date().toISOString();

        reportChatStreamDebug("E", "messages fetched", {
          conversaId: conversa.id,
          usedRemoteJid,
          candidateJids: remoteJidCandidates.slice(0, 6),
          rowsCount: deduped.length,
          fromMeCount: deduped.filter((row) => row.fromMe).length,
          receivedCount: deduped.filter((row) => !row.fromMe).length,
        });

        if (conversaSelecionadaRef.current?.id !== conversa.id) {
          if (deduped.length > 0) {
            conversationMessagesCacheRef.current[getConversationMessagesCacheKey(conversa.id, somenteEncerradas)] = deduped;
          }
          return deduped;
        }

        const escopoDesatualizado =
          modoListaPuxadas &&
          ((modoAtual === "encerradas" && !somenteEncerradas) || (modoAtual === "puxadas" && somenteEncerradas));
        if (escopoDesatualizado) {
          return deduped;
        }

        if (deduped.length > 0) {
          conversationMessagesCacheRef.current[getConversationMessagesCacheKey(conversa.id, modoAtual === "encerradas")] = deduped;
        }

        const applyMensagens = () => {
          setInstancia(nextInstancia);
          setMensagens((prev) => {
            if (!prev.length || !deduped.length) return deduped;
            const merged = mergeMensagemRows(prev, deduped);
            return mensagemRowsAreEquivalent(prev, merged) ? prev : merged;
          });
          setMensagensLimit(requestedLimit);
          setLastSyncAt(syncedAt);

          const last = deduped[deduped.length - 1] || null;
          if (last) {
            setConversas((prev) =>
              prev.map((row) =>
                row.id === conversa.id
                  ? {
                      ...row,
                      lastMessage: getMensagemTextoConversa(last, headerRoleOptions),
                      lastMessageType: last.messageType,
                      lastMessageFromMe: last.fromMe,
                      lastMessageDeleted: isMensagemApagada(last),
                      lastSentAt: last.sentAt || row.lastSentAt,
                      lastTimestamp: last.timestamp || row.lastTimestamp,
                      totalMensagens: deduped.length,
                    }
                  : row
              )
            );
          } else {
            setConversas((prev) => prev.map((row) => (row.id === conversa.id ? { ...row, totalMensagens: 0 } : row)));
          }
        };

        if (silent) {
          React.startTransition(applyMensagens);
        } else {
          applyMensagens();
        }

        const pendingUnread = pendingMarkReadRef.current.get(conversa.id);
        if ((pendingUnread != null && pendingUnread > 0) || Number(conversa.unreadCount) > 0) {
          const liveConversa = conversasRef.current.find((row) => row.id === conversa.id) || conversa;
          marcarConversaComoLidaRef.current?.(liveConversa, deduped).catch(() => {});
        }

        return deduped;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar mensagens";
        reportChatStreamDebug("E", "messages fetch failed", {
          conversaId: conversa.id,
          silent,
          message,
        });
        if (!silent) {
          setMensagens([]);
          setError(message);
        } else if (conversaSelecionadaRef.current?.id === conversa.id) {
          setError(message);
        }
        return [];
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [getBaseApi, getMatriculaLogada, headerRoleOptions, instanciaAtivaMeta?.id, instanciaAtivaMeta?.isTelevendasPrincipal, instanciaAtivaNome, mensagensLimit, modoVisualizacao, reportChatStreamDebug, televendasPrincipalInstancia]
  );

  const selecionarInstancia = React.useCallback(
    (item: InstanciaAberta) => {
      const instanceName = String(item.instanceName || "").trim();
      if (!instanceName) return;
      void finalizarLeituraConversaAbertaRef.current?.();
      conversasLoadSeqRef.current += 1;
      setModoVisualizacao("normal");
      setAbaConversas("hoje");
      setInstanciaAtivaNome(instanceName);
      setConversaSelecionadaId(null);
      setCarregandoConversaId(null);
      setMensagens([]);
      setMensagensLimit(DEFAULT_MENSAGENS_LIMIT);
      setConversas([]);
      setConversasEscopoModo(null);
      conversasEscopoModoRef.current = null;
      setCarregandoConversas(true);
      setConversasVisiveisLimit(MAX_CONVERSAS_VISIVEIS);
      setConversasLimit(DEFAULT_MENSAGENS_LIMIT);
      setLastConversasFetchCount(null);
      setLastSyncAt(null);
      carregarConversas({ instanceName, instanceId: String(item.id || "").trim() || null, limit: DEFAULT_MENSAGENS_LIMIT }).catch(() => {});
    },
    [carregarConversas]
  );

  const selecionarPuxadas = React.useCallback(() => {
    const item = televendasPrincipalInstancia;
    if (!item) return;
    const instanceName = String(item.instanceName || "").trim();
    if (!instanceName) return;
    void finalizarLeituraConversaAbertaRef.current?.();
    conversasLoadSeqRef.current += 1;
    setModoVisualizacao("puxadas");
    setAbaConversas("hoje");
    setInstanciaAtivaNome(instanceName);
    setConversaSelecionadaId(null);
    setCarregandoConversaId(null);
    setMensagens([]);
    setMensagensLimit(DEFAULT_MENSAGENS_LIMIT);
    setConversas([]);
    setConversasEscopoModo("puxadas");
    conversasEscopoModoRef.current = "puxadas";
      setCarregandoConversas(true);
      setConversasVisiveisLimit(MAX_CONVERSAS_VISIVEIS);
    setConversasLimit(DEFAULT_MENSAGENS_LIMIT);
    setLastConversasFetchCount(null);
    setLastSyncAt(null);
    carregarConversas({
      instanceName,
      instanceId: String(item.id || "").trim() || null,
      limit: DEFAULT_MENSAGENS_LIMIT,
      modoPuxadas: true,
    }).catch(() => {});
  }, [carregarConversas, televendasPrincipalInstancia]);

  const selecionarEncerradas = React.useCallback(() => {
    const item = televendasPrincipalInstancia;
    if (!item) return;
    const instanceName = String(item.instanceName || "").trim();
    if (!instanceName) return;
    void finalizarLeituraConversaAbertaRef.current?.();
    conversasLoadSeqRef.current += 1;
    setModoVisualizacao("encerradas");
    setAbaConversas("hoje");
    setInstanciaAtivaNome(instanceName);
    setConversaSelecionadaId(null);
    setCarregandoConversaId(null);
    setMensagens([]);
    setMensagensLimit(DEFAULT_MENSAGENS_LIMIT);
    setConversas([]);
    setConversasEscopoModo("encerradas");
    conversasEscopoModoRef.current = "encerradas";
    setCarregandoConversas(true);
    setConversasVisiveisLimit(MAX_CONVERSAS_VISIVEIS);
    setConversasLimit(DEFAULT_MENSAGENS_LIMIT);
    setLastConversasFetchCount(null);
    setLastSyncAt(null);
    carregarConversas({
      instanceName,
      instanceId: String(item.id || "").trim() || null,
      limit: DEFAULT_MENSAGENS_LIMIT,
      modoPuxadas: true,
      encerradas: true,
      modoVisualizacao: "encerradas",
    }).catch(() => {});
  }, [carregarConversas, televendasPrincipalInstancia]);

  const encerrarConversaPuxada = React.useCallback(async () => {
    const selected = conversaSelecionadaRef.current;
    if (!selected || encerrandoConversa || somenteLeituraEncerradas) return;

    const instanceName = String(instanciaAtivaNome || instancia?.instanceName || "").trim();
    const remoteJidCandidates = getConversationMessageRemoteJidCandidates(selected);
    const remoteJid = String(remoteJidCandidates[0] || selected.remoteJid || selected.id || "").trim();
    if (!instanceName || !remoteJid) return;

    setEncerrandoConversa(true);
    setErroEncerrarConversa(null);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/puxadas/encerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: getMatriculaLogada(),
          instanceName,
          remoteJid,
          remoteJids: remoteJidCandidates,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao encerrar conversa";
        throw new Error(message);
      }

      setMostrarModalEncerrarConversa(false);
      setErroEncerrarConversa(null);
      setConversaSelecionadaId(null);
      setMensagens([]);
      setConversas([]);
      setConversasEscopoModo(null);
      conversasEscopoModoRef.current = null;
      conversationMessagesCacheRef.current = {};
      setModoVisualizacao("encerradas");
      setAbaConversas("hoje");
      await carregarConversas({
        instanceName,
        instanceId: String(instanciaAtivaMeta?.id || "").trim() || null,
        limit: conversasLimit,
        modoPuxadas: true,
        encerradas: true,
        modoVisualizacao: "encerradas",
      });
      void carregarBadgesPuxadas({ instanceName });
    } catch (err) {
      setErroEncerrarConversa(err instanceof Error ? err.message : "Erro ao encerrar conversa");
    } finally {
      setEncerrandoConversa(false);
    }
  }, [
    encerrandoConversa,
    carregarBadgesPuxadas,
    carregarConversas,
    conversasLimit,
    getBaseApi,
    getMatriculaLogada,
    instancia?.instanceName,
    instanciaAtivaMeta?.id,
    instanciaAtivaNome,
    somenteLeituraEncerradas,
  ]);

  const fecharModalEncerrarConversa = React.useCallback(() => {
    if (encerrandoConversa) return;
    setMostrarModalEncerrarConversa(false);
    setErroEncerrarConversa(null);
  }, [encerrandoConversa]);

  const aplicarLeituraOtimistaConversa = React.useCallback((conversa: ConversaAgrupada) => {
    const conversaId = String(conversa.id || "").trim();
    const unreadToClear = Number(pendingMarkReadRef.current.get(conversaId) ?? conversa.unreadCount) || 0;
    if (!conversaId || unreadToClear <= 0 || pendingMarkReadRef.current.has(conversaId)) return;

    pendingMarkReadRef.current.set(conversaId, unreadToClear);
    React.startTransition(() => {
      setConversas((prev) =>
        prev.map((row) => (row.id === conversaId ? { ...row, unreadCount: 0 } : row))
      );
      setUnreadCountsByInstance((prev) => {
        const instanceName = String(instanciaRef.current?.instanceName || instanciaAtivaNome || "").trim();
        if (!instanceName) return prev;
        const key = normalizeInstanceKey(instanceName);
        const current = Number(prev?.[key]) || 0;
        return { ...(prev || {}), [key]: Math.max(0, current - unreadToClear) };
      });
    });
  }, [instanciaAtivaNome]);

  const marcarConversaComoLida = React.useCallback(async (conversa: ConversaAgrupada, rows?: MensagemRow[]) => {
    const conversaId = String(conversa.id || "").trim();
    const unreadToClear = Number(pendingMarkReadRef.current.get(conversaId) ?? conversa.unreadCount) || 0;
    if (!conversaId || unreadToClear <= 0) return;
    if (marcarLidaInflightRef.current.has(conversaId)) return;

    marcarLidaInflightRef.current.add(conversaId);
    aplicarLeituraOtimistaConversa(conversa);

    try {
      const targetRemoteJid = getConversationApiRemoteJid(conversa);
      const isGrupo = Boolean(getConversationGroupRemoteJid(conversa));
      const instanceName = String(instanciaRef.current?.instanceName || instanciaAtivaNome || "").trim();
      if (!instanceName || !targetRemoteJid) return;

      const baseRows = rows && rows.length ? rows : mensagensRef.current;
      const trustRowsForConversa = Boolean(rows && rows.length);
      const readMessages = (() => {
        const seen = new Set<string>();
        return baseRows
          .filter((mensagem) => !mensagem.fromMe)
          .filter((mensagem) => trustRowsForConversa || mensagemPertenceConversa(mensagem, conversa))
          .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
          .map((mensagem) => {
            const id = String(mensagem.messageKeyId || mensagem.id || "").trim();
            const messageRemoteJid = isGrupo ? targetRemoteJid : getMensagemMarkReadRemoteJid(mensagem, targetRemoteJid);
            return { id, fromMe: false, remoteJid: messageRemoteJid };
          })
          .filter((mensagem) => Boolean(mensagem.id && mensagem.remoteJid))
          .filter((mensagem) => {
            const key = `${mensagem.remoteJid}::${mensagem.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      })();

      if (!readMessages.length) {
        reportChatStreamDebug("G", "mark-read skipped: empty readMessages", {
          conversaId,
          chatName: conversa.chatName,
          isGrupo,
          targetRemoteJid,
          conversationJids: collectConversationJids(conversa),
          mensagensNaTela: baseRows.length,
          amostraMensagens: baseRows.slice(0, 5).map((mensagem) => ({
            remoteJid: mensagem.remoteJid,
            canonicalRemoteJid: mensagem.canonicalRemoteJid,
            contactRemoteJid: mensagem.contactRemoteJid,
            messageKeyId: mensagem.messageKeyId,
          })),
        });
        pendingMarkReadRef.current.delete(conversaId);
        React.startTransition(() => {
          setConversas((prev) =>
            prev.map((row) => (row.id === conversaId ? { ...row, unreadCount: unreadToClear } : row))
          );
        });
        return;
      }

      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/marcar-lida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: getMatriculaLogada(),
          instanceId: instanciaAtivaMeta?.id || undefined,
          instanceName,
          remoteJid: targetRemoteJid,
          readMessages,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const payload: unknown = contentType.toLowerCase().includes("application/json")
          ? await response.json()
          : { message: await response.text() };
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao marcar conversa como lida";
        throw new Error(message);
      }

      pendingMarkReadRef.current.delete(conversaId);
      React.startTransition(() => {
        setMensagens((prev) =>
          prev.map((mensagem) =>
            mensagemPertenceConversa(mensagem, conversa) ? { ...mensagem, unreadMessages: 0 } : mensagem
          )
        );
        setConversas((prev) => prev.map((row) => (row.id === conversa.id ? { ...row, unreadCount: 0 } : row)));
      });
    } catch (err) {
      pendingMarkReadRef.current.delete(conversaId);
      React.startTransition(() => {
        setConversas((prev) =>
          prev.map((row) => (row.id === conversaId ? { ...row, unreadCount: unreadToClear } : row))
        );
      });
      setError(err instanceof Error ? err.message : "Erro ao marcar conversa como lida");
    } finally {
      marcarLidaInflightRef.current.delete(conversaId);
    }
  }, [aplicarLeituraOtimistaConversa, getBaseApi, getMatriculaLogada, instanciaAtivaMeta?.id, instanciaAtivaNome, reportChatStreamDebug]);

  const finalizarLeituraConversaAberta = React.useCallback(async () => {
    const conversaId = conversaAbertaNaoLidaIdRef.current;
    if (!conversaId) return;
    conversaAbertaNaoLidaIdRef.current = null;
    const conversa = conversasRef.current.find((row) => row.id === conversaId);
    if (!conversa || conversa.unreadCount <= 0) return;
    await marcarConversaComoLida(conversa, mensagensRef.current);
  }, [marcarConversaComoLida]);

  React.useEffect(() => {
    marcarConversaComoLidaRef.current = marcarConversaComoLida;
  }, [marcarConversaComoLida]);

  React.useEffect(() => {
    finalizarLeituraConversaAbertaRef.current = finalizarLeituraConversaAberta;
  }, [finalizarLeituraConversaAberta]);

  const selecionarConversa = React.useCallback(
    (conversa: ConversaAgrupada) => {
      if (conversaSelecionadaId === conversa.id) {
        conversaSelecionadaRef.current = conversa;
        clearConversationSnapshotSigCache(lastMessagesSnapshotSigRef.current, conversa);
        setCarregandoConversaId(conversa.id);
        setError(null);
        void carregarMensagensConversa(conversa, { limit: mensagensLimit, silent: true }).finally(() => {
          setCarregandoConversaId((current) => (current === conversa.id ? null : current));
        });
        return;
      }

      void finalizarLeituraConversaAberta().catch(() => {});
      // #region debug-point E:select-conversation
      reportChatStreamDebug("E", "conversation selected", {
        conversaId: conversa.id,
        remoteJid: String(conversa.remoteJid || "").trim(),
        canonicalRemoteJid: String(conversa.canonicalRemoteJid || "").trim(),
        contactRemoteJid: String(conversa.contactRemoteJid || "").trim(),
        identityKey: getConversaIdentityKey(conversa),
        unreadCount: Number(conversa.unreadCount || 0),
      });
      // #endregion
      conversaSelecionadaRef.current = conversa;
      conversaAbertaNaoLidaIdRef.current = null;
      clearConversationSnapshotSigCache(lastMessagesSnapshotSigRef.current, conversa);
      shouldAutoScrollRef.current = true;
      isMessagesNearBottomRef.current = true;
      const cachedMensagens =
        conversationMessagesCacheRef.current[
          getConversationMessagesCacheKey(conversa.id, modoVisualizacaoRef.current === "encerradas")
        ] || [];
      setMensagens(cachedMensagens);
      if (Number(conversa.unreadCount) > 0) {
        aplicarLeituraOtimistaConversa(conversa);
      }
      setConversaSelecionadaId(conversa.id);
      setCarregandoConversaId(conversa.id);
      setError(null);
    },
    [
      aplicarLeituraOtimistaConversa,
      carregarMensagensConversa,
      conversaSelecionadaId,
      finalizarLeituraConversaAberta,
      mensagensLimit,
      reportChatStreamDebug,
    ]
  );

  const abrirConversaEmMinhasPuxadas = React.useCallback(
    async (opts: {
      instanceName: string;
      instanceId: string | null;
      conversaOrigem: ConversaAgrupada | null;
      remoteJid: string;
    }) => {
      const { instanceName, instanceId, conversaOrigem, remoteJid } = opts;

      await finalizarLeituraConversaAbertaRef.current?.();

      setModoVisualizacao("puxadas");
      setAbaConversas("hoje");
      setInstanciaAtivaNome(instanceName);
      setMensagens([]);
      setConversas([]);
      setConversasEscopoModo("puxadas");
      conversasEscopoModoRef.current = "puxadas";
      conversationMessagesCacheRef.current = {};

      const conversasPuxadas = await carregarConversas({
        instanceName,
        instanceId,
        limit: conversasLimit,
        modoPuxadas: true,
        encerradas: false,
      });

      let conversaAbrir = findConversaCorrespondente(conversasPuxadas, conversaOrigem, remoteJid);
      if (!conversaAbrir && conversaOrigem) {
        conversaAbrir = {
          ...conversaOrigem,
          unreadCount: 0,
          remoteJid: conversaOrigem.remoteJid || remoteJid,
          id: conversaOrigem.id || remoteJid,
        };
        setConversas((prev) => dedupeConversas([conversaAbrir!, ...prev]).map(normalizeConversaJids));
      }

      if (conversaAbrir) {
        selecionarConversa(conversaAbrir);
      } else {
        setConversaSelecionadaId(null);
        setCarregandoConversaId(null);
      }
      void carregarBadgesPuxadas({ instanceName, instanceId });
    },
    [carregarBadgesPuxadas, carregarConversas, conversasLimit, selecionarConversa]
  );

  const puxarMensagem = React.useCallback(
    async (mensagem: MensagemRow) => {
      const item = televendasPrincipalInstancia;
      const instanceName = String(instanciaAtivaNome || instancia?.instanceName || item?.instanceName || "").trim();
      const instanceId = String(instanciaAtivaMeta?.id || item?.id || "").trim() || null;
      const messageKeyId = String(mensagem.messageKeyId || "").trim();
      const conversaOrigem = conversaSelecionadaRef.current;
      const remoteJid = String(
        mensagem.remoteJid || conversaOrigem?.remoteJid || conversaOrigem?.id || ""
      ).trim();
      if (!instanceName || !messageKeyId || !remoteJid || !item) return;

      setPuxandoMensagemId(mensagem.id);
      setPuxandoParaMinhasPuxadas(true);
      setError(null);
      try {
        const response = await fetch(`${getBaseApi()}/zaphub/mensagens/puxar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matricula: getMatriculaLogada(),
            instanceName,
            messageKeyId,
            messageId: mensagem.id,
            remoteJid,
            participant: mensagem.participant || null,
            usuarioNome: String(usuarioLogado?.nome || "").trim() || null,
          }),
        });
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };
        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao puxar mensagem";
          throw new Error(message);
        }

        await finalizarLeituraConversaAbertaRef.current?.();

        await abrirConversaEmMinhasPuxadas({
          instanceName,
          instanceId,
          conversaOrigem,
          remoteJid,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao puxar mensagem");
      } finally {
        setPuxandoMensagemId(null);
        setPuxandoParaMinhasPuxadas(false);
      }
    },
    [
      abrirConversaEmMinhasPuxadas,
      getBaseApi,
      getMatriculaLogada,
      instancia?.instanceName,
      instanciaAtivaMeta?.id,
      instanciaAtivaNome,
      televendasPrincipalInstancia,
      usuarioLogado?.nome,
    ]
  );

  const iniciarOuReabrirConversa = React.useCallback(async () => {
    const selected = conversaSelecionadaRef.current;
    if (!selected || iniciandoConversa) return;

    const item = televendasPrincipalInstancia;
    const instanceName = String(instanciaAtivaNome || instancia?.instanceName || item?.instanceName || "").trim();
    const instanceId = String(instanciaAtivaMeta?.id || item?.id || "").trim() || null;
    const remoteJidCandidates = getConversationMessageRemoteJidCandidates(selected);
    const remoteJid = String(remoteJidCandidates[0] || selected.remoteJid || selected.id || "").trim();
    const reabrir = modalIniciarConversaModo === "reabrir";

    if (!instanceName || !remoteJid || !item) return;

    setIniciandoConversa(true);
    setErroIniciarConversa(null);
    setPuxandoParaMinhasPuxadas(true);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/puxadas/iniciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: getMatriculaLogada(),
          instanceName,
          remoteJid,
          remoteJids: remoteJidCandidates,
          usuarioNome: String(usuarioLogado?.nome || "").trim() || null,
          reabrir,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : reabrir
            ? "Falha ao reabrir conversa"
            : "Falha ao iniciar conversa";
        throw new Error(message);
      }

      setMostrarModalIniciarConversa(false);
      setErroIniciarConversa(null);
      await abrirConversaEmMinhasPuxadas({
        instanceName,
        instanceId,
        conversaOrigem: selected,
        remoteJid,
      });
    } catch (err) {
      setErroIniciarConversa(err instanceof Error ? err.message : reabrir ? "Erro ao reabrir conversa" : "Erro ao iniciar conversa");
    } finally {
      setIniciandoConversa(false);
      setPuxandoParaMinhasPuxadas(false);
    }
  }, [
    abrirConversaEmMinhasPuxadas,
    getBaseApi,
    getMatriculaLogada,
    iniciandoConversa,
    instancia?.instanceName,
    instanciaAtivaMeta?.id,
    instanciaAtivaNome,
    modalIniciarConversaModo,
    televendasPrincipalInstancia,
    usuarioLogado?.nome,
  ]);

  const fecharModalIniciarConversa = React.useCallback(() => {
    if (iniciandoConversa) return;
    setMostrarModalIniciarConversa(false);
    setErroIniciarConversa(null);
  }, [iniciandoConversa]);

  const aplicarSnapshotMensagens = React.useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") return;

    const nextInstancia =
      "instance" in payload
        ? (payload as { instance?: InstanciaAberta }).instance || null
        : null;
    const nextRows =
      "rows" in payload
        ? (payload as { rows?: MensagemRow[] }).rows || []
        : [];
    const remoteJid =
      "remoteJid" in payload && typeof (payload as { remoteJid?: unknown }).remoteJid === "string"
        ? String((payload as { remoteJid: string }).remoteJid || "").trim()
        : null;
    const sentAt =
      "sentAt" in payload && typeof (payload as { sentAt?: unknown }).sentAt === "string"
        ? (payload as { sentAt: string }).sentAt
        : new Date().toISOString();

    const safeRows = Array.isArray(nextRows)
      ? normalizeSnapshotRows(nextRows).sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
      : [];
    const selected = conversaSelecionadaRef.current;
    const selectedRemoteJid = selected ? getConversationApiRemoteJid(selected) : "";
    if (selected && remoteJid && !payloadRemoteJidMatchesConversa(remoteJid, selected)) {
      reportChatStreamDebug("A", "snapshot ignored due to remoteJid mismatch", {
        payloadRemoteJid: remoteJid,
        selectedRemoteJid,
        selectedId: selected.id,
      });
      return;
    }
    const snapshotKey = `${String(selected?.id || selectedRemoteJid || remoteJid || "unknown")}::${selectedRemoteJid || remoteJid || "unknown"}`;
    const lastRow = safeRows[safeRows.length - 1] || null;
    const sig = `${safeRows.length}:${String(lastRow?.messageKeyId || lastRow?.id || "")}:${Number(lastRow?.timestamp || 0)}`;
    const shouldClearLoading = Boolean(selected && (remoteJid ? payloadRemoteJidMatchesConversa(remoteJid, selected) : true));
    if (lastMessagesSnapshotSigRef.current[snapshotKey] === sig) {
      if (shouldClearLoading) {
        setCarregandoConversaId(null);
      }
      return;
    }
    lastMessagesSnapshotSigRef.current[snapshotKey] = sig;

    React.startTransition(() => {
      setInstancia(nextInstancia);
      setMensagens((prev) => {
        if (!prev.length || !safeRows.length) return safeRows;
        const merged = mergeMensagemRows(prev, safeRows);
        return mensagemRowsAreEquivalent(prev, merged) ? prev : merged;
      });
      setLastSyncAt(sentAt);
      setError(null);
    });
    // #region debug-point A:apply-snapshot
    reportChatStreamDebug("A", "snapshot applied", {
      payloadType: "type" in payload ? String((payload as { type?: unknown }).type || "") : "",
      payloadRemoteJid: remoteJid,
      selectedRemoteJid,
      rowsCount: safeRows.length,
      shouldClearLoading,
    });
    // #endregion
    if (remoteJid) {
      if (shouldClearLoading) {
        setCarregandoConversaId(null);
      }
    }
    if (nextInstancia?.instanceName || nextInstancia?.id) {
      const instanceKey = String(nextInstancia?.id || nextInstancia?.instanceName || "").trim();
      const cacheKey = getMessagesCacheKey(instanceKey, mensagensLimitRef.current);
      messagesCacheRef.current[cacheKey] = {
        instance: nextInstancia,
        rows: safeRows,
        count: null,
        syncedAt: sentAt,
      };
      if (selected?.id && safeRows.length > 0) {
        conversationMessagesCacheRef.current[
          getConversationMessagesCacheKey(selected.id, modoVisualizacaoRef.current === "encerradas")
        ] = safeRows;
      }
    }
  }, [getMessagesCacheKey, reportChatStreamDebug]);

  React.useEffect(() => {
    if (!show) return;
    carregarInstanciasDisponiveis().catch((err) => {
      setInstanciasDisponiveis([]);
      setInstanciaAtivaNome(null);
      setError(err instanceof Error ? err.message : "Erro ao carregar instâncias");
    });
  }, [show, carregarInstanciasDisponiveis]);

  React.useEffect(() => {
    if (!show || !usuarioTemTelevendasPrincipal) return undefined;

    void carregarBadgesPuxadas();
    const intervalId = window.setInterval(() => {
      void carregarBadgesPuxadas();
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [carregarBadgesPuxadas, show, televendasPrincipalInstancia?.id, televendasPrincipalInstancia?.instanceName, usuarioTemTelevendasPrincipal]);

  React.useEffect(() => {
    if (!show) return;
    try {
      const raw = localStorage.getItem("usuarioLogado");
      if (!raw) {
        onClose();
        redirecionarParaLogin();
      }
      const parsed = JSON.parse(raw || "{}") as { matricula?: unknown } | null;
      const matricula = String(parsed?.matricula || "").trim();
      if (!matricula) {
        onClose();
        redirecionarParaLogin();
      }
    } catch {
      onClose();
      redirecionarParaLogin();
    }
  }, [onClose, redirecionarParaLogin, show]);

  React.useEffect(() => {
    if (!show) {
      setShowUsuarioMenu(false);
      setMenuMensagemAbertoId(null);
      setMensagemEmEdicao(null);
      setTextoEdicaoMensagem("");
      setInfoEdicaoMensagem(null);
      setErroEdicaoMensagem(null);
      setAguardandoConfirmacaoEdicao(false);
      setMensagemEmExclusao(null);
      setInfoExclusaoMensagem(null);
      setErroExclusaoMensagem(null);
      setExcluindoMensagem(false);
      detachAudioListeners();
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
        } catch {
          void 0;
        }
      }
      audioPlayerRef.current = null;
      audioPlayerMessageIdRef.current = null;
      setAudioSelectedMessageId(null);
      setAudioPlayingMessageId(null);
      setAudioIsPlaying(false);
      setAudioPlaybackRate(1);
      setAudioCurrentTimeSec(0);
      setAudioDurationSec(0);
    }
  }, [detachAudioListeners, show]);

  React.useEffect(() => {
    if (!showUsuarioMenu) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (usuarioMenuRef.current && usuarioMenuRef.current.contains(target)) return;
      setShowUsuarioMenu(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [showUsuarioMenu]);

  React.useEffect(() => {
    if (!aguardandoConfirmacaoEdicao || !mensagemEmEdicao) return undefined;

    const candidate = localizarMensagemParaEdicao(mensagens, mensagemEmEdicao);
    if (candidate) {
      const permissao = getPermissaoEdicaoMensagem(candidate);
      if (permissao.allowed) {
        setMensagemEmEdicao(candidate);
        setTextoEdicaoMensagem(getMensagemTextoEditavelSemCabecalho(candidate));
        setInfoEdicaoMensagem(null);
        setErroEdicaoMensagem(null);
        setAguardandoConfirmacaoEdicao(false);
        return undefined;
      }
    }

    const timeoutId = window.setTimeout(() => {
      setAguardandoConfirmacaoEdicao(false);
      setInfoEdicaoMensagem(null);
      setErroEdicaoMensagem("Não foi possível confirmar o envio desta mensagem para liberar a edição. Tente novamente em alguns segundos.");
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    aguardandoConfirmacaoEdicao,
    getMensagemTextoEditavelSemCabecalho,
    getPermissaoEdicaoMensagem,
    localizarMensagemParaEdicao,
    mensagemEmEdicao,
    mensagens,
  ]);

  const carregarUsuarioLogado = React.useCallback(() => {
    try {
      const raw = localStorage.getItem("usuarioLogado");
      if (!raw) {
        setUsuarioLogado(null);
        redirecionarParaLogin();
        return null;
      }
      const parsed = JSON.parse(raw) as UsuarioLogado;
      setUsuarioLogado(parsed || null);
      return parsed || null;
    } catch {
      setUsuarioLogado(null);
      redirecionarParaLogin();
      return null;
    }
  }, [redirecionarParaLogin]);

  React.useEffect(() => {
    if (!show) return;
    carregarUsuarioLogado();
  }, [carregarUsuarioLogado, show]);

  const consultorUsuario = React.useMemo(() => String(usuarioLogado?.usuario || "").trim() || "Usuário", [usuarioLogado]);
  const headerLine = React.useMemo(() => {
    const label = sanitizeHeaderRoleOption(headerRoleSelected) || "Consultor(a)";
    return `*${label}: ${consultorUsuario}*`;
  }, [consultorUsuario, headerRoleSelected]);

  React.useEffect(() => {
    const reload = () => {
      const options = loadHeaderRoleOptions();
      const selected = loadHeaderRoleSelected(options);
      setHeaderRoleOptions(options);
      setHeaderRoleSelected(selected);
    };
    reload();
    window.addEventListener("zaphub:config-changed", reload);
    return () => {
      window.removeEventListener("zaphub:config-changed", reload);
    };
  }, []);

  React.useEffect(() => {
    if (!show) return undefined;
    if (typeof EventSource === "undefined") return undefined;

    const matricula = getMatriculaLogada();
    if (!matricula) return undefined;

    const stream = new EventSource(
      `${getBaseApi()}/zaphub/instancias/unread-count/stream?matricula=${encodeURIComponent(matricula)}`
    );

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          message?: string;
          instanceName?: string;
          unreadCount?: number;
          counts?: Record<string, number>;
        };
        if (payload.type === "error") return;

        if (payload.counts && typeof payload.counts === "object") {
          const entries = Object.entries(payload.counts);
          React.startTransition(() => {
            setUnreadCountsByInstance(() => {
              const next: Record<string, number> = {};
              entries.forEach(([name, value]) => {
                const key = normalizeInstanceKey(name);
                if (!key) return;
                next[key] = Math.max(0, Number(value) || 0);
              });
              return next;
            });
          });
          return;
        }

        if (typeof payload.instanceName !== "string" || !payload.instanceName.trim()) return;
        const instanceName = payload.instanceName.trim();
        React.startTransition(() => {
          setUnreadCountsByInstance((prev) =>
            applyUnreadCountUpdate(prev, instanceName, Math.max(0, Number(payload.unreadCount) || 0))
          );
        });
      } catch {
        void 0;
      }
    };

    stream.onerror = () => {};

    return () => {
      stream.close();
    };
  }, [show, getBaseApi, getMatriculaLogada]);

  React.useEffect(() => {
    if (!show || typeof EventSource === "undefined" || !instanciaAtivaNome || modoVisualizacao !== "normal") return undefined;

    const instanceId = String(instanciaAtivaMeta?.id || "").trim() || null;
    const queryInstanceId = instanceId ? `&instanceId=${encodeURIComponent(instanceId)}` : "";
    const queryInstanceName = instanceId ? "" : `&instanceName=${encodeURIComponent(instanciaAtivaNome)}`;
    const matricula = getMatriculaLogada();
    const excludePulledStream =
      Boolean(televendasPrincipalInstancia) &&
      normalizeInstanceKey(instanciaAtivaNome) === normalizeInstanceKey(televendasPrincipalInstancia.instanceName);
    const excludePulledQuery = excludePulledStream ? "&excludePulled=true" : "";
    const stream = new EventSource(
      `${getBaseApi()}/zaphub/conversas/stream?limit=${encodeURIComponent(String(conversasLimit))}${queryInstanceName}${queryInstanceId}${excludePulledQuery}&matricula=${encodeURIComponent(matricula)}`
    );

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type === "error") return;
        const now = Date.now();
        const nextAllowedAt = conversasStreamNextAllowedAtRef.current;
        if (now >= nextAllowedAt) {
          conversasStreamNextAllowedAtRef.current = now + 650;
          carregarConversas({
            instanceName: instanciaAtivaNome,
            instanceId,
            limit: conversasLimit,
            silent: true,
          }).catch(() => {});
          if (usuarioTemTelevendasPrincipal) {
            void carregarBadgesPuxadas({ instanceName: instanciaAtivaNome, instanceId });
          }
          return;
        }

        if (conversasStreamRefreshTimeoutRef.current != null) return;
        const delayMs = Math.max(0, nextAllowedAt - now);
        conversasStreamRefreshTimeoutRef.current = window.setTimeout(() => {
          conversasStreamRefreshTimeoutRef.current = null;
          conversasStreamNextAllowedAtRef.current = Date.now() + 650;
          carregarConversas({
            instanceName: instanciaAtivaNome,
            instanceId,
            limit: conversasLimit,
            silent: true,
          }).catch(() => {});
          if (usuarioTemTelevendasPrincipal) {
            void carregarBadgesPuxadas({ instanceName: instanciaAtivaNome, instanceId });
          }
        }, delayMs);
      } catch {
        void 0;
      }
    };

    stream.onerror = () => {};

    return () => {
      if (conversasStreamRefreshTimeoutRef.current != null) {
        window.clearTimeout(conversasStreamRefreshTimeoutRef.current);
        conversasStreamRefreshTimeoutRef.current = null;
      }
      stream.close();
    };
  }, [
    carregarBadgesPuxadas,
    carregarConversas,
    conversasLimit,
    getBaseApi,
    getMatriculaLogada,
    instanciaAtivaMeta?.id,
    instanciaAtivaNome,
    modoVisualizacao,
    show,
    televendasPrincipalInstancia,
    usuarioTemTelevendasPrincipal,
  ]);

  React.useEffect(() => {
    if (!show || modoVisualizacao !== "encerradas" || !instanciaAtivaNome) return undefined;

    const instanceId = String(instanciaAtivaMeta?.id || "").trim() || null;
    const refreshEncerradas = () => {
      carregarConversas({
        instanceName: instanciaAtivaNome,
        instanceId,
        limit: conversasLimit,
        silent: true,
        modoPuxadas: true,
        encerradas: true,
        modoVisualizacao: "encerradas",
      }).catch(() => {});
      void carregarBadgesPuxadas({ instanceName: instanciaAtivaNome, instanceId });
    };

    const intervalId = window.setInterval(refreshEncerradas, 12000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    carregarBadgesPuxadas,
    carregarConversas,
    conversasLimit,
    instanciaAtivaMeta?.id,
    instanciaAtivaNome,
    modoVisualizacao,
    show,
  ]);

  React.useEffect(() => {
    if (!show || !conversaSelecionadaId) return undefined;

    const selected = resolveSelectedConversa(conversaSelecionadaId, conversaSelecionadaRef, conversasRef);
    if (!selected) return undefined;

    let cancelled = false;
    const requestId = conversaSelecionadaId;

    void carregarMensagensConversa(selected, { limit: mensagensLimit, silent: true }).finally(() => {
      if (!cancelled) {
        setCarregandoConversaId((current) => (current === requestId ? null : current));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [show, conversaSelecionadaId, carregarMensagensConversa, mensagensLimit]);

  React.useEffect(() => {
    if (!show || typeof EventSource === "undefined" || !instanciaAtivaNome || !conversaSelecionadaId) return undefined;
    const selected = resolveSelectedConversa(conversaSelecionadaId, conversaSelecionadaRef, conversasRef);
    if (!selected) {
      // #region debug-point B:stream-skip-selected
      reportChatStreamDebug("B", "messages stream skipped due to selected mismatch", {
        conversaSelecionadaId,
        selectedId: conversaSelecionadaRef.current?.id || null,
      });
      // #endregion
      return undefined;
    }

    const instanceId = String(instanciaAtivaMeta?.id || "").trim() || null;
    const queryInstanceId = instanceId ? `&instanceId=${encodeURIComponent(instanceId)}` : "";
    const queryInstanceName = instanceId ? "" : `&instanceName=${encodeURIComponent(instanciaAtivaNome)}`;
    const remoteJid = getConversationMessagesRemoteJid(selected);
    if (!remoteJid) {
      // #region debug-point A:stream-skip-remotejid
      reportChatStreamDebug("A", "messages stream skipped due to empty remoteJid", {
        conversaSelecionadaId,
        selectedId: selected.id,
      });
      // #endregion
      return undefined;
    }
    const matricula = getMatriculaLogada();
    const traceId = `${conversaSelecionadaId}:${Date.now()}`;
    latestMessagesStreamRef.current = traceId;
    const filterQuery =
      modoVisualizacao === "encerradas"
        ? "&somentePuxadas=true&encerradas=true"
        : modoVisualizacao === "puxadas"
        ? "&somentePuxadas=true"
        : Boolean(televendasPrincipalInstancia) &&
          normalizeInstanceKey(instanciaAtivaNome) === normalizeInstanceKey(televendasPrincipalInstancia.instanceName)
        ? "&excludePulled=true"
        : "";
    const streamUrl = `${getBaseApi()}/zaphub/conversas/mensagens/stream?limit=${encodeURIComponent(String(mensagensLimit))}${queryInstanceName}${queryInstanceId}${filterQuery}&remoteJid=${encodeURIComponent(remoteJid)}&matricula=${encodeURIComponent(matricula)}`;
    // #region debug-point B:stream-open
    reportChatStreamDebug("B", "opening messages stream", {
      conversaSelecionadaId,
      instanceId,
      instanciaAtivaNome,
      remoteJid,
      mensagensLimit,
      streamUrl,
    }, traceId);
    // #endregion
    const stream = new EventSource(
      streamUrl
    );

    stream.onopen = () => {
      // #region debug-point B:stream-opened
      reportChatStreamDebug("B", "messages stream opened", {
        conversaSelecionadaId,
        readyState: stream.readyState,
      }, traceId);
      // #endregion
    };

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; rows?: MensagemRow[] };
        // #region debug-point C:stream-message
        reportChatStreamDebug("C", "messages stream event received", {
          conversaSelecionadaId,
          payloadType: payload.type || "",
          rowsCount: Array.isArray(payload.rows) ? payload.rows.length : null,
          payloadRemoteJid:
            payload && typeof payload === "object" && "remoteJid" in payload
              ? String((payload as { remoteJid?: unknown }).remoteJid || "")
              : "",
        }, traceId);
        // #endregion
        if (payload.type === "error") return;
        if (latestMessagesStreamRef.current !== traceId) return;
        pendingMessagesSnapshotRef.current = payload;
        if (pendingMessagesSnapshotRafRef.current == null) {
          pendingMessagesSnapshotRafRef.current = window.requestAnimationFrame(() => {
            pendingMessagesSnapshotRafRef.current = null;
            const pending = pendingMessagesSnapshotRef.current;
            pendingMessagesSnapshotRef.current = null;
            if (!pending) return;
            aplicarSnapshotMensagens(pending);
          });
        }
        if (payload.type === "snapshot" && Array.isArray(payload.rows) && payload.rows.length > 0) {
          const liveConversa = resolveSelectedConversa(conversaSelecionadaId, conversaSelecionadaRef, conversasRef) || selected;
          const pendingUnread = pendingMarkReadRef.current.get(liveConversa.id);
          if ((pendingUnread != null && pendingUnread > 0) || Number(liveConversa.unreadCount) > 0) {
            marcarConversaComoLidaRef.current?.(liveConversa, payload.rows).catch(() => {});
          }
        }
      } catch (err) {
        // #region debug-point D:stream-message-error
        reportChatStreamDebug("D", "messages stream event parse failed", {
          conversaSelecionadaId,
          error: err instanceof Error ? err.message : String(err || ""),
          rawData: String(event.data || "").slice(0, 400),
        }, traceId);
        // #endregion
      }
    };

    stream.onerror = () => {
      // #region debug-point B:stream-error
      reportChatStreamDebug("B", "messages stream error", {
        conversaSelecionadaId,
        readyState: stream.readyState,
      }, traceId);
      // #endregion
    };

    return () => {
      // #region debug-point B:stream-close
      reportChatStreamDebug("B", "closing messages stream", {
        conversaSelecionadaId,
        readyState: stream.readyState,
        latestTraceId: latestMessagesStreamRef.current,
      }, traceId);
      // #endregion
      if (pendingMessagesSnapshotRafRef.current != null) {
        window.cancelAnimationFrame(pendingMessagesSnapshotRafRef.current);
        pendingMessagesSnapshotRafRef.current = null;
      }
      pendingMessagesSnapshotRef.current = null;
      stream.close();
    };
  }, [
    aplicarSnapshotMensagens,
    conversaSelecionadaId,
    getBaseApi,
    getMatriculaLogada,
    instanciaAtivaMeta?.id,
    instanciaAtivaNome,
    mensagensLimit,
    modoVisualizacao,
    abaConversas,
    reportChatStreamDebug,
    show,
    televendasPrincipalInstancia,
  ]);

  const atualizarCentral = React.useCallback(async () => {
    await carregarInstanciasDisponiveis();
    if (instanciaAtivaNome) {
      await carregarConversas({
        instanceName: instanciaAtivaNome,
        instanceId: String(instanciaAtivaMeta?.id || "").trim() || null,
        limit: conversasLimit,
      });
      const selected = conversas.find((row) => row.id === conversaSelecionadaId) || null;
      if (selected) {
        await carregarMensagensConversa(selected, { limit: mensagensLimit });
      }
    }
  }, [
    carregarConversas,
    carregarInstanciasDisponiveis,
    carregarMensagensConversa,
    conversaSelecionadaId,
    conversas,
    conversasLimit,
    instanciaAtivaMeta?.id,
    instanciaAtivaNome,
    mensagensLimit,
  ]);

  React.useEffect(() => {
    if (show) return;
    void finalizarLeituraConversaAbertaRef.current?.();
    pendingMarkReadRef.current.clear();
    marcarLidaInflightRef.current.clear();
    conversationMessagesCacheRef.current = {};
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setGravandoAudio(false);
    Object.values(loadedMediaByMessageId).forEach((asset) => {
      if (asset?.src && asset.src.startsWith("blob:")) {
        URL.revokeObjectURL(asset.src);
      }
    });
    anexosEnvio.forEach((anexo) => {
      if (anexo.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(anexo.previewUrl);
      }
    });
    setLoadedMediaByMessageId({});
    setLoadingMediaByMessageId({});
    setMediaLoadErrorByMessageId({});
    setAnexosEnvio([]);
    setTextoEnvio("");
    setInstanciasDisponiveis([]);
    setUnreadCountsByInstance({});
    setInstanciaAtivaNome(null);
    setModoVisualizacao("normal");
    setCarregandoConversas(false);
    setMensagensLimit(DEFAULT_MENSAGENS_LIMIT);
    setConversasVisiveisLimit(MAX_CONVERSAS_VISIVEIS);
    setCarregandoMaisConversas(false);
    setLastConversasFetchCount(null);
  }, [show, loadedMediaByMessageId, anexosEnvio]);

  React.useEffect(() => {
    if (!show) return;
    const onWindowBlur = () => {
      void finalizarLeituraConversaAbertaRef.current?.();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void finalizarLeituraConversaAbertaRef.current?.();
      }
    };
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [show]);

  React.useEffect(() => {
    if (abaConversasAnteriorRef.current === "naoVisualizadas" && abaConversas !== "naoVisualizadas") {
      void finalizarLeituraConversaAbertaRef.current?.();
    }
    abaConversasAnteriorRef.current = abaConversas;
  }, [abaConversas]);

  React.useEffect(() => {
    const validMessageIds = new Set(mensagens.map((mensagem) => mensagem.id));
    setLoadedMediaByMessageId((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(prev).forEach(([messageId, asset]) => {
        if (validMessageIds.has(messageId)) return;
        if (asset?.src && asset.src.startsWith("blob:")) {
          URL.revokeObjectURL(asset.src);
        }
        delete next[messageId];
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [mensagens, headerRoleOptions]);

  const getConversaTsMs = React.useCallback(
    (conversa: ConversaAgrupada) => {
      const dateFromSentAt = normalizeDateValue(conversa.lastSentAt || null);
      const tsMs = dateFromSentAt ? dateFromSentAt.getTime() : Number(conversa.lastTimestamp || 0) * 1000;
      return !tsMs || Number.isNaN(tsMs) ? null : tsMs;
    },
    [normalizeDateValue]
  );

  const conversasPorAba = React.useMemo(
    () => buildConversasPorAba(conversas, getConversaTsMs),
    [conversas, getConversaTsMs]
  );

  const conversasSincronizadas = React.useDeferredValue(conversas);

  const conversasPorAbaDeferred = React.useMemo(
    () => buildConversasPorAba(conversasSincronizadas, getConversaTsMs),
    [conversasSincronizadas, getConversaTsMs]
  );

  const conversasFiltradas = React.useMemo<ConversaAgrupada[]>(() => {
    if (
      instanciaAtivaEhAtendimento &&
      !conversasEscopoCompativelComModo(modoVisualizacao, conversasEscopoModo)
    ) {
      return [];
    }
    if (instanciaAtivaEhEncerradas) return conversas;
    if (abaConversas === "hoje") return conversasPorAbaDeferred.hoje;
    if (abaConversas === "ontem") return conversasPorAbaDeferred.ontem;
    if (abaConversas === "naoVisualizadas") return conversasPorAbaDeferred.naoVisualizadas;
    return conversasPorAbaDeferred.antigas;
  }, [
    abaConversas,
    conversas,
    conversasEscopoModo,
    conversasPorAbaDeferred.antigas,
    conversasPorAbaDeferred.hoje,
    conversasPorAbaDeferred.naoVisualizadas,
    conversasPorAbaDeferred.ontem,
    instanciaAtivaEhAtendimento,
    instanciaAtivaEhEncerradas,
    modoVisualizacao,
  ]);

  const abaConversasCarregando = carregandoConversas;

  React.useEffect(() => {
    setConversasVisiveisLimit(MAX_CONVERSAS_VISIVEIS);
  }, [abaConversas, modoVisualizacao]);

  const conversasVisiveis = React.useMemo(
    () => conversasFiltradas.slice(0, conversasVisiveisLimit),
    [conversasFiltradas, conversasVisiveisLimit]
  );

  const conversasDuplicateReport = React.useMemo(() => analyzeConversasDuplicates(conversas), [conversas]);
  const conversasTemDuplicatasCriticas =
    conversasDuplicateReport.duplicateIds.length > 0 || conversasDuplicateReport.duplicateIdentities.length > 0;

  React.useEffect(() => {
    if (!conversas.length) return;
    reportConversasDuplicates(conversas, "state-conversas");
  }, [conversas, reportConversasDuplicates]);

  React.useEffect(() => {
    (window as Window & { __zaphubDebugConversas?: () => ConversasDuplicateReport }).__zaphubDebugConversas = () => {
      const report = analyzeConversasDuplicates(conversas);
      console.log("[ZapHub] total conversas:", report.total);
      if (report.duplicateIds.length) {
        console.warn("=== IDs duplicados ===");
        console.table(report.duplicateIds);
      }
      if (report.duplicateIdentities.length) {
        console.warn("=== Identidades duplicadas ===");
        console.table(
          report.duplicateIdentities.flatMap((group) =>
            group.rows.map((row) => ({
              identityKey: group.identityKey,
              ...row,
            }))
          )
        );
      }
      if (report.duplicateChatNames.length) {
        console.info("=== Nomes repetidos ===");
        for (const group of report.duplicateChatNames) {
          const label = group.likelySameContact ? "provável mesmo contato" : "homônimos";
          console.group(`"${group.chatName}" (${group.count}x) — ${label}`);
          console.table(group.rows);
          console.groupEnd();
        }
      }
      if (!report.duplicateIds.length && !report.duplicateIdentities.length && !report.duplicateChatNames.length) {
        console.info("[ZapHub] nenhuma duplicata detectada");
      }
      return report;
    };
    return () => {
      delete (window as Window & { __zaphubDebugConversas?: () => ConversasDuplicateReport }).__zaphubDebugConversas;
    };
  }, [conversas]);

  React.useEffect(() => {
    (window as Window & { __zaphubDebugGroupMarkRead?: () => void }).__zaphubDebugGroupMarkRead = () => {
      const selected = conversaSelecionadaRef.current;
      if (!selected) {
        console.warn("[ZapHub Grupos] nenhuma conversa selecionada");
        return;
      }
      const info = {
        chatName: selected.chatName,
        unreadCount: selected.unreadCount,
        apiRemoteJid: getConversationApiRemoteJid(selected),
        groupRemoteJid: getConversationGroupRemoteJid(selected),
        jids: collectConversationJids(selected),
        mensagensNaTela: mensagensRef.current.length,
        amostraMensagens: mensagensRef.current.slice(0, 5).map((mensagem) => ({
          remoteJid: mensagem.remoteJid,
          canonicalRemoteJid: mensagem.canonicalRemoteJid,
          contactRemoteJid: mensagem.contactRemoteJid,
          messageKeyId: mensagem.messageKeyId,
          fromMe: mensagem.fromMe,
        })),
      };
      console.table([info]);
      console.warn("[ZapHub Grupos] debug mark-read", info);
      return info;
    };
    return () => {
      delete (window as Window & { __zaphubDebugGroupMarkRead?: () => void }).__zaphubDebugGroupMarkRead;
    };
  }, []);

  React.useEffect(() => {
    if (!conversasFiltradas.length || abaConversasCarregando) return;
    const report = analyzeConversasDuplicates(conversasFiltradas);
    const hasDuplicates =
      report.duplicateIds.length > 0 || report.duplicateIdentities.length > 0 || report.duplicateChatNames.length > 0;
    if (!hasDuplicates) return;
    reportChatStreamDebug("F", `conversas duplicates in aba:${abaConversas}`, {
      aba: abaConversas,
      total: report.total,
      duplicateIdCount: report.duplicateIds.length,
      duplicateIdentityCount: report.duplicateIdentities.length,
      duplicateChatNameCount: report.duplicateChatNames.length,
      duplicateIdentities: report.duplicateIdentities.slice(0, 5),
    });
  }, [abaConversas, abaConversasCarregando, conversasFiltradas, reportChatStreamDebug]);

  const carregarMaisConversas = React.useCallback(async () => {
    if (carregandoMaisConversas || abaConversasCarregando) return;

    if (conversasFiltradas.length > conversasVisiveisLimit) {
      setConversasVisiveisLimit((prev) => prev + MAX_CONVERSAS_VISIVEIS);
      return;
    }

    if (!instanciaAtivaNome) return;

    setCarregandoMaisConversas(true);
    try {
      const nextLimit = Math.max(1, Math.min(120, conversasLimit + MENSAGENS_LOAD_MORE_STEP));
      if (nextLimit <= conversasLimit) {
        setConversasVisiveisLimit((prev) => prev + MAX_CONVERSAS_VISIVEIS);
        return;
      }
      const loaded = await carregarConversas({ limit: nextLimit });
      if (loaded.length > 0) {
        setConversasVisiveisLimit((prev) => prev + MAX_CONVERSAS_VISIVEIS);
      }
    } finally {
      setCarregandoMaisConversas(false);
    }
  }, [
    abaConversasCarregando,
    carregandoMaisConversas,
    carregarConversas,
    conversasFiltradas.length,
    conversasVisiveisLimit,
    conversasLimit,
    instanciaAtivaNome,
    loading,
  ]);

  React.useEffect(() => {
    if (abaConversasCarregando) return;
    if (!conversasFiltradas.length) {
      setConversaSelecionadaId(null);
      return;
    }

    const exists = conversasFiltradas.some((conversa) => conversa.id === conversaSelecionadaId);
    if (conversaSelecionadaId && !exists) {
      setConversaSelecionadaId(null);
    }
  }, [abaConversasCarregando, conversasFiltradas, conversaSelecionadaId]);

  const conversaSelecionada = React.useMemo(
    () => conversas.find((conversa) => conversa.id === conversaSelecionadaId) || null,
    [conversas, conversaSelecionadaId]
  );
  const conversaSelecionadaGroupRemoteJid = React.useMemo(
    () => (conversaSelecionada ? getConversationGroupRemoteJid(conversaSelecionada) : null),
    [conversaSelecionada]
  );
  const conversaSelecionadaApiRemoteJid = React.useMemo(
    () => (conversaSelecionada ? getConversationApiRemoteJid(conversaSelecionada) : ""),
    [conversaSelecionada]
  );
  const conversaSelecionadaIsGrupo = Boolean(conversaSelecionadaGroupRemoteJid);
  const mensagemPuxavel = React.useMemo(() => {
    if (!bloquearEnvioPrincipal || conversaSelecionadaIsGrupo || !mensagens.length) return null;
    for (let index = mensagens.length - 1; index >= 0; index -= 1) {
      const mensagem = mensagens[index];
      if (mensagem.fromMe) continue;
      if (!mensagem.messageKeyId) continue;
      if (isMensagemApagada(mensagem)) continue;
      return mensagem;
    }
    return null;
  }, [bloquearEnvioPrincipal, conversaSelecionadaIsGrupo, mensagens]);
  const podeIniciarConversa =
    bloquearEnvioPrincipal && Boolean(conversaSelecionada) && !conversaSelecionadaIsGrupo && !mensagemPuxavel;
  const podeReabrirConversaEncerrada =
    somenteLeituraEncerradas && Boolean(conversaSelecionada) && !conversaSelecionadaIsGrupo;
  const conversaSelecionadaJids = React.useMemo(
    () => (conversaSelecionada ? getConversationJidInfo(conversaSelecionada) : { whatsappJid: null, lidJid: null }),
    [conversaSelecionada]
  );

  const enviarMensagemTexto = React.useCallback(async (overrideText?: string, opts?: { skipLock?: boolean; clearText?: boolean }) => {
    if (!conversaSelecionada || !conversaSelecionadaApiRemoteJid) return;
    const text = String(overrideText ?? textoEnvio).trim();
    if (!text) return;

    const textToSend = `${headerLine}\n\n${text}`;

    const shouldLock = !opts?.skipLock;
    if (shouldLock) setEnviandoMensagem(true);
    setError(null);

    const optimisticId = `local-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const optimisticRow: MensagemRow = {
      id: optimisticId,
      messageKeyId: null,
      chatName: conversaSelecionada.chatName,
      remoteJid: conversaSelecionadaApiRemoteJid,
      canonicalRemoteJid: conversaSelecionadaGroupRemoteJid || conversaSelecionadaApiRemoteJid || null,
      contactRemoteJid: conversaSelecionadaGroupRemoteJid || conversaSelecionadaApiRemoteJid || null,
      unreadMessages: 0,
      profilePicUrl: conversaSelecionada.profilePicUrl || null,
      messageType: "conversation",
      preview: textToSend,
      fromMe: true,
      senderName: instancia?.profileName || instancia?.instanceName || "Eu",
      participant: null,
      status: "PENDING",
      timestamp: nowSeconds,
      sentAt: nowIso,
      media: null,
    };

    setMensagens((prev) => [...prev, optimisticRow]);
    if (opts?.clearText !== false) {
      setTextoEnvio("");
    }

    try {
      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: getMatriculaLogada(),
          instanceName: instancia?.instanceName || undefined,
          remoteJid: conversaSelecionadaApiRemoteJid,
          text: textToSend,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const payload: unknown = contentType.toLowerCase().includes("application/json")
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao enviar mensagem";
        throw new Error(message);
      }

      setMensagens((prev) =>
        prev.map((item) => (item.id === optimisticId ? { ...item, status: "SERVER_ACK" } : item))
      );
      carregarMensagensConversa(conversaSelecionada, { limit: mensagensLimit }).catch(() => {});
      carregarConversas({ limit: conversasLimit }).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setError(message);
      setMensagens((prev) =>
        prev.map((item) => (item.id === optimisticId ? { ...item, status: "ERROR" } : item))
      );
    } finally {
      if (shouldLock) setEnviandoMensagem(false);
    }
  }, [
    carregarConversas,
    carregarMensagensConversa,
    conversaSelecionada,
    conversaSelecionadaApiRemoteJid,
    conversaSelecionadaGroupRemoteJid,
    conversasLimit,
    getBaseApi,
    getMatriculaLogada,
    headerLine,
    instancia,
    mensagensLimit,
    textoEnvio,
  ]);

  const selecionarAnexos = React.useCallback(() => {
    anexosInputRef.current?.click();
  }, []);

  const iniciarGravacaoAudio = React.useCallback(async () => {
    if (enviandoMensagem) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não suporta gravação de áudio.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Este navegador não suporta gravação de áudio.");
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const chosenMimeType = preferredTypes.find((type) => {
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch {
          return false;
        }
      });

      const recorder = new MediaRecorder(stream, chosenMimeType ? { mimeType: chosenMimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        mediaRecorderRef.current = null;
        setGravandoAudio(false);

        const blob = new Blob(chunks, { type: chosenMimeType || "audio/webm" });
        if (!blob.size) return;

        const maxFiles = 5;
        const maxBytes = 15 * 1024 * 1024;
        if (blob.size > maxBytes) {
          setError("O áudio gravado excede 15MB. Grave um áudio menor e tente novamente.");
          return;
        }

        const fileExt = (chosenMimeType || "").includes("ogg") ? "ogg" : "webm";
        const fileName = `audio-${Date.now()}.${fileExt}`;
        const file = new File([blob], fileName, { type: blob.type || "audio/webm" });
        const previewUrl = URL.createObjectURL(blob);
        const id = `mic-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        setAnexosEnvio((prev) => {
          if (prev.length >= maxFiles) {
            URL.revokeObjectURL(previewUrl);
            setError(`Você pode anexar no máximo ${maxFiles} arquivos por envio.`);
            return prev;
          }
          return [
            ...prev,
            {
              id,
              file,
              kind: "audio",
              previewUrl,
              fileName,
              mimetype: file.type || "audio/webm",
              size: file.size,
            },
          ];
        });
      };

      recorder.start();
      setError(null);
      setGravandoAudio(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.toLowerCase().includes("denied") || err.message.toLowerCase().includes("permission")
            ? "Permissão de microfone negada."
            : err.message
          : "Falha ao acessar o microfone.";
      setError(message);
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setGravandoAudio(false);
    }
  }, [enviandoMensagem]);

  const pararGravacaoAudio = React.useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
  }, []);

  const removerAnexo = React.useCallback((id: string) => {
    setAnexosEnvio((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const onSelecionarArquivos = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(event.target.files || []);
    event.target.value = "";

    const maxFiles = 5;
    const maxBytes = 15 * 1024 * 1024;
    const nextToAdd: AnexoEnvio[] = [];

    for (const file of rawFiles) {
      const mimetype = String(file.type || "").toLowerCase();
      const kind = mimetype.startsWith("image/")
        ? "image"
        : mimetype.startsWith("video/")
          ? "video"
          : null;
      if (!kind) continue;
      if (file.size > maxBytes) {
        setError(`O arquivo "${file.name}" excede 15MB. Reduza o tamanho e tente novamente.`);
        continue;
      }
      nextToAdd.push({
        id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        mimetype: file.type || (kind === "image" ? "image/*" : "video/*"),
        size: file.size,
      });
    }

    if (!nextToAdd.length) return;

    setAnexosEnvio((prev) => {
      const remaining = Math.max(0, maxFiles - prev.length);
      if (remaining <= 0) {
        nextToAdd.forEach((anexo) => {
          URL.revokeObjectURL(anexo.previewUrl);
        });
        setError(`Você pode anexar no máximo ${maxFiles} arquivos por envio.`);
        return prev;
      }
      const sliced = nextToAdd.slice(0, remaining);
      nextToAdd.slice(remaining).forEach((anexo) => {
        URL.revokeObjectURL(anexo.previewUrl);
      });
      return [...prev, ...sliced];
    });
  }, []);

  const enviarMidias = React.useCallback(async (files: AnexoEnvio[], captionText: string) => {
    if (!conversaSelecionada || !conversaSelecionadaApiRemoteJid) return;
    const remoteJid = conversaSelecionadaApiRemoteJid;
    const senderName = instancia?.profileName || instancia?.instanceName || "Eu";
    const nowIso = new Date().toISOString();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const shouldUseCaption = files.length === 1 && files[0]?.kind !== "audio" ? captionText.trim() : "";
    const headerLines = [headerLine];
    const captionToSend = files.length === 1 && files[0]?.kind !== "audio"
      ? `${headerLines.join("\n")}${shouldUseCaption ? `\n\n${shouldUseCaption}` : ""}`
      : "";

    for (const anexo of files) {
      const optimisticId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const optimisticRow: MensagemRow = {
        id: optimisticId,
        messageKeyId: null,
        chatName: conversaSelecionada.chatName,
        remoteJid,
        canonicalRemoteJid: conversaSelecionadaGroupRemoteJid || remoteJid || null,
        contactRemoteJid: conversaSelecionadaGroupRemoteJid || remoteJid || null,
        unreadMessages: 0,
        profilePicUrl: conversaSelecionada.profilePicUrl || null,
        messageType: anexo.kind,
        preview: captionToSend || (anexo.kind === "audio" ? "[Audio]" : ""),
        fromMe: true,
        senderName,
        participant: null,
        status: "PENDING",
        timestamp: nowSeconds,
        sentAt: nowIso,
        media: {
          kind: anexo.kind,
          sourceUrl: null,
          fileName: anexo.fileName,
          mimetype: anexo.mimetype,
          caption: captionToSend || null,
          canLoadHd: false,
        },
      };

      setMensagens((prev) => [...prev, optimisticRow]);
      setLoadedMediaByMessageId((prev) => ({
        ...prev,
        [optimisticId]: { src: anexo.previewUrl, fileName: anexo.fileName, mimetype: anexo.mimetype },
      }));

      try {
        const form = new FormData();
        form.append("instanceName", instancia?.instanceName || "");
        form.append("remoteJid", remoteJid || "");
        form.append("matricula", getMatriculaLogada());
        if (captionToSend) form.append("caption", captionToSend);
        form.append("file", anexo.file, anexo.fileName);

        const response = await fetch(`${getBaseApi()}/zaphub/mensagens/enviar-midia`, {
          method: "POST",
          body: form,
        });

        const contentType = response.headers.get("content-type") || "";
        const payload: unknown = contentType.toLowerCase().includes("application/json")
          ? await response.json()
          : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao enviar mídia";
          throw new Error(message);
        }

        setMensagens((prev) =>
          prev.map((item) => (item.id === optimisticId ? { ...item, status: "SERVER_ACK" } : item))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao enviar mídia";
        setError(message);
        setMensagens((prev) =>
          prev.map((item) => (item.id === optimisticId ? { ...item, status: "ERROR" } : item))
        );
      }
    }
    if (conversaSelecionada) {
      carregarMensagensConversa(conversaSelecionada, { limit: mensagensLimit }).catch(() => {});
    }
    carregarConversas({ limit: conversasLimit }).catch(() => {});
  }, [
    carregarConversas,
    carregarMensagensConversa,
    conversaSelecionada,
    conversaSelecionadaApiRemoteJid,
    conversaSelecionadaGroupRemoteJid,
    conversasLimit,
    getBaseApi,
    getMatriculaLogada,
    headerLine,
    instancia,
    mensagensLimit,
  ]);

  const enviarMensagem = React.useCallback(async () => {
    if (!conversaSelecionada || !conversaSelecionadaApiRemoteJid) return;
    const text = textoEnvio.trim();
    const anexos = anexosEnvio;
    const precisaTextoSeparado = Boolean(
      text &&
      (anexos.length > 1 || anexos.some((anexo) => anexo.kind === "audio"))
    );

    if (!anexos.length) {
      await enviarMensagemTexto();
      return;
    }

    setEnviandoMensagem(true);
    setError(null);

    try {
      if (precisaTextoSeparado) {
        await enviarMensagemTexto(text, { skipLock: true });
        await enviarMidias(anexos, "");
      } else {
        await enviarMidias(anexos, text);
        setTextoEnvio("");
      }
      setAnexosEnvio([]);
    } finally {
      setEnviandoMensagem(false);
    }
  }, [anexosEnvio, conversaSelecionada, enviarMensagemTexto, enviarMidias, textoEnvio]);

  const abrirModalEdicaoMensagem = React.useCallback((mensagem: MensagemRow) => {
    const permissao = getPermissaoEdicaoMensagem(mensagem);
    setMenuMensagemAbertoId(null);
    setMensagemEmEdicao(mensagem);
    setTextoEdicaoMensagem(getMensagemTextoEditavelSemCabecalho(mensagem));
    setErroEdicaoMensagem(null);
    setInfoEdicaoMensagem(null);

    if (permissao.allowed) {
      setAguardandoConfirmacaoEdicao(false);
      return;
    }

    const shouldWait =
      mensagem.fromMe &&
      (String(mensagem.status || "").toUpperCase() === "PENDING" || !mensagem.messageKeyId);

    if (!shouldWait) {
      setAguardandoConfirmacaoEdicao(false);
      setErroEdicaoMensagem(permissao.reason || "Esta mensagem não pode ser editada.");
      return;
    }

    setAguardandoConfirmacaoEdicao(true);
    setInfoEdicaoMensagem("Aguardando confirmação do envio para liberar a edição...");
    setErroEdicaoMensagem(null);
  }, [getMensagemTextoEditavelSemCabecalho, getPermissaoEdicaoMensagem]);

  const abrirModalExclusaoMensagem = React.useCallback((mensagem: MensagemRow) => {
    const permissao = getPermissaoExclusaoMensagem(mensagem);
    setMenuMensagemAbertoId(null);
    setMensagemEmExclusao(mensagem);
    setInfoExclusaoMensagem(null);
    setErroExclusaoMensagem(permissao.allowed ? null : permissao.reason || "Esta mensagem não pode ser excluída.");
  }, [getPermissaoExclusaoMensagem]);

  const fecharModalExclusaoMensagem = React.useCallback(() => {
    if (excluindoMensagem) return;
    setMensagemEmExclusao(null);
    setInfoExclusaoMensagem(null);
    setErroExclusaoMensagem(null);
  }, [excluindoMensagem]);

  const fecharModalEdicaoMensagem = React.useCallback(() => {
    if (salvandoEdicaoMensagem) return;
    setAguardandoConfirmacaoEdicao(false);
    setInfoEdicaoMensagem(null);
    setMensagemEmEdicao(null);
    setTextoEdicaoMensagem("");
    setErroEdicaoMensagem(null);
  }, [salvandoEdicaoMensagem]);

  const salvarEdicaoMensagem = React.useCallback(async () => {
    if (!mensagemEmEdicao) return;
    const textoLimpo = textoEdicaoMensagem.trim();
    if (!textoLimpo) {
      setErroEdicaoMensagem("Informe o texto atualizado da mensagem.");
      return;
    }

    const permissao = getPermissaoEdicaoMensagem(mensagemEmEdicao);
    if (!permissao.allowed) {
      setErroEdicaoMensagem(permissao.reason || "Esta mensagem não pode mais ser editada.");
      return;
    }

    if (aguardandoConfirmacaoEdicao) {
      setErroEdicaoMensagem("Aguarde a confirmação do envio antes de editar.");
      return;
    }

    const texto = `${headerLine}\n\n${textoLimpo}`;
    setSalvandoEdicaoMensagem(true);
    setErroEdicaoMensagem(null);
    setError(null);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: getMatriculaLogada(),
          instanceName: instancia?.instanceName || instanciaAtivaNome || undefined,
          remoteJid:
            mensagemEmEdicao.remoteJid ||
            mensagemEmEdicao.canonicalRemoteJid ||
            mensagemEmEdicao.contactRemoteJid,
          messageKeyId: mensagemEmEdicao.messageKeyId,
          participant: mensagemEmEdicao.participant,
          text: texto,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const payload: unknown = contentType.toLowerCase().includes("application/json")
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao editar mensagem";
        throw new Error(message);
      }

      setMensagens((prev) =>
        prev.map((item) => {
          if (item.id !== mensagemEmEdicao.id) return item;
          const mediaKind = normalizeMediaKind(item.media?.kind || item.messageType);
          if (mediaKind === "image" || mediaKind === "video") {
            return {
              ...item,
              preview: texto,
              sentAt: new Date().toISOString(),
              status: "EDITED",
              media: item.media ? { ...item.media, caption: texto } : item.media,
            };
          }
          return {
            ...item,
            preview: texto,
            sentAt: new Date().toISOString(),
            status: "EDITED",
          };
        })
      );
      fecharModalEdicaoMensagem();
      if (conversaSelecionada) {
        carregarMensagensConversa(conversaSelecionada, { limit: mensagensLimit }).catch(() => {});
      }
      carregarConversas({ limit: conversasLimit }).catch(() => {});
    } catch (err) {
      setErroEdicaoMensagem(err instanceof Error ? err.message : "Erro ao editar mensagem");
    } finally {
      setSalvandoEdicaoMensagem(false);
    }
  }, [
    aguardandoConfirmacaoEdicao,
    carregarConversas,
    carregarMensagensConversa,
    conversaSelecionada,
    conversasLimit,
    fecharModalEdicaoMensagem,
    getBaseApi,
    getMatriculaLogada,
    getPermissaoEdicaoMensagem,
    headerLine,
    instancia?.instanceName,
    instanciaAtivaNome,
    mensagensLimit,
    mensagemEmEdicao,
    textoEdicaoMensagem,
  ]);

  const confirmarExclusaoMensagem = React.useCallback(async () => {
    if (!mensagemEmExclusao) return;
    const permissao = getPermissaoExclusaoMensagem(mensagemEmExclusao);
    if (!permissao.allowed) {
      setErroExclusaoMensagem(permissao.reason || "Esta mensagem não pode ser excluída.");
      return;
    }

    const instanceNameValue = String(instancia?.instanceName || instanciaAtivaNome || "").trim();
    const remoteJidValue = String(
      mensagemEmExclusao.remoteJid || mensagemEmExclusao.canonicalRemoteJid || mensagemEmExclusao.contactRemoteJid || ""
    ).trim();
    const messageKeyIdValue = String(mensagemEmExclusao.messageKeyId || "").trim();
    if (!instanceNameValue) {
      setErroExclusaoMensagem("instanceName é obrigatório.");
      return;
    }
    if (!remoteJidValue) {
      setErroExclusaoMensagem("remoteJid é obrigatório.");
      return;
    }
    if (!messageKeyIdValue) {
      setErroExclusaoMensagem("messageKeyId é obrigatório.");
      return;
    }

    setExcluindoMensagem(true);
    setErroExclusaoMensagem(null);
    setInfoExclusaoMensagem("Excluindo mensagem...");
    setError(null);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/excluir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: getMatriculaLogada(),
          instanceName: instanceNameValue,
          remoteJid: remoteJidValue,
          keyRemoteJid: remoteJidValue,
          messageKeyId: messageKeyIdValue,
          participant: mensagemEmExclusao.participant,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const payload: unknown = contentType.toLowerCase().includes("application/json")
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao excluir mensagem";
        throw new Error(message);
      }

      setMensagens((prev) =>
        prev.map((item) => {
          if (item.id === mensagemEmExclusao.id) return { ...item, status: "DELETED", isDeleted: true, deletedBy: headerLine };
          if (mensagemEmExclusao.messageKeyId && item.messageKeyId === mensagemEmExclusao.messageKeyId) {
            return { ...item, status: "DELETED", isDeleted: true, deletedBy: headerLine };
          }
          return item;
        })
      );
      saveDeletedBy(remoteJidValue, messageKeyIdValue, headerLine);

      fecharModalExclusaoMensagem();
      if (conversaSelecionada) {
        carregarMensagensConversa(conversaSelecionada, { limit: mensagensLimit }).catch(() => {});
      }
      carregarConversas({ limit: conversasLimit }).catch(() => {});
    } catch (err) {
      setErroExclusaoMensagem(err instanceof Error ? err.message : "Erro ao excluir mensagem");
      setInfoExclusaoMensagem(null);
    } finally {
      setExcluindoMensagem(false);
    }
  }, [
    carregarConversas,
    carregarMensagensConversa,
    conversaSelecionada,
    conversasLimit,
    fecharModalExclusaoMensagem,
    getBaseApi,
    getMatriculaLogada,
    getPermissaoExclusaoMensagem,
    headerLine,
    instancia?.instanceName,
    instanciaAtivaNome,
    mensagensLimit,
    mensagemEmExclusao,
  ]);

  const carregarMidiaHd = React.useCallback(async (mensagem: MensagemRow, opts?: { autoplay?: boolean }) => {
    setLoadingMediaByMessageId((prev) => ({ ...prev, [mensagem.id]: true }));
    setMediaLoadErrorByMessageId((prev) => ({ ...prev, [mensagem.id]: null }));

    try {
      const response = await fetch(`${getBaseApi()}/zaphub/mensagens/midia-hd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: mensagem.id, matricula: getMatriculaLogada() }),
      });
      const contentType = response.headers.get("content-type") || "";
      const payload: unknown = contentType.toLowerCase().includes("application/json")
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao carregar mídia em HD";
        throw new Error(message);
      }

      const contentUrl =
        payload && typeof payload === "object" && "contentUrl" in payload && typeof (payload as { contentUrl?: unknown }).contentUrl === "string"
          ? (payload as { contentUrl: string }).contentUrl
          : "";

      if (!contentUrl) {
        throw new Error("A mídia retornou sem conteúdo para exibição");
      }

      const fileName =
        payload && typeof payload === "object" && "fileName" in payload && typeof (payload as { fileName?: unknown }).fileName === "string"
          ? (payload as { fileName: string }).fileName
          : mensagem.media?.fileName || null;
      const mimetype =
        payload && typeof payload === "object" && "mimetype" in payload && typeof (payload as { mimetype?: unknown }).mimetype === "string"
          ? (payload as { mimetype: string }).mimetype
          : mensagem.media?.mimetype || null;

      setLoadedMediaByMessageId((prev) => ({
        ...prev,
        [mensagem.id]: { src: contentUrl, fileName, mimetype },
      }));

      if (opts?.autoplay && normalizeMediaKind(mensagem.media?.kind || mensagem.messageType) === "audio") {
        toggleAudioPlayback(mensagem.id, contentUrl, true);
      }
    } catch (err) {
      setMediaLoadErrorByMessageId((prev) => ({
        ...prev,
        [mensagem.id]: err instanceof Error ? err.message : "Falha ao carregar mídia em HD",
      }));
    } finally {
      setLoadingMediaByMessageId((prev) => ({ ...prev, [mensagem.id]: false }));
    }
  }, [getBaseApi, getMatriculaLogada, toggleAudioPlayback]);

  const registrarErroMidia = React.useCallback((messageId: string) => {
    setMediaLoadErrorByMessageId((prev) => ({ ...prev, [messageId]: "Falha ao carregar mídia em HD" }));
  }, []);

  React.useEffect(() => {
    if (!show || loading || !conversaSelecionada) return;

    const frameId = window.requestAnimationFrame(() => {
      const container = mensagensContainerRef.current;
      if (!container) return;
      const shouldScroll = shouldAutoScrollRef.current || isMessagesNearBottomRef.current;
      if (!shouldScroll) return;
      container.scrollTop = container.scrollHeight;
      shouldAutoScrollRef.current = false;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [conversaSelecionada, conversaSelecionadaId, mensagens.length, loading, show]);

  if (!show) return null;

  return (
    <>
      <style>
        {`
          @keyframes zaphubStatusPulse {
            0%, 100% { transform: scale(1); opacity: 0.88; }
            50% { transform: scale(1.12); opacity: 1; }
          }

          @keyframes zaphubAudioBarPulse {
            0%, 100% { transform: scaleY(0.45); opacity: 0.65; }
            50% { transform: scaleY(1); opacity: 1; }
          }

          @keyframes zaphubSpeedPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }

          .zaphubIconButton {
            width: 42px;
            height: 42px;
            padding: 0;
            border: none;
            background: transparent;
            border-radius: 9999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            transition: background-color 120ms ease, color 120ms ease;
          }

          .zaphubIconButton:hover {
            background-color: rgba(108, 117, 125, 0.18);
            color: #495057;
          }

          .zaphubIconButton:focus-visible {
            outline: none;
            background-color: rgba(108, 117, 125, 0.22);
            box-shadow: 0 0 0 2px rgba(108, 117, 125, 0.25);
            color: #495057;
          }

          .zaphubIconButton:disabled {
            opacity: 0.55;
          }

          .zaphubIconButton--recording {
            background-color: #dc3545;
            color: #ffffff;
          }

          .zaphubIconButton--recording:hover {
            background-color: #bb2d3b;
            color: #ffffff;
          }

          .zaphubIconButton--recording:focus-visible {
            background-color: #dc3545;
            color: #ffffff;
            box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.35);
          }

          .zaphubActionWithLabel {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
            min-width: 44px;
          }

          .zaphubActionLabel {
            font-size: 0.68rem;
            line-height: 1;
            color: currentColor;
            user-select: none;
          }

          .zaphubSendButton {
            width: 42px;
            height: 42px;
            padding: 0;
            border: none;
            background: transparent;
            border-radius: 9999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #0d6efd;
            transition: background-color 120ms ease, color 120ms ease;
          }

          .zaphubSendButton:hover {
            background-color: rgba(13, 110, 253, 0.18);
            color: #0b5ed7;
          }

          .zaphubSendButton:focus-visible {
            outline: none;
            background-color: rgba(13, 110, 253, 0.22);
            box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
            color: #0b5ed7;
          }

          .zaphubSendButton:disabled {
            opacity: 0.55;
          }

          .zaphubInstanceButton {
            border-radius: 12px !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
            background: var(--zaphub-instance-bg, #0d6efd) !important;
            color: #ffffff !important;
            box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
            transition: background-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, border-color 120ms ease;
          }

          .zaphubInstanceButton:hover {
            background-color: #6f42c1 !important;
            border-color: #6f42c1 !important;
            box-shadow: 0 14px 28px rgba(111, 66, 193, 0.28);
          }

          .zaphubInstanceButton:focus-visible {
            outline: none;
            background-color: #6f42c1 !important;
            border-color: #6f42c1 !important;
            box-shadow: 0 0 0 2px rgba(111, 66, 193, 0.28), 0 14px 28px rgba(111, 66, 193, 0.28);
          }

          .zaphubInstanceButton.is-active {
            background-color: #6f42c1 !important;
            border-color: #6f42c1 !important;
            box-shadow: 0 14px 30px rgba(111, 66, 193, 0.32);
          }

          .zaphubInstanceButton--puxadas:not(.is-active) {
            background: #fd7e14 !important;
            border-color: #fd7e14 !important;
            box-shadow: 0 12px 26px rgba(253, 126, 20, 0.22);
          }

          .zaphubInstanceButton--puxadas:not(.is-active):hover {
            background-color: #e96b0a !important;
            border-color: #e96b0a !important;
            box-shadow: 0 14px 28px rgba(253, 126, 20, 0.3);
          }

          .zaphubInstanceButton--puxadas:not(.is-active):focus-visible {
            outline: none;
            background-color: #e96b0a !important;
            border-color: #e96b0a !important;
            box-shadow: 0 0 0 2px rgba(253, 126, 20, 0.28), 0 14px 28px rgba(253, 126, 20, 0.3);
          }

          .zaphubAudioPreview {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.88);
            padding: 8px 10px;
            box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
            cursor: pointer;
            transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
          }

          .zaphubAudioPreview:hover {
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 12px 26px rgba(15, 23, 42, 0.16);
            transform: translateY(-1px);
          }

          .zaphubAudioPreview:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
           }

          .zaphubAudioPlay {
            width: 30px;
            height: 30px;
            border-radius: 9999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #6f42c1;
            color: #ffffff;
            flex-shrink: 0;
          }

          .zaphubAudioBars {
            display: inline-flex;
            align-items: flex-end;
            gap: 3px;
            height: 16px;
            flex-shrink: 0;
          }

          .zaphubAudioBar {
            width: 3px;
            height: 100%;
            border-radius: 9999px;
            background: rgba(111, 66, 193, 0.95);
            transform-origin: bottom;
            transform: scaleY(0.45);
            opacity: 0.65;
          }

          .zaphubAudioPreview.is-animating .zaphubAudioBar {
            animation: zaphubAudioBarPulse 900ms ease-in-out infinite;
          }

          .zaphubAudioPreview.is-animating .zaphubAudioBar:nth-child(2) { animation-delay: 120ms; }
          .zaphubAudioPreview.is-animating .zaphubAudioBar:nth-child(3) { animation-delay: 240ms; }
          .zaphubAudioPreview.is-animating .zaphubAudioBar:nth-child(4) { animation-delay: 360ms; }

          .zaphubAudioLabel {
            font-size: 0.82rem;
            line-height: 1.2;
            color: #111827;
            user-select: none;
            white-space: nowrap;
          }

          .zaphubAudioMeta {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-left: 2px;
          }

          .zaphubAudioSpeed {
            border: 1px solid rgba(111, 66, 193, 0.4);
            background: rgba(111, 66, 193, 0.10);
            color: #6f42c1;
            border-radius: 9999px;
            font-size: 0.74rem;
            line-height: 1;
            padding: 5px 8px;
            cursor: pointer;
            user-select: none;
            transition: background-color 120ms ease, transform 120ms ease;
          }

          .zaphubAudioSpeed:hover {
            background: rgba(111, 66, 193, 0.18);
          }

          .zaphubAudioSpeed.is-fast {
            animation: zaphubSpeedPulse 1.1s ease-in-out infinite;
          }

          .zaphubAudioProgress {
            height: 6px;
            border-radius: 9999px;
            background: rgba(17, 24, 39, 0.10);
            overflow: hidden;
            width: 140px;
            flex-shrink: 0;
          }

          .zaphubAudioProgressFill {
            height: 100%;
            width: 0%;
            background: rgba(111, 66, 193, 0.95);
            border-radius: 9999px;
          }

          .zaphubWhatsAppBackground {
            background-color: #efeae2;
            background-image:
              radial-gradient(circle at 8px 10px, rgba(0, 0, 0, 0.035) 1px, transparent 1px),
              radial-gradient(circle at 22px 18px, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              radial-gradient(circle at 16px 26px, rgba(0, 0, 0, 0.02) 1px, transparent 1px),
              linear-gradient(rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.22));
            background-size: 32px 32px, 32px 32px, 32px 32px, 100% 100%;
            background-position: 0 0, 8px 12px, 14px 2px, 0 0;
          }

          .zaphubComposerArea {
            padding: 10px 12px;
          }

          .zaphubComposerBar {
            display: flex;
            align-items: flex-end;
            gap: 10px;
            width: 100%;
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 0;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
            padding: 8px 10px;
          }

          .zaphubComposerTextarea {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            resize: none;
            padding: 6px 8px;
            line-height: 1.25;
          }

          .zaphubComposerTextarea:focus {
            box-shadow: none !important;
          }

          .zaphubInfoCard {
            background: rgba(13, 110, 253, 0.08);
            border: 1px solid rgba(13, 110, 253, 0.16);
            border-radius: 0;
            box-shadow: 0 10px 24px rgba(13, 110, 253, 0.12);
            padding: 10px 12px;
            min-width: 160px;
          }
        `}
      </style>
      <div
        className="modal-backdrop fade show"
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-fullscreen" role="document" style={{ margin: 0 }}>
          <div className="modal-content border-0" style={{ height: "100vh", overflow: "hidden" }}>
            <div className="modal-header px-4 py-2 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center flex-grow-1" style={{ gap: "10px" }}>
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle text-white"
                  style={{ width: "38px", height: "38px", backgroundColor: "#0d6efd" }}
                >
                  <ChatDotsFill size={16} />
                </div>
                <div>
                  <h5 className="modal-title mb-0">Mensagens</h5>
                  <small className="text-muted">Central de mensagens do ChatHub</small>
                </div>
              </div>
              <div className="d-flex align-items-center ms-auto">
                <div className="zaphubActionWithLabel me-2" style={{ color: "#0d6efd" }}>
                  <button
                    type="button"
                    className="zaphubSendButton"
                    onClick={() => atualizarCentral().catch(() => {})}
                    disabled={loading || abaConversasCarregando}
                    title={loading || abaConversasCarregando ? "Atualizando..." : "Atualizar"}
                    aria-label={loading || abaConversasCarregando ? "Atualizando..." : "Atualizar"}
                  >
                    <ArrowClockwise size={16} />
                  </button>
                  <div className="zaphubActionLabel">{loading || abaConversasCarregando ? "Atualizando" : "Atualizar"}</div>
                </div>
                <div ref={usuarioMenuRef} className="position-relative zaphubActionWithLabel me-2" style={{ color: "#0d6efd" }}>
                  <button
                    type="button"
                    className="zaphubSendButton"
                    onClick={() => {
                      if (!usuarioLogado) carregarUsuarioLogado();
                      setShowUsuarioMenu((prev) => !prev);
                    }}
                    title="Usuário"
                    aria-label="Usuário"
                  >
                    <PersonCircle size={16} />
                  </button>
                  <div className="zaphubActionLabel">Usuário</div>
                  {showUsuarioMenu ? (
                    <div
                      className="dropdown-menu show position-absolute end-0 mt-2 shadow border-0"
                      style={{
                        top: "100%",
                        zIndex: 1200,
                        minWidth: "280px",
                        borderRadius: 0,
                      }}
                    >
                      {usuarioLogado ? (
                        <>
                          <div className="px-4 py-3 bg-light border-bottom rounded-0">
                            <h6 className="fw-bold text-primary mb-1">
                              {String(usuarioLogado.usuario || "Usuário")}
                            </h6>
                            {usuarioLogado.nome && String(usuarioLogado.nome).trim() ? (
                              <small className="text-muted d-block">{String(usuarioLogado.nome)}</small>
                            ) : (
                              <small className="text-muted d-block">Portal GestFácil</small>
                            )}
                          </div>
                          <div className="p-2">
                            <div className="px-3 py-2">
                              <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>USUÁRIO</small>
                              <span className="fw-medium">{String(usuarioLogado.usuario || "-")}</span>
                            </div>
                            {usuarioLogado.nome && String(usuarioLogado.nome).trim() ? (
                              <div className="px-3 py-2">
                                <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>NOME</small>
                                <span className="fw-medium">{String(usuarioLogado.nome)}</span>
                              </div>
                            ) : null}
                            <div className="px-3 py-2">
                              <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>MATRÍCULA</small>
                              <span className="fw-medium">{String(usuarioLogado.matricula || "-")}</span>
                            </div>
                            <div className="px-3 py-2">
                              <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>FILIAL</small>
                              <span className="fw-medium">{String(usuarioLogado.codfilial || "Matriz")}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-3 text-center text-muted">Usuário não identificado</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="zaphubActionWithLabel" style={{ color: "#0d6efd" }}>
                  <button
                    type="button"
                    className="zaphubSendButton"
                    onClick={onClose}
                    title="Voltar"
                    aria-label="Voltar"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="zaphubActionLabel">Voltar</div>
                </div>
              </div>
            </div>
            <div
              className="modal-body p-0"
              style={{ background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)", overflow: "hidden" }}
            >
              <div className="container-fluid h-100 p-0" style={{ overflow: "hidden" }}>
                <div className="row g-0 h-100" style={{ overflow: "hidden" }}>
                  <div className="col-12">
                    <div className="card h-100 border-0" style={{ ...cardStyle, height: MODAL_CONTENT_HEIGHT, overflow: "hidden" }}>
                      <div className="card-body p-0 d-flex flex-column" style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
                        <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between" style={{ gap: "8px" }}>
                          <div
                            className="bg-white border rounded-0 px-3 py-1 flex-grow-1"
                            style={{ borderColor: "rgba(0,0,0,0.08)" }}
                          >
                            {instanciasDisponiveis.length > 0 ? (
                              <div>
                                <div className="fw-semibold mb-2" style={{ fontSize: "0.9rem", lineHeight: 1.15 }}>
                                  Instancias vinculadas ao usuario
                                </div>
                                <div className="d-flex flex-column flex-lg-row align-items-center align-items-lg-stretch" style={{ gap: "10px" }}>
                                  {instanciasClassificadas.televendasPrincipal.length > 0 ? (
                                    <div
                                      className="bg-white"
                                      style={{
                                        minWidth: "260px",
                                        borderRadius: 0,
                                        padding: "8px 10px",
                                      }}
                                    >
                                      <div className="text-muted mb-1" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                                        Televendas principal
                                      </div>
                                      <div className="d-flex flex-wrap align-items-center" style={{ gap: "8px" }}>
                                        {instanciasClassificadas.televendasPrincipal.map((item) => {
                                          const ativa = item.instanceName === instanciaAtivaNome && modoVisualizacao === "normal";
                                          const instanceKey = normalizeInstanceKey(item.instanceName);
                                          const unreadCount = getUnreadCountForInstance(unreadCountsByInstance, item.instanceName);
                                          return (
                                            <div
                                              key={instanceKey}
                                              data-instance-key={instanceKey}
                                              className="position-relative d-inline-flex"
                                              style={{ overflow: "visible", paddingTop: unreadCount > 0 ? "2px" : undefined }}
                                            >
                                              <button
                                                type="button"
                                                className={`btn btn-sm d-inline-flex align-items-center zaphubInstanceButton ${ativa ? "is-active" : ""}`}
                                                style={{
                                                  gap: "6px",
                                                  overflow: "visible",
                                                  ["--zaphub-instance-bg" as never]: "#198754",
                                                }}
                                                onClick={() => selecionarInstancia(item)}
                                              >
                                                <ChatDotsFill size={14} />
                                                <span className="d-flex flex-column align-items-start" style={{ lineHeight: 1.1 }}>
                                                  <span className="fw-semibold">{item.instanceName}</span>
                                                  {item.profileName &&
                                                  String(item.profileName).trim() &&
                                                  String(item.profileName).trim().toLowerCase() !== String(item.instanceName).trim().toLowerCase() ? (
                                                    <span className="opacity-75" style={{ fontSize: "0.68rem" }}>
                                                      {item.profileName}
                                                    </span>
                                                  ) : null}
                                                </span>
                                              </button>
                                              {unreadCount > 0 ? (
                                                <span
                                                  className="badge rounded-pill bg-danger text-white position-absolute d-inline-flex align-items-center justify-content-center"
                                                  style={{
                                                    top: "-9px",
                                                    right: "-6px",
                                                    minWidth: unreadCount > 99 ? "28px" : "20px",
                                                    height: "20px",
                                                    fontSize: "0.66rem",
                                                    lineHeight: "20px",
                                                    padding: unreadCount > 99 ? "0 6px" : 0,
                                                    zIndex: 3,
                                                    pointerEvents: "none",
                                                  }}
                                                >
                                                  {unreadCount > 99 ? "99+" : unreadCount}
                                                </span>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  {usuarioTemTelevendasPrincipal ? (
                                    <div
                                      className="bg-white"
                                      style={{
                                        minWidth: "220px",
                                        borderRadius: 0,
                                        padding: "8px 10px",
                                      }}
                                    >
                                      <div className="text-muted mb-1" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                                        Puxadas
                                      </div>
                                      <div className="d-flex flex-wrap align-items-center" style={{ gap: "8px" }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm d-inline-flex align-items-center zaphubInstanceButton zaphubInstanceButton--puxadas ${instanciaAtivaEhPuxadas ? "is-active" : ""}`}
                                          style={{
                                            gap: "6px",
                                            overflow: "visible",
                                            ["--zaphub-instance-bg" as never]: "#fd7e14",
                                          }}
                                          onClick={selecionarPuxadas}
                                        >
                                          <InboxFill size={14} />
                                          <span className="d-flex flex-column align-items-start" style={{ lineHeight: 1.1 }}>
                                            <span className="fw-semibold">Minhas puxadas</span>
                                            <span className="opacity-75" style={{ fontSize: "0.68rem" }}>
                                              Mensagens atribuídas a você
                                            </span>
                                          </span>
                                          {conversasPuxadasCount > 0 ? (
                                            <span
                                              className={`badge rounded-pill ms-1 ${instanciaAtivaEhPuxadas ? "bg-white text-primary" : "bg-white"}`}
                                              style={{
                                                fontSize: "0.66rem",
                                                minWidth: "18px",
                                                color: instanciaAtivaEhPuxadas ? undefined : "#fd7e14",
                                              }}
                                            >
                                              {conversasPuxadasCount > 99 ? "99+" : conversasPuxadasCount}
                                            </span>
                                          ) : null}
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm d-inline-flex align-items-center zaphubInstanceButton ${instanciaAtivaEhEncerradas ? "is-active" : ""}`}
                                          style={{
                                            gap: "6px",
                                            overflow: "visible",
                                            ["--zaphub-instance-bg" as never]: "#6c757d",
                                          }}
                                          onClick={selecionarEncerradas}
                                        >
                                          <ArchiveFill size={14} />
                                          <span className="d-flex flex-column align-items-start" style={{ lineHeight: 1.1 }}>
                                            <span className="fw-semibold">Encerradas</span>
                                            <span className="opacity-75" style={{ fontSize: "0.68rem" }}>
                                              Conversas finalizadas
                                            </span>
                                          </span>
                                          {conversasEncerradasCount > 0 ? (
                                            <span
                                              className="badge rounded-pill bg-white text-secondary ms-1"
                                              style={{ fontSize: "0.66rem", minWidth: "18px" }}
                                            >
                                              {conversasEncerradasCount > 99 ? "99+" : conversasEncerradasCount}
                                            </span>
                                          ) : null}
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}

                                  {instanciasClassificadas.meuNumero.length > 0 ? (
                                    <div
                                      className="bg-white"
                                      style={{
                                        minWidth: "220px",
                                        borderRadius: 0,
                                        padding: "8px 10px",
                                      }}
                                    >
                                      <div className="text-muted mb-1" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                                        Meu número
                                      </div>
                                      <div className="d-flex flex-wrap align-items-center" style={{ gap: "8px" }}>
                                        {instanciasClassificadas.meuNumero.map((item) => {
                                          const ativa = item.instanceName === instanciaAtivaNome;
                                          const instanceKey = normalizeInstanceKey(item.instanceName);
                                          const unreadCount = getUnreadCountForInstance(unreadCountsByInstance, item.instanceName);
                                          return (
                                            <div
                                              key={instanceKey}
                                              data-instance-key={instanceKey}
                                              className="position-relative d-inline-flex"
                                              style={{ overflow: "visible", paddingTop: unreadCount > 0 ? "2px" : undefined }}
                                            >
                                              <button
                                                type="button"
                                                className={`btn btn-sm d-inline-flex align-items-center zaphubInstanceButton ${ativa ? "is-active" : ""}`}
                                                style={{
                                                  gap: "6px",
                                                  overflow: "visible",
                                                  ["--zaphub-instance-bg" as never]: "#0d6efd",
                                                }}
                                                onClick={() => selecionarInstancia(item)}
                                              >
                                                <PersonCircle size={14} />
                                                <span className="d-flex flex-column align-items-start" style={{ lineHeight: 1.1 }}>
                                                  <span className="fw-semibold">{item.instanceName}</span>
                                                  {item.profileName &&
                                                  String(item.profileName).trim() &&
                                                  String(item.profileName).trim().toLowerCase() !== String(item.instanceName).trim().toLowerCase() ? (
                                                    <span className="opacity-75" style={{ fontSize: "0.68rem" }}>
                                                      {item.profileName}
                                                    </span>
                                                  ) : null}
                                                </span>
                                                <span
                                                  className="badge rounded-pill"
                                                  style={{
                                                    backgroundColor: "rgba(255, 255, 255, 0.18)",
                                                    color: "#ffffff",
                                                    fontSize: "0.66rem",
                                                    padding: "2px 8px",
                                                  }}
                                                >
                                                  Meu
                                                </span>
                                              </button>
                                              {unreadCount > 0 ? (
                                                <span
                                                  className="badge rounded-pill bg-danger text-white position-absolute d-inline-flex align-items-center justify-content-center"
                                                  style={{
                                                    top: "-9px",
                                                    right: "-6px",
                                                    minWidth: unreadCount > 99 ? "28px" : "20px",
                                                    height: "20px",
                                                    fontSize: "0.66rem",
                                                    lineHeight: "20px",
                                                    padding: unreadCount > 99 ? "0 6px" : 0,
                                                    zIndex: 3,
                                                    pointerEvents: "none",
                                                  }}
                                                >
                                                  {unreadCount > 99 ? "99+" : unreadCount}
                                                </span>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  {instanciasClassificadas.outrasInstancias.length > 0 ? (
                                    <div
                                      className="bg-white flex-grow-1"
                                      style={{
                                        borderRadius: 0,
                                        padding: "8px 10px",
                                      }}
                                    >
                                      <div className="text-muted mb-1" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                                        Instâncias permitidas
                                      </div>
                                      <div className="d-flex flex-wrap align-items-center" style={{ gap: "8px" }}>
                                        {instanciasClassificadas.outrasInstancias.map((item) => {
                                          const ativa = item.instanceName === instanciaAtivaNome;
                                          const instanceKey = normalizeInstanceKey(item.instanceName);
                                          const unreadCount = getUnreadCountForInstance(unreadCountsByInstance, item.instanceName);
                                          return (
                                            <div
                                              key={instanceKey}
                                              data-instance-key={instanceKey}
                                              className="position-relative d-inline-flex"
                                              style={{ overflow: "visible", paddingTop: unreadCount > 0 ? "2px" : undefined }}
                                            >
                                              <button
                                                type="button"
                                                className={`btn btn-sm d-inline-flex align-items-center zaphubInstanceButton ${ativa ? "is-active" : ""}`}
                                                style={{
                                                  gap: "6px",
                                                  overflow: "visible",
                                                  ["--zaphub-instance-bg" as never]: "#0d6efd",
                                                }}
                                                onClick={() => selecionarInstancia(item)}
                                              >
                                                <ChatDotsFill size={14} />
                                                <span className="d-flex flex-column align-items-start" style={{ lineHeight: 1.1 }}>
                                                  <span className="fw-semibold">{item.instanceName}</span>
                                                  {item.profileName &&
                                                  String(item.profileName).trim() &&
                                                  String(item.profileName).trim().toLowerCase() !== String(item.instanceName).trim().toLowerCase() ? (
                                                    <span className="opacity-75" style={{ fontSize: "0.68rem" }}>
                                                      {item.profileName}
                                                    </span>
                                                  ) : null}
                                                </span>
                                              </button>
                                              {unreadCount > 0 ? (
                                                <span
                                                  className="badge rounded-pill bg-danger text-white position-absolute d-inline-flex align-items-center justify-content-center"
                                                  style={{
                                                    top: "-9px",
                                                    right: "-6px",
                                                    minWidth: unreadCount > 99 ? "28px" : "20px",
                                                    height: "20px",
                                                    fontSize: "0.66rem",
                                                    lineHeight: "20px",
                                                    padding: unreadCount > 99 ? "0 6px" : 0,
                                                    zIndex: 3,
                                                    pointerEvents: "none",
                                                  }}
                                                >
                                                  {unreadCount > 99 ? "99+" : unreadCount}
                                                </span>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : semPermissaoInstancias ? (
                              <div className="py-2">
                                <div className="fw-semibold" style={{ fontSize: "0.86rem" }}>
                                  Você não possui permissão para nenhuma instância.
                                </div>
                                <div className="text-muted" style={{ fontSize: "0.78rem", lineHeight: 1.25 }}>
                                  Solicite ao administrador o acesso às instâncias no Config &gt; Acessos.
                                </div>
                              </div>
                            ) : null}

                          </div>
                        </div>

                        {error && <div className="alert alert-danger py-2">{error}</div>}

                        {semPermissaoInstancias ? (
                          <div className="d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center p-4">
                            <div
                              className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-3"
                              style={{ width: "72px", height: "72px", backgroundColor: "#dc3545" }}
                            >
                              <ExclamationTriangleFill size={30} />
                            </div>
                            <h3 className="h5 fw-bold mb-2">Sem permissão</h3>
                            <p className="text-muted mb-0" style={{ maxWidth: "520px" }}>
                              Você não possui permissão para visualizar nenhuma instância no momento.
                            </p>
                          </div>
                        ) : !instanciaAtivaNome ? (
                          <div className="d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center">
                            <div
                              className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-3"
                              style={{ width: "72px", height: "72px", backgroundColor: "#198754" }}
                            >
                              <ChatDotsFill size={30} />
                            </div>
                            <h3 className="h5 fw-bold mb-2">Selecione uma instância</h3>
                            <p className="text-muted mb-0" style={{ maxWidth: "520px" }}>
                              Primeiro selecione uma instância acima para carregar as conversas.
                            </p>
                          </div>
                        ) : (
                          <div className="row g-0 flex-grow-1" style={{ minHeight: 0, height: PAINEIS_HEIGHT, maxHeight: PAINEIS_HEIGHT, overflow: "hidden" }}>
                            <div className="col-12 col-xl-4 d-flex" style={{ minHeight: 0 }}>
                              <div className="border rounded-0 h-100 bg-white d-flex flex-column flex-grow-1" style={{ borderColor: "rgba(0,0,0,0.08)", overflow: "hidden", minHeight: 0 }}>
                                <div className="px-3 py-2 border-bottom bg-light">
                                  <div className="d-flex align-items-center justify-content-between" style={{ gap: "10px" }}>
                                    <div className="d-flex align-items-center" style={{ gap: "8px", minWidth: 0 }}>
                                      <ChatDotsFill size={14} className="text-muted flex-shrink-0" />
                                      <div className="fw-semibold text-truncate">Conversas</div>
                                    </div>
                                    {instanciaAtivaEhTelevendas ? (
                                      <span
                                        className="badge rounded-pill bg-white border text-success d-inline-flex align-items-center flex-shrink-0"
                                        style={{ gap: "6px", borderColor: "rgba(0,0,0,0.12)", fontSize: "0.72rem", padding: "6px 10px" }}
                                      >
                                        <LightningChargeFill size={12} />
                                        <span className="fw-semibold">Televendas principal</span>
                                      </span>
                                    ) : null}
                                    {instanciaAtivaEhPuxadas ? (
                                      <span
                                        className="badge rounded-pill bg-white border d-inline-flex align-items-center flex-shrink-0"
                                        style={{ gap: "6px", borderColor: "rgba(111,66,193,0.25)", color: "#6f42c1", fontSize: "0.72rem", padding: "6px 10px" }}
                                      >
                                        <InboxFill size={12} />
                                        <span className="fw-semibold">Puxadas</span>
                                      </span>
                                    ) : null}
                                    {instanciaAtivaEhEncerradas ? (
                                      <span
                                        className="badge rounded-pill bg-white border d-inline-flex align-items-center flex-shrink-0"
                                        style={{ gap: "6px", borderColor: "rgba(108,117,125,0.35)", color: "#6c757d", fontSize: "0.72rem", padding: "6px 10px" }}
                                      >
                                        <ArchiveFill size={12} />
                                        <span className="fw-semibold">Encerradas</span>
                                      </span>
                                    ) : null}
                                  </div>

                                  <div
                                    className="text-muted d-flex align-items-center mt-1"
                                    style={{ fontSize: "0.76rem", lineHeight: 1.15, gap: "6px" }}
                                  >
                                    <InfoCircleFill size={12} className="flex-shrink-0" />
                                    <span className="text-truncate">
                                      {abaConversasCarregando
                                        ? "Carregando conversas..."
                                        : instanciaAtivaEhEncerradas
                                        ? conversasFiltradas.length
                                          ? `Exibindo ${Math.min(conversasVisiveisLimit, conversasFiltradas.length)} de ${conversasFiltradas.length} conversas encerradas.`
                                          : "Nenhuma conversa encerrada ainda."
                                        : conversasFiltradas.length > conversasVisiveisLimit
                                        ? `Exibindo ${Math.min(conversasVisiveisLimit, conversasFiltradas.length)} de ${conversasFiltradas.length} conversas.`
                                        : "Clique em uma conversa para abrir as mensagens."}
                                    </span>
                                  </div>
                                  {conversasTemDuplicatasCriticas ? (
                                    <div className="text-warning mt-1" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>
                                      Ainda há duplicatas após deduplicação ({conversasDuplicateReport.duplicateIdentities.length} identidade
                                      {conversasDuplicateReport.duplicateIdentities.length === 1 ? "" : "s"}, {conversasDuplicateReport.duplicateIds.length} id
                                      {conversasDuplicateReport.duplicateIds.length === 1 ? "" : "s"}). Filtre o console por [ZapHub Conversas].
                                    </div>
                                  ) : null}

                                  {!instanciaAtivaEhEncerradas ? (
                                  <div className="d-flex flex-wrap mt-2" style={{ gap: "8px", minWidth: 0 }}>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${abaConversas === "hoje" ? "btn-primary" : "btn-outline-primary"}`}
                                      style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.78rem", lineHeight: 1.1 }}
                                      onClick={() => setAbaConversas("hoje")}
                                    >
                                      Hoje{" "}
                                      <span className={`badge ms-1 ${abaConversas === "hoje" ? "bg-white text-primary" : "bg-primary text-white"}`}>
                                        {conversasPorAba.hoje.length}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${abaConversas === "ontem" ? "btn-primary" : "btn-outline-primary"}`}
                                      style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.78rem", lineHeight: 1.1 }}
                                      onClick={() => setAbaConversas("ontem")}
                                    >
                                      Ontem{" "}
                                      <span className={`badge ms-1 ${abaConversas === "ontem" ? "bg-white text-primary" : "bg-primary text-white"}`}>
                                        {conversasPorAba.ontem.length}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${abaConversas === "antigas" ? "btn-primary" : "btn-outline-primary"}`}
                                      style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.78rem", lineHeight: 1.1 }}
                                      onClick={() => setAbaConversas("antigas")}
                                    >
                                      Antigas{" "}
                                      <span className={`badge ms-1 ${abaConversas === "antigas" ? "bg-white text-primary" : "bg-primary text-white"}`}>
                                        {conversasPorAba.antigas.length}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${abaConversas === "naoVisualizadas" ? "btn-primary" : "btn-outline-primary"}`}
                                      style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.78rem", lineHeight: 1.1 }}
                                      onClick={() => setAbaConversas("naoVisualizadas")}
                                    >
                                      Não visual.{" "}
                                      <span
                                        className={`badge ms-1 ${abaConversas === "naoVisualizadas" ? "bg-white text-primary" : "bg-primary text-white"}`}
                                      >
                                        {conversasPorAba.naoVisualizadas.length}
                                      </span>
                                    </button>
                                  </div>
                                  ) : null}

                                  <div className="d-flex flex-wrap mt-2" style={{ gap: "6px", minWidth: 0 }}>
                                      <span
                                        className="badge rounded-pill bg-white border text-dark d-inline-flex align-items-center"
                                        style={{ gap: "6px", borderColor: "rgba(0,0,0,0.12)", fontSize: "0.72rem", padding: "6px 10px" }}
                                      >
                                        <HouseDoorFill size={12} className="text-muted" />
                                        <span className="fw-semibold">{instancia?.profileName || instancia?.instanceName || "-"}</span>
                                      </span>

                                      <span
                                        className="badge rounded-pill bg-white border text-dark d-inline-flex align-items-center"
                                        style={{ gap: "6px", borderColor: "rgba(0,0,0,0.12)", fontSize: "0.72rem", padding: "6px 10px" }}
                                      >
                                        <TelephoneFill size={12} className="text-muted" />
                                        <span className="fw-semibold">{instancia?.number || "-"}</span>
                                      </span>

                                      <span
                                        className="badge rounded-pill bg-white border text-dark d-inline-flex align-items-center"
                                        style={{ gap: "6px", borderColor: "rgba(0,0,0,0.12)", fontSize: "0.72rem", padding: "6px 10px" }}
                                      >
                                        <ClockHistory size={12} className="text-muted" />
                                        <span className="fw-semibold">{formatDateTime(lastSyncAt)}</span>
                                      </span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column flex-grow-1" style={{ minHeight: 0, flex: "1 1 0", overflowY: "auto" }}>
                                  {abaConversasCarregando ? (
                                    <div className="d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center p-4">
                                      <div className="spinner-border text-primary mb-3" role="status" aria-label="Carregando conversas" />
                                      <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                                        Carregando conversas...
                                      </div>
                                    </div>
                                  ) : conversasVisiveis.length === 0 ? (
                                    <div className="p-3 text-muted" style={{ fontSize: "0.85rem" }}>
                                      {instanciaAtivaEhEncerradas
                                        ? "Nenhuma conversa encerrada. Use Encerrar conversa nas suas puxadas ativas."
                                        : "Nenhuma conversa encontrada nesta aba."}
                                    </div>
                                  ) : conversasVisiveis.map((conversa, conversaIndex) => {
                                    const conversaRowKey = `${conversa.id}::${conversa.remoteJid || conversaIndex}`;
                                    const ativa = conversa.id === conversaSelecionadaId;
                                    const lastIsDeleted = Boolean(conversa.lastMessageDeleted);
                                    const groupRemoteJid = getConversationGroupRemoteJid(conversa);
                                    const isGrupo = Boolean(groupRemoteJid);
                                    const { whatsappJid, lidJid } = getConversationJidInfo(conversa);
                                    const contatoNumero = getContatoNumero(
                                      whatsappJid || conversa.canonicalRemoteJid || conversa.contactRemoteJid || conversa.remoteJid
                                    );
                                    return (
                                      <button
                                        key={conversaRowKey}
                                        type="button"
                                        className="btn text-start border-0 border-bottom rounded-0 px-3 py-2"
                                        style={{
                                          backgroundColor: ativa ? "#eef6ff" : "#ffffff",
                                          boxShadow: "none",
                                        }}
                                        onClick={() => selecionarConversa(conversa)}
                                      >
                                        <div className="d-flex align-items-start justify-content-between" style={{ gap: "10px" }}>
                                          <div className="d-flex align-items-start flex-grow-1" style={{ gap: "12px", minWidth: 0 }}>
                                            <ConversaAvatar
                                              profilePicUrl={conversa.profilePicUrl}
                                              name={conversa.chatName}
                                              isGrupo={isGrupo}
                                              size={38}
                                            />
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                              <div className="d-flex align-items-center" style={{ gap: "8px", minWidth: 0 }}>
                                                <div className="fw-semibold text-truncate flex-grow-1" style={{ minWidth: 0 }}>
                                                  {conversa.chatName}
                                                </div>
                                                {isGrupo ? (
                                                  <span
                                                    className="badge rounded-pill bg-light text-dark d-inline-flex align-items-center flex-shrink-0"
                                                    style={{ gap: "6px", fontSize: "0.68rem", padding: "4px 8px" }}
                                                  >
                                                    <PeopleFill size={11} className="text-muted" />
                                                    <span className="fw-semibold">Grupo</span>
                                                  </span>
                                                ) : contatoNumero ? (
                                                  <span
                                                    className="badge rounded-pill bg-light text-dark d-inline-flex align-items-center flex-shrink-0"
                                                    style={{ gap: "6px", fontSize: "0.68rem", padding: "4px 8px" }}
                                                  >
                                                    <TelephoneFill size={11} className="text-muted" />
                                                    <span className="fw-semibold">{contatoNumero}</span>
                                                  </span>
                                                ) : null}
                                              </div>

                                              <div
                                                className="text-muted d-flex align-items-center text-truncate mt-1"
                                                style={{ fontSize: "0.72rem", lineHeight: 1.15, gap: "4px" }}
                                              >
                                                {renderConversationPreview(
                                                  lastIsDeleted ? "" : String(conversa.lastMessageType || ""),
                                                  conversa.lastMessage,
                                                  conversa.lastMessageFromMe
                                                )}
                                              </div>
                                              {!isGrupo && (whatsappJid || lidJid) ? (
                                                <div className="text-muted mt-1" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                                                  {whatsappJid ? (
                                                    <div className="text-truncate">remoteJidAlt: {whatsappJid}</div>
                                                  ) : lidJid ? (
                                                    <div className="text-truncate">remoteJid: {lidJid}</div>
                                                  ) : null}
                                                </div>
                                              ) : isGrupo && groupRemoteJid ? (
                                                <div className="text-muted mt-1 text-truncate" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                                                  remoteJid: {groupRemoteJid}
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                          <div className="text-end flex-shrink-0">
                                            <div className="text-muted d-flex align-items-center justify-content-end" style={{ fontSize: "0.75rem", gap: "6px" }}>
                                              <ClockHistory size={12} />
                                              <span>{formatHour(conversa.lastSentAt)}</span>
                                            </div>
                                            <ConversaUnreadBadge unreadCount={conversa.unreadCount} />
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                {conversasFiltradas.length > conversasVisiveisLimit ||
                                (lastConversasFetchCount != null && lastConversasFetchCount >= conversasLimit && conversasLimit < 120) ? (
                                  <div className="border-top bg-white p-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary w-100"
                                      onClick={carregarMaisConversas}
                                      disabled={carregandoMaisConversas || abaConversasCarregando}
                                    >
                                      {carregandoMaisConversas ? "Carregando..." : "Carregar mais"}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="col-12 col-xl-8 d-flex" style={{ minHeight: 0 }}>
                              <div
                                className="border rounded-0 h-100 bg-white d-flex flex-column flex-grow-1"
                                style={{ borderColor: "rgba(0,0,0,0.08)", overflow: "hidden", minHeight: 0, position: "relative" }}
                              >
                                <div className="px-3 py-2 border-bottom bg-light">
                                  <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between" style={{ gap: "8px" }}>
                                    <div className="d-flex align-items-center" style={{ gap: "10px" }}>
                                      {conversaSelecionada ? (
                                        <ConversaAvatar
                                          profilePicUrl={conversaSelecionada.profilePicUrl}
                                          name={conversaSelecionada.chatName}
                                          isGrupo={conversaSelecionadaIsGrupo}
                                          size={40}
                                        />
                                      ) : null}
                                      <div>
                                        <div className="fw-semibold">
                                          {conversaSelecionada?.chatName || "Conversas"}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: "0.84rem" }}>
                                          {conversaSelecionada ? (
                                            conversaSelecionadaIsGrupo ? (
                                              <span className="text-truncate d-block">
                                                remoteJid: {conversaSelecionadaGroupRemoteJid || conversaSelecionadaApiRemoteJid || "-"}
                                              </span>
                                            ) : conversaSelecionadaJids.whatsappJid || conversaSelecionadaJids.lidJid ? (
                                              conversaSelecionadaJids.whatsappJid ? (
                                                <span className="text-truncate d-block">remoteJidAlt: {conversaSelecionadaJids.whatsappJid}</span>
                                              ) : (
                                                <span className="text-truncate d-block">remoteJid: {conversaSelecionadaJids.lidJid}</span>
                                              )
                                            ) : (
                                              <span className="text-truncate d-block">{conversaSelecionada.remoteJid || "-"}</span>
                                            )
                                          ) : (
                                            "Clique em uma conversa para abrir as mensagens."
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {conversaSelecionada && (
                                      <div className="d-flex flex-column align-items-end" style={{ gap: "4px" }}>
                                        <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                                          <span className="badge text-bg-primary">{mensagens.length} mensagens</span>
                                          {carregandoConversaVisivel && carregandoConversaId === conversaSelecionadaId ? (
                                            <span
                                              className="spinner-border spinner-border-sm text-primary"
                                              role="status"
                                              style={{ opacity: 0.65, width: "0.85rem", height: "0.85rem" }}
                                            />
                                          ) : null}
                                        </div>
                                        {!conversaSelecionadaIsGrupo &&
                                        getContatoNumero(
                                          conversaSelecionadaJids.whatsappJid || conversaSelecionada.contactRemoteJid || conversaSelecionada.remoteJid
                                        ) ? (
                                          <div className="text-primary" style={{ fontSize: "0.8rem", lineHeight: 1.1 }}>
                                            {getContatoNumero(
                                              conversaSelecionadaJids.whatsappJid || conversaSelecionada.contactRemoteJid || conversaSelecionada.remoteJid
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {conversaSelecionada ? (
                                  <div
                                    ref={mensagensContainerRef}
                                    onScroll={onMensagensScroll}
                                    className="d-flex flex-column flex-grow-1 zaphubWhatsAppBackground"
                                    style={{
                                      gap: "8px",
                                      minHeight: 0,
                                      flex: "1 1 0",
                                      overflowY: "auto",
                                      padding: "12px",
                                      position: "relative",
                                      opacity: carregandoConversaVisivel && carregandoConversaId === conversaSelecionadaId ? 0.78 : 1,
                                      transition: "opacity 0.24s ease",
                                    }}
                                  >
                                    {mensagens.map((mensagem) => (
                                      <div
                                        key={mensagem.id}
                                        className={`d-flex ${mensagem.fromMe ? "justify-content-end" : "justify-content-start"}`}
                                      >
                                        {(() => {
                                          const isDeleted = isMensagemApagada(mensagem);
                                          const mediaPresentation = isDeleted ? null : getMediaPresentation(mensagem.media?.kind || mensagem.messageType);
                                          const shouldShowMediaLoader = Boolean(mediaPresentation);
                                          const displayText = getMensagemTextoExibicao(mensagem, headerRoleOptions);
                                          const mediaCaptionRaw = mensagem.media?.caption || (shouldRenderMessageText(mensagem.preview) ? mensagem.preview : "");
                                          const mediaCaption = isDeleted ? displayText : mediaCaptionRaw;
                                          const hdDisponivel = Boolean(mensagem.media?.canLoadHd);
                                          const mediaAsset = loadedMediaByMessageId[mensagem.id];
                                          const mediaLoaded = Boolean(mediaAsset?.src);
                                          const mediaLoading = Boolean(loadingMediaByMessageId[mensagem.id]);
                                          const mediaLoadError = mediaLoadErrorByMessageId[mensagem.id];
                                          const statusAppearance = isDeleted ? null : getStatusAppearance(mensagem.status);
                                          const permissaoEdicao = getPermissaoEdicaoMensagem(mensagem);
                                          const permissaoExclusao = getPermissaoExclusaoMensagem(mensagem);
                                          const hasActions = permissaoEdicao.allowed || permissaoExclusao.allowed;
                                          const menuMensagemAberto = menuMensagemAbertoId === mensagem.id;
                                          const displayedSenderName = getDisplayedSenderName(mensagem, conversaSelecionada?.chatName);
                                          const messageRemoteJid =
                                            mensagem.canonicalRemoteJid || mensagem.contactRemoteJid || mensagem.remoteJid || "";
                                          const shouldHideSenderNameForDirectConversation = !isGroupConversationRemoteJid(messageRemoteJid);
                                          const normalizedDisplayedSenderName = String(displayedSenderName || "").trim().toLowerCase();
                                          const shouldHideDisplayedSenderName = Boolean(
                                            shouldHideSenderNameForDirectConversation ||
                                            (normalizedDisplayedSenderName &&
                                              [
                                                String(instancia?.profileName || "").trim().toLowerCase(),
                                                String(instancia?.instanceName || "").trim().toLowerCase(),
                                              ]
                                                .filter(Boolean)
                                                .includes(normalizedDisplayedSenderName))
                                          );

                                          return (
                                        <div
                                          className="border rounded-0 px-2 py-1"
                                          style={{
                                            maxWidth: "78%",
                                            backgroundColor: mensagem.fromMe ? "#d9ecff" : "#ffffff",
                                            borderColor: mensagem.fromMe ? "rgba(13,110,253,0.18)" : "rgba(0,0,0,0.08)",
                                            boxShadow: mensagem.fromMe
                                              ? "0 10px 24px rgba(13, 110, 253, 0.18)"
                                              : "0 10px 24px rgba(15, 23, 42, 0.14)",
                                            position: "relative",
                                          }}
                                        >
                                          <div className="d-flex align-items-center justify-content-between mb-0" style={{ gap: "10px" }}>
                                            <div className="d-flex flex-column" style={{ minWidth: 0 }}>
                                              {!shouldHideDisplayedSenderName ? (
                                                <span className="fw-semibold text-truncate" style={{ minWidth: 0 }}>
                                                  {displayedSenderName}
                                                </span>
                                              ) : null}
                                              {isDeleted && mensagem.deletedBy ? (
                                                <span className="fw-semibold text-truncate" style={{ fontSize: "0.78rem", opacity: 0.9, minWidth: 0 }}>
                                                  {mensagem.deletedBy}
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="d-flex align-items-center flex-shrink-0" style={{ gap: "6px", position: "relative" }}>
                                              <span
                                                className={`d-inline-flex align-items-center ${mensagem.fromMe ? "text-primary" : "text-secondary"}`}
                                                style={{ gap: "6px", fontSize: "0.78rem" }}
                                              >
                                                {mensagem.fromMe ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                                <span>{mensagem.fromMe ? "Enviada" : "Recebida"}</span>
                                              </span>
                                              {mensagem.fromMe && !isDeleted ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-secondary p-0 d-inline-flex align-items-center justify-content-center"
                                                    aria-label="Ações da mensagem"
                                                    aria-expanded={menuMensagemAberto}
                                                    title={
                                                      hasActions
                                                        ? "Ações da mensagem"
                                                        : permissaoEdicao.reason ||
                                                          permissaoExclusao.reason ||
                                                          "Ações indisponíveis"
                                                    }
                                                    ref={(el) => {
                                                      if (menuMensagemAberto) menuMensagemButtonRef.current = el;
                                                    }}
                                                    onClick={() => {
                                                      if (!hasActions) return;
                                                      setMenuMensagemAbertoId((prev) => (prev === mensagem.id ? null : mensagem.id));
                                                    }}
                                                    disabled={!hasActions}
                                                    style={{
                                                      width: "20px",
                                                      height: "20px",
                                                      textDecoration: "none",
                                                      opacity: hasActions ? 1 : 0.45,
                                                      cursor: hasActions ? "pointer" : "not-allowed",
                                                    }}
                                                  >
                                                    <GearFill size={13} />
                                                  </button>
                                                  {menuMensagemAberto && hasActions ? (
                                                    <div
                                                      className="border rounded-3 bg-white shadow-sm"
                                                      style={{
                                                        position: "absolute",
                                                        bottom: "calc(100% + 6px)",
                                                        right: 0,
                                                        minWidth: "150px",
                                                        zIndex: 6,
                                                        padding: "6px",
                                                      }}
                                                      tabIndex={-1}
                                                      ref={(el) => {
                                                        if (menuMensagemAberto) menuMensagemRef.current = el;
                                                      }}
                                                      onBlur={(event) => {
                                                        const next = event.relatedTarget as Node | null;
                                                        if (next && menuMensagemRef.current && menuMensagemRef.current.contains(next)) return;
                                                        if (next && menuMensagemButtonRef.current && menuMensagemButtonRef.current.contains(next)) return;
                                                        setMenuMensagemAbertoId(null);
                                                      }}
                                                    >
                                                      <button
                                                        type="button"
                                                        className="btn btn-sm btn-light w-100 d-flex align-items-center justify-content-start"
                                                        style={{ gap: "8px" }}
                                                        onClick={() => abrirModalEdicaoMensagem(mensagem)}
                                                        disabled={!permissaoEdicao.allowed}
                                                        title={permissaoEdicao.reason || "Editar mensagem"}
                                                      >
                                                        <PencilFill size={13} />
                                                        <span>Editar</span>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className="btn btn-sm btn-light w-100 d-flex align-items-center justify-content-start mt-1 text-danger"
                                                        style={{ gap: "8px" }}
                                                        onClick={() => abrirModalExclusaoMensagem(mensagem)}
                                                        disabled={!permissaoExclusao.allowed}
                                                        title={permissaoExclusao.reason || "Excluir mensagem"}
                                                      >
                                                        <TrashFill size={13} />
                                                        <span>Excluir</span>
                                                      </button>
                                                    </div>
                                                  ) : null}
                                                </>
                                              ) : null}
                                            </div>
                                          </div>
                                          {conversaSelecionadaIsGrupo && !mensagem.fromMe && getContatoNumero(mensagem.contactRemoteJid || mensagem.participant) ? (
                                            <div className="text-primary" style={{ fontSize: "0.76rem", lineHeight: 1.15 }}>
                                              {getContatoNumero(mensagem.contactRemoteJid || mensagem.participant)}
                                            </div>
                                          ) : null}
                                          {shouldShowMediaLoader ? (
                                            <div className="d-flex flex-column" style={{ gap: "6px" }}>
                                              <div className="d-flex align-items-center text-muted" style={{ gap: "6px", fontSize: "0.82rem", lineHeight: 1.25 }}>
                                                {mediaPresentation?.icon}
                                                <span>{mediaPresentation?.label}</span>
                                                {mensagem.media?.fileName ? (
                                                  <span className="text-truncate" title={mensagem.media.fileName}>
                                                    {mensagem.media.fileName}
                                                  </span>
                                                ) : null}
                                              </div>

                                              {!mediaLoaded ? (
                                                mediaPresentation?.kind === "audio" ? (
                                                  <button
                                                    type="button"
                                                    className={`zaphubAudioPreview align-self-start ${mediaLoading ? "is-animating" : ""}`}
                                                    onClick={() => carregarMidiaHd(mensagem, { autoplay: true })}
                                                    disabled={!hdDisponivel || mediaLoading}
                                                    aria-label={!hdDisponivel ? "Áudio indisponível" : mediaLoading ? "Carregando áudio" : "Carregar áudio"}
                                                  >
                                                    <span className="zaphubAudioPlay">
                                                      {mediaLoading ? (
                                                        <div className="spinner-border spinner-border-sm text-white" role="status" />
                                                      ) : (
                                                        <PlayFill size={14} />
                                                      )}
                                                    </span>
                                                    <span className="zaphubAudioBars" aria-hidden="true">
                                                      <span className="zaphubAudioBar" />
                                                      <span className="zaphubAudioBar" />
                                                      <span className="zaphubAudioBar" />
                                                      <span className="zaphubAudioBar" />
                                                    </span>
                                                  </button>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    className="btn btn-outline-primary btn-sm align-self-start"
                                                    onClick={() => carregarMidiaHd(mensagem)}
                                                    disabled={!hdDisponivel || mediaLoading}
                                                  >
                                                    {!hdDisponivel ? "HD indisponivel" : mediaLoading ? "Carregando..." : "Carregar em HD"}
                                                  </button>
                                                )
                                              ) : mediaPresentation?.kind === "image" || mediaPresentation?.kind === "sticker" ? (
                                                <img
                                                  src={mediaAsset?.src || ""}
                                                  alt={mediaAsset?.fileName || mensagem.media?.fileName || mediaPresentation?.label || "Midia"}
                                                  loading="lazy"
                                                  onError={() => registrarErroMidia(mensagem.id)}
                                                  style={{
                                                    width: mediaPresentation.kind === "sticker" ? "160px" : "100%",
                                                    maxWidth: "420px",
                                                    maxHeight: "360px",
                                                    objectFit: "contain",
                                                    borderRadius: 0,
                                                    border: "1px solid rgba(0,0,0,0.08)",
                                                    backgroundColor: "#f8fafc",
                                                  }}
                                                />
                                              ) : mediaPresentation?.kind === "video" ? (
                                                <video
                                                  controls
                                                  preload="metadata"
                                                  onError={() => registrarErroMidia(mensagem.id)}
                                                  style={{
                                                    width: "100%",
                                                    maxWidth: "420px",
                                                    maxHeight: "360px",
                                                    borderRadius: 0,
                                                    backgroundColor: "#000000",
                                                  }}
                                                >
                                                  <source src={mediaAsset?.src || ""} type={mediaAsset?.mimetype || mensagem.media?.mimetype || undefined} />
                                                </video>
                                              ) : mediaPresentation?.kind === "audio" ? (
                                                <div
                                                  role="button"
                                                  tabIndex={0}
                                                  className={`zaphubAudioPreview align-self-start ${audioIsPlaying && audioPlayingMessageId === mensagem.id ? "is-animating" : ""}`}
                                                  onClick={() => {
                                                    const src = mediaAsset?.src || "";
                                                    toggleAudioPlayback(mensagem.id, src);
                                                  }}
                                                  onKeyDown={(event) => {
                                                    if (event.key !== "Enter" && event.key !== " ") return;
                                                    event.preventDefault();
                                                    (event.currentTarget as HTMLDivElement).click();
                                                  }}
                                                  aria-label={audioIsPlaying && audioPlayingMessageId === mensagem.id ? "Pausar áudio" : "Tocar áudio"}
                                                >
                                                  <span className="zaphubAudioPlay">
                                                    {audioIsPlaying && audioPlayingMessageId === mensagem.id ? (
                                                      <PauseFill size={14} />
                                                    ) : (
                                                      <PlayFill size={14} />
                                                    )}
                                                  </span>
                                                  <span className="zaphubAudioBars" aria-hidden="true">
                                                    <span className="zaphubAudioBar" />
                                                    <span className="zaphubAudioBar" />
                                                    <span className="zaphubAudioBar" />
                                                    <span className="zaphubAudioBar" />
                                                  </span>
                                                  <span className="zaphubAudioMeta" onClick={(event) => event.stopPropagation()}>
                                                    <div
                                                      className="zaphubAudioProgress"
                                                      role="slider"
                                                      aria-label="Progresso do áudio"
                                                      aria-valuemin={0}
                                                      aria-valuemax={Math.max(0, Math.floor(audioSelectedMessageId === mensagem.id ? audioDurationSec : 0))}
                                                      aria-valuenow={Math.floor(audioSelectedMessageId === mensagem.id ? audioCurrentTimeSec : 0)}
                                                      onClick={(event) => {
                                                        event.stopPropagation();
                                                        if (audioSelectedMessageId !== mensagem.id) return;
                                                        const audio = audioPlayerRef.current;
                                                        if (!audio || audioPlayerMessageIdRef.current !== mensagem.id) return;
                                                        const duration = Number(audio.duration) || 0;
                                                        if (!duration) return;
                                                        const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                                        const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
                                                        const ratio = rect.width ? x / rect.width : 0;
                                                        audio.currentTime = ratio * duration;
                                                        syncAudioUiFromElement(audio, mensagem.id);
                                                      }}
                                                    >
                                                      <div
                                                        className="zaphubAudioProgressFill"
                                                        style={{
                                                          width: (() => {
                                                            if (audioSelectedMessageId !== mensagem.id) return "0%";
                                                            const d = Number(audioDurationSec) || 0;
                                                            const t = Number(audioCurrentTimeSec) || 0;
                                                            if (!d) return "0%";
                                                            return `${Math.min(100, Math.max(0, (t / d) * 100)).toFixed(2)}%`;
                                                          })(),
                                                        }}
                                                      />
                                                    </div>
                                                    <button
                                                      type="button"
                                                      className={`zaphubAudioSpeed ${audioPlaybackRate > 1 ? "is-fast" : ""}`}
                                                      onClick={(event) => {
                                                        event.stopPropagation();
                                                        const nextRate = audioPlaybackRate === 1 ? 1.5 : audioPlaybackRate === 1.5 ? 2 : 1;
                                                        setAudioPlaybackRate(nextRate);
                                                        const audio = audioPlayerRef.current;
                                                        if (audio && audioPlayerMessageIdRef.current === mensagem.id) {
                                                          audio.playbackRate = nextRate;
                                                        }
                                                      }}
                                                      aria-label="Velocidade do áudio"
                                                    >
                                                      {audioPlaybackRate}x
                                                    </button>
                                                  </span>
                                                </div>
                                              ) : mediaPresentation?.kind === "document" && mediaAsset?.src ? (
                                                <a
                                                  href={mediaAsset.src}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="btn btn-outline-secondary btn-sm align-self-start"
                                                >
                                                  Abrir documento em HD
                                                </a>
                                              ) : null}

                                              {mediaLoadError ? (
                                                <div className="text-danger" style={{ fontSize: "0.78rem" }}>
                                                  {mediaLoadError}
                                                </div>
                                              ) : null}

                                              {mediaCaption ? (
                                                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{mediaCaption}</div>
                                              ) : null}
                                            </div>
                                          ) : (
                                            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{displayText}</div>
                                          )}
                                          <div
                                            className="text-muted d-flex align-items-center flex-wrap mt-0"
                                            style={{ fontSize: "0.74rem", lineHeight: 1.2, gap: "6px" }}
                                          >
                                            <span>{formatDateTime(mensagem.sentAt)}</span>
                                            {isDeleted ? <TrashFill size={13} title="Apagada" aria-label="Apagada" /> : null}
                                            {statusAppearance ? (
                                              <span
                                                className="d-inline-flex align-items-center justify-content-center rounded-circle"
                                                title={statusAppearance.label}
                                                aria-label={statusAppearance.label}
                                                style={{
                                                  width: "16px",
                                                  height: "16px",
                                                  ...statusAppearance.wrapperStyle,
                                                }}
                                              >
                                                <span
                                                  className="d-inline-flex align-items-center justify-content-center"
                                                  style={{
                                                    lineHeight: 0,
                                                    animation: statusAppearance.animated
                                                      ? "zaphubStatusPulse 1.35s ease-in-out infinite"
                                                      : undefined,
                                                  }}
                                                >
                                                  {statusAppearance.icon}
                                                </span>
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center p-4">
                                    <div
                                      className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-3"
                                      style={{ width: "72px", height: "72px", backgroundColor: "#0d6efd" }}
                                    >
                                      <ClockHistory size={30} />
                                    </div>
                                    <h3 className="h5 fw-bold mb-2">Aguardando seleção</h3>
                                    <p className="text-muted mb-0" style={{ maxWidth: "420px" }}>
                                      Selecione uma conversa na caixa de entrada para visualizar as mensagens.
                                    </p>
                                  </div>
                                )}

                                {conversaSelecionada ? (
                                  bloquearEnvioPrincipal ? (
                                    <div className="border-top bg-light">
                                      <div
                                        className="px-3 py-2 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between"
                                        style={{ gap: "10px" }}
                                      >
                                        <div className="text-muted d-flex align-items-center" style={{ gap: "8px", fontSize: "0.82rem" }}>
                                          <InfoCircleFill size={14} className="flex-shrink-0" />
                                          <span>
                                            {mensagemPuxavel
                                              ? (
                                                <>
                                                  Envio bloqueado na instância principal. Use <strong>Puxar mensagem</strong> para atribuir ao
                                                  seu atendimento.
                                                </>
                                              )
                                              : (
                                                <>
                                                  Envio bloqueado na instância principal. Não há mensagem recebida para puxar — use{" "}
                                                  <strong>Iniciar conversa</strong> para abrir o atendimento.
                                                </>
                                              )}
                                          </span>
                                        </div>
                                        {mensagemPuxavel ? (
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm d-inline-flex align-items-center flex-shrink-0"
                                          style={{ gap: "6px", borderRadius: "999px", padding: "6px 14px", fontSize: "0.82rem" }}
                                          onClick={() => {
                                            if (!mensagemPuxavel) return;
                                            puxarMensagem(mensagemPuxavel).catch(() => {});
                                          }}
                                          disabled={Boolean(puxandoMensagemId) || puxandoParaMinhasPuxadas || conversaSelecionadaIsGrupo}
                                          title={
                                            conversaSelecionadaIsGrupo
                                              ? "Não é possível puxar mensagens de grupos"
                                              : "Puxar a última mensagem recebida para Minhas puxadas"
                                          }
                                        >
                                          <InboxFill size={14} />
                                          <span>
                                            {puxandoParaMinhasPuxadas
                                              ? "Abrindo em Minhas puxadas..."
                                              : puxandoMensagemId
                                              ? "Puxando..."
                                              : "Puxar mensagem"}
                                          </span>
                                        </button>
                                        ) : podeIniciarConversa ? (
                                        <button
                                          type="button"
                                          className="btn btn-warning btn-sm d-inline-flex align-items-center flex-shrink-0 text-white"
                                          style={{ gap: "6px", borderRadius: "999px", padding: "6px 14px", fontSize: "0.82rem" }}
                                          onClick={() => {
                                            setErroIniciarConversa(null);
                                            setModalIniciarConversaModo("iniciar");
                                            setMostrarModalIniciarConversa(true);
                                          }}
                                          disabled={puxandoParaMinhasPuxadas || iniciandoConversa || conversaSelecionadaIsGrupo}
                                          title="Iniciar atendimento desta conversa em Minhas puxadas"
                                        >
                                          <ChatDotsFill size={14} />
                                          <span>Iniciar conversa</span>
                                        </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : somenteLeituraEncerradas ? (
                                    <div className="border-top bg-light">
                                      <div
                                        className="px-3 py-2 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between"
                                        style={{ gap: "10px" }}
                                      >
                                        <div className="text-muted d-flex align-items-center" style={{ gap: "8px", fontSize: "0.82rem" }}>
                                          <ArchiveFill size={14} className="flex-shrink-0" />
                                          <span>Conversa encerrada. Visualização somente leitura.</span>
                                        </div>
                                        {podeReabrirConversaEncerrada ? (
                                          <button
                                            type="button"
                                            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center flex-shrink-0"
                                            style={{ gap: "6px", borderRadius: "999px", padding: "6px 14px", fontSize: "0.82rem" }}
                                            onClick={() => {
                                              setErroIniciarConversa(null);
                                              setModalIniciarConversaModo("reabrir");
                                              setMostrarModalIniciarConversa(true);
                                            }}
                                            disabled={puxandoParaMinhasPuxadas || iniciandoConversa}
                                            title="Reabrir conversa em Minhas puxadas"
                                          >
                                            <ArrowClockwise size={14} />
                                            <span>Reabrir conversa</span>
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                  <div className="border-top zaphubWhatsAppBackground">
                                    {instanciaAtivaEhPuxadas && !conversaSelecionadaIsGrupo ? (
                                      <div
                                        className="px-3 py-2 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between border-bottom bg-light"
                                        style={{ gap: "10px" }}
                                      >
                                        <div className="text-muted d-flex align-items-center" style={{ gap: "8px", fontSize: "0.82rem" }}>
                                          <InfoCircleFill size={14} className="flex-shrink-0" />
                                          <span>Atendimento em andamento. Encerre quando finalizar o contato.</span>
                                        </div>
                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center flex-shrink-0"
                                          style={{ gap: "6px", borderRadius: "999px", padding: "6px 14px", fontSize: "0.82rem" }}
                                          onClick={() => {
                                            setErroEncerrarConversa(null);
                                            setMostrarModalEncerrarConversa(true);
                                          }}
                                          disabled={encerrandoConversa}
                                          title="Encerrar conversa e mover para a aba Encerradas"
                                        >
                                          <ArchiveFill size={14} />
                                          <span>Encerrar conversa</span>
                                        </button>
                                      </div>
                                    ) : null}
                                    <div className="zaphubComposerArea">
                                      <div className="zaphubComposerBar">
                                        <div className="d-flex flex-column flex-grow-1" style={{ gap: "6px", minWidth: 0 }}>
                                        {anexosEnvio.length ? (
                                          <div className="d-flex flex-wrap align-items-center" style={{ gap: "8px" }}>
                                            {anexosEnvio.map((anexo) => (
                                              <div
                                                key={anexo.id}
                                                className="border rounded-3 d-flex align-items-center"
                                                style={{ gap: "8px", padding: "6px 8px", backgroundColor: "#f8fafc" }}
                                              >
                                                {anexo.kind === "image" ? (
                                                  <img
                                                    src={anexo.previewUrl}
                                                    alt={anexo.fileName}
                                                    style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "8px" }}
                                                  />
                                                ) : (
                                                  <div
                                                    className="d-inline-flex align-items-center justify-content-center text-white rounded-3"
                                                    style={{ width: "40px", height: "40px", backgroundColor: anexo.kind === "audio" ? "#0d6efd" : "#111827" }}
                                                  >
                                                    {anexo.kind === "audio" ? <MicFill size={16} /> : <CameraVideoFill size={16} />}
                                                  </div>
                                                )}
                                                <div className="d-flex flex-column" style={{ minWidth: 0, maxWidth: "220px" }}>
                                                  <div className="text-truncate" style={{ fontSize: "0.82rem" }}>
                                                    {anexo.fileName}
                                                  </div>
                                                  <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                    {anexo.kind === "image" ? "Imagem" : anexo.kind === "video" ? "Vídeo" : "Áudio"}
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  className="btn btn-outline-danger btn-sm"
                                                  onClick={() => removerAnexo(anexo.id)}
                                                  disabled={enviandoMensagem}
                                                  aria-label="Remover anexo"
                                                >
                                                  <TrashFill size={14} />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}

                                        <textarea
                                          className="form-control zaphubComposerTextarea"
                                          placeholder="Digite sua mensagem..."
                                          value={textoEnvio}
                                          onChange={(event) => setTextoEnvio(event.target.value)}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" && !event.shiftKey) {
                                              event.preventDefault();
                                              if (gravandoAudio) return;
                                              enviarMensagem().catch(() => {});
                                            }
                                          }}
                                          disabled={enviandoMensagem}
                                          rows={2}
                                          style={{}}
                                        />
                                      </div>

                                      <input
                                        ref={anexosInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        multiple
                                        style={{ display: "none" }}
                                        onChange={onSelecionarArquivos}
                                      />
                                      <div className="zaphubActionWithLabel" style={{ color: "#6c757d" }}>
                                        <button
                                          type="button"
                                          className="zaphubIconButton"
                                          onClick={selecionarAnexos}
                                          disabled={enviandoMensagem}
                                          title="Anexar imagem ou vídeo"
                                          aria-label="Anexar imagem ou vídeo"
                                        >
                                          <ImageFill size={16} />
                                        </button>
                                        <div className="zaphubActionLabel">Anexar</div>
                                      </div>
                                      <div className="zaphubActionWithLabel" style={{ color: gravandoAudio ? "#dc3545" : "#6c757d" }}>
                                        <button
                                          type="button"
                                          className={`zaphubIconButton${gravandoAudio ? " zaphubIconButton--recording" : ""}`}
                                          style={{ animation: gravandoAudio ? "zaphubStatusPulse 1.1s ease-in-out infinite" : undefined }}
                                          onClick={gravandoAudio ? pararGravacaoAudio : iniciarGravacaoAudio}
                                          disabled={enviandoMensagem}
                                          title={gravandoAudio ? "Parar gravação" : "Gravar áudio"}
                                          aria-label={gravandoAudio ? "Parar gravação" : "Gravar áudio"}
                                        >
                                          <MicFill size={16} />
                                        </button>
                                        <div className="zaphubActionLabel">{gravandoAudio ? "Parar" : "Áudio"}</div>
                                      </div>
                                      <div className="zaphubActionWithLabel" style={{ color: "#0d6efd" }}>
                                        <button
                                          type="button"
                                          className="zaphubSendButton"
                                          onClick={() => enviarMensagem().catch(() => {})}
                                          disabled={gravandoAudio || enviandoMensagem || (!textoEnvio.trim() && anexosEnvio.length === 0)}
                                          title={enviandoMensagem ? "Enviando..." : "Enviar"}
                                          aria-label={enviandoMensagem ? "Enviando..." : "Enviar"}
                                        >
                                          <ArrowUpRight size={16} />
                                        </button>
                                        <div className="zaphubActionLabel">{enviandoMensagem ? "Enviando" : "Enviar"}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                  )
                                ) : null}

                                {puxandoParaMinhasPuxadas ? (
                                  <div
                                    className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center text-center"
                                    style={{ zIndex: 25, backgroundColor: "rgba(15, 23, 42, 0.28)" }}
                                  >
                                    <div className="spinner-border text-primary mb-3" role="status" aria-label="Puxando conversa" />
                                    <div className="fw-semibold" style={{ fontSize: "0.9rem" }}>
                                      {iniciandoConversa
                                        ? modalIniciarConversaModo === "reabrir"
                                          ? "Reabrindo conversa..."
                                          : "Iniciando conversa..."
                                        : "Abrindo em Minhas puxadas..."}
                                    </div>
                                    <div className="text-muted mt-1" style={{ fontSize: "0.8rem", maxWidth: "320px" }}>
                                      A conversa será aberta automaticamente na sua caixa de atendimento.
                                    </div>
                                  </div>
                                ) : null}

                                {mostrarModalEncerrarConversa ? (
                                  <div
                                    className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                                    style={{ zIndex: 30, backgroundColor: "rgba(15, 23, 42, 0.28)" }}
                                    onClick={fecharModalEncerrarConversa}
                                  >
                                    <div
                                      className="bg-white border shadow"
                                      style={{ width: "min(480px, calc(100% - 32px))", borderRadius: 0, overflow: "hidden" }}
                                      role="dialog"
                                      aria-modal="true"
                                      aria-labelledby="zaphubEncerrarConversaTitulo"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
                                        <h5
                                          id="zaphubEncerrarConversaTitulo"
                                          className="mb-0 d-flex align-items-center"
                                          style={{ gap: "8px", fontSize: "1rem" }}
                                        >
                                          <ArchiveFill size={16} />
                                          <span>Encerrar conversa</span>
                                        </h5>
                                        <button
                                          type="button"
                                          className="btn-close"
                                          aria-label="Fechar"
                                          onClick={fecharModalEncerrarConversa}
                                          disabled={encerrandoConversa}
                                        />
                                      </div>
                                      <div className="px-3 py-3">
                                        <div className="text-muted mb-2" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                          Deseja encerrar esta conversa? Ela será movida para a aba <strong>Encerradas</strong> e sairá das
                                          suas puxadas ativas.
                                        </div>
                                        {conversaSelecionada ? (
                                          <div className="border rounded-0 p-2 bg-light" style={{ fontSize: "0.86rem", lineHeight: 1.35 }}>
                                            <div className="fw-semibold text-truncate">{conversaSelecionada.chatName}</div>
                                          </div>
                                        ) : null}
                                        {erroEncerrarConversa ? (
                                          <div className="alert alert-danger py-2 mt-3 mb-0">{erroEncerrarConversa}</div>
                                        ) : null}
                                      </div>
                                      <div className="px-3 py-2 border-top d-flex justify-content-end" style={{ gap: "8px" }}>
                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary btn-sm"
                                          onClick={fecharModalEncerrarConversa}
                                          disabled={encerrandoConversa}
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm d-inline-flex align-items-center"
                                          style={{ gap: "8px" }}
                                          onClick={() => encerrarConversaPuxada().catch(() => {})}
                                          disabled={encerrandoConversa}
                                        >
                                          {encerrandoConversa ? (
                                            <div className="spinner-border spinner-border-sm" role="status" />
                                          ) : (
                                            <ArchiveFill size={14} />
                                          )}
                                          <span>{encerrandoConversa ? "Encerrando..." : "Encerrar conversa"}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                {mostrarModalIniciarConversa ? (
                                  <div
                                    className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                                    style={{ zIndex: 30, backgroundColor: "rgba(15, 23, 42, 0.28)" }}
                                    onClick={fecharModalIniciarConversa}
                                  >
                                    <div
                                      className="bg-white border shadow"
                                      style={{ width: "min(480px, calc(100% - 32px))", borderRadius: 0, overflow: "hidden" }}
                                      role="dialog"
                                      aria-modal="true"
                                      aria-labelledby="zaphubIniciarConversaTitulo"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
                                        <h5
                                          id="zaphubIniciarConversaTitulo"
                                          className="mb-0 d-flex align-items-center"
                                          style={{ gap: "8px", fontSize: "1rem" }}
                                        >
                                          {modalIniciarConversaModo === "reabrir" ? <ArrowClockwise size={16} /> : <ChatDotsFill size={16} />}
                                          <span>{modalIniciarConversaModo === "reabrir" ? "Reabrir conversa" : "Iniciar conversa"}</span>
                                        </h5>
                                        <button
                                          type="button"
                                          className="btn-close"
                                          aria-label="Fechar"
                                          onClick={fecharModalIniciarConversa}
                                          disabled={iniciandoConversa}
                                        />
                                      </div>
                                      <div className="px-3 py-3">
                                        <div className="text-muted mb-2" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                          {modalIniciarConversaModo === "reabrir" ? (
                                            <>
                                              Deseja reabrir esta conversa? Ela voltará para <strong>Minhas puxadas</strong> e sairá de{" "}
                                              <strong>Encerradas</strong>.
                                            </>
                                          ) : (
                                            <>
                                              Deseja iniciar o atendimento desta conversa? Ela será atribuída a você em{" "}
                                              <strong>Minhas puxadas</strong>.
                                            </>
                                          )}
                                        </div>
                                        {conversaSelecionada ? (
                                          <div className="border rounded-0 p-2 bg-light" style={{ fontSize: "0.86rem", lineHeight: 1.35 }}>
                                            <div className="fw-semibold text-truncate">{conversaSelecionada.chatName}</div>
                                          </div>
                                        ) : null}
                                        {erroIniciarConversa ? (
                                          <div className="alert alert-danger py-2 mt-3 mb-0">{erroIniciarConversa}</div>
                                        ) : null}
                                      </div>
                                      <div className="px-3 py-2 border-top d-flex justify-content-end" style={{ gap: "8px" }}>
                                        <button
                                          type="button"
                                          className="btn btn-outline-secondary btn-sm"
                                          onClick={fecharModalIniciarConversa}
                                          disabled={iniciandoConversa}
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm d-inline-flex align-items-center ${modalIniciarConversaModo === "reabrir" ? "btn-primary" : "btn-warning text-white"}`}
                                          style={{ gap: "8px" }}
                                          onClick={() => iniciarOuReabrirConversa().catch(() => {})}
                                          disabled={iniciandoConversa}
                                        >
                                          {iniciandoConversa ? (
                                            <div className="spinner-border spinner-border-sm" role="status" />
                                          ) : modalIniciarConversaModo === "reabrir" ? (
                                            <ArrowClockwise size={14} />
                                          ) : (
                                            <ChatDotsFill size={14} />
                                          )}
                                          <span>
                                            {iniciandoConversa
                                              ? modalIniciarConversaModo === "reabrir"
                                                ? "Reabrindo..."
                                                : "Iniciando..."
                                              : modalIniciarConversaModo === "reabrir"
                                              ? "Reabrir conversa"
                                              : "Iniciar conversa"}
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mensagemEmEdicao ? (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: "rgba(15, 23, 42, 0.28)", zIndex: 1080 }}
            onClick={fecharModalEdicaoMensagem}
          />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1085 }}>
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "640px" }}>
              <div className="modal-content border-0" style={{ borderRadius: 0, overflow: "hidden" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ gap: "8px" }}>
                    <PencilFill size={16} />
                    <span>Editar mensagem</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={fecharModalEdicaoMensagem}
                    disabled={salvandoEdicaoMensagem}
                  />
                </div>
                <div className="modal-body py-3">
                  <div className="text-muted mb-2" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                    Atualize o conteúdo da mensagem. A edição depende da regra do WhatsApp/Evolution e pode falhar se o prazo já tiver expirado.
                  </div>
                  {infoEdicaoMensagem ? (
                    <div className="alert alert-info py-2 mt-2 mb-2 d-flex align-items-center" style={{ gap: "8px" }}>
                      <div className="spinner-border spinner-border-sm" role="status" />
                      <div style={{ lineHeight: 1.2 }}>{infoEdicaoMensagem}</div>
                    </div>
                  ) : null}
                  <textarea
                    className="form-control"
                    value={textoEdicaoMensagem}
                    onChange={(event) => setTextoEdicaoMensagem(event.target.value)}
                    rows={6}
                    disabled={salvandoEdicaoMensagem || aguardandoConfirmacaoEdicao}
                    style={{ whiteSpace: "pre-wrap" }}
                  />
                  {erroEdicaoMensagem ? (
                    <div className="alert alert-danger py-2 mt-3 mb-0">{erroEdicaoMensagem}</div>
                  ) : null}
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={fecharModalEdicaoMensagem}
                    disabled={salvandoEdicaoMensagem}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm d-inline-flex align-items-center"
                    style={{ gap: "8px" }}
                    onClick={() => salvarEdicaoMensagem().catch(() => {})}
                    disabled={aguardandoConfirmacaoEdicao || salvandoEdicaoMensagem || !textoEdicaoMensagem.trim()}
                  >
                    {salvandoEdicaoMensagem ? <div className="spinner-border spinner-border-sm" role="status" /> : <PencilFill size={14} />}
                    <span>{salvandoEdicaoMensagem ? "Atualizando..." : "Atualizar"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {mensagemEmExclusao ? (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: "rgba(15, 23, 42, 0.28)", zIndex: 1080 }}
            onClick={fecharModalExclusaoMensagem}
          />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1085 }}>
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "640px" }}>
              <div className="modal-content border-0" style={{ borderRadius: 0, overflow: "hidden" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ gap: "8px" }}>
                    <TrashFill size={16} />
                    <span>Excluir mensagem</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={fecharModalExclusaoMensagem}
                    disabled={excluindoMensagem}
                  />
                </div>
                <div className="modal-body py-3">
                  <div className="text-muted mb-2" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                    Isso vai apagar a mensagem para todos (quando o WhatsApp permitir). Essa ação pode falhar se o prazo de exclusão já expirou.
                  </div>
                  <div className="border rounded-0 p-2 bg-light" style={{ fontSize: "0.86rem", whiteSpace: "pre-wrap", lineHeight: 1.35 }}>
                    {getMensagemTextoExibicao(mensagemEmExclusao, headerRoleOptions)}
                  </div>
                  {infoExclusaoMensagem ? (
                    <div className="alert alert-info py-2 mt-3 mb-2 d-flex align-items-center" style={{ gap: "8px" }}>
                      <div className="spinner-border spinner-border-sm" role="status" />
                      <div style={{ lineHeight: 1.2 }}>{infoExclusaoMensagem}</div>
                    </div>
                  ) : null}
                  {erroExclusaoMensagem ? (
                    <div className="alert alert-danger py-2 mt-3 mb-0">{erroExclusaoMensagem}</div>
                  ) : null}
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={fecharModalExclusaoMensagem}
                    disabled={excluindoMensagem}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm d-inline-flex align-items-center"
                    style={{ gap: "8px" }}
                    onClick={() => confirmarExclusaoMensagem().catch(() => {})}
                    disabled={excluindoMensagem}
                  >
                    {excluindoMensagem ? <div className="spinner-border spinner-border-sm" role="status" /> : <TrashFill size={14} />}
                    <span>{excluindoMensagem ? "Excluindo..." : "Excluir"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default MensagensModal;
