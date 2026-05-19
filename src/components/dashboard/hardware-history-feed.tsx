import type { HardwareHistory } from "@/lib/inventory-data";

type HardwareHistoryFeedProps = {
  events: HardwareHistory[];
};

const eventLabels: Record<HardwareHistory["eventType"], string> = {
  initial_snapshot: "Snapshot inicial",
  ram_upgrade: "Upgrade RAM",
  storage_change: "Troca SSD",
  os_change: "Mudanca SO",
};

export function HardwareHistoryFeed({ events }: HardwareHistoryFeedProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Historico de hardware
          </h2>
          <p className="text-sm text-zinc-500">
            Mudancas detectadas pelo agente.
          </p>
        </div>
        <span className="text-sm font-medium text-teal-700">
          Auditoria real
        </span>
      </div>

      <div className="mt-4 divide-y divide-zinc-200">
        {events.length > 0 ? (
          events.map((event) => (
            <article key={event.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-zinc-950">
                    {eventLabels[event.eventType]}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {event.assetTag}
                  </p>
                </div>
                <time className="text-sm text-zinc-500">{event.observedAt}</time>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {event.oldValue
                  ? `${event.oldValue} -> ${event.newValue}`
                  : event.newValue}
              </p>
            </article>
          ))
        ) : (
          <p className="py-6 text-sm text-zinc-500">
            Nenhuma mudanca de hardware registrada ainda.
          </p>
        )}
      </div>
    </section>
  );
}
