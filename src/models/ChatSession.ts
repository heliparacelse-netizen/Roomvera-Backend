// @ts-nocheck
import mongoose, { Schema } from 'mongoose';
const ChatSessionSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title:    { type: String, default: 'New conversation' },
  messages: [{ role: { type: String, enum: ['user','assistant'] }, content: String, createdAt: { type: Date, default: Date.now } }],
  lastMessage: { type: String, default: '' }
}, { timestamps: true });
export default mongoose.model('ChatSession', ChatSessionSchema);
