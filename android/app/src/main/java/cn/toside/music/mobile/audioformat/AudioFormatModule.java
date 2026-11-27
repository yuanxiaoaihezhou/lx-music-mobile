package cn.toside.music.mobile.audioformat;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.media3.common.Format;
import androidx.media3.common.util.UnstableApi;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.guichaguri.trackplayer.service.MusicBinder;
import com.guichaguri.trackplayer.service.MusicService;
import com.guichaguri.trackplayer.service.Utils;
import com.guichaguri.trackplayer.service.models.Track;
import com.guichaguri.trackplayer.service.player.ExoPlayback;
import com.guichaguri.trackplayer.service.player.PlaybackFormatReader;
import java.util.concurrent.atomic.AtomicBoolean;

@UnstableApi
public class AudioFormatModule extends ReactContextBaseJavaModule {
  private final Handler mainHandler = new Handler(Looper.getMainLooper());

  public AudioFormatModule(ReactApplicationContext context) { super(context); }
  @Override public String getName() { return "AudioFormatModule"; }

  @ReactMethod public void getCurrentFormat(Promise promise) {
    mainHandler.post(() -> {
      Context context = getReactApplicationContext();
      AtomicBoolean finished = new AtomicBoolean(false);
      ServiceConnection connection = new ServiceConnection() {
        private void finish(WritableMap result) {
          if (!finished.compareAndSet(false, true)) return;
          try { context.unbindService(this); } catch (IllegalArgumentException ignored) {}
          promise.resolve(result);
        }
        @Override public void onServiceConnected(ComponentName name, IBinder service) {
          if (!(service instanceof MusicBinder)) { finish(null); return; }
          MusicBinder binder = (MusicBinder) service;
          try { binder.post(() -> {
            WritableMap result = null;
            try {
              ExoPlayback<?> playback = binder.getPlayback();
              Track track = playback.getCurrentTrack();
              Format format = PlaybackFormatReader.selectedAudioFormat(playback);
              if (track != null && track.originalItem != null && format != null) {
                result = Arguments.createMap();
                result.putString("trackId", track.originalItem.getString("id"));
                result.putString("mimeType", format.sampleMimeType);
                result.putInt("bitrate", format.averageBitrate > 0 ? format.averageBitrate : format.bitrate);
                result.putInt("sampleRate", format.sampleRate);
                result.putInt("channels", format.channelCount);
              }
            } catch (RuntimeException ignored) {}
            WritableMap value = result;
            mainHandler.post(() -> finish(value));
          }); } catch (RuntimeException error) { finish(null); }
        }
        @Override public void onServiceDisconnected(ComponentName name) { finish(null); }
        @Override public void onBindingDied(ComponentName name) { finish(null); }
        @Override public void onNullBinding(ComponentName name) { finish(null); }
      };
      Intent intent = new Intent(context, MusicService.class);
      intent.setAction(Utils.CONNECT_INTENT);
      try {
        if (!context.bindService(intent, connection, 0)) {
          if (finished.compareAndSet(false, true)) promise.resolve(null);
          return;
        }
        mainHandler.postDelayed(() -> {
          if (!finished.compareAndSet(false, true)) return;
          try { context.unbindService(connection); } catch (IllegalArgumentException ignored) {}
          promise.resolve(null);
        }, 2000);
      } catch (RuntimeException error) {
        if (finished.compareAndSet(false, true)) promise.resolve(null);
      }
    });
  }
}
