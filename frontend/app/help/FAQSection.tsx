"use client";
import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqItems: FAQItem[] = [
  {
    category: "General",
    question: "What is Federated Learning?",
    answer: "Federated Learning (FL) is a machine learning approach where training is distributed across multiple devices or nodes. Each node trains locally on its private data and sends only model updates (weights) to a central aggregator — the raw data never leaves the device. This preserves privacy while enabling collaborative model training.",
  },
  {
    category: "General",
    question: "How does this platform differ from standard FL?",
    answer: "This platform goes beyond basic FedAvg by integrating Homomorphic Encryption (TenSEAL CKKS) for encrypted-domain aggregation, Byzantine-robust defenses (Multi-Krum / BULYAN), differential privacy, dynamic hyperparameter tuning, and a production-ready infrastructure with PostgreSQL, MinIO, RabbitMQ, and Prometheus monitoring.",
  },
  {
    category: "Security",
    question: "What is Byzantine-robust aggregation?",
    answer: "Byzantine-robust aggregation protects the global model from poisoning attacks. Multi-Krum scores each node's update based on geometric distance to neighbors and rejects outliers. BULYAN goes further by applying a trimmed-mean after Krum selection. The 'Malicious Fraction' config parameter controls the assumed ratio of adversarial nodes.",
  },
  {
    category: "Security",
    question: "How does Homomorphic Encryption (HE) work here?",
    answer: "Nodes encrypt their model weights using TenSEAL's CKKS scheme before sending them. The aggregator sums the encrypted weights in ciphertext space via an HE sidecar service — it never sees plaintext weights. All nodes must share the same public HE context (generated at startup), ensuring cryptographic consistency.",
  },
  {
    category: "Security",
    question: "What happens when a node is flagged as malicious?",
    answer: "The aggregator tracks rejection counts per node. Multi-Krum rejects suspicious nodes per round. If a node consistently submits invalid or poisoned weights, an admin can permanently ban it from the Nodes dashboard. Banned nodes cannot re-register or submit weights.",
  },
  {
    category: "Training",
    question: "What is the FedProx regularization term?",
    answer: "FedProx adds a proximal term (mu * ||w - w_global||^2) to each node's local loss function, penalizing large deviations from the global model. This helps convergence in heterogeneous (non-IID) data settings. The mu value is auto-tuned by the Dynamic Hyperparameter Controller unless manually locked.",
  },
  {
    category: "Training",
    question: "How does the dynamic quorum work?",
    answer: "Instead of waiting for a fixed number of nodes, the aggregator calculates an effective quorum as max(minQuorum, ceil(activeNodes * minCompletionPercentage)). A round timeout (default 300s) triggers aggregation if enough nodes have submitted but the dynamic quorum hasn't been reached.",
  },
  {
    category: "Training",
    question: "Where is the global model stored?",
    answer: "After each round, the aggregated model is persisted as a binary file in MinIO (path: models/round-X.bin) and its metadata saved in PostgreSQL (global_model_state table). On aggregator restart, the latest state is automatically restored from MinIO.",
  },
  {
    category: "Infrastructure",
    question: "What services does Docker Compose run?",
    answer: "The full stack includes: Aggregator (Spring Boot), Frontend (Next.js), PostgreSQL, MinIO (S3-compatible storage), RabbitMQ (message broker for async weight processing), Prometheus, Grafana, HE Sidecar (Python/TenSEAL), and 1-3 Node Clients (Python/PyTorch).",
  },
  {
    category: "Infrastructure",
    question: "How do I connect an external node client?",
    answer: "Copy the shared HE context files and TLS certificates from the main machine. Set environment variables: AGGREGATOR_URL, GRPC_TARGET, NODE_ID, and paths to he_context_public.b64, trusted_ca.pem, client.pem, client.key. Then run the node client container with docker-compose.",
  },
];

const categories = Array.from(new Set(faqItems.map((f) => f.category)));

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("General");

  const filteredFAQ = faqItems.filter((f) => f.category === activeCategory);

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Frequently Asked Questions</h3>
            <p className="text-xs text-argon-muted mt-0.5">Common questions about Federated Learning and this platform.</p>
          </div>
        </div>
        <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">
          {faqItems.length} questions
        </span>
      </div>

      <div className="p-6">
        {/* Category tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 ${
                activeCategory === cat
                  ? "bg-argon-primary text-white shadow-argon-primary"
                  : "bg-argon-bg text-argon-muted hover:bg-argon-lighter"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Accordion */}
        <div className="space-y-2">
          {filteredFAQ.map((item, idx) => {
            const globalIdx = faqItems.indexOf(item);
            const isOpen = openIndex === globalIdx;

            return (
              <div key={globalIdx} className={`border rounded-xl transition-all duration-300 ${isOpen ? "border-argon-primary/30 shadow-sm" : "border-argon-lighter/60"}`}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : globalIdx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className={`text-sm font-semibold transition-colors ${isOpen ? "text-argon-primary" : "text-argon-default"}`}>
                    {item.question}
                  </span>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-argon-light transition-transform duration-300 ${isOpen ? "rotate-180 text-argon-primary" : ""}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-60" : "max-h-0"}`}>
                  <div className="px-5 pb-4 pt-0">
                    <p className="text-xs text-argon-muted leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
