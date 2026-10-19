import {getLanguage, t} from './website-language.mjs';
import {messagePayload, sendMessage, validateMessage} from './support-data.mjs';

const form = document.querySelector('#support-form');
const fieldset = form.querySelector('fieldset');
const button = form.querySelector('button[type="submit"]');
const status = document.querySelector('#support-status');
const reference = document.querySelector('#support-reference');
const counter = document.querySelector('#message-count');
const cooldownKey = 'guruvandan.support.lastSent';
let busy = false;
let lastSent = 0;
let notice = '';
try { lastSent = Number(localStorage.getItem(cooldownKey)) || 0; } catch {}

function showStatus(message, kind = '') {
  notice = message;
  status.textContent = t(message);
  status.dataset.kind = kind;
}

function updateCount() {
  counter.textContent = `${form.elements.message.value.length.toLocaleString(getLanguage())} / ${Number(4000).toLocaleString(getLanguage())}`;
}

form.elements.message.addEventListener('input', updateCount);
document.addEventListener('website-language-change', () => {
  status.textContent = t(notice);
  button.textContent = t(busy ? 'Sending message…' : 'Send message');
  updateCount();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  for (const control of form.elements) control.removeAttribute('aria-invalid');
  if (form.elements.website.value) return;
  const result = validateMessage({...Object.fromEntries(new FormData(form)), consent: form.elements.consent.checked});
  if (result.error) {
    showStatus(result.error, 'error');
    form.elements[result.field].setAttribute('aria-invalid', 'true');
    form.elements[result.field].focus();
    return;
  }
  if (Date.now() - lastSent < 60000) {
    showStatus('Please wait a minute before sending another message.', 'error');
    return;
  }
  busy = true;
  fieldset.disabled = true;
  form.setAttribute('aria-busy', 'true');
  button.textContent = t('Sending message…');
  reference.textContent = '';
  showStatus('Sending your message securely…');
  try {
    const id = await sendMessage(messagePayload(result.fields, getLanguage()), {location: window.location});
    lastSent = Date.now();
    try { localStorage.setItem(cooldownKey, String(lastSent)); } catch {}
    form.reset();
    updateCount();
    reference.textContent = id;
    showStatus('Message received. Our support team can now see it and reply to your email. Your reference:', 'success');
  } catch {
    showStatus('Delivery could not be confirmed. Your message is still here. Check your connection and try again.', 'error');
  } finally {
    busy = false;
    fieldset.disabled = false;
    form.removeAttribute('aria-busy');
    button.textContent = t('Send message');
    status.focus();
  }
});
updateCount();
fieldset.disabled = false;
