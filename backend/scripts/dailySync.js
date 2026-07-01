const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { syncHackathonsFromSheet } = require('./syncHackathons')
const { syncJobsFromSheet } = require('./syncJobs')
const { syncAlertsFromSheet } = require('./syncAlertsFromSheet')
const { checkDatabase } = require('./checkDatabase')

async function runDailySync() {
  console.log('=== DAILY ALERTS SYNC STARTED ===')
  const start = Date.now()

  try {
    console.log('\n[1/4] Syncing hackathons from sheet...')
    const hackathonResult = await syncHackathonsFromSheet()

    console.log('\n[2/4] Syncing jobs from sheet...')
    const jobResult = await syncJobsFromSheet()

    console.log('\n[3/4] Running database consistency / duplicate check...')
    await checkDatabase()

    console.log('\n[4/4] Running combined sync summary...')
    const fullResult = await syncAlertsFromSheet()

    const duration = Date.now() - start
    console.log('\n=== DAILY ALERTS SYNC FINISHED ===')
    console.log(`Total duration: ${duration}ms`)
    console.log('Hackathon sync result:', hackathonResult)
    console.log('Job sync result:', jobResult)
    console.log('Full sync result:', fullResult)

    const success =
      hackathonResult?.success !== false &&
      jobResult?.success !== false &&
      fullResult?.success !== false

    return { success, duration }
  } catch (error) {
    console.error('Daily sync failed:', error)
    return { success: false, error: error.message }
  }
}

if (require.main === module) {
  runDailySync()
    .then((result) => {
      console.log('Daily sync result:', result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Fatal error in daily sync:', error)
      process.exit(1)
    })
}

module.exports = { runDailySync }


