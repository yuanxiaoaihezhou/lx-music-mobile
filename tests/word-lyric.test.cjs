const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, modules) {
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`)
    return modules[name]
  }, setInterval, clearInterval, setTimeout, Date, Map })
  return exports
}

const lyric = load('src/plugins/lyric.ts', { react: {}, 'lrc-file-parser': class {} })
const lines = lyric.parseWordLyric('[00:01.000]<0,100>你<100,100>好\n[00:02.000]<0,200>啊\n[00:03.000]<0,100>哦')
assert.equal(lines.length, 3)
assert.equal(lines[0].text, '你好')
assert.deepEqual(Array.from(lyric.alignWordLyricText(lines, '[ar:artist]\n[00:01.00]hello\n[00:03.000]oh')), ['hello', '', 'oh'])
assert.deepEqual(Array.from(lyric.alignWordLyricText(lines, '[00:01.000][00:03.000]same')), ['same', '', 'same'])

const wordInputs = []
const playerState = { musicInfo: { id: '1', lrc: '[00:01.00]hello', lxlrc: '[00:01.00]<0,100>hello' }, isPlay: false }
const settingState = { setting: { 'player.isShowWordLyric': false, 'player.isShowBluetoothFullLyric': false } }
const noop = () => {}
const core = load('src/core/lyric.ts', {
  '@/plugins/lyric': { setLyric: noop, setWordLyric: value => wordInputs.push(value) },
  '@/core/desktopLyric': { setDesktopLyric: async () => {} },
  '@/plugins/player': {},
  '@/store/player/state': { default: playerState, __esModule: true },
  '@/store/setting/state': { default: settingState, __esModule: true },
  '@/plugins/player/utils': {},
})
;(async () => {
  await core.setLyric()
  assert.equal(wordInputs.at(-1), '', 'disabled mode must stay disabled after a track changes')
  settingState.setting['player.isShowWordLyric'] = true
  await core.setLyric()
  assert.equal(wordInputs.at(-1), playerState.musicInfo.lxlrc)
  console.log('Word lyric regression checks passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
