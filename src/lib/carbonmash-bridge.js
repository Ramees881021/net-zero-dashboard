// Carbonmash Data Bridge — net zero
const TOOL_ID = 'netzero';

export function saveToolData(data) {
  if (window.parent === window) return;
  window.parent.postMessage({ type: 'SAVE_TOOL_DATA', toolId: TOOL_ID, data: data }, '*');
}

export function loadToolData() {
  return new Promise((resolve) => {
    if (window.parent === window) { resolve(null); return; }
    const handler = (event) => {
      if (event.data?.type === 'GET_TOOL_DATA_SUCCESS' && event.data?.toolId === TOOL_ID) {
        window.removeEventListener('message', handler);
        resolve(event.data.data || null);
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'GET_TOOL_DATA', toolId: TOOL_ID }, '*');
    setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 5000);
  });
}
