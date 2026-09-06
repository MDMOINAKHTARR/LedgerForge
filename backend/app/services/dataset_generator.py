import random
from typing import List, Tuple
from backend.app.models.dataset_models import (
    BankTransactionItem, LedgerTransactionItem, GroundTruthAnnotation,
    SyntheticDatasetPackage, ExceptionCategory, ExpectedAction, ExpectedStatus
)

class SyntheticDatasetGenerator:
    """
    Generates a 100% deterministic, reproducible dataset with seeded financial exceptions
    across all 10 required categories, plus Golden Demo Cases.
    """
    
    @staticmethod
    def generate_dataset(seed: int = 42, count: int = 60) -> SyntheticDatasetPackage:
        random.seed(seed)
        
        bank_txs: List[BankTransactionItem] = []
        ledger_txs: List[LedgerTransactionItem] = []
        ground_truth: List[GroundTruthAnnotation] = []
        
        vendors = [
            "Stripe Payments Inc", "Amazon Web Services", "Acme Enterprise Solutions",
            "GlobalTech Consulting", "EuroClient Europe GmbH", "Salesforce CRM",
            "Slack Technologies", "Google Cloud EMEA", "Oracle Systems", "Datadog Inc"
        ]
        
        tx_index = 100
        
        # ---------------------------------------------------------------
        # Category 1: EXACT_MATCH (15 items) -> AUTO_RECONCILE
        # ---------------------------------------------------------------
        for i in range(15):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            amt = round(random.uniform(500.0, 5000.0), 2)
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 25) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=amt,
                currency="USD",
                description=f"{vendor} Payout {inv_id}",
                reference=inv_id,
                transaction_type="CR",
                account="OPERATING_1001"
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Invoice {inv_id}",
                reference=inv_id,
                account="AR_4000"
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.MATCHED,
                exception_type=ExceptionCategory.EXACT_MATCH,
                expected_action=ExpectedAction.AUTO_RECONCILE,
                notes="Exact match on date, amount, reference, and currency."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 2: TIMING_MISMATCH (8 items) -> AUTO_RECONCILE
        # ---------------------------------------------------------------
        for i in range(8):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            amt = round(random.uniform(1000.0, 8000.0), 2)
            vendor = vendors[i % len(vendors)]
            ledger_date = f"2026-03-{(i % 15) + 1:02d}"
            bank_date = f"2026-03-{(i % 15) + 6:02d}"  # 5-day lag
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=bank_date,
                amount=amt,
                currency="USD",
                description=f"{vendor} Settlement {inv_id}",
                reference=inv_id,
                transaction_type="CR"
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=ledger_date,
                amount=amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Invoice {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.TIMING_MISMATCH,
                expected_action=ExpectedAction.AUTO_RECONCILE,
                notes="5-day clearing lag between ledger creation and bank deposit."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 3: MEMO_MISMATCH (6 items) -> AUTO_RECONCILE
        # ---------------------------------------------------------------
        memo_pairs = [
            ("AWS EMEA UK Cloud", "Amazon Web Services Inc"),
            ("GOOGLE IRELAND ADWORDS", "Google LLC Advertising"),
            ("MSFT *AZURE BILLING", "Microsoft Corporation"),
            ("STRIPE PAYOUT BATCH 490", "Stripe Connect Direct Deposit")
        ]
        for i in range(6):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            amt = round(random.uniform(300.0, 3000.0), 2)
            b_desc, l_vendor = memo_pairs[i % len(memo_pairs)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=amt,
                currency="USD",
                description=f"{b_desc} {inv_id}",
                reference=inv_id
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=amt,
                currency="USD",
                vendor_customer=l_vendor,
                description=f"{l_vendor} Subscription {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.MEMO_MISMATCH,
                expected_action=ExpectedAction.AUTO_RECONCILE,
                notes="Vendor memo text differs but invoice ID and amount match."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 4: BANK_FEE (6 items) -> AUTO_RECONCILE
        # ---------------------------------------------------------------
        for i in range(6):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            gross_amt = round(random.uniform(2000.0, 10000.0), 2)
            fee = 15.00 + (i * 5.0)  # e.g., $15, $20, $25 wire fee
            net_bank_amt = round(gross_amt - fee, 2)
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=net_bank_amt,
                currency="USD",
                description=f"{vendor} International Wire Net {inv_id}",
                reference=inv_id
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=gross_amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Invoice Gross {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.BANK_FEE,
                expected_action=ExpectedAction.AUTO_RECONCILE,
                notes=f"Intermediary wire transfer fee of ${fee:.2f} deducted."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 5: DUPLICATE (4 items / 8 bank txs) -> ESCALATE
        # ---------------------------------------------------------------
        for i in range(4):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            amt = round(random.uniform(800.0, 4000.0), 2)
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Single Entry {inv_id}",
                reference=inv_id
            )
            ledger_txs.append(l_item)
            
            # Original bank deposit
            b_item1 = BankTransactionItem(
                transaction_id=f"bank_{tx_index}_orig",
                date=date_str,
                amount=amt,
                currency="USD",
                description=f"{vendor} Wire Deposit 1 {inv_id}",
                reference=inv_id
            )
            gt_item1 = GroundTruthAnnotation(
                bank_transaction_id=b_item1.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.DUPLICATE,
                expected_action=ExpectedAction.ESCALATE,
                notes="Original deposit of duplicate pair. Must escalate for verification."
            )
            bank_txs.append(b_item1)
            ground_truth.append(gt_item1)

            # Duplicate bank deposit
            b_item2 = BankTransactionItem(
                transaction_id=f"bank_{tx_index}_dup",
                date=date_str,
                amount=amt,
                currency="USD",
                description=f"{vendor} Wire Deposit 2 (Duplicate) {inv_id}",
                reference=inv_id
            )
            gt_item2 = GroundTruthAnnotation(
                bank_transaction_id=b_item2.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.DUPLICATE,
                expected_action=ExpectedAction.ESCALATE,
                notes="Duplicate bank deposit. Must escalate."
            )
            bank_txs.append(b_item2)
            ground_truth.append(gt_item2)

        # ---------------------------------------------------------------
        # Category 6: PARTIAL_PAYMENT (4 items) -> ESCALATE
        # ---------------------------------------------------------------
        for i in range(4):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            invoice_amt = 5000.00 + (i * 1000.0)
            paid_amt = invoice_amt * 0.60  # Paid 60%
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=paid_amt,
                currency="USD",
                description=f"{vendor} Partial Settlement {inv_id}",
                reference=inv_id
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=invoice_amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Invoice Total {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.PARTIAL_PAYMENT,
                expected_action=ExpectedAction.ESCALATE,
                notes=f"Partial payment received (${paid_amt:.2f} of ${invoice_amt:.2f}). Requires human approval."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 7: FX_VARIANCE (5 items) -> AUTO_RECONCILE
        # ---------------------------------------------------------------
        fx_rates = [1.08, 1.09, 1.07, 1.10, 1.085]
        for i in range(5):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            eur_amt = 1000.00 + (i * 500.0)
            rate = fx_rates[i]
            usd_amt = round(eur_amt * rate, 2)
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=usd_amt,
                currency="USD",
                description=f"{vendor} EUR Remittance {inv_id}",
                reference=inv_id
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=eur_amt,
                currency="EUR",
                vendor_customer=vendor,
                description=f"{vendor} Invoice EUR {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.FX_VARIANCE,
                expected_action=ExpectedAction.AUTO_RECONCILE,
                notes=f"Multi-currency transaction (EUR {eur_amt} -> USD {usd_amt} at rate {rate})."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 8: MISSING_LEDGER (4 items) -> ESCALATE
        # ---------------------------------------------------------------
        for i in range(4):
            tx_index += 1
            amt = round(random.uniform(400.0, 2500.0), 2)
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=amt,
                currency="USD",
                description=f"Unregistered Direct Deposit #{tx_index}",
                reference=None
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=None,
                expected_status=ExpectedStatus.UNMATCHED,
                exception_type=ExceptionCategory.MISSING_LEDGER,
                expected_action=ExpectedAction.ESCALATE,
                notes="Bank transaction has no corresponding entry in company ledger."
            )
            bank_txs.append(b_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 9: MISSING_BANK (4 items) -> ESCALATE / NO_MATCH
        # ---------------------------------------------------------------
        for i in range(4):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            amt = round(random.uniform(600.0, 3500.0), 2)
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Outstanding Unpaid Invoice {inv_id}",
                reference=inv_id
            )
            ledger_txs.append(l_item)
            
            # Dummy bank entry representing un-cleared bank record check
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}_uncleared",
                date=date_str,
                amount=amt,
                currency="USD",
                description=f"{vendor} Uncleared Bank Remittance {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=None,  # Unmatched / Uncleared
                expected_status=ExpectedStatus.UNMATCHED,
                exception_type=ExceptionCategory.MISSING_BANK,
                expected_action=ExpectedAction.NO_MATCH,
                notes="Ledger invoice recorded but bank clearing missing."
            )
            bank_txs.append(b_item)
            ground_truth.append(gt_item)

        # ---------------------------------------------------------------
        # Category 10: AMOUNT_DISCREPANCY (4 items) -> ESCALATE
        # ---------------------------------------------------------------
        for i in range(4):
            tx_index += 1
            inv_id = f"INV-{tx_index}"
            ledger_amt = 1200.00 + (i * 300.0)
            bank_amt = ledger_amt - 180.00  # Transposition / error
            vendor = vendors[i % len(vendors)]
            date_str = f"2026-03-{(i % 20) + 1:02d}"
            
            b_item = BankTransactionItem(
                transaction_id=f"bank_{tx_index}",
                date=date_str,
                amount=bank_amt,
                currency="USD",
                description=f"{vendor} Erroneous Payment {inv_id}",
                reference=inv_id
            )
            l_item = LedgerTransactionItem(
                ledger_id=f"ledger_{tx_index}",
                invoice_id=inv_id,
                date=date_str,
                amount=ledger_amt,
                currency="USD",
                vendor_customer=vendor,
                description=f"{vendor} Invoice {inv_id}",
                reference=inv_id
            )
            gt_item = GroundTruthAnnotation(
                bank_transaction_id=b_item.transaction_id,
                expected_match_ledger_id=l_item.ledger_id,
                expected_status=ExpectedStatus.EXCEPTIONAL,
                exception_type=ExceptionCategory.AMOUNT_DISCREPANCY,
                expected_action=ExpectedAction.ESCALATE,
                notes=f"Unexplained amount variance (${bank_amt} vs ${ledger_amt}). Escalated for safety."
            )
            bank_txs.append(b_item)
            ledger_txs.append(l_item)
            ground_truth.append(gt_item)

        return SyntheticDatasetPackage(
            seed=seed,
            total_bank_transactions=len(bank_txs),
            total_ledger_transactions=len(ledger_txs),
            bank_transactions=bank_txs,
            ledger_transactions=ledger_txs,
            ground_truth=ground_truth
        )

    @staticmethod
    def generate_golden_cases() -> SyntheticDatasetPackage:
        """
        Deliberately difficult financial edge cases for live hackathon judge demonstrations.
        """
        bank_txs = [
            # Golden 1: FX + Wire Fee Combo (€2,000 invoice -> $2,140 net bank deposit with $20 fee)
            BankTransactionItem(
                transaction_id="gold_b01", date="2026-03-10", amount=2140.00, currency="USD",
                description="EuroClient Wire Net Deposit INV-GOLD-01", reference="INV-GOLD-01"
            ),
            # Golden 2: Invoice Number Transposition (Bank reference INV-9021 vs Ledger INV-9012)
            BankTransactionItem(
                transaction_id="gold_b02", date="2026-03-11", amount=1450.00, currency="USD",
                description="Acme Corp Settlement INV-9021", reference="INV-9021"
            ),
            # Golden 3: Short payment + Wire fee combination ($1,000 invoice, $10 fee, $200 short)
            BankTransactionItem(
                transaction_id="gold_b03", date="2026-03-12", amount=790.00, currency="USD",
                description="GlobalTech Short Wire INV-GOLD-03", reference="INV-GOLD-03"
            ),
            # Golden 4: Unidentified ACH Deposit without reference number
            BankTransactionItem(
                transaction_id="gold_b04", date="2026-03-13", amount=4500.00, currency="USD",
                description="DIRECT ACH CREDIT REF 88390211", reference=None
            )
        ]

        ledger_txs = [
            LedgerTransactionItem(
                ledger_id="gold_l01", invoice_id="INV-GOLD-01", date="2026-03-10", amount=2000.00,
                currency="EUR", vendor_customer="EuroClient Europe GmbH", description="Consulting EUR INV-GOLD-01", reference="INV-GOLD-01"
            ),
            LedgerTransactionItem(
                ledger_id="gold_l02", invoice_id="INV-9012", date="2026-03-11", amount=1450.00,
                currency="USD", vendor_customer="Acme Corp", description="Acme Invoice INV-9012", reference="INV-9012"
            ),
            LedgerTransactionItem(
                ledger_id="gold_l03", invoice_id="INV-GOLD-03", date="2026-03-12", amount=1000.00,
                currency="USD", vendor_customer="GlobalTech Consulting", description="GlobalTech Invoice INV-GOLD-03", reference="INV-GOLD-03"
            )
        ]

        ground_truth = [
            GroundTruthAnnotation(
                bank_transaction_id="gold_b01", expected_match_ledger_id="gold_l01",
                expected_status=ExpectedStatus.EXCEPTIONAL, exception_type=ExceptionCategory.FX_VARIANCE,
                expected_action=ExpectedAction.AUTO_RECONCILE, notes="Multi-currency EUR->USD conversion with $20 bank wire fee."
            ),
            GroundTruthAnnotation(
                bank_transaction_id="gold_b02", expected_match_ledger_id="gold_l02",
                expected_status=ExpectedStatus.EXCEPTIONAL, exception_type=ExceptionCategory.MEMO_MISMATCH,
                expected_action=ExpectedAction.AUTO_RECONCILE, notes="Invoice number transposition (INV-9021 vs INV-9012) resolved via amount and vendor."
            ),
            GroundTruthAnnotation(
                bank_transaction_id="gold_b03", expected_match_ledger_id="gold_l03",
                expected_status=ExpectedStatus.EXCEPTIONAL, exception_type=ExceptionCategory.PARTIAL_PAYMENT,
                expected_action=ExpectedAction.ESCALATE, notes="Partial short payment with fee. Must stop and ask human."
            ),
            GroundTruthAnnotation(
                bank_transaction_id="gold_b04", expected_match_ledger_id=None,
                expected_status=ExpectedStatus.UNMATCHED, exception_type=ExceptionCategory.MISSING_LEDGER,
                expected_action=ExpectedAction.ESCALATE, notes="Unidentified ACH deposit. Must escalate."
            )
        ]

        return SyntheticDatasetPackage(
            seed=999,
            total_bank_transactions=len(bank_txs),
            total_ledger_transactions=len(ledger_txs),
            bank_transactions=bank_txs,
            ledger_transactions=ledger_txs,
            ground_truth=ground_truth
        )
