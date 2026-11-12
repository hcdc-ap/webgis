// MODULE 4 chạy NGAY TRONG TRÌNH DUYỆT bằng Pyodide (Python/WASM) — không cần server, chi phí 0đ.
// Dùng đúng stats_core.py (scipy/statsmodels/sklearn) đã được kiểm định; kết quả đã đối chiếu với
// bản native (verify_output.json). Lần chạy đầu tải ~60MB (trình duyệt tự cache cho các lần sau).
const PYODIDE_VERSION = 'v314.0.7';
importScripts(`https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`);

let pyReady = null;
function init() {
  if (!pyReady) {
    pyReady = (async () => {
      postMessage({ type: 'progress', text: 'Đang tải môi trường Python (lần đầu ~1 phút)...' });
      const py = await loadPyodide();
      await py.loadPackage(['numpy', 'pandas', 'scipy', 'statsmodels', 'scikit-learn']);
      const src = await (await fetch('stats_core.py', { cache: 'no-cache' })).text();
      py.FS.writeFile('/home/pyodide/stats_core.py', src);
      return py;
    })();
  }
  return pyReady;
}

onmessage = async (e) => {
  const { id, params } = e.data;
  try {
    const py = await init();
    postMessage({ type: 'progress', text: 'Đang chạy kiểm định thống kê...' });
    py.globals.set('req_json', JSON.stringify(params));
    const out = await py.runPythonAsync(`
import json, sys
sys.path.insert(0, '/home/pyodide')
from stats_core import run_full_validation
_r = json.loads(req_json)
json.dumps(run_full_validation(_r['points'], alpha=_r['alpha'], bootstrap_n=_r['bootstrap_n'], random_state=_r['random_state']))
`);
    postMessage({ type: 'result', id, result: JSON.parse(out) });
  } catch (err) {
    postMessage({ type: 'error', id, error: String(err && err.message ? err.message : err) });
  }
};
