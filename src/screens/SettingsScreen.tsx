import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import { eraseAll, exportAll, getSettings, importAll, trainingReport, updateSettings } from '../data/repo';

// Embedded test pages (inside another page's frame) can't start downloads, so only offer a file when running on its own.
const canDownload = (() => { try { return window.self === window.top; } catch { return false; } })();

export function SettingsScreen({ go }: { go: Go }) {
  const settings = useLiveQuery(() => getSettings(), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  if (!settings) return null;

  const backupText = async () => JSON.stringify(await exportAll());
  const today = new Date().toISOString().slice(0, 10);

  const saveFile = async (text: string, name: string, type: string, title: string, setNote: (m: string) => void) => {
    const blob = new Blob([text], { type });
    // On iPhone the share sheet is the reliable way to save a file (Save to Files, AirDrop, Mail).
    const file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); setNote(`${title} shared.`); } catch { /* cancelled */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setNote(`${title} saved. If nothing downloaded, use Copy instead.`);
  };
  const copy = async () => {
    const text = await backupText();
    try { await navigator.clipboard.writeText(text); setMsg('Backup copied. Paste it into Notes or an email to keep it safe.'); }
    catch { setPaste(text); setMsg("Couldn't copy automatically. Select the text below and copy it."); }
  };
  const copyReport = async () => {
    const text = await trainingReport();
    try { await navigator.clipboard.writeText(text); setReportMsg('Training log copied. Paste it into a chat with Claude.'); setReport(null); }
    catch { setReport(text); setReportMsg("Couldn't copy automatically. Select the text below and copy it."); }
  };
  const restore = async (text: string) => {
    try { await importAll(text); setMsg('Backup restored.'); setPaste(null); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'That backup could not be read.'); }
  };

  return (
    <main className="screen">
      <button className="back" style={{ alignSelf: 'start' }} onClick={() => go({ name: 'home' })}>‹ Home</button>
      <h1 className="title">Settings</h1>

      <section className="stack">
        <span className="eyebrow">Weights in</span>
        <div className="seg" role="radiogroup" aria-label="Weight unit">
          {(['kg', 'lb'] as const).map((u) => (
            <button key={u} role="radio" aria-checked={settings.unit === u} className={settings.unit === u ? 'on' : ''} onClick={() => updateSettings({ unit: u })}>
              {u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}
            </button>
          ))}
        </div>
        <p className="small muted">Changing this relabels your weights. It doesn't convert numbers you've already entered.</p>
      </section>

      <section className="card stack">
        <h2 className="subtitle">Backup</h2>
        <p className="small muted">Your training is stored on this phone only. Keep a backup until syncing arrives.</p>
        <div className="row">
          <button className="btn" onClick={copy}>Copy backup</button>
          {canDownload && <button className="btn" onClick={async () => saveFile(await backupText(), `dailyrep-backup-${today}.json`, 'application/json', 'DailyRep backup', setMsg)}>Save backup file</button>}
        </div>
        <label className="btn" style={{ textAlign: 'center' }}>
          Restore from a file
          <input type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await restore(await f.text()); e.target.value = ''; }} />
        </label>
        {paste === null
          ? <button className="link muted" onClick={() => setPaste('')}>Restore by pasting a backup</button>
          : (
            <div className="stack">
              <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a DailyRep backup here" aria-label="Backup text" />
              <div className="row">
                <button className="btn" disabled={!paste.trim()} onClick={() => restore(paste)}>Restore this backup</button>
                <button className="btn" onClick={() => setPaste(null)}>Cancel</button>
              </div>
            </div>
          )}
        {msg && <p className="small" role="status">{msg}</p>}
      </section>

      <section className="card stack">
        <h2 className="subtitle">Analyse with Claude</h2>
        <p className="small muted">Every finished workout, your current weights and your program as readable text. Paste it into Claude and ask how you're progressing.</p>
        <div className="row">
          <button className="btn" onClick={copyReport}>Copy training log</button>
          {canDownload && <button className="btn" onClick={async () => saveFile(await trainingReport(), `dailyrep-log-${today}.md`, 'text/markdown', 'Training log', setReportMsg)}>Save as file</button>}
        </div>
        {report !== null && <textarea rows={8} readOnly value={report} aria-label="Training log" onFocus={(e) => e.target.select()} />}
        {reportMsg && <p className="small" role="status">{reportMsg}</p>}
      </section>

      <section className="stack">
        {confirmErase ? (
          <div className="notice warn">
            <span><b>Erase everything?</b> All workouts, sessions and progress on this phone will be deleted. This can't be undone.</span>
            <div className="row">
              <button className="btn danger" onClick={async () => { await eraseAll(); go({ name: 'home' }); }}>Erase all data</button>
              <button className="btn" onClick={() => setConfirmErase(false)}>Cancel</button>
            </div>
          </div>
        ) : <button className="link muted" onClick={() => setConfirmErase(true)}>Erase all data</button>}
        <p className="small muted">DailyRep {__APP_VERSION__} · data stays on this device</p>
      </section>
    </main>
  );
}
