'use strict';
function safeCount(value) {
  if (value && typeof value === 'object') value = value.count ?? value.value ?? value.total;
  const n = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function safePicture(value) {
  const url = typeof value === 'string' ? value : value?.url || value?.imgUrl || value?.imageUrl;
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
}
function channelPresentation(primary, backup = {}) {
  const first = primary || {};
  const fallback = backup || {};
  const nameRaw = first.name ?? fallback.name;
  const descriptionRaw = first.description ?? fallback.description;
  const name = typeof nameRaw === 'string' ? nameRaw : (nameRaw?.text || '');
  const description = typeof descriptionRaw === 'string' ? descriptionRaw : (descriptionRaw?.text || '');
  const candidateCounts = [
    first.subscribersCount, first.subscriberCount, first.followersCount, first.followers,
    first.subscribers, fallback.subscribersCount, fallback.subscriberCount,
    fallback.followersCount, fallback.followers, fallback.subscribers,
  ];
  const followersCount = candidateCounts.map(safeCount).find(x => x !== null) ?? null;
  const photoUrl = safePicture(first.picture) || safePicture(first.pictureUrl) ||
    safePicture(first.photoUrl) || safePicture(fallback.picture) ||
    safePicture(fallback.pictureUrl) || safePicture(fallback.photoUrl);
  return {
    name: String(name || 'Canal WhatsApp').slice(0, 160),
    description: String(description || '').slice(0, 600),
    photoUrl, followersCount,
  };
}
module.exports = { channelPresentation, safeCount, safePicture };
