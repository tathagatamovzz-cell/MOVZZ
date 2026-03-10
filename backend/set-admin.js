const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setAdmin() {
  try {
    // Get the most recently created user (your latest signup)
    const user = await prisma.user.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!user) {
      console.log('❌ No users found');
      process.exit(1);
    }

    // Update to admin
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    });

    console.log(`✅ User set as admin:\n`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Role: admin`);
    console.log(`\n   Now try accessing admin routes again`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setAdmin();
