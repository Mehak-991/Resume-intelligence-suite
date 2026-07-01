const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { syncHackathonsFromSheet } = require('./syncHackathons')
const { syncJobsFromSheet } = require('./syncJobs')

/**
 * Main sync function - orchestrates separate hackathon and job syncs
 */
async function syncAlertsFromSheet() {
  console.log("Starting complete alerts sync from Google Sheet...")
  const overallStartTime = Date.now()

  try {
    // Sync hackathons separately
    console.log("\n=== SYNCING HACKATHONS ===")
    const hackathonResult = await syncHackathonsFromSheet()
    
    // Sync jobs separately  
    console.log("\n=== SYNCING JOBS ===")
    const jobResult = await syncJobsFromSheet()

    const overallDuration = Date.now() - overallStartTime
    console.log(`\n=== COMPLETE SYNC FINISHED ===`)
    console.log(`Total sync completed in ${overallDuration}ms`)
    console.log(`Hackathons: ${hackathonResult.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`Jobs: ${jobResult.success ? 'SUCCESS' : 'FAILED'}`)

    return {
      success: hackathonResult.success && jobResult.success,
      stats: {
        hackathons: hackathonResult.stats,
        jobs: jobResult.stats,
      },
      duration: overallDuration,
    }
  } catch (error) {
    console.error("Complete sync failed:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Run sync if called directly
if (require.main === module) {
  syncAlertsFromSheet()
    .then((result) => {
      console.log("Complete sync result:", result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error("Fatal error:", error)
      process.exit(1)
    })
}

module.exports = { syncAlertsFromSheet }
