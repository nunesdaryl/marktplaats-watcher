/** Quiet placeholder rows while a list is loading. */
export default function Skeleton() {
  return <div className="skeleton" role="status" aria-label="Loading">
    {[0, 1, 2].map((i) => <div className="skeleton-row" key={i}><span /><span /></div>)}
  </div>;
}
