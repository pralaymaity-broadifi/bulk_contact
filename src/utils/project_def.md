# Bulk Contact Deduplication & Enrichment Platform**

## Build a SaaS tool where sales teams upload CSV/Excel files containing thousands of contacts (name, email, phone, company). The system should:

- Accept bulk uploads (files up to 100MB with 500K+ rows) via chunked upload
- Queue each file for background processing so the API responds instantly with a job ID
- Deduplicate contacts using fuzzy matching (same person with "John Smith" vs "J. Smith", different email casing, phone formatting)
- Enrich contacts by calling a mock third-party API (rate-limited, which is why you need queues)
- Store processed contacts in MongoDB with Mongoose schemas
- Cache frequent lookups and job status in Redis
- Provide full-text search with filters (by company, tags, date ranges) using Elasticsearch or MongoDB Atlas Search

### The interesting challenges: handling partial failures, retry logic, progress tracking (WebSockets + Redis pub/sub), and preventing duplicate job submissions.



Queue system (BullMQ)
❌ Job tracking (jobId)
❌ Progress updates
❌ Fuzzy matching engine
❌ Enrichment system