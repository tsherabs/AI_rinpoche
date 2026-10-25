import chromadb

client = chromadb.HttpClient(
    host="tsherabs-workstation.tail58c99c.ts.net",
    port=443,
    ssl=True
)

print("Heartbeat:", client.heartbeat())

collection = client.get_collection(
    name="srr_bge_small_cls_v2"
)

print("Total passages:", collection.count())