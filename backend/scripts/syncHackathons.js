const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require("mongoose")
const Hackathon = require("../models/Hackathon")

// TODO: Schedule via cron / n8n webhook trigger
// Example cron: 0 2 * * * (daily at 2 AM)
// Example n8n: HTTP Request node pointing to /api/alerts/sync/hackathons

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID ? 
  process.env.GOOGLE_SHEET_ID.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || process.env.GOOGLE_SHEET_ID :
  "1bSHWwYJ9kIdpYSLkqtg1Q0troGS0HlDjwlReUMoqiDU"
const HACKATHON_SHEET = "Hackathons"

/**
 * Fetch CSV data from Google Sheet
 * Using CSV export: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}
 */
async function fetchHackathonData() {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${HACKATHON_SHEET}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch hackathon sheet: ${response.status}`)
    }

    const csvText = await response.text()
    return parseCSV(csvText)
    
  } catch (error) {
    console.error(`Error fetching hackathon sheet:`, error)
    return []
  }
}

/**
 * Simple CSV parser that handles quoted fields and multi-line content
 */
function parseCSV(csvText) {
  // Split by lines but keep quoted fields together
  const lines = []
  let currentLine = ''
  let inQuotes = false
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    if (char === '"') {
      inQuotes = !inQuotes
      currentLine += char
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine.trim())
      currentLine = ''
    } else {
      currentLine += char
    }
  }
  
  // Add the last line
  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }
  
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })
    
    // Skip empty rows
    if (Object.values(row).every(val => !val.trim())) continue
    
    rows.push(row)
  }

  return rows
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * Normalize hackathon from sheet row
 */
function normalizeHackathon(row) {
  // Create ordered object matching Excel column sequence
  const orderedHackathon = {}
  
  // Add fields in Excel column order
  if (row.Title !== undefined) orderedHackathon.Title = row.Title
  if (row.Link !== undefined) orderedHackathon.Link = row.Link
  
  // Add metadata fields at the end
  orderedHackathon.lastSyncedAt = new Date()

  return orderedHackathon
}

/**
 * Upsert hackathons into MongoDB
 */
async function syncHackathons(hackathonsData) {
  let insertCount = 0
  let updateCount = 0
  let skippedCount = 0

  console.log(`Processing ${hackathonsData.length} hackathon entries...`)

  for (const row of hackathonsData) {
    try {
      const normalizedHackathon = normalizeHackathon(row)

      // Debug: Show what we're processing
      if (skippedCount < 3) {
        console.log(`Processing hackathon: ${JSON.stringify(normalizedHackathon)}`)
      }

      // Skip invalid entries
      if (!normalizedHackathon.Link) {
        console.log(`Skipping hackathon - no link: ${JSON.stringify(normalizedHackathon)}`)
        skippedCount++
        continue
      }

      // Upsert based on unique combination of title and link
      const result = await Hackathon.findOneAndUpdate(
        {
          Title: normalizedHackathon.Title,
          Link: normalizedHackathon.Link,
        },
        normalizedHackathon,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )

      if (result.isNew) {
        insertCount++
        console.log(`Inserted new hackathon: ${normalizedHackathon.Title}`)
      } else {
        updateCount++
        console.log(`Updated existing hackathon: ${normalizedHackathon.Title}`)
      }
    } catch (error) {
      console.error("Error syncing hackathon:", error)
    }
  }

  console.log(`Hackathon sync summary: ${insertCount} inserted, ${updateCount} updated, ${skippedCount} skipped`)
  return { insertCount, updateCount }
}

/**
 * Main hackathon sync function
 */
async function syncHackathonsFromSheet() {
  console.log("Starting hackathons sync from Google Sheet...")
  const startTime = Date.now()

  try {
    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI)
      console.log("Connected to MongoDB")
    }

    // Fetch hackathon data
    const hackathonsData = await fetchHackathonData()

    console.log(`Fetched hackathon data: ${hackathonsData.length} entries`)

    // Sync hackathons
    const hackathonStats = await syncHackathons(hackathonsData)
    console.log(`Hackathons: ${hackathonStats.insertCount} inserted, ${hackathonStats.updateCount} updated`)

    const duration = Date.now() - startTime
    console.log(`Hackathon sync completed in ${duration}ms`)

    return {
      success: true,
      stats: hackathonStats,
      duration,
    }
  } catch (error) {
    console.error("Hackathon sync failed:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Run sync if called directly
if (require.main === module) {
  syncHackathonsFromSheet()
    .then((result) => {
      console.log("Hackathon sync result:", result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error("Fatal error:", error)
      process.exit(1)
    })
}

module.exports = { syncHackathonsFromSheet }
