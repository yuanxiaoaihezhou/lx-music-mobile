import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'

export interface QueueItem {
  key: string
  listId: string | null
  musicInfo: LX.Player.PlayMusic
}
export interface QueueState {
  items: QueueItem[]
  current: number
  nextCount: number
  originalKeys?: string[]
}

const storageKey = '@play_queue_v1'
const progressKey = '@play_queue_progress_v1'
let state: QueueState = { items: [], current: -1, nextCount: 0 }
let serial = 0
let savePromise = Promise.resolve()
let progressPromise = Promise.resolve()
const listeners = new Set<(value: QueueState) => void>()

const publish = (next: QueueState) => {
  state = next
  for (const listener of listeners) listener(state)
  // Serialize writes because storage.saveData removes the previous value first.
  savePromise = savePromise.catch(() => {}).then(async() => saveData(storageKey, next)).catch(err => { console.log('save play queue failed', err) })
}
const makeItem = (listId: string | null, musicInfo: LX.Player.PlayMusic): QueueItem => ({
  key: `${Date.now()}-${++serial}-${Math.random()}`,
  listId,
  musicInfo,
})
export const getQueue = () => state
export const saveQueueProgress = (time: number, maxTime: number) => {
  const key = state.items[state.current]?.key
  if (!key) return
  progressPromise = progressPromise.catch(() => {}).then(async() => saveData(progressKey, { key, time, maxTime })).catch(err => { console.log('save queue progress failed', err) })
}
export const getQueueProgress = async(key: string) => {
  const progress = await getData<{ key: string, time: number, maxTime: number }>(progressKey)
  return progress?.key === key ? progress : null
}
export const useQueue = () => {
  const [value, setValue] = useState(state)
  useEffect(() => {
    listeners.add(setValue)
    setValue(state)
    return () => { listeners.delete(setValue) }
  }, [])
  return value
}
export const restoreQueue = async() => {
  const saved = await getData<QueueState>(storageKey)
  if (!saved || !Array.isArray(saved.items) || !Number.isInteger(saved.current)) return false
  if (saved.current < -1 || saved.current >= saved.items.length) return false
  if (saved.items.some(item => !item?.key || !item.musicInfo?.id)) return false
  state = { items: saved.items, current: saved.current, nextCount: Math.max(0, Math.min(saved.nextCount || 0, saved.items.length - saved.current - 1)), originalKeys: Array.isArray(saved.originalKeys) ? saved.originalKeys : undefined }
  for (const listener of listeners) listener(state)
  return true
}
export const replaceQueue = (listId: string | null, items: LX.Player.PlayMusic[], current: number) => {
  if (current < 0 || current >= items.length) return
  publish({ items: items.map(item => makeItem(listId, item)), current, nextCount: 0 })
}
export const insertQueue = (items: LX.Player.TempPlayListItem[]) => {
  let { current, nextCount } = state
  const result = [...state.items]
  const originalKeys = state.originalKeys ? [...state.originalKeys] : undefined
  for (const item of items) {
    const entry = makeItem(item.listId, item.musicInfo)
    if (item.isTop) {
      result.splice(current + 1 + nextCount, 0, entry)
      if (originalKeys) {
        const currentKey = state.items[state.current]?.key
        const originalIndex = currentKey ? originalKeys.indexOf(currentKey) : -1
        originalKeys.splice(Math.max(0, originalIndex + 1 + nextCount), 0, entry.key)
      }
      nextCount++
    } else {
      result.push(entry)
      originalKeys?.push(entry.key)
    }
  }
  if (current < 0 && result.length) {
    current = 0
    nextCount = Math.max(0, nextCount - 1)
  }
  publish({ items: result, current, nextCount, originalKeys })
}
export const selectQueue = (index: number) => {
  if (index < 0 || index >= state.items.length) return null
  const skipped = Math.max(0, index - state.current)
  const nextCount = index >= state.current ? Math.max(0, state.nextCount - skipped) : 0
  publish({ ...state, current: index, nextCount })
  return state.items[index]
}
export const moveQueue = (from: number, to: number) => {
  if (from < 0 || from >= state.items.length || to < 0 || to >= state.items.length || from === to) return
  const items = [...state.items]
  const currentKey = items[state.current]?.key
  const [item] = items.splice(from, 1)
  items.splice(to, 0, item)
  publish({ items, current: items.findIndex(entry => entry.key === currentKey), nextCount: 0, originalKeys: state.originalKeys ? items.map(entry => entry.key) : undefined })
}
export const removeQueue = (index: number) => {
  if (index < 0 || index >= state.items.length) return false
  const items = [...state.items]
  items.splice(index, 1)
  const isCurrent = index === state.current
  let current = state.current - (index < state.current ? 1 : 0)
  if (!items.length) current = -1
  else if (isCurrent) current = index < items.length ? index : 0
  const nextCount = isCurrent ? 0 : Math.max(0, state.nextCount - (index > state.current && index <= state.current + state.nextCount ? 1 : 0))
  publish({ items, current, nextCount, originalKeys: state.originalKeys?.filter(key => key !== state.items[index].key) })
  return isCurrent
}
export const clearQueue = () => { publish({ items: [], current: -1, nextCount: 0 }) }
export const shuffleQueue = () => {
  if (state.items.length < 2 || state.current < 0 || state.originalKeys) return
  const current = state.items[state.current]
  const remaining = state.items.filter((_, index) => index !== state.current)
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }
  publish({ items: [current, ...remaining], current: 0, nextCount: 0, originalKeys: state.items.map(item => item.key) })
}
export const restoreQueueOrder = () => {
  if (!state.originalKeys) return
  const currentKey = state.items[state.current]?.key
  const byKey = new Map(state.items.map(item => [item.key, item]))
  const items = state.originalKeys.map(key => byKey.get(key)).filter((item): item is QueueItem => !!item)
  for (const item of state.items) if (!items.includes(item)) items.push(item)
  publish({ items, current: items.findIndex(item => item.key === currentKey), nextCount: 0 })
}
