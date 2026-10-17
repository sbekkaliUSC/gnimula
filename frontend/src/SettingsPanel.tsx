import {useState} from 'react';
import {Download, FileText, Settings2, Shield} from 'lucide-react';
import './settings.css';

interface SettingsProps {
  initialSection?: string;
  autocomplete: boolean;
  onAutocomplete: (enabled: boolean) => void;
  memoryEnabled: boolean;
  onMemory: (enabled: boolean) => void;
  training: boolean;
  privacySaving: boolean;
  onTraining: (enabled: boolean) => void;
  onExport: () => void;
  onLegal: () => void;
}

export default function SettingsPanel(props: SettingsProps) {
  const [section, setSection] = useState(props.initialSection || 'editor');
  return <>
    <h1>Settings</h1>
    <div className="preferences-layout">
      <nav className="preferences-nav" aria-label="Settings sections">
        <button aria-current={section === 'editor' ? 'page' : undefined} onClick={() => setSection('editor')}><Settings2 size={16}/>Editor</button>
        <button aria-current={section === 'data' ? 'page' : undefined} onClick={() => setSection('data')}><Shield size={16}/>Data controls</button>
      </nav>
      <section className="preferences-content" aria-label={section === 'editor' ? 'Editor settings' : 'Data controls'}>
        {section === 'editor' ? <>
          <h2>Editor</h2>
          <p>Control assistance in this workbench.</p>
          <label className="preference-row">
            <span><strong>Autocomplete as I work</strong><small>Suggest a next edit after changes to the circuit or layout.</small></span>
            <input type="checkbox" checked={props.autocomplete} onChange={e => props.onAutocomplete(e.target.checked)}/>
          </label>
          <label className="preference-row">
            <span><strong>Use project memory</strong><small>Use this project's saved corrections when suggesting edits.</small></span>
            <input type="checkbox" checked={props.memoryEnabled} onChange={e => props.onMemory(e.target.checked)}/>
          </label>
          <p className="preferences-note">These switches apply to this open workbench. Manage saved corrections in Memory.</p>
        </> : <>
          <h2>Data controls</h2>
          <label className="preference-row consent">
            <span><strong>Use my data for model training</strong><small>Includes projects, chats, and editor actions. Enabled by default for new guest sessions. You can turn it off.</small></span>
            <input type="checkbox" checked={props.training} disabled={props.privacySaving} onChange={e => props.onTraining(e.target.checked)}/>
          </label>
          <p className="preferences-note">This preference is saved for your guest session. No training job currently uses these records.</p>
          <h3>Guest session</h3>
          <p>Your guest session lasts 30 days. Keep this browser's cookie to return. Export a copy before clearing browser data.</p>
          <button onClick={props.onExport}><Download size={14}/>Export this project &amp; activity</button>
        </>}
      </section>
    </div>
    <div className="preferences-footer"><button className="text-button" onClick={props.onLegal}><FileText size={14}/>Legal &amp; privacy</button></div>
  </>;
}

const notices = [
  ['React / React DOM', 'MIT', 'https://github.com/facebook/react'],
  ['Lucide icons', 'ISC', 'https://github.com/lucide-icons/lucide'],
  ['Vite', 'MIT', 'https://github.com/vitejs/vite'],
  ['TypeScript', 'Apache-2.0', 'https://github.com/microsoft/TypeScript'],
  ['Wrangler / Workers SDK', 'MIT / Apache-2.0', 'https://github.com/cloudflare/workers-sdk'],
  ['Cloudflare Containers SDK', 'MIT / Apache-2.0', 'https://github.com/cloudflare/containers'],
  ['ngspice', 'BSD-style project notices', 'https://ngspice.sourceforge.io/developer.html'],
  ['Python', 'PSF and component licenses', 'https://www.python.org/psf/license/'],
  ['Llama 3.3 via Workers AI', 'Provider and model terms', 'https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/'],
  ['SKY130 transistor models', 'Apache-2.0', 'https://github.com/google/skywater-pdk-libs-sky130_fd_pr'],
  ['Public SKY130 op-amp examples', 'Apache-2.0', 'https://huggingface.co/datasets/pphilip/analog-circuits-sky130'],
  ['Public RC band-pass example', 'ngspice project notices', 'https://github.com/ngspice/ngspice'],
];

export function LegalPanel({onSettings}: {onSettings: () => void}) {
  const [section, setSection] = useState('privacy');
  return <>
    <h1>Legal &amp; privacy</h1>
    <nav className="legal-nav" aria-label="Legal information">
      {[['privacy', 'Privacy policy'], ['terms', 'Preview terms'], ['notices', 'Third-party notices']].map(([id, label]) =>
        <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>)}
    </nav>
    <article className="legal-content">
      {section === 'privacy' ? <>
        <h2>Privacy policy</h2>
        <p>Projects, chat messages, stated goals, attached references, editor actions, suggestions, corrections, and simulation results are stored on Cloudflare to run Gnimula and evaluate its behavior. Collection is limited to this app.</p>
        <h3>Storage and session access</h3>
        <p>Gnimula uses a guest cookie to recognize your session, and browser storage for drafts and pending actions. Project records are stored in Cloudflare D1 and private R2 storage. Keep the guest cookie to return to your saved work.</p>
        <h3>AI assistance and future training</h3>
        <p>Chat and suggestions send your design, goals, recent messages, and excerpts of attached reference text to Cloudflare Workers AI. Project, chat, and action records are eligible for future model training when the training setting is enabled. It starts enabled for new guest sessions; existing sessions keep their stored preference. No training job currently consumes these records.</p>
        <p>Review or change this setting under Settings → Data controls. Turning it off does not stop the storage and processing needed to run the app.</p>
        <button className="text-button" onClick={onSettings}>Open data controls</button>
        <h3>Retention and export</h3>
        <p>Guest sessions and active records expire after 30 days. Scheduled cleanup removes expired cloud records and artifacts; operational backups may persist for their recovery window. Browser drafts may remain until you clear this site's browser data. Export a copy of your project and activity before the guest session expires.</p>
        <h3>Collection boundaries</h3>
        <p>No raw keystrokes, passwords, or unrelated browsing are collected. User designs and activity are not published with the app's source. Do not enter confidential foundry data in this preview.</p>
      </> : section === 'terms' ? <>
        <h2>Preview terms</h2>
        <p>Gnimula is an early browser-based analog design workbench. It supports the editor, model, and simulation operations described in the app; availability and supported features may change.</p>
        <h3>Engineering use</h3>
        <p>Review proposed edits and independently verify engineering results. Concept layout geometry is not foundry signoff. The preview does not provide PDK DRC/LVS, extracted layout connectivity, or manufacturing validation.</p>
        <h3>Your projects</h3>
        <p>Use designs and reference material you are entitled to use. Keep exported copies of work you need beyond the 30-day guest session. Future training use is controlled by the setting and explanation in Data controls and the Privacy policy.</p>
        <h3>Public sources and components</h3>
        <p>Library source material remains subject to its publisher's license. Source references accompany prepared circuits. Third-party software and models are subject to their respective terms and notices.</p>
      </> : <>
        <h2>Third-party notices</h2>
        <p>Gnimula uses the following public software, services, models, and circuit sources. Original notices accompany installed simulator dependencies and model files.</p>
        <ul className="third-party-list">{notices.map(([name, license, url]) => <li key={name}><a href={url} target="_blank" rel="noreferrer">{name}</a><span>{license}</span></li>)}</ul>
        <p>Model weights are hosted by the provider and are not distributed with this app. Prepared library circuits retain their source references and preparation notes.</p>
      </>}
    </article>
  </>;
}
