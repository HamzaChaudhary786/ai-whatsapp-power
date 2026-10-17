import re
from typing import Optional


def normalize_pakistan_phone(raw: Optional[str]) -> str:
    """
    Normalizes any Pakistani or international phone number into standard E.164 digits without '+'.
    Standardizes:
      - '0306 8361835' / '03068361835' -> '923068361835'
      - '+92 306 8361835' / '+923068361835' -> '923068361835'
      - '00923068361835' -> '923068361835'
      - '3068361835' (10 digits starting with 3) -> '923068361835'
    """
    if not raw:
        return ""
    digits = re.sub(r"[^\d]", "", str(raw))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 11:
        return "92" + digits[1:]
    elif digits.startswith("3") and len(digits) == 10:
        return "92" + digits
    return digits
