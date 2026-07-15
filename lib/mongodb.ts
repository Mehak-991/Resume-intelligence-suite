import { MongoClient, MongoClientOptions } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error(
    'Missing environment variable: "MONGODB_URI". ' +
    'Make sure your .env file has a valid MONGODB_URI (no duplicate prefix).'
  )
}

const uri = process.env.MONGODB_URI
console.log("[MongoDB] URI loaded (host):", (() => {
  try { return new URL(uri).hostname } catch { return "parse-error" }
})())

const options: MongoClientOptions = {
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 20000,
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  retryReads: true,
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options)
    global._mongoClientPromise = client.connect().then((c) => {
      console.log("[MongoDB] Connected successfully ✅")
      return c
    }).catch((err) => {
      console.error("[MongoDB] Connection failed:", err.message)
      // Clear the global so the next request retries
      global._mongoClientPromise = undefined
      throw err
    })
  }
  clientPromise = global._mongoClientPromise as Promise<MongoClient>
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect().then((c) => {
    console.log("[MongoDB] Connected successfully (production) ✅")
    return c
  })
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

/**
 * Helper: get a connected DB instance with proper error handling.
 * Usage: const db = await getDb("resumeiq")
 */
export async function getDb(dbName = "resumeiq") {
  try {
    const client = await clientPromise
    return client.db(dbName)
  } catch (error) {
    const err = error as Error & { code?: string; cause?: { code?: string } }
    const code = err?.cause?.code || err?.code || ""

    let userMessage = "Database connection failed"

    if (code === "ECONNREFUSED" || err.message?.includes("querySrv") || err.message?.includes("ENOTFOUND")) {
      userMessage =
        "Cannot reach MongoDB Atlas. Check: " +
        "1) Atlas cluster is running (not paused), " +
        "2) Your IP is whitelisted in Atlas Network Access (add 0.0.0.0/0 for dev), " +
        "3) Your network is not blocking MongoDB SRV records (try mobile hotspot)."
    } else if (code === "ETIMEDOUT") {
      userMessage = "Database connection timed out. Check your network and Atlas cluster status."
    } else if (err.message?.includes("bad auth") || err.message?.includes("Authentication failed")) {
      userMessage = "Database authentication failed. Check your MONGODB_URI username/password."
    } else if (err.message?.includes("MONGODB_URI=")) {
      userMessage =
        "MONGODB_URI is malformed — it appears to contain a duplicate key prefix. " +
        "Check your .env file: the value must NOT start with 'MONGODB_URI='."
    }

    console.error("[MongoDB] getDb error:", { code, message: err.message, userMessage })
    throw Object.assign(new Error(userMessage), { originalError: err })
  }
}
