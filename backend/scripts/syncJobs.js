const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require("mongoose")
const JobPosting = require("../models/JobPosting")

// TODO: Schedule via cron / n8n webhook trigger
// Example cron: 0 2 * * * (daily at 2 AM)
// Example n8n: HTTP Request node pointing to /api/alerts/sync/jobs

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID ? 
  process.env.GOOGLE_SHEET_ID.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || process.env.GOOGLE_SHEET_ID :
  "1bSHWwYJ9kIdpYSLkqtg1Q0troGS0HlDjwlReUMoqiDU"

const JOB_SHEETS = {
  JOBS_1: "Indeed_Jobs",
  JOBS_2: "Common_Jobs", 
  JOBS_3: "LinkedIn_Jobs", // Try "LinkedIn_Jobs" instead of "Linkedin_Job"
}

/**
 * Fetch CSV data from Google Sheet
 * Using CSV export: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}
 */
async function fetchJobData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheetName}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch job sheet ${sheetName}: ${response.status}`)
    }

    const csvText = await response.text()
    return parseCSV(csvText)
    
  } catch (error) {
    console.error(`Error fetching job sheet ${sheetName}:`, error)
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
 * Normalize job posting from sheet row - direct Excel to MongoDB mapping
 */
function normalizeJobPosting(row, sourceSheet) {
  let postedDate = new Date()
  if (row.Posted_Date) {
    const parsedDate = new Date(row.Posted_Date)
    if (!isNaN(parsedDate.getTime())) {
      postedDate = parsedDate
    }
  }

  // Direct mapping from Excel columns to MongoDB schema fields
  const jobTitle = row.Job_Title || row.Job_title || row.Title || "Untitled"
  
  // Keywords from job title as requested
  const keywords = jobTitle.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(Boolean)

  return {
    apply_link: row.Apply_link || row.Apply_Link || row.Job_Url || "",
    company_name: row.Company_Name || "Unknown",
    job_title: jobTitle,
    description: row.Description || "",
    location: row.Location || "Remote",
    posted_date: postedDate,
    keywords: [...new Set(keywords)], // From job title as requested
    sourceSheetName: sourceSheet,
    lastSyncedAt: new Date(),
  }
}

/**
 * Upsert jobs into MongoDB
 */
async function syncJobs(jobsData, sourceSheet) {
  let insertCount = 0
  let updateCount = 0
  let skippedCount = 0

  console.log(`Processing ${jobsData.length} job entries from ${sourceSheet}...`)

  for (const row of jobsData) {
    try {
      const normalizedJob = normalizeJobPosting(row, sourceSheet)

      // Debug: Show what we're processing
      if (skippedCount < 3 || insertCount < 3) {
        console.log(`Processing job from ${sourceSheet}: ${JSON.stringify(normalizedJob)}`)
      }

      // Skip completely empty entries
      if (!normalizedJob.job_title || normalizedJob.job_title === "Untitled") {
        console.log(`Skipping job from ${sourceSheet} - no title: ${JSON.stringify(normalizedJob)}`)
        skippedCount++
        continue
      }

      // Upsert based on unique combination of title, company, and link
      const result = await JobPosting.findOneAndUpdate(
        {
          job_title: normalizedJob.job_title,
          company_name: normalizedJob.company_name,
          apply_link: normalizedJob.apply_link,
        },
        normalizedJob,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )

      if (result.isNew) {
        insertCount++
        console.log(`Inserted new job from ${sourceSheet}: ${normalizedJob.job_title}`)
      } else {
        updateCount++
        console.log(`Updated existing job from ${sourceSheet}: ${normalizedJob.job_title}`)
      }
    } catch (error) {
      console.error("Error syncing job:", error)
    }
  }

  console.log(`Job sync summary for ${sourceSheet}: ${insertCount} inserted, ${updateCount} updated, ${skippedCount} skipped`)
  return { insertCount, updateCount }
}

/**
 * Main job sync function
 */
async function syncJobsFromSheet() {
  console.log("Starting jobs sync from Google Sheet...")
  const startTime = Date.now()

  try {
    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI)
      console.log("Connected to MongoDB")
    }

    // Fetch all job sheets
    const [jobs1Data, jobs2Data, jobs3Data] = await Promise.all([
      fetchJobData(JOB_SHEETS.JOBS_1),
      fetchJobData(JOB_SHEETS.JOBS_2),
      fetchJobData(JOB_SHEETS.JOBS_3),
    ])

    console.log(`Fetched job data:
      - Jobs Source 1: ${jobs1Data.length}
      - Jobs Source 2: ${jobs2Data.length}
      - Jobs Source 3: ${jobs3Data.length}
    `)

    // Sync jobs from all sources
    const jobs1Stats = await syncJobs(jobs1Data, JOB_SHEETS.JOBS_1)
    const jobs2Stats = await syncJobs(jobs2Data, JOB_SHEETS.JOBS_2)
    const jobs3Stats = await syncJobs(jobs3Data, JOB_SHEETS.JOBS_3)

    const totalJobInserts = jobs1Stats.insertCount + jobs2Stats.insertCount + jobs3Stats.insertCount
    const totalJobUpdates = jobs1Stats.updateCount + jobs2Stats.updateCount + jobs3Stats.updateCount

    console.log(`Jobs: ${totalJobInserts} inserted, ${totalJobUpdates} updated`)

    const duration = Date.now() - startTime
    console.log(`Job sync completed in ${duration}ms`)

    return {
      success: true,
      stats: {
        jobs: {
          insertCount: totalJobInserts,
          updateCount: totalJobUpdates,
        }
      },
      duration,
    }
  } catch (error) {
    console.error("Job sync failed:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Run sync if called directly
if (require.main === module) {
  syncJobsFromSheet()
    .then((result) => {
      console.log("Job sync result:", result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error("Fatal error:", error)
      process.exit(1)
    })
}

module.exports = { syncJobsFromSheet }
