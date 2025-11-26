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

## Make (Integromat) Setup

Use the **HTTP > Make an OAuth 2.0 request** module:

![Make HTTP Module](.github/assets/screen1.png)

### Create OAuth Connection

Configure the connection with these settings:

![Make OAuth Connection](.github/assets/screen2.png)

| Field | Value |
|-------|-------|
| **Authorize URI** | `https://accounts.google.com/o/oauth2/v2/auth` |
| **Token URI** | `https://oauth2.googleapis.com/token` |
| **Scope** | `https://www.googleapis.com/auth/drive.file` |
| **Client ID** | Your Google OAuth Client ID |
| **Client Secret** | Your Google OAuth Client Secret |

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web application)
3. Add redirect URI: `https://www.integromat.com/oauth/cb/oauth2`

### Configure the Request

- **URL**: `https://your-deployment.vercel.app/api`
- **Method**: POST
- **Headers**: `Content-Type: application/json`
- **Body type**: Raw (JSON)
- **Body**:
```json
{
  "output": "# Your Markdown Here",
  "fileName": "Document Name"
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
