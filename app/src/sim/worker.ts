// A sim worker process: plays the seeds it is sent.
import { bots } from '../bots/bots'
import { POLICIES } from './rest'
import { runWith } from './run'

/** A sim child process: given doctrines, plays each batch of seeds it is sent and reports the runs, without their actions. */
type Setup = { doctrines: string[]; forks: boolean; rests: boolean }
type Batch = { id: number; jobs: { bot: string; seed: number }[] }

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
const doctrines = setup.doctrines as Parameters<typeof runWith>[2]
process.on('message', ({ id, jobs }: Batch) => {
  const played = jobs.map(({ bot, seed }) => {
    // A busy process can't hear its parent disconnect, so checks it is alive between runs.
    if (!alive(process.ppid)) process.exit(0)
    return { bot, result: { ...runWith(seed, bots[bot] ?? POLICIES[bot], doctrines, setup.forks, setup.rests), actions: [] } }
  })
  send({ id, played, rss: process.memoryUsage().rss })
})
process.on('disconnect', () => process.exit(0))
send({ ready: true })
