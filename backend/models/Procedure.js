const mongoose = require('mongoose')

const hospitalSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  city:    { type: String, default: 'Delhi' },
  price:   { type: Number, required: true },
  type:    { type: String, enum: ['Government', 'Private', 'Trust'], default: 'Private' },
  rating:  { type: Number, min: 1, max: 5, default: 3 },
  contact: { type: String, default: '' },
  // GeoJSON point — [longitude, latitude] (MongoDB expects this order)
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [77.2090, 28.6139] }  // Default: Delhi centre
  }
})

// 2dsphere index enables $near and $geoWithin queries on embedded hospital documents
hospitalSchema.index({ location: '2dsphere' })

const procedureSchema = new mongoose.Schema({
  officialName: { type: String, required: true, unique: true },
  commonName:   { type: String, required: true },
  cghsRate:     { type: Number, required: true },
  category:     {
    type: String,
    enum: ['Surgery', 'Diagnostic', 'Consultation', 'Therapy', 'Other'],
    default: 'Other'
  },
  keywords:     [String],
  hospitals:    [hospitalSchema],
  description:  { type: String, default: '' },
  duration:     { type: String, default: '' },
  recovery:     { type: String, default: '' },
  source:       { type: String, default: 'manual' },
  addedAt:      { type: Date, default: Date.now }
}, { timestamps: true })

procedureSchema.index({ commonName: 'text', officialName: 'text', keywords: 'text' })

module.exports = mongoose.model('Procedure', procedureSchema)