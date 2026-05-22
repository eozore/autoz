import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  required = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="searchable-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className="searchable-select-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 0.85rem',
          border: isOpen ? '1px solid var(--border-focus)' : '1px solid var(--border-base)',
          borderRadius: 'var(--radius-md)',
          background: '#ffffff',
          color: selectedOption ? 'var(--text-primary)' : '#9ca3af',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 400,
          boxShadow: isOpen ? '0 0 0 3px var(--primary-glow)' : 'none',
          transition: 'all var(--transition-fast)'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>▼</span>
      </div>

      {isOpen && (
        <div
          className="searchable-select-dropdown"
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
            maxHeight: '250px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <input
            type="text"
            className="searchable-select-input"
            placeholder="Digite para filtrar..."
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
              boxSizing: 'border-box'
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.6rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '0.55rem 0.85rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: opt.value === value ? 'var(--color-primary)' : 'var(--text-primary)',
                    background: opt.value === value ? 'var(--primary-glow)' : 'transparent',
                    transition: 'all 0.1s ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => {
                    if (opt.value !== value) e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={e => {
                    if (opt.value !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hidden input to support required form validation if needed */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
}
