import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * RealBarcode Component
 * Generates an ISO/IEC 15417 compliant Code 128 1D vector barcode.
 * Real, scannable by physical laser guns, courier PDAs, and smartphone camera scanner apps.
 */
export default function RealBarcode({
  value,
  height = 55,
  width = 1.9,
  displayValue = true,
  className = '',
  style = {},
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, String(value), {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: displayValue,
          font: 'monospace',
          textAlign: 'center',
          textPosition: 'bottom',
          textMargin: 5,
          fontSize: 14,
          background: '#ffffff',
          lineColor: '#000000',
          margin: 8,
          valid: () => {},
        });
      } catch (err) {
        console.error('Failed to render real barcode:', err);
      }
    }
  }, [value, height, width, displayValue]);

  if (!value) return null;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        ...style,
      }}
    >
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
      <span
        style={{
          fontSize: '0.68rem',
          color: '#475569',
          marginTop: '4px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        📷 Scannable Courier AWB Barcode (Code 128)
      </span>
    </div>
  );
}
