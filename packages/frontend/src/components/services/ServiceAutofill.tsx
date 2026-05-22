import { useState, useRef, useEffect, useCallback } from 'react';

export interface ServiceTemplate {
  nome: string;
  duracao_minutos: number;
  valor: number;
}

export interface ServiceAutofillProps {
  /** Callback when a template suggestion is selected */
  onSelect: (template: ServiceTemplate) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** External value to control the input (optional) */
  value?: string;
  /** Callback when input value changes */
  onChange?: (value: string) => void;
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { nome: 'Troca de Óleo e Filtro', duracao_minutos: 45, valor: 150 },
  { nome: 'Alinhamento e Balanceamento', duracao_minutos: 60, valor: 120 },
  { nome: 'Revisão Completa', duracao_minutos: 120, valor: 250 },
  { nome: 'Diagnóstico Eletrônico', duracao_minutos: 30, valor: 100 },
  { nome: 'Lavagem Completa', duracao_minutos: 60, valor: 90 },
  { nome: 'Troca de Pastilhas de Freio', duracao_minutos: 90, valor: 180 },
  { nome: 'Higienização de Ar Condicionado', duracao_minutos: 45, valor: 80 },
  { nome: 'Polimento e Cristalização', duracao_minutos: 180, valor: 350 },
];

/**
 * Normalize a string for accent-insensitive, case-insensitive matching.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Match templates against user input using normalized substring search.
 * Returns templates where the normalized input is a substring of the template name,
 * or where any word in the input matches a substring of the template name.
 */
export function matchTemplates(input: string): ServiceTemplate[] {
  if (!input || input.length < 2) return [];
  const normalized = normalize(input);
  return SERVICE_TEMPLATES.filter((t) => {
    const tNorm = normalize(t.nome);
    return (
      tNorm.includes(normalized) ||
      normalized.split(' ').some((word) => word.length >= 2 && tNorm.includes(word))
    );
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
}

function formatPrice(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ServiceAutofill({
  onSelect,
  placeholder = 'Digite o nome do serviço...',
  value: controlledValue,
  onChange: onChangeProp,
}: ServiceAutofillProps) {
  const [internalValue, setInternalValue] = useState('');
  const [suggestions, setSuggestions] = useState<ServiceTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputValue = controlledValue !== undefined ? controlledValue : internalValue;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateSuggestions = useCallback((val: string) => {
    const matches = matchTemplates(val);
    setSuggestions(matches);
    setIsOpen(matches.length > 0);
    setActiveIndex(-1);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onChangeProp?.(val);

    // Debounce the matching (200ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateSuggestions(val);
    }, 200);
  };

  const handleSelect = (template: ServiceTemplate) => {
    if (controlledValue === undefined) {
      setInternalValue(template.nome);
    }
    onChangeProp?.(template.nome);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(template);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} style={containerStyles}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (inputValue.length >= 2) {
            updateSuggestions(inputValue);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="service-autofill-listbox"
        aria-activedescendant={activeIndex >= 0 ? `service-suggestion-${activeIndex}` : undefined}
        style={inputStyles}
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          id="service-autofill-listbox"
          role="listbox"
          aria-label="Sugestões de serviço"
          style={dropdownStyles}
        >
          {suggestions.map((template, index) => (
            <li
              key={template.nome}
              id={`service-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => handleSelect(template)}
              onMouseEnter={(e) => {
                setActiveIndex(index);
                e.currentTarget.style.backgroundColor = 'var(--ds-color-bg-muted)';
              }}
              onMouseLeave={(e) => {
                if (index !== activeIndex) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              style={{
                ...suggestionItemStyles,
                backgroundColor: index === activeIndex ? 'var(--ds-color-bg-muted)' : 'transparent',
              }}
            >
              <span style={suggestionNameStyles}>{template.nome}</span>
              <span style={suggestionMetaStyles}>
                <span style={durationBadgeStyles}>{formatDuration(template.duracao_minutos)}</span>
                <span style={priceBadgeStyles}>{formatPrice(template.valor)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ===== Styles ===== */

const containerStyles: React.CSSProperties = {
  position: 'relative',
  width: '100%',
};

const inputStyles: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--ds-font-family)',
  fontSize: 'var(--ds-font-size-base)',
  padding: 'var(--ds-space-3) var(--ds-space-4)',
  minHeight: 'var(--ds-touch-target-min)',
  backgroundColor: 'var(--ds-color-bg-card)',
  color: 'var(--ds-color-text-primary)',
  border: '1px solid var(--ds-color-border-base)',
  borderRadius: 'var(--ds-radius-md)',
  outline: 'none',
  transition: 'border-color var(--ds-transition-fast), box-shadow var(--ds-transition-fast)',
};

const dropdownStyles: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 'var(--ds-space-1)',
  backgroundColor: 'var(--ds-color-bg-card)',
  border: '1px solid var(--ds-color-border-base)',
  borderRadius: 'var(--ds-radius-md)',
  boxShadow: 'var(--ds-shadow-lg)',
  zIndex: 1050,
  maxHeight: '280px',
  overflowY: 'auto',
  listStyle: 'none',
  margin: 0,
  marginBlockStart: 'var(--ds-space-1)',
  padding: 'var(--ds-space-1)',
};

const suggestionItemStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--ds-space-3) var(--ds-space-4)',
  cursor: 'pointer',
  borderRadius: 'var(--ds-radius-sm)',
  transition: 'background-color var(--ds-transition-fast)',
  minHeight: 'var(--ds-touch-target-min)',
};

const suggestionNameStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-sm)',
  fontWeight: 'var(--ds-font-weight-medium)',
  color: 'var(--ds-color-text-primary)',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const suggestionMetaStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--ds-space-2)',
  marginLeft: 'var(--ds-space-3)',
  flexShrink: 0,
};

const durationBadgeStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-xs)',
  color: 'var(--ds-color-text-secondary)',
  backgroundColor: 'var(--ds-color-bg-muted)',
  padding: '2px var(--ds-space-2)',
  borderRadius: 'var(--ds-radius-sm)',
  whiteSpace: 'nowrap',
};

const priceBadgeStyles: React.CSSProperties = {
  fontSize: 'var(--ds-font-size-xs)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-success)',
  whiteSpace: 'nowrap',
};

export default ServiceAutofill;
