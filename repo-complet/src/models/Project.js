const mongoose = require('mongoose');
const projectSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, type: { type: String, required: true }, prompt: { type: String }, inputUrl: { type: String, required: true }, outputUrl: { type: String, required: true }, creditsCost: { type: Number, required: true } }, { timestamps: true });
module.exports = mongoose.model('Project', projectSchema);
