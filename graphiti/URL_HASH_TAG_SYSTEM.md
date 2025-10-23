# URL Hash Tag System

## Overview

The extension now automatically adds a **deterministic hash tag** to every post about a URL. This enables the sidebar to show posts from your contacts about the page you're currently viewing.

## How It Works

### 1. URL Hash Generation

When creating a post (bookmark or tagged post), the system:

```typescript
// Generate SHA-256 hash of the URL (32 bytes)
const urlBytes = encoder.encode(url);
const hashBytes = await sha256(urlBytes);

// Take first 14 bytes (112 bits) for compression
const truncatedHash = hashBytes.slice(0, 14);

// Encode as base64url (19 chars)
let base64url = base64UrlEncode(truncatedHash);

// Lowercase for Pubky tag compatibility
base64url = base64url.toLowerCase();

// Prefix with 'u' to identify as URL hash (20 chars total)
const urlHashTag = `u${base64url}`;
```

**Example:**
```
URL: https://pubky.app
Hash Tag: up8wkqecvk9bwct-p4hw
Length: 20 characters (exact 20-char limit)
Character set: a-z, 0-9, -, _ (lowercase alphanumeric, URL-safe)
```

### 2. Automatic Tag Addition

Every link post automatically gets this hash tag:

```typescript
// User tags: ["tech", "cool"]
// System adds: "up8wkqecvk9bwct-p4hw"
// Final tags: ["tech", "cool", "up8wkqecvk9bwct-p4hw"]
```

**Applied To:**
- ✅ User-tagged posts (`handleTag`)
- ✅ Bookmarked posts (`createBookmark`)

### 3. Sidebar Query

When you open the sidebar on a page, it:

1. Generates the URL hash tag for the current page
2. Queries Nexus for posts with that tag from your following
3. Displays all posts about this URL from your network

```typescript
// Generate hash for current page
const urlHashTag = await generateUrlHashTag(currentUrl);

// Query Nexus
const posts = await nexusClient.searchPostsByTag(urlHashTag, {
  observer_id: session.pubky,  // Only from contacts
  limit: 50,
  sorting: 'latest'
});
```

## Benefits

### Consistent URL Matching

**Problem:** URLs can have trailing slashes, query params, fragments:
- `https://pubky.app`
- `https://pubky.app/`
- `https://pubky.app?ref=twitter`
- `https://pubky.app#features`

**Solution:** Hash tags are deterministic - same URL = same hash = same tag!

**Note:** Different URL strings will generate different hashes. For more flexible matching, consider URL normalization (see Future Enhancements).

### Efficient Querying

- **Before:** Content search (slow, unreliable)
- **After:** Tag search via Nexus index (fast, accurate)

### Network Filtering

Nexus `observer_id` parameter ensures you only see posts from:
- ✅ People you follow
- ✅ People they follow (social graph)
- ❌ Random strangers

### Privacy-Preserving

The hash doesn't reveal the URL - it's a one-way function. Only people who also have the URL can generate the same hash.

## Code Flow

### Creating a Tagged Post

```typescript
// popup/App.tsx - User adds tags
handleTag(["tech", "cool"])
  ↓
// pubky-api-sdk.ts - Create post with tags
createLinkPost(url, content, ["tech", "cool"])
  ↓
// Automatically add URL hash
const urlHashTag = await generateUrlHashTag(url)
const allTags = [...tags, urlHashTag]
  ↓
// Create all tags including hash
createTags(postUri, allTags)
  ↓
// Tags on homeserver:
// - pubky://.../tags/{id1} → { uri: postUri, label: "tech" }
// - pubky://.../tags/{id2} → { uri: postUri, label: "cool" }
// - pubky://.../tags/{id3} → { uri: postUri, label: "url:8f434..." }
```

### Creating a Bookmark

```typescript
// popup/App.tsx - User bookmarks page
handleBookmark()
  ↓
// pubky-api-sdk.ts - Create post first
createBookmark(url)
  ↓
// Create link post
const post = createPost(url, "link", ...)
  ↓
// Add URL hash tag
const urlHashTag = await generateUrlHashTag(url)
createTags(postUri, [urlHashTag])
  ↓
// Bookmark the post
createBookmark(postUri)
```

### Querying in Sidebar

```typescript
// sidepanel/App.tsx - User views page
loadPosts()
  ↓
// pubky-api-sdk.ts
searchPostsByUrl(currentUrl, session.pubky)
  ↓
// Generate hash for current page
const urlHashTag = await generateUrlHashTag(currentUrl)
  ↓
// Query Nexus by tag
nexusClient.searchPostsByTag(urlHashTag, {
  observer_id: session.pubky,
  limit: 50
})
  ↓
// Display posts from your network about this URL
```

## Implementation Details

### Hash Function (`crypto.ts`)

```typescript
export async function generateUrlHashTag(url: string): Promise<string> {
  // Encode URL as UTF-8 bytes
  const encoder = new TextEncoder();
  const urlBytes = encoder.encode(url);
  
  // SHA-256 hash (32 bytes = 256 bits)
  const hashBytes = await sha256(urlBytes);
  
  // Take first 14 bytes (112 bits) for compression
  const truncatedHash = hashBytes.slice(0, 14);
  
  // Encode as base64url (19 chars: A-Z, a-z, 0-9, -, _)
  let base64url = base64UrlEncode(truncatedHash);
  
  // Lowercase for Pubky tag compatibility
  base64url = base64url.toLowerCase();
  
  // Prefix with 'u' marker (total 20 chars exactly)
  return `u${base64url}`;
}
```

**Why Base64url Encoding?**

1. **Compression:** 14 bytes → 19 chars + 1 prefix = 20 chars (exact limit)
2. **Tag Compatibility:** Pubky tags normalize to lowercase alphanumeric
3. **URL-Safe:** Uses only `a-z`, `0-9`, `-`, `_` characters
4. **Collision Resistance:** 2^112 ≈ 5×10^33 possible hashes
5. **Birthday Paradox:** Collisions expected at ~2^56 ≈ 72 quadrillion URLs
6. **Deterministic:** Same URL always produces the same hash

### Tag Creation (`pubky-api-sdk.ts`)

**Link Post with Tags:**
```typescript
async createLinkPost(url: string, content: string, tags: string[]): Promise<string> {
  // Create post
  const post = builder.createPost(content, PubkyAppPostKind.Link, ...);
  await this.pubky.fetch(postUri, { method: 'PUT', ... });
  
  // Add URL hash to user tags
  const urlHashTag = await generateUrlHashTag(url);
  const allTags = [...tags, urlHashTag];
  
  // Create all tags
  await this.createTags(postUri, allTags);
  
  return postUri;
}
```

**Bookmark:**
```typescript
async createBookmark(url: string): Promise<{ ... }> {
  // Create post
  const post = builder.createPost(url, PubkyAppPostKind.Link, ...);
  await this.pubky.fetch(postUri, { method: 'PUT', ... });
  
  // Add URL hash tag
  const urlHashTag = await generateUrlHashTag(url);
  await this.createTags(postUri, [urlHashTag]);
  
  // Create bookmark
  const bookmark = builder.createBookmark(postUri);
  await this.pubky.fetch(bookmarkPath, { method: 'PUT', ... });
  
  return { fullPath, bookmarkId, postUri };
}
```

### Nexus Query (`nexus-client.ts`)

```typescript
async searchPostsByTag(tag: string, options: {
  observer_id?: string;
  sorting?: 'latest' | 'oldest';
  limit?: number;
}): Promise<NexusPost[]> {
  const url = `${NEXUS_API}/v0/search/posts/by_tag/${encodeURIComponent(tag)}`;
  
  const params = new URLSearchParams();
  if (options.observer_id) params.append('observer_id', options.observer_id);
  if (options.sorting) params.append('sorting', options.sorting);
  if (options.limit) params.append('limit', options.limit.toString());
  
  const response = await fetch(url + '?' + params);
  const data = await response.json();
  
  return data.data || [];
}
```

## Testing

### 1. Create Tagged Post

```
1. Navigate to https://pubky.app
2. Click extension popup
3. Add tags: "cool", "tech"
4. Check debug logs:
   ✓ "Adding tags including URL hash"
   ✓ urlHashTag: "url:8f434346..."
   ✓ totalTags: 3
```

### 2. View in Sidebar

```
1. Stay on https://pubky.app
2. Open sidebar
3. Check debug logs:
   ✓ "Searching by URL hash tag"
   ✓ urlHashTag: "url:8f434346..."
   ✓ "Found posts with URL hash tag"
4. See your post appear!
```

### 3. Verify Same Hash

```
// Test that different URL formats generate different hashes
https://pubky.app     → up8wkqecvk9bwct-p4hw
https://pubky.app/    → u[different base64url chars]

// Each exact URL gets its own unique hash
// Verify length is always exactly 20 characters
// Verify only contains: a-z, 0-9, -, _
```

### 4. Check Following Filter

```
1. Have a friend tag the same URL
2. Open sidebar - should see their post
3. Random user tags same URL
4. Should NOT appear (not in your network)
```

## Future Enhancements

### URL Normalization (Optional)

Could normalize URLs before hashing to group variations:

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  // Remove trailing slash
  const path = parsed.pathname.replace(/\/$/, '');
  // Remove common tracking params
  parsed.searchParams.delete('utm_source');
  parsed.searchParams.delete('utm_medium');
  // Rebuild
  return `${parsed.origin}${path}${parsed.search}${parsed.hash}`;
}
```

**Tradeoff:** More matches vs. less precision

### Tag Prefix Customization

Could use different prefixes for different hash types:

```typescript
u[hash]    // URL hash (current)
d[hash]    // Domain-only hash  
p[hash]    // Path-only hash
```

### Batch Tag Queries

Query multiple tags at once:

```typescript
// Get posts about this URL OR domain
searchPostsByTags([urlHashTag, domainHashTag])
```

## Summary

✅ **Deterministic:** Same URL = same hash = same tag  
✅ **Exact Fit:** 20 chars (exact tag limit)  
✅ **Collision-Resistant:** 2^112 entropy (~72 quadrillion URLs to collision)  
✅ **Tag-Compatible:** Lowercase alphanumeric (a-z, 0-9, -, _)  
✅ **Automatic:** No manual work - system adds hash  
✅ **Efficient:** Indexed tag search via Nexus  
✅ **Social:** Only shows posts from your network  
✅ **Privacy-Preserving:** Hash doesn't reveal URL  
✅ **Spec-Compliant:** Uses standard Pubky tag format  

The sidebar now shows a **curated feed of what your contacts think about the page you're viewing**! 🎉

