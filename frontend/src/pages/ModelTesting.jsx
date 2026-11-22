import report from '../../../model-testing/results.json';
import './ModelTesting.css';

// Documentation of how the beep-finder model was tested (built by model-testing/build_report.py).
const audio = import.meta.glob('../../../model-testing/audio/*.wav', { eager: true, query: '?url', import: 'default' });
const audioUrl = (file) => audio[`../../../model-testing/audio/${file}`];
const pct = (x) => (x == null ? '—' : `${x}%`);
const mark = (right) => (right ? '✓' : '✗');

export default function ModelTesting() {
  return (
    <div className="model-testing">
      <h1>Model testing: finding the beep</h1>
      <p>
        Model <b>{report.run}</b> ({report.parameters.toLocaleString()} parameters, step {report.step.toLocaleString()}) against
        the old hand-written rules. Each test is 0.35 s of microphone audio; a pick is right within 1/3 ms of the true beep,
        or when it correctly says there is no beep.
      </p>

      <h2>Results</h2>
      <Table rows={report.summary} />
      {report.groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          {group.notes && <ul>{group.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
          <Table rows={group.rows} />
        </section>
      ))}

      <h2>Example cases</h2>
      <div className="cases">
        {report.cases.map((c, i) => (
          <div className="case" key={c.audio}>
            <b>Case {i + 1}</b>: {c.beep === 'none' ? 'no beep' : `${c.beep} beep`}, {c.environment}
            {c.snrDb != null && `, ${c.snrDb} dB SNR`}{c.distanceM && `, ${c.distanceM} m`}
            {c.impostors.length > 0 && `, impostors: ${c.impostors.join(', ')}`}
            {c.faults.length > 0 && `, faults: ${c.faults.join(', ')}`}
            <audio controls src={audioUrl(c.audio)} />
            <div>Truth {c.truthMs ?? 'none'} ms · Model {c.modelMs ?? 'none'} ms {mark(c.modelRight)} · Rules {c.rulesMs ?? 'none'} ms {mark(c.rulesRight)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Table({ rows }) {
  return (
    <table>
      <thead><tr><th>Test</th><th>Windows</th><th>Model</th><th>Rules</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td><td>{r.n ?? ''}</td>
            <td className={r.rules != null && r.model > r.rules ? 'better' : ''}>{pct(r.model)}</td><td>{pct(r.rules)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
