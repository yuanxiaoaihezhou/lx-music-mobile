package com.guichaguri.trackplayer.service.player;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.Tracks;
import androidx.media3.common.util.UnstableApi;

// Kept beside ExoPlayback's package to read its protected player without reflection.
@UnstableApi
public final class PlaybackFormatReader {
  private PlaybackFormatReader() {}

  public static Format selectedAudioFormat(ExoPlayback<?> playback) {
    for (Tracks.Group group : playback.player.getCurrentTracks().getGroups()) {
      if (group.getType() != C.TRACK_TYPE_AUDIO) continue;
      for (int i = 0; i < group.length; i++) {
        if (group.isTrackSelected(i)) return group.getTrackFormat(i);
      }
    }
    return null;
  }
}
