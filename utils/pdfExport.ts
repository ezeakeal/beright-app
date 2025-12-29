import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { AnalysisResult } from './gemini';

export interface PDFExportData {
  topic: string;
  result: AnalysisResult;
  fruitAName: string;
  fruitBName: string;
  fruitAEmoji: string;
  fruitBEmoji: string;
}

export async function generateAndSharePDF(data: PDFExportData): Promise<void> {
  const { topic, result, fruitAName, fruitBName, fruitAEmoji, fruitBEmoji } = data;
  
  // Generate HTML content for the PDF
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B'right - ${topic}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 30px;
      background: linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%);
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
    }
    .logo {
      font-size: 36px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 14px;
      color: #64748b;
      font-style: italic;
    }
    .topic {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
      border-radius: 12px;
      border-left: 4px solid #3b82f6;
    }
    .topic-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .topic-title {
      font-size: 28px;
      font-weight: 700;
      color: #1e40af;
    }
    .summary-section {
      margin-bottom: 35px;
      padding: 25px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 24px;
      background: #3b82f6;
      margin-right: 12px;
      border-radius: 2px;
    }
    .bullet-list {
      margin: 15px 0;
      padding-left: 10px;
    }
    .bullet-item {
      margin-bottom: 12px;
      padding-left: 20px;
      position: relative;
      font-size: 15px;
      line-height: 1.7;
      color: #374151;
    }
    .bullet-item::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #3b82f6;
      font-weight: bold;
      font-size: 18px;
    }
    .narration {
      font-style: italic;
      color: #4b5563;
      background: white;
      padding: 20px;
      border-radius: 8px;
      border-left: 3px solid #3b82f6;
      margin-top: 15px;
      font-size: 14px;
      line-height: 1.8;
    }
    .perspectives {
      display: flex;
      gap: 20px;
      margin-bottom: 35px;
    }
    .perspective {
      flex: 1;
      padding: 25px;
      border-radius: 12px;
      border: 2px solid;
    }
    .perspective-a {
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
      border-color: #a855f7;
    }
    .perspective-b {
      background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
      border-color: #06b6d4;
    }
    .perspective-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    .emoji {
      font-size: 32px;
      margin-right: 12px;
    }
    .perspective-title {
      font-size: 18px;
      font-weight: 700;
    }
    .perspective-a .perspective-title {
      color: #7c3aed;
    }
    .perspective-b .perspective-title {
      color: #0891b2;
    }
    .perspective .bullet-item {
      font-size: 13px;
      margin-bottom: 10px;
      color: #1f2937;
    }
    .perspective-a .bullet-item::before {
      color: #a855f7;
    }
    .perspective-b .bullet-item::before {
      color: #06b6d4;
    }
    .links-section {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    .links-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .link-item {
      margin-bottom: 6px;
      font-size: 12px;
    }
    .link-item a {
      color: #2563eb;
      text-decoration: none;
      word-break: break-all;
    }
    .footer {
      text-align: center;
      margin-top: 50px;
      padding-top: 25px;
      border-top: 2px solid #e5e7eb;
    }
    .footer-logo {
      font-size: 24px;
      font-weight: 800;
      color: #3b82f6;
      margin-bottom: 12px;
    }
    .footer-text {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .footer-link {
      font-size: 14px;
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
    }
    .footer-cta {
      margin-top: 15px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-radius: 8px;
      display: inline-block;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">B'right</div>
      <div class="tagline">Find harmony in conflict</div>
    </div>

    <div class="topic">
      <div class="topic-label">TOPIC</div>
      <div class="topic-title">${escapeHtml(topic)}</div>
    </div>

    <div class="summary-section">
      <div class="section-title">Summary</div>
      <div class="bullet-list">
        ${result.summaryBullets.map(bullet => `<div class="bullet-item">${escapeHtml(bullet)}</div>`).join('')}
      </div>
      <div class="narration">${escapeHtml(result.narration)}</div>
      ${result.summaryLinks.length > 0 ? `
        <div class="links-section">
          <div class="links-title">Related Reading</div>
          ${result.summaryLinks.map(link => `
            <div class="link-item">
              <a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="perspectives">
      <div class="perspective perspective-a">
        <div class="perspective-header">
          <div class="emoji">${fruitAEmoji}</div>
          <div class="perspective-title">${escapeHtml(result.perspectiveALabel)}</div>
        </div>
        <div class="bullet-list">
          ${result.perspectiveABullets.map(bullet => `<div class="bullet-item">${escapeHtml(bullet)}</div>`).join('')}
        </div>
        ${result.perspectiveALinks.length > 0 ? `
          <div class="links-section">
            <div class="links-title">Links</div>
            ${result.perspectiveALinks.map(link => `
              <div class="link-item">
                <a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="perspective perspective-b">
        <div class="perspective-header">
          <div class="emoji">${fruitBEmoji}</div>
          <div class="perspective-title">${escapeHtml(result.perspectiveBLabel)}</div>
        </div>
        <div class="bullet-list">
          ${result.perspectiveBBullets.map(bullet => `<div class="bullet-item">${escapeHtml(bullet)}</div>`).join('')}
        </div>
        ${result.perspectiveBLinks.length > 0 ? `
          <div class="links-section">
            <div class="links-title">Links</div>
            ${result.perspectiveBLinks.map(link => `
              <div class="link-item">
                <a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>

    <div class="footer">
      <div class="footer-logo">B'right</div>
      <div class="footer-text">Created with B'right - Find harmony in conflict</div>
      <div class="footer-text">Download the app to analyze your own conversations</div>
      <a href="https://beright.app" class="footer-cta">Download B'right App</a>
    </div>
  </div>
</body>
</html>
  `;

  try {
    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html });
    
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (isAvailable) {
      // Share the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `B'right - ${topic}`,
        UTI: 'com.adobe.pdf'
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    throw error;
  }
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

