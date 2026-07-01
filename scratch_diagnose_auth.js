/**
 * Diagnostic script: inspect users collection, indexes, and duplicate emails.
 * Run: node scratch_diagnose_auth.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  console.log('\n══════════════════════════════════════════');
  console.log('  MongoDB Auth Diagnostics');
  console.log('══════════════════════════════════════════\n');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db('resumeiq');

    // 1. List collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    const users = db.collection('users');

    // 2. Count total documents
    const totalCount = await users.countDocuments();
    console.log(`\nTotal users: ${totalCount}`);

    // 3. List all users (email + createdAt only)
    const allUsers = await users.find({}, { projection: { _id: 1, email: 1, name: 1, createdAt: 1 } }).toArray();
    console.log('\nAll user records:');
    allUsers.forEach((u, i) => {
      console.log(`  [${i}] id=${u._id}  email="${u.email}"  name="${u.name}"  createdAt=${u.createdAt}`);
    });

    // 4. Check for duplicate emails (case-insensitive)
    console.log('\nChecking for duplicate emails...');
    const pipeline = [
      { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ];
    const duplicates = await users.aggregate(pipeline).toArray();
    if (duplicates.length === 0) {
      console.log('  No duplicate emails found.');
    } else {
      console.log(`  ⚠️  DUPLICATES FOUND (${duplicates.length}):`);
      duplicates.forEach(d => console.log(`    email="${d._id}"  count=${d.count}  ids=${JSON.stringify(d.ids)}`));
    }

    // 5. List indexes on users collection
    const indexes = await users.indexes();
    console.log('\nIndexes on "users" collection:');
    indexes.forEach((idx, i) => {
      console.log(`  [${i}] name="${idx.name}"  key=${JSON.stringify(idx.key)}  unique=${idx.unique || false}`);
    });

    // 6. Simulate the findOne the signup route does
    const testEmail = 'test@example.com';
    console.log(`\nSimulating findOne({ email: "${testEmail}" })...`);
    const found = await users.findOne({ email: testEmail.toLowerCase() }, { projection: { _id: 1 } });
    console.log('  Result:', found ? `FOUND (id=${found._id})` : 'NOT FOUND');

    // 7. Check if email field is stored lowercase or mixed case
    console.log('\nEmail case check:');
    const emailSample = await users.find({}, { projection: { email: 1 } }).limit(5).toArray();
    emailSample.forEach(u => {
      const lower = u.email?.toLowerCase?.();
      const isMixed = u.email !== lower;
      console.log(`  "${u.email}" ${isMixed ? '⚠️  MIXED CASE!' : '✅ lowercase'}`);
    });

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err);
  } finally {
    await client.close();
    console.log('\n══════════════════════════════════════════\n');
  }
}

main();
