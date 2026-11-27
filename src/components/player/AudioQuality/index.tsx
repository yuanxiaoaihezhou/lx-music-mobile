import { useEffect, useState } from 'react'
import { NativeModules, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, tipDialog } from '@/utils/tools'
import { getBitrateLabel, getCodecName, getSampleRateLabel, isCurrentAudioFormat, isLosslessCodec, type AudioFormat } from './format'

const nativeFormat = NativeModules.AudioFormatModule as { getCurrentFormat: () => Promise<AudioFormat | null> } | undefined

export default () => {
  const { id } = usePlayerMusicInfo()
  const theme = useTheme()
  const t = useI18n()
  const [format, setFormat] = useState<AudioFormat | null>(null)

  useEffect(() => {
    let active = true
    setFormat(null)
    if (!id || !nativeFormat) return
    const update = () => {
      void nativeFormat.getCurrentFormat().then(value => {
        if (!active) return
        if (!isCurrentAudioFormat(value, global.lx.playerTrackId, id)) {
          setFormat(null)
          return
        }
        setFormat(value)
      }).catch(() => { if (active) setFormat(null) })
    }
    update()
    const timer = setInterval(update, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [id])

  if (!id) return null
  const codec = getCodecName(format?.mimeType ?? null)
  const bitrate = getBitrateLabel(format?.bitrate ?? 0)
  const sampleRate = getSampleRateLabel(format?.sampleRate ?? 0)
  const label = isLosslessCodec(format?.mimeType ?? null) ? t('audio_quality_lossless') : bitrate ?? codec ?? t('audio_quality_unknown')
  const showDetails = () => {
    const lines = [
      `${t('audio_quality_codec')}: ${codec ?? t('audio_quality_unknown_value')}`,
      `${t('audio_quality_bitrate')}: ${bitrate ?? t('audio_quality_unknown_value')}`,
      `${t('audio_quality_sample_rate')}: ${sampleRate ?? t('audio_quality_unknown_value')}`,
    ]
    if (format && format.channels > 0) lines.push(`${t('audio_quality_channels')}: ${format.channels}`)
    void tipDialog({ title: t('audio_quality_title'), message: lines.join('\n') })
  }
  return (
    <TouchableOpacity style={[styles.badge, { borderColor: theme['c-font-label'] }]} onPress={showDetails} accessibilityRole="button" accessibilityLabel={`${t('audio_quality_title')}: ${label}`}>
      <Text size={10} color={theme['c-font-label']} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = createStyle({
  badge: { borderWidth: 0.7, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 6, maxWidth: 100 },
})
