const statusBox = document.querySelector('.status');
let statusTimer;

function showStatus(message) {
  clearTimeout(statusTimer);
  statusBox.textContent = message;
  statusTimer = setTimeout(() => { statusBox.textContent = ''; }, 6500);
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const field = document.getElementById(`prompt-${button.dataset.copy}`);
    let clipboardTimeout;
    showStatus(`Copying scene ${button.dataset.copy} prompt…`);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await Promise.race([
        navigator.clipboard.writeText(field.value),
        new Promise((resolve, reject) => { clipboardTimeout = setTimeout(() => reject(new Error('Clipboard timed out')), 1500); }),
      ]);
      showStatus(`Scene ${button.dataset.copy} prompt copied. Upload its corrected image in Gemini, then paste.`);
    } catch {
      field.closest('details').open = true;
      field.focus();
      field.select();
      showStatus(`Scene ${button.dataset.copy} prompt selected. Press Ctrl+C (or ⌘C on Mac) to copy.`);
    } finally {
      clearTimeout(clipboardTimeout);
    }
  });
}
