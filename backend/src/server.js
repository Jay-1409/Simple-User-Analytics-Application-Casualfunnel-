import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';

mongoose.set('strictQuery', true);

try {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });
} catch (error) {
  console.error('Failed to start server', error);
  process.exit(1);
}
