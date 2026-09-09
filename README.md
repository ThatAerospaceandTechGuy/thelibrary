# The Stacks

A simple, modern digital library for browsing and accessing files stored in a shared Google Drive folder.

## Overview

**The Stacks** is a lightweight library website designed to make a shared collection of documents and other files easy to browse. Files are displayed directly from Google Drive with options to view or download them.

The frontend uses simple static HTML, CSS and JavaScript, with Cloudflare Pages Functions handling the Google Drive API connection.

## Features

- 📚 Browse all files in the library
- 🔎 Automatic file type detection
- 📦 File size display
- 📅 Last modified date
- 👁️ View files in the browser
- ⬇️ Download files
- 🔄 Live file listing from Google Drive
- 🌙 Modern dark interface
- 📱 Responsive design

## Tech Stack

- **HTML** — static frontend
- **CSS** — custom styling
- **JavaScript** — client-side functionality
- **Cloudflare Pages Functions** — API layer
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

The library page requests `/api/books`. The Cloudflare Pages Function connects to Google Drive and retrieves the files in the configured library folder.

The frontend then displays the returned file information in the library interface.

## Deployment

The project is designed to run as a static website with Cloudflare Pages Functions providing the Google Drive API connection.

## License

This project is **view-only**. See the [LICENSE](LICENSE) file for the full terms.
