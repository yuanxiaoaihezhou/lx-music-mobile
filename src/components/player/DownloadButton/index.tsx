import { useRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import DownloadPicker, { type DownloadPickerType } from '@/components/DownloadPicker'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

export default () => {
  const { musicInfo } = usePlayMusicInfo()
  const picker = useRef<DownloadPickerType>(null)
  const theme = useTheme()
  const t = useI18n()
  const music = musicInfo && ('progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo)
  return (
    <>
      <TouchableOpacity style={styles.button} disabled={!music || music.source === 'local'} onPress={() => {
        if (music && music.source !== 'local') picker.current?.show([music])
      }} accessibilityRole="button" accessibilityLabel={t('download_action')}>
        <Icon name="download-2" size={22} color={theme['c-font-label']} />
      </TouchableOpacity>
      <DownloadPicker ref={picker} />
    </>
  )
}
const styles = createStyle({ button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' } })
