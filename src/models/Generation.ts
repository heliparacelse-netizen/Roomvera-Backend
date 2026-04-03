import mongoose, { Document, Schema } from 'mongoose';

export interface IGeneration extends Document {
  userId: mongoose.Types.ObjectId;
  inputImageUrl: string;
  outputImageUrl: string;
  style: string;
  roomType: string;
  prompt: string;
  status: string;
  createdAt: Date;
}

const GenerationSchema = new Schema<IGeneration>(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inputImageUrl:  { type: String, default: '' },
    outputImageUrl: { type: String, default: '' },
    style:          { type: String, default: '' },
    roomType:       { type: String, default: '' },
    prompt:         { type: String, default: '' },
    status:         { type: String, default: 'pending', enum: ['pending', 'done', 'failed'] }
  },
  { timestamps: true }
);

export default mongoose.model<IGeneration>('Generation', GenerationSchema);
