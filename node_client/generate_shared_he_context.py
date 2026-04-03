import argparse
import base64
import tenseal as ts


def generate_context() -> ts.Context:
    ctx = ts.context(
        ts.SCHEME_TYPE.CKKS,
        poly_modulus_degree=8192,
        coeff_mod_bit_sizes=[60, 40, 40, 60],
    )
    ctx.global_scale = 2**40
    ctx.generate_galois_keys()
    return ctx


def main():
    parser = argparse.ArgumentParser(description="Generate a shared TenSEAL CKKS context for FL nodes.")
    parser.add_argument("--private-out", default="shared_he_context_private.b64", help="Output file for full context (base64).")
    parser.add_argument("--public-out", default="shared_he_context_public.b64", help="Output file for public context (base64).")
    args = parser.parse_args()

    full_ctx = generate_context()
    private_blob = full_ctx.serialize()

    public_ctx = full_ctx.copy()
    public_ctx.make_context_public()
    public_blob = public_ctx.serialize()

    with open(args.private_out, "w", encoding="ascii") as f:
        f.write(base64.b64encode(private_blob).decode("ascii"))

    with open(args.public_out, "w", encoding="ascii") as f:
        f.write(base64.b64encode(public_blob).decode("ascii"))

    print("Generated shared HE context files:")
    print(f"- private: {args.private_out}")
    print(f"- public : {args.public_out}")
    print("Distribute the private context securely to participating FL nodes.")


if __name__ == "__main__":
    main()
