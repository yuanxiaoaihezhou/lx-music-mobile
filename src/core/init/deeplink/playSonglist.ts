import { LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetailAll } from '@/core/songlist'

const getListPlayIndex = (list: LX.Music.MusicInfoOnline[], index?: number) => {
  if (index == null) {
    index = 1
  } else {
    if (index < 1) index = 1
    else if (index > list.length) index = list.length
  }
  return index - 1
}

const playSongListDetail = async(source: LX.OnlineSource, link: string, playIndex?: number) => {
  // console.log(source, link, playIndex)
  if (link == null) return
  const id = decodeURIComponent(link)
  const list = await getListDetailAll(source, id)
  if (!list.length) return
  await setTempList(source + '__' + id, list)
  await playList(LIST_IDS.TEMP, getListPlayIndex(list, playIndex))
}
export const playSonglist = async(source: LX.OnlineSource, link: string, playIndex?: number) => {
  try {
    await playSongListDetail(source, link, playIndex)
  } catch (err) {
    console.error(err)
    throw new Error('Get play list failed.')
  }
}
