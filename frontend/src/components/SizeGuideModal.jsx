import React, { useState } from 'react';
import { X, Ruler, Sparkles, Check, Info } from 'lucide-react';

export default function SizeGuideModal({ isOpen, onClose }) {
  const [unit, setUnit] = useState('INCHES'); // 'INCHES' | 'CM'

  if (!isOpen) return null;

  const sizeChartData = [
    {
      size: 'XS',
      bustIn: '32 - 34',
      bustCm: '81 - 86',
      waistIn: '24 - 26',
      waistCm: '61 - 66',
      hipsIn: '34 - 36',
      hipsCm: '86 - 91',
      kameezLengthIn: '38',
      kameezLengthCm: '96',
      trouserLengthIn: '37',
      trouserLengthCm: '94',
    },
    {
      size: 'S',
      bustIn: '34 - 36',
      bustCm: '86 - 91',
      waistIn: '26 - 28',
      waistCm: '66 - 71',
      hipsIn: '36 - 38',
      hipsCm: '91 - 96',
      kameezLengthIn: '39',
      kameezLengthCm: '99',
      trouserLengthIn: '38',
      trouserLengthCm: '96',
    },
    {
      size: 'M',
      bustIn: '36 - 38',
      bustCm: '91 - 96',
      waistIn: '28 - 30',
      waistCm: '71 - 76',
      hipsIn: '38 - 40',
      hipsCm: '96 - 101',
      kameezLengthIn: '40',
      kameezLengthCm: '101',
      trouserLengthIn: '39',
      trouserLengthCm: '99',
    },
    {
      size: 'L',
      bustIn: '38 - 41',
      bustCm: '96 - 104',
      waistIn: '30 - 33',
      waistCm: '76 - 84',
      hipsIn: '40 - 43',
      hipsCm: '101 - 109',
      kameezLengthIn: '41',
      kameezLengthCm: '104',
      trouserLengthIn: '40',
      trouserLengthCm: '101',
    },
    {
      size: 'XL',
      bustIn: '41 - 44',
      bustCm: '104 - 112',
      waistIn: '33 - 36',
      waistCm: '84 - 91',
      hipsIn: '43 - 46',
      hipsCm: '109 - 117',
      kameezLengthIn: '42',
      kameezLengthCm: '106',
      trouserLengthIn: '40',
      trouserLengthCm: '101',
    },
  ];

  return (
    <div className="product-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="product-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          width: '95%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px',
          color: 'var(--text-main)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(212, 175, 55, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ruler size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Atelier Sizing Guide (سائز چارٹ)</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Pakistani Pret & Couture Standard Sizing Specifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Unit Toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => setUnit('INCHES')}
              style={{
                padding: '5px 14px',
                borderRadius: '16px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                background: unit === 'INCHES' ? 'var(--primary)' : 'transparent',
                color: unit === 'INCHES' ? '#0f172a' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Inches (in)
            </button>
            <button
              type="button"
              onClick={() => setUnit('CM')}
              style={{
                padding: '5px 14px',
                borderRadius: '16px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                background: unit === 'CM' ? 'var(--primary)' : 'transparent',
                color: unit === 'CM' ? '#0f172a' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Centimeters (cm)
            </button>
          </div>
        </div>

        {/* Sizing Table */}
        <div style={{ overflowX: 'auto', marginBottom: '22px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 800, color: 'var(--primary)' }}>SIZE</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>CHEST / BUST</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>WAIST</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>HIPS</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>SHIRT LENGTH</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>TROUSER LENGTH</th>
              </tr>
            </thead>
            <tbody>
              {sizeChartData.map((row, idx) => (
                <tr
                  key={row.size}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 800, color: '#f8fafc' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(99, 102, 241, 0.18)',
                        color: '#c7d2fe',
                      }}
                    >
                      {row.size}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>{unit === 'INCHES' ? row.bustIn : row.bustCm}</td>
                  <td style={{ padding: '12px 10px' }}>{unit === 'INCHES' ? row.waistIn : row.waistCm}</td>
                  <td style={{ padding: '12px 10px' }}>{unit === 'INCHES' ? row.hipsIn : row.hipsCm}</td>
                  <td style={{ padding: '12px 10px' }}>{unit === 'INCHES' ? row.kameezLengthIn : row.kameezLengthCm}</td>
                  <td style={{ padding: '12px 10px' }}>{unit === 'INCHES' ? row.trouserLengthIn : row.trouserLengthCm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Measurement Tips */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            fontSize: '0.8rem',
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#c7d2fe', marginBottom: '4px' }}>
            <Info size={15} /> How To Measure Accurate Fitting:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-muted)' }}>
            <li><strong>Bust:</strong> Measure around the fullest part of your chest, keeping the tape comfortably level.</li>
            <li><strong>Waist:</strong> Measure around your natural waistline (above belly button).</li>
            <li><strong>Hips:</strong> Measure around the fullest point of your hips with feet together.</li>
            <li><strong>Between Sizes?</strong> If your measurements fall between two sizes, we recommend selecting the larger size for a relaxed pret drape.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
