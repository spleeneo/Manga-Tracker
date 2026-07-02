export const MOBILE_CARD_SWIPE_LIMIT = 80;
export const MOBILE_CARD_SYNC_THRESHOLD = 64;

export function getMobileCardSwipeOffset(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
) {
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    if (deltaX <= 0 || Math.abs(deltaX) <= Math.abs(deltaY)) return 0;
    return Math.min(deltaX, MOBILE_CARD_SWIPE_LIMIT);
}

export function shouldSyncFromMobileCardSwipe(offset: number) {
    return offset >= MOBILE_CARD_SYNC_THRESHOLD;
}
