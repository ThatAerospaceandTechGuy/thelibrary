# Textbook Sync

Project prompt: "The Stacks" textbook hosting site

Build a small static website with the following requirements.

Stack & hosting

Plain static HTML/CSS/JS — no build step, no framework.

Hosted on Cloudflare Pages, deployed from a GitHub repo (ThatAerospaceandTechGuy/textbooks).

All files live at the repo root (no subfolders for HTML/CSS), except the sync function, which must be at functions/api/sync.js (Cloudflare Pages Functions requirement — this becomes the /api/sync route).

Pages

index.html — Home page. Short hero intro to the site, a link/button to the Textbooks page.

textbooks.html — Textbooks page. Fetches textbooks.json at runtime and renders a table with columns: Name, Size, Date modified, Download (download cell has a small icon + button). Sort alphabetically by name. Handle empty state (no books yet) and error state (fetch failed) gracefully.

admin.html — Admin page, noindex. A single form with username field, password field, and a "Sync now" button. On submit, POST {user, pass} as JSON to /api/sync. Show a status message: success (with count of books synced), wrong credentials (401), or failure. Disable the button and show "Syncing…" while the request is in flight.

All three pages share one style.css and a header with nav links: Home, Textbooks, Admin (mark the current page with aria-current="page").

Design

Modern, clean UI: white/light surfaces, subtle rounded cards, one accent color (indigo), Inter font from Google Fonts, generous whitespace, no heavy shadows or gradients. Should look like a simple SaaS admin tool, not a template-y "AI generated" page — avoid clichés like purple-to-pink gradients, glowing blobs, or center-everything hero sections.

Data source & sync flow

Textbook PDFs live in a shared Google Drive folder (folder ID: 1-P9CM54-123lq0T3xX6IhLAzs9QiuMFE).

textbooks.json (committed in the repo) is what the frontend actually reads — the site never calls Google Drive directly from the browser.

functions/api/sync.js is a Cloudflare Pages Function (runs on Workers runtime, so Web Crypto only, no Node crypto) that, on a valid POST:

Checks user/pass in the request body against ADMIN_USER/ADMIN_PASSWORD env vars. Returns 401 if wrong.

Authenticates to the Google Drive API using a service account: builds and signs a JWT (RS256, via crypto.subtle) from the service account's private key, exchanges it for an OAuth access token at https://oauth2.googleapis.com/token.

Lists all application/pdf files in the target Drive folder (files.list, filtered by '<folderId>' in parents), getting id, name, size, modifiedTime.

Builds a textbooks.json payload: { lastSynced, books: [{ name, size, dateModified, downloadUrl }] }, where downloadUrl is https://drive.google.com/uc?export=download&id=<fileId>.

Commits the updated textbooks.json back to the GitHub repo via the GitHub Contents API (fetch current file's sha first, then PUT the new content, base64-encoded).

That commit triggers Cloudflare Pages to auto-redeploy, and the new list goes live.

Returns { count } JSON on success, or a { message } error with an appropriate status code on failure.

Required Cloudflare Pages environment variables (set as Secret where noted)

VariablePurposeADMIN_USERadmin login usernameADMIN_PASSWORD (secret)admin login passwordGDRIVE_SA_KEY (secret)full JSON contents of the Google service account keyDRIVE_FOLDER_IDthe shared Drive folder's IDGITHUB_TOKEN (secret)fine-grained GitHub PAT, scoped to this repo only, Contents: Read and writeGITHUB_REPOowner/repoGITHUB_BRANCHusually main

Prerequisites the user needs to set up

A Google Cloud project with the Drive API enabled and a service account created; the service account's JSON key downloaded; the shared Drive folder shared with the service account's client_email as Viewer.

A GitHub fine-grained PAT scoped to just this repo with Contents read/write.

All of the above env vars entered into Cloudflare Pages → Settings → Environment variables.

Known constraints / things to flag to the user

No real session auth — credentials are checked per-request inside the function. Fine for a low-stakes shared shelf; not meant for anything sensitive.

Sync is on-demand (button click), not real-time — there's no Drive webhook, so changes only appear after someone clicks Sync.

Google's uc?export=download links can show a "can't scan for viruses" interstitial for very large files — normal Drive behavior.

Only top-level PDF files in the folder are listed; subfolders aren't scanned.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c52b0669-2c94-4230-bfd0-e5617c638ce9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
