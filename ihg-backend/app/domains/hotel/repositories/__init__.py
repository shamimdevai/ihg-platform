"""Raw database queries for the hotel domain — one module per model, except
invoice_repository.py, which handles both Invoice and InvoiceItem per the task
spec (invoice items are always accessed in the context of their parent invoice).
"""