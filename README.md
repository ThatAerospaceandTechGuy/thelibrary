# The Stacks

A simple, modern digital library for browsing and accessing files stored in a shared Google Drive folder.

## Overview

**The Stacks** is a lightweight library website designed to make a shared collection of documents and other files easy to browse. The site displays files directly from Google Drive and provides links to view or download them.

The frontend is intentionally kept simple and static, while the small Cloudflare Pages Functions backend handles communication with Google Drive.

## Features

- 📚 Browse all files in the shared library
- 🔎 Automatic file type detection
- 📦 File size display
- 📅 Last modified date
- 👁️ Open files in the browser
- ⬇️ Download files directly
- 🔄 Live file listing from Google Drive
- 🌙 Modern dark interface
- 📱 Responsive layout for desktop and mobile

## Tech Stack

- **HTML** — static frontend pages
- **CSS** — custom responsive styling
- **JavaScript** — client-side file loading and UI
- **Cloudflare Pages Functions** — lightweight API layer
- **Google Drive API** — file storage and listing

No Vite, React, or frontend build system is required.

## Project Structure

```text
.
├── index.html
├── textbooks.html
├── admin.html
├── style.css
└── functions/
    └── api/
        ├── books.js
        └── sync.js
```

## How It Works

The library page requests the `/api/books` endpoint. The Cloudflare Pages Function uses the Google Drive API to retrieve every non-deleted file from the configured Drive folder.

The returned information includes:

- File name
- File ID
- MIME type
- File size
- Modified date
- View URL
- Download URL

The frontend then builds the library table dynamically.

## Google Drive Setup

The backend requires access to a Google Drive folder through a Google service account.

Configure the required environment variables in Cloudflare Pages and make sure the target Google Drive folder has been shared with the service account.

**Do not commit service-account credentials, private keys, API keys, or other secrets to this repository.**

## Deployment

The project is suitable for deployment using **Cloudflare Pages** with Pages Functions enabled.

Because the frontend is static, it can also be served by any normal static web host, although the `/api/books` endpoint requires the backend function to be available.

## Local Development

For the static frontend, the HTML files can be opened directly in a browser or served using any simple local web server.

For the full application, use a development environment that supports Cloudflare Pages Functions and configure the required Google Drive environment variables.

## License

This project does not currently specify a license. If you plan to allow others to reuse or modify the code, consider adding an appropriate open-source license.
