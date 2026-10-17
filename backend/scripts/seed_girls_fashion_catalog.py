import asyncio
import os
import re
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
DB_NAME = os.getenv("MONGODB_DB_NAME", "whatsapp_fashion_db")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text).strip("-")


# 20 Top Girls / Women Fashion Categories
CATEGORIES_DATA = [
    {
        "name": "Maxi & Evening Dresses",
        "description": "Floor-length evening silhouettes, gala gowns, and satin maxi dresses.",
        "image_url": "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80",
        "prefix": "MAXI",
        "items": [
            "Royal Emerald Satin Slip Maxi", "Midnight Velvet Slit Gown", "Rose Gold Sequin Gala Dress",
            "Mulberry Silk Cowl Neck Maxi", "Plum Chiffon Tiered Evening Gown", "Champagne Shimmer Backless Maxi",
            "Sapphire Pleated One-Shoulder Dress", "Obsidian Black Halter Maxi", "Blush Tulle Empire Silhouette",
            "Crimson Crepe Column Gown", "Lilac Cascade Ruffle Maxi", "Vintage Jacquard Brocade Dress",
            "Pearl White Silk Bias Cut Gown", "Bronze Metallic Drape Maxi", "Forest Green Velvet Corset Gown"
        ]
    },
    {
        "name": "Casual Day Dresses",
        "description": "Breezy sundresses, linen shirt-dresses, and daytime casual frocks.",
        "image_url": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80",
        "prefix": "CDAY",
        "items": [
            "Linen Button-Front Shirt Dress", "Pastel Daisy Tiered Sundress", "Gingham Puff Sleeve Smock Dress",
            "Cotton Eyelet A-Line Sundress", "Denim Utility Midi Dress", "Sage Ribbed Knit Polo Dress",
            "Boho Floral Wrap Midi Dress", "Chambray Tied Waist Day Dress", "Lemon Print Cottagecore Frock",
            "Terracotta Washed Cotton Dress", "Striped Breton Nautical Midi", "Olive Drawstring Waist Shirt Dress",
            "Dusty Pink Poplin Babydoll Dress", "Sky Blue Ruffle Hem Day Dress", "Earthy Sand Pocket Linen Dress"
        ]
    },
    {
        "name": "Party Wear Gowns",
        "description": "Glittering cocktail dresses, sequin minis, and party-ready silhouettes.",
        "image_url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80",
        "prefix": "PTYW",
        "items": [
            "Starlight Silver Glitter Mini", "Midnight Velvet Bodycon Dress", "Golden Hour Feather Trim Dress",
            "Ruby Red Ruched Mesh Cocktail Dress", "Holographic Crystal Mini Dress", "Obsidian Strapless Corset Mini",
            "Emerald Shimmer Fringe Party Gown", "Neon Fuchsia Asymmetric Cocktail Dress", "Champagne Satin Blazer Dress",
            "Amethyst Sparkle Slip Dress", "Midnight Star Sequin Bodycon", "Rose Gold Metallic Pleat Gown",
            "Electric Blue Cut-Out Mini", "Diamond Dust Off-Shoulder Gown", "Black Mirror Disc Party Dress"
        ]
    },
    {
        "name": "Kurti & Traditional Tunics",
        "description": "Handcrafted ethnic kurtis, embroidered tunics, and modern block-print shirts.",
        "image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80",
        "prefix": "KURT",
        "items": [
            "Kashmiri Chikan Embroidered Kurti", "Indigo Block Print Lawn Kurti", "Mustard Mirror-Work Tunic",
            "Raw Silk Floral Embroidered Kurti", "Maroon Angrakha Flared Tunic", "Mint Green Organza Panel Kurti",
            "Ivory Jacquard A-Line Kurti", "Navy Blue Resham Thread Kurti", "Zari Bordered Festive Kurti",
            "Terracotta Cotton Slub Kurti", "Peach Georgette Flared Peplum Tunic", "Teal Gotta Patti Embellished Kurti",
            "Charcoal Black Ajrakh Print Kurti", "Dusty Lilac Schiffli Kurti", "Turquoise Bandhani Print Tunic"
        ]
    },
    {
        "name": "Shalwar Kameez & Eastern Sets",
        "description": "Complete 2-piece and 3-piece Eastern unstitched & ready-to-wear ensembles.",
        "image_url": "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80",
        "prefix": "SHAL",
        "items": [
            "Embroidered Lawn 3-Piece Silk Dupatta", "Raw Silk Luxury Pret 2-Piece Suit", "Chikankari Cotton Shalwar Set",
            "Velvet Embroidered Winter Pret Ensemble", "Pastel Organza Embroidered 3-Piece", "Jacquard Gold Weaved Festive Set",
            "Banarasi Chiffon Embroidered Suit", "Classic Ivory Linen 2-Piece Co-ord", "Sunset Coral Digital Print Lawn Set",
            "Royal Blue Mirror-Work Festive Pret", "Sage Green Cotton Net 3-Piece", "Deep Maroon Zardozi Thread Suit",
            "Mustard Yellow Haldi Festive 3-Piece", "Plum Embroidered Khaddar Winter Set", "Charcoal Grey Thread Embroidered Suit"
        ]
    },
    {
        "name": "Silk Blouses & Elegant Tops",
        "description": "Pure silk button-ups, cowl necks, satin tops, and office blouses.",
        "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80",
        "prefix": "BLOU",
        "items": [
            "Ivory Silk Satin Cowl Neck Top", "Champagne Silk French Cuff Shirt", "Emerald Tie-Neck Pussybow Blouse",
            "Dusty Rose Silk Crepe Camisole", "Midnight Blue Draped Wrap Blouse", "Pearl Button Tailored Silk Shirt",
            "Crimson Red Silk Bishop Sleeve Top", "Sage Green Minimalist Silk Tank", "Lavender Hammered Satin Blouse",
            "Black Sheer Sleeve Silk Top", "Polka Dot Silk Chiffon Blouse", "Burnt Orange Fluted Sleeve Top",
            "Classic White Mulberry Silk Blouse", "Mocha Brown Draped Silk Bodysuit", "Silver Metallic Woven Silk Top"
        ]
    },
    {
        "name": "Crop Tops & Casual Tees",
        "description": "Ribbed crop tops, graphic tees, corset camis, and daily essentials.",
        "image_url": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
        "prefix": "CROP",
        "items": [
            "Ribbed Sweetheart Corset Crop Top", "Minimalist Parisian Graphic Tee", "Seamless High-Neck Racerback Crop",
            "Linen Tied-Front Summer Crop Top", "Vintage Washed Cotton Boyfriend Tee", "Crochet Square Neck Bralette Top",
            "Smocked Floral Ruffle Crop Top", "Asymmetric One-Shoulder Fitted Tee", "Heavyweight Boxy Organic Cotton Tee",
            "Striped Baby Tee with Contrast Trim", "Mesh Long-Sleeve Illusion Crop", "Satin Lace-Trimmed Cami Top",
            "Distressed Vintage Band Graphic Tee", "Bandeau Tube Top in Sage Green", "Ruching Detail Scoop Neck Tee"
        ]
    },
    {
        "name": "Tailored Blazers & Power Suits",
        "description": "Double-breasted blazers, tweed jackets, and sharp co-ordinated suits.",
        "image_url": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80",
        "prefix": "BLAZ",
        "items": [
            "Oversized Sand Wool-Blend Blazer", "Double-Breasted Houndstooth Tweed Jacket", "Midnight Pinstripe Tailored Suit Blazer",
            "Cream Boucle Cropped Trophy Jacket", "Emerald Satin Tuxedo Blazer", "Charcoal Grey Structured Power Blazer",
            "Sky Blue Belted Linen Blazer", "Camel Hair Classic Tailored Jacket", "Blush Pink Peak Lapel Blazer",
            "Monochrome Check Boxy Blazer", "Rust Orange Flap Pocket Blazer", "Black Velvet Evening Smoking Jacket",
            "Olive Green Double-Vent Safari Blazer", "Vanilla Tailored Vest & Blazer Duo", "Espresso Wool Cashmere Blazer"
        ]
    },
    {
        "name": "Winter Coats & Jackets",
        "description": "Cashmere blend trench coats, shearling jackets, and warm puffer outerwear.",
        "image_url": "https://images.unsplash.com/photo-1539533018447-63fcce667883?auto=format&fit=crop&w=600&q=80",
        "prefix": "COAT",
        "items": [
            "Cashmere-Wool Camel Wrap Coat", "Water-Resistant Belted Trench Coat", "Faux Shearling Aviator Biker Jacket",
            "Quilted Feather-Light Down Puffer", "Double-Faced Wool Blanket Coat", "Teddy Sherpa Oversized Cocoon Jacket",
            "Faux Leather Belted Matrix Trench", "Heritage Plaid Wool Duster Coat", "Chocolate Brown Cropped Puffer",
            "Winter White Boucle Overcoat", "Olive Sherpa Collar Field Jacket", "Charcoal Cocoon Wool Overcoat",
            "Midnight Navy Military Gold-Button Coat", "Burgundy Patent Gloss Trench Coat", "Ivory Faux Fur Glamour Jacket"
        ]
    },
    {
        "name": "Denim & High-Rise Jeans",
        "description": "Wide-leg jeans, straight-leg denim, mom fit, and vintage washes.",
        "image_url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80",
        "prefix": "JEAN",
        "items": [
            "High-Rise Vintage Wide Leg Jeans", "Classic 90s Straight Leg Denim", "Ultra High Rise Raw Hem Flare Jeans",
            "Relaxed Baggy Carpenter Denim", "Ecru Off-White High Waist Jeans", "Distressed Light Wash Mom Jeans",
            "Charcoal Washed Dad Fit Denim", "Split-Hem Bootcut Indigo Jeans", "Rigid Cotton High-Rise Barrel Jeans",
            "Dark Indigo Sculpting Skinny Jeans", "Bleached Acid Wash Wide Leg Jeans", "Patchwork Contrast Denim Trousers",
            "Cargo Pocket Wide-Leg Jean", "Cropped Kick-Flare Vintage Blue Denim", "Washed Olive Green Denim Pants"
        ]
    },
    {
        "name": "Wide-Leg Trousers & Tailored Pants",
        "description": "Pleated palazzo pants, linen trousers, and tailored cigarette bottoms.",
        "image_url": "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80",
        "prefix": "TRSR",
        "items": [
            "Double-Pleated Tailored Wide Trousers", "High-Waist Belgian Linen Palazzos", "Midnight Navy Pinstripe Slacks",
            "Ivory Crepe Paperbag Waist Trousers", "Sage Green Belted Cigarette Pants", "Espresso Fluid Drape Trousers",
            "Mocha Satin Fluid Wide-Leg Slacks", "Tailored Front-Seam Ankle Pants", "Camel Elasticated Waist Resort Trousers",
            "Terracotta Cotton Chino Trousers", "Chalk White Flared Crepe Trousers", "Olive Draped Utility Cargo Trousers",
            "Houndstooth Slim-Fit Cropped Slacks", "Black Satin Tuxedo Stripe Pants", "Powder Blue Pleated Smart Trousers"
        ]
    },
    {
        "name": "Midi & Pleated Skirts",
        "description": "Satin bias cut skirts, accordion pleats, and denim maxi skirts.",
        "image_url": "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=600&q=80",
        "prefix": "SKRT",
        "items": [
            "Champagne Satin Bias Cut Midi Skirt", "Emerald Green Accordion Pleated Skirt", "Vintage Blue Slit Denim Maxi Skirt",
            "Tulle Layered Ballerina Midi Skirt", "Leather Look A-Line Midi Skirt", "Bohemian Tiered Ruffle Chiffon Skirt",
            "Plaid Wool High-Rise Mini Skirt", "Linen Button-Down Front Midi Skirt", "Floral Print Georgette Flared Skirt",
            "Rose Gold Metallic Shimmer Skirt", "Black Ribbed Knit Column Skirt", "Chocolate Brown Suede A-Line Skirt",
            "Sage Green Wrap Midi Skirt", "Navy Polka Dot Swing Skirt", "Structured Jacquard Pencil Skirt"
        ]
    },
    {
        "name": "Luxury Abayas & Modest Wear",
        "description": "Open front kimonos, embellished Eid abayas, and flowy kaftans.",
        "image_url": "https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=600&q=80",
        "prefix": "ABAY",
        "items": [
            "Pearl Embellished Nida Cloth Abaya", "Raw Silk Front-Open Kimono Abaya", "Moroccan Embroidered Festive Kaftan",
            "Dusty Rose Pleated Layered Abaya", "Charcoal Linen Minimalist Daily Abaya", "Sage Green Satin Flare Sleeve Abaya",
            "Black Velvet Winter Gala Abaya", "Bisht Silhouette Golden Thread Abaya", "Midnight Navy Chiffon Cape Abaya",
            "Crinkled Crepe Everyday Modest Robe", "Lace Bordered Wedding Guest Abaya", "Taupe Textured Jacquard Abaya",
            "Emerald Green Belted Flowing Kaftan", "Metallic Thread Weaved Organza Abaya", "Pure Black Classic Dubai Cut Abaya"
        ]
    },
    {
        "name": "Co-ord & Loungewear Sets",
        "description": "Matching 2-piece linen sets, waffle loungewear, and travel co-ords.",
        "image_url": "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=600&q=80",
        "prefix": "CORD",
        "items": [
            "Sage Green 100% Linen 2-Piece Set", "Waffle Knit Relaxed Lounge Set", "Ribbed Cashmere Blend Travel Co-ord",
            "Oversized Poplin Shirt & Shorts Set", "Silk Satin Pajama Style Co-ord", "Monochrome Knit Top & Trouser Duo",
            "Dusty Pink Terry Cotton Sweat Set", "Striped Resort Relaxed Co-ord", "Cream Cable Knit Lounge Ensemble",
            "Black Minimalist Pleat Co-ord Set", "Terracotta Tie-Waist Pant & Shirt Set", "Lavender Cotton Cloud Lounge Set",
            "Olive Green Utility Cargo Co-ord", "Sand Stone Woven Resort Wear Set", "Sky Blue French Terry Short Co-ord"
        ]
    },
    {
        "name": "Bridal & Festive Wear",
        "description": "Hand-worked lehengas, embroidered ghararas, and wedding couture.",
        "image_url": "https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=600&q=80",
        "prefix": "BRID",
        "items": [
            "Hand-Embroidered Zardozi Crimson Lehenga", "Ivory Pearl & Mukaish Bridal Pishwas", "Rose Gold Dabka Work Net Gharara",
            "Deep Plum Velvet Handcrafted Anarkali", "Emerald Green Gotta Kinari Festive Angrakha", "Blush Pink Swarovski Crystal Lehenga",
            "Rust Orange Raw Silk Mehendi Outfit", "Maroon Katan Silk Heavy Bridal Ensemble", "Mustard Banarasi Weave Sangeet Lehenga",
            "Silver Tilla Embroidery Formal Maxi", "Pastel Mint Organza Embellished Pishwas", "Gold Zari Weaved Heavy Barat Lehnga",
            "Royal Blue Mirror-Work Walima Gown", "Peach Resham Handworked Festive Gharara", "Coral Red Traditional Shehnai Bridal Set"
        ]
    },
    {
        "name": "Cardigans & Knitwear",
        "description": "Oversized chunky sweaters, cropped cardigans, and cashmere turtlenecks.",
        "image_url": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80",
        "prefix": "KNIT",
        "items": [
            "Cable Knit Chunky Oversized Cardigan", "Pure Cashmere Mock Neck Sweater", "Cropped Pearl-Button Boucle Cardigan",
            "Mohair Blend Fluffy Pastel Jumper", "Ribbed Turtleneck Essential Knit", "Diamond Argyle Preppy Knit Vest",
            "Oatmeal Melange Open-Front Duster Knit", "Vintage Floral Embroidered Cardigan", "Striped Nautical Soft Knit Pullover",
            "Dusty Lilac Balloon Sleeve Sweater", "Forest Green Chunky Fisherman Knit", "Ivory Fine-Knit Lightweight Sweater",
            "Chocolate Brown Ribbed Knit Polo", "Mustard Yellow Cable Knit Crop", "Charcoal Heathered Slouchy Knit"
        ]
    },
    {
        "name": "Summer Floral Frocks",
        "description": "Breezy printed frocks, tiered mini dresses, and vacation outfits.",
        "image_url": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80",
        "prefix": "FROK",
        "items": [
            "Wildflower Chiffon Tiered Frock", "Sunflower Print Halter Neck Summer Dress", "Blue Bell Poplin Smocked Mini Frock",
            "Tropical Palm Breeze Midi Frock", "Lavender Blossom Ruffle Hem Frock", "Pink Peony Tied Shoulder Summer Dress",
            "Daisy Meadow Cottagecore Tiered Frock", "Watercolor Floral Chiffon Babydoll", "Cherry Blossom Wrap Around Mini Frock",
            "Retro 70s Poppy Print Mod Frock", "Botanical Herbarium Lawn Casual Frock", "Sunburst Marigold Flared Summer Frock",
            "Vintage Rose Print A-Line Frock", "Mint Fern Eyelet Summer Dress", "Sunset Orchid Flowy Tiered Frock"
        ]
    },
    {
        "name": "Formal Workwear & Shirts",
        "description": "Crisp poplin office shirts, tailored pencil skirts, and smart formal wear.",
        "image_url": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80",
        "prefix": "WORK",
        "items": [
            "Crisp White Poplin Tailored Shirt", "Powder Blue French Cuff Banker Shirt", "Navy Formal Peplum Work Blouse",
            "High-Waisted Structured Pencil Skirt", "Camel Crepe Smart Office Trousers", "Pinstripe Cotton Structured Work Shirt",
            "Grey Tweed Tailored Executive Shift Dress", "Ivory Concealed Placket Formal Shirt", "Olive Green Tie-Neck Corporate Top",
            "Black Flute Hem Smart Work Dress", "Chambray Formal Mandarin Collar Shirt", "Blush Crepe Tailored Smart Blazer",
            "Classic Monochrome Contrast Work Blouse", "Charcoal Wool-Blend Smart Slacks", "Terracotta Pleated Executive Midi Dress"
        ]
    },
    {
        "name": "Jumpsuits & Rompers",
        "description": "Belted utility jumpsuits, elegant evening jumpsuits, and casual linen rompers.",
        "image_url": "https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=600&q=80",
        "prefix": "JUMP",
        "items": [
            "Emerald Satin Wide-Leg Evening Jumpsuit", "Belted Linen Safari Utility Jumpsuit", "Midnight Crepe One-Shoulder Jumpsuit",
            "Casual Denim Button-Front Boilersuit", "Terracotta Tied-Waist Summer Romper", "Ivory Halter Backless Formal Jumpsuit",
            "Black Wrap Front Tailored Jumpsuit", "Khaki Utility Short-Sleeve Romper", "Blush Chiffon Overlay Gala Jumpsuit",
            "Floral Print Linen Tied Vacation Romper", "Navy Pinstripe Belted Work Jumpsuit", "Dusty Blue Culotte Length Jumpsuit",
            "Ruby Red Plunge Neck Evening Jumpsuit", "Sand Washed Cotton Relaxed Boilersuit", "Plum Asymmetric Drape Jumpsuit"
        ]
    },
    {
        "name": "Handbags & Leather Totes",
        "description": "Structured leather totes, crossbodies, evening clutches, and baguette bags.",
        "image_url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
        "prefix": "BAGS",
        "items": [
            "Structured Italian Leather Work Tote", "Crescent Moon Suede Shoulder Bag", "Pearl Handled Satin Evening Clutch",
            "Vintage Baguette Bag in Croc Embossed", "Woven Straw Summer Beach Basket", "Cognac Saddle Crossbody Leather Bag",
            "Quilted Chain Strap Evening Crossbody", "Burgundy Leather Slouchy Hobo Bag", "Mini Structured Box Bag with Gold Lock",
            "Canvas & Leather Trim Weekend Tote", "Black Matte Minimalist Backpack", "Champagne Metallic Crystal Clutch",
            "Olive Green Suede Tassel Crossbody", "Blush Pink Soft Nappa Leather Pouch", "Emerald Snake Print Envelope Clutch"
        ]
    }
]

# Fashion palette & size matrix
SIZES = ["XS", "S", "M", "L", "XL"]
COLOR_PALETTES = [
    ["Emerald Green", "Midnight Blue", "Crimson Red"],
    ["Sage Green", "Blush Pink", "Crisp White"],
    ["Champagne Gold", "Rose Gold", "Jet Black"],
    ["Pastel Lilac", "Sky Blue", "Vanilla Cream"],
    ["Terracotta", "Olive Green", "Mocha Brown"],
]

PRICE_RANGES = {
    "MAXI": (79.99, 139.99),
    "CDAY": (44.99, 69.99),
    "PTYW": (89.99, 159.99),
    "KURT": (29.99, 54.99),
    "SHAL": (69.99, 129.99),
    "BLOU": (39.99, 74.99),
    "CROP": (19.99, 39.99),
    "BLAZ": (89.99, 169.99),
    "COAT": (119.99, 249.99),
    "JEAN": (49.99, 84.99),
    "TRSR": (44.99, 79.99),
    "SKRT": (39.99, 69.99),
    "ABAY": (79.99, 149.99),
    "CORD": (54.99, 94.99),
    "BRID": (249.99, 599.99),
    "KNIT": (44.99, 89.99),
    "FROK": (34.99, 64.99),
    "WORK": (49.99, 89.99),
    "JUMP": (64.99, 119.99),
    "BAGS": (59.99, 149.99),
}


async def seed_girls_fashion_catalog():
    print("=" * 65)
    print("STARTING FULL RE-SEED: 20 GIRLS FASHION CATEGORIES × 15 PRODUCTS = 300 PRODUCTS")
    print("=" * 65)

    client = AsyncIOMotorClient(DATABASE_URL)
    db = client[DB_NAME]

    # Verify connection
    cols = await db.list_collection_names()
    print("Connected to MongoDB Atlas. Current collections:", cols)

    now = datetime.now(timezone.utc)

    # 1. Clean existing products and categories for clean reseed
    print("Resetting 'categories', 'products', and 'product_variants' collections...")
    await db["categories"].delete_many({})
    await db["products"].delete_many({})
    await db["product_variants"].delete_many({})

    # 2. Insert 20 Categories
    cat_docs = []
    for idx, c in enumerate(CATEGORIES_DATA, start=1):
        cat_docs.append({
            "name": c["name"],
            "slug": slugify(c["name"]),
            "description": c["description"],
            "image_url": c["image_url"],
            "icon": "Sparkles",
            "display_order": idx,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        })

    await db["categories"].insert_many(cat_docs)
    print(f"✅ Successfully inserted {len(cat_docs)} Categories into Atlas!")

    # 3. Insert 15 Products per Category (Total 300 Products) + Variants (Total ~900 Variants)
    total_products = 0
    total_variants = 0

    all_product_docs = []
    variants_to_insert = []

    for cat_idx, cat in enumerate(CATEGORIES_DATA):
        cat_name = cat["name"]
        prefix = cat["prefix"]
        min_p, max_p = PRICE_RANGES.get(prefix, (49.99, 89.99))

        for p_idx, item_name in enumerate(cat["items"], start=1):
            slug = slugify(f"{item_name}-{cat_idx+1}-{p_idx}")
            desc = (
                f"Luxurious {item_name.lower()} crafted from premier atelier fabrics. "
                f"Tailored for effortless sophistication, perfect for boutique styling and all-day comfort."
            )

            img_url = cat["image_url"]

            prod_doc = {
                "name": item_name,
                "slug": slug,
                "category": cat_name,
                "description": desc,
                "image_urls": [img_url],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            all_product_docs.append((prod_doc, prefix, p_idx, min_p, max_p))

    # Insert products in batch to get ObjectId IDs
    raw_products = [p[0] for p in all_product_docs]
    res = await db["products"].insert_many(raw_products)
    inserted_ids = res.inserted_ids
    total_products = len(inserted_ids)

    # 4. Create Multi-Variants for each Product
    for i, p_id in enumerate(inserted_ids):
        _, prefix, item_no, min_p, max_p = all_product_docs[i]

        # Rotate colors
        colors = COLOR_PALETTES[i % len(COLOR_PALETTES)]
        # Assign 3 sizes: S, M, L (or for bags: Standard)
        prod_sizes = ["Standard"] if prefix == "BAGS" else ["S", "M", "L"]

        base_price = round(min_p + ((max_p - min_p) * ((i % 5) / 5.0)), 2)

        for col in colors:
            for sz in prod_sizes:
                sku = f"{prefix}-{col[:3].upper()}-{sz[:2].upper()}-{item_no:02d}-{total_variants+1:04d}"
                qty = 10 + ((i + total_variants) % 25)  # between 10 and 34 units

                variants_to_insert.append({
                    "product_id": str(p_id),
                    "sku": sku,
                    "size": sz,
                    "color": col,
                    "price": base_price,
                    "currency": "USD",
                    "available_quantity": qty,
                    "created_at": now,
                    "updated_at": now,
                })
                total_variants += 1

    # Insert all variants in batch
    await db["product_variants"].insert_many(variants_to_insert)

    print(f"✅ Successfully inserted {total_products} Products!")
    print(f"✅ Successfully inserted {total_variants} Multi-Color & Multi-Size Variants!")
    print("=" * 65)
    print("VERIFYING INGESTION TOTALS:")
    count_cats = await db["categories"].count_documents({})
    count_prods = await db["products"].count_documents({})
    count_vars = await db["product_variants"].count_documents({})
    print(f" - Categories in DB: {count_cats}")
    print(f" - Products in DB:   {count_prods}")
    print(f" - Variants in DB:   {count_vars}")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(seed_girls_fashion_catalog())
