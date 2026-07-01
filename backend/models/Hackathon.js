const mongoose = require("mongoose")

const hackathonSchema = new mongoose.Schema(
  {
    Title: {
      type: String,
      required: true,
      index: true,
    },
    Link: {
      type: String,
      required: true,
    },
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
hackathonSchema.index({
  Title: "text",
})

// Index for sorting
hackathonSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Hackathon", hackathonSchema)
