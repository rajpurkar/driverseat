var mongoose = require('mongoose'),
    Tag = require('./tag');

var CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    // Default is white color
    displayColor: { type: String, default: "FFFFFF" },
    description: String,
    tags: [Tag.schema]
});

module.exports = mongoose.model('categories', CategorySchema);