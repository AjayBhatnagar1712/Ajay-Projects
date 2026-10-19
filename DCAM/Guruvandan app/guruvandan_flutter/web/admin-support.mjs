import {firebaseConfig, filterMessages, topics, usesEmulators} from './support-data.mjs';

const notice = document.querySelector('#admin-notice');
const loginPanel = document.querySelector('#admin-auth');
const inbox = document.querySelector('#support-inbox');
const rows = document.querySelector('#message-rows');
const search = document.querySelector('#inbox-search');
const filter = document.querySelector('#inbox-filter');
const older = document.querySelector('#load-older');
const login = document.querySelector('#admin-login');
const frame = document.querySelector('#app-admin-frame');
let messages = new Map();
let olderMessages = new Map();
let cursor = null;
let unsubscribe = null;
let session = 0;
let activeUser = null;
let database;
let databaseApi;
let auth;
let authApi;
const allowedAdminEmail = 'guruvandan11@gmail.com';

function showNotice(text, kind = '') {
  notice.textContent = text;
  notice.dataset.kind = kind;
}

function selectPanel(name) {
  if (!activeUser || activeUser.email?.toLowerCase() !== allowedAdminEmail) return;
  for (const panel of ['support', 'app']) {
    document.querySelector(`#${panel}-tab`).setAttribute('aria-pressed', String(panel === name));
    document.querySelector(`#${panel}-panel`).hidden = panel !== name;
  }
  if (name === 'app' && !frame.hasAttribute('src')) frame.src = '/app.html#/admin';
}

document.querySelector('#support-tab').addEventListener('click', () => selectPanel('support'));
document.querySelector('#app-tab').addEventListener('click', () => selectPanel('app'));

function element(tag, value, className = '') {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function clearInbox() {
  unsubscribe?.();
  unsubscribe = null;
  messages.clear();
  olderMessages.clear();
  cursor = null;
  rows.replaceChildren();
  inbox.hidden = true;
  older.hidden = true;
  document.querySelector('#new-count').textContent = '';
}

function records(snapshot) {
  const items = [];
  snapshot.forEach(child => { items.push({...child.val(), id: child.key}); });
  return items;
}

function renderMessages() {
  const items = [...new Map([...olderMessages, ...messages]).values()];
  const visible = filterMessages(items, filter.value, search.value);
  const newCount = items.filter(item => item.status === 'new').length;
  document.querySelector('#new-count').textContent = newCount ? `(${newCount})` : '';
  document.querySelector('#inbox-count').textContent = `${visible.length} shown · ${items.length} loaded · ${newCount} new`;
  const empty = document.querySelector('#inbox-empty');
  empty.hidden = visible.length > 0;
  empty.textContent = items.length ? 'No messages match your search or filter.' : 'No support messages yet.';
  const fragment = document.createDocumentFragment();
  for (const item of visible) {
    const row = element('tr', '', item.status === 'new' ? 'message-new' : '');
    const sender = element('td', '');
    sender.dataset.label = 'From / received';
    const email = element('a', item.email);
    email.href = `mailto:${encodeURIComponent(item.email)}`;
    const time = element('time', new Date(item.createdAt).toLocaleString());
    time.dateTime = new Date(item.createdAt).toISOString();
    sender.append(element('strong', item.name), email, time, element('small', `Reference: ${item.id}`));
    const topic = element('td', topics[item.topic] || item.topic);
    topic.dataset.label = 'Topic';
    const content = element('td', '');
    content.dataset.label = 'Message';
    content.append(element('p', item.message, 'message-body'));
    if (item.device) content.append(element('small', `Device: ${item.device}`));
    if (item.appVersion) content.append(element('small', `App version: ${item.appVersion}`));
    content.append(element('small', item.language === 'hi' ? 'Submitted in Hindi' : 'Submitted in English'));
    const actions = element('td', '');
    actions.dataset.label = 'Status / reply';
    const select = element('select', '', 'message-status');
    select.setAttribute('aria-label', `Status for message from ${item.name}`);
    for (const value of ['new', 'read', 'resolved']) {
      const option = element('option', value[0].toUpperCase() + value.slice(1));
      option.value = value;
      select.append(option);
    }
    select.value = item.status;
    select.addEventListener('change', async () => {
      const selectedStatus = select.value;
      const currentSession = session;
      select.disabled = true;
      try {
        await databaseApi.update(databaseApi.ref(database, `supportMessages/${item.id}`), {status: selectedStatus});
        if (currentSession !== session) return;
        if (olderMessages.has(item.id)) olderMessages.set(item.id, {...item, status: selectedStatus});
        if (messages.has(item.id)) messages.set(item.id, {...item, status: selectedStatus});
        showNotice('Message status saved.', 'success');
        renderMessages();
      } catch {
        if (currentSession !== session) return;
        select.value = item.status;
        showNotice('Status was not saved. Check your connection and admin access, then try again.', 'error');
      } finally { select.disabled = false; }
    });
    const reply = element('a', 'Reply by email');
    reply.href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`Guru Vandan support — ${item.id}`)}`;
    actions.append(select, reply);
    row.append(sender, topic, content, actions);
    fragment.append(row);
  }
  rows.replaceChildren(fragment);
}

function subscribeInbox(user) {
  session += 1;
  const currentSession = session;
  clearInbox();
  if (!user) return;
  showNotice('Loading support messages…');
  const {ref, query, orderByChild, limitToLast, onValue} = databaseApi;
  unsubscribe = onValue(query(ref(database, 'supportMessages'), orderByChild('createdAt'), limitToLast(100)), snapshot => {
    if (currentSession !== session) return;
    const items = records(snapshot);
    for (const [id, item] of messages) {
      if (items.some(current => current.id === id)) continue;
      if (items.length === 100 && item.createdAt <= items[0].createdAt) olderMessages.set(id, item);
      else olderMessages.delete(id);
    }
    messages = new Map(items.map(item => [item.id, item]));
    if (!cursor && items.length) {
      cursor = {createdAt: items[0].createdAt, id: items[0].id};
      older.hidden = items.length < 100;
    }
    inbox.hidden = false;
    showNotice('Inbox connected. New messages appear automatically.', 'success');
    renderMessages();
  }, error => {
    if (currentSession !== session) return;
    clearInbox();
    showNotice(error.code?.toLowerCase().includes('permission')
      ? 'This account cannot read support messages. Sign in with an authorized admin account. If you are an admin, check that the support database rules have been deployed.'
      : 'The inbox could not load. Check your connection and sign in again.', 'error');
  });
}

older.addEventListener('click', async () => {
  if (!cursor || older.disabled) return;
  const currentSession = session;
  older.disabled = true;
  try {
    const {ref, query, orderByChild, limitToLast, endBefore, get} = databaseApi;
    const snapshot = await get(query(ref(database, 'supportMessages'), orderByChild('createdAt'), endBefore(cursor.createdAt, cursor.id), limitToLast(100)));
    if (currentSession !== session) return;
    const items = records(snapshot);
    for (const item of items) olderMessages.set(item.id, item);
    if (items.length) cursor = {createdAt: items[0].createdAt, id: items[0].id};
    older.hidden = items.length < 100;
    renderMessages();
  } catch {
    if (currentSession === session) showNotice('Older messages could not load. Please try again.', 'error');
  } finally { older.disabled = false; }
});

search.addEventListener('input', renderMessages);
filter.addEventListener('change', renderMessages);
document.querySelector('#refresh-inbox').addEventListener('click', () => subscribeInbox(activeUser));

async function signIn() {
  const fieldset = login.querySelector('fieldset');
  fieldset.disabled = true;
  showNotice('Signing in…');
  try {
    await authApi.signInWithEmailAndPassword(auth, allowedAdminEmail, login.elements.password.value);
    login.elements.password.value = '';
  } catch {
    showNotice('Sign-in failed. Check your credentials, connection, or popup settings and try again.', 'error');
  } finally { fieldset.disabled = false; }
}

login.addEventListener('submit', event => { event.preventDefault(); signIn(); });
document.querySelector('#admin-signout').addEventListener('click', async () => {
  session += 1;
  clearInbox();
  frame.removeAttribute('src');
  try { await authApi.signOut(auth); }
  catch { showNotice('Sign-out failed. Please retry before leaving this device.', 'error'); }
});

try {
  const [appApi, loadedAuth, loadedDatabase] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js')
  ]);
  authApi = loadedAuth;
  databaseApi = loadedDatabase;
  const local = usesEmulators(window.location);
  const config = local ? {...firebaseConfig, apiKey: 'demo-key', projectId: 'demo-guruvandan-support', databaseURL: 'https://demo-guruvandan-support-default-rtdb.firebaseio.com'} : firebaseConfig;
  const app = appApi.initializeApp(config);
  auth = authApi.getAuth(app);
  database = databaseApi.getDatabase(app);
  if (local) {
    authApi.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    databaseApi.connectDatabaseEmulator(database, '127.0.0.1', 9000);
  }
  authApi.onAuthStateChanged(auth, user => {
    if (user && user.email?.toLowerCase() !== allowedAdminEmail) {
      activeUser = null;
      session += 1;
      clearInbox();
      frame.removeAttribute('src');
      selectPanel('support');
      loginPanel.hidden = false;
      document.querySelector('#app-panel').hidden = true;
      document.querySelector('#support-panel').hidden = false;
      document.querySelector('#admin-identity').textContent = '';
      document.querySelector('#admin-signout').hidden = true;
      showNotice('This account does not have admin access.', 'error');
      authApi.signOut(auth).catch(() => {});
      return;
    }
    activeUser = user;
    loginPanel.hidden = Boolean(user);
    document.querySelector('#admin-signout').hidden = !user;
    document.querySelector('#admin-identity').textContent = user?.email || '';
    subscribeInbox(user);
    if (!user) {
      frame.removeAttribute('src');
      document.querySelector('#app-panel').hidden = true;
      document.querySelector('#support-panel').hidden = false;
      showNotice('Please sign in to open the support inbox.');
    }
  });
} catch {
  showNotice('Secure sign-in could not load. Check your connection and reload this page.', 'error');
}
