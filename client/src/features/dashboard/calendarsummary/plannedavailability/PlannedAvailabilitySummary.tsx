import AvailabilityIndicatorBadge
  from "@/features/dashboard/calendarsummary/plannedavailability/availabilityindicatorbadge/AvailabilityIndicatorBadge.tsx"

export default function PlannedAvailabilitySummary() {
  return (
    <>
      <div className="calendar-week-nav">
        <button> Previous week </button>
        <p> week number </p>
        <button> Next week </button>
      </div>
      <div className="calendar-week-chips"></div>

      <div className="calendar-week-days">
        <ul className="calendar-week-days-list">
          <li>
            {" "}
            <div> Sunday</div>{" "}
            <div> <AvailabilityIndicatorBadge /> </div>
          </li>
          <li>
            {" "}
          <div> Monday</div>{" "}
          <div> <AvailabilityIndicatorBadge /> </div>
        </li><li>
        {" "}
        <div> Tuesday </div>{" "}
        <div> <AvailabilityIndicatorBadge /> </div>
      </li><li>
        {" "}
        <div> Thursday</div>{" "}
        <div> <AvailabilityIndicatorBadge /> </div>
      </li><li>
        {" "}
        <div> Friday</div>{" "}
        <div> <AvailabilityIndicatorBadge /> </div>
      </li><li>
        {" "}
        <div> Saturday</div>{" "}
        <div> <AvailabilityIndicatorBadge /> </div>
      </li>

        </ul>
      </div>
    </>
  )
}