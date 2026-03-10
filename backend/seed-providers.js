const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedProviders() {
  try {
    await prisma.provider.deleteMany({});
    
    const providers = [
      // CAB - Economy providers
      {
        name: 'Fast Track Cabs - Economy',
        phone: '+919876543210',
        type: 'FLEET_OPERATOR',
        active: true,
        reliability: 0.92,
        rating: 4.8,
        totalRides: 2500,
        successfulRides: 2300,
        currentActiveRides: 15,
        maxCapacity: 50,
        vehicleModel: 'Maruti Swift',
        paymentTerms: 'T+2',
      },
      // CAB - Comfort providers
      {
        name: 'Chennai Call Taxi - Comfort',
        phone: '+919876543211',
        type: 'FLEET_OPERATOR',
        active: true,
        reliability: 0.88,
        rating: 4.6,
        totalRides: 1800,
        successfulRides: 1584,
        currentActiveRides: 10,
        maxCapacity: 35,
        vehicleModel: 'Hyundai i20',
        paymentTerms: 'T+2',
      },
      // CAB - Premium providers
      {
        name: 'Elite Cabs - Premium',
        phone: '+919876543212',
        type: 'FLEET_OPERATOR',
        active: true,
        reliability: 0.96,
        rating: 4.9,
        totalRides: 1200,
        successfulRides: 1152,
        currentActiveRides: 8,
        maxCapacity: 20,
        vehicleModel: 'Skoda Rapid',
        paymentTerms: 'T+2',
      },
      // BIKE providers
      {
        name: 'Bike Taxi Pro',
        phone: '+919876543213',
        type: 'FLEET_OPERATOR',
        active: true,
        reliability: 0.90,
        rating: 4.7,
        totalRides: 3000,
        successfulRides: 2700,
        currentActiveRides: 25,
        maxCapacity: 100,
        vehicleModel: 'Honda Activa',
        paymentTerms: 'T+1',
      },
      // AUTO providers
      {
        name: 'Yellow Auto - Chennai',
        phone: '+919876543214',
        type: 'FLEET_OPERATOR',
        active: true,
        reliability: 0.85,
        rating: 4.4,
        totalRides: 4000,
        successfulRides: 3400,
        currentActiveRides: 30,
        maxCapacity: 80,
        vehicleModel: 'Bajaj Auto',
        paymentTerms: 'T+0',
      },
      // Individual drivers for CAB
      {
        name: 'Raj Kumar - Driver',
        phone: '+919876543215',
        type: 'INDIVIDUAL_DRIVER',
        active: true,
        reliability: 0.94,
        rating: 4.8,
        totalRides: 800,
        successfulRides: 752,
        currentActiveRides: 1,
        maxCapacity: 4,
        vehicleModel: 'Maruti Ciaz',
        paymentTerms: 'T+2',
      },
      {
        name: 'Priya Singh - Driver',
        phone: '+919876543216',
        type: 'INDIVIDUAL_DRIVER',
        active: true,
        reliability: 0.93,
        rating: 4.9,
        totalRides: 600,
        successfulRides: 558,
        currentActiveRides: 1,
        maxCapacity: 4,
        vehicleModel: 'Hyundai Xcent',
        paymentTerms: 'T+2',
      },
      // Backup CAB provider
      {
        name: 'City Cabs - Backup',
        phone: '+919876543217',
        type: 'FLEET_OPERATOR',
        active: true,
        reliability: 0.80,
        rating: 4.2,
        totalRides: 1500,
        successfulRides: 1200,
        currentActiveRides: 12,
        maxCapacity: 40,
        vehicleModel: 'Tata Nexon',
        paymentTerms: 'T+3',
      },
    ];

    for (const provider of providers) {
      await prisma.provider.create({ data: provider });
    }

    console.log(`✅ Seeded ${providers.length} providers:\n`);
    console.log('CAB Providers:');
    console.log('  • Fast Track Cabs - Economy (₹12/km)');
    console.log('  • Chennai Call Taxi - Comfort (₹15/km)');
    console.log('  • Elite Cabs - Premium (₹18/km)');
    console.log('  • Raj Kumar - Driver');
    console.log('  • Priya Singh - Driver');
    console.log('  • City Cabs - Backup\n');
    console.log('BIKE Providers:');
    console.log('  • Bike Taxi Pro (₹7/km)\n');
    console.log('AUTO Providers:');
    console.log('  • Yellow Auto - Chennai (₹10/km)\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedProviders();
