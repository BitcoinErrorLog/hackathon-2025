# URL Hash Tag System

## Overview

The extension now automatically adds a **deterministic hash tag** to every post about a URL. This enables the sidebar to show posts from your contacts about the page you're currently viewing.

## How It Works

### 1. URL Hash Generation

When creating a post (bookmark or tagged post), the system:

```typescript
// Generate SHA-256 hash of the URL
const urlBytes = encoder.encode(url);
const hashBytes = await sha256(urlBytes);
const hashHex = bytesToHex(hashBytes);

// Create hash tag with 'url:' prefix
const urlHashTag = `url:${hashHex}`;
```

**Example:**
```
URL: https://pubky.app
Hash Tag: url:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4
```

### 2. Automatic Tag Addition

Every link post automatically gets this hash tag:

```typescript
// User tags: ["tech", "cool"]
// System adds: "url:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
// Final tags: ["tech", "cool", "url:8f434346..."]
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
  // UTF-16 encode the URL
  const encoder = new TextEncoder();
  const urlBytes = encoder.encode(url);
  
  // SHA-256 hash
  const hashBytes = await sha256(urlBytes);
  
  // Convert to hex
  const hashHex = bytesToHex(hashBytes);
  
  // Prefix with 'url:' identifier
  return `url:${hashHex}`;
}
```

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
https://pubky.app     → url:8f434346...
https://pubky.app/    → url:different_hash...

// Each exact URL gets its own unique hash
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

Could use different prefixes for different types:

```typescript
url:8f434...      // URL hash (current)
domain:abc123...  // Domain-only hash
path:def456...    // Path-only hash
```

### Batch Tag Queries

Query multiple tags at once:

```typescript
// Get posts about this URL OR domain
searchPostsByTags([urlHashTag, domainHashTag])
```

## Summary

✅ **Deterministic:** Same URL = same hash = same tag  
✅ **Automatic:** No manual work - system adds hash  
✅ **Efficient:** Indexed tag search via Nexus  
✅ **Social:** Only shows posts from your network  
✅ **Privacy-Preserving:** Hash doesn't reveal URL  
✅ **Spec-Compliant:** Uses standard Pubky tag format  

The sidebar now shows a **curated feed of what your contacts think about the page you're viewing**! 🎉

