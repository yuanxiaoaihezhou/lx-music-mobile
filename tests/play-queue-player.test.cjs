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
let selectedUrl = null
let onlineRequests = 0
const imports = {
  '@/plugins/player': { isInitialized: () => true, setStop: async () => {}, isEmpty: () => true, setResource: (_, url) => { selectedUrl = url } },
  '@/core/player/playInfo': { getList: () => songs, setPlayListId: id => { state.playInfo.playerListId = id }, setPlayMusicInfo: (id, musicInfo, isTempPlay = false) => { state.playMusicInfo = { listId: id, musicInfo, isTempPlay } } },
  '@/store/player/state': { __esModule: true, default: state },
  '@/store/setting/state': { __esModule: true, default: settings },
  '@/core/player/queue': queue,
  '@/core/player/tempPlayList': { clearTempPlayeList: stub },
  '@/core/player/playedList': { clearPlayedList: stub, addPlayedList: stub },
  '@/core/dislikeList': { hasDislike: song => song.id === 'b' },
  '@/core/download': { getDownloadedPath: async music => music.id === 'y' ? '/private/y.flac' : null },
  '@/core/music': { getMusicUrl: async () => { onlineRequests++; return 'https://example.test' } },
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
  const before = Array.from(queue.getQueue().items, item => item.musicInfo.id)
  const single = { id: 'new', source: 'kw', name: 'new', meta: {} }
  await player.playSingle(single)
  assert.deepEqual(Array.from(queue.getQueue().items, item => item.musicInfo.id), [...before, 'new'])
  assert.equal(state.playMusicInfo.musicInfo.id, 'new')
  assert.equal(state.playMusicInfo.listId, null)
  await player.playSingle(single)
  assert.equal(queue.getQueue().items.length, before.length + 1)
  await player.playSingle(songs[0], 'one')
  assert.equal(queue.getQueue().items.length, before.length + 1)
  assert.equal(state.playMusicInfo.musicInfo.id, 'a')
  const key = queue.getQueue().items[queue.getQueue().current].key
  await player.playListById('one', 'c')
  assert.equal(queue.getQueue().items[queue.getQueue().current].key, key)
  assert.deepEqual(Array.from(queue.getQueue().items, item => item.musicInfo.id), ['c', 'b', 'c', 'new'])
  assert.equal(state.playMusicInfo.musicInfo.id, 'c')
  const search = ['x', 'y'].map(id => ({ id, name: id, meta: {} }))
  await player.playQueueList(search, 1)
  assert.equal(state.playMusicInfo.musicInfo.id, 'y')
  assert.equal(state.playMusicInfo.listId, null)
  assert.deepEqual(Array.from(queue.getQueue().items, item => item.musicInfo.id), ['x', 'y'])
  settings.setting['player.playQuality'] = '128k'
  player.setMusicUrl(search[1])
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(selectedUrl, '/private/y.flac')
  assert.equal(onlineRequests, 0)
  for (const [file, onlineImport, args] of [
    ['src/screens/SonglistDetail/listAction.ts', '@/core/songlist', ['id', 'kw']],
    ['src/screens/Home/Views/Leaderboard/listAction.ts', '@/core/leaderboard', ['kw__id']],
  ]) {
    let resolveList
    const fullList = new Promise(resolve => { resolveList = resolve })
    let tempList = null
    let played = false
    const action = load(file, {
      [onlineImport]: { getListDetailAll: () => fullList },
      '@/core/list': { setTempList: async (_, list) => { tempList = list } },
      '@/core/player/player': { playList: async () => { played = true } },
      '@/config/constant': { LIST_IDS: { TEMP: 'temp' } },
    })
    const pending = action.handlePlay(...args)
    await Promise.resolve()
    assert.equal(played, false)
    assert.equal(tempList, null)
    resolveList(search)
    await pending
    assert.deepEqual(Array.from(tempList, item => item.id), ['x', 'y'])
    assert.equal(played, true)
  }
  console.log('Player queue integration checks passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
