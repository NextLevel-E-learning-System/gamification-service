import { config } from 'dotenv';
config();
import { createServer } from './server.js';
import { startConsumer } from './events/consumer.js';
const port = Number(process.env.PORT || 3333);
createServer().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[gamification-service] listening on ${port}`);
  startConsumer().catch(err => console.error('consumer_error', err));
});