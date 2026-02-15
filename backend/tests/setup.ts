// Test setup file
// This runs before all tests

import { prisma } from '../src/config/database';

// Clean up database before tests
beforeAll(async () => {
  // You can add global test setup here
  console.log('🧪 Test suite starting...');
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log('✅ Test suite completed');
});
