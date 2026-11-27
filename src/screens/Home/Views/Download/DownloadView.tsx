import { FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { deleteDownload, pauseDownload, resumeDownload, useDownloads, type DownloadTask } from '@/core/download'
import { playQueueList } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, toast } from '@/utils/tools'

const statusKeys = {
  waiting: 'download_waiting',
  running: 'download_running',
  paused: 'download_paused',
  failed: 'download_failed',
  completed: 'download_completed',
} as const

const formatSize = (bytes: number) => {
  if (bytes <= 0) return ''
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export default () => {
  const tasks = useDownloads()
  const theme = useTheme()
  const t = useI18n()
  const play = (task: DownloadTask) => {
    const completed = tasks.filter(item => item.status === 'completed')
    const index = completed.findIndex(item => item.id === task.id)
    if (index >= 0) void playQueueList(completed.map(item => item.music), index)
  }
  const remove = (task: DownloadTask) => {
    void confirmDialog({ title: t('download_delete_title'), message: task.path ? t('download_delete_message') : '', cancelButtonText: t('cancel'), confirmButtonText: t('download_delete') }).then(async confirmed => {
      if (!confirmed) return
      try { await deleteDownload(task.id) } catch { toast(t('download_failed')) }
    })
  }
  const renderItem = ({ item }: { item: DownloadTask }) => {
    const progress = item.total > 0 ? `${Math.min(100, Math.floor(item.received / item.total * 100))}%` : formatSize(item.received)
    const detail = [t(statusKeys[item.status]), item.status === 'completed' ? formatSize(item.received) : progress].filter(Boolean).join(' · ')
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.song} disabled={item.status !== 'completed'} onPress={() => { play(item) }} accessibilityRole="button">
          <Text size={14} numberOfLines={1}>{item.music.name}</Text>
          <Text size={11} color={theme['c-font-label']} numberOfLines={1} style={styles.subtitle}>{[item.music.singer, detail].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
        {item.status === 'running' || item.status === 'waiting' ? (
          <TouchableOpacity style={styles.action} onPress={() => { pauseDownload(item.id) }} accessibilityRole="button" accessibilityLabel={t('download_pause')}>
            <Text size={12} color={theme['c-font-label']}>{t('download_pause')}</Text>
          </TouchableOpacity>
        ) : item.status === 'paused' || item.status === 'failed' ? (
          <TouchableOpacity style={styles.action} onPress={() => { resumeDownload(item.id) }} accessibilityRole="button" accessibilityLabel={t(item.status === 'failed' ? 'download_retry' : 'download_resume')}>
            <Text size={12} color={theme['c-primary']}>{t(item.status === 'failed' ? 'download_retry' : 'download_resume')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.action} onPress={() => { remove(item) }} accessibilityRole="button" accessibilityLabel={t('download_delete')}>
          <Icon name="close" size={15} color={theme['c-font-label']} />
        </TouchableOpacity>
      </View>
    )
  }
  return (
    <View style={styles.container}>
      <FlatList data={tasks} keyExtractor={item => item.id} renderItem={renderItem}
        ListEmptyComponent={<View style={styles.empty}><Text size={13} color={theme['c-font-label']}>{t('download_empty')}</Text></View>} />
    </View>
  )
}

const styles = createStyle({
  container: { flex: 1 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  song: { flex: 1, minHeight: 62, justifyContent: 'center' },
  subtitle: { marginTop: 4 },
  action: { minWidth: 44, height: 48, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 90 },
})
