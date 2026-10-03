import { useEffect, useId } from 'react';

interface EthicalAdSlotProps {
  className?: string;
  type?: 'image' | 'native' | 'text';
}

const PUBLISHER_ID = (import.meta.env.VITE_ETHICALADS_PUBLISHER_ID as string | undefined)?.trim() || 'YOUR-PUBLISHER-ID';

/** Reusable EthicalAds placement. The fixed min-height prevents the review layout from jumping while the ad loads. */
export function EthicalAdSlot({ className = '', type = 'image' }: EthicalAdSlotProps) {
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    // EthicalAds observes newly-added placements; dispatching a resize also
    // helps it re-evaluate a slot after route changes in the SPA.
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    return () => window.clearTimeout(timer);
  }, [id]);

  return (
    <div
      className={`ethical-ad-slot w-full overflow-hidden ${className}`}
      style={{ minHeight: 90 }}
      aria-label="Advertisement"
      data-ethical-ad-slot={id}
    >
      <div
        className="my-ad-wrapper w-full"
        data-ea-publisher={PUBLISHER_ID}
        data-ea-type={type}
      />
    </div>
  );
}
