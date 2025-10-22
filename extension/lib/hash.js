const encoder = new TextEncoder();

export const sha256 = async (payload) => {
  const data = encoder.encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const deterministicRecordId = async ({ url, tags }) => {
  const normalizedUrl = url.trim();
  const normalizedTags = [...new Set(tags.map((tag) => tag.trim().toLowerCase()))].sort();
  const payload = JSON.stringify({ url: normalizedUrl, tags: normalizedTags });
  return sha256(payload);
};
