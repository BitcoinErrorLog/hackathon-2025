# Bookmark Sync Fix - CORRECTED

## The Real Problem

The bookmark feature was not working because we were **misusing the Pubky SDK authentication flow**:

### What Was Wrong

1. **Misunderstanding `authRequest.response()`**
   - We treated the response as a `PublicKey` object
   - **Actually**, it returns a `Session` object that contains authentication state
   - We were calling `.z32()` on it like a PublicKey, which was incorrect

2. **Missing Authentication Credentials**
   - We were making PUT/DELETE requests **without** `credentials: 'include'`
   - According to the SDK docs, authenticated writes MUST include `credentials: 'include'`
   - Without this, the homeserver rejects write operations

3. **Not Using the Authenticated Client**
   - We were creating a separate Client instance for writes
   - We needed to use the **same** Client instance that performed the auth
   - The auth state (cookies/session) lives in that Client instance

## The Correct SDK Flow

According to the `@synonymdev/pubky` documentation:

```javascript
// Create auth request
let pubkyAuthRequest = client.authRequest(relay, capabilities);
let pubkyauthUrl = pubkyAuthRequest.url();

// Show QR code to user
showQr(pubkyauthUrl);

// Wait for approval - returns a SESSION, not a PublicKey!
let session = await pubkyAuthRequest.response();

// Get the user's pubky ID from the session
let pubkyId = session.pubky();

// Make authenticated writes using the SAME client
await client.fetch(url, {
  method: 'PUT',
  body: JSON.stringify(data),
  credentials: 'include'  // CRITICAL!
});
```

### Key Points

1. **`authRequest.response()` returns a `Session`**, not a `PublicKey`
2. **Use `session.pubky()` to get the user ID**
3. **Always include `credentials: 'include'`** for PUT/DELETE operations
4. **Use the same Client instance** that did the auth for all operations

## Changes Made

### 1. Fixed Auth Response Handling (`src/utils/auth-sdk.ts`)

**Before:**
```typescript
const publicKey = await authRequest.response();
const pubkyId = publicKey.z32();  // WRONG!
```

**After:**
```typescript
const sdkSession = await authRequest.response();  // Returns Session!
const pubkyId = sdkSession.pubky();  // Correct way to get ID
```

### 2. Store and Reuse the Authenticated Client

**Before:**
```typescript
// Created separate client instances
this.pubky = new Client();
```

**After:**
```typescript
// Get the same client instance used for auth
const client = await authManagerSDK.getAuthenticatedClient();
```

### 3. Include Credentials in All Write Operations

**Before:**
```typescript
await this.pubky.fetch(fullPath, {
  method: 'PUT',
  body: JSON.stringify(bookmark),
  // Missing credentials!
});
```

**After:**
```typescript
await client.fetch(fullPath, {
  method: 'PUT',
  body: JSON.stringify(bookmark),
  credentials: 'include',  // CRITICAL!
});
```

### 4. Proper Error Handling

**Before:**
```typescript
catch (writeError) {
  logger.warn('Failed to write, saving locally only');
  // Silently failed
}
```

**After:**
```typescript
catch (writeError) {
  logger.error('Failed to write bookmark', writeError);
  throw writeError;  // Proper error propagation
}
```

## Files Modified

1. **`src/utils/auth-sdk.ts`**
   - Fixed `awaitApproval()` to properly handle Session response
   - Updated `storeSessionData()` to store SDK session info
   - Added `getAuthenticatedClient()` method
   - Fixed `signOut()` to properly clean up SDK session

2. **`src/utils/pubky-api-sdk.ts`**
   - Removed separate Pubky client initialization
   - Use `authManagerSDK.getAuthenticatedClient()` for all operations
   - Added `credentials: 'include'` to all PUT/DELETE requests
   - Updated `createBookmark()`, `deleteBookmark()`, `createTags()`, `createLinkPost()`
   - Proper error propagation instead of silent failures

## How It Works Now

### Creating a Bookmark

1. User clicks "Bookmark This Page"
2. Extension uses authenticated client from auth flow
3. Generates deterministic bookmark ID using `PubkySpecsBuilder`
4. Sends PUT request **with credentials** to homeserver
5. Homeserver accepts because session is authenticated
6. ✅ Bookmark appears in both extension AND Pubky App

### Deleting a Bookmark

1. User clicks "Remove Bookmark"
2. Extension regenerates the same deterministic ID
3. Sends DELETE request **with credentials** to homeserver
4. Homeserver accepts because session is authenticated
5. ✅ Bookmark removed from both extension AND Pubky App

## Why This Fix Works

### Authenticated Sessions
- After QR auth approval, the Client has an active session
- Session state includes cookies/credentials for the homeserver
- Using `credentials: 'include'` sends these credentials with requests

### Single Client Instance
- The auth state lives in the Client object
- Reusing the same Client ensures we have the auth context
- Creating new Client instances loses the session state

### Proper SDK Usage
- Following the official SDK documentation exactly
- Using the correct types (Session vs PublicKey)
- Including required parameters (`credentials: 'include'`)

## Testing

To verify the fix:

1. **Fresh Auth Flow**
   - Clear extension data
   - Generate QR code
   - Scan with Pubky mobile app
   - Approve the request
   - Check debug logs for "Session created and stored"

2. **Create Bookmark**
   - Navigate to any webpage
   - Click "Bookmark This Page"
   - Check debug logs for "Bookmark written to homeserver" with `credentials: 'include'`
   - Open Pubky App - bookmark should appear

3. **Delete Bookmark**
   - Click "Remove Bookmark"
   - Check debug logs for "Bookmark deleted from homeserver"
   - Refresh Pubky App - bookmark should be gone

4. **Check for Errors**
   - No 401 Unauthorized errors (would mean missing auth)
   - No 403 Forbidden errors (would mean wrong permissions)
   - Successful PUT/DELETE responses from homeserver

## References

- [@synonymdev/pubky SDK](https://www.npmjs.com/package/@synonymdev/pubky)
- [pubky-app-specs v0.4.0](https://www.npmjs.com/package/pubky-app-specs)
- [Pubky SDK Documentation](https://github.com/pubky/pubky-core)
- [HTTP Relay Auth Flow](https://httprelay.io/features/link/)

## Key Takeaways

✅ **`authRequest.response()` returns a Session object, not a PublicKey**  
✅ **Always use `credentials: 'include'` for authenticated writes**  
✅ **Reuse the same Client instance that performed authentication**  
✅ **Proper error handling - don't silently fail writes**  
✅ **Follow the official SDK examples exactly**
