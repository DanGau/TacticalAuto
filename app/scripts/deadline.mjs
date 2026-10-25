// Runs a command with a deadline: `node scripts/deadline.mjs <seconds> <command...>`.
// A separate watchdog kills the command's whole process tree once the deadline passes, this process dies, or the command
// exits, so neither a hung test or sim nor a worker it leaves behind outlives whoever started it.
import { execFileSync, spawn } from 'node:child_process'

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Every process descended from `root`, found by parent ids, which stay set after a parent between them has exited. */
function descendants(root) {
  const csv = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId)" }'], { encoding: 'utf8' })
  const pairs = csv.trim().split(/\r?\n/).map((line) => line.split(',').map(Number))
  const found = [root]
  for (let i = 0; i < found.length; i++) found.push(...pairs.filter(([pid, parent]) => parent === found[i] && pid !== process.pid).map(([pid]) => pid))
  return found
}

/** Kills `root` and everything under it: on Windows by walking the tree, elsewhere by its process group. */
function killTree(root) {
  for (const pid of process.platform === 'win32' ? descendants(root) : [-root]) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Already gone.
    }
  }
}

const [mode, ...args] = process.argv.slice(2)

if (mode === '--watch') {
  const [owner, child, until] = args.map(Number)
  const timer = setInterval(() => {
    if (alive(owner) && alive(child) && Date.now() < until) return
    killTree(child)
    clearInterval(timer)
  }, 1000)
} else {
  const seconds = Number(mode)
  const child = spawn(args.join(' '), { stdio: 'inherit', shell: true, detached: process.platform !== 'win32' })
  const watchdog = spawn(process.execPath, [process.argv[1], '--watch', String(process.pid), String(child.pid), String(Date.now() + seconds * 1000)], {
    stdio: 'ignore',
    detached: true,
  })
  watchdog.unref()
  setTimeout(() => console.error(`${args.join(' ')} passed its ${seconds}s deadline; killing it`), seconds * 1000).unref()
  child.on('exit', (code, signal) => {
    if (signal) console.error(`${args.join(' ')} ended by ${signal}`)
    process.exit(code ?? 1)
  })
}
