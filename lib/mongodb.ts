import { MongoClient, MongoClientOptions } from "mongodb"

const options: MongoClientOptions = {
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 20000,
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  retryReads: true,
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient> | null = null

export function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error(
      'Missing environment variable: "MONGODB_URI". ' +
      'Make sure your environment has a valid MONGODB_URI.'
    )
  }

  console.log("[MongoDB] Connecting to host:", (() => {
    try { return new URL(uri).hostname } catch { return "parse-error" }
  })())

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect().then((c) => {
        console.log("[MongoDB] Connected successfully ✅")
        return c
      }).catch((err) => {
        console.error("[MongoDB] Connection failed:", err.message)
        global._mongoClientPromise = undefined
        throw err
      })
    }
    clientPromise = global._mongoClientPromise
  } else {
    const client = new MongoClient(uri, options)
    clientPromise = client.connect().then((c) => {
      console.log("[MongoDB] Connected successfully (production) ✅")
      return c
    })
  }

  return clientPromise
}

// Lazy/Safe default export promise to prevent top-level connection attempts during next build
const defaultExportPromise: Promise<MongoClient> = new Promise<MongoClient>((resolve, reject) => {
  if (typeof window !== "undefined") {
    return; // Don't run client-side
  }
  // Wait until next tick to check if we actually have MONGODB_URI (safe for next build scan)
  process.nextTick(() => {
    if (!process.env.MONGODB_URI) {
      // Don't reject or throw instantly at build-time to avoid failing next build
      console.warn("[MongoDB] Warning: MONGODB_URI is not set during module initialization.");
      resolve({} as MongoClient);
      return;
    }
    getClientPromise().then(resolve).catch(reject);
  });
});

export default defaultExportPromise

export async function getDb(dbName = "resumeiq") {
  try {
    const client = await getClientPromise()
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
