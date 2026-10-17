import React from 'react';
import { X, Truck, RotateCcw, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';

export default function PolicyModal({ type, isOpen, onClose }) {
  if (!isOpen || !type) return null;

  const content = {
    SHIPPING: {
      title: 'Shipping & Delivery Policy (شپنگ پالیسی)',
      icon: <Truck size={22} />,
      color: '#38bdf8',
      sections: [
        {
          heading: 'Express Delivery Across Pakistan 🚚',
          text: 'We deliver nationwide across Pakistan to all major cities (Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Sialkot, and beyond) via premier logistics partners including Trax Logistics, Leopards, and Call Courier.',
        },
        {
          heading: 'Delivery Timelines',
          text: '• Major Cities (Lahore, Karachi, Islamabad): 2 to 3 Business Days.\n• Other Cities & Regions: 3 to 4 Business Days.\n• Orders placed before 3:00 PM are dispatched on the same day from our atelier.',
        },
        {
          heading: 'Shipping Charges & Complimentary Free Delivery',
          text: '• Standard Express Delivery across Pakistan is PKR 250.\n• All orders over PKR 2,999 qualify for 100% FREE Complimentary Express Delivery nationwide.',
        },
        {
          heading: 'Live Courier Consignment Tracking',
          text: 'Once your package is booked, you receive an automated WhatsApp confirmation containing your courier consignment number. You can track your parcel live anytime from our website or by chatting with our AI Stylist.',
        },
      ],
    },
    RETURNS: {
      title: '7-Day Return & Exchange Policy (واپسی اور تبدیلی کی پالیسی)',
      icon: <RotateCcw size={22} />,
      color: '#a855f7',
      sections: [
        {
          heading: 'Hassle-Free 7-Day Exchange Window',
          text: 'We want you to love your Luxe Atelier outfits. If you have any sizing or fitting concerns, you can request an exchange or return within 7 calendar days of parcel delivery directly from your "My Orders" portal.',
        },
        {
          heading: 'Return Criteria & Condition',
          text: '• Items must be unworn, unwashed, and in their original packaging with all boutique tags and security labels intact.\n• Customized or custom-tailored bridal pieces are eligible for fitting adjustments but cannot be refunded.',
        },
        {
          heading: 'Return Pickup & Processing',
          text: 'Once your return request is approved by our team, our courier rider will pick up the package from your doorstep, or you can drop it at the nearest logistics center. Upon inspection at our atelier, your exchange outfit will be dispatched or refund initiated via JazzCash / EasyPaisa / Bank Transfer within 3 to 5 business days.',
        },
      ],
    },
    ABOUT: {
      title: 'About Luxe Atelier (ہمارے بارے میں)',
      icon: <Sparkles size={22} />,
      color: 'var(--primary)',
      sections: [
        {
          heading: 'The Art of Modern Pakistani Haute Couture',
          text: 'Founded in the cultural heart of Lahore, Luxe Atelier brings contemporary elegance to traditional Pakistani craftsmanship. We specialize in luxury pret, handcrafted chiffons, breathable pure linen silhouettes, and bespoke festive ensembles.',
        },
        {
          heading: 'AI-Powered Personal Styling',
          text: 'We combine timeless eastern needlecraft with cutting-edge conversational AI. Our proprietary fashion stylist Aria provides real-time silhouette recommendations, size estimations, and order tracking across web and WhatsApp.',
        },
        {
          heading: 'Ethical Craftsmanship & Authenticity Guaranteed',
          text: 'Every garment is meticulously stitched by master artisans using premium dyed silks, organzas, and lawn weaves. We guarantee 100% genuine designer quality on every piece.',
        },
      ],
    },
    PRIVACY: {
      title: 'Privacy & Security Guarantee (پرائیویسی پالیسی)',
      icon: <ShieldCheck size={22} />,
      color: '#10b981',
      sections: [
        {
          heading: 'Data Protection & Confidentiality',
          text: 'At Luxe Atelier, we hold customer privacy to the highest standard. Your personal details, WhatsApp contact numbers, and delivery addresses are encrypted and strictly used solely for order processing and requested updates.',
        },
        {
          heading: 'Zero Spam Policy',
          text: 'We never share, rent, or sell your customer information to third-party marketers. You can opt out of promotional broadcasts anytime by typing "STOP" in WhatsApp chat.',
        },
      ],
    },
  };

  const current = content[type] || content.SHIPPING;

  return (
    <div className="product-modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
      <div
        className="product-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: `${current.color}22`,
                color: current.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {current.icon}
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              {current.title}
            </h3>
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

        {/* Policy Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '65vh', overflowY: 'auto', paddingRight: '6px' }}>
          {current.sections.map((sec, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '14px 18px',
              }}
            >
              <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                {sec.heading}
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {sec.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
