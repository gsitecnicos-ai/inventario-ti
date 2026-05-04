import type { Activity } from "@/lib/inventory-data";
import { getTenantName } from "@/lib/inventory-data";

type ActivityFeedProps = {
  activities: Activity[];
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">
        Eventos recentes
      </h2>
      <div className="mt-4 divide-y divide-zinc-200">
        {activities.map((activity) => (
          <article key={activity.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-950">{activity.title}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {getTenantName(activity.tenantId)}
                </p>
              </div>
              <time className="text-sm text-zinc-500">{activity.time}</time>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {activity.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
