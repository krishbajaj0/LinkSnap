import { Types } from 'mongoose';
import { Link } from '../links/model.js';
import { collectClick, createCountryLookup } from './metadata.js';
import { ClickEvent } from './model.js';

export async function persistClick(event) {
  const _id = event._id ?? new Types.ObjectId();
  try {
    await ClickEvent.collection.insertOne({ ...event, _id }, { timeoutMS: 1500 });
  } catch (error) {
    if (error.code === 11000) return;
    throw error;
  }

  await Link.collection.updateOne({ _id: event.linkId, ownerId: event.ownerId }, {
    $inc: { lifetimeClicks: 1, [event.bot ? 'lifetimeBotClicks' : 'lifetimeHumanClicks']: 1 },
  }, { timeoutMS: 1500 });
}

export function createClickRecorder(config, write = persistClick) {
  if (!config.mongoUri) return () => {};
  const lookupCountry = createCountryLookup(config.geoIpPath);
  let pending = 0;
  let lastWarning = 0;

  function warn() {
    if (Date.now() - lastWarning < 60_000) return;
    lastWarning = Date.now();
    console.warn('An analytics click was dropped or its lifetime counter could not be updated.');
  }

  return (request, link, clientIp) => {
    if (request.method !== 'GET'
      || /\b(?:prefetch|prerender)\b/i.test([request.get('Sec-Purpose'), request.get('Purpose')].join(' '))) return;
    if (pending >= 64) {
      warn();
      return;
    }
    pending += 1;
    void collectClick(request, link, { visitorSecret: config.visitorSecret, lookupCountry, clientIp })
      .then(write).catch(warn).finally(() => { pending -= 1; });
  };
}
