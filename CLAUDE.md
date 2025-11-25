# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A serverless function that converts Markdown content to Google Docs format, designed for n8n/Make/Zapier workflows. It accepts markdown input via HTTP POST and creates a formatted Google Doc using the caller's OAuth token. Can be deployed to Firebase or Vercel.

## Commands

```bash
# Install dependencies
bun install

# Build (outputs to ./lib for Firebase)
bun run build

# Development with watch mode
bun run dev

# --- Vercel Deployment ---
bun run vercel-dev      # Local development
bun run vercel-deploy   # Deploy to production

# --- Firebase Deployment ---
bun run serve           # Local development with Firebase emulator
bun run deploy          # Deploy to Firebase
bun run logs            # View Firebase logs
```

## Architecture

### Request Flow
1. `src/index.ts` - Express app handles POST requests, extracts OAuth token from Authorization header
2. `src/services/googleDocs.ts` - Orchestrates conversion: strips markdown wrappers, converts to DOCX, uploads to Google Drive
3. `src/services/docxConverter.ts` - Parses markdown with `marked`, generates DOCX using `docx` library

### Key Design Decisions
- **Markdown → DOCX → Google Docs**: The service first converts markdown to DOCX format, then uploads to Google Drive with automatic conversion to Google Docs format (via mimeType setting)
- **Uses caller's OAuth token**: No service account needed; the n8n Google OAuth token is passed through
- **Supports batch requests**: POST body can be a single object or an array of requests

### File Structure
- `src/index.ts` - Firebase function entry point, Express routes
- `src/services/docxConverter.ts` - Markdown parsing and DOCX generation (handles headings, lists, tables, code blocks, blockquotes)
- `src/services/googleDocs.ts` - Google Drive API integration
- `src/types/index.ts` - TypeScript interfaces
- `api/index.ts` - Vercel serverless function entry point

### API Contract
POST `/` with JSON body:
```json
{
  "output": "# Markdown content here",
  "fileName": "Document Title"
}
```
Requires `Authorization: Bearer <google_oauth_token>` header.

### Deployment Configurations

**Vercel:**
- Memory: 1024MB
- Timeout: 60 seconds
- Entry point: `api/index.ts`

**Firebase:**
- Runtime: Node.js 22
- Region: us-central1
- Memory: 1GiB
- Timeout: 300 seconds
- Source directory: `lib/` (built output)
