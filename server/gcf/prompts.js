function buildInitialPrompt({ topic, opinionA, opinionB, previousAnalysis }) {
  const previousContext = previousAnalysis
    ? `\n\nPREVIOUS ANALYSIS CONTEXT (maintain continuity with this):\nPrevious Summary: ${previousAnalysis.summaryBullets.join('; ')}\nPrevious P1 Insights: ${previousAnalysis.perspectiveABullets.join('; ')}\nPrevious P2 Insights: ${previousAnalysis.perspectiveBBullets.join('; ')}\nPrevious Narration: ${previousAnalysis.narration}\n`
    : '';
  return `
      Topic: "${topic}"
      
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      ${previousContext}
      Return JSON with:
      - summaryBullets: 3 short bullets (max 10 words each) about common ground on this topic
      - perspectiveABullets: 3 encouraging bullets - why we'd AGREE with P1's view and what's valuable about it
      - perspectiveBBullets: 3 encouraging bullets - why we'd AGREE with P2's view and what's valuable about it
      - narration: 2-3 sentences. An engaging response to the two perspectives, optimistic tone, and respectful of the two perspectives.
      - oneLineSummary: One sentence (max 12 words) about shared understanding
      
      Return ONLY valid JSON, no markdown.
    `;
}

function buildQueryPrompt({ topic, opinionA, opinionB }) {
  return `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Generate search queries to find evidence supporting each perspective.
      
      Return JSON with:
      - queryA: Search query for P1's perspective (5-8 words)
      - queryB: Search query for P2's perspective (5-8 words)
      
      Return ONLY valid JSON.
    `;
}

function buildConflictPrompt({ topic, opinionA, opinionB, queryA, queryB, evidenceA, evidenceB }) {
  return `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Research findings for each perspective:
      P1 search: "${queryA}"
      Evidence: ${evidenceA}
      
      P2 search: "${queryB}"
      Evidence: ${evidenceB}
      
      Bearing in mind that BOTH perspectives have validity:
      
      Return JSON with:
      - summaryBullets: 3 bullets on why each perspective might initially disagree with the other (while acknowledging both are valid)
      - narration: 1-2 sentence narration about the tension between perspectives - first person tone that is interested in the exploration.
      - oneLineSummary: One sentence (max 12 words) about the disagreement
      
      Return ONLY valid JSON.
    `;
}

function buildSupportQueryPrompt({ topic, opinionA, opinionB }) {
  return `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Generate a search query to find nuanced perspectives or synthesis on "${topic}".
      
      Return JSON with:
      - query: Search query (5-8 words)
      
      Return ONLY valid JSON.
    `;
}

function buildSupportPrompt({ topic, opinionA, opinionB, supportQuery, evidence }) {
  return `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Research on nuanced perspectives: "${supportQuery}"
      Evidence: ${evidence}
      
      Return JSON with:
      - summaryBullets: 3 bullets on how different views on "${topic}" can coexist
      - narration: 1-2 sentence narration about the complimentary nature of the two perspectives - first person tone that is interested in the exploration.
      - oneLineSummary: One sentence (max 12 words) about the synthesis
      
      Return ONLY valid JSON.
    `;
}

function buildFinalPrompt({ topic, opinionA, opinionB, initialNarration, conflictNarration, supportNarration }) {
  return `
      Topic: "${topic}"
      Perspective 1 (P1): "${opinionA}"
      Perspective 2 (P2): "${opinionB}"
      
      Research journey:
      - Initial agreement: ${initialNarration}
      - Points of tension: ${conflictNarration}
      - Synthesis: ${supportNarration}
      
      You're a top quality on-the-ground reporter - impartial, friendly, punchy with facts. Now that both perspectives are INFORMED:
      
      Return JSON with:
      - summaryBullets: 3 CONCISE bullets showing how both can grow their perspectives and find common ground after being informed
      - perspectiveABullets: 3 short, punchy bullets for P1 - valuable insights to know. Casual, fact-driven. NO greetings or addresses.
      - perspectiveBBullets: 3 short, punchy bullets for P2 - valuable insights to know. Casual, fact-driven. NO greetings or addresses.
      - narration: 2-3 sentences. Friendly, impartial. Show how understanding the full picture helps both perspectives see a richer point of view.
      
      Return ONLY valid JSON.
    `;
}

function buildPromptFromAction(action, payload) {
  switch ((action || '').toLowerCase()) {
    case 'initial':
      return buildInitialPrompt(payload);
    case 'queries':
      return buildQueryPrompt(payload);
    case 'conflict':
      return buildConflictPrompt(payload);
    case 'supportquery':
      return buildSupportQueryPrompt(payload);
    case 'support':
      return buildSupportPrompt(payload);
    case 'final':
      return buildFinalPrompt(payload);
    default:
      throw new Error(`Unknown action "${action}"`);
  }
}

module.exports = {
  buildPromptFromAction,
};


