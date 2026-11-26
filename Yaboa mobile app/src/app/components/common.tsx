import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "date" | "time";
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  maxLength?: number;
  onBlur?: () => void;
};

export function Field({ label, value, onChange, placeholder, type = "text", required, autoComplete, disabled, maxLength, onBlur }: FieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="field">
      <span>{label}</span>
      <div className={isPassword ? "password-input" : undefined}>
        <input
          className={`field-input${isPassword ? " password-field" : ""}`}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          type={isPassword && passwordVisible ? "text" : type}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          maxLength={maxLength}
        />
        {isPassword && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            title={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
          >
            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
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
        <button type="button" className="primary-button" onClick={onAction}>
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
