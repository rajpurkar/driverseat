var mongoose = require('mongoose'),
    Category = require('./category');

var TagSchema = new mongoose.Schema({
    startFrame: { type: Number, required: true },
    endFrame: { type: Number, required: true },
    run: { type: String, required: true },
    track: { type: String, required: true },
    lanesFilename: { type: String, required: true },
    description: String,
    category: { type: mongoose.Schema.ObjectId, ref: 'CategorySchema' }
});

module.exports = mongoose.model('tags', TagSchema);