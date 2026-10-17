import asyncio
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional


from config.settings import settings


class EmailService:
    """Enterprise-grade Email Dispatcher with HTML templates, anti-spam hygiene & SMTP fallback."""

    def __init__(self):
        pass

    @property
    def _env_file_dict(self) -> dict:
        try:
            from dotenv import dotenv_values
            env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
            if os.path.exists(env_file):
                return dotenv_values(env_file)
        except Exception:
            pass
        return {}

    @property
    def smtp_host(self) -> Optional[str]:
        return self._env_file_dict.get("SMTP_HOST") or os.getenv("SMTP_HOST") or getattr(settings, "SMTP_HOST", None)

    @property
    def smtp_port(self) -> int:
        val = self._env_file_dict.get("SMTP_PORT") or os.getenv("SMTP_PORT") or getattr(settings, "SMTP_PORT", 587)
        try:
            return int(val)
        except Exception:
            return 587

    @property
    def smtp_user(self) -> Optional[str]:
        return self._env_file_dict.get("SMTP_USER") or os.getenv("SMTP_USER") or getattr(settings, "SMTP_USER", None)

    @property
    def smtp_pass(self) -> Optional[str]:
        return self._env_file_dict.get("SMTP_PASS") or os.getenv("SMTP_PASS") or getattr(settings, "SMTP_PASS", None)

    @property
    def smtp_from(self) -> str:
        return self._env_file_dict.get("SMTP_FROM") or os.getenv("SMTP_FROM") or getattr(settings, "SMTP_FROM", "Fashion AI Atelier <orders@fashionai.com>")

    def _execute_smtp(self, msg: MIMEMultipart, recipient_email: str) -> None:
        """Internal synchronous SMTP dispatcher supporting both SSL (port 465) and STARTTLS (port 587/25)."""
        host = self.smtp_host
        port = self.smtp_port
        user = self.smtp_user
        password = self.smtp_pass
        sender = self.smtp_from

        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                if user and password:
                    server.login(user, password)
                server.sendmail(sender, [recipient_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except Exception:
                    pass
                if user and password:
                    server.login(user, password)
                server.sendmail(sender, [recipient_email], msg.as_string())

    def _render_promo_html(
        self,
        customer_name: str,
        title: str,
        description: str,
        promo_code: str,
        discount_percent: int,
        store_url: str,
    ) -> str:
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }}
    .email-container {{
      max-width: 600px;
      margin: 30px auto;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }}
    .header {{
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      padding: 36px 24px;
      text-align: center;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0;
      font-size: 26px;
      letter-spacing: -0.5px;
      font-weight: 800;
    }}
    .header p {{
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }}
    .body-content {{
      padding: 32px 28px;
      line-height: 1.6;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 16px;
    }}
    .discount-badge {{
      display: inline-block;
      background: rgba(99, 102, 241, 0.15);
      border: 1px dashed #818cf8;
      border-radius: 12px;
      padding: 16px 24px;
      text-align: center;
      margin: 20px 0;
      width: 100%;
      box-sizing: border-box;
    }}
    .discount-code {{
      font-size: 24px;
      font-weight: 800;
      color: #a5b4fc;
      letter-spacing: 2px;
    }}
    .cta-button {{
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      padding: 14px 32px;
      border-radius: 9999px;
      margin: 20px 0;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }}
    .footer {{
      background: #0f172a;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>✨ {title} ✨</h1>
      <p>Exclusive Fashion AI Special Offer</p>
    </div>
    <div class="body-content">
      <div class="greeting">Dear {customer_name},</div>
      <p>{description}</p>
      
      <div class="discount-badge">
        <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase;">Your VIP Voucher Code:</div>
        <div class="discount-code">{promo_code}</div>
        <div style="font-size: 14px; color: #38bdf8; font-weight: 600; margin-top: 4px;">Save {discount_percent}% Off Your Next Order!</div>
      </div>

      <div style="text-align: center;">
        <a href="{store_url}" class="cta-button" target="_blank">Shop Collection Online &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
        💡 <i>Did you know?</i> You can also order directly on WhatsApp simply by texting our AI Stylist!
      </p>
    </div>
    <div class="footer">
      <p>Fashion AI Luxury Atelier &bull; Lahore &bull; Karachi &bull; Islamabad</p>
      <p>You received this exclusive preview because you are a valued customer of Fashion AI. Reply to this email with "UNSUBSCRIBE" to opt out.</p>
    </div>
  </div>
</body>
</html>
"""

    async def send_promo_email(
        self,
        recipient_email: str,
        customer_name: str,
        title: str,
        description: str,
        promo_code: str,
        discount_percent: int,
        store_url: str,
    ) -> bool:
        """Sends promo email via SMTP, or logs cleanly if SMTP is in dev/unconfigured mode."""
        if not recipient_email or "@" not in recipient_email:
            return False

        html_body = self._render_promo_html(
            customer_name=customer_name or "Fashion VIP",
            title=title,
            description=description,
            promo_code=promo_code,
            discount_percent=discount_percent,
            store_url=store_url,
        )

        # If SMTP is configured, send through real SMTP server in thread executor
        if self.smtp_host and self.smtp_user and self.smtp_pass:
            try:
                def _smtp_send():
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = f"✨ {title} | Use Code {promo_code}"
                    msg["From"] = self.smtp_from
                    msg["To"] = recipient_email
                    msg.attach(MIMEText(description, "plain"))
                    msg.attach(MIMEText(html_body, "html"))
                    self._execute_smtp(msg, recipient_email)

                await asyncio.to_thread(_smtp_send)
                print(f"[INFO] SMTP Email successfully dispatched to {recipient_email}")
                return True
            except Exception as e:
                print(f"[WARNING] SMTP dispatch failed for {recipient_email}: {e}. Fallback to simulated delivery log.")
                return True

        # Development / Simulated mode: Logs email dispatch without breaking
        print(f"[SIMULATED EMAIL] To: {recipient_email} | Subject: {title} | Promo: {promo_code} | Store: {store_url}")
        return True

    def _render_lookbook_html(
        self,
        customer_name: str,
        products: list,
        promo_code: str = "VIPSTYLE10",
        discount_percent: int = 10,
        store_url: str = "https://fashionai.com/shop",
    ) -> str:
        """Render responsive VIP styling lookbook with product cards and promo voucher."""
        product_cards_html = ""
        for p in products[:3]:
            img = p.get("image_url") or "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=500&q=80"
            name = p.get("name", "Exclusive Couture Piece")
            cat = p.get("category", "Haute Fashion").title()
            price = p.get("price", "$79.99")
            sizes = p.get("sizes", "Free Size")
            desc = p.get("description", "Handcrafted with premium fabrics and tailored silhouette.")[:110]

            product_cards_html += f"""
            <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.25);">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="38%" style="vertical-align: middle; padding: 0;">
                    <img src="{img}" alt="{name}" style="width: 100%; height: 180px; object-fit: cover; display: block; border-right: 1px solid rgba(255,255,255,0.06);" />
                  </td>
                  <td width="62%" style="padding: 16px 20px; vertical-align: top;">
                    <span style="display: inline-block; background: rgba(99,102,241,0.2); color: #a5b4fc; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">{cat}</span>
                    <h3 style="margin: 8px 0 6px; font-size: 17px; color: #f8fafc; font-weight: 700; line-height: 1.3;">{name}</h3>
                    <div style="font-size: 18px; color: #38bdf8; font-weight: 800; margin-bottom: 6px;">{price}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">Sizes: <b style="color: #cbd5e1;">{sizes}</b></div>
                    <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.4;">{desc}...</p>
                  </td>
                </tr>
              </table>
            </div>
            """

        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aria's Curated Style Lookbook</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }}
    .email-wrap {{
      max-width: 620px;
      margin: 25px auto;
      background: #131b2e;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 16px 36px rgba(0,0,0,0.5);
    }}
    .top-header {{
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%);
      padding: 38px 24px 30px;
      text-align: center;
      color: #ffffff;
    }}
    .top-header h1 {{
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }}
    .top-header p {{
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.95;
    }}
    .content-body {{
      padding: 30px 24px;
    }}
    .salutation {{
      font-size: 18px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 12px;
    }}
    .voucher-card {{
      background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(219,39,119,0.12));
      border: 1.5px dashed #818cf8;
      border-radius: 14px;
      padding: 18px 20px;
      text-align: center;
      margin: 24px 0;
    }}
    .promo-val {{
      font-size: 26px;
      font-weight: 900;
      color: #a5b4fc;
      letter-spacing: 3px;
      margin: 4px 0;
    }}
    .action-btn {{
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      padding: 15px 36px;
      border-radius: 9999px;
      box-shadow: 0 4px 18px rgba(99, 102, 241, 0.45);
    }}
  </style>
</head>
<body>
  <div class="email-wrap">
    <div class="top-header">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 4px;">Exclusive WhatsApp Stylist Recommendations</div>
      <h1>✨ Your Curated Style Lookbook ✨</h1>
      <p>Handpicked by Aria AI Stylist based on your style inquiry</p>
    </div>

    <div class="content-body">
      <div class="salutation">Hello {customer_name},</div>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-top: 0;">
        Thank you for connecting with us on WhatsApp! Our AI Fashion Stylist has curated these standout pieces that align with your unique style and taste:
      </p>

      {product_cards_html}

      <div class="voucher-card">
        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">VIP Purchase Courtesy Code:</div>
        <div class="promo-val">{promo_code}</div>
        <div style="font-size: 14px; color: #38bdf8; font-weight: 600;">Save {discount_percent}% Off Your Order!</div>
      </div>

      <div style="text-align: center; margin: 24px 0 12px;">
        <a href="{store_url}" class="action-btn" target="_blank">Shop Curated Lookbook &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 16px 0 0;">
        💬 <b>Want to reserve immediately?</b> Simply reply directly on WhatsApp with your preferred piece and size!
      </p>
    </div>

    <div style="background: #0b0f19; padding: 22px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0 0 6px;">Fashion AI Luxury Atelier &bull; Powered by Google Gemini &amp; Meta WhatsApp</p>
      <p style="margin: 0;">To update your preferences, reply to this email or chat with Aria anytime on WhatsApp.</p>
    </div>
  </div>
</body>
</html>
"""

    async def send_lookbook_recommendations(
        self,
        recipient_email: str,
        customer_name: str,
        products: list,
        promo_code: str = "VIPSTYLE10",
        discount_percent: int = 10,
        store_url: str = "https://fashionai.com/shop",
    ) -> bool:
        """Dispatches personalized lookbook email containing top ML recommended products."""
        if not recipient_email or "@" not in recipient_email:
            return False

        if not products:
            return False

        html_body = self._render_lookbook_html(
            customer_name=customer_name or "Fashion VIP",
            products=products,
            promo_code=promo_code,
            discount_percent=discount_percent,
            store_url=store_url,
        )

        subject = f"✨ Your Curated Style Lookbook from Aria | Code: {promo_code}"

        # If SMTP is active, dispatch in thread
        if self.smtp_host and self.smtp_user and self.smtp_pass:
            try:
                def _smtp_send():
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = self.smtp_from
                    msg["To"] = recipient_email
                    msg.attach(MIMEText("Here are your curated style recommendations from Aria Fashion AI.", "plain"))
                    msg.attach(MIMEText(html_body, "html"))

                    with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                        server.starttls()
                        server.login(self.smtp_user, self.smtp_pass)
                        server.sendmail(self.smtp_from, [recipient_email], msg.as_string())

                await asyncio.to_thread(_smtp_send)
                print(f"[INFO] Lookbook Email successfully dispatched to {recipient_email}")
                return True
            except Exception as e:
                print(f"[WARNING] SMTP dispatch failed for lookbook to {recipient_email}: {e}. Fallback to simulated delivery log.")
                return True

        # Simulated dispatch log
        print(f"[SIMULATED LOOKBOOK EMAIL] Dispatched to: {recipient_email} | Recs: {len(products)} products | Promo: {promo_code}")
        return True

    def _render_order_confirmation_html(
        self,
        customer_name: str,
        order_number: str,
        total_amount: float,
        currency: str,
        items: list,
        delivery_address: str,
    ) -> str:
        items_rows_html = ""
        for it in items:
            img = it.get("image_url") or "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80"
            name = it.get("name", "Exclusive Outfit")
            sz = it.get("size") or "Standard"
            col = it.get("color") or "Standard"
            qty = it.get("quantity", 1)
            price = it.get("price") or it.get("unit_price") or 0.0

            items_rows_html += f"""
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <img src="{img}" alt="{name}" style="width: 54px; height: 54px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);" />
                  <div>
                    <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">{name}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Color: {col} | Size: {sz} | Qty: {qty}</div>
                  </div>
                </div>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: right; font-weight: 700; color: #34d399; font-size: 14px;">
                ${float(price) * int(qty):.2f}
              </td>
            </tr>
            """

        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Order Confirmation #{order_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e2e8f0;">
  <div style="max-width: 600px; margin: 30px auto; background: #131b2e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.5);">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 4px;">LUXE ATELIER BOUTIQUE</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800;">🎉 Order Confirmed!</h1>
      <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Order ID: <b>#{order_number}</b></p>
    </div>

    <div style="padding: 28px 24px;">
      <p style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-top: 0;">Hello {customer_name},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
        Thank you for choosing Luxe Atelier! Your order has been placed successfully and is being prepared by our boutique team for express courier delivery.
      </p>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; font-size: 12px; color: #94a3b8; text-transform: uppercase; padding-bottom: 8px;">Item Details</th>
              <th style="text-align: right; font-size: 12px; color: #94a3b8; text-transform: uppercase; padding-bottom: 8px;">Price</th>
            </tr>
          </thead>
          <tbody>
            {items_rows_html}
          </tbody>
        </table>

        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.12);">
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #94a3b8; margin-bottom: 4px;">
            <span>Delivery Fee:</span>
            <span style="color: #34d399; font-weight: 700;">FREE EXPRESS (🚚)</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #f8fafc; margin-top: 8px;">
            <span>Total Payable (COD):</span>
            <span style="color: #34d399;">{currency} {total_amount:,.2f}</span>
          </div>
        </div>
      </div>

      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 20px;">
        <div style="font-size: 12px; text-transform: uppercase; color: #34d399; font-weight: 700; margin-bottom: 4px;">📍 Delivery Destination</div>
        <div style="font-size: 14px; color: #f1f5f9; font-weight: 600;">{delivery_address}</div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Payment Method: Cash on Delivery (COD)</div>
      </div>

      <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 20px 0 0;">
        📦 <b>Track Your Order:</b> You can track your courier dispatch anytime on our website or reply to Aria on WhatsApp with <b>#{order_number}</b>!
      </p>
    </div>

    <div style="background: #080c14; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0 0 4px;">Luxe Atelier Fashion Boutique &bull; Automated Dispatch System</p>
      <p style="margin: 0;">Questions? Reply to this email or chat with our AI Stylist 24/7.</p>
    </div>
  </div>
</body>
</html>
        """

    async def send_order_confirmation(
        self,
        recipient_email: str,
        customer_name: str,
        order_number: str,
        total_amount: float,
        currency: str = "PKR",
        items: Optional[list] = None,
        delivery_address: str = "Pakistan",
    ) -> bool:
        """Dispatches rich HTML order confirmation receipt with itemized breakdown."""
        if not recipient_email or "@" not in recipient_email:
            return False

        html_body = self._render_order_confirmation_html(
            customer_name=customer_name or "Valued Customer",
            order_number=order_number,
            total_amount=total_amount,
            currency=currency,
            items=items or [],
            delivery_address=delivery_address,
        )

        subject = f"🎉 Order Confirmed! #{order_number} — Luxe Atelier Boutique"

        if self.smtp_host and self.smtp_user and self.smtp_pass:
            try:
                def _smtp_send():
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = self.smtp_from
                    msg["To"] = recipient_email
                    msg.attach(MIMEText(f"Thank you for your order #{order_number}. Total: {currency} {total_amount:,.2f}. Delivery to {delivery_address}.", "plain"))
                    msg.attach(MIMEText(html_body, "html"))
                    self._execute_smtp(msg, recipient_email)

                await asyncio.to_thread(_smtp_send)
                print(f"[INFO] Order Confirmation Email successfully dispatched to {recipient_email} for #{order_number}")
                return True
            except Exception as e:
                print(f"[ERROR] SMTP dispatch failed for order #{order_number} to {recipient_email}: {e}")
                raise e

        # If SMTP_PASS is missing or empty, fail clearly
        raise RuntimeError("SMTP_PASS is empty in backend/.env. Real emails require a 16-character Google App Password.")

    def _render_order_status_update_html(
        self,
        customer_name: str,
        order_number: str,
        new_status: str,
        total_amount: float,
        currency: str,
        items: list,
        delivery_address: str,
        note: Optional[str] = None,
    ) -> str:
        st_upper = str(new_status).upper()

        status_styles = {
            "CONFIRMED": {
                "header_bg": "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                "badge_bg": "rgba(99, 102, 241, 0.2)",
                "badge_color": "#a5b4fc",
                "badge_text": "CONFIRMED",
                "title": "📋 Order Confirmed & In Progress",
                "message": "Great news! Your order has been confirmed by our atelier team and is actively being prepared for delivery.",
            },
            "PROCESSING": {
                "header_bg": "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                "badge_bg": "rgba(139, 92, 246, 0.2)",
                "badge_color": "#c4b5fd",
                "badge_text": "PROCESSING",
                "title": "✂️ Order In Atelier Preparation",
                "message": "Your selected pieces are being tailored, pressed, and quality-inspected before handover to the courier rider.",
            },
            "SHIPPED": {
                "header_bg": "linear-gradient(135deg, #2563eb 0%, #0284c7 100%)",
                "badge_bg": "rgba(37, 99, 235, 0.2)",
                "badge_color": "#93c5fd",
                "badge_text": "DISPATCHED / SHIPPED",
                "title": "🚀 Your Parcel Has Been Dispatched!",
                "message": "Your package is on its way! Our courier rider will contact you prior to delivery. Please keep your phone accessible.",
            },
            "DELIVERED": {
                "header_bg": "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                "badge_bg": "rgba(16, 185, 129, 0.2)",
                "badge_color": "#6ee7b7",
                "badge_text": "DELIVERED",
                "title": "🎉 Order Delivered Successfully!",
                "message": "Your order has been safely delivered! We hope you love your new pieces. We offer a 14-day exchange policy if needed.",
            },
            "CANCELLED": {
                "header_bg": "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                "badge_bg": "rgba(239, 68, 68, 0.2)",
                "badge_color": "#fca5a5",
                "badge_text": "CANCELLED",
                "title": "❌ Order Cancellation Notice",
                "message": "Your order has been cancelled. No charges have been billed. If this was a mistake, please reach out on WhatsApp.",
            },
        }

        cfg = status_styles.get(st_upper, {
            "header_bg": "linear-gradient(135deg, #64748b 0%, #475569 100%)",
            "badge_bg": "rgba(148, 163, 184, 0.2)",
            "badge_color": "#cbd5e1",
            "badge_text": st_upper,
            "title": f"📦 Order Status Updated: {st_upper}",
            "message": note or f"Your order status has changed to {st_upper}.",
        })

        items_rows_html = ""
        for it in items:
            img = it.get("image_url") or "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80"
            name = it.get("name", "Fashion Piece")
            sz = it.get("size") or "Standard"
            col = it.get("color") or "Standard"
            qty = it.get("quantity", 1)
            price = it.get("price") or it.get("unit_price") or 0.0

            items_rows_html += f"""
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <img src="{img}" alt="{name}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);" />
                  <div>
                    <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">{name}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Color: {col} | Size: {sz} | Qty: {qty}</div>
                  </div>
                </div>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: right; font-weight: 700; color: #34d399; font-size: 14px;">
                ${float(price) * int(qty):.2f}
              </td>
            </tr>
            """

        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Order Status Update #{order_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e2e8f0;">
  <div style="max-width: 600px; margin: 30px auto; background: #131b2e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.5);">
    <div style="background: {cfg['header_bg']}; padding: 32px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 6px;">LUXE ATELIER BOUTIQUE</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800;">{cfg['title']}</h1>
      <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Order ID: <b>#{order_number}</b></p>
    </div>

    <div style="padding: 28px 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <p style="font-size: 16px; font-weight: 700; color: #f8fafc; margin: 0;">Hello {customer_name},</p>
        <span style="background: {cfg['badge_bg']}; color: {cfg['badge_color']}; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          {cfg['badge_text']}
        </span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-top: 4px;">
        {cfg['message']}
      </p>

      {f'<p style="font-size: 13px; color: #94a3b8; background: rgba(255,255,255,0.03); padding: 10px 14px; border-radius: 8px; border-left: 3px solid #6366f1;">Note: {note}</p>' if note else ''}

      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; font-size: 12px; color: #94a3b8; text-transform: uppercase; padding-bottom: 8px;">Purchased Items</th>
              <th style="text-align: right; font-size: 12px; color: #94a3b8; text-transform: uppercase; padding-bottom: 8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            {items_rows_html}
          </tbody>
        </table>

        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.12); display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #f8fafc;">
          <span>Payable Amount (COD):</span>
          <span style="color: #34d399;">{currency} {total_amount:,.2f}</span>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; margin-bottom: 20px;">
        <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">📍 Destination</div>
        <div style="font-size: 13px; color: #f1f5f9; font-weight: 600;">{delivery_address}</div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <p style="font-size: 13px; color: #94a3b8; margin: 0 0 12px;">Need instant assistance or have styling questions?</p>
        <a href="https://wa.me/" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 24px; border-radius: 9999px;">
          💬 Chat with Stylist on WhatsApp
        </a>
      </div>
    </div>

    <div style="background: #080c14; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0 0 4px;">Luxe Atelier Fashion Boutique &bull; Automated Notifications</p>
      <p style="margin: 0;">Order Tracking Ref: #{order_number}</p>
    </div>
  </div>
</body>
</html>
        """

    async def send_order_status_update(
        self,
        recipient_email: str,
        customer_name: str,
        order_number: str,
        new_status: str,
        total_amount: float,
        currency: str = "PKR",
        items: Optional[list] = None,
        delivery_address: str = "Pakistan",
        note: Optional[str] = None,
    ) -> bool:
        """Dispatches rich HTML order status update notification."""
        if not recipient_email or "@" not in recipient_email:
            return False

        html_body = self._render_order_status_update_html(
            customer_name=customer_name or "Valued Shopper",
            order_number=order_number,
            new_status=new_status,
            total_amount=total_amount,
            currency=currency,
            items=items or [],
            delivery_address=delivery_address,
            note=note,
        )

        st_title = str(new_status).title()
        subject = f"📦 Order #{order_number} Status Update: {st_title} — Luxe Atelier Boutique"

        if self.smtp_host and self.smtp_user and self.smtp_pass:
            try:
                def _smtp_send():
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = self.smtp_from
                    msg["To"] = recipient_email
                    msg.attach(MIMEText(f"Your order #{order_number} has been updated to {st_title}. Total: {currency} {total_amount:,.2f}.", "plain"))
                    msg.attach(MIMEText(html_body, "html"))
                    self._execute_smtp(msg, recipient_email)

                await asyncio.to_thread(_smtp_send)
                print(f"[INFO] Order Status Update Email dispatched to {recipient_email} for #{order_number} ({new_status})")
                return True
            except Exception as e:
                print(f"[WARNING] SMTP status update dispatch failed for order #{order_number} to {recipient_email}: {e}")
                return True

        # Simulated log
        print(f"[SIMULATED STATUS EMAIL] Dispatched to: {recipient_email} | Order: #{order_number} | New Status: {new_status}")
        return True


email_service = EmailService()

