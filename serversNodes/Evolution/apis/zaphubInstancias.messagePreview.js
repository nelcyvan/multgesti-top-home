export function truncateText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function getMessagePreview(message, messageType) {
  if (!message || typeof message !== "object") return `[${messageType || "mensagem"}]`;

  const candidates = [
    message.conversation,
    message.extendedTextMessage?.text,
    message.extendedTextMessage?.caption,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    message.documentMessage?.fileName,
    message.buttonsResponseMessage?.selectedDisplayText,
    message.listResponseMessage?.title,
    message.listResponseMessage?.description,
    message.templateButtonReplyMessage?.selectedDisplayText,
    message.interactiveResponseMessage?.body?.text,
    message.interactiveMessage?.body?.text,
    message.pollCreationMessage?.name,
    message.pollCreationMessageV2?.name,
    message.contactMessage?.displayName,
    message.contactsArrayMessage?.contacts?.[0]?.displayName,
    message.locationMessage?.name,
    message.locationMessage?.address,
    message.liveLocationMessage?.caption,
    message.reactionMessage?.text,
  ];

  const textCandidate = candidates.find((value) => typeof value === "string" && value.trim());
  if (textCandidate) return truncateText(textCandidate);

  const labelsByType = {
    audioMessage: "[Audio]",
    stickerMessage: "[Sticker]",
    imageMessage: "[Imagem]",
    videoMessage: "[Video]",
    documentMessage: "[Documento]",
    interactiveMessage: "[Interativo]",
    reactionMessage: "[Reação]",
    locationMessage: "[Localização]",
    liveLocationMessage: "[Localização ao vivo]",
    contactMessage: "[Contato]",
    contactsArrayMessage: "[Contatos]",
    pollCreationMessage: "[Enquete]",
    pollCreationMessageV2: "[Enquete]",
  };

  return labelsByType[messageType] || `[${messageType || "mensagem"}]`;
}
