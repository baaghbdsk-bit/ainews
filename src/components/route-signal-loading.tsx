import "@/styles/loading.css";

interface RouteSignalLoadingProps {
  destination: string;
  tone: string;
}

export function RouteSignalLoading({
  destination,
  tone,
}: RouteSignalLoadingProps) {
  return (
    <div
      className="route-signal-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ color: tone }}
    >
      <svg
        className="route-signal-loading__art"
        viewBox="0 0 240 140"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="route-signal-loading__track"
          d="M12 28 H50 C88 28 80 70 116 70"
        />
        <path
          className="route-signal-loading__track"
          d="M12 70 H116"
        />
        <path
          className="route-signal-loading__track"
          d="M12 112 H50 C88 112 80 70 116 70"
        />
        <path
          className="route-signal-loading__track"
          d="M160 70 H228"
        />
        <path
          className="route-signal-loading__flow route-signal-loading__flow--cyan"
          d="M12 28 H50 C88 28 80 70 116 70"
        />
        <path
          className="route-signal-loading__flow route-signal-loading__flow--yellow"
          d="M12 70 H116"
        />
        <path
          className="route-signal-loading__flow route-signal-loading__flow--orange"
          d="M12 112 H50 C88 112 80 70 116 70"
        />
        <path
          className="route-signal-loading__flow route-signal-loading__flow--route"
          d="M160 70 H228"
        />
        <circle
          className="route-signal-loading__core"
          cx="138"
          cy="70"
          r="22"
        />
        <rect
          className="route-signal-loading__bar route-signal-loading__bar--cyan"
          x="126"
          y="60"
          width="24"
          height="4"
          rx="2"
        />
        <rect
          className="route-signal-loading__bar route-signal-loading__bar--yellow"
          x="126"
          y="68"
          width="24"
          height="4"
          rx="2"
        />
        <rect
          className="route-signal-loading__bar route-signal-loading__bar--orange"
          x="126"
          y="76"
          width="24"
          height="4"
          rx="2"
        />
      </svg>
      <p className="route-signal-loading__label">
        Loading <span>{destination}</span>
      </p>
    </div>
  );
}
