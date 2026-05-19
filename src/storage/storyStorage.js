import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@streettales_stories';
const MAX_STORIES = 50;

export async function saveStory(story) {
  try {
    const existing = await getStories();
    const newStory = {...story, id: story.id ?? Date.now().toString()};
    const updated = [newStory, ...existing].slice(0, MAX_STORIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newStory;
  } catch (error) {
    console.error('saveStory error:', error);
    return null;
  }
}

export async function getStories() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stories = JSON.parse(raw);
    return stories.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('getStories error:', error);
    return [];
  }
}

export async function deleteStory(id) {
  try {
    const existing = await getStories();
    const updated = existing.filter(s => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('deleteStory error:', error);
  }
}
