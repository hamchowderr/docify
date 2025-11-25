import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, Table, TableRow, TableCell, BorderStyle, ExternalHyperlink, ImageRun } from 'docx';
import { marked } from 'marked';
import type { Tokens } from 'marked';

const headingLevelMap = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6
};

// Supported image types for DOCX
type ImageType = 'png' | 'jpg' | 'gif' | 'bmp';

// Helper function to detect image type from URL or Content-Type
function detectImageType(url: string, contentType: string): ImageType {
  const urlLower = url.toLowerCase();

  // Step 1: Check URL extension
  if (urlLower.includes('.png')) return 'png';
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'jpg';
  if (urlLower.includes('.gif')) return 'gif';
  if (urlLower.includes('.bmp')) return 'bmp';

  // Step 2: Check Content-Type header
  const ctLower = contentType.toLowerCase();
  if (ctLower.includes('image/png')) return 'png';
  if (ctLower.includes('image/jpeg') || ctLower.includes('image/jpg')) return 'jpg';
  if (ctLower.includes('image/gif')) return 'gif';
  if (ctLower.includes('image/bmp')) return 'bmp';

  // Step 3: Default to PNG
  return 'png';
}

// Helper function to fetch image from URL
async function fetchImage(url: string): Promise<{ data: Buffer; width: number; height: number; type: ImageType } | null> {
  try {
    // Skip SVG images - they require special handling in docx and often don't render well
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.svg')) {
      console.log(`Skipping SVG image (not supported for embedding): ${url}`);
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }

    // Check content type for SVG
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('svg')) {
      console.log(`Skipping SVG image (detected by content-type): ${url}`);
      return null;
    }

    // Detect the image type
    const imageType = detectImageType(url, contentType);
    console.log(`Detected image type: ${imageType} for ${url}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Default dimensions - could be improved with image-size library
    // For now, use reasonable defaults
    return {
      data: buffer,
      width: 400,
      height: 300,
      type: imageType
    };
  } catch (error) {
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
}

// Helper function to process text with formatting
function processFormattedText(text: string): (TextRun | ExternalHyperlink)[] {
  const result: (TextRun | ExternalHyperlink)[] = [];

  // Regex to match links, bold, italic, code, and strikethrough
  // Links: [text](url)
  // Bold: **text**
  // Italic: *text*
  // Code: `text`
  // Strikethrough: ~~text~~
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|~~.*?~~|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      if (beforeText) {
        result.push(new TextRun({
          text: beforeText,
          font: 'Arial',
          size: 24
        }));
      }
    }

    const part = match[0];

    // Link: [text](url)
    if (match[2] && match[3]) {
      result.push(new ExternalHyperlink({
        children: [
          new TextRun({
            text: match[2],
            style: 'Hyperlink',
            font: 'Arial',
            size: 24,
            color: '0563C1',
            underline: { type: 'single' }
          })
        ],
        link: match[3]
      }));
    }
    // Strikethrough: ~~text~~
    else if (part.startsWith('~~') && part.endsWith('~~')) {
      result.push(new TextRun({
        text: part.slice(2, -2),
        strike: true,
        font: 'Arial',
        size: 24
      }));
    }
    // Bold: **text**
    else if (part.startsWith('**') && part.endsWith('**')) {
      result.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        font: 'Arial',
        size: 24
      }));
    }
    // Italic: *text*
    else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      result.push(new TextRun({
        text: part.slice(1, -1),
        italics: true,
        font: 'Arial',
        size: 24
      }));
    }
    // Code: `text`
    else if (part.startsWith('`') && part.endsWith('`')) {
      result.push(new TextRun({
        text: part.slice(1, -1),
        font: 'Courier New',
        size: 24
      }));
    }

    lastIndex = match.index + part.length;
  }

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      result.push(new TextRun({
        text: remainingText,
        font: 'Arial',
        size: 24
      }));
    }
  }

  // If no matches found, return the whole text as a TextRun
  if (result.length === 0) {
    result.push(new TextRun({
      text: text,
      font: 'Arial',
      size: 24
    }));
  }

  return result;
}

export async function convertMarkdownToDocx(markdownContent: string): Promise<Buffer> {
  try {
    // Log sample of the markdown for debugging
    console.log('Input markdown sample:', {
      sample: markdownContent.substring(0, Math.min(200, markdownContent.length)),
      length: markdownContent.length
    });

    // Parse markdown to tokens
    const tokens = marked.lexer(markdownContent);
    console.log(`Parsed ${tokens.length} markdown tokens`);

    // Debug first few tokens to understand the structure
    if (tokens.length > 0) {
      console.log('First token types:', {
        types: tokens.slice(0, Math.min(5, tokens.length)).map(t => t.type)
      });
    }
    
    const children: Paragraph[] = [];
    let lastTokenType: string | null = null;
    let consecutiveBreaks = 0;
    
    for (const token of tokens) {
      console.log(`Processing token type: ${token.type}`);

      // Handle spacing between different content types
      if (lastTokenType && lastTokenType !== token.type) {
        if (token.type === 'space') {
          consecutiveBreaks++;
          // Only add extra space if we haven't added too many breaks already
          if (consecutiveBreaks <= 1) {
            children.push(
              new Paragraph({
                spacing: {
                  before: 80,
                  after: 80
                }
              })
            );
          }
        } else {
          consecutiveBreaks = 0;
        }
      }

      switch (token.type) {
        case 'heading': {
          consecutiveBreaks = 0;
          const headingToken = token as Tokens.Heading;
          
          children.push(
            new Paragraph({
              text: headingToken.text,
              heading: headingLevelMap[headingToken.depth as keyof typeof headingLevelMap],
              spacing: {
                before: 200,
                after: 100
              }
            })
          );
          break;
        }

        case 'paragraph': {
          consecutiveBreaks = 0;
          const paragraphToken = token as Tokens.Paragraph;

          // Check if paragraph contains only an image
          const imageMatch = paragraphToken.text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
          if (imageMatch) {
            const altText = imageMatch[1];
            const imageUrl = imageMatch[2];

            console.log(`Found image in paragraph: ${imageUrl}`);

            // Try to fetch and embed the actual image
            const imageData = await fetchImage(imageUrl);

            if (imageData) {
              // Successfully fetched - embed the image
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      type: imageData.type,
                      data: imageData.data,
                      transformation: {
                        width: imageData.width,
                        height: imageData.height
                      },
                      altText: {
                        title: altText || 'Image',
                        description: altText || 'Embedded image',
                        name: altText || 'image'
                      }
                    })
                  ],
                  spacing: {
                    before: 100,
                    after: 100
                  }
                })
              );

              // Add caption if alt text exists
              if (altText) {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: altText,
                        font: 'Arial',
                        size: 20,
                        italics: true,
                        color: '666666'
                      })
                    ],
                    spacing: {
                      before: 40,
                      after: 80
                    },
                    alignment: AlignmentType.CENTER
                  })
                );
              }
            } else {
              // Failed to fetch - fall back to clickable link
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '🖼 ',
                      font: 'Arial',
                      size: 24
                    }),
                    new ExternalHyperlink({
                      children: [
                        new TextRun({
                          text: altText || 'Image',
                          style: 'Hyperlink',
                          font: 'Arial',
                          size: 24,
                          color: '0563C1',
                          underline: { type: 'single' }
                        })
                      ],
                      link: imageUrl
                    }),
                    new TextRun({
                      text: ' (could not embed)',
                      font: 'Arial',
                      size: 20,
                      color: '999999'
                    })
                  ],
                  spacing: {
                    before: 60,
                    after: 60
                  }
                })
              );
            }
          } else {
            // Regular paragraph - process formatted text (bold, italic, code)
            const runs = processFormattedText(paragraphToken.text);

            children.push(
              new Paragraph({
                children: runs,
                spacing: {
                  before: 60,
                  after: 60,
                  line: 300,
                  lineRule: 'auto'
                }
              })
            );
          }
          break;
        }

        case 'list': {
          consecutiveBreaks = 0;
          const listToken = token as Tokens.List;

          // Helper function to process list items recursively
          const processListItems = (items: Tokens.ListItem[], ordered: boolean, level: number, startNum: number = 1) => {
            let itemNum = startNum;
            let isFirstItem = level === 0;

            for (const item of items) {
              // Build the content for this item
              const runs: (TextRun | ExternalHyperlink)[] = [];

              // Handle task checkboxes
              if (item.task) {
                const checkbox = item.checked ? '☑ ' : '☐ ';
                runs.push(new TextRun({
                  text: checkbox,
                  font: 'Arial',
                  size: 24
                }));
              }

              // Add the text content
              runs.push(...processFormattedText(item.text));

              // Create paragraph with appropriate list style
              if (ordered) {
                // Numbered list - use numbering
                children.push(
                  new Paragraph({
                    children: runs,
                    numbering: {
                      reference: 'default-numbering',
                      level: level
                    },
                    spacing: {
                      before: isFirstItem ? 80 : 40,
                      after: 40,
                      line: 300,
                      lineRule: 'auto'
                    }
                  })
                );
              } else {
                // Bullet list
                children.push(
                  new Paragraph({
                    children: runs,
                    bullet: {
                      level: level
                    },
                    spacing: {
                      before: isFirstItem ? 80 : 40,
                      after: 40,
                      line: 300,
                      lineRule: 'auto'
                    },
                    indent: {
                      left: 720 * (level + 1),
                      hanging: 360
                    }
                  })
                );
              }

              isFirstItem = false;
              itemNum++;

              // Handle nested lists
              if (item.tokens) {
                for (const nestedToken of item.tokens) {
                  if (nestedToken.type === 'list') {
                    const nestedList = nestedToken as Tokens.List;
                    processListItems(nestedList.items, nestedList.ordered, level + 1);
                  }
                }
              }
            }
          };

          processListItems(listToken.items, listToken.ordered, 0);
          break;
        }
        
        case 'blockquote': {
          consecutiveBreaks = 0;
          const blockquoteToken = token as Tokens.Blockquote;
          
          // Process each item in the blockquote
          for (const quoteToken of blockquoteToken.tokens) {
            if (quoteToken.type === 'paragraph') {
              const paraToken = quoteToken as Tokens.Paragraph;
              const runs = processFormattedText(paraToken.text);
              
              children.push(
                new Paragraph({
                  children: runs,
                  spacing: {
                    before: 60,
                    after: 60,
                    line: 300,
                    lineRule: 'auto'
                  },
                  indent: {
                    left: 720
                  },
                  border: {
                    left: {
                      color: "AAAAAA",
                      space: 15,
                      style: BorderStyle.SINGLE,
                      size: 15
                    }
                  }
                })
              );
            }
          }
          break;
        }
        
        case 'code': {
          consecutiveBreaks = 0;
          const codeToken = token as Tokens.Code;
          
          // Create a code block with monospace font using a TextRun
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: codeToken.text,
                  font: 'Courier New',
                  size: 20
                })
              ],
              spacing: {
                before: 80,
                after: 80,
                line: 300,
                lineRule: 'auto'
              },
              shading: {
                type: "clear",
                fill: "F5F5F5"
              }
            })
          );
          break;
        }
        
        case 'hr': {
          consecutiveBreaks = 0;
          // Add a horizontal rule
          children.push(
            new Paragraph({
              border: {
                bottom: {
                  color: "AAAAAA",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 1
                }
              },
              spacing: {
                before: 120,
                after: 120
              }
            })
          );
          break;
        }
        
        case 'table': {
          consecutiveBreaks = 0;
          const tableToken = token as Tokens.Table;
          
          // Create table rows
          const rows: TableRow[] = [];
          
          // Add header row
          const headerCells = tableToken.header.map((cell: { text: string }) => {
            return new TableCell({
              children: [new Paragraph({
                children: processFormattedText(cell.text),
                spacing: { before: 40, after: 40 }
              })],
              shading: {
                fill: "EEEEEE"
              }
            });
          });
          rows.push(new TableRow({ children: headerCells }));
          
          // Add data rows
          for (const row of tableToken.rows) {
            const rowCells = row.map((cell: { text: string }) => {
              return new TableCell({
                children: [new Paragraph({
                  children: processFormattedText(cell.text),
                  spacing: { before: 40, after: 40 }
                })]
              });
            });
            rows.push(new TableRow({ children: rowCells }));
          }
          
          // Add table to document
          const table = new Table({
            rows,
            width: {
              size: 100,
              type: "pct"
            }
          });
          
          children.push(new Paragraph({ children: [table] }));
          break;
        }

        case 'space':
          // Don't reset consecutiveBreaks here
          break;

        case 'image': {
          consecutiveBreaks = 0;
          const imageToken = token as Tokens.Generic & { href: string; title?: string; text: string };

          // Try to fetch and embed the actual image
          const imageData = await fetchImage(imageToken.href);

          if (imageData) {
            // Successfully fetched - embed the image
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: imageData.type,
                    data: imageData.data,
                    transformation: {
                      width: imageData.width,
                      height: imageData.height
                    },
                    altText: {
                      title: imageToken.title || imageToken.text || 'Image',
                      description: imageToken.text || 'Embedded image',
                      name: imageToken.text || 'image'
                    }
                  })
                ],
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );

            // Add caption if alt text exists
            if (imageToken.text) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: imageToken.text,
                      font: 'Arial',
                      size: 20,
                      italics: true,
                      color: '666666'
                    })
                  ],
                  spacing: {
                    before: 40,
                    after: 80
                  },
                  alignment: AlignmentType.CENTER
                })
              );
            }
          } else {
            // Failed to fetch - fall back to clickable link
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: '🖼 ',
                    font: 'Arial',
                    size: 24
                  }),
                  new ExternalHyperlink({
                    children: [
                      new TextRun({
                        text: imageToken.text || 'Image',
                        style: 'Hyperlink',
                        font: 'Arial',
                        size: 24,
                        color: '0563C1',
                        underline: { type: 'single' }
                      })
                    ],
                    link: imageToken.href
                  }),
                  new TextRun({
                    text: ' (could not embed)',
                    font: 'Arial',
                    size: 20,
                    color: '999999'
                  })
                ],
                spacing: {
                  before: 60,
                  after: 60
                }
              })
            );
          }
          break;
        }

        default:
          console.log(`Unhandled token type: ${token.type}`);
          consecutiveBreaks = 0;
          break;
      }

      lastTokenType = token.type;
    }

    // Create document with some basic styling
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 }
                  }
                }
              },
              {
                level: 1,
                format: 'lowerLetter',
                text: '%2.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: 1440, hanging: 360 }
                  }
                }
              },
              {
                level: 2,
                format: 'lowerRoman',
                text: '%3.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: 2160, hanging: 360 }
                  }
                }
              }
            ]
          }
        ]
      },
      styles: {
        default: {
          document: {
            run: {
              font: 'Arial',
              size: 24
            }
          },
          heading1: {
            run: {
              size: 32,
              bold: true,
              color: "000000",
              font: 'Arial'
            },
            paragraph: {
              spacing: {
                before: 200,
                after: 100,
                line: 300,
                lineRule: 'auto'
              }
            }
          },
          heading2: {
            run: {
              size: 28,
              bold: true,
              color: "000000",
              font: 'Arial'
            },
            paragraph: {
              spacing: {
                before: 160,
                after: 80,
                line: 300,
                lineRule: 'auto'
              }
            }
          },
          heading3: {
            run: {
              size: 24,
              bold: true,
              color: "000000",
              font: 'Arial'
            },
            paragraph: {
              spacing: {
                before: 120,
                after: 60,
                line: 300,
                lineRule: 'auto'
              }
            }
          }
        },
        paragraphStyles: [
          {
            id: "codeStyle",
            name: "Code Style",
            basedOn: "Normal",
            run: {
              font: "Courier New",
              size: 20
            },
            paragraph: {
              spacing: {
                before: 80,
                after: 80,
                line: 300,
                lineRule: 'auto'
              }
            }
          }
        ]
      },
      sections: [{
        properties: {},
        children: children
      }],
    });

    console.log(`Generated DOCX with ${children.length} paragraphs`);

    // Generate buffer
    return await Packer.toBuffer(doc);
  } catch (error) {
    console.error('Error converting markdown to docx:', error);
    throw error;
  }
} 