import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
};

export function Field({ label, value, onChange, placeholder, type = "text", required }: FieldProps) {
  const isPassword = type === "password";

  if (isPassword) {
    return <PasswordField label={label} value={value} onChange={onChange} placeholder={placeholder} required={required} />;
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        required={required}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}

function PasswordField({ label, value, onChange, placeholder, required }: Omit<FieldProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-field">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={visible ? "text" : "password"}
          required={required}
        />
        <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

export function InfoLine({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="info-line">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <article className="empty-card">
      <h2>{title}</h2>
      <p>{text}</p>
      {action && onAction && (
        <button className="primary-button" onClick={onAction}>
          {action}
        </button>
      )}
    </article>
  );
}

export function BusyOverlay({ text }: { text: string }) {
  return (
    <div className="busy-overlay">
      <Loader2 size={22} />
      <span>{text}</span>
    </div>
  );
}
