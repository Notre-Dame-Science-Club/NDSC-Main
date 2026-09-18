/**
 * Sits directly under the hero rather than at the foot of the founder
 * section. Earlier it lived inside the Legacy chapter and, by the time a
 * visitor scrolled far enough to see it, the camera had already swung in
 * close on the planet -- the numbers ended up printed over a wall of globe.
 * Here the rig is still on its wide chapter-0 framing, so the stats read
 * against open space instead.
 *
 * Deliberately outside any [data-cosmos-chapter] section: it doesn't need
 * its own camera waypoint, it just borrows the hero's.
 */
export default function StatsStrip() {
  return (
    <div className="ch-stats">
      <div className="ch-stats-grid" data-rv="up">
        <div className="ch-stat"><b>70+</b><span>Years of Legacy</span></div>
        <div className="ch-stat"><b>20,000+</b><span>Members &amp; Alumni</span></div>
        <div className="ch-stat"><b>1,000+</b><span>Workshops &amp; Sessions</span></div>
        <div className="ch-stat"><b>1st</b><span>Science Club in S. Asia</span></div>
      </div>
    </div>
  );
}
