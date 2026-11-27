import { useEffect, useState } from 'react'
import RNFS from 'react-native-fs'
import { getData, saveData } from '@/plugins/storage'
import { getMusicUrl as getOnlineMusicUrl } from '@/core/music/online'
import { privateStorageDirectoryPath } from '@/utils/fs'

export type DownloadStatus = 'waiting' | 'running' | 'paused' | 'failed' | 'completed'
export interface DownloadTask {
  id: string
  music: LX.Music.MusicInfoOnline
  quality: LX.Quality
  status: DownloadStatus
  received: number
  total: number
  path: string | null
  createdAt: number
  refreshUrl?: boolean
}

const storageKey = '@downloads_v1'
const directory = `${privateStorageDirectoryPath}/downloads`
let tasks: DownloadTask[] = []
let initialization: Promise<void> | null = null
let writes = Promise.resolve()
let runNumber = 0
let active: { id: string, token: number, jobId: number | null, cancelled: boolean, done: Promise<void> | null } | null = null
const listeners = new Set<(list: DownloadTask[]) => void>()
const deleting = new Set<string>()
export const getDownloads = () => tasks

const save = () => {
  const snapshot = tasks.map(task => ({ ...task }))
  writes = writes.catch(() => {}).then(async() => saveData(storageKey, snapshot)).catch(error => { console.log('save downloads failed', error) })
}
const notify = (persist = true) => {
  for (const listener of listeners) listener(tasks)
  if (persist) save()
}
const update = (id: string, changes: Partial<DownloadTask>, persist = true) => {
  tasks = tasks.map(task => task.id === id ? { ...task, ...changes } : task)
  notify(persist)
}
export const initDownloads = async() => {
  if (!initialization) {
    initialization = (async() => {
      const stored = await getData<DownloadTask[]>(storageKey)
      tasks = Array.isArray(stored) ? stored.filter(task => /^\d+-\d+-\d+$/.test(task?.id) && !!task.music?.id).map(task => ({
        ...task,
        status: task.status === 'running' || task.status === 'waiting' ? 'paused' : task.status,
        received: task.status === 'running' || task.status === 'waiting' ? 0 : task.received,
        total: task.status === 'running' || task.status === 'waiting' ? 0 : task.total,
      })) : []
      notify()
    })().catch(error => {
      initialization = null
      throw error
    })
  }
  return initialization
}
export const useDownloads = () => {
  const [value, setValue] = useState(tasks)
  useEffect(() => {
    let mounted = true
    listeners.add(setValue)
    void initDownloads().then(() => { if (mounted) setValue(tasks) }).catch(() => {})
    return () => { mounted = false; listeners.delete(setValue) }
  }, [])
  return value
}

// Identify the downloaded bytes rather than trusting the requested quality or URL suffix.
export const detectAudioExtension = (bytes: Uint8Array): string | null => {
  const starts = (...expected: number[]) => expected.every((value, index) => bytes[index] === value)
  if (starts(0x66, 0x4c, 0x61, 0x43)) return 'flac'
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'aac'
  if (starts(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'mp3'
  if (starts(0x4f, 0x67, 0x67, 0x53)) return 'ogg'
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return 'wav'
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'm4a'
  if (starts(0x4d, 0x41, 0x43, 0x20)) return 'ape'
  return null
}

export const getDownloadedPath = async(music: LX.Player.PlayMusic): Promise<string | null> => {
  await initDownloads()
  const original = 'progress' in music ? music.metadata.musicInfo : music
  const found = tasks.find(task => task.music.id === original.id && task.music.source === original.source && task.status === 'completed' && task.path)
  if (!found?.path) return null
  try {
    const info = await RNFS.stat(found.path)
    if (Number(info.size) > 0 && (!found.total || Number(info.size) === found.total)) {
      const head = await RNFS.read(found.path, 16, 0, 'base64')
      if (detectAudioExtension(Buffer.from(head, 'base64'))) return found.path
    }
  } catch {}
  update(found.id, { status: 'failed', received: 0, total: 0 })
  return null
}

const removeFile = async(path: string) => {
  try { if (await RNFS.exists(path)) await RNFS.unlink(path) } catch (error) { console.log('remove download failed', error) }
}
const pump = () => {
  if (active) return
  const task = [...tasks].reverse().find(item => item.status === 'waiting' && !deleting.has(item.id))
  if (!task) return
  const work = { id: task.id, token: ++runNumber, jobId: null as number | null, cancelled: false, done: null as Promise<void> | null }
  active = work
  work.done = (async() => {
    const partial = `${directory}/${task.id}.part`
    let finalPath: string | null = null
    let success = false
    try {
      update(task.id, { status: 'running', received: 0, total: 0 })
      await RNFS.mkdir(directory)
      const url = await getOnlineMusicUrl({ musicInfo: task.music, quality: task.quality, isRefresh: !!task.refreshUrl })
      if (work.cancelled) return
      if (!/^https?:\/\//i.test(url)) throw new Error('Invalid download URL')
      await removeFile(partial)
      let lastSaved = 0
      let expectedBytes = 0
      const job = RNFS.downloadFile({
        fromUrl: url,
        toFile: partial,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36' },
        progressInterval: 500,
        connectionTimeout: 20000,
        readTimeout: 30000,
        begin: ({ contentLength }) => { expectedBytes = Math.max(0, contentLength) },
        progress: ({ bytesWritten, contentLength }) => {
          if (work.cancelled) return
          const now = Date.now()
          const persist = now - lastSaved >= 3000
          if (persist) lastSaved = now
          update(task.id, { received: bytesWritten, total: Math.max(0, contentLength) }, persist)
        },
      })
      work.jobId = job.jobId
      if (work.cancelled) RNFS.stopDownload(job.jobId)
      const result = await job.promise
      if (work.cancelled) return
      if (result.statusCode !== 200 || result.bytesWritten <= 0 || (expectedBytes > 0 && result.bytesWritten !== expectedBytes)) throw new Error('Download failed')
      const head = await RNFS.read(partial, 16, 0, 'base64')
      const ext = detectAudioExtension(Buffer.from(head, 'base64'))
      if (!ext) throw new Error('Unsupported audio file')
      finalPath = `${directory}/${task.id}-${Date.now()}-${Math.floor(Math.random() * 1000000)}.${ext}`
      if (work.cancelled) return
      await RNFS.moveFile(partial, finalPath)
      if (work.cancelled) return
      update(task.id, { status: 'completed', path: finalPath, received: result.bytesWritten, total: result.bytesWritten })
      success = true
      if (task.path && task.path !== finalPath && task.path.startsWith(`${directory}/`) && !task.path.includes('..')) await removeFile(task.path)
    } catch (error) {
      if (!work.cancelled) {
        console.log('download failed')
        update(task.id, { status: 'failed' })
      }
    } finally {
      await removeFile(partial)
      if (!success && finalPath) await removeFile(finalPath)
      if (active?.token === work.token) active = null
      pump()
    }
  })()
}
export const addDownloads = async(musics: LX.Music.MusicInfoOnline[], quality: LX.Quality) => {
  await initDownloads()
  let added = 0
  for (const music of musics) {
    if (tasks.some(task => task.music.id === music.id && task.music.source === music.source && (task.status !== 'failed' || deleting.has(task.id)))) continue
    const previous = tasks.find(task => task.music.id === music.id && task.music.source === music.source && task.status === 'failed')
    if (previous) {
      update(previous.id, { status: 'waiting', quality, music, received: 0, total: 0, refreshUrl: true })
    } else {
      const id = `${Date.now()}-${++runNumber}-${Math.floor(Math.random() * 1000000)}`
      tasks = [{ id, music, quality, status: 'waiting', received: 0, total: 0, path: null, createdAt: Date.now() }, ...tasks]
      notify()
    }
    added++
  }
  pump()
  return added
}
export const pauseDownload = (id: string) => {
  const task = tasks.find(item => item.id === id)
  if (!task || (task.status !== 'waiting' && task.status !== 'running')) return
  update(id, { status: 'paused', received: 0, total: 0 })
  if (active?.id === id) {
    active.cancelled = true
    if (active.jobId != null) {
      try { RNFS.stopDownload(active.jobId) } catch {}
    }
  }
}
export const resumeDownload = (id: string) => {
  const task = tasks.find(item => item.id === id)
  if (!task || deleting.has(id) || (task.status !== 'paused' && task.status !== 'failed')) return
  update(id, { status: 'waiting', received: 0, total: 0, refreshUrl: task.status === 'failed' || task.refreshUrl })
  pump()
}
export const deleteDownload = async(id: string) => {
  const task = tasks.find(item => item.id === id)
  if (!task || deleting.has(id)) return
  deleting.add(id)
  try {
    if (active?.id === id) {
      const running = active
      pauseDownload(id)
      if (running.done) await running.done
    }
    if (task.path) {
      // Only delete files created under our private download directory.
      if (!task.path.startsWith(`${directory}/`) || task.path.includes('..')) throw new Error('Invalid download path')
      if (await RNFS.exists(task.path)) await RNFS.unlink(task.path)
    }
    const partial = `${directory}/${id}.part`
    if (await RNFS.exists(partial)) await RNFS.unlink(partial)
    tasks = tasks.filter(item => item.id !== id)
    notify()
  } finally {
    deleting.delete(id)
    pump()
  }
}
