import { Input } from '../design-system/components/Input';

export interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  required?: boolean;
}

/** Extract only digits from a string */
export function extractDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Format raw digits as +55 (XX) XXXXX-XXXX */
export function formatPhone(digits: string): string {
  if (!digits) return '';
  // Remove country code if present
  let d = digits;
  if (d.startsWith('55') && d.length > 11) {
    d = d.slice(2);
  }
  if (d.length <= 2) return `+55 (${d}`;
  if (d.length <= 7) return `+55 (${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Convert raw digits to submission format: +55XXXXXXXXXXX */
export function toPhoneSubmitValue(digits: string): string {
  let d = digits;
  if (d.startsWith('55') && d.length > 11) {
    d = d.slice(2);
  }
  return `+55${d}`;
}

export function PhoneInput({ value, onChange, label = 'Celular', required }: PhoneInputProps) {
  const digits = extractDigits(value);
  const displayValue = formatPhone(digits);

  const hasError = digits.length > 0 && digits.length < 11;
  const error = hasError ? 'Número de telefone incompleto' : undefined;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = extractDigits(e.target.value);
    // Limit to 11 digits (DDD + 9 digits)
    onChange(raw.slice(0, 11));
  }

  return (
    <Input
      label={label}
      value={displayValue}
      onChange={handleChange}
      error={error}
      placeholder="+55 (11) 99999-9999"
      required={required}
      type="tel"
    />
  );
}
