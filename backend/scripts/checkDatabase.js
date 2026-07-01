const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require("mongoose")
const JobPosting = require("../models/JobPosting")
const Hackathon = require("../models/Hackathon")

/**
 * Check actual database contents
 */
async function checkDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB")

    // Check hackathons
    const hackathonCount = await Hackathon.countDocuments()
    console.log(`\n=== HACKATHONS ===`)
    console.log(`Total hackathons in database: ${hackathonCount}`)
    
    const hackathons = await Hackathon.find({})
    console.log("Hackathon titles:")
    hackathons.forEach((h, i) => {
      console.log(`${i + 1}. ${h.Title} - ${h.Link}`)
    })

    // Check jobs
    const jobCount = await JobPosting.countDocuments()
    console.log(`\n=== JOBS ===`)
    console.log(`Total jobs in database: ${jobCount}`)
    
    const jobs = await JobPosting.find({})
    console.log("Job titles by source:")
    const jobsBySource = {}
    jobs.forEach(job => {
      const source = job.sourceSheetName || 'Unknown'
      if (!jobsBySource[source]) jobsBySource[source] = []
      jobsBySource[source].push(job.job_title)
    })
    
    Object.keys(jobsBySource).forEach(source => {
      console.log(`\n${source} (${jobsBySource[source].length} entries):`)
      jobsBySource[source].forEach((title, i) => {
        console.log(`  ${i + 1}. ${title}`)
      })
    })

    // Check for duplicates
    console.log(`\n=== DUPLICATE CHECK ===`)
    const jobDuplicates = await JobPosting.aggregate([
      {
        $group: {
          _id: { job_title: "$job_title", company_name: "$company_name" },
          count: { $sum: 1 },
          docs: { $push: "$_id" }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ])
    
    if (jobDuplicates.length > 0) {
      console.log(`Found ${jobDuplicates.length} duplicate job groups:`)
      jobDuplicates.forEach(dup => {
        console.log(`  - ${dup._id.job_title} at ${dup._id.company_name} (${dup.count} entries)`)
      })
    } else {
      console.log("No duplicate jobs found")
    }

    const hackathonDuplicates = await Hackathon.aggregate([
      {
        $group: {
          _id: { Title: "$Title", Link: "$Link" },
          count: { $sum: 1 },
          docs: { $push: "$_id" }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ])
    
    if (hackathonDuplicates.length > 0) {
      console.log(`Found ${hackathonDuplicates.length} duplicate hackathon groups:`)
      hackathonDuplicates.forEach(dup => {
        console.log(`  - ${dup._id.Title} (${dup.count} entries)`)
      })
    } else {
      console.log("No duplicate hackathons found")
    }

  } catch (error) {
    console.error("Error checking database:", error)
  } finally {
    await mongoose.disconnect()
  }
}

// Run check if called directly
if (require.main === module) {
  checkDatabase()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error("Fatal error during database check:", error)
      process.exit(1)
    })
}

module.exports = { checkDatabase }
