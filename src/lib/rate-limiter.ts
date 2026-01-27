/**
 * Simple rate limiter to avoid hitting API rate limits
 * Processes requests in batches with delays between batches
 */

export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayMs: number = 200
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    )
    
    results.push(...batchResults)
    
    // Add delay between batches (except for the last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  return results
}
