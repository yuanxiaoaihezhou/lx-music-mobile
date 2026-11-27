import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { addDownloads } from '@/core/download'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'

export interface DownloadPickerType {
  show: (songs: LX.Music.MusicInfoOnline[]) => void
}

const qualities: LX.Quality[] = ['128k', '320k', 'flac', 'flac24bit']
const qualityLabels: Record<string, string> = { '128k': '128 kbps', '320k': '320 kbps', flac: 'FLAC', flac24bit: 'FLAC 24-bit' }

export default forwardRef<DownloadPickerType>((_, ref) => {
  const popup = useRef<PopupType>(null)
  const [songs, setSongs] = useState<LX.Music.MusicInfoOnline[]>([])
  const t = useI18n()
  const theme = useTheme()
  useImperativeHandle(ref, () => ({
    show(items) {
      if (!items.length) return
      setSongs(items)
      popup.current?.setVisible(true)
    },
  }))
  const choose = (quality: LX.Quality) => {
    popup.current?.setVisible(false)
    void addDownloads(songs, quality).then(added => { toast(t(added ? 'download_added' : 'download_exists')) }).catch(() => { toast(t('download_failed')) })
  }
  return (
    <Popup ref={popup} title={t('download_choose_quality')}>
      <View style={styles.list}>
        {qualities.map(quality => (
          <TouchableOpacity key={quality} style={styles.item} onPress={() => { choose(quality) }} accessibilityRole="button">
            <Text size={15} color={theme['c-font']}>{qualityLabels[quality]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Popup>
  )
})

const styles = createStyle({
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
})
