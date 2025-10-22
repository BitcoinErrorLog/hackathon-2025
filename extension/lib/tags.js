const slugify = (tag) => tag.toLowerCase().trim().replace(/[^a-z0-9\-_.]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

export const normalizeTags = (tags) => {
  return Array.from(
    new Set(
      (tags || [])
        .map((tag) => slugify(tag))
        .filter((tag) => tag.length > 0)
    )
  ).slice(0, 12);
};
