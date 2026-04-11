require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Replicate = require('replicate');
const cloudinary = require('../src/config/cloudinary');
const mongoose = require('mongoose');
const axios = require('axios');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const prompts = fs.readFileSync(path.join(__dirname, '..', 'PROMPTS_IMAGES.md'), 'utf-8').split('\n').filter(p => p.trim());
    for (let i = 0; i < prompts.length; i++) {
        console.log(`Generating ${i + 1}/${prompts.length}...`);
        const out = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", { input: { prompt: prompts[i], num_outputs: 1 } });
        const res = await axios.get(out[0], { responseType: 'arraybuffer' });
        const up = await new Promise((res, rej) => cloudinary.uploader.upload_stream({ folder: 'roomvera_seeds', public_id: `seed_${i + 1}` }, (e, r) => e ? rej(e) : res(r)).end(Buffer.from(res.data, 'binary')));
        console.log(`Done: ${up.secure_url}`);
    }
    process.exit(0);
};
run();
