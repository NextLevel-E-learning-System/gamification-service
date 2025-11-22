import { config } from 'dotenv'
config()
import { createServer } from './server.js'
import { startLeaderboardSyncJob } from './services/leaderboardSyncJob.js'

const port = Number(process.env.PORT || 3333)

createServer().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[gamification-service] listening on ${port}`)

  // Inicia o job de sincronização do Redis
  startLeaderboardSyncJob()
})
