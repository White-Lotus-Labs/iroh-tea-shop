import { describe, expect, it } from 'vitest';
import {
  canvasFont,
  getPageShot,
  pageShotKey,
  paintRefs,
  rememberPageShot,
} from '../src/ui/waiting-room/pageSnapshot';

describe('pageSnapshot cache', () => {
  it('stores a shot by page index and width', () => {
    rememberPageShot(3, 420.4, 'data:image/jpeg;base64,xx');
    expect(pageShotKey(3, 420.4)).toBe('3:420');
    expect(getPageShot(3, 420)).toBe('data:image/jpeg;base64,xx');
    expect(getPageShot(3, 100)).toBeUndefined();
  });

  it('builds a canvas font when the CSS shorthand is empty', () => {
    expect(
      canvasFont({
        font: '',
        fontStyle: 'italic',
        fontWeight: '400',
        fontSize: '18px',
        fontFamily: 'Georgia, serif',
      }),
    ).toBe('italic 400 18px Georgia, serif');
    expect(
      canvasFont({
        font: '700 9.5px / 11.4px Arial',
        fontStyle: 'normal',
        fontWeight: '700',
        fontSize: '9.5px',
        fontFamily: 'Arial',
      }),
    ).toBe('700 9.5px / 11.4px Arial');
  });

  it('finds each outside paint an svg needs, once', () => {
    expect(
      paintRefs(
        '<rect fill="url(#dock-gold)"/><path stroke="url(#dock-bronze)"/>' +
          '<circle fill="url(#dock-gold)"/>',
      ),
    ).toEqual(['dock-gold', 'dock-bronze']);
    expect(paintRefs('<path fill="#3a2a1d"/>')).toEqual([]);
  });
});
