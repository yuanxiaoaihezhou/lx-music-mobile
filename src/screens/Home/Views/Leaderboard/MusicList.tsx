import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { clearListDetail, getListDetail, setListDetail, setListDetailInfo } from '@/core/leaderboard'
import boardState from '@/store/leaderboard/state'
import { handlePlay } from './listAction'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

// export type MusicListProps = Pick<OnlineListProps,
// 'onLoadMore'
// | 'onPlayList'
// | 'onRefresh'
// >

export interface MusicListType {
  loadList: (source: LX.OnlineSource, listId: string) => void
}

export default forwardRef<MusicListType, {}>((props, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const listRef = useRef<OnlineListType>(null)
  const isUnmountedRef = useRef(false)
  useImperativeHandle(ref, () => ({
    async loadList(source, id) {
      const listDetailInfo = boardState.listDetailInfo
      listRef.current?.setList([])
      if (listDetailInfo.id == id && listDetailInfo.source == source && listDetailInfo.list.length) {
        requestAnimationFrame(() => {
          listRef.current?.setList(listDetailInfo.list)
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        setListDetailInfo(id)
        return getListDetail(id, page).then((listDetail) => {
          const result = setListDetail(listDetail, id, page)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            listRef.current?.setList(result.list)
            listRef.current?.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (boardState.listDetailInfo.list.length && page == 1) clearListDetail()
          listRef.current?.setStatus('error')
        })
      }
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const page = 1
    listRef.current?.setStatus('refreshing')
    getListDetail(boardState.listDetailInfo.id, page, true).then((listDetail) => {
      const result = setListDetail(listDetail, boardState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (boardState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    listRef.current?.setStatus('loading')
    const page = boardState.listDetailInfo.list.length ? boardState.listDetailInfo.page + 1 : 1
    getListDetail(boardState.listDetailInfo.id, page).then((listDetail) => {
      const result = setListDetail(listDetail, boardState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list, true)
      listRef.current?.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (boardState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }

  return <View style={{ flex: 1 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('play_all')} onPress={() => { if (boardState.listDetailInfo.id) void handlePlay(boardState.listDetailInfo.id) }} style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10 }}>
      <Text size={12} color={theme['c-primary']}>{t('play_all')}</Text>
    </TouchableOpacity>
    <OnlineList
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
    checkHomePagerIdle
    rowType='medium'
   />
  </View>
})

