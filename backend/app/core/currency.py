"""
ISO Currency formatting and multi-currency aggregation utilities.
Enforces Section 4, 5, 6:
- Never assume USD as a default or fallback.
- Never hardcode '$' as a generic symbol for non-USD currencies.
- Format based strictly on ISO currency codes (INR -> ₹, USD -> $, EUR -> €, GBP -> £).
- Aggregate volumes and variances strictly by currency in isolated buckets.
- Do not perform cross-currency arithmetic without verified FX conversion rates.
"""

from typing import Dict, Any, List, Optional

CURRENCY_SYMBOLS: Dict[str, str] = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "CAD": "CA$",
    "AUD": "AU$",
    "JPY": "¥",
    "SGD": "S$",
    "AED": "AED ",
    "CHF": "CHF "
}

def get_currency_symbol(currency_code: Optional[str]) -> str:
    """Returns the display symbol for an ISO currency code, or empty/code if unknown."""
    if not currency_code:
        return ""
    code = currency_code.strip().upper()
    return CURRENCY_SYMBOLS.get(code, f"{code} ")

def format_currency(amount: Optional[float], currency_code: Optional[str] = None, include_code: bool = True) -> str:
    """
    Format a monetary amount according to ISO currency rules.
    Never defaults to USD. If currency is missing, outputs raw number with sign.
    Examples:
        format_currency(12500, "INR") -> "₹12,500.00 INR"
        format_currency(540, "USD")   -> "$540.00 USD"
        format_currency(-4200, "INR") -> "-₹4,200.00 INR"
        format_currency(100, None)    -> "100.00"
    """
    if amount is None:
        return "N/A"
    
    is_negative = amount < 0
    abs_amt = abs(amount)
    formatted_num = f"{abs_amt:,.2f}"
    sign = "-" if is_negative else ""
    
    if not currency_code or currency_code.strip().upper() in ["", "NONE", "UNKNOWN"]:
        return f"{sign}{formatted_num}"
        
    code = currency_code.strip().upper()
    symbol = get_currency_symbol(code)
    
    if include_code:
        return f"{sign}{symbol}{formatted_num} {code}"
    return f"{sign}{symbol}{formatted_num}"

class Money:
    """
    Immutable, currency-safe value object representing an amount in a specific currency.
    Enforces strict mathematical isolation: prohibits cross-currency operations without verified FX.
    """
    def __init__(self, amount: float, currency: str):
        if not currency or not str(currency).strip():
            raise ValueError("Money currency must be a valid, non-empty ISO currency code")
        self.amount = round(float(amount), 4)
        self.currency = str(currency).strip().upper()

    @property
    def formatted(self) -> str:
        return format_currency(self.amount, self.currency)

    def __add__(self, other: 'Money') -> 'Money':
        if not isinstance(other, Money):
            raise TypeError("Cannot add Money to a non-Money object")
        if self.currency != other.currency:
            raise ValueError(f"Cross-currency arithmetic strictly forbidden without verified FX: {self.currency} vs {other.currency}")
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: 'Money') -> 'Money':
        if not isinstance(other, Money):
            raise TypeError("Cannot subtract a non-Money object from Money")
        if self.currency != other.currency:
            raise ValueError(f"Cross-currency arithmetic strictly forbidden without verified FX: {self.currency} vs {other.currency}")
        return Money(self.amount - other.amount, self.currency)

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Money):
            return False
        return self.currency == other.currency and abs(self.amount - other.amount) < 0.0001

    def __repr__(self) -> str:
        return f"Money({self.amount:.2f}, '{self.currency}')"


def make_money(amount: float, currency_code: Optional[str] = None) -> Money:
    """Constructs a currency-safe Money value object."""
    if not currency_code or not str(currency_code).strip():
        raise ValueError("Currency code cannot be empty")
    return Money(amount, currency_code)


def aggregate_by_currency(transactions: List[Any], amount_field: str = "amount", currency_field: str = "currency") -> Dict[str, Any]:
    """
    Groups transactions or Money objects strictly by their own currency and computes volume statistics.
    Never combines different currencies into a single aggregate without explicit FX.
    """
    summary: Dict[str, Any] = {}
    
    for tx in transactions:
        if isinstance(tx, Money):
            curr = tx.currency
            amt = tx.amount
        else:
            raw_curr = getattr(tx, currency_field, None)
            curr = raw_curr.strip().upper() if raw_curr else "UNKNOWN"
            amt = float(getattr(tx, amount_field, 0.0) or 0.0)
        
        if curr not in summary:
            summary[curr] = Money(0.0, curr) if isinstance(tx, Money) else {
                "currency": curr,
                "symbol": get_currency_symbol(curr),
                "count": 0,
                "total_signed": 0.0,
                "total_abs": 0.0
            }
            
        if isinstance(tx, Money):
            summary[curr] = summary[curr] + tx
        else:
            summary[curr]["count"] += 1
            summary[curr]["total_signed"] += amt
            summary[curr]["total_abs"] += abs(amt)
        
    return summary
