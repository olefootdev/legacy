/**
 * Sistema de busca inteligente na knowledge base — sem APIs externas.
 * Usa TF-IDF, keyword matching e ranking por relevância.
 */
interface KnowledgeEntry {
    path: string;
    content: string;
    category: 'docs' | 'code' | 'config';
}
interface SearchResult {
    entry: KnowledgeEntry;
    score: number;
    matchedKeywords: string[];
    relevantSnippets: string[];
}
/**
 * Busca inteligente na knowledge base.
 */
export declare function searchKnowledge(query: string, knowledgeBase: KnowledgeEntry[], limit?: number): SearchResult[];
/**
 * Gera resposta estruturada baseada nos resultados da busca.
 * Linguagem popular e amigável.
 */
export declare function generateAnswer(query: string, searchResults: SearchResult[]): {
    answer: string;
    sources: string[];
    confidence: 'high' | 'medium' | 'low';
};
/**
 * Perguntas frequentes pré-indexadas para respostas rápidas.
 * Linguagem popular, intuitiva e amigável.
 */
export declare const FAQ_ANSWERS: Record<string, {
    answer: string;
    sources: string[];
}>;
/**
 * Tenta encontrar resposta em FAQ antes de buscar na knowledge base.
 */
export declare function findFAQAnswer(query: string): {
    answer: string;
    sources: string[];
} | null;
export {};
