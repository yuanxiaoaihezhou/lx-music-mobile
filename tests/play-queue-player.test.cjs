const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const values = new Map()
function load(file, imports, globals = {}) {
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => imports[name] ?? {}, console, Date, Math, Promise, Set, setTimeout, clearTimeout, ...globals })
  return exports
}
const queue = load('src/core/player/queue.ts', {
  react: {},
  '@/plugins/storage': { getData: async key => values.get(key) ?? null, saveData: async (key, value) => { values.set(key, value) } },
})
const songs = ['a', 'b', 'c'].map(id => ({ id, name: id, meta: {} }))
const state = { playMusicInfo: { musicInfo: null, listId: null, isTempPlay: false }, playInfo: { playerListId: null }, tempPlayList: [], playedList: [], progress: { nowPlayTime: 0 } }
const settings = { setting: { 'player.togglePlayMethod': 'listLoop' } }
const stub = () => {}
const imports = {
  '@/plugins/player': { isInitialized: () => true, setStop: async () => {}, isEmpty: () => true },
  '@/core/player/playInfo': { getList: () => songs, setPlayListId: id => { state.playInfo.playerListId = id }, setPlayMusicInfo: (id, musicInfo, isTempPlay = false) => { state.playMusicInfo = { listId: id, musicInfo, isTempPlay } } },
  '@/store/player/state': { __esModule: true, default: state },
  '@/store/setting/state': { __esModule: true, default: settings },
  '@/core/player/queue': queue,
  '@/core/player/tempPlayList': { clearTempPlayeList: stub },
  '@/core/player/playedList': { clearPlayedList: stub, addPlayedList: stub },
  '@/core/dislikeList': { hasDislike: song => song.id === 'b' },
  '@/utils/tools': { debounceBackgroundTimer: () => stub },
  '@/config/constant': { LIST_IDS: { PLAY_LATER: 'later' } },
  'react-native-background-timer': { clearTimeout: stub },
}
const player = load('src/core/player/player.ts', imports, { global: { lx: { isPlayedStop: false, restorePlayInfo: null }, app_event: { pause: stub } } })
async function main() {
  await player.playList('one', 0)
  assert.equal(state.playMusicInfo.musicInfo.id, 'a')
  assert.equal((await player.getNextPlayMusicInfo()).musicInfo.id, 'c')
  await player.playNext(true)
  assert.equal(state.playMusicInfo.musicInfo.id, 'c')
  await player.playPrev()
  assert.equal(state.playMusicInfo.musicInfo.id, 'a')
  settings.setting['player.togglePlayMethod'] = 'singleLoop'
  await player.playNext(true)
  assert.equal(state.playMusicInfo.musicInfo.id, 'a')
  await player.playNext(false)
  assert.equal(state.playMusicInfo.musicInfo.id, 'c')
  settings.setting['player.togglePlayMethod'] = 'list'
  assert.equal(await player.getNextPlayMusicInfo(), null)
  await player.playNext(true)
  assert.equal(state.playMusicInfo.musicInfo.id, 'c')
  const search = ['x', 'y'].map(id => ({ id, name: id, meta: {} }))
  await player.playQueueList(search, 1)
  assert.equal(state.playMusicInfo.musicInfo.id, 'y')
  assert.equal(state.playMusicInfo.listId, null)
  assert.deepEqual(Array.from(queue.getQueue().items, item => item.musicInfo.id), ['x', 'y'])
  console.log('Player queue integration checks passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
