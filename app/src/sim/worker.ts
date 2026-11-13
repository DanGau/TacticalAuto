// A sim worker process: plays the seeds it is sent.
import { bots } from '../bots/bots'
import { POLICIES } from './rest'
import { runWith, type Loadout } from './run'

/** A sim child process: plays each batch of seeds it is sent and reports the runs, without their actions. */
type Setup = { forks: boolean; rests: boolean }
type Batch = { id: number; jobs: { key: string; bot: string; seed: number; loadout: Loadout }[] }

const send = (message: unknown) => process.send!(message)
const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const setup = await new Promise<Setup>((resolve) => process.once('message', resolve))
process.on('message', ({ id, jobs }: Batch) => {
  const played = jobs.map(({ key, bot, seed, loadout }) => {
    // A busy process can't hear its parent disconnect, so checks it is alive between runs.
    if (!alive(process.ppid)) process.exit(0)
    return { key, result: { ...runWith(seed, bots[bot] ?? POLICIES[bot], loadout, setup.forks, setup.rests), actions: [] } }
  })
  send({ id, played, rss: process.memoryUsage().rss })
})
process.on('disconnect', () => process.exit(0))
send({ ready: true })
