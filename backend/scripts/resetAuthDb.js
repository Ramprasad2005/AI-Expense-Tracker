const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function resetAuthDatabase() {
  const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ Error: MONGO_URI or MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log(`Connected to database: ${mongoose.connection.name}`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('Existing collections:', collectionNames);

    const authCollectionsToWipe = [
      'users',
      'pendingusers',
      'otps',
      'verificationtokens',
      'sessions',
      'resettokens',
      'emailverifications'
    ];

    for (const collName of authCollectionsToWipe) {
      if (collectionNames.includes(collName)) {
        console.log(`Wiping collection '${collName}'...`);
        await mongoose.connection.db.collection(collName).deleteMany({});
        console.log(`✅ Collection '${collName}' cleared.`);
      }
    }

    console.log('\n===========================================================');
    console.log('🎉 AUTH DATABASE RESET COMPLETE: All users & auth records removed.');
    console.log('===========================================================\n');
  } catch (error) {
    console.error('❌ Failed to reset authentication database:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

resetAuthDatabase();
