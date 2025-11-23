// Web scraper to fetch and convert HTML to readable text
export const fetchPageContent = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BrightApp/1.0)',
            },
        });

        const html = await response.text();

        // Simple HTML to text conversion
        // Remove script and style tags
        let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // Remove HTML tags
        text = text.replace(/<[^>]+>/g, ' ');

        // Decode HTML entities
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();

        // Truncate to reasonable length (first 2000 characters)
        return text.substring(0, 2000);
    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
        return '';
    }
};
