from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import base64
import tenseal as ts

app = FastAPI(title="HE Aggregation Sidecar")

class AggregationRequest(BaseModel):
    pub_ctx: str
    encrypted_blobs: List[str]

class AggregationResponse(BaseModel):
    aggregated_blob: str

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/aggregate", response_model=AggregationResponse)
def aggregate_ciphertexts(request: AggregationRequest):
    try:
        if not request.encrypted_blobs:
            raise HTTPException(status_code=400, detail="No encrypted blobs provided")
            
        print(f"Received {len(request.encrypted_blobs)} ciphertexts for aggregation.")
        
        # 1. Load the TenSEAL context (public keys only)
        ctx_bytes = base64.b64decode(request.pub_ctx)
        context = ts.context_from(ctx_bytes)
        
        # 2. Deserialize all ciphertexts
        # Since we chunked them in he_manager.py, each blob is actually a serialized list of chunks.
        # However, due to time constraints in this demo, let's assume the sidecar knows how to handle the chunking struct.
        # In he_manager.py we serialized them as [len(chunk1)] [chunk1_bytes] ...
        
        # Helper to deserialize the chunked format
        def deserialize_chunks(blob_bytes, ctx):
            chunks = []
            offset = 0
            while offset < len(blob_bytes):
                # read 4 bytes for length
                length = int.from_bytes(blob_bytes[offset:offset+4], byteorder='big')
                offset += 4
                chunk_bytes = blob_bytes[offset:offset+length]
                offset += length
                chunks.append(ts.ckks_vector_from(ctx, chunk_bytes))
            return chunks

        # Helper to serialize back to chunked format
        def serialize_chunks(chunks):
            result = bytearray()
            for chunk in chunks:
                chunk_bytes = chunk.serialize()
                result.extend(len(chunk_bytes).to_bytes(4, byteorder='big'))
                result.extend(chunk_bytes)
            return bytes(result)

        # 3. Aggregate (sum them up)
        aggregated_chunks = None
        num_nodes = len(request.encrypted_blobs)
        
        for idx, blob_b64 in enumerate(request.encrypted_blobs):
            blob_bytes = base64.b64decode(blob_b64)
            node_chunks = deserialize_chunks(blob_bytes, context)
            
            if aggregated_chunks is None:
                aggregated_chunks = node_chunks
            else:
                for c_idx in range(len(aggregated_chunks)):
                    aggregated_chunks[c_idx] = aggregated_chunks[c_idx] + node_chunks[c_idx]
                    
        # 4. Average (multiply by 1/N)
        if aggregated_chunks is not None:
            scalar = 1.0 / num_nodes
            for c_idx in range(len(aggregated_chunks)):
                aggregated_chunks[c_idx] = aggregated_chunks[c_idx] * scalar

        # 5. Serialize and return
        final_bytes = serialize_chunks(aggregated_chunks)
        b64_result = base64.b64encode(final_bytes).decode('utf-8')
        
        print("Aggregation complete. Returning ciphertext.")
        return AggregationResponse(aggregated_blob=b64_result)
        
    except Exception as e:
        print(f"Aggregation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
