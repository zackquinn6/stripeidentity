import { RentalItem } from '@/types/rental';
import { useBooqableIdMap } from '@/hooks/useBooqableIdMap';

interface BooqableEmbedStagingProps {
  items: RentalItem[];
}

/**
 * Hidden container for Booqable product button placeholders.
 * 
 * These placeholders are picked up by the Booqable script which transforms
 * them into real "Add to Cart" buttons. We keep them off-screen so the guided
 * ordering UI remains clean, but the cart sync can still click them.
 * 
 * Uses resolved UUIDs (not slugs) for the data-id attribute.
 */
const BooqableEmbedStaging = ({ items }: BooqableEmbedStagingProps) => {
  const { slugToUuid, isLoading } = useBooqableIdMap();

  // Only render items that have a booqableId (slug) and quantity > 0
  const eligibleItems = items.filter(
    (item) => item.booqableId && item.quantity > 0 && !item.isConsumable && !item.isSalesItem
  );

  if (isLoading || eligibleItems.length === 0) {
    return null;
  }

  return (
    <div
      id="booqable-embed-staging"
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '1px',
        height: '1px',
        opacity: 0,
        overflow: 'hidden',
        // Allow pointer events so programmatic clicks work
        pointerEvents: 'auto',
      }}
    >
      {eligibleItems.map((item) => {
        // item.booqableId is a slug from our DB
        // Resolve to UUID if possible, fall back to slug
        const resolvedId = slugToUuid[item.booqableId!] || item.booqableId!;
        
        return (
          <div
            key={item.id}
            className="booqable-product-button"
            data-id={resolvedId}
            data-slug={item.booqableId}
            data-quantity={item.quantity}
          />
        );
      })}
    </div>
  );
};

export default BooqableEmbedStaging;
