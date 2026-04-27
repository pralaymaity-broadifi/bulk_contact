#  Bulk Contact Deduplication & Enrichment Platform

A backend system to upload large CSV/XLSX files in chunks, process them asynchronously using BullMQ, detect duplicates using fuzzy logic, enrich data, and store clean contacts in MongoDB.

---

#  Features

-  Chunked file upload (CSV / Excel)
-  File merge after upload completion
-  Background processing using BullMQ worker
-  Duplicate detection (exact + fuzzy matching)
-  Batch database insertion (performance optimized)
-  CSV + XLSX file support (Working on it)
-  Automatic cleanup of temporary chunks