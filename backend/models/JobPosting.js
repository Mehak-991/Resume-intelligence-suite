const mongoose = require("mongoose")

const jobPostingSchema = new mongoose.Schema(
  {
    job_title: {
      type: String,
      required: true,
      index: true,
    },
    company_name: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      type: String,
      default: "Remote",
    },
    description: {
      type: String,
    },
    apply_link: {
      type: String,
      required: true,
    },
    posted_date: {
      type: Date,
      default: Date.now,
    },
    keywords: [
      {
        type: String,
      },
    ],
    // sourceSheetName: {
    //   type: String, // Track which sheet this came from
    // },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Text index for full-text search
jobPostingSchema.index({
  job_title: "text",
  company_name: "text",
  description: "text",
  keywords: "text",
})

// Compound index for common queries
jobPostingSchema.index({ company_name: 1, location: 1 })
jobPostingSchema.index({ posted_date: -1 })

module.exports = mongoose.model("JobPosting", jobPostingSchema)
