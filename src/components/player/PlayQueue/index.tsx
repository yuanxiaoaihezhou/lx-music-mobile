import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, PanResponder, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { updateSetting } from '@/core/common'
import { clearPlayQueue, playQueueAt, removeQueueAt } from '@/core/player/player'
import { moveQueue, useQueue, type QueueItem } from '@/core/player/queue'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle } from '@/utils/tools'

const modes = {
  listLoop: { icon: 'list-loop', label: 'play_list_loop' },
  random: { icon: 'list-random', label: 'play_list_random' },
  list: { icon: 'list-order', label: 'play_list_order' },
  singleLoop: { icon: 'single-loop', label: 'play_single_loop' },
  none: { icon: 'single', label: 'play_single' },
} as const

const QueueRow = ({ item, index, current, count }: { item: QueueItem, index: number, current: boolean, count: number }) => {
  const t = useI18n()
  const theme = useTheme()
  const [rowHeight, setRowHeight] = useState(58)
  const [dragging, setDragging] = useState(false)
  const drag = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { setDragging(true) },
    onPanResponderRelease: (_, gesture) => {
      const target = Math.max(0, Math.min(count - 1, index + Math.round(gesture.dy / rowHeight)))
      moveQueue(index, target)
      setDragging(false)
    },
    onPanResponderTerminate: () => { setDragging(false) },
  }), [index, count, rowHeight])
  const music = 'progress' in item.musicInfo ? item.musicInfo.metadata.musicInfo : item.musicInfo
  return (
    <View style={[styles.row, dragging ? { opacity: 0.55 } : null]} onLayout={event => { setRowHeight(event.nativeEvent.layout.height) }}>
      <TouchableOpacity style={styles.song} onPress={() => { void playQueueAt(index) }} accessibilityRole="button" accessibilityLabel={`${music.name}, ${music.singer ?? ''}`}>
        <View style={styles.indicator}>{current ? <Icon name="play" color={theme['c-primary']} size={13} /> : null}</View>
        <View style={styles.songText}>
          <Text size={14} numberOfLines={1} color={current ? theme['c-primary'] : theme['c-font']}>{music.name}</Text>
          <Text size={11} numberOfLines={1} color={theme['c-font-label']} style={styles.singer}>{music.singer || ' '}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => { void removeQueueAt(index) }} accessibilityRole="button" accessibilityLabel={`${t('queue_remove')}: ${music.name}`}>
        <Icon name="close" color={theme['c-font-label']} size={14} />
      </TouchableOpacity>
      <View style={styles.action} {...drag.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`${t('queue_reorder')}: ${music.name}`} accessibilityActions={[{ name: 'increment', label: t('queue_move_down') }, { name: 'decrement', label: t('queue_move_up') }]} onAccessibilityAction={event => {
        const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1
        moveQueue(index, Math.max(0, Math.min(count - 1, index + delta)))
      }}>
        <Icon name="menu" color={theme['c-font-label']} size={17} />
      </View>
    </View>
  )
}

export default ({ compact = false, horizontal = false }: { compact?: boolean, horizontal?: boolean }) => {
  const t = useI18n()
  const theme = useTheme()
  const queue = useQueue()
  const mode = useSettingValue('player.togglePlayMethod')
  const { height } = useWindowDimensions()
  const popupRef = useRef<PopupType>(null)
  const listRef = useRef<FlatList<QueueItem>>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!visible || queue.current < 0) return
    const timer = setTimeout(() => listRef.current?.scrollToIndex({ index: queue.current, animated: false, viewPosition: 0.35 }), 250)
    return () => { clearTimeout(timer) }
  // The list should not jump while the user edits it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])
  const show = useCallback(() => {
    setVisible(true)
    popupRef.current?.setVisible(true)
  }, [])
  const clear = () => {
    void confirmDialog({ title: t('queue_clear_title'), message: t('queue_clear_message') }).then(confirmed => {
      if (confirmed) void clearPlayQueue()
    })
  }
  const toggleMode = () => {
    const next = (MUSIC_TOGGLE_MODE_LIST.indexOf(mode) + 1) % MUSIC_TOGGLE_MODE_LIST.length
    updateSetting({ 'player.togglePlayMethod': MUSIC_TOGGLE_MODE_LIST[next] })
  }
  return (
    <>
      <TouchableOpacity style={compact ? styles.compactButton : styles.button} onPress={show} accessibilityRole="button" accessibilityLabel={t('queue_title')}>
        <Icon name="list-order" color={compact ? theme['c-button-font'] : theme['c-font-label']} size={compact ? 23 : 24} />
      </TouchableOpacity>
      <Popup ref={popupRef} title={`${t('queue_title')} · ${t('queue_count', { count: queue.items.length })}`} position={horizontal ? 'left' : 'bottom'} onHide={() => { setVisible(false) }}>
        <View style={[styles.sheet, { height: horizontal ? height * 0.78 : height * 0.62 }]}>
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.mode} onPress={toggleMode} accessibilityRole="button" accessibilityLabel={t(modes[mode].label)}>
              <Icon name={modes[mode].icon} color={theme['c-font-label']} size={17} />
              <Text size={12} color={theme['c-font-label']} style={styles.modeText}>{t(modes[mode].label)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clear} onPress={clear} disabled={!queue.items.length} accessibilityRole="button" accessibilityLabel={t('queue_clear')}>
              <Icon name="eraser" color={theme['c-font-label']} size={16} />
              <Text size={12} color={theme['c-font-label']} style={styles.modeText}>{t('queue_clear')}</Text>
            </TouchableOpacity>
          </View>
          <FlatList ref={listRef} data={queue.items} keyExtractor={item => item.key} extraData={queue.current}
            renderItem={({ item, index }) => <QueueRow item={item} index={index} current={index === queue.current} count={queue.items.length} />}
            onScrollToIndexFailed={info => { listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false }) }}
            ListEmptyComponent={<View style={styles.empty}><Text size={13} color={theme['c-font-label']}>{t('queue_empty')}</Text></View>} />
        </View>
      </Popup>
    </>
  )
}

const styles = createStyle({
  button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  compactButton: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '100%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  mode: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  modeText: { marginLeft: 7 },
  clear: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 4 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  song: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  indicator: { width: 28, alignItems: 'center' },
  songText: { flex: 1, justifyContent: 'center' },
  singer: { marginTop: 2 },
  action: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
})
