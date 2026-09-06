import uuid
import io
import re
import pandas as pd
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
from backend.app.models.pydantic_models import (
    NormalizedTransaction, SourceType, ValidationErrorItem, IngestionStatistics, IngestionResponseSchema
)

BANKING_PREFIXES = [
    "neft credit -", "neft credit /", "neft credit", "neft payment -", "neft payment", "neft",
    "imps credit -", "imps credit /", "imps credit", "imps payment -", "imps payment", "imps",
    "upi credit -", "upi credit /", "upi credit", "upi payment -", "upi payment", "upi",
    "rtgs payment -", "rtgs payment", "rtgs", "wire credit -", "wire credit /", "wire credit", "wire",
    "card payment -", "card payment", "bank transfer -", "bank transfer /", "bank transfer",
    "cheque deposit", "direct deposit", "atm withdrawal"
]

CORPORATE_SUFFIXES = [
    "private limited", "pvt ltd", "pvt. ltd.", "pvt", "limited", "ltd", "ltd.",
    "incorporated", "inc", "inc.", "llc", "gmbh", "corp", "corporation",
    "enterprise solutions", "solutions", "technologies", "tech", "services", "consulting"
]

class DataIngestionService:
    """
    Phase 2 Data Ingestion & Normalization Engine.
    Parses Bank Statements and Company Ledgers into clean NormalizedTransaction models.
    Preserves all raw values and provides canonical representations of dates, amounts,
    directions (CREDIT/DEBIT), references, and clean normalized text.
    """
    
    @staticmethod
    def ingest_files(
        bank_bytes: bytes,
        ledger_bytes: bytes,
        batch_id: Optional[str] = None
    ) -> IngestionResponseSchema:
        
        batch_ref = batch_id or f"batch_{uuid.uuid4().hex[:8]}"
        
        bank_res = DataIngestionService.parse_and_normalize_csv(bank_bytes, SourceType.BANK, batch_ref)
        ledger_res = DataIngestionService.parse_and_normalize_csv(ledger_bytes, SourceType.LEDGER, batch_ref)
        
        stats = IngestionStatistics(
            bank_total_rows=bank_res["total_rows"],
            bank_valid=len(bank_res["valid"]),
            bank_invalid=len(bank_res["invalid"]),
            ledger_total_rows=ledger_res["total_rows"],
            ledger_valid=len(ledger_res["valid"]),
            ledger_invalid=len(ledger_res["invalid"])
        )
        
        all_errors = bank_res["errors"] + ledger_res["errors"]
        
        return IngestionResponseSchema(
            bank_transactions=bank_res["valid"],
            ledger_transactions=ledger_res["valid"],
            invalid_bank_transactions=bank_res["invalid"],
            invalid_ledger_transactions=ledger_res["invalid"],
            statistics=stats,
            errors=all_errors
        )

    @staticmethod
    def parse_and_normalize_csv(
        csv_bytes: bytes,
        source: SourceType,
        batch_id: str
    ) -> Dict[str, Any]:
        """
        Parses CSV bytes, cleans headers, normalizes fields, and segregates valid vs invalid rows.
        """
        try:
            df = pd.read_csv(io.BytesIO(csv_bytes))
        except Exception as e:
            return {
                "valid": [],
                "invalid": [{"raw": "Unparseable CSV File"}],
                "errors": [ValidationErrorItem(source=source.value, row_index=-1, raw_row={}, error_message=f"CSV Parse Error: {str(e)}")],
                "total_rows": 0
            }
            
        total_rows = len(df)
        valid_txs: List[NormalizedTransaction] = []
        invalid_rows: List[Dict[str, Any]] = []
        errors: List[ValidationErrorItem] = []
        
        # Normalize column header strings
        col_mapping = DataIngestionService._map_columns(df.columns)
        
        seen_ids = set()
        for idx, (row_idx, row) in enumerate(df.iterrows()):
            raw_dict = {str(k): (str(v) if pd.notna(v) else "") for k, v in row.items()}
            
            try:
                # 1. Parse Dates (Distinguish document_date vs posting_date and transaction_date vs value_date)
                tx_date, val_date, post_date, doc_date, effective_date = DataIngestionService._extract_dates(
                    row, col_mapping, source
                )
                if not effective_date:
                    raise ValueError("Missing or unparseable transaction date")

                # 2. Parse Amount, Currency, and Economic Direction (CREDIT / DEBIT)
                raw_amt, curr_val, dir_val, tx_type = DataIngestionService._extract_amount_and_direction(
                    row, col_mapping
                )
                if raw_amt is None:
                    raise ValueError("Missing or invalid numerical transaction amount")

                # 3. Parse Description & Counterparty (Never return 'Unspecified Transaction')
                desc_val, cp_val, norm_desc, norm_cp = DataIngestionService._extract_description_and_counterparty(
                    row, col_mapping, source, raw_dict
                )

                # 4. Parse Reference & Document ID / Invoice ID
                ref_val, doc_id, inv_val = DataIngestionService._extract_references(
                    row, col_mapping, desc_val
                )

                # 5. Extract Account & Status
                bank_acc = DataIngestionService._get_str(row, col_mapping.get("bank_account"))
                status_val = DataIngestionService._get_str(row, col_mapping.get("status"))

                tx_id = f"{source.value.lower()}_{idx + 1:03d}_{uuid.uuid4().hex[:6]}"
                if col_mapping.get("id") and pd.notna(row[col_mapping["id"]]):
                    custom_id = str(row[col_mapping["id"]]).strip()
                    if custom_id:
                        if custom_id in seen_ids:
                            tx_id = f"{custom_id}_{idx + 1}"
                        else:
                            tx_id = custom_id
                seen_ids.add(tx_id)

                norm_tx = NormalizedTransaction(
                    id=tx_id,
                    source=source,
                    date=effective_date,
                    value_date=val_date,
                    posting_date=post_date,
                    document_date=doc_date,
                    amount=raw_amt,
                    normalized_amount=abs(raw_amt),
                    direction=dir_val,
                    currency=curr_val,
                    description=desc_val,
                    normalized_description=norm_desc,
                    reference=ref_val,
                    document_id=doc_id,
                    payment_reference=ref_val,
                    counterparty=cp_val,
                    normalized_counterparty=norm_cp,
                    invoice_id=inv_val or doc_id,
                    bank_account=bank_acc,
                    status=status_val,
                    transaction_type=tx_type,
                    metadata={"batch_id": batch_id, "row_index": idx, "raw": raw_dict}
                )
                valid_txs.append(norm_tx)

            except Exception as err:
                invalid_rows.append(raw_dict)
                errors.append(ValidationErrorItem(
                    source=source.value,
                    row_index=int(idx),
                    raw_row=raw_dict,
                    error_message=str(err)
                ))

        return {
            "valid": valid_txs,
            "invalid": invalid_rows,
            "errors": errors,
            "total_rows": total_rows
        }

    @staticmethod
    def _map_columns(columns: pd.Index) -> Dict[str, str]:
        """
        Maps raw column names to canonical schema fields using fuzzy/exact alias matching.
        """
        clean_cols = {str(col).strip().lower().replace(" ", "_").replace("-", "_"): str(col) for col in columns}
        mapping = {}
        
        # ID aliases
        for alias in ['bank_transaction_id', 'ledger_id', 'transaction_id', 'id', 'txn_id', 'entry_id']:
            if alias in clean_cols:
                mapping['id'] = clean_cols[alias]
                break

        # Date aliases
        for alias in ['transaction_date', 'txn_date', 'booking_date', 'date']:
            if alias in clean_cols:
                mapping['transaction_date'] = clean_cols[alias]
                break
        for alias in ['value_date', 'val_date']:
            if alias in clean_cols:
                mapping['value_date'] = clean_cols[alias]
                break
        for alias in ['posting_date', 'post_date', 'payment_date', 'accounting_date']:
            if alias in clean_cols:
                mapping['posting_date'] = clean_cols[alias]
                break
        for alias in ['document_date', 'doc_date', 'invoice_date', 'bill_date']:
            if alias in clean_cols:
                mapping['document_date'] = clean_cols[alias]
                break
        # Fallback date
        if 'date' not in mapping and 'transaction_date' not in mapping:
            for alias in clean_cols:
                if 'date' in alias:
                    mapping['date'] = clean_cols[alias]
                    break

        # Amount aliases
        for alias in ['amount', 'total', 'value', 'val', 'txn_amount', 'gross_amount', 'net_amount']:
            if alias in clean_cols:
                mapping['amount'] = clean_cols[alias]
                break

        # Direction aliases
        for alias in ['direction', 'dr_cr', 'd_c', 'cr_dr', 'txn_type', 'type']:
            if alias in clean_cols:
                mapping['direction'] = clean_cols[alias]
                break

        # Debit / Credit split aliases
        for alias in ['debit', 'withdrawal', 'outflow', 'paid_out']:
            if alias in clean_cols:
                mapping['debit'] = clean_cols[alias]
                break
        for alias in ['credit', 'deposit', 'inflow', 'paid_in']:
            if alias in clean_cols:
                mapping['credit'] = clean_cols[alias]
                break

        # Description / Memo aliases
        for alias in ['bank_description', 'description', 'memo', 'narration', 'particulars', 'details', 'remarks', 'trans_desc']:
            if alias in clean_cols:
                mapping['description'] = clean_cols[alias]
                break

        # Counterparty aliases
        for alias in ['counterparty', 'vendor_customer', 'vendor', 'customer', 'payee', 'payor', 'party_name', 'client_name', 'name']:
            if alias in clean_cols:
                mapping['counterparty'] = clean_cols[alias]
                break

        # Reference aliases
        for alias in ['reference', 'ref_id', 'reference_id', 'payment_reference', 'payment_ref', 'ref', 'check_no', 'cheque_no']:
            if alias in clean_cols:
                mapping['reference'] = clean_cols[alias]
                break

        # Document ID / Invoice aliases
        for alias in ['document_id', 'doc_id', 'invoice_id', 'invoice_no', 'inv_number', 'invoice_number', 'bill_id']:
            if alias in clean_cols:
                mapping['document_id'] = clean_cols[alias]
                break

        # Bank Account alias
        for alias in ['bank_account', 'account', 'account_no', 'acc_no']:
            if alias in clean_cols:
                mapping['bank_account'] = clean_cols[alias]
                break

        # Status alias
        for alias in ['status', 'doc_status', 'state']:
            if alias in clean_cols:
                mapping['status'] = clean_cols[alias]
                break

        # Currency aliases
        for alias in ['currency', 'curr', 'iso_currency']:
            if alias in clean_cols:
                mapping['currency'] = clean_cols[alias]
                break

        return mapping

    @staticmethod
    def _extract_dates(row: pd.Series, mapping: Dict[str, str], source: SourceType) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]]:
        tx_date = DataIngestionService._sanitize_date(row, mapping.get("transaction_date"))
        val_date = DataIngestionService._sanitize_date(row, mapping.get("value_date"))
        post_date = DataIngestionService._sanitize_date(row, mapping.get("posting_date"))
        doc_date = DataIngestionService._sanitize_date(row, mapping.get("document_date"))
        fallback_date = DataIngestionService._sanitize_date(row, mapping.get("date"))

        effective_date = None
        if source == SourceType.BANK:
            effective_date = tx_date or val_date or fallback_date
        else:
            # For ledger, posting_date is the economic settlement date; fallback to document_date
            effective_date = post_date or doc_date or tx_date or fallback_date

        return tx_date, val_date, post_date, doc_date, effective_date

    @staticmethod
    def _sanitize_date(row: pd.Series, col_name: Optional[str]) -> Optional[str]:
        if not col_name or col_name not in row.index or pd.isna(row[col_name]):
            return None

        raw_str = str(row[col_name]).strip()
        if not raw_str or raw_str.lower() in ["nan", "none", "null", ""]:
            return None

        date_formats = [
            '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d',
            '%d-%b-%Y', '%d-%B-%Y', '%Y.%m.%d', '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S'
        ]

        for fmt in date_formats:
            try:
                dt = datetime.strptime(raw_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                pass

        try:
            dt = pd.to_datetime(raw_str)
            return dt.strftime('%Y-%m-%d')
        except Exception:
            return None

    @staticmethod
    def _extract_amount_and_direction(
        row: pd.Series, mapping: Dict[str, str]
    ) -> Tuple[Optional[float], str, str, str]:
        
        # 1. Currency
        curr_col = mapping.get("currency")
        currency = "USD"
        if curr_col and curr_col in row.index and pd.notna(row[curr_col]):
            curr_str = str(row[curr_col]).strip().upper()
            if len(curr_str) >= 3:
                currency = curr_str[:3]

        # Helper to clean numbers
        def clean_num(val_str: Any) -> Optional[float]:
            if pd.isna(val_str):
                return None
            v = str(val_str).strip()
            if not v or v.lower() in ["nan", "none", "null", "n/a", ""]:
                return None
            is_negative = False
            if v.startswith("(") and v.endswith(")"):
                is_negative = True
                v = v[1:-1]
            v = re.sub(r'[^\d\.\-]', '', v)
            if not v or v == "-":
                return None
            try:
                val = float(v)
                return -abs(val) if is_negative else val
            except ValueError:
                return None

        # 2. Check Direction Column if present
        explicit_dir = None
        dir_col = mapping.get("direction")
        if dir_col and dir_col in row.index and pd.notna(row[dir_col]):
            d_val = str(row[dir_col]).strip().upper()
            if d_val in ["CREDIT", "CR", "INFLOW", "DEPOSIT"]:
                explicit_dir = "CREDIT"
            elif d_val in ["DEBIT", "DR", "OUTFLOW", "WITHDRAWAL", "PAYMENT"]:
                explicit_dir = "DEBIT"

        amt_col = mapping.get("amount")
        deb_col = mapping.get("debit")
        cred_col = mapping.get("credit")

        raw_amt = None
        direction = "CREDIT"

        # Check Single Amount Column
        if amt_col and amt_col in row.index and pd.notna(row[amt_col]):
            parsed_amt = clean_num(row[amt_col])
            if parsed_amt is not None:
                raw_amt = parsed_amt
                if explicit_dir:
                    direction = explicit_dir
                else:
                    direction = "DEBIT" if parsed_amt < 0 else "CREDIT"
                tx_type = "DR" if direction == "DEBIT" else "CR"
                return raw_amt, currency, direction, tx_type

        # Check Debit / Credit Split Columns
        debit = clean_num(row[deb_col]) if deb_col and deb_col in row.index and pd.notna(row[deb_col]) else 0.0
        credit = clean_num(row[cred_col]) if cred_col and cred_col in row.index and pd.notna(row[cred_col]) else 0.0

        if credit and credit != 0.0:
            raw_amt = abs(credit)
            direction = "CREDIT"
        elif debit and debit != 0.0:
            raw_amt = -abs(debit)
            direction = "DEBIT"

        tx_type = "DR" if direction == "DEBIT" else "CR"
        return raw_amt, currency, direction, tx_type

    @staticmethod
    def _extract_description_and_counterparty(
        row: pd.Series, mapping: Dict[str, str], source: SourceType, raw_dict: Dict[str, str]
    ) -> Tuple[str, Optional[str], str, Optional[str]]:
        
        desc_col = mapping.get("description")
        cp_col = mapping.get("counterparty")

        desc = ""
        if desc_col and desc_col in row.index and pd.notna(row[desc_col]):
            s = str(row[desc_col]).strip()
            if s and s.lower() not in ["nan", "none", "null", ""]:
                desc = s

        counterparty = None
        if cp_col and cp_col in row.index and pd.notna(row[cp_col]):
            s = str(row[cp_col]).strip()
            if s and s.lower() not in ["nan", "none", "null", ""]:
                counterparty = s

        # Fallback description synthesizing — NEVER output 'Unspecified Transaction'
        if not desc:
            if counterparty:
                desc = f"{counterparty}"
                doc_id = DataIngestionService._get_str(row, mapping.get("document_id"))
                if doc_id:
                    desc += f" ({doc_id})"
            elif mapping.get("reference") and pd.notna(row.get(mapping["reference"])):
                desc = f"Transaction Ref {row[mapping['reference']]}"
            elif mapping.get("document_id") and pd.notna(row.get(mapping["document_id"])):
                desc = f"Document {row[mapping['document_id']]}"
            else:
                desc = f"{source.value} Record"

        # Normalized representation
        norm_desc = DataIngestionService.normalize_text(desc)
        norm_cp = DataIngestionService.normalize_counterparty(counterparty) if counterparty else None

        return desc, counterparty, norm_desc, norm_cp

    @staticmethod
    def _extract_references(
        row: pd.Series, mapping: Dict[str, str], desc: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        
        ref = DataIngestionService._get_str(row, mapping.get("reference"))
        doc_id = DataIngestionService._get_str(row, mapping.get("document_id"))
        inv_id = None

        if doc_id and ("inv" in doc_id.lower() or "bill" in doc_id.lower()):
            inv_id = doc_id
        if ref and ("inv" in ref.lower() or "bill" in ref.lower()):
            if not inv_id:
                inv_id = ref

        # Regex fallback from description if reference missing (e.g. INV-1042, BILL-BO-305)
        if not ref or not inv_id:
            match = re.search(r'\b(INV-[A-Za-z0-9\-]+|BILL-[A-Za-z0-9\-]+|INV\d+)\b', desc, re.IGNORECASE)
            if match:
                extracted = match.group(1).upper()
                if not ref:
                    ref = extracted
                if not inv_id:
                    inv_id = extracted

        # If ref is still empty, fallback to doc_id
        if not ref and doc_id:
            ref = doc_id

        return ref, doc_id, inv_id

    @staticmethod
    def _get_str(row: pd.Series, col_name: Optional[str]) -> Optional[str]:
        if not col_name or col_name not in row.index or pd.isna(row[col_name]):
            return None
        s = str(row[col_name]).strip()
        return s if s and s.lower() not in ["nan", "none", "null", "n/a", ""] else None

    @staticmethod
    def normalize_text(text: str) -> str:
        """
        Normalizes transaction descriptions by lowering, removing punctuation,
        and stripping banking clearing prefixes and corporate suffixes.
        """
        if not text:
            return ""
        s = text.lower().strip()
        s = re.sub(r'[\/\\,\*\-\_\(\)\[\]]', ' ', s)
        s = re.sub(r'\s+', ' ', s).strip()

        for prefix in BANKING_PREFIXES:
            clean_p = re.sub(r'[\/\\,\*\-\_]', ' ', prefix).strip()
            if s.startswith(clean_p + " "):
                s = s[len(clean_p):].strip()
                break

        for suffix in CORPORATE_SUFFIXES:
            clean_s = re.sub(r'[\/\\,\*\-\_]', ' ', suffix).strip()
            if s.endswith(" " + clean_s):
                s = s[:-len(clean_s)].strip()
                break

        return s

    @staticmethod
    def normalize_counterparty(text: Optional[str]) -> str:
        """
        Normalizes vendor / customer counterparty names for reliable similarity matching.
        """
        if not text:
            return ""
        s = text.lower().strip()
        s = re.sub(r'[\/\\,\*\-\_\(\)\[\]]', ' ', s)
        s = re.sub(r'\s+', ' ', s).strip()

        for suffix in CORPORATE_SUFFIXES:
            clean_s = re.sub(r'[\/\\,\*\-\_]', ' ', suffix).strip()
            if s.endswith(" " + clean_s):
                s = s[:-len(clean_s)].strip()
                break

        return s

    @staticmethod
    def parse_csv_content(csv_bytes: bytes, source: SourceType, batch_id: str) -> List[NormalizedTransaction]:
        """
        Backward-compatible helper method returning list of valid NormalizedTransactions.
        """
        res = DataIngestionService.parse_and_normalize_csv(csv_bytes, source, batch_id)
        return res["valid"]
