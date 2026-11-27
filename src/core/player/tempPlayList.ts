import playerActions from '@/store/player/action'
import playerState from '@/store/player/state'
import { playQueueAt } from './player'
import { getQueue, insertQueue } from './queue'


/**
 * 添加歌曲到稍后播放列表
 * @param list 歌曲列表
 */
export const addTempPlayList = (list: LX.Player.TempPlayListItem[]) => {
  const wasEmpty = !playerState.playMusicInfo.musicInfo
  insertQueue(list)
  if (wasEmpty) void playQueueAt(getQueue().current)
}
/**
 * 从稍后播放列表移除歌曲
 * @param index 歌曲位置
 */
export const removeTempPlayList = (index: number) => {
  playerActions.removeTempPlayList(index)
}
/**
 * 清空稍后播放列表
 */
export const clearTempPlayeList = () => {
  playerActions.clearTempPlayeList()
}
