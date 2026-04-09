import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { MatchTruthSnapshot } from '@/types/matchTruth';

export function getMatchPitchUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PITCH_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5174';
    }
    return 'http://localhost:5174';
  }
  return 'https://example.invalid';
}

function buildInjectSnapshotScript(snap: MatchTruthSnapshot): string {
  const embedded = JSON.stringify(snap);
  return `(function(){ try { var p = ${embedded}; if (window.__RN_MATCH_PITCH) window.__RN_MATCH_PITCH(p); } catch (e) {} true; })();`;
}

export type MatchPitchWebViewHandle = {
  injectSnapshot: (snap: MatchTruthSnapshot) => void;
};

type Props = {
  onMessageFromWeb?: (raw: string) => void;
};

export const MatchPitchWebView = forwardRef<MatchPitchWebViewHandle, Props>(
  function MatchPitchWebView({ onMessageFromWeb }, ref) {
    const webRef = useRef<WebView>(null);

    const injectSnapshot = useCallback((snap: MatchTruthSnapshot) => {
      webRef.current?.injectJavaScript(buildInjectSnapshotScript(snap));
    }, []);

    useImperativeHandle(ref, () => ({ injectSnapshot }), [injectSnapshot]);

    const uri = getMatchPitchUrl();

    const onMessage = useCallback(
      (e: WebViewMessageEvent) => {
        onMessageFromWeb?.(e.nativeEvent.data);
      },
      [onMessageFromWeb],
    );

    return (
      <View style={styles.wrap}>
        <WebView
          ref={webRef}
          source={{ uri }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsInlineMediaPlayback
          onMessage={onMessage}
          onError={(ev) => {
            console.warn('WebView error', ev.nativeEvent);
          }}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0a0c10' },
  web: { flex: 1, backgroundColor: '#0a0c10' },
});
