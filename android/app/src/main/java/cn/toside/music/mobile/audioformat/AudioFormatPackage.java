package cn.toside.music.mobile.audioformat;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;

public class AudioFormatPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.<NativeModule>singletonList(new AudioFormatModule(context));
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
