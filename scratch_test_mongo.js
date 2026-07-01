const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI;
  console.log("Testing connection to URI:", uri ? uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@") : "undefined");

  if (!uri) {
    console.error("MONGODB_URI is not set!");
    return;
  }

  const client = new MongoClient(uri);
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected successfully!");
    const db = client.db("resumeiq");
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
  } catch (err) {
    console.error("Connection failed with error:");
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
