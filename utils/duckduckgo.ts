// Simple DuckDuckGo HTML scraper for search results
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export const searchDuckDuckGo = async (query: string, maxResults: number = 5): Promise<SearchResult[]> => {
  try {
    console.log('Searching DuckDuckGo for:', query);
    const encodedQuery = encodeURIComponent(query);
    const url = `https://duckduckgo.com/html/?q=${encodedQuery}`;

    console.log('Fetching URL:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrightApp/1.0)',
      },
    });

    console.log('Response status:', response.status);
    if (!response.ok) {
      console.error('HTTP error:', response.status, response.statusText);
      return [];
    }

    const html = await response.text();
    console.log('HTML length:', html.length);
    console.log('HTML preview:', html.substring(0, 500));

    // Parse HTML to extract search results
    // Looking for elements with class "result__a" for titles/links
    // and "result__snippet" for snippets
    const results: SearchResult[] = [];

    // Simple regex-based parsing (not ideal but works for basic cases)
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/g;

    let match;
    let count = 0;

    while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
      let url = match[1];
      const title = match[2].trim();

      // Extract snippet (next occurrence)
      const snippetMatch = snippetRegex.exec(html);
      const snippet = snippetMatch ? snippetMatch[1].trim() : '';

      // DuckDuckGo wraps URLs in redirects like: //duckduckgo.com/l/?uddg=ACTUAL_URL
      // Extract the actual URL from the uddg parameter
      if (url.includes('duckduckgo.com/l/?uddg=')) {
        try {
          const uddgMatch = url.match(/uddg=([^&]*)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
        } catch (e) {
          console.warn('Failed to decode URL:', url);
        }
      }

      console.log('Found result:', { title, url, snippet });

      // Only skip if it's still a DuckDuckGo URL after extraction
      if (!url.includes('duckduckgo.com')) {
        results.push({ title, url, snippet });
        count++;
      }
    }

    console.log('Total results found:', results.length);
    return results;
  } catch (error) {
    console.error('DuckDuckGo search failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return [];
  }
};
