import Ionicons from '@expo/vector-icons/Ionicons';
import React, { memo, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { SmoothScrollView as ScrollView } from '../components/smoothHorizontalScroll';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../i18n/LocalizedPrimitives';
import { useResponsiveLayout } from '../useResponsiveLayout';
import type { HelpConfig, HelpFaq, HelpTopic } from './helpConfig';
import { searchHelpFaqs } from './helpLogic';

const BURGUNDY = '#9E1734';
const INK = '#181412';
let helpOffset = 0;

const primaryTopics: Pick<HelpTopic, 'id' | 'title' | 'description' | 'icon'>[] = [
  { id: 'track', title: 'Track my order', description: 'View live status and delivery updates', icon: 'cube-outline' },
  { id: 'orders', title: 'Orders', description: 'Manage or understand an order', icon: 'receipt-outline' },
  { id: 'delivery', title: 'Delivery & returns', description: 'Delivery times, exchanges and returns', icon: 'swap-horizontal-outline' },
  { id: 'payments', title: 'Payments', description: 'Payment methods and pay-on-delivery help', icon: 'card-outline' },
  { id: 'contact', title: 'Contact support', description: 'Speak with the IPORDISE team', icon: 'chatbubble-ellipses-outline' },
];

const TopicRow = memo(function TopicRow({
  item,
  onPress,
}: {
  item: Pick<HelpTopic, 'id' | 'title' | 'description' | 'icon'>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.topicRow, pressed && styles.rowPressed]}
    >
      <Ionicons name={item.icon as any} size={20} color="#514B47" />
      <View style={styles.topicCopy}>
        <Text style={styles.topicTitle}>{item.title}</Text>
        <Text style={styles.topicDescription}>{item.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#928A84" />
    </Pressable>
  );
});

function FaqRow({ item, open, onToggle }: { item: HelpFaq; open: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={item.question}
      onPress={onToggle}
      style={({ pressed }) => [styles.faqRow, pressed && styles.rowPressed]}
    >
      <View style={styles.faqHeading}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={17} color="#756D68" />
      </View>
      {open ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
    </Pressable>
  );
}

export function HelpCenter({
  config,
  onNavigate,
  onShop: _onShop,
  bottomInset,
}: {
  config: HelpConfig;
  onNavigate: (value: HelpTopic['id']) => void;
  onShop: (filter: string) => void;
  bottomInset: number;
}) {
  const layout = useResponsiveLayout();
  const scrollRef = useRef<any>(null);
  const restoredOffset = useRef(false);
  const faqY = useRef(0);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('');
  const faqs = useMemo(() => searchHelpFaqs(config.faqs, query), [config.faqs, query]);

  const openTopic = (item: (typeof primaryTopics)[number]) => {
    if (item.id === 'payments') {
      setQuery('payment');
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, faqY.current - 16), animated: true }));
      return;
    }
    onNavigate(item.id);
  };

  return (
    <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: layout.shellWidth,
            paddingHorizontal: Math.max(20, layout.gutter),
            paddingBottom: bottomInset + 32,
          },
        ]}
        onScroll={event => { helpOffset = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={80}
        onContentSizeChange={() => {
          if (restoredOffset.current) return;
          restoredOffset.current = true;
          scrollRef.current?.scrollTo({ y: helpOffset, animated: false });
        }}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CUSTOMER CARE</Text>
          <Text accessibilityRole="header" style={styles.title}>How can we help?</Text>
        </View>

        <View accessibilityLabel="Customer care topics" style={styles.directory}>
          {primaryTopics.map(item => (
            <TopicRow key={item.id} item={item} onPress={() => openTopic(item)} />
          ))}
        </View>

        <View onLayout={event => { faqY.current = event.nativeEvent.layout.y; }} style={styles.faqSection}>
          <Text style={styles.eyebrow}>FAQ</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Frequently asked questions</Text>
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color="#756D68" />
            <TextInput
              accessibilityRole="search"
              accessibilityLabel="Search frequently asked questions"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={Keyboard.dismiss}
              returnKeyType="search"
              placeholder="Search customer care"
              placeholderTextColor="#918983"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearSearch}>
                <Ionicons name="close" size={16} color="#625B56" />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.faqList}>
            {faqs.map(item => (
              <FaqRow
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId(current => current === item.id ? '' : item.id)}
              />
            ))}
            {!faqs.length ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No answer found</Text>
                <Text style={styles.emptyText}>Try another search phrase.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minWidth: 0, overflow: 'hidden', backgroundColor: '#FCFAF7' },
  content: { width: '100%', minWidth: 0, alignSelf: 'center', paddingTop: 40, boxSizing: 'border-box' as any },
  header: { minWidth: 0, paddingBottom: 36 },
  eyebrow: { color: BURGUNDY, fontSize: 8.5, lineHeight: 12, fontWeight: '800', letterSpacing: 1.75 },
  title: { maxWidth: '100%', flexShrink: 1, color: INK, fontFamily: 'serif', fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -0.7, marginTop: 9 },
  directory: { borderTopWidth: 1, borderTopColor: '#DCD6D0' },
  topicRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 18, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#DCD6D0' },
  rowPressed: { backgroundColor: '#F3EFEB', opacity: 0.76 },
  topicCopy: { flex: 1, minWidth: 0 },
  topicTitle: { color: INK, fontSize: 15, lineHeight: 20, fontWeight: '650' as any },
  topicDescription: { color: '#766F6A', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  faqSection: { marginTop: 48 },
  sectionTitle: { maxWidth: '100%', color: INK, fontFamily: 'serif', fontSize: 25, lineHeight: 31, fontWeight: '700', marginTop: 6 },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, borderBottomWidth: 1, borderBottomColor: '#BFB7B1' },
  searchInput: { flex: 1, height: 49, color: INK, fontSize: 13, paddingVertical: 0 },
  clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  faqList: { borderTopWidth: 1, borderTopColor: '#DCD6D0', marginTop: 20 },
  faqRow: { minHeight: 64, paddingVertical: 17, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#DCD6D0' },
  faqHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  faqQuestion: { flex: 1, minWidth: 0, color: INK, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  faqAnswer: { color: '#655E59', fontSize: 11.5, lineHeight: 19, paddingTop: 12, paddingRight: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { color: INK, fontFamily: 'serif', fontSize: 20, lineHeight: 25, fontWeight: '700' },
  emptyText: { color: '#756E69', fontSize: 11, lineHeight: 17, marginTop: 5 },
});
