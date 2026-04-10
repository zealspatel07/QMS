

interface Activity {
  id: number | null;
  activity_type: string;
  created_at: string;
  po_number?: string;
  vendor_name?: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  return (
    <div className="bg-white shadow rounded p-6 mt-6">
      <h2 className="text-lg font-bold mb-6">Procurement Timeline</h2>

      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={index} className="flex gap-4">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              {index < activities.length - 1 && (
                <div className="w-1 h-12 bg-gray-300 my-2"></div>
              )}
            </div>

            {/* Activity details */}
            <div className="pb-4">
              <p className="font-semibold text-gray-800">
                {activity.activity_type}
                {activity.po_number && ` - ${activity.po_number}`}
              </p>
              <p className="text-sm text-gray-600">
                {activity.vendor_name && (
                  <>
                    <span className="font-medium">Vendor:</span> {activity.vendor_name}
                    <br />
                  </>
                )}
                <span className="text-xs">
                  {activity.created_at
                    ? new Date(activity.created_at).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
