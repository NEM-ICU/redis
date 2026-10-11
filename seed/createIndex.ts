import { SchemaFieldType } from "redis";
import { initializeRedisClient } from "@/utils/client.js";
import { indexKey, getKeyName } from "@/utils/keys.js";
import { nextTick } from "node:process";

async function createIndex() {
  const client = await initializeRedisClient();

  try {
    await client.ft.dropIndex("idx:users");
  } catch (err) {
    console.log("No existing index to delete");
  }

  await client.ft.create(
    indexKey,
    {
      id: {
        type: "TEXT",
        AS: "id",
      },
      name: {
        type: "TEXT",
        AS: "name",
      },
      avgStars: {
        type: "NUMERIC",
        AS: "avgStars",
        SORTABLE: true,
      },
    },
    {
      ON: "HASH",
      PREFIX: getKeyName("restaurants"),
    },
  );
}

await createIndex();
process.exit();
