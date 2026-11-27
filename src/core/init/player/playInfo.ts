import { getPlayInfo } from '@/utils/data'
import { getListMusics } from '@/core/list'
import { playList, play, playQueueAt } from '@/core/player/player'
import { getQueue, getQueueProgress, restoreQueue } from '@/core/player/queue'


export default async(setting: LX.AppSetting) => {
  const info = await getPlayInfo()
  global.lx.restorePlayInfo = null
  if (await restoreQueue()) {
    const queue = getQueue()
    const item = queue.items[queue.current]
    if (!item) return
    const progress = await getQueueProgress(item.key)
    const time = progress?.time ?? 0
    const maxTime = progress?.maxTime ?? 0
    global.lx.restorePlayInfo = { time, maxTime, listId: item.listId ?? '', index: 0 }
    await playQueueAt(queue.current)
    if (setting['player.startupAutoPlay']) setTimeout(play)
    return
  }
  if (!info?.listId || info.index < 0) return

  const list = await getListMusics(info.listId)
  if (!list[info.index]) return
  global.lx.restorePlayInfo = info

  await playList(info.listId, info.index)

  if (setting['player.startupAutoPlay']) setTimeout(play)


  // if (!info.list || !info.list[info.index]) {
  //   const info2 = { ...info }
  //   if (info2.list) {
  //     info2.music = info2.list[info2.index]?.name
  //     info2.list = info2.list.length
  //   }
  //   toast('恢复播放数据失败，请去错误日志查看', 'long')
  //   log.warn('Restore Play Info failed: ', JSON.stringify(info2, null, 2))

  //   return
  // }

  // let setting = store.getState().common.setting
  // global.restorePlayInfo = {
  //   info,
  //   startupAutoPlay: setting.startupAutoPlay,
  // }

  // store.dispatch(playerAction.setList({
  //   list: {
  //     list: info.list,
  //     id: info.listId,
  //   },
  //   index: info.index,
  // }))
}
