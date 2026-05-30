# Ops Compliance - Wave 5

## Objective
Deliver production-grade operational compliance improvements for SplitNaira.

## Implementation Plan

### 1. Health Checks
- /health endpoint returns 200 with service status and uptime
- Database connectivity verified in health response
- Health check used by Docker and load balancer

### 2. Logging
- All requests logged via morgan middleware with request ID
- Errors logged with structured JSON via winston
- No sensitive data (private keys, passwords) in logs

### 3. Rate Limiting
- Global rate limit: 100 requests per 15 minutes per IP
- Stricter limits on write endpoints
- 429 responses include Retry-After header

### 4. Graceful Shutdown
- SIGTERM handler closes HTTP server before process exit
- In-flight requests allowed to complete (5s timeout)
- Database connections closed cleanly

## Rollback Notes
All ops changes are backward-compatible. Rollback by reverting this PR.

## Operational Impact
Improved observability and reliability. No breaking changes to API contracts.
