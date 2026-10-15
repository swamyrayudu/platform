// Open a downloaded Resource PDF inside the app. Only the copy saved in the
// app's private storage (services/pdf-downloads.ts) is opened, so it works
// without internet; nothing is fetched here. Screenshots and screen recording
// are blocked while this screen is open (and Android shows it blank in
// recent apps).
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';
import { AlertDialog } from '@/components/alert-dialog';
import { downloadedFile, pdfDownloads } from '@/services/pdf-downloads';
import { base64Chunks, pdfViewerHtml } from '@/utils/pdf-viewer-html';

type Params = {id: string; title?: string};
// A fixed origin for the viewer page, so Android allows pdf.js its background
// worker (from a blob). Nothing is loaded from it: the page and pdf.js are in the app.
const VIEWER_ORIGIN = 'https://rsdeducation.vercel.app/pdf-viewer';

export default function PdfScreen() {
  usePreventScreenCapture();
  const {id, title = 'Resource'} = useLocalSearchParams<Params>();
  const cache = useQueryClient();
  const web = useRef<WebView>(null);
  const [data, setData] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const sent = useRef(false);

  // The saved copy, read from the phone.
  useEffect(() => {
    let live = true;
    (async () => {
      const file = downloadedFile(id);
      if (!file.exists) throw new Error('missing');
      return file.base64();
    })().then(base64 => { if (live) setData(base64); },
      () => { if (live) setError('This PDF is not downloaded on this phone. Go back and tap Download first.'); });
    return () => { live = false; };
  }, [id]);

  // Hand the file to the viewer once both are ready.
  useEffect(() => {
    if (!data || !viewerReady || sent.current) return;
    sent.current = true;
    for (const chunk of base64Chunks(data)) web.current?.injectJavaScript(`window.__add(${JSON.stringify(chunk)});true;`);
    web.current?.injectJavaScript('window.__open();true;');
  }, [data, viewerReady]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {type: string; count?: number; page?: number; message?: string};
      if (message.type === 'ready') setViewerReady(true);
      if (message.type === 'pages' && message.count) setPages(message.count);
      if (message.type === 'page' && message.page) setPage(message.page);
      if (message.type === 'error') setError(message.message ?? 'This file could not be opened.');
    } catch { /* not ours */ }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/resources'));
  const remove = async () => {
    await pdfDownloads.remove(id);
    setConfirmRemove(false);
    void cache.invalidateQueries({queryKey: ['pdf-downloads']});
    close();
  };

  const loading = !error && pages === 0;
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.barButton}>
        <Ionicons name="arrow-back" size={22} color="#fff"/>
      </Pressable>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.sub}>{pages ? `Page ${page} of ${pages} · Saved in app` : 'Opening…'}</Text>
      </View>
      {!error ? <Pressable accessibilityRole="button" accessibilityLabel="Delete the downloaded copy from this phone" onPress={() => setConfirmRemove(true)} style={styles.barButton}>
        <Ionicons name="trash-outline" size={20} color="#D4D4D8"/>
      </Pressable> : null}
    </View>
    <View style={{flex: 1}}>
      <WebView ref={web} originWhitelist={['*']} source={{html: pdfViewerHtml(), baseUrl: VIEWER_ORIGIN}} onMessage={onMessage}
        javaScriptEnabled setSupportMultipleWindows={false} allowFileAccess={false} allowsLinkPreview={false} textInteractionEnabled={false}
        setBuiltInZoomControls setDisplayZoomControls={false} overScrollMode="never" style={styles.web}
        onShouldStartLoadWithRequest={request => request.url === VIEWER_ORIGIN || request.url === 'about:blank' || request.url.startsWith('blob:')}/>
      {loading ? <View style={styles.overlay}><ActivityIndicator color="#fff" size="large"/><Text style={styles.overlayText}>Opening the PDF…</Text></View> : null}
      {error ? <View style={styles.overlay}><Ionicons name="alert-circle-outline" size={34} color="#FCA5A5"/><Text style={styles.overlayText}>{error}</Text></View> : null}
    </View>
    {confirmRemove ? <AlertDialog icon="trash-outline" title="Delete the download?" description="The PDF is removed from this phone. Download it again to read it."
      cancelLabel="Keep" confirmLabel="Delete" onCancel={() => setConfirmRemove(false)} onConfirm={() => void remove()}/> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#18181B'},
  bar: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#18181B', borderBottomWidth: 1, borderBottomColor: '#27272A'},
  barButton: {width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 15, fontWeight: '700', color: '#fff'}, sub: {fontSize: 11, color: '#A1A1AA'},
  web: {flex: 1, backgroundColor: '#3f3f46'},
  overlay: {...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#3f3f46'},
  overlayText: {fontSize: 14, lineHeight: 21, color: '#E4E4E7', textAlign: 'center'},
});
