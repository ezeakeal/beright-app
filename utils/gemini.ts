import { GoogleGenerativeAI } from "@google/generative-ai";
import Constants from "expo-constants";
import { searchDuckDuckGo, SearchResult } from "./duckduckgo";
import { fetchPageContent } from "./scraper";

// TODO: Replace with your actual Gemini API key
const API_KEY = (Constants.expoConfig?.extra as any)?.GEMINI_API_KEY as string;

const genAI = new GoogleGenerativeAI(API_KEY);

export interface AnalysisResult {
    topic: string;
    perspectiveALabel: string;
    perspectiveBLabel: string;
    perspectiveABullets: string[];
    perspectiveBBullets: string[];
    summaryBullets: string[];
    narration: string;
    summaryLinks: { title: string; url: string }[];
    perspectiveALinks: { title: string; url: string }[];
    perspectiveBLinks: { title: string; url: string }[];
}

export interface StageResult {
    stageName: string;
    summaryBullets: string[];
    narration: string;
    oneLineSummary: string;
}

export interface ProgressCallback {
    (stage: string, progress: number, stageResult?: StageResult): void;
}

export const FRUITS = [
    { name: "Apple", emoji: "🍎" },
    { name: "Banana", emoji: "🍌" },
    { name: "Cherry", emoji: "🍒" },
    { name: "Grape", emoji: "🍇" },
    { name: "Lemon", emoji: "🍋" },
    { name: "Mango", emoji: "🥭" },
    { name: "Orange", emoji: "🍊" },
    { name: "Peach", emoji: "🍑" },
    { name: "Pear", emoji: "🍐" },
    { name: "Strawberry", emoji: "🍓" },
];

export const getRandomFruitPair = () => {
    const shuffled = [...FRUITS].sort(() => 0.5 - Math.random());
    return [shuffled[0], shuffled[1]];
};

const callGemini = async (prompt: string): Promise<any> => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
};

export const analyzeConflictStaged = async (
    topic: string,
    opinionA: string,
    opinionB: string,
    fruitA: { name: string; emoji: string },
    fruitB: { name: string; emoji: string },
    onProgress: ProgressCallback,
    previousAnalysis?: AnalysisResult
): Promise<AnalysisResult> => {
    try {
        // Stage 1: Initial Analysis
        onProgress("Initial Analysis", 1 / 4);

        const previousContext = previousAnalysis
            ? `\n\nPREVIOUS ANALYSIS CONTEXT (maintain continuity with this):\nPrevious Summary: ${previousAnalysis.summaryBullets.join('; ')}\nPrevious P1 Insights: ${previousAnalysis.perspectiveABullets.join('; ')}\nPrevious P2 Insights: ${previousAnalysis.perspectiveBBullets.join('; ')}\nPrevious Narration: ${previousAnalysis.narration}\n`
            : '';

        const initialPrompt = `
      Topic: "${topic}"
      
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      ${previousContext}
      Return JSON with:
      - summaryBullets: 3 short bullets (max 10 words each) about common ground on this topic
      - perspectiveABullets: 3 encouraging bullets - why we'd AGREE with P1's view and what's valuable about it
      - perspectiveBBullets: 3 encouraging bullets - why we'd AGREE with P2's view and what's valuable about it
      - narration: 2-3 sentences. Encouraging, optimistic tone. Emphasize what both perspectives share.
      - oneLineSummary: One sentence (max 12 words) about shared understanding
      
      Return ONLY valid JSON, no markdown.
    `;

        const initial = await callGemini(initialPrompt);
        onProgress("Initial Analysis", 1 / 4, {
            stageName: "Initial Understanding",
            summaryBullets: initial.summaryBullets,
            narration: initial.narration,
            oneLineSummary: initial.oneLineSummary,
        });

        // Stage 2: Generate Conflicting Search Queries
        onProgress("Generating conflicting search queries", 2 / 4);
        const queryPrompt = `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Generate search queries to find evidence supporting each perspective.
      
      Return JSON with:
      - queryA: Search query for P1's perspective (5-8 words)
      - queryB: Search query for P2's perspective (5-8 words)
      
      Return ONLY valid JSON.
    `;

        const queries = await callGemini(queryPrompt);

        // Stage 3: Search and analyze conflicting evidence
        onProgress("Searching for conflicting perspectives", 2.5 / 4);
        const [resultsA, resultsB] = await Promise.all([
            searchDuckDuckGo(queries.queryA, 3),
            searchDuckDuckGo(queries.queryB, 3),
        ]);

        console.log('Search results A:', resultsA);
        console.log('Search results B:', resultsB);

        // Fetch content from top results
        const contentA = await Promise.all(
            resultsA.slice(0, 2).map(r => fetchPageContent(r.url))
        );
        const contentB = await Promise.all(
            resultsB.slice(0, 2).map(r => fetchPageContent(r.url))
        );

        const conflictPrompt = `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Research findings for each perspective:
      P1 search: "${queries.queryA}"
      Evidence: ${contentA.join(' ')}
      
      P2 search: "${queries.queryB}"
      Evidence: ${contentB.join(' ')}
      
      Bearing in mind that BOTH perspectives have validity:
      
      Return JSON with:
      - summaryBullets: 3 bullets on why each perspective might initially disagree with the other (while acknowledging both are valid)
      - narration: 2-3 sentences on the tension between perspectives, framed constructively
      - oneLineSummary: One sentence (max 12 words) about the disagreement
      
      Return ONLY valid JSON.
    `;

        const conflict = await callGemini(conflictPrompt);
        onProgress("Conflicting Evidence", 3 / 4, {
            stageName: "Conflicting Perspectives",
            summaryBullets: conflict.summaryBullets,
            narration: conflict.narration,
            oneLineSummary: conflict.oneLineSummary,
        });

        // Stage 4: Generate Supporting Search Queries
        onProgress("Searching for common ground", 3.5 / 4);
        const supportQueryPrompt = `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Generate a search query to find nuanced perspectives or synthesis on "${topic}".
      
      Return JSON with:
      - query: Search query (5-8 words)
      
      Return ONLY valid JSON.
    `;

        const supportQuery = await callGemini(supportQueryPrompt);
        const supportResults = await searchDuckDuckGo(supportQuery.query, 3);
        console.log('Support search results:', supportResults);
        const supportContent = await Promise.all(
            supportResults.slice(0, 2).map(r => fetchPageContent(r.url))
        );

        const supportPrompt = `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Research on nuanced perspectives: "${supportQuery.query}"
      Evidence: ${supportContent.join(' ')}
      
      Return JSON with:
      - summaryBullets: 3 bullets on how different views on "${topic}" can coexist
      - narration: 2-3 sentences on the fuller picture of this topic
      - oneLineSummary: One sentence (max 12 words) about the synthesis
      
      Return ONLY valid JSON.
    `;

        const support = await callGemini(supportPrompt);
        onProgress("Supporting Evidence", 3.75 / 4, {
            stageName: "Finding Common Ground",
            summaryBullets: support.summaryBullets,
            narration: support.narration,
            oneLineSummary: support.oneLineSummary,
        });

        // Stage 5: Final Synthesis
        onProgress("Final synthesis", 4 / 4);
        const finalPrompt = `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Research journey:
      - Initial agreement: ${initial.narration}
      - Points of tension: ${conflict.narration}
      - Synthesis: ${support.narration}
      
      You're Andrew Callaghan - impartial, friendly, punchy with facts. Now that both perspectives are INFORMED:
      
      Return JSON with:
      - summaryBullets: 3 CONCISE bullets showing how both can agree after being informed
      - perspectiveABullets: 3 short, punchy bullets for P1 - valuable insights to know. Casual, fact-driven. NO greetings or addresses.
      - perspectiveBBullets: 3 short, punchy bullets for P2 - valuable insights to know. Casual, fact-driven. NO greetings or addresses.
      - narration: 2-3 sentences. Friendly, impartial. Show how understanding the full picture creates agreement.
      
      Return ONLY valid JSON.
    `;

        const final = await callGemini(finalPrompt);

        // Collect relevant links
        const summaryLinks = supportResults.slice(0, 2).map(r => ({ title: r.title, url: r.url }));
        const perspectiveALinks = resultsA.slice(0, 2).map(r => ({ title: r.title, url: r.url }));
        const perspectiveBLinks = resultsB.slice(0, 2).map(r => ({ title: r.title, url: r.url }));

        return {
            topic,
            perspectiveALabel: `${fruitA.name} ${fruitA.emoji}`,
            perspectiveBLabel: `${fruitB.name} ${fruitB.emoji}`,
            summaryBullets: final.summaryBullets,
            perspectiveABullets: final.perspectiveABullets,
            perspectiveBBullets: final.perspectiveBBullets,
            narration: final.narration,
            summaryLinks,
            perspectiveALinks,
            perspectiveBLinks,
        };
    } catch (error) {
        console.error("Staged analysis failed:", error);
        throw error;
    }
};
