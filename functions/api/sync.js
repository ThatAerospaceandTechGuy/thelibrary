/**
 * Cloudflare Pages Function — POST /api/sync
 *
 * 1. Checks {user, pass} against ADMIN_USER / ADMIN_PASSWORD.
 * 2. Signs a RS256 JWT with the Google service account key (Web Crypto only)
 *    and exchanges it for an OAuth access token.
 * 3. Lists PDFs in DRIVE_FOLDER_ID via the Drive API.
 * 4. Commits the rebuilt textbooks.json to GitHub, which redeploys the site.
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function b64url(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const b64urlText = (str) => b64url(new TextEncoder().encode(str));

function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function pemToArrayBuffer(pem) {
  const body = pem
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

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

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
    if (!res.ok) {
      throw new Error(`Drive list failed: ${data?.error?.message || res.status}`);
    }
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

async function commitJson(env, contentString) {
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const path = "textbooks.json";
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "the-stacks-sync",
    "Content-Type": "application/json",
  };

  let sha;
  const current = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (current.ok) {
    const meta = await current.json().catch(() => ({}));
    sha = meta.sha;
  } else if (current.status !== 404) {
    const text = await current.text();
    throw new Error(`GitHub read failed (${current.status}): ${text.slice(0, 200)}`);
  }

  const put = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "chore: sync textbooks.json from Drive",
      content: b64encodeUtf8(contentString),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    const text = await put.text();
    throw new Error(`GitHub commit failed (${put.status}): ${text.slice(0, 200)}`);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ message: "Invalid request body." }, 400);
  }

  const { user, pass } = body || {};
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) {
    return json({ message: "Server is missing admin credentials configuration." }, 500);
  }
  if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASSWORD) {
    return json({ message: "Invalid credentials." }, 401);
  }

  for (const name of ["GDRIVE_SA_KEY", "DRIVE_FOLDER_ID", "GITHUB_TOKEN", "GITHUB_REPO"]) {
    if (!env[name]) return json({ message: `Server is missing ${name}.` }, 500);
  }

  try {
    let saKey;
    try {
      saKey = JSON.parse(env.GDRIVE_SA_KEY);
    } catch (_) {
      return json({ message: "GDRIVE_SA_KEY is not valid JSON." }, 500);
    }

    const token = await getAccessToken(saKey);
    const files = await listPdfs(token, env.DRIVE_FOLDER_ID);

    const books = files
      .map((f) => ({
        name: f.name,
        size: f.size ? Number(f.size) : null,
        dateModified: f.modifiedTime || null,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const payload = { lastSynced: new Date().toISOString(), books };
    await commitJson(env, JSON.stringify(payload, null, 2) + "\n");

    return json({ count: books.length });
  } catch (err) {
    return json({ message: err?.message || "Sync failed." }, 502);
  }
}
