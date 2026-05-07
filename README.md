#  Bulk Contact Deduplication & Enrichment Platform

A backend system to upload large CSV/XLSX files in chunks, process them asynchronously using BullMQ, detect duplicates using fuzzy logic, enrich data, and store clean contacts in MongoDB.

---

#  Features

-  Chunked file upload (CSV / Excel)
-  File merge after upload completion
-  Background processing using BullMQ worker
-  Duplicate detection (exact + fuzzy matching)
-  Batch database insertion (performance optimized)
-  Full support for:
    CSV files (stream + merge)
    XLSX files (chunk-based row parsing, no file merge)
    Automatic cleanup of temporary chunk files 
-  Advanced search using MongoDB Atlas Search with:

    Autocomplete (prefix-based name search)
    Text search (multi-field fallback across name, email, company, phone)
    

#  Redis Integration

-  Caching for API responses (get / getAll contacts)
-  Cache invalidation after bulk insert
-  Reduce MongoDB load for repeated queries
-  Fast response for frequently accessed data
-  Queue-ready Redis connection (BullMQ support)
- 