export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyDfp3ijzKvfGovXKAur63s5l2KUUdYaJtk',
  appId: '1:540841544767:web:f7c6730ac63bbdd8cebc8a',
  messagingSenderId: '540841544767',
  projectId: 'guru-vandan',
  authDomain: 'guru-vandan.firebaseapp.com',
  databaseURL: 'https://guru-vandan-default-rtdb.asia-southeast1.firebasedatabase.app'
});

export const topics = Object.freeze({
  'sign-in': 'Sign-in or account access',
  audio: 'Satsang or aarti audio',
  meditation: 'Meditation',
  quotes: 'Wisdom quotes',
  account: 'Account data or privacy',
  other: 'Something else'
});

export function usesEmulators(location) {
  return ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1';
}

export function validateMessage(values) {
  const fields = {};
  for (const key of ['name', 'email', 'topic', 'message', 'device', 'appVersion']) fields[key] = String(values[key] ?? '').trim();
  if (fields.name.length < 2 || fields.name.length > 80) return {field: 'name', error: 'Please enter your name (2–80 characters).'};
  if (fields.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return {field: 'email', error: 'Please enter a valid email address so we can reply.'};
  if (!Object.hasOwn(topics, fields.topic)) return {field: 'topic', error: 'Please choose what you need help with.'};
  if (fields.message.length < 10 || fields.message.length > 4000) return {field: 'message', error: 'Please describe the issue in 10–4,000 characters.'};
  if (fields.device.length > 160) return {field: 'device', error: 'Please keep the device details under 160 characters.'};
  if (fields.appVersion.length > 40) return {field: 'appVersion', error: 'Please keep the app version under 40 characters.'};
  if (values.consent !== true) return {field: 'consent', error: 'Please allow our support team to use these details to help you.'};
  return {fields};
}

export function messagePayload(fields, language) {
  return {...fields, language: language === 'hi' ? 'hi' : 'en', source: 'website', status: 'new', consent: true, createdAt: {'.sv': 'timestamp'}};
}

export async function sendMessage(payload, {location, fetcher = fetch, id = crypto.randomUUID()} = {}) {
  const endpoint = usesEmulators(location)
    ? `http://127.0.0.1:9000/supportMessages/${id}.json?ns=demo-guruvandan-support-default-rtdb&print=silent`
    : `${firebaseConfig.databaseURL}/supportMessages/${id}.json?print=silent`;
  const response = await fetcher(endpoint, {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('Support delivery was not confirmed.');
  return id;
}

export function filterMessages(messages, status, search) {
  const query = search.trim().toLocaleLowerCase();
  return messages.filter(item => (status === 'all' || item.status === status) &&
    [item.name, item.email, item.message, topics[item.topic], item.id].join(' ').toLocaleLowerCase().includes(query))
    .sort((first, second) => second.createdAt - first.createdAt || second.id.localeCompare(first.id));
}
