// Blocks running vitest or tsx directly, so every test, sim and script runs under scripts/deadline.mjs, whose
// watchdog kills a hung run and the workers it leaves behind.
let input = ''
for await (const chunk of process.stdin) input += chunk
const command = JSON.parse(input).tool_input?.command ?? ''
if (/(^|[\s;&|(`])(?<!run\s(-s\s)?)(npx\s+)?(vitest|tsx)(\s|$)/.test(command)) {
  console.error('Run vitest and tsx under a deadline: `npm run test -- <files>` or `npm run tsx -- <script>` in app/.')
  process.exit(2)
}
// A server started by hand outlives its agent. eye keeps one for the whole machine.
if (/(^|[;&|(]\s*)(npm\s+run\s+(-s\s+)?dev|(npx\s+)?vite(?!\s+build)|node\s+\S*vite\.js)(\s|$)/.test(command)) {
  console.error('Do not start a dev server: `npm run -s eye -- <command>` in app/ shares one, and `npm run -s eye -- stop` ends it.')
  process.exit(2)
}
