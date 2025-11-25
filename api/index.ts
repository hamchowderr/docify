import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { MarkdownRequest, GoogleDocResponse, ErrorResponse } from '../src/types/index.js';
import { convertMarkdownToGoogleDoc } from '../src/services/googleDocs.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle GET requests - show API status page
  if (req.method === 'GET') {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Docify API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    .status { color: #22c55e; font-weight: bold; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Docify API</h1>
  <p>Status: <span class="status">Running</span></p>
  <p>Convert Markdown to Google Docs via REST API.</p>
  <h2>Usage</h2>
  <pre>POST /api
Content-Type: application/json
Authorization: Bearer YOUR_GOOGLE_OAUTH_TOKEN

{
  "output": "# Your Markdown",
  "fileName": "Document Name"
}</pre>
</body>
</html>`;
    return res.status(200).setHeader('Content-Type', 'text/html').send(html);
  }

  // Only allow POST requests for the API
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' } as ErrorResponse);
  }

  try {
    console.log('Received request:', {
      body: req.body,
      headers: {
        ...req.headers,
        authorization: req.headers.authorization ? `${req.headers.authorization.substring(0, 20)}...` : undefined
      }
    });

    // Handle array of requests
    const requests: MarkdownRequest[] = Array.isArray(req.body) ? req.body : [req.body];
    console.log(`Processing ${requests.length} request(s)`);

    const results = await Promise.all(requests.map(async (request, index) => {
      // Extract request data
      const markdownContent = request.output;
      const authHeader = req.headers.authorization as string | undefined;
      const fileName = request.fileName || 'Converted from Markdown';

      console.log(`Request ${index + 1} validation:`, {
        hasMarkdown: !!markdownContent,
        contentLength: markdownContent?.length,
        hasAuthHeader: !!authHeader,
        fileName
      });

      // Validate markdown content
      if (!markdownContent) {
        console.error(`Request ${index + 1}: Missing markdown content`);
        return {
          error: 'Missing required field: output',
          status: 400,
          request: {
            ...request,
            output: undefined
          }
        } as ErrorResponse;
      }

      // Validate authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error(`Request ${index + 1}: Invalid authorization`);
        return {
          error: 'Missing or invalid authorization header',
          status: 401
        } as ErrorResponse;
      }

      const accessToken = authHeader.split(' ')[1];

      try {
        console.log(`Request ${index + 1}: Starting conversion for "${fileName}"`);
        const result = await convertMarkdownToGoogleDoc(markdownContent, accessToken, fileName);
        console.log(`Request ${index + 1}: Conversion successful:`, result);

        return {
          ...result,
          webhookUrl: request.webhookUrl,
          executionMode: request.executionMode
        } as GoogleDocResponse;
      } catch (error: any) {
        console.error(`Request ${index + 1}: Conversion failed:`, {
          error: error.message,
          status: error.status || error.code,
          details: error.errors || error.stack
        });

        return {
          error: 'Failed to convert markdown to Google Doc',
          details: error.message,
          status: error.status || 500
        } as ErrorResponse;
      }
    }));

    // Send response
    if (results.length === 1) {
      const result = results[0];
      console.log('Sending single response:', {
        ...result,
        documentContent: undefined
      });
      return res.status(result.status).json(result);
    }

    console.log('Sending multiple responses:', results.length);
    return res.json(results);

  } catch (error: any) {
    console.error('Fatal error processing requests:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Failed to process requests',
      details: error.message
    } as ErrorResponse);
  }
}
