// Measured line centers are expressed as scrollTop values that center that line.
export function findResumeWord(
  centers: number[],
  scrollTop: number,
): number | null {
  let index: number | null = null;
  let distance = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const nextDistance = Math.abs(centers[i] - scrollTop);
    // The first word wins ties within the same rendered line.
    if (Number.isFinite(nextDistance) && nextDistance < distance - 0.5) {
      index = i;
      distance = nextDistance;
    }
  }
  return index;
}

export class ManualPosition {
  armed = false;
  dirty = false;
  private lastTop = 0;
  private heldCursor: number | null = null;

  begin(scrollTop: number) {
    this.armed = true;
    this.lastTop = scrollTop;
  }

  scroll(scrollTop: number): boolean {
    if (!this.armed || Math.abs(scrollTop - this.lastTop) < 0.5) return false;
    this.lastTop = scrollTop;
    this.dirty = true;
    return true;
  }

  resume(centers: number[], scrollTop: number): number | null {
    this.armed = false;
    if (!this.dirty) return null;
    const nextWord = findResumeWord(centers, scrollTop);
    this.dirty = false;
    // Engine cursor means last spoken word, so the selected line is still unread.
    this.heldCursor = nextWord === null ? null : nextWord - 1;
    return nextWord;
  }

  shouldHold(cursor: number): boolean {
    if (this.dirty) return true;
    if (this.heldCursor === null) return false;
    if (cursor === this.heldCursor) return true;
    // Only a new speech position releases the manually placed camera.
    this.heldCursor = null;
    return false;
  }

  clear() {
    this.armed = false;
    this.dirty = false;
    this.heldCursor = null;
  }
}
