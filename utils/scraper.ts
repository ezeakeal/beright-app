import { NodeHtmlMarkdown } from 'node-html-markdown';

// Web scraper to fetch and convert HTML to readable text
export const fetchPageContent = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BrightApp/1.0)',
            },
        });

        const html = await response.text();

        // Convert HTML to Markdown
        const markdown = NodeHtmlMarkdown.translate(html);

        // Partition by headings
        const sections: string[] = [];
        const lines = markdown.split('\n');
        let currentSection: string[] = [];

        const flushSection = () => {
            if (currentSection.length > 0) {
                sections.push(currentSection.join('\n'));
                currentSection = [];
            }
        };

        for (const line of lines) {
            // Check for Markdown headings (H1-H6) at the start of the line
            if (line.match(/^#{1,6}\s/)) {
                flushSection();
                currentSection.push(line);
            } else {
                currentSection.push(line);
            }
        }
        flushSection();

        // Analyze sections
        const sectionData = sections.map((content, index) => ({
            content,
            length: content.length,
            index
        }));

        // Sort by length descending to prioritize largest content blocks
        sectionData.sort((a, b) => b.length - a.length);

        let totalLength = 0;
        const limit = 10000;
        const selectedSections: typeof sectionData = [];

        for (const section of sectionData) {
            if (totalLength + section.length <= limit) {
                selectedSections.push(section);
                totalLength += section.length;
            } else if (selectedSections.length === 0) {
                // If the single largest section is bigger than the limit, take a truncated version
                const truncated = section.content.substring(0, limit);
                selectedSections.push({
                    ...section,
                    content: truncated,
                    length: truncated.length
                });
                totalLength += truncated.length;
                break;
            }
        }

        // Sort back by original index to preserve document flow
        selectedSections.sort((a, b) => a.index - b.index);

        return selectedSections.map(s => s.content).join('\n\n');

    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
        return '';
    }
};
