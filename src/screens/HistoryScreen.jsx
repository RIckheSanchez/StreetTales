import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {getStories, deleteStory} from '../storage/storyStorage';
import {useTTS} from '../hooks/useTTS';

function formatDate(timestamp) {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const {speak, stop, isSpeaking} = useTTS();

  useFocusEffect(
    useCallback(() => {
      loadStories();
      return () => stop();
    }, []),
  );

  async function loadStories() {
    const data = await getStories();
    setStories(data);
  }

  function handlePlay(story) {
    if (playingId === story.id && isSpeaking) {
      stop();
      setPlayingId(null);
      return;
    }
    stop();
    setPlayingId(story.id);
    speak(story.storyText);
  }

  function handleDelete(story) {
    Alert.alert(
      '删除故事',
      `确定要删除"${story.buildingName || '这条故事'}"吗？`,
      [
        {text: '取消', style: 'cancel'},
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (playingId === story.id) {
              stop();
              setPlayingId(null);
            }
            await deleteStory(story.id);
            setStories(prev => prev.filter(s => s.id !== story.id));
          },
        },
      ],
    );
  }

  function renderItem({item}) {
    const isPlaying = playingId === item.id && isSpeaking;
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.buildingName} numberOfLines={1}>
            {item.buildingName || '未知建筑'}
          </Text>
          {item.buildingType ? (
            <Text style={styles.buildingType}>{item.buildingType}</Text>
          ) : null}
          <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {item.storyText?.slice(0, 60)}...
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, isPlaying && styles.actionBtnActive]}
            onPress={() => handlePlay(item)}>
            <Icon
              name={isPlaying ? 'stop' : 'play-arrow'}
              size={24}
              color={isPlaying ? '#e53935' : '#fff'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDelete(item)}>
            <Icon name="delete-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>我路过的地方</Text>
        <View style={styles.backBtn} />
      </View>

      {stories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyText}>还没有故事记录</Text>
          <Text style={styles.emptyHint}>长按麦克风，询问窗外的故事</Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            {paddingBottom: insets.bottom + 16},
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#111'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  backBtn: {width: 36, alignItems: 'center'},
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  list: {paddingTop: 12, paddingHorizontal: 16, gap: 12},
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardLeft: {flex: 1, marginRight: 12},
  buildingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  buildingType: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  preview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(229,57,53,0.15)',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIcon: {fontSize: 52},
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  emptyHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
  },
});
