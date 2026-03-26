import React, { memo, useCallback } from 'react';
import { Grid } from 'react-window';
import FeedCard from './FeedCard';
import { Loader } from '../../components/common';

function FeedList({ events, loading, onEventClick, onLoadMore, hasMore, columns = 3 }) {
  const CARD_HEIGHT = 320;
  const CARD_WIDTH = 380;
  const GAP = 16;

  // Calculate grid dimensions
  const containerWidth = columns * CARD_WIDTH + (columns - 1) * GAP;
  const rowCount = Math.ceil(events.length / columns);

  const Cell = useCallback(({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columns + columnIndex;
    if (index >= events.length) return null;

    const event = events[index];
    
    return (
      <div 
        style={{
          ...style,
          left: style.left + GAP / 2,
          top: style.top + GAP / 2,
          width: style.width - GAP,
          height: style.height - GAP
        }}
      >
        <FeedCard event={event} onClick={onEventClick} />
      </div>
    );
  }, [events, columns, onEventClick]);

  const handleItemsRendered = useCallback(({ visibleRowStopIndex }) => {
    const visibleIndex = (visibleRowStopIndex + 1) * columns;
    if (hasMore && visibleIndex >= events.length - columns * 2) {
      onLoadMore?.();
    }
  }, [events.length, columns, hasMore, onLoadMore]);

  if (loading && events.length === 0) {
    return <Loader text="Loading feed..." />;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No events found
      </div>
    );
  }

  // For smaller lists, use simple grid without virtualization
  if (events.length <= 30) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event, i) => (
          <FeedCard key={event.id || event._id || i} event={event} onClick={onEventClick} />
        ))}
        {loading && (
          <div className="col-span-3">
            <Loader text="Loading more..." />
          </div>
        )}
      </div>
    );
  }

  // Virtualized grid for large lists
  return (
    <div style={{ width: '100%' }}>
      <Grid
        columnCount={columns}
        columnWidth={CARD_WIDTH}
        height={800}
        rowCount={rowCount}
        rowHeight={CARD_HEIGHT}
        width={containerWidth}
        onItemsRendered={handleItemsRendered}
      >
        {Cell}
      </Grid>
      {loading && <Loader text="Loading more..." />}
    </div>
  );
}

export default memo(FeedList);
