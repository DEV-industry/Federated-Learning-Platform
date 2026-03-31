"""
Homomorphic Encryption Manager — TenSEAL CKKS operations for Federated Learning.

Encapsulates context generation, encryption/decryption, and serialization
so that the main training loop stays clean. All ciphertexts use the CKKS
scheme which supports approximate arithmetic (addition + multiplication)
on encrypted floating-point vectors.

Usage:
    ctx = generate_context()
    enc_blob, pub_ctx_blob = encrypt_weights(ctx, flat_weights)
    recovered = decrypt_weights(ctx, enc_blob)
"""

import tenseal as ts
from typing import List, Tuple


# ---------------------------------------------------------------------------
# Context generation
# ---------------------------------------------------------------------------

def generate_context() -> ts.Context:
    """Create a TenSEAL CKKS context with parameters sized for FL weight vectors.

    Parameters chosen for a balance of security (~128-bit) and performance:
    - poly_modulus_degree = 8192   → supports vectors up to ~4096 slots
    - coeff_mod_bit_sizes          → [60, 40, 40, 60] enables 2 multiplications
    - global_scale = 2^40          → sufficient precision for model weights
    """
    ctx = ts.context(
        ts.SCHEME_TYPE.CKKS,
        poly_modulus_degree=8192,
        coeff_mod_bit_sizes=[60, 40, 40, 60],
    )
    ctx.global_scale = 2**40
    ctx.generate_galois_keys()
    return ctx


# ---------------------------------------------------------------------------
# Encryption / Decryption
# ---------------------------------------------------------------------------

def encrypt_weights(ctx: ts.Context, flat_weights: List[float]) -> Tuple[bytes, bytes]:
    """Encrypt a flat weight vector using CKKS.

    For vectors longer than the slot count (~4096), we chunk the vector
    into multiple CKKSVectors, serialize them individually, and pack
    them into a single blob with a 4-byte length prefix per chunk.

    Returns:
        (encrypted_blob, public_context_blob)
    """
    slot_count = ctx.poly_modulus_degree // 2  # ~4096 for degree=8192

    # Chunk the weight vector to fit within CKKS slot limits
    chunks = [
        flat_weights[i : i + slot_count]
        for i in range(0, len(flat_weights), slot_count)
    ]

    encrypted_chunks: List[bytes] = []
    for chunk in chunks:
        enc_vec = ts.ckks_vector(ctx, chunk)
        encrypted_chunks.append(enc_vec.serialize())

    # Pack: [num_chunks (4B)] + [len_i (4B) + data_i] ...
    blob = len(chunks).to_bytes(4, "big")
    for ec in encrypted_chunks:
        blob += len(ec).to_bytes(4, "big") + ec

    # Serialize public context (excludes secret key)
    pub_ctx = ctx.copy()
    pub_ctx.make_context_public()
    pub_ctx_blob = pub_ctx.serialize()

    return blob, pub_ctx_blob


def decrypt_weights(ctx: ts.Context, encrypted_blob: bytes) -> List[float]:
    """Decrypt a serialized CKKS blob back to a flat weight vector.

    This requires the *private* context (with secret key).
    """
    offset = 0
    num_chunks = int.from_bytes(encrypted_blob[offset : offset + 4], "big")
    offset += 4

    decrypted: List[float] = []
    for _ in range(num_chunks):
        chunk_len = int.from_bytes(encrypted_blob[offset : offset + 4], "big")
        offset += 4
        chunk_data = encrypted_blob[offset : offset + chunk_len]
        offset += chunk_len

        enc_vec = ts.ckks_vector_from(ctx, chunk_data)
        decrypted.extend(enc_vec.decrypt())

    return decrypted


# ---------------------------------------------------------------------------
# Serialization helpers (for the HE Aggregation Sidecar)
# ---------------------------------------------------------------------------

def serialize_public_context(ctx: ts.Context) -> bytes:
    """Serialize context without the secret key (safe to send to aggregator)."""
    pub_ctx = ctx.copy()
    pub_ctx.make_context_public()
    return pub_ctx.serialize()


def deserialize_public_context(blob: bytes) -> ts.Context:
    """Restore a public-only TenSEAL context from bytes."""
    return ts.context_from(blob)


def aggregate_encrypted_weights(
    pub_ctx_blob: bytes,
    encrypted_blobs: List[bytes],
) -> bytes:
    """Homomorphically aggregate (average) encrypted weight vectors.

    Runs entirely on ciphertexts — never sees plaintext weights.
    Used by the HE Aggregation Sidecar.

    Algorithm:
        1. Deserialize all ciphertext chunks
        2. Add them together element-wise (CKKS supports this)
        3. Multiply by 1/n to compute the mean
        4. Serialize the result
    """
    ctx = ts.context_from(pub_ctx_blob)
    n = len(encrypted_blobs)

    if n == 0:
        raise ValueError("No encrypted blobs to aggregate")

    # Parse the first blob to get the chunk structure
    def _parse_blob(blob: bytes):
        offset = 0
        num_chunks = int.from_bytes(blob[offset : offset + 4], "big")
        offset += 4
        chunks = []
        for _ in range(num_chunks):
            chunk_len = int.from_bytes(blob[offset : offset + 4], "big")
            offset += 4
            chunks.append(blob[offset : offset + chunk_len])
            offset += chunk_len
        return chunks

    all_chunk_sets = [_parse_blob(blob) for blob in encrypted_blobs]
    num_chunks = len(all_chunk_sets[0])

    # Homomorphic addition across all nodes, then divide by n
    aggregated_chunks: List[bytes] = []
    for chunk_idx in range(num_chunks):
        acc = ts.ckks_vector_from(ctx, all_chunk_sets[0][chunk_idx])
        for node_idx in range(1, n):
            other = ts.ckks_vector_from(ctx, all_chunk_sets[node_idx][chunk_idx])
            acc += other
        # Multiply by 1/n to get the mean
        acc *= 1.0 / n
        aggregated_chunks.append(acc.serialize())

    # Repack into the same format
    result = num_chunks.to_bytes(4, "big")
    for ac in aggregated_chunks:
        result += len(ac).to_bytes(4, "big") + ac

    return result
