import type { SportSlug } from '@rally/shared';

const paths = (sport: string) => [`/seed-photos/${sport}-01.jpg`, `/seed-photos/${sport}-02.jpg`];
export const sportPhotos: Record<SportSlug, string[]> = {
  basketball: paths('basketball'), pickleball: paths('pickleball'), tennis: paths('tennis'), soccer: paths('soccer'),
  volleyball: paths('volleyball'), baseball: paths('baseball'), softball: paths('softball'), running_track: paths('running-track'),
  golf_range: paths('golf-range'), skate: paths('skate'), football: paths('football'), handball: paths('handball'),
};
