const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const values = new Map()
const files = new Map()
const jobs = []
const requests = []
const refreshes = []
const storage = {
  getData: async key => values.get(key) ?? null,
  saveData: async (key, value) => { values.set(key, JSON.parse(JSON.stringify(value))) },
}
const RNFS = {
  mkdir: async () => {},
  exists: async path => files.has(path),
  unlink: async path => { files.delete(path) },
  stat: async path => { if (!files.has(path)) throw new Error('missing'); return { size: files.get(path).length } },
  read: async (path, length, position) => files.get(path).subarray(position, position + length).toString('base64'),
  moveFile: async (from, to) => { files.set(to, files.get(from)); files.delete(from) },
  downloadFile: options => {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    const jobId = jobs.length + 1
    jobs.push({ options, resolve, reject, jobId })
    return { jobId, promise }
  },
  stopDownload: id => { jobs.find(job => job.jobId === id).reject(new Error('stopped')) },
}
const source = fs.readFileSync('src/core/download/index.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
const api = {}
vm.runInNewContext(code, { exports: api, require: name => {
  if (name === 'react') return {}
  if (name === 'react-native-fs') return RNFS
  if (name === '@/plugins/storage') return storage
  if (name === '@/utils/fs') return { privateStorageDirectoryPath: '/data/app' }
  if (name === '@/core/music/online') return { getMusicUrl: async ({ musicInfo, quality, isRefresh }) => { requests.push([musicInfo.id, quality]); refreshes.push(isRefresh); return 'https://example.test/audio' } }
  throw new Error(`Unexpected module: ${name}`)
}, Buffer, console, Date, Math, Promise, Set, Uint8Array })
const tick = () => new Promise(resolve => setTimeout(resolve, 15))
const music = id => ({ id, name: id, source: 'wy', meta: {} })
async function main() {
  assert.equal(api.detectAudioExtension(Buffer.from('fLaC')), 'flac')
  assert.equal(api.detectAudioExtension(Buffer.from('ID3hello')), 'mp3')
  assert.equal(api.detectAudioExtension(Buffer.from([0xff, 0xf1])), 'aac')
  assert.equal(api.detectAudioExtension(Buffer.from('<html>')), null)
  assert.equal(await api.addDownloads([music('a')], '128k'), 1)
  await tick()
  assert.deepEqual(requests, [['a', '128k']])
  const first = jobs[0]
  files.set(first.options.toFile, Buffer.from('fLaCdata'))
  first.options.begin({ contentLength: 8 })
  first.resolve({ statusCode: 200, bytesWritten: 8 })
  await tick()
  assert.equal(api.getDownloads()[0].status, 'completed')
  const path = await api.getDownloadedPath(music('a'))
  assert.ok(path.endsWith('.flac'))
  const savedTask = api.getDownloads()[0]
  savedTask.path = '/outside/foreign.flac'
  files.set(savedTask.path, Buffer.from('fLaCdata'))
  assert.equal(await api.getDownloadedPath(music('a')), null)
  savedTask.path = path
  assert.equal(await api.addDownloads([music('a')], 'flac24bit'), 0)
  assert.equal(await api.getDownloadedPath(music('different')), null)
  assert.equal(await api.getDownloadedPath({ ...music('a'), source: 'kw' }), null)
  assert.equal(await api.addDownloads([music('b')], '320k'), 1)
  await tick()
  const second = jobs[1]
  files.set(second.options.toFile, Buffer.from('<html>'))
  second.resolve({ statusCode: 200, bytesWritten: 6 })
  await tick()
  assert.equal(api.getDownloads().find(task => task.music.id === 'b').status, 'failed')
  const b = api.getDownloads().find(task => task.music.id === 'b')
  api.resumeDownload(b.id)
  await tick()
  assert.equal(refreshes[2], true)
  api.pauseDownload(b.id)
  await tick()
  assert.equal(api.getDownloads().find(task => task.id === b.id).status, 'paused')
  api.resumeDownload(b.id)
  await tick()
  const retry = jobs[3]
  files.set(retry.options.toFile, Buffer.from('ID3audio'))
  retry.resolve({ statusCode: 200, bytesWritten: 8 })
  await tick()
  assert.equal(api.getDownloads().find(task => task.id === b.id).status, 'completed')
  await api.deleteDownload(b.id)
  assert.equal(api.getDownloads().some(task => task.id === b.id), false)
  assert.equal(await api.getDownloadedPath(music('a')), path)
  files.delete(path)
  assert.equal(await api.getDownloadedPath(music('a')), null)
  assert.equal(api.getDownloads().find(task => task.music.id === 'a').status, 'failed')
  await api.addDownloads([music('c')], '128k')
  await tick()
  const c = api.getDownloads().find(task => task.music.id === 'c')
  const active = jobs[jobs.length - 1]
  files.set(active.options.toFile, Buffer.from('partial'))
  await api.deleteDownload(c.id)
  assert.equal(api.getDownloads().some(task => task.id === c.id), false)
  assert.equal(files.has(active.options.toFile), false)
  console.log('Download checks passed')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
