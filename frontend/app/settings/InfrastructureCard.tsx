import { Container, Database, HardDrive, BarChart3, MessageSquare, Eye, Cpu, Lock } from "lucide-react";

interface Service {
  name: string;
  port: string;
  role: string;
  badgeClass: string;
  badgeLabel: string;
  Icon: React.ElementType;
}

const services: Service[] = [
  { name: "Aggregator",  port: "8443 / 9443", role: "REST + gRPC",     badgeClass: "argon-badge-primary", badgeLabel: "Core",       Icon: Cpu },
  { name: "Frontend",    port: "3000",         role: "Next.js UI",      badgeClass: "argon-badge-primary", badgeLabel: "Core",       Icon: Eye },
  { name: "PostgreSQL",  port: "5432",         role: "Round history",   badgeClass: "argon-badge-info",    badgeLabel: "Storage",    Icon: Database },
  { name: "MinIO",       port: "9000 / 9001",  role: "Model artifacts", badgeClass: "argon-badge-info",    badgeLabel: "Storage",    Icon: HardDrive },
  { name: "RabbitMQ",    port: "5672 / 15672", role: "Message broker",  badgeClass: "argon-badge-warning", badgeLabel: "Messaging",  Icon: MessageSquare },
  { name: "Prometheus",  port: "9091",         role: "Metrics scraper", badgeClass: "argon-badge-success", badgeLabel: "Monitoring", Icon: BarChart3 },
  { name: "Grafana",     port: "3001",         role: "Dashboards",      badgeClass: "argon-badge-success", badgeLabel: "Monitoring", Icon: BarChart3 },
  { name: "HE Sidecar",  port: "8001",         role: "TenSEAL CKKS",   badgeClass: "argon-badge-danger",  badgeLabel: "Crypto",     Icon: Lock },
];

export default function InfrastructureCard() {
  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
            <Container className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Infrastructure Overview</h3>
            <p className="text-xs text-argon-muted mt-0.5">Docker Compose service topology.</p>
          </div>
        </div>
        <span className="text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">
          {services.length} services
        </span>
      </div>

      <div className="p-6">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 mb-3 px-2">
          <span className="col-span-4 text-[0.625rem] font-bold text-argon-muted uppercase tracking-widest">Service</span>
          <span className="col-span-3 text-[0.625rem] font-bold text-argon-muted uppercase tracking-widest">Port(s)</span>
          <span className="col-span-3 text-[0.625rem] font-bold text-argon-muted uppercase tracking-widest">Role</span>
          <span className="col-span-2 text-[0.625rem] font-bold text-argon-muted uppercase tracking-widest text-right">Type</span>
        </div>

        {/* Rows */}
        <div className="space-y-0">
          {services.map((svc, idx) => {
            const Icon = svc.Icon;
            return (
              <div
                key={svc.name}
                className={`grid grid-cols-12 gap-4 items-center px-2 py-3 rounded-argon hover:bg-argon-bg/50 transition-colors ${
                  idx < services.length - 1 ? "border-b border-argon-lighter/40" : ""
                }`}
              >
                <div className="col-span-4 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-argon bg-argon-bg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-argon-muted" />
                  </div>
                  <span className="text-sm font-bold text-argon-default">{svc.name}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-sm font-mono text-argon-muted">{svc.port}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-xs text-argon-muted font-semibold">{svc.role}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`argon-badge ${svc.badgeClass}`}>{svc.badgeLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
