const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const values = new Map()
const storage = {
  getData: async key => values.get(key) ?? null,
  saveData: async (key, value) => { values.set(key, JSON.parse(JSON.stringify(value))) },
}
function loadQueue() {
  const source = fs.readFileSync('src/core/player/queue.ts', 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react') return {}
    if (name === '@/plugins/storage') return storage
    throw new Error(`Unexpected import: ${name}`)
  }, console, Date, Math, Promise, Set })
  return exports
}
const song = id => ({ id, name: id })
const names = queue => Array.from(queue.getQueue().items, item => item.musicInfo.id)
async function main() {
  const queue = loadQueue()
  queue.replaceQueue('one', [song('a'), song('b'), song('c')], 1)
  assert.deepEqual(names(queue), ['a', 'b', 'c'])
  queue.insertQueue([{ listId: 'two', musicInfo: song('x'), isTop: true }])
  queue.insertQueue([{ listId: 'two', musicInfo: song('y'), isTop: true }, { listId: 'two', musicInfo: song('b') }])
  assert.deepEqual(names(queue), ['a', 'b', 'x', 'y', 'c', 'b'])
  assert.notEqual(queue.getQueue().items[1].key, queue.getQueue().items[5].key)
  queue.selectQueue(2)
  queue.moveQueue(5, 0)
  assert.equal(queue.getQueue().items[queue.getQueue().current].musicInfo.id, 'x')
  assert.equal(queue.removeQueue(0), false)
  assert.equal(queue.removeQueue(queue.getQueue().current), true)
  assert.equal(queue.getQueue().items[queue.getQueue().current].musicInfo.id, 'y')
  queue.saveQueueProgress(42, 180)
  await new Promise(resolve => setTimeout(resolve, 30))
  const restored = loadQueue()
  assert.equal(await restored.restoreQueue(), true)
  assert.deepEqual(names(restored), names(queue))
  assert.equal((await restored.getQueueProgress(restored.getQueue().items[restored.getQueue().current].key)).time, 42)
  const originalOrder = names(restored)
  restored.shuffleQueue()
  assert.equal(restored.getQueue().items[0].musicInfo.id, 'y')
  assert.equal(restored.getQueue().current, 0)
  restored.restoreQueueOrder()
  assert.deepEqual(names(restored), originalOrder)
  assert.equal(restored.getQueue().items[restored.getQueue().current].musicInfo.id, 'y')
  restored.clearQueue()
  assert.equal(restored.getQueue().current, -1)
  assert.equal(restored.getQueue().items.length, 0)
  restored.insertQueue([{ listId: null, musicInfo: song('first'), isTop: true }, { listId: null, musicInfo: song('second'), isTop: true }])
  restored.selectQueue(0)
  restored.insertQueue([{ listId: null, musicInfo: song('third'), isTop: true }])
  assert.deepEqual(names(restored), ['first', 'second', 'third'])
  restored.removeQueue(1)
  restored.insertQueue([{ listId: null, musicInfo: song('fourth'), isTop: true }])
  assert.deepEqual(names(restored), ['first', 'third', 'fourth'])
  console.log('Play queue checks passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
