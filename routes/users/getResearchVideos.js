import Debug from 'debug';
import dbManager from '../../lib/dbManager';

const debug = Debug('routes:users:getResearchVideos');

export default () => {
  debug('Fetching research videos from database');
  return dbManager.getDb()
    .collection('researchVideos')
    .find({})
    .toArray()
    .then((researchVideos) => {
      debug('ResearchVideos', researchVideos);
      return researchVideos;
    });
};
