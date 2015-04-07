var mongoose = require('mongoose')

var TagSchema = new mongoose.Schema({
    startFrame: { type: Number, required: true },
    endFrame: { type: Number, required: true },
    run: { type: String, required: true },
    track: { type: String, required: true },
    lanesFilename: { type: String, required: true },
    description: String,
    category: { type: mongoose.Schema.ObjectId, ref: 'categories' }
})

module.exports = mongoose.model('tags', TagSchema)
