import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.mongodb import connect_to_mongo, close_mongo_connection, get_database

FAQS = [
    # --- ORDERING & BOOKING ---
    {
        "title": "Order place karne ka kya tareeqa hai?",
        "topic": "orders",
        "approved_content": (
            "Aap Luxe Atelier par 2 aasan tareeqon se order book kar saktay hain: \n"
            "1. Storefront Chat mein 'Fill Details & Order Now' button daba kar form fill karein aur 'Confirm Order' par click karein.\n"
            "2. WhatsApp par product ka naam, size, color, aur apna mukammal delivery address bhej dein. Hamari AI Stylist Aria foran aapka order book kar degi!"
        ),
        "keywords": ["order", "order place", "kaise order karein", "how to order", "book order", "order karne ka tareeqa"],
        "hit_count": 12,
    },
    {
        "title": "Order confirmation aur tracking ID kab milti hai?",
        "topic": "orders",
        "approved_content": (
            "Jaise hi aapka order confirm hota hai, aapko foran screen par aur WhatsApp par Order ID (e.g. #ORD-20261013-1001) receive hoti hai. "
            "Agar aapne email provide kiya ho, to detailed HTML receipt bhi foran inbox mein bhej di jaati hai!"
        ),
        "keywords": ["order confirmation", "order id", "tracking id", "confirmation message", "receipt"],
        "hit_count": 8,
    },
    {
        "title": "Kya main order cancel kar sakta/sakti hoon?",
        "topic": "orders",
        "approved_content": (
            "Jee haan! Dispatch hone se pehle (booking ke 6 ghanton ke andar) aap apna order aasani se cancel kar saktay hain. "
            "Bas chat mein apna Order ID likh kar 'Cancel my order' bhein, ya hamare live support ko notify karein."
        ),
        "keywords": ["cancel order", "order cancellation", "cancel kardo", "order cancel", "cancellation"],
        "hit_count": 5,
    },
    {
        "title": "Kya order book hone ke baad address ya size change ho sakta hai?",
        "topic": "orders",
        "approved_content": (
            "Jee bilkul! Agar parcel courier ko handover nahi hua, to aap apna delivery address, phone number, ya dress ka size change karwa saktay hain. "
            "Baraye meharbani foran chat par apna Order ID aur naya address/size share karein."
        ),
        "keywords": ["change address", "change size", "address badalna", "modify order", "update address"],
        "hit_count": 4,
    },
    {
        "title": "Kya account banaye baghair order book ho sakta hai?",
        "topic": "orders",
        "approved_content": (
            "Jee haan! Aap baghair kisi account ke Guest Checkout ke zariye direct apna order book kar saktay hain. "
            "Sirf apna naam, phone number, aur delivery address darj karna kaafi hai."
        ),
        "keywords": ["guest checkout", "baghair account", "no account", "direct order"],
        "hit_count": 3,
    },
    {
        "title": "Kya urgent express delivery available hai kisi event ke liye?",
        "topic": "orders",
        "approved_content": (
            "Jee haan! Agar aapko kisi shadi ya event ke liye urgent dress chahiye, to hum major cities (Lahore, Karachi, Islamabad) mein 24-48 ghanton ki Priority Express Delivery provide karte hain. "
            "Order book karte waqt chat mein 'Urgent' zaroor mention karein!"
        ),
        "keywords": ["urgent delivery", "urgent order", "fast delivery", "emergency delivery", "shadi urgent"],
        "hit_count": 7,
    },
    {
        "title": "Out of stock dress ko pre-book kaise karein?",
        "topic": "orders",
        "approved_content": (
            "Agar aapka pasandeeda outfit out of stock hai, to aap hamare chat agent ko bata kar advance pre-booking karwa saktay hain. "
            "Jaise hi naya stock atelier se tayar hota hai, hum sabse pehle aapko dispatch karte hain."
        ),
        "keywords": ["out of stock", "pre book", "pre order", "restock", "kab aayega"],
        "hit_count": 4,
    },

    # --- SHIPPING, DELIVERY & COD ---
    {
        "title": "Delivery kitne dinon mein milti hai?",
        "topic": "shipping",
        "approved_content": (
            "Pakistan ke tamaam baray shehron (Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Sahiwal, Multan) mein delivery 2 se 4 working days mein ho jaati hai. "
            "Doosray shehron aur tehsils mein 3 se 5 working days lagtay hain."
        ),
        "keywords": ["delivery time", "kitne din", "delivery kitne din mein", "shipping days", "kab tak aayega"],
        "hit_count": 15,
    },
    {
        "title": "Delivery charges kitne hain aur Free Delivery kab milti hai?",
        "topic": "shipping",
        "approved_content": (
            "Luxe Atelier par $50 (ya PKR 5,000) se zayed ke tamaam orders par Free Express Delivery 🚚 complimentary di jaati hai! "
            "Is se kam ke order par nominal delivery charge $5 (approx PKR 250) hota hai."
        ),
        "keywords": ["delivery charges", "free delivery", "delivery fee", "shipping fee", "charges kitne hain"],
        "hit_count": 14,
    },
    {
        "title": "Kya Cash on Delivery (COD) har shehar mein dastiyab hai?",
        "topic": "shipping",
        "approved_content": (
            "Jee haan! Cash on Delivery (COD) poore Pakistan ke 250+ shehron aur towns mein 100% available hai. "
            "Jab courier rider aapke darwazay par package laye, tab aap payment cash mein ada kar saktay hain."
        ),
        "keywords": ["cash on delivery", "cod", "cod available", "cash payment", "ghar aane par payment"],
        "hit_count": 18,
    },
    {
        "title": "Kya parcel khol kar check karne ki ijazat hai payment se pehle?",
        "topic": "shipping",
        "approved_content": (
            "Courier companies ki official policy ke mutabiq rider parcel tab handover karta hai jab payment receive ho jaye. "
            "Lekin agar parcel kholne ke baad koi bhi masla ho (size, color, ya fabric), to hamari 7-Day Hassle-Free Exchange & Return policy 100% active rehti hai!"
        ),
        "keywords": ["open parcel", "khol kar check", "parcel check", "rider ke samne", "open delivery"],
        "hit_count": 11,
    },
    {
        "title": "Aap konse courier partners use karte hain?",
        "topic": "shipping",
        "approved_content": (
            "Hum Pakistan ke top trusted couriers use karte hain: TCS, Leopards Courier, Trax, aur Call Courier. "
            "Har parcel live tracking ID ke saath dispatch hota hai."
        ),
        "keywords": ["courier", "tcs", "leopards", "trax", "rider company"],
        "hit_count": 3,
    },
    {
        "title": "Apna order live track kaise karein?",
        "topic": "shipping",
        "approved_content": (
            "Aap hamari official website https://ai-whatsapp-power-git-main-hamzachaudhary786s-projects.vercel.app/ par 'Track Your Order' section mein apna Order ID (e.g. ORD-20261013-1001) daal kar foran live status dekh saktay hain, "
            "ya chat mein bas apna Order ID likhein to Aria aapko live courier location aur delivery date bata degi!"
        ),
        "keywords": ["track order", "order tracking", "kahan pohancha", "where is my order", "live tracking"],
        "hit_count": 9,
    },
    {
        "title": "Agar delivery ke waqt ghar par koi na ho to kya hoga?",
        "topic": "shipping",
        "approved_content": (
            "Courier rider aam taur par 2 se 3 martaba delivery attempt karta hai aur pehle aapko phone call karta hai. "
            "Aap rider ko aglay din ka time bhi de saktay hain."
        ),
        "keywords": ["ghar par nahi", "missed delivery", "rider call", "re delivery"],
        "hit_count": 3,
    },
    {
        "title": "Kya international shipping dastiyab hai (UK, USA, UAE)?",
        "topic": "shipping",
        "approved_content": (
            "Jee haan! Hum DHL aur FedEx ke zariye UK, USA, UAE, Canada, aur Europe mein overseas delivery provide karte hain. "
            "International orders aam taur par 5 se 7 working days mein deliver ho jatay hain (Credit card ya Bank Transfer advance zaroori hai)."
        ),
        "keywords": ["international shipping", "uk", "usa", "uae", "overseas", "bahir ka order"],
        "hit_count": 6,
    },

    # --- SIZING, MEASUREMENTS & CUSTOM FIT ---
    {
        "title": "Size Guide aur Size Chart kahan se dekh saktay hain?",
        "topic": "sizing",
        "approved_content": (
            "Hamare standard sizes yeh hain:\n"
            "• Extra Small (XS): Chest 34\", Waist 26\", Hips 36\"\n"
            "• Small (S): Chest 36\", Waist 28\", Hips 38\"\n"
            "• Medium (M): Chest 39\", Waist 31\", Hips 41\"\n"
            "• Large (L): Chest 42\", Waist 34\", Hips 44\"\n"
            "• Extra Large (XL): Chest 45\", Waist 37\", Hips 47\"\n"
            "Standard Shirt/Dress Length 48\" se 54\" hoti hai. Chat mein apna measurement batayein, Aria perfect size suggest kar degi!"
        ),
        "keywords": ["size chart", "size guide", "medium size", "large size", "small size", "measurement", "chest size"],
        "hit_count": 16,
    },
    {
        "title": "Agar do sizes ke darmiyan confuse hoon to konsa size chunon?",
        "topic": "sizing",
        "approved_content": (
            "Agar aapka measurement do sizes ke darmiyan fall karta hai, to hum hamesha 1 size bara (larger size) chunne ka mashwara dete hain. "
            "Bara size asani se halka sa alter/fit ho sakta hai jabkay chhota size tight ho sakta hai."
        ),
        "keywords": ["confused in size", "size up", "size down", "in between sizes", "konsa size loon"],
        "hit_count": 8,
    },
    {
        "title": "Kya custom stitching aur tailored alterations available hain?",
        "topic": "sizing",
        "approved_content": (
            "Jee haan! Hamara atelier in-house bespoke stitching aur size alterations provide karta hai. "
            "Aap apna exact chest, kamar (waist), aur lambai (length) inches mein likh kar bhein, dress aapke exact body fit ke mutabiq stitch hoga!"
        ),
        "keywords": ["custom stitching", "alteration", "custom fit", "apne naap ka", "tailoring", "apni lambai"],
        "hit_count": 7,
    },
    {
        "title": "Kya custom stitching ke extra charges hotay hain?",
        "topic": "sizing",
        "approved_content": (
            "Minor fitting aur length adjustment bilkul FREE hoti hai! "
            "Mukammal bespoke custom bridal ya heavy tailoring par aik nominal charge hota hai jo order confirm karne se pehle bata diya jata hai."
        ),
        "keywords": ["custom charges", "extra stitching charges", "alteration fee", "tailor fee"],
        "hit_count": 4,
    },
    {
        "title": "Plus size (XL aur XXL) available hain?",
        "topic": "sizing",
        "approved_content": (
            "Jee haan! Luxe Atelier inclusive fashion ko support karta hai. Hamare maximum outfits XL aur XXL sizes mein bhi ready to wear dastiyab hain."
        ),
        "keywords": ["plus size", "xxl", "xl dress", "bara size", "healthy size"],
        "hit_count": 5,
    },

    # --- FABRIC & QUALITY ---
    {
        "title": "Kya aapka fabric 100% genuine aur authentic hai?",
        "topic": "fabric",
        "approved_content": (
            "100% Guaranteed! Hum sirf premium certified pure fabrics use karte hain: Pure Silk Crepe, Royal Velvet, Imported Satin, aur Breathable Organic Cotton/Linen. "
            "Har piece par atelier inspection seal lagi hoti hai."
        ),
        "keywords": ["fabric", "original", "genuine fabric", "kapra kaisa hai", "pure silk", "kapray ki quality"],
        "hit_count": 13,
    },
    {
        "title": "Dress ko wash aur care kaise karna chahiye?",
        "topic": "fabric",
        "approved_content": (
            "• Silk, Satin aur Velvet outfits ke liye Dry Clean recommended hai.\n"
            "• Cotton aur Linen dresses ko mild detergent ke saath cold water mein hand wash ya gentle cycle par dhoen.\n"
            "• Direct taiz dhoop mein sukhanay se parhez karein aur reverse side par steam iron karein."
        ),
        "keywords": ["wash care", "washing", "dry clean", "dhone ka tareeqa", "iron", "istri"],
        "hit_count": 6,
    },
    {
        "title": "Kya dhoone ke baad kapray ka rang utrega ya shrink hoga?",
        "topic": "fabric",
        "approved_content": (
            "Bilkul nahi! Hamare tamam fabrics pre-washed aur color-fasted hotay hain. Normal care instructions follow karne par na rang pheelta hai aur na kapra shrink hota hai."
        ),
        "keywords": ["color bleeding", "rang utarna", "shrink", "color fade", "rang kharab"],
        "hit_count": 7,
    },
    {
        "title": "Kya sheer (transparent) dresses ke saath slip/lining shamil hoti hai?",
        "topic": "fabric",
        "approved_content": (
            "Jee haan! Tamam Chiffon, Organza, aur Georgette dresses ke saath matching pure soft silk ya cotton lining (slip/shamooz) attached ya complimentary shamil hoti hai."
        ),
        "keywords": ["lining", "slip", "shamooz", "transparent", "andar ka kapra", "sheer"],
        "hit_count": 5,
    },
    {
        "title": "Summer aur Winter ke liye konse fabrics available hain?",
        "topic": "fabric",
        "approved_content": (
            "Garmion (Summer) ke liye: Pure Lawn, Soft Linen, Swiss Cotton, aur Chiffon.\n"
            "Sardion (Winter) ke liye: Royal Micro Velvet, Pashmina Shawls, Marina, aur Karandi Suits."
        ),
        "keywords": ["summer collection", "winter collection", "garmian", "sardian", "lawn", "velvet"],
        "hit_count": 6,
    },

    # --- RETURNS, EXCHANGES & REFUNDS ---
    {
        "title": "Return aur Exchange policy kya hai?",
        "topic": "returns",
        "approved_content": (
            "Luxe Atelier 7-Day Hassle-Free Exchange Policy offer karta hai! "
            "Agar size fit na ho ya color pasand na aaye, to delivery ke 7 din ke andar aap complimentary exchange karwa saktay hain (tags intact aur unworn hone chahiyein)."
        ),
        "keywords": ["return policy", "exchange policy", "wapas karna", "badalna", "exchange", "return"],
        "hit_count": 17,
    },
    {
        "title": "Exchange karwane ka tareeqa kya hai?",
        "topic": "returns",
        "approved_content": (
            "Exchange karwana nihayat aasan hai:\n"
            "1. Chat par apna Order ID aur required new size share karein.\n"
            "2. Hamara courier rider aapke ghar aakar naya parcel de jayega aur purana parcel wapas collect kar lega (Reverse Pickup)!"
        ),
        "keywords": ["how to exchange", "exchange kaise karein", "size badalna", "wapsi ka tareeqa"],
        "hit_count": 10,
    },
    {
        "title": "Refund kitne dinon mein transfer hota hai?",
        "topic": "returns",
        "approved_content": (
            "Item wapas hamare warehouse receive aur inspect hone ke baad 48 se 72 ghanton ke andar aapka refund direct Bank Account, JazzCash, ya EasyPaisa mein transfer kar diya jata hai."
        ),
        "keywords": ["refund", "paise wapas", "refund timing", "jazzcash refund", "easypaisa refund"],
        "hit_count": 8,
    },
    {
        "title": "Agar parcel mein damaged ya galat item nikal aaye to kya karein?",
        "topic": "returns",
        "approved_content": (
            "Agar aisi koi ghalti ho, to hum foran Priority Express replacement baghair kisi shipping charge ke dispatch karte hain! "
            "Bas parcel ki aik photo chat par share kar dein, hamari team foran issue solve karegi."
        ),
        "keywords": ["damaged item", "kharaab dress", "wrong item", "galat dress", "defect", "phata hua"],
        "hit_count": 6,
    },

    # --- PAYMENTS & DISCOUNTS ---
    {
        "title": "Payment ke konse tareeqay dastiyab hain?",
        "topic": "payment",
        "approved_content": (
            "Hum Cash on Delivery (COD), Online Direct Bank Transfer, JazzCash, EasyPaisa, aur Debit/Credit Card (Visa/Mastercard) accept karte hain."
        ),
        "keywords": ["payment methods", "bank transfer", "jazzcash", "easypaisa", "credit card", "payment options"],
        "hit_count": 11,
    },
    {
        "title": "Kya koi active discount code ya voucher hai?",
        "topic": "promotions",
        "approved_content": (
            "Jee haan! Abhi hamara VIP promo code 'VIPSTYLE10' active hai jo aapko aapke order par flat 10% discount provide karta hai! "
            "Checkout par ya chat mein yeh code bhein to discount foran apply ho jayega."
        ),
        "keywords": ["discount code", "promo code", "voucher", "coupon", "discount", "offer"],
        "hit_count": 12,
    },
    {
        "title": "First order par kya special discount milta hai?",
        "topic": "promotions",
        "approved_content": (
            "Naye customers ke liye hamare paas special welcome courtesy discount hai! "
            "Aap code 'WELCOME10' use kar ke apne pehle order par 10% off + Free Express Delivery enjoy kar saktay hain."
        ),
        "keywords": ["first order", "first order discount", "welcome discount", "pehla order"],
        "hit_count": 9,
    },
    {
        "title": "Kya bulk orders ya shadi ke joron par discount milta hai?",
        "topic": "promotions",
        "approved_content": (
            "Jee haan! 4 ya us se zyada suits / bridal party packages par special wholesale & corporate discounts dastiyab hain. "
            "Aap chat mein apni quantity share karein, hum tailored quotation send kar denge."
        ),
        "keywords": ["bulk order", "wholesale", "shadi dresses", "zyada suits", "package discount"],
        "hit_count": 5,
    },

    # --- BRIDAL, PARTY WEAR & BOUTIQUE ---
    {
        "title": "Bridal aur Heavy Formal Couture ka delivery time kya hai?",
        "topic": "bridal",
        "approved_content": (
            "Handcrafted Bridal aur Formal Couture outfits ko tayar hone mein 3 se 4 haftay lagtay hain kyunke har piece par hand zardozi, gota, aur stone work kiya jata hai. "
            "Urgent bridal bookings ke liye kam az kam 15 din pehle contact karein."
        ),
        "keywords": ["bridal wear", "shadi ka jora", "dulhan", "bridal couture", "heavy formal", "shadi dress"],
        "hit_count": 8,
    },
    {
        "title": "Kya physical boutique store ya outlet visit kar saktay hain?",
        "topic": "boutique",
        "approved_content": (
            "Jee haan! Hamara flagship luxury atelier boutique DHA Phase 5, Lahore aur Clifton, Karachi mein waqay hai. "
            "Timings: Peer se Itwaar (Monday to Sunday) Subah 11:00 AM se Raat 10:00 PM tak."
        ),
        "keywords": ["store address", "outlet", "shop location", "dukan kahan hai", "visit store", "physical shop"],
        "hit_count": 9,
    },
    {
        "title": "Kya fitting ya trial ke liye appointment zaroori hai?",
        "topic": "boutique",
        "approved_content": (
            "Ready-to-wear catalog ke liye appointment zaroori nahi hai, aap kisi bhi waqt visit kar saktay hain. "
            "Custom Bridal Couture aur Master Stylist consultation ke liye chat par time slot book karwana behtar hai."
        ),
        "keywords": ["appointment", "trial", "fitting", "booking", "stylist consultation"],
        "hit_count": 4,
    },
    {
        "title": "Dresses ke saath matching dupatta aur trousers shamil hotay hain?",
        "topic": "products",
        "approved_content": (
            "Hamare tamam Eastern sets (3-Piece) mein Shirt/Kameez, matching Trouser/Pants, aur Dupatta shamil hota hai. "
            "Maxis aur Western Gowns ke saath details product description mein clearly likhi hoti hain."
        ),
        "keywords": ["dupatta", "trouser", "3 piece", "2 piece", "complete suit", "matching pants"],
        "hit_count": 7,
    },
    {
        "title": "Customer support ke timings kya hain?",
        "topic": "support",
        "approved_content": (
            "Hamari AI Fashion Stylist Aria 24/7 available hai! "
            "Aur hamare human live staff specialists subah 9:00 AM se raat 11:00 PM tak live chat aur WhatsApp par active rehtay hain."
        ),
        "keywords": ["support timing", "timing", "kab tak open hai", "helpline", "rabta ka waqt"],
        "hit_count": 5,
    },
    {
        "title": "Human agent ya live staff se baat kaise karoon?",
        "topic": "support",
        "approved_content": (
            "Aap chat mein bas 'Talk to human', 'Agent', ya 'Staff se baat karni hai' likh kar send karein. "
            "Aria foran aapki chat hamare live human staff specialist ko transfer kar degi!"
        ),
        "keywords": ["human agent", "talk to human", "live agent", "staff se baat", "insan se baat", "representative"],
        "hit_count": 11,
    },
    {
        "title": "Kya packaging gift box mein aati hai?",
        "topic": "products",
        "approved_content": (
            "Jee haan! Tamam orders hamari signature luxury satin-ribbon box packaging mein deliver hotay hain jo gift dene ke liye bilkul perfect hai. "
            "Agar aap gift card message add karwana chahte hain to checkout par mention karein!"
        ),
        "keywords": ["gift box", "packaging", "gift packing", "dabba", "gift packing available"],
        "hit_count": 4,
    },
    {
        "title": "Color customization kisi dress mein ho sakti hai?",
        "topic": "products",
        "approved_content": (
            "Jee haan! Selected made-to-order outfits mein hum customized color dyeing offer karte hain. "
            "Aap apna pasandeeda color swatch ya shade code chat par bhein, hum atelier se check kar ke confirm kar denge."
        ),
        "keywords": ["color customization", "doosra rang", "custom color", "apni marzi ka rang", "dyeing"],
        "hit_count": 5,
    },
    {
        "title": "Kya delivery se pehle call aati hai?",
        "topic": "shipping",
        "approved_content": (
            "Jee haan! Courier rider parcel deliver karne se lagbhag 1 se 2 ghantay pehle aapko call karta hai taake delivery timing confirm ho sakay."
        ),
        "keywords": ["rider call", "pehle call karega", "phone aayega", "delivery call"],
        "hit_count": 5,
    },
    {
        "title": "EasyPaisa aur JazzCash se payment kaise karein?",
        "topic": "payment",
        "approved_content": (
            "Aap hamare official JazzCash ya EasyPaisa Merchant account par direct transfer kar saktay hain. "
            "Checkout par payment method 'Bank / Mobile Wallet' select karein ya chat mein hum aapko official account number provide kar denge."
        ),
        "keywords": ["easypaisa", "jazzcash", "mobile account", "easypaisa number"],
        "hit_count": 6,
    },
    {
        "title": "Kya aapke paas modest wear ya abayas available hain?",
        "topic": "products",
        "approved_content": (
            "Jee haan! Hamara Modest Wear collection high-neck full-sleeve maxis, flowy crepe abayas, aur graceful modest silhouettes par mushtamil hai."
        ),
        "keywords": ["modest wear", "abaya", "hijab dress", "full sleeves", "parda dress"],
        "hit_count": 6,
    },
    {
        "title": "Lawn collection kab launch hoti hai?",
        "topic": "products",
        "approved_content": (
            "Hamari Designer Luxury Lawn Collection har saal February aur March ke shuru mein launch hoti hai jisme pure silk dupattas aur schiffli embroidery shamil hoti hai."
        ),
        "keywords": ["lawn collection", "summer lawn", "lawn launch", "garmi k kapray"],
        "hit_count": 4,
    },
    {
        "title": "Velvet suits mein konse colors sabse zyada popular hain?",
        "topic": "products",
        "approved_content": (
            "Hamare Micro-9000 Velvet mein sabse zyada in-demand colors: Royal Emerald Green, Deep Crimson Red, Midnight Plum, aur Obsidian Black hain!"
        ),
        "keywords": ["velvet", "velvet suit", "makhmal", "velvet color", "winter velvet"],
        "hit_count": 6,
    },
    {
        "title": "Party wear dresses ki price range kya hai?",
        "topic": "products",
        "approved_content": (
            "Hamare ready-to-wear party outfits $45 (PKR 4,500) se shuru hotay hain aur luxury hand-embellished couture pieces $120 tak jatay hain. "
            "Tamam prices website aur chat catalog par transparently display hoti hain."
        ),
        "keywords": ["price range", "qeemat kitni hai", "rate kya hai", "party dress price", "kitne ka hai"],
        "hit_count": 10,
    },
    {
        "title": "Sahiwal, Lahore aur Karachi mein delivery kitni jaldi hoti hai?",
        "topic": "shipping",
        "approved_content": (
            "Lahore, Karachi, Islamabad aur Sahiwal mein orders priority courier dispatch ke zariye sirf 24 se 48 ghanton ke andar deliver kar diye jatay hain!"
        ),
        "keywords": ["sahiwal delivery", "lahore delivery", "karachi delivery", "fastest delivery"],
        "hit_count": 7,
    },
    {
        "title": "Kya order track karne ke liye email ya phone number zaroori hai?",
        "topic": "orders",
        "approved_content": (
            "Order track karne ke liye sirf aapka Order ID (jaise #ORD-20261013-1001) kaafi hai! "
            "Agar Order ID gum ho jaye, to aap apna registered phone number likh kar bhi orders check karwa saktay hain."
        ),
        "keywords": ["lost order id", "track by phone", "phone se track", "order number gum gaya"],
        "hit_count": 4,
    },
    {
        "title": "Luxe Atelier ki khas baat kya hai?",
        "topic": "boutique",
        "approved_content": (
            "Luxe Atelier AI-powered styling consultation, 100% pure handcrafted fabrics, bespoke tailoring fit, aur Free Express Delivery with Cash on Delivery ke saath Pakistan ka sabse modern luxury fashion experience provide karta hai!"
        ),
        "keywords": ["about us", "khas baat", "why choose", "luxe atelier", "boutique quality"],
        "hit_count": 4,
    },
    {
        "title": "Velvet suits ko off-season mein store kaise karein?",
        "topic": "fabric",
        "approved_content": (
            "Velvet outfits ko hamesha dry clean karwa kar breathable cotton garment bag mein hang karein. "
            "Inhe plastic bags mein na rakhein aur fold karne ke bajaye hanger par hang karein taake crease marks na parein."
        ),
        "keywords": ["velvet storage", "sambhalna", "off season storage", "velvet care", "velvet rakhna"],
        "hit_count": 3,
    },
    {
        "title": "Kya bohot mehnge bridal suits par bhi COD milta hai?",
        "topic": "payment",
        "approved_content": (
            "PKR 25,000 tak ke orders par 100% Cash on Delivery (COD) dastiyab hai. "
            "Bespoke Bridal Couture (PKR 50,000+) orders ke liye custom handcrafted making shuru karne ke liye sirf 20% advance commitment token deposit hota hai, baqi 80% delivery ke waqt COD hota hai!"
        ),
        "keywords": ["cod limit", "expensive suit", "bridal cod", "mehanga jora", "advance for bridal"],
        "hit_count": 5,
    },
]

async def seed_faqs():
    await connect_to_mongo()
    db = get_database()
    print("[INFO] Seeding 50+ Comprehensive Fashion Boutique FAQs...")

    now = datetime.now(timezone.utc)
    inserted_count = 0
    updated_count = 0

    for faq in FAQS:
        filter_q = {"title": faq["title"]}
        doc = {
            "title": faq["title"],
            "topic": faq["topic"],
            "approved_content": faq["approved_content"],
            "keywords": faq.get("keywords", []),
            "hit_count": faq.get("hit_count", 1),
            "language": "none",
            "updated_at": now,
        }
        res = await db["faq_documents"].update_one(filter_q, {"$set": doc, "$setOnInsert": {"created_at": now}}, upsert=True)
        if res.upserted_id:
            inserted_count += 1
        else:
            updated_count += 1

    total = await db["faq_documents"].count_documents({})
    print(f"[SUCCESS] FAQs database initialized! Total in DB: {total} (Newly inserted: {inserted_count}, Updated: {updated_count})")
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(seed_faqs())
