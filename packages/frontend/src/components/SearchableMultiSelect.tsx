import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  meta?: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  required?: boolean;
}

export default function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  required = false,
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOptions = options.filter(opt => value.includes(opt.value));

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggleOption(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  function removeOption(optValue: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter(v => v !== optValue));
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.3rem',
          alignItems: 'center',
          minHeight: '42px',
          padding: '0.4rem 0.85rem',
          border: isOpen ? '1px solid var(--border-focus)' : '1px solid var(--border-base)',
          borderRadius: 'var(--radius-md)',
          background: '#ffffff',
          cursor: 'pointer',
          fontSize: '0.9rem',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-glow)' : 'none',
          transition: 'all var(--transition-fast)',
        }}
      >
        {selectedOptions.length === 0 && (
          <span style={{ color: '#9ca3af' }}>{placeholder}</span>
        )}
        {selectedOptions.map(opt => (
          <span
            key={opt.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              fontSize: '0.78rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
            <button
              type="button"
              onClick={(e) => removeOption(opt.value, e)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                border: 'none',
                background: 'transparent',
                color: '#1d4ed8',
                cursor: 'pointer',
                fontSize: '0.7rem',
                borderRadius: '50%',
                padding: 0,
              }}
              aria-label={`Remover ${opt.label}`}
            >
              ✕
            </button>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>▼</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '105%',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 1050,
            maxHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <input
            type="text"
            placeholder="Buscar serviço..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            onClick={e => e.stopPropagation()}
            style={{
              padding: '0.5rem 0.75rem',
              border: 'none',
              borderBottom: '1px solid var(--border-base)',
              background: '#f8fafc',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = value.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => { e.stopPropagation(); toggleOption(opt.value); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.55rem 0.85rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      transition: 'all 0.1s ease',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 500 : 400 }}>
                        {opt.label}
                      </div>
                      {opt.meta && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                          {opt.meta}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {required && value.length === 0 && (
        <input
          type="text"
          value=""
          onChange={() => {}}
          required
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
