import { searchDuckDuckGo, SearchResult } from "./duckduckgo";
import { fetchPageContent } from "./scraper";
import { ensureSignedIn } from "../firebaseClient";

// Replace with your deployed Cloud Function URL (HTTP trigger) for text generation
const GCF_TEXT_URL = "https://beright-app-1021561698058.europe-west1.run.app";

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

type ServerAction =
    | "initial"
    | "queries"
    | "conflict"
    | "supportQuery"
    | "support"
    | "final";

const postModel = async (body: Record<string, any>): Promise<any> => {
    const idToken = await ensureSignedIn();
    const res = await fetch(GCF_TEXT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
    });
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();

    if (!res.ok) {
        if (res.status === 429) {
            throw new Error("RATE_LIMIT_EXCEEDED");
        }
        // Surface full status and raw body for debugging
        throw new Error(`Gemini endpoint HTTP ${res.status} ${res.statusText}. Body: ${bodyText}`);
    }

    try {
        // Prefer JSON, but if server returns text/json, still parse explicitly
        if (contentType.includes("application/json")) {
            return JSON.parse(bodyText);
        }
        return JSON.parse(bodyText);
    } catch (err) {
        // Show the exact response that failed JSON parsing
        console.error("callGemini JSON parse failed. Response body:", bodyText);
        throw err;
    }
};

// Helper to ensure bullets are always strings, handling potential object returns from LLM
const sanitizeBullets = (bullets: any): string[] => {
    if (!Array.isArray(bullets)) return [];
    
    return bullets.map(b => {
        if (typeof b === 'string') return b;
        if (typeof b === 'object' && b !== null) {
            // Handle the specific case seen in errors: { perspective, disagreementPoints }
            if (b.perspective && b.disagreementPoints) {
                return `${b.perspective}: ${b.disagreementPoints}`;
            }
            // Fallback for other objects: try to find the first string value or stringify
            const values = Object.values(b);
            const stringVal = values.find(v => typeof v === 'string');
            if (stringVal) return stringVal as string;
            
            return JSON.stringify(b);
        }
        return String(b);
    });
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

        // Prompts are now built on the server; we only send structured actions/payloads.

        const initial = await postModel({
            action: "initial",
            payload: { topic, opinionA, opinionB, previousAnalysis }
        });
        onProgress("Initial Analysis", 1 / 4, {
            stageName: "Initial Understanding",
            summaryBullets: sanitizeBullets(initial.summaryBullets),
            narration: initial.narration,
            oneLineSummary: initial.oneLineSummary,
        });

        // Stage 2: Generate Conflicting Search Queries
        onProgress("Generating conflicting search queries", 2 / 4);
        // Server builds the query prompt.

        const queries = await postModel({
            action: "queries",
            payload: { topic, opinionA, opinionB }
        });

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

        // Server builds the conflict prompt using evidence we send.

        const conflict = await postModel({
            action: "conflict",
            payload: {
                topic,
                opinionA,
                opinionB,
                queryA: queries.queryA,
                queryB: queries.queryB,
                evidenceA: contentA.join(' '),
                evidenceB: contentB.join(' ')
            }
        });
        onProgress("Conflicting Evidence", 3 / 4, {
            stageName: "Conflicting Perspectives",
            summaryBullets: sanitizeBullets(conflict.summaryBullets),
            narration: conflict.narration,
            oneLineSummary: conflict.oneLineSummary,
        });

        // Stage 4: Generate Supporting Search Queries
        onProgress("Searching for common ground", 3.5 / 4);
        // Server builds the support search query prompt.

        const supportQuery = await postModel({
            action: "supportQuery",
            payload: { topic, opinionA, opinionB }
        });
        const supportResults = await searchDuckDuckGo(supportQuery.query, 3);
        console.log('Support search results:', supportResults);
        const supportContent = await Promise.all(
            supportResults.slice(0, 2).map(r => fetchPageContent(r.url))
        );

        // Server builds the support synthesis prompt.

        const support = await postModel({
            action: "support",
            payload: {
                topic,
                opinionA,
                opinionB,
                supportQuery: supportQuery.query,
                evidence: supportContent.join(' ')
            }
        });
        onProgress("Supporting Evidence", 3.75 / 4, {
            stageName: "Finding Common Ground",
            summaryBullets: sanitizeBullets(support.summaryBullets),
            narration: support.narration,
            oneLineSummary: support.oneLineSummary,
        });

        // Stage 5: Final Synthesis
        onProgress("Final synthesis", 4 / 4);
        // Server builds the final synthesis prompt.

        const final = await postModel({
            action: "final",
            payload: {
                topic,
                opinionA,
                opinionB,
                initialNarration: initial.narration,
                conflictNarration: conflict.narration,
                supportNarration: support.narration
            }
        });

        // Collect relevant links
        const summaryLinks = supportResults.slice(0, 2).map(r => ({ title: r.title, url: r.url }));
        const perspectiveALinks = resultsA.slice(0, 2).map(r => ({ title: r.title, url: r.url }));
        const perspectiveBLinks = resultsB.slice(0, 2).map(r => ({ title: r.title, url: r.url }));

        return {
            topic,
            perspectiveALabel: `${fruitA.name} ${fruitA.emoji}`,
            perspectiveBLabel: `${fruitB.name} ${fruitB.emoji}`,
            summaryBullets: sanitizeBullets(final.summaryBullets),
            perspectiveABullets: sanitizeBullets(final.perspectiveABullets),
            perspectiveBBullets: sanitizeBullets(final.perspectiveBBullets),
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
