import type { ReactNode } from 'react';
import type { CheckItem, Status } from '../lib/check';

const STATUS_LABEL: Record<Status, string> = { lolos: 'Lolos', peringatan: 'Peringatan', gagal: 'Gagal' };

export function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>
        <span className="step">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NumberField(props: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <div className="input-unit">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={props.value}
          placeholder={props.placeholder}
          onChange={(e) => props.onChange(e.target.value)}
        />
        <em>{props.unit}</em>
      </div>
    </label>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}

export function StatusChip({ status }: { status: Status }) {
  return <span className={`chip chip-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function CheckList({ items }: { items: CheckItem[] }) {
  return (
    <ul className="checks">
      {items.map((item) => (
        <li key={item.label}>
          <StatusChip status={item.status} />
          <div>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
