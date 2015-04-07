var mongoose = require('mongoose'),
  Tag = require('./tag')

var CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  displayColor: { type: String, default: 'FFFFFF'},
  description: String,
  tags: [Tag.schema]
})

module.exports = mongoose.model('categories', CategorySchema)
