import prisma from './dist/database/prisma.js';

async function checkAdmins() {
  try {
    const admins = await prisma.admin.findMany();
    console.log("=== REGISTERED ADMINS ===");
    console.log(JSON.stringify(admins, null, 2));
  } catch (err) {
    console.error("Error checking database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmins();
