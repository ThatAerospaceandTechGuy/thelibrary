/**
 * Cloudflare Pages Function — /api/sync and /api/books
 * Reads PDF textbooks from Google Drive. The frontend remains static;
 * the live book list is served through this function, so no deployment is
 * needed when textbooks are added or removed.
 */

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function b64url(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const b64urlText = (str) => b64url(new TextEncoder().encode(str));

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(saKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: saKey.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlText(JSON.stringify(header))}.${b64urlText(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(saKey.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Google auth failed: ${data.error_description || data.error || res.status}`);
  }
  return data.access_token;
}

function getServiceAccount(env) {
  if (env.GDRIVE_CLIENT_EMAIL && env.GDRIVE_PRIVATE_KEY) {
    return {
      client_email: env.GDRIVE_CLIENT_EMAIL,
      private_key: env.GDRIVE_PRIVATE_KEY,
    };
  }
  if (!env.GDRIVE_SA_KEY) throw new Error("Server is missing Google service account configuration.");
  try {
    return JSON.parse(env.GDRIVE_SA_KEY);
  } catch (_) {
    throw new Error("GDRIVE_SA_KEY is not valid JSON. Add GDRIVE_CLIENT_EMAIL and GDRIVE_PRIVATE_KEY, or replace GDRIVE_SA_KEY with the full service-account JSON.");
  }
}

async function listPdfs(token, folderId) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: "nextPageToken, files(id, name, size, modifiedTime)",
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Drive list failed: ${data?.error?.message || res.status}`);
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function getBooks(env) {
  if (!env.DRIVE_FOLDER_ID) throw new Error("Server is missing DRIVE_FOLDER_ID.");
  const token = await getAccessToken(getServiceAccount(env));
  const files = await listPdfs(token, env.DRIVE_FOLDER_ID);
  return files.map((f) => ({
    name: f.name,
    size: f.size ? Number(f.size) : null,
    dateModified: f.modifiedTime || null,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
  })).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  if (url.pathname.endsWith("/books") && request.method === "GET") {
    try {
      const books = await getBooks(env);
      return json({ lastSynced: new Date().toISOString(), books });
    } catch (err) {
      return json({ message: err?.message || "Could not load textbooks." }, 502);
    }
  }

  if (url.pathname.endsWith("/sync") && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch (_) { return json({ message: "Invalid request body." }, 400); }
    const { user, pass } = body || {};
    if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return json({ message: "Server is missing admin credentials configuration." }, 500);
    if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASSWORD) return json({ message: "Invalid credentials." }, 401);

    try {
      const books = await getBooks(env);
      return json({ count: books.length, books, message: "Drive synced successfully. No deployment is required." });
    } catch (err) {
      return json({ message: err?.message || "Sync failed." }, 502);
    }
  }

  return json({ message: "Not found." }, 404);
}
