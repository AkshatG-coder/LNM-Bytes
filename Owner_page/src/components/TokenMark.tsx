/** The LNM Bytes mark: a haldi canteen token with half-round notches on both sides. */
export default function TokenMark({ size = 36 }: { size?: number }) {
  const notch = Math.round(size / 7);
  const mask = `radial-gradient(circle ${notch}px at 0 50%, #0000 96%, #000) left / 51% 100% no-repeat, radial-gradient(circle ${notch}px at 100% 50%, #0000 96%, #000) right / 51% 100% no-repeat`;
  return (
    <span
      aria-hidden
      className="flex items-center justify-center bg-primary text-on-primary font-display font-extrabold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5, borderRadius: 8, WebkitMask: mask, mask }}
    >
      L
    </span>
  );
}
