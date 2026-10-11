import { initializeRedisClient } from "@/utils/client.js";
import { bloomKey } from "@/utils/keys.js";

async function createBloomFilter() {
  const client = await initializeRedisClient();

  await client.del(bloomKey);

  await client.bf.reserve(bloomKey, 0.0001, 1000000);
}

await createBloomFilter();
process.exit();
