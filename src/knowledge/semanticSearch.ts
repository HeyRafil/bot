import localDb from '../database/localDb.js';
import logger from '../utils/logger.js';

// Common Indonesian stopwords to filter out for better matching precision
const INDONESIAN_STOPWORDS = new Set([
  'yang', 'di', 'dan', 'dari', 'untuk', 'dalam', 'dengan', 'ada', 'adalah', 
  'itu', 'ini', 'ke', 'akan', 'bisa', 'dapat', 'oleh', 'pada', 'juga', 'atau',
  'saya', 'kami', 'kita', 'mereka', 'dia', 'kamu', 'anda', 'hanya', 'saja'
]);

// Tokenize text: lowercase, remove non-alphanumeric, split, and filter stopwords
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !INDONESIAN_STOPWORDS.has(word));
}

export interface SearchDocument {
  id: string;
  text: string;
  title: string;
  content: string;
  source: string;
  category: string;
}

export interface SearchResult {
  score: number;
  title: string;
  content: string;
  source: string;
  category: string;
}

class TFIDFSearchIndex {
  private documents: SearchDocument[] = []; // array of SearchDocument
  private idf: Record<string, number> = {};       // term -> idf
  private tfIdfVectors: Array<{ docId: string; vector: Record<string, number> }> = [];
  public isBuilt: boolean = false;

  /**
   * Rebuilds the search index from local database collections
   */
  async buildIndex() {
    logger.info("Building local TF-IDF semantic search index...");
    try {
      const knowledge = await localDb.getCollection('knowledge');
      const faqs = await localDb.getCollection('faq');

      const rawDocs: SearchDocument[] = [];

      // Add general knowledge
      knowledge.forEach((item: any, index: number) => {
        rawDocs.push({
          id: `knowledge_${index}`,
          text: `${item.title} ${item.content}`,
          title: item.title,
          content: item.content,
          source: item.source,
          category: item.category
        });
      });

      // Add FAQs (combine Q and A)
      faqs.forEach((item: any, index: number) => {
        rawDocs.push({
          id: `faq_${index}`,
          text: `${item.question} ${item.answer}`,
          title: item.question,
          content: item.answer,
          source: item.source,
          category: 'faq'
        });
      });

      this.documents = rawDocs;
      const numDocs = this.documents.length;

      // 1. Calculate TF for each document & document frequency (DF) for terms
      const docTfs: Array<{ docId: string; tf: Record<string, number> }> = [];
      const df: Record<string, number> = {};

      this.documents.forEach((doc) => {
        const tokens = tokenize(doc.text);
        const tf: Record<string, number> = {};
        const uniqueTokens = new Set(tokens);

        tokens.forEach(token => {
          tf[token] = (tf[token] || 0) + 1;
        });

        // Normalize TF by document length
        const totalTokens = tokens.length || 1;
        for (const term in tf) {
          tf[term] = tf[term] / totalTokens;
        }

        uniqueTokens.forEach(token => {
          df[token] = (df[token] || 0) + 1;
        });

        docTfs.push({ docId: doc.id, tf });
      });

      // 2. Calculate IDF for each term
      this.idf = {};
      for (const term in df) {
        this.idf[term] = Math.log(1 + (numDocs / df[term]));
      }

      // 3. Compute TF-IDF vectors for documents
      this.tfIdfVectors = docTfs.map(({ docId, tf }) => {
        const vector: Record<string, number> = {};
        for (const term in tf) {
          vector[term] = tf[term] * (this.idf[term] || 0);
        }
        return { docId, vector };
      });

      this.isBuilt = true;
      logger.info(`TF-IDF Search Index built successfully with ${numDocs} documents.`);
    } catch (error) {
      logger.error("Failed to build TF-IDF search index", error);
    }
  }

  /**
   * Performs semantic query matching using TF-IDF cosine similarity 
   * combined with exact phrase/keyword boosting.
   */
  async search(query: string, limit: number = 3): Promise<SearchResult[]> {
    if (!this.isBuilt) {
      await this.buildIndex();
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Calculate TF for query
    const queryTf: Record<string, number> = {};
    queryTokens.forEach(token => {
      queryTf[token] = (queryTf[token] || 0) + 1;
    });
    const queryLen = queryTokens.length;
    for (const term in queryTf) {
      queryTf[term] = queryTf[term] / queryLen;
    }

    // Calculate TF-IDF vector for query
    const queryVector: Record<string, number> = {};
    queryTokens.forEach(term => {
      queryVector[term] = queryTf[term] * (this.idf[term] || 0);
    });

    const results: SearchResult[] = [];

    // Compute Cosine Similarity between query vector and doc vectors
    this.tfIdfVectors.forEach(({ docId, vector }) => {
      let dotProduct = 0;
      let queryNorm = 0;
      let docNorm = 0;

      // Calculate magnitudes and dot product
      for (const term in queryVector) {
        queryNorm += queryVector[term] * queryVector[term];
        if (vector[term]) {
          dotProduct += queryVector[term] * vector[term];
        }
      }

      for (const term in vector) {
        docNorm += vector[term] * vector[term];
      }

      queryNorm = Math.sqrt(queryNorm);
      docNorm = Math.sqrt(docNorm);

      let similarity = 0;
      if (queryNorm > 0 && docNorm > 0) {
        similarity = dotProduct / (queryNorm * docNorm);
      }

      // Keyword & Phrase Boosting
      const doc = this.documents.find(d => d.id === docId);
      if (doc) {
        const queryLower = query.toLowerCase();
        const titleLower = doc.title.toLowerCase();

        // Exact title matches get a massive boost
        if (titleLower.includes(queryLower)) {
          similarity += 0.5;
        }

        // Specific high-value UT terms (UOBM, THE, Tuton, Tuweb, MyUT, UOLP, etc.)
        const utKeywords = ['uobm', 'uolp', 'uaop', 'utm', 'the', 'tuton', 'tuweb', 'myut', 'registrasi', 'lip', 'tbo', 'karunika', 'buku', 'modul'];
        utKeywords.forEach(keyword => {
          if (queryLower.includes(keyword)) {
            if (titleLower.includes(keyword)) {
              similarity += 0.3; // Boost if matching keyword in title
            } else if (doc.content.toLowerCase().includes(keyword)) {
              similarity += 0.1; // Boost if matching keyword in body
            }
          }
        });

        // Add to candidates if similarity > 0
        if (similarity > 0.05) {
          results.push({
            score: similarity,
            title: doc.title,
            content: doc.content,
            source: doc.source,
            category: doc.category
          });
        }
      }
    });

    // Sort by score descending and return top-k
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

// Export single index instance
export const semanticSearchIndex = new TFIDFSearchIndex();
export default semanticSearchIndex;
