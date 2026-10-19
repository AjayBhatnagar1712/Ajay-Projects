export const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
export const mix = (start, end, amount) => start + (end - start) * amount;
export const smooth = (value) => {
  const amount = clamp(value);
  return amount * amount * (3 - 2 * amount);
};
export const interval = (progress, start, end) => clamp((progress - start) / (end - start));

export const CHAPTERS = [
  { start: 0, end: 0.24, id: 'seeking', label: 'The search', hindi: 'खोज', title: 'A journey begins\nwith a question.', copy: 'A seeker leaves the familiar behind. Each step carries him closer to a life of inner discovery.', note: 'The mountain landscape is symbolic, not a historical location.' },
  { start: 0.24, end: 0.43, id: 'compassion', label: 'Compassion', hindi: 'सेवा', title: 'No heart\nis too small.', copy: 'On the way, he pauses for another. A humble offering, a helping hand — the path belongs to everyone.', note: 'Inspired by Gurudev’s compassion for humble villagers.' },
  { start: 0.43, end: 0.64, id: 'meditation', label: 'Turning within', hindi: 'ध्यान', title: 'From the world\nto the light within.', copy: 'The seeker settles into meditation beside the river. The journey turns inward, towards stillness.', note: 'Inspired by Gurudev’s meditation at Kuppaghat, beside the Ganga.' },
  { start: 0.64, end: 0.84, id: 'teaching', label: 'Sharing wisdom', hindi: 'सत्संग', title: 'One teacher.\nMany awakened hearts.', copy: 'Seekers gather. His hands open in teaching, and a quiet understanding passes from one heart to another.', note: 'A symbolic satsang, inspired by the Sant Mat tradition.' },
  { start: 0.84, end: 1, id: 'carrying', label: 'Guru Vandan', hindi: 'गुरु वंदन', title: 'The teaching lives on.\nNow, beside you.', copy: 'Guru Vandan keeps satsang, meditation, aarti and Guru Vani close — connecting disciples to Gurudev’s wisdom in everyday life.', note: 'The same remembrance. A new way to stay connected.' }
];

export function sampleStory(value, reducedMotion = false) {
  const progress = clamp(Number.isFinite(value) ? value : 0);
  const chapter = CHAPTERS.findIndex((item, index) => progress < item.end || index === CHAPTERS.length - 1);
  const local = interval(progress, CHAPTERS[chapter].start, CHAPTERS[chapter].end);
  const locations = [-2, 18, 38, 58, 78];
  const actionStart = [0, 0.32, 0.4, 0.4, 0.4][chapter];
  const standing = chapter >= 3 ? smooth(interval(local, 0, 0.12)) : 1;
  const action = smooth(interval(local, actionStart, 0.88));
  const arrival = chapter === 0 ? local : smooth(interval(local, chapter >= 3 ? 0.12 : 0, actionStart));
  const previous = chapter === 0 ? -2 : locations[chapter - 1];
  const destination = chapter === 0 ? 7 : locations[chapter];
  const origin = chapter === 1 ? 7 : previous;
  const walking = reducedMotion ? 0 : chapter === 0 ? 1 - smooth(interval(local, 0.96, 1)) : smooth(interval(local, chapter >= 3 ? 0.1 : 0, chapter >= 3 ? 0.17 : 0.04)) * (1 - smooth(interval(local, actionStart * 0.85, actionStart)));
  const position = mix(origin, destination, arrival);
  const stride = reducedMotion ? 0 : position * 4.5;
  const sit = chapter === 2 ? action : chapter === 3 ? Math.max(1 - standing, smooth(interval(local, actionStart, 0.65))) : chapter === 4 ? 1 - standing : 0;
  const help = chapter === 1 ? Math.sin(action * Math.PI) : 0;
  const teach = chapter === 3 ? smooth(interval(local, 0.62, 1)) : chapter === 4 ? 1 - standing : 0;
  const reveal = chapter === 4 ? smooth(interval(local, 0.42, 0.95)) : 0;
  const initialTurn = chapter === 2 ? 1 : chapter >= 3 ? 0.22 : 1.1;
  const movingTurn = mix(initialTurn, 1.1, smooth(interval(local, 0, 0.16)));
  const turn = chapter === 0 ? 1.1 : mix(movingTurn, chapter === 1 ? 1 : 0.22, smooth(interval(local, actionStart * 0.85, actionStart + 0.08)));
  const elevation = chapter === 3 ? arrival * sit * 0.18 : chapter === 4 ? (1 - standing) * 0.18 : 0;
  return { progress, chapter, local, position, stride, walking, sit, help, teach, reveal, turn, elevation, frame: Math.round(progress * 1800) };
}
