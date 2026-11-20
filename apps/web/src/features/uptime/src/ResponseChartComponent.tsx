const WIDTH = 340;
const HEIGHT = 80;

// Average response time per half hour as a line, broken wherever nothing answered. Hand-drawn: the app has no chart library.
export function ResponseChartComponent({ values }: { values: (number | null)[] }) {
  const highest = Math.max(1, ...values.map((value) => value ?? 0));
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
  let path = '';
  values.forEach((value, index) => {
    if (value === null) return;
    const command = index === 0 || values[index - 1] === null ? 'M' : 'L';
    path += `${command}${(index * step).toFixed(1)},${(HEIGHT - 4 - (value / highest) * (HEIGHT - 12)).toFixed(1)}`;
  });

  return (
    <figure className="flex flex-col gap-1">
      <svg role="img" aria-label="Response time, last 24 hours" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-20 w-full" preserveAspectRatio="none">
        <line x1="0" x2={WIDTH} y1={HEIGHT - 4} y2={HEIGHT - 4} className="stroke-border" strokeWidth="1" />
        {path && <path d={path} fill="none" className="stroke-muted-foreground" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>24 h ago</span>
        <span>slowest {Math.round(highest)} ms</span>
        <span>now</span>
      </figcaption>
    </figure>
  );
}
