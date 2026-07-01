const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb://Resumeiq:Resume123456@ac-24oalsg-shard-00-00.wyqfbjb.mongodb.net:27017,ac-24oalsg-shard-00-01.wyqfbjb.mongodb.net:27017,ac-24oalsg-shard-00-02.wyqfbjb.mongodb.net:27017/resumeiq?ssl=true&replicaSet=atlas-rwm4f4-shard-0&authSource=admin&retryWrites=true&w=majority";
  
  console.log("Testing direct connection...");

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
