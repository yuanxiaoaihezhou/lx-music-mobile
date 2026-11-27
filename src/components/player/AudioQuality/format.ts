export interface AudioFormat {
  trackId: string | null
  mimeType: string | null
  bitrate: number
  sampleRate: number
  channels: number
}

export const getCodecName = (mimeType: string | null): string | null => {
  switch (mimeType?.toLowerCase()) {
    case 'audio/flac': return 'FLAC'
    case 'audio/alac': return 'ALAC'
    case 'audio/mpeg': return 'MP3'
    case 'audio/mp4a-latm': return 'AAC'
    case 'audio/opus': return 'Opus'
    case 'audio/vorbis': return 'Vorbis'
    case 'audio/raw': return 'PCM'
    default: return null
  }
}

export const getBitrateLabel = (bitrate: number): string | null => {
  if (!Number.isFinite(bitrate) || bitrate < 1000) return null
  return `${Math.round(bitrate / 1000)} kbps`
}

export const isCurrentAudioFormat = (format: AudioFormat | null, currentTrackId: string, musicId: string): boolean => {
  const trackId = format?.trackId
  return !!trackId && trackId === currentTrackId && trackId.startsWith(`${musicId}__//`) && !trackId.endsWith('//default')
}

export const getSampleRateLabel = (sampleRate: number): string | null => {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return null
  return `${Number((sampleRate / 1000).toFixed(1))} kHz`
}

export const isLosslessCodec = (mimeType: string | null): boolean => {
  const mime = mimeType?.toLowerCase()
  return mime === 'audio/flac' || mime === 'audio/alac'
}
