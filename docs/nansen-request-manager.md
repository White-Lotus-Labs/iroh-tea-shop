# Nansen Request Manager

`src/nansen/request-manager.ts` is the process-local admission layer for real Nansen upstream calls. Deck and ticker detail assembly, snapshot refreshes, and Shelf snapshot refreshes do not acquire slots. Their individual JSON calls use `managedNansenPost`; Iroh Agent SSE uses a separate lease from the same manager.

The manager has FIFO normal and Iroh queues. The oldest eligible head takes the next global slot. An Iroh head is ineligible while its own cap is full, allowing normal work to proceed. Both lanes share a token-bucket request-start gate and one 429 cooldown. An Iroh lease lasts through upstream SSE reading and is released before final chat persistence.

| Environment variable               | Default |
| ---------------------------------- | ------: |
| `NANSEN_GLOBAL_MAX_CONCURRENT`     |       8 |
| `NANSEN_IROH_MAX_CONCURRENT`       |       2 |
| `NANSEN_NORMAL_MAX_QUEUE`          |      48 |
| `NANSEN_NORMAL_MAX_QUEUE_WAIT_MS`  |   20000 |
| `NANSEN_IROH_MAX_QUEUE`            |       4 |
| `NANSEN_IROH_MAX_QUEUE_WAIT_MS`    |   15000 |
| `NANSEN_REQUEST_STARTS_PER_SECOND` |       3 |
| `NANSEN_REQUEST_START_BURST`       |       6 |
| `NANSEN_JSON_MAX_RETRIES`          |       1 |
| `NANSEN_JSON_RETRY_BASE_DELAY_MS`  |     500 |

These are conservative safeguards, not measured production capacity. Limits, queues, deduplication, pacing, and cooldown are local to each server process. Multiple processes do not coordinate.
The global cap has a minimum of two, and the Iroh cap is clamped below it so a normal-capable slot always remains.

Normal jobs with the same endpoint and canonical JSON body share only queued/running work. The entry disappears on completion. One cancelled waiter does not cancel other waiters. JSON attempts use the existing 15-second transport timeout and retry at most once for 429, network failure, timeout, or upstream 5xx. Retry backoff and cooldown do not occupy a slot. Retry-After is respected without a cap; a retry beyond the job's deadline fails. Iroh has no response cache, deduplication, or automatic replay. It keeps the existing roughly 90-second stream timeout, starting when the Agent fetch begins. HTTP or SSE 429 informs the shared cooldown.

Existing feature caches remain outside the manager: Deck 10 minutes, ticker detail 15 minutes, and Shelf 30 minutes. Their stale behavior and refresh sharing are unchanged. Iroh remains uncached. Authenticated chat messages are saved only after Iroh admission. A process-local per-chat guard rejects a second simultaneous turn on the same saved chat. If Stop arrives after the user message write but before fetch begins, that write and its title update are rolled back.
