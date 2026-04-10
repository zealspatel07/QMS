

interface POStatusTimelineProps {
  status: string;
}

export default function POStatusTimeline({ status }: POStatusTimelineProps) {
  const statusStages = [
    { key: "created", label: "PO Created", icon: "✔" },
    { key: "vendor_confirmed", label: "Vendor Confirmed", icon: "✔" },
    { key: "processing", label: "Processing", icon: "✔" },
    { key: "partially_delivered", label: "Partially Delivered", icon: "✔" },
    { key: "completed", label: "Completed", icon: "○" },
  ];

  const getStageIndex = (currentStatus: string) => {
    const statusMap: { [key: string]: number } = {
      created: 0,
      vendor_confirmed: 1,
      processing: 2,
      partially_delivered: 3,
      completed: 4,
    };
    return statusMap[currentStatus] ?? -1;
  };

  const currentIndex = getStageIndex(status);

  const isStageCompleted = (stageIndex: number) => {
    return currentIndex >= stageIndex;
  };

  const isCurrentStage = (stageIndex: number) => {
    return currentIndex === stageIndex;
  };

  return (
    <div className="bg-white shadow rounded p-6 mt-6">
      <h2 className="text-lg font-bold mb-8">Delivery Status Timeline</h2>

      <div className="relative">
        {/* Connecting line background */}
        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-300">
          {/* Progress indicator line */}
          <div
            className="h-1 bg-green-500 transition-all duration-500"
            style={{
              width: currentIndex >= 0 
                ? `${(currentIndex / (statusStages.length - 1)) * 100}%`
                : "0%"
            }}
          ></div>
        </div>

        {/* Timeline stages */}
        <div className="flex items-start justify-between relative z-10">
          {statusStages.map((stage, index) => (
            <div key={stage.key} className="flex flex-col items-center flex-1">
              {/* Circle for stage indicator */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all shadow-md ${
                  isStageCompleted(index)
                    ? "bg-green-500 text-white"
                    : isCurrentStage(index)
                    ? "bg-blue-500 text-white ring-4 ring-blue-200"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {isStageCompleted(index) ? "✔" : stage.icon}
              </div>

              {/* Label */}
              <p
                className={`mt-4 text-xs font-medium text-center w-24 leading-tight transition-all ${
                  isStageCompleted(index)
                    ? "text-green-700"
                    : isCurrentStage(index)
                    ? "text-blue-700"
                    : "text-gray-600"
                }`}
              >
                {stage.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Status Details */}
      <div className="mt-12 pt-6 border-t">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Current Status</p>
            <p className="text-lg font-semibold capitalize text-blue-600">
              {status?.replace(/_/g, " ")}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Progress</p>
            <div className="flex items-center mt-2">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: currentIndex >= 0 
                      ? `${((currentIndex + 1) / statusStages.length) * 100}%`
                      : "0%"
                  }}
                ></div>
              </div>
              <span className="ml-3 text-sm font-semibold text-gray-700">
                {currentIndex >= 0 
                  ? Math.round(((currentIndex + 1) / statusStages.length) * 100)
                  : "0"}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
