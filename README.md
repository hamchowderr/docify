# Docify - Markdown to Google Docs Converter

> This project is an upgraded fork of [aemal/n8n-md-to-docs](https://github.com/aemal/n8n-md-to-docs) with additional features.

A Vercel serverless function that converts Markdown content to Google Docs format.

## What's New

Improvements over the original:
- **Image embedding** - Auto-embedded images with type detection (PNG, JPG, GIF, BMP)
- **Strikethrough** - `~~strikethrough~~` support
- **Task checkboxes** - `- [ ] todo` and `- [x] done`
- **Tables** - Full markdown table support
- **API status page** - Landing page showing API is running
- **Vercel deployment** - Easy serverless deployment

## Features

- Convert Markdown to properly formatted Google Docs
- **Text formatting**: Bold, italic, strikethrough, links
- **Lists**: Ordered lists, unordered lists, task checkboxes
- **Images**: Auto-embedded with type detection (PNG, JPG, GIF, BMP)
- **Tables**: Full table support
- **Headings**: H1-H6 with proper sizing
- OAuth2 authentication with Google Docs API
- Works with n8n, Make, Zapier, or any HTTP client

## Deploy to Vercel

```bash
# Install dependencies
pnpm install

# Deploy to Vercel
pnpm run deploy
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Usage

Send a POST request to your deployed endpoint:

```bash
curl -X POST https://your-deployment.vercel.app/api \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GOOGLE_OAUTH_TOKEN" \
  -d '{
    "output": "# Hello World\n\nThis is **bold** and this is *italic*.",
    "fileName": "My Document"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `output` | string | Yes | Markdown content to convert |
| `fileName` | string | No | Name for the Google Doc (default: "Converted from Markdown") |

### Response

```json
{
  "documentId": "1abc123...",
  "documentUrl": "https://docs.google.com/document/d/1abc123.../edit",
  "status": 200
}
```

## Supported Markdown

- `# Heading 1` through `###### Heading 6`
- `**bold**` and `*italic*`
- `~~strikethrough~~`
- `[link text](url)`
- `![image alt](image-url)` - Images are embedded directly
- Ordered lists (`1. item`)
- Unordered lists (`- item`)
- Task lists (`- [ ] todo` and `- [x] done`)
- Tables
- Code blocks

## License

MIT License - see [LICENSE](LICENSE) file.
