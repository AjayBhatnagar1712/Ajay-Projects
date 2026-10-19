import {translate} from './website-copy.mjs';

const storageKey = 'guruvandan.website.language.v2';
let language = 'hi';
try { language = localStorage.getItem(storageKey) === 'en' ? 'en' : 'hi'; } catch {}
export const getLanguage = () => language;
export const t = value => translate(value, language);
const textRecords = new WeakMap();
const attributeRecords = new WeakMap();
const excluded = 'script, style, code, [data-no-translate], [data-language-switch]';
const attributes = ['aria-label', 'title', 'alt', 'placeholder'];
const observer = new MutationObserver(changes => {
  observer.disconnect();
  for (const change of changes) {
    if (change.type === 'characterData') translateText(change.target);
    else if (change.type === 'attributes') translateElement(change.target);
    else for (const child of change.addedNodes) translateTree(child);
  }
  observe();
});

function translateText(node) {
  if (!node.parentElement || node.parentElement.closest(excluded)) return;
  let record = textRecords.get(node);
  if (!record || node.data !== record.rendered) record = {original:node.data};
  const clean = record.original.trim();
  const translated = t(clean);
  record.rendered = translated === clean ? record.original : record.original.replace(clean, translated);
  if (node.data !== record.rendered) node.data = record.rendered;
  textRecords.set(node, record);
}

function translateElement(element) {
  if (element.closest(excluded)) return;
  const records = attributeRecords.get(element) || {};
  const names = element.matches('meta[name="description"],meta[property="og:title"],meta[property="og:description"]') ? [...attributes, 'content'] : attributes;
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    let record = records[name];
    if (!record || value !== record.rendered) record = {original:value};
    record.rendered = t(record.original);
    if (value !== record.rendered) element.setAttribute(name, record.rendered);
    records[name] = record;
  }
  attributeRecords.set(element, records);
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === Node.TEXT_NODE) translateText(walker.currentNode);
    else translateElement(walker.currentNode);
  }
}

function observe() {
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:[...attributes, 'content']});
}

function renderLanguage() {
  observer.disconnect();
  document.documentElement.lang = language;
  translateTree(document.documentElement);
  for (const control of document.querySelectorAll('[data-language-switch]')) {
    control.textContent = language === 'hi' ? 'EN' : 'हिन्दी';
    control.lang = language === 'hi' ? 'en' : 'hi';
    control.setAttribute('aria-label', language === 'hi' ? 'Switch website to English' : 'पूरी वेबसाइट हिन्दी में पढ़ें');
    control.setAttribute('title', language === 'hi' ? 'Switch to English' : 'हिन्दी में पढ़ें');
  }
  observe();
}

export function setLanguage(value) {
  language = value === 'hi' ? 'hi' : 'en';
  try { localStorage.setItem(storageKey, language); } catch {}
  renderLanguage();
  document.dispatchEvent(new CustomEvent('website-language-change', {detail:{language}}));
}

for (const control of document.querySelectorAll('[data-language-switch]')) {
  control.addEventListener('click', () => setLanguage(language === 'en' ? 'hi' : 'en'));
}
window.addEventListener('storage', event => {
  if (event.key === storageKey) {
    language = event.newValue === 'hi' ? 'hi' : 'en';
    renderLanguage();
    document.dispatchEvent(new CustomEvent('website-language-change', {detail:{language}}));
  }
});
renderLanguage();
