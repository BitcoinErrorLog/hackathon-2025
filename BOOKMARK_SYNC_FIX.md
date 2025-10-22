# Bookmark Sync Fix

## Problem
Bookmarks created in the extension were being written to the Pubky homeserver, but when removed in the extension, they were only deleted from local Chrome storage - NOT from the homeserver. This meant:
- ❌ Bookmarks removed in extension still showed in Pubky App
- ❌ Bookmarks weren't properly synced between extension and Pubky App

## Solution
Implemented proper bookmark deletion from the Pubky homeserver when users remove bookmarks in the extension.

## Changes Made

### 1. Added `deleteBookmark()` Method (`src/utils/pubky-api-sdk.ts`)
- Uses the SDK's `PubkySpecsBuilder` to regenerate the deterministic bookmark ID from the URL
- Sends a DELETE request to the homeserver at the bookmark's path
- Properly logs success/failure

```typescript
async deleteBookmark(url: string): Promise<void> {
  // Regenerates the same ID from URL using Blake3 hash
  const builder = new PubkySpecsBuilder(session.pubky);
  const result = builder.createBookmark(url);
  const fullPath = result.meta.url;
  
  // DELETE from homeserver
  await this.pubky.fetch(fullPath, { method: 'DELETE' });
}
```

### 2. Enhanced `createBookmark()` Return Value
- Changed from returning just `string` to `{ fullPath: string; bookmarkId: string }`
- Allows storing both the full path and ID for future reference

### 3. Updated Storage Interface (`src/utils/storage.ts`)
- Added `bookmarkId` field to `StoredBookmark` interface
- Added `getBookmark()` helper method to retrieve a specific bookmark

### 4. Fixed Bookmark Removal Flow (`src/popup/App.tsx`)
- When removing a bookmark:
  1. First deletes from homeserver using `pubkyAPISDK.deleteBookmark()`
  2. Then removes from local Chrome storage
- When creating a bookmark:
  1. Stores the `bookmarkId` for potential future use
  2. Stores the full `pubkyUrl` path

## How It Works

### Bookmark IDs are Deterministic
According to the Pubky App specs, bookmark IDs are generated using:
```
Blake3(uri) → Crockford Base32 encoding
```

This means:
- The same URL always generates the same bookmark ID
- We can regenerate the ID when we need to delete a bookmark
- No need to store complex state or track IDs separately

### Sync Flow

**Creating a Bookmark:**
1. User clicks "Bookmark This Page"
2. Extension generates deterministic ID using SDK
3. Writes bookmark to homeserver: `PUT pubky://user_id/pub/pubky.app/bookmarks/{id}`
4. Saves to local storage for quick UI updates
5. ✅ Bookmark appears in both extension AND Pubky App

**Removing a Bookmark:**
1. User clicks "Remove Bookmark"
2. Extension regenerates the same deterministic ID
3. Deletes from homeserver: `DELETE pubky://user_id/pub/pubky.app/bookmarks/{id}`
4. Removes from local storage
5. ✅ Bookmark removed from both extension AND Pubky App

## Testing Checklist

To verify the fix works:

1. **Create a Bookmark**
   - [ ] Open extension on any webpage
   - [ ] Click "Bookmark This Page"
   - [ ] Check debug logs for "Bookmark written to homeserver"
   - [ ] Open Pubky App and verify bookmark appears there

2. **Remove a Bookmark**
   - [ ] Click "Remove Bookmark" in extension
   - [ ] Check debug logs for "Bookmark deleted from homeserver"
   - [ ] Refresh Pubky App and verify bookmark is gone

3. **Bidirectional Sync**
   - [ ] Create bookmark in extension → verify in Pubky App
   - [ ] Create bookmark in Pubky App → should appear in extension (may require refresh)
   - [ ] Delete in extension → verify removed from Pubky App
   - [ ] Delete in Pubky App → verify removed from extension (may require refresh)

## Technical Notes

### Why This Works
- Bookmark IDs are **deterministic** (based on URL hash), not random
- The SDK's `createBookmark()` always returns the same ID for the same URL
- We can safely regenerate IDs for deletion without storing them

### Error Handling
- If homeserver deletion fails, logs a warning but doesn't throw
- Local storage is always cleaned up
- Ensures UI stays in sync even if network fails

### Performance
- Bookmark ID generation is fast (WASM Blake3 hashing)
- No additional network calls needed (ID is computed locally)
- Deterministic IDs avoid state management complexity

## Files Modified
- `src/utils/pubky-api-sdk.ts` - Added `deleteBookmark()` method
- `src/utils/storage.ts` - Updated `StoredBookmark` interface, added `getBookmark()`
- `src/popup/App.tsx` - Updated `handleBookmark()` to delete from homeserver

## Compatibility
✅ Fully compatible with Pubky App v0.4.0 specs  
✅ Uses official `pubky-app-specs` SDK  
✅ Follows deterministic ID generation standards

