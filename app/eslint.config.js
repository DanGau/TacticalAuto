import tseslint from 'typescript-eslint'

// Each layer may import only what its regex allows; see docs/architecture/design.md.
const layer = (dir, allowed, message) => ({
  files: [`src/${dir}/**/*.ts`],
  ignores: ['**/*.test.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ regex: `^(?!${allowed})`, message }] }],
  },
})

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'screenshots', '.eye'] },
  ...tseslint.configs.recommended,
  layer('core', '\./', 'core/ imports only core/. Pass data in instead.'),
  layer('bots', '\./|\.\./core/', 'bots/ imports only bots/ and core/.'),
  layer('sim', '\./|\.\./(core|bots)/|node:', 'sim/ imports only sim/, bots/, core/ and node builtins.'),
  layer('{view,ui}', '\./|\.\./(core|view|ui)/|pixi\.js$', 'view/ and ui/ import only view/, ui/, core/ and pixi.js.'),
  {
    files: ['src/core/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Use random() from rng.ts so battles replay from a seed.' },
        { object: 'Date', property: 'now', message: 'Time in core/ is state.tick.' },
      ],
      'no-restricted-syntax': ['error', {
        selector: ':matches(Program, ExportNamedDeclaration) > VariableDeclaration[kind="let"]',
        message: 'No module-level mutable state in core/. Put it in State.',
      }],
    },
  },
)
