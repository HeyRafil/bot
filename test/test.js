import { seedBaselineData } from '../src/crawler/academicCrawler.js';
import { semanticSearchIndex } from '../src/knowledge/semanticSearch.js';
import { queryRAG } from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

async function runTests() {
  logger.info("========================================");
  logger.info("       STARTING BOTWAUT TEST SUITE       ");
  logger.info("========================================");

  try {
    // 1. Test database seeding
    logger.info("[TEST 1/3] Seeding baseline UT database...");
    await seedBaselineData();
    logger.info("✅ Database seeded successfully.");

    // 2. Test TF-IDF Semantic Indexing and Search
    logger.info("[TEST 2/3] Building index and testing semantic search queries...");
    await semanticSearchIndex.buildIndex();

    const testQueries = [
      "Apa itu UOBM?",
      "Kapan tuton dimulai?",
      "Cara reset password MyUT"
    ];

    for (const query of testQueries) {
      logger.info(`🔍 Searching matching documents for: "${query}"`);
      const results = await semanticSearchIndex.search(query, 2);
      
      if (results.length === 0) {
        throw new Error(`Failed to find semantic matches for: ${query}`);
      }
      
      logger.info(`✨ Top Match: "${results[0].title}" (Score: ${results[0].score.toFixed(4)})`);
    }
    logger.info("✅ Semantic search indexing matched correctly.");

    // 3. Test RAG Pipeline (Offline Fallback Mode since API Key is empty)
    logger.info("[TEST 3/3] Querying RAG pipeline in offline fallback mode...");
    const response = await queryRAG("Apa bedanya Tuton dan Tuweb?");
    logger.info(`🤖 RAG Output:\n------------------\n${response}\n------------------`);
    
    if (!response.includes("Tuton") || !response.includes("Tuweb")) {
      throw new Error("RAG output did not return correct details from database.");
    }
    logger.info("✅ RAG pipeline verified successfully.");

    logger.info("========================================");
    logger.info("  🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉  ");
    logger.info("========================================");
    process.exit(0);
  } catch (error) {
    logger.error("❌ TEST RUN FAILED", error);
    process.exit(1);
  }
}

runTests();
