import { queryGeneralAI } from './services/aiService.js';
import logger from './utils/logger.js';

async function test() {
  try {
    logger.info("Testing general AI query...");
    const response = await queryGeneralAI("Siapa penemu lampu bohlam?");
    logger.info("Response received:");
    console.log(response);
    
    // Check if the response contains UT-specific terms or if it is a general answer
    if (response.toLowerCase().includes("universitas terbuka") || response.toLowerCase().includes("batam")) {
      logger.error("❌ Test failed: Response contains UT references!");
      process.exit(1);
    } else {
      logger.info("✅ Test passed: Response is a general AI response.");
      process.exit(0);
    }
  } catch (error: any) {
    logger.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

test();
