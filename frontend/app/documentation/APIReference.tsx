import { Globe, Zap, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

interface Endpoint {
  method: "GET" | "POST" | "DELETE" | "PUT";
  path: string;
  description: string;
  body?: string;
  response?: string;
}

const restEndpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/status",
    description: "Returns full platform state: current round, node details, accuracy/loss history, event logs, node activity, security verdicts, and configuration.",
    response: '{ currentRound, accuracy, loss, nodeDetails[], eventLogs[], securityVerdicts, config, ... }',
  },
  {
    method: "GET",
    path: "/api/health",
    description: "Liveness probe. Returns HTTP 200 with {\"status\":\"UP\"} when the aggregator and all dependencies are healthy.",
    response: '{ "status": "UP" }',
  },
  {
    method: "GET",
    path: "/api/model/download",
    description: "Downloads the latest global model binary (.bin) from MinIO. Returns the raw binary stream with content-disposition header.",
    response: "Binary stream (application/octet-stream)",
  },
  {
    method: "GET",
    path: "/api/model/versions",
    description: "Lists all persisted model versions with round number, accuracy, loss, timestamp, and file size.",
    response: '[ { round, accuracy, loss, timestamp, sizeBytes }, ... ]',
  },
  {
    method: "GET",
    path: "/api/model/download/{round}",
    description: "Downloads a specific model version by round number from MinIO storage.",
    response: "Binary stream (application/octet-stream)",
  },
  {
    method: "POST",
    path: "/api/nodes/unregister",
    description: "Permanently bans a node. The node's status is set to BANNED in the database and it cannot re-authenticate.",
    body: '{ "nodeId": "string" }',
    response: '{ "success": true }',
  },
  {
    method: "DELETE",
    path: "/api/training/reset",
    description: "Wipes all round history, model artifacts from MinIO, resets the aggregator to Round 0, and clears all node registrations.",
    response: '{ "success": true }',
  },
  {
    method: "POST",
    path: "/api/config",
    description: "Updates training configuration (quorum size, malicious fraction, DP noise, FedProx mu). Changes take effect on the next round.",
    body: '{ minQuorum, maliciousFraction, dpNoiseMultiplier, fedProxMu, ... }',
    response: '{ "success": true }',
  },
];

const grpcServices = [
  {
    service: "FederatedService",
    methods: [
      {
        name: "RegisterNode",
        description: "Node authentication and registration. Validates Ed25519 signature, issues JWT token, and assigns node to training pool.",
        request: "RegisterRequest { nodeId, publicKey, signature, hostname }",
        response: "RegisterResponse { accepted, token, heContext }",
      },
      {
        name: "SubmitWeights",
        description: "Submits encrypted model weights for the current round. Weights are stored in MinIO and queued via RabbitMQ for aggregation.",
        request: "WeightSubmission { nodeId, token, roundNumber, encryptedWeights }",
        response: "SubmissionAck { accepted, message }",
      },
      {
        name: "GetGlobalModel",
        description: "Downloads the latest aggregated global model for the next local training round.",
        request: "ModelRequest { nodeId, token, roundNumber }",
        response: "ModelResponse { weights, roundNumber, config }",
      },
      {
        name: "Heartbeat",
        description: "Periodic keepalive signal. Nodes that miss heartbeats are marked STALE after timeout.",
        request: "HeartbeatRequest { nodeId, token, timestamp }",
        response: "HeartbeatResponse { ack }",
      },
    ],
  },
];

const wsTopics = [
  {
    topic: "/topic/updates",
    description: "Main real-time data stream. Pushes full status updates after every aggregation round, node registration/disconnect, and configuration change.",
    payload: "Same structure as GET /api/status — includes nodeDetails, eventLogs, accuracy/loss arrays, securityVerdicts, nodeActivity, config.",
  },
  {
    topic: "SockJS endpoint",
    description: "WebSocket connection via /ws-sockjs using SockJS fallback + STOMP protocol. The frontend subscribes to topics after STOMP handshake.",
    payload: "Connect to: {API_URL}/ws-sockjs → STOMP CONNECT → SUBSCRIBE /topic/updates",
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500",
  POST: "bg-blue-500",
  DELETE: "bg-red-500",
  PUT: "bg-amber-500",
};

export default function APIReference() {
  return (
    <div className="space-y-8">
      {/* REST API */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-sm text-white">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">REST API Endpoints</h3>
            <p className="text-xs text-argon-muted mt-0.5">Base URL: <code className="text-[0.6875rem] bg-argon-bg px-1.5 py-0.5 rounded font-mono">https://localhost:8443</code></p>
          </div>
        </div>

        <div className="space-y-3">
          {restEndpoints.map((ep) => (
            <div key={`${ep.method}-${ep.path}`} className="border border-argon-lighter/60 rounded-xl p-4 hover:border-argon-primary/20 transition-all duration-200">
              <div className="flex items-center gap-3 mb-2">
                <span className={`${methodColors[ep.method]} text-white text-[0.625rem] font-bold uppercase px-2.5 py-1 rounded-md tracking-wider`}>
                  {ep.method}
                </span>
                <code className="text-sm font-mono font-semibold text-argon-default">{ep.path}</code>
              </div>
              <p className="text-xs text-argon-muted leading-relaxed mb-3">{ep.description}</p>

              {ep.body && (
                <div className="mb-2">
                  <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-wider">Request Body</span>
                  <div className="bg-[#1e1e2e] rounded-lg px-3 py-2 mt-1 font-mono text-[0.6875rem] text-green-400 overflow-x-auto">
                    <code>{ep.body}</code>
                  </div>
                </div>
              )}

              {ep.response && (
                <div>
                  <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-wider">Response</span>
                  <div className="bg-[#1e1e2e] rounded-lg px-3 py-2 mt-1 font-mono text-[0.6875rem] text-cyan-400 overflow-x-auto">
                    <code>{ep.response}</code>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* gRPC Services */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg shadow-sm text-white">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">gRPC Services</h3>
            <p className="text-xs text-argon-muted mt-0.5">Secured with mutual TLS (mTLS). Port: <code className="text-[0.6875rem] bg-argon-bg px-1.5 py-0.5 rounded font-mono">9090</code></p>
          </div>
        </div>

        {grpcServices.map((svc) => (
          <div key={svc.service} className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-argon-muted uppercase tracking-wider bg-argon-bg px-3 py-1.5 rounded-full">{svc.service}</span>
            </div>
            {svc.methods.map((m) => (
              <div key={m.name} className="border border-argon-lighter/60 rounded-xl p-4 hover:border-purple-300/40 transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-purple-500 text-white text-[0.625rem] font-bold uppercase px-2.5 py-1 rounded-md tracking-wider">RPC</span>
                  <code className="text-sm font-mono font-semibold text-argon-default">{m.name}</code>
                </div>
                <p className="text-xs text-argon-muted leading-relaxed mb-3">{m.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-wider">Request</span>
                    <div className="bg-[#1e1e2e] rounded-lg px-3 py-2 mt-1 font-mono text-[0.6875rem] text-amber-400 overflow-x-auto">
                      <code>{m.request}</code>
                    </div>
                  </div>
                  <div>
                    <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-wider">Response</span>
                    <div className="bg-[#1e1e2e] rounded-lg px-3 py-2 mt-1 font-mono text-[0.6875rem] text-cyan-400 overflow-x-auto">
                      <code>{m.response}</code>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* WebSocket */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">WebSocket (STOMP)</h3>
            <p className="text-xs text-argon-muted mt-0.5">Real-time event streaming via SockJS + STOMP protocol.</p>
          </div>
        </div>

        <div className="space-y-3">
          {wsTopics.map((ws) => (
            <div key={ws.topic} className="border border-argon-lighter/60 rounded-xl p-4 hover:border-emerald-300/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-500 text-white text-[0.625rem] font-bold uppercase px-2.5 py-1 rounded-md tracking-wider">WS</span>
                <code className="text-sm font-mono font-semibold text-argon-default">{ws.topic}</code>
              </div>
              <p className="text-xs text-argon-muted leading-relaxed mb-2">{ws.description}</p>
              <div>
                <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-wider">Payload</span>
                <div className="bg-[#1e1e2e] rounded-lg px-3 py-2 mt-1 font-mono text-[0.6875rem] text-green-400 overflow-x-auto">
                  <code>{ws.payload}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-blue-700 mb-1">Authentication Notes</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            REST endpoints are unauthenticated (internal network only). gRPC uses mTLS with client certificates.
            WebSocket connections use SockJS with automatic reconnection. All traffic is encrypted via TLS.
          </p>
        </div>
      </div>
    </div>
  );
}
