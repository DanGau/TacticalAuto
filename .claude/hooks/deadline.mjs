// Blocks running vitest or tsx directly, so every test, sim and script runs under scripts/deadline.mjs, whose
// watchdog kills a hung run and the workers it leaves behind.
let input = ''
for await (const chunk of process.stdin) input += chunk
const command = JSON.parse(input).tool_input?.command ?? ''
if (/(^|[\s;&|(`])(?<!run\s(-s\s)?)(npx\s+)?(vitest|tsx)(\s|$)/.test(command)) {
  console.error('Run vitest and tsx under a deadline: `npm run test -- <files>` or `npm run tsx -- <script>` in app/.')
  process.exit(2)
}
